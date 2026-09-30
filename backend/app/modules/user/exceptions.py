class UserError(Exception):
    """Базовый класс для исключений модуля пользователя."""
    pass

class UserAlreadyExists(UserError):
    """Пользователь с таким email или username уже существует."""
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)

class UserNotFound(UserError):
    """Пользователь не найден."""
    def __init__(self, detail: str = "Пользователь не найден"):
        self.detail = detail
        super().__init__(detail)

class InvalidPassword(UserError):
    """Пароль не проходит политику сложности (422, а не 500)."""
    def __init__(self, detail: str = "Пароль слишком простой"):
        self.detail = detail
        super().__init__(detail)

class ReauthRequired(UserError):
    """Для чувствительного действия нужен текущий пароль."""
    def __init__(self, detail: str = "Подтвердите текущий пароль"):
        self.detail = detail
        super().__init__(detail)

class InvalidCredentials(UserError):
    """Неверные учетные данные."""
    def __init__(self, detail: str = "Неверный логин или пароль"):
        self.detail = detail
        super().__init__(detail)
