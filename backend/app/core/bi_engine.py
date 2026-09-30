"""
Система Business Intelligence (BI Engine) / Аналитическое Ядро.

Позволяет администраторам динамически конструировать SQL-запросы на "лету"
(выбирать, по каким полям сгруппировать данные и какие метрики посчитать).

Это критически важный с точки зрения безопасности модуль, так как он
собирает SQL-код из строк. Для защиты от SQL Инъекций (SQL Injection),
здесь реализована система Жестких Белых Списков (Whitelists).
"""
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel
from datetime import datetime

# Белый Список Разрешенных Измерений (Для GROUP BY)
# Злоумышленник не может передать "DROP TABLE", он может выбрать только ключи из этого словаря.
ALLOWED_DIMENSIONS = {
    "date": "DATE(vps.created_at)",
    "anime_title": "a.title",
    "role": "u.role", 
    "episode": "vps.episode_number"
}

# Белый Список Разрешенных Метрик (Для Агрегации)
ALLOWED_METRICS = {
    "views": "COUNT(vps.id)",                                 # Кол-во просмотров
    "unique_viewers": "COUNT(DISTINCT vps.user_id)",          # Уникальные юзеры
    "total_watch_time": "SUM(vps.duration_watched)",          # Суммарное время просмотра
    "bandwidth_mb": "SUM(vps.bandwidth_mb)",                  # Расход трафика сервера
    "avg_watch_time": "AVG(vps.duration_watched)"             # Среднее время в плеере
}

class BIQueryRequest(BaseModel):
    """Схема запроса для генерации Аналитического Отчета"""
    dimensions: List[str]  # Наборы группировки (Например: ["date", "anime_title"])
    metrics: List[str]     # Что считаем? (Например: ["views", "bandwidth_mb"])
    start_date: str = None # Формат YYYY-MM-DD
    end_date: str = None   # Формат YYYY-MM-DD
    limit: int = 100       # Максимальное кол-во строк в отчете

def build_bi_query(request: BIQueryRequest) -> Tuple[str, Dict[str, Any]]:
    """
    Безопасно генерирует сложный SQL запрос (Текст) + Словарь параметров 
    на основе пожеланий администратора (Конструктор отчетов).
    
    Возвращает:
        (sql_query_string, parameters_dict)
    """
    # 1. Валидация входных данных об Белый Список
    select_clauses = []
    group_by_clauses = []
    
    # Обрабатываем Разрезы (Dimensions)
    for dim in request.dimensions:
        if dim not in ALLOWED_DIMENSIONS:
            raise ValueError(f"Неизвестное измерение: {dim}")
        sql_expr = ALLOWED_DIMENSIONS[dim]
        select_clauses.append(f"{sql_expr} as {dim}")
        group_by_clauses.append(sql_expr)
        
    # Обрабатываем Метрики (Metrics)
    if not request.metrics:
        raise ValueError("Требуется выбрать как минимум одну метрику для расчета.")
        
    for met in request.metrics:
        if met not in ALLOWED_METRICS:
            raise ValueError(f"Неизвестная метрика: {met}")
        sql_expr = ALLOWED_METRICS[met]
        select_clauses.append(f"{sql_expr} as {met}")
        
    if not select_clauses:
        raise ValueError("Запрос пустой.")

    # 2. Построение Базового SQL Запроса
    # Сердцем аналитики является гигантская таблица 'video_playback_sessions' (Факты просмотров)
    base_sql = """
        FROM video_playback_sessions vps
        LEFT JOIN animes a ON vps.anime_id = a.id
        LEFT JOIN users u ON vps.user_id = u.id
    """
    
    # 3. Условия фильтрации (WHERE)
    where_clauses = []
    params = {}
    
    if request.start_date:
        where_clauses.append("vps.created_at >= :start_date")
        # asyncpg драйвер требует настоящие объекты datetime, а не сырые строки
        params["start_date"] = datetime.strptime(f"{request.start_date} 00:00:00", "%Y-%m-%d %H:%M:%S")
        
    if request.end_date:
        where_clauses.append("vps.created_at <= :end_date")
        params["end_date"] = datetime.strptime(f"{request.end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
        
    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)
        
    # 4. Сборка группировок (GROUP BY)
    group_by_sql = ""
    if group_by_clauses:
        group_by_sql = "GROUP BY " + ", ".join(group_by_clauses)
        
    # По умолчанию сортируем по самой первой метрике от большего к меньшему
    order_by_sql = f"ORDER BY {request.metrics[0]} DESC"
    
    # Добавляем жесткий лимит, чтобы сервер не взорвался от перегрузки памяти (max 1000)
    limit_sql = f"LIMIT :limit"
    params["limit"] = min(request.limit, 1000) 
        
    # 5. Финальная сборка всех кусков в единый SQL String
    final_sql = f"""
        SELECT {", ".join(select_clauses)}
        {base_sql}
        {where_sql}
        {group_by_sql}
        {order_by_sql}
        {limit_sql}
    """
    
    return final_sql, params
