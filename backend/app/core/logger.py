"""
Модуль Системного Журналирования (Structured Logging).

Форматирует все логи (print-ы сервера) в жестко структурированный JSON формат.
Это необходимо для того, чтобы профессиональные системы мониторинга (Kibana, DataDog, Sentry)
могли автоматически парсить логи и строить графики ошибок.
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from app.core.context import get_request_id

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Кастомный JSON-форматтер: Подмешивает к каждому логу системную информацию"""
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        
        # 1. Точное время (Штамп в формате ISO)
        if not log_record.get('timestamp'):
            from datetime import datetime
            log_record['timestamp'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            
        # 2. Уровень важности (INFO, ERROR, WARNING) переводим в верхний регистр
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname

        # 3. Добавляем метаданные: Какой файл и на какой строке вызвал ошибку
        log_record['logger'] = record.name
        log_record['line'] = record.lineno
        log_record['file'] = record.filename

        # 4. САМОЕ ГЛАВНОЕ: Привязываем каждый лог к уникальному ID запроса пользователя.
        # Если юзер словил 500 ошибку и скинул нам ID в техподдержку, мы по этому ID
        # сможем вытащить из миллиона логов именно те, которые относились к его действиям!
        request_id = get_request_id()
        if request_id:
            log_record['request_id'] = request_id

def get_logger(name: str):
    """
    Создает или берет существующий логгер с JSON-форматтером.
    Вызывается в каждом файле как: `logger = get_logger(__name__)`
    """
    logger = logging.getLogger(name)
    
    # Защита от дублирования сообщений в консоли
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        
        # Настраиваем JSON-вывод
        formatter = CustomJsonFormatter('%(timestamp)s %(level)s %(name)s %(message)s')
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        
        # Запрещаем логам всплывать выше до стандартного питоновского root логгера
        logger.propagate = False
        
    return logger