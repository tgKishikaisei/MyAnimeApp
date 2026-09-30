"""
Улучшенная политика паролей (Валидация сложности).
"""

import re
from typing import Tuple


class PasswordValidator:
    """Уровневая валидация пароля (Best practices)"""
    
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    
    @staticmethod
    def validate(password: str) -> Tuple[bool, str]:
        """
        Проверяет силу пароля.
        
        Возвращает:
            Tuple[bool, str]: (is_valid, error_message)
        """
        if len(password) < PasswordValidator.MIN_LENGTH:
            return False, f"Пароль должен состоять минимум из {PasswordValidator.MIN_LENGTH} символов"
        
        if len(password) > PasswordValidator.MAX_LENGTH:
            return False, f"Длина пароля не может превышать {PasswordValidator.MAX_LENGTH} символов"
        
        # Проверка хотя бы одной заглавной буквы
        if not re.search(r"[A-Z]", password):
            return False, "Пароль должен содержать хотя бы одну заглавную букву (A-Z)"
        
        # Проверка хотя бы одной строчной буквы
        if not re.search(r"[a-z]", password):
            return False, "Пароль должен содержать хотя бы одну строчную букву (a-z)"
        
        # Проверка хотя бы одной цифры
        if not re.search(r"\d", password):
            return False, "Пароль должен содержать хотя бы одну цифру (0-9)"
        
        # Проверка хотя бы одного спецсимвола
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            return False, "Пароль должен содержать минимум один специальный символ (!@#$%^&*...)"
        
        # Проверка по словарю утечек популярных (слабых) паролей
        weak_passwords = ['Password123!', 'Admin123!', 'Welcome123!', 'Qwerty123!']
        if password in weak_passwords:
            return False, "Этот пароль слишком популярный и уязвим. Пожалуйста, выберите более надежный пароль"
        
        return True, ""
    
    @staticmethod
    def validate_or_raise(password: str) -> None:
        """Валидирует пароль или выбрасывает ValueError исключение"""
        is_valid, error = PasswordValidator.validate(password)
        if not is_valid:
            raise ValueError(error)
