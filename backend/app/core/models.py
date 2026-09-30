from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.sql import func
from app.core.database import Base

class TimestampMixin:
    """Миксин для добавления времени создания и обновления"""
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class BaseIDModel(Base):
    """Абстрактный класс, чтобы не дублировать ID и метаданные"""
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)
