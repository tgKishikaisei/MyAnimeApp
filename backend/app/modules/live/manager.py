"""
Менеджер "Живых" Соединений (Live Dashboard).
Управляет WebSocket-подключениями администраторов для визуализации 
3D-Глобуса или тепловой карты в реальном времени.
"""
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    """
    Простой класс-менеджер для удержания активных подключений в памяти сервера.
    Он нужен для того, чтобы когда приходит событие "Кто-то запустил видео", 
    сервер знал кому нужно разослать координаты для прорисовки.
    """
    def __init__(self):
        # Хранит все открытые сокеты
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Когда админ открывает дашборд, добавляем его браузер в список."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Если админ закрыл дашборд - удаляем сокет, чтобы не тратить память."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """
        Отправляет JSON сообщение во ВСЕ открытые браузеры админов одновременно.
        Используется роутерами аналитики (например, в report_stream_start).
        """
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Если соединение оборвалось, но мы не успели его удалить - просто игнорируем,
                # чтобы не поломать цикл рассылки остальным.
                pass

# Создаем глобальный Singleton
manager = ConnectionManager()
