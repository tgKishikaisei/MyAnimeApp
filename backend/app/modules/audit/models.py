from sqlalchemy import Column, Integer, String, JSON
from app.core.models import BaseIDModel, TimestampMixin

class AuditLog(BaseIDModel, TimestampMixin):
    """
    Таблица Журнала Аудита (Audit Log).
    Главный инструмент безопасности для отслеживания всех действий модераторов и администраторов.
    Здесь записывается: "КТО", "ЧТО СДЕЛАЛ", и "С КАКИМ ОБЪЕКТОМ".
    Пример: Админ Петя удалил Комментарий #15.
    """
    __tablename__ = "audit_logs"

    # Кто совершил действие? (Может быть NULL, если это сделала сама система сервера)
    user_id = Column(Integer, index=True, nullable=True) 
    
    # Какое именно действие было совершено? (Например: "Изменена роль пользователя", "Очищен кэш")
    action = Column(String(255), nullable=False) 
    
    # Какой объект затронут? (Например: "User #5", "База Redis")
    target = Column(String(255), nullable=True)  
    
    # Детальная информация (Опционально). 
    # В JSON можно записать, например, как выглядел объект ДО изменения и ПОСЛЕ.
    details = Column(JSON, nullable=True) 
