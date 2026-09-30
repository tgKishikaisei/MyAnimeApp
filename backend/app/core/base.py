"""
Агрегатор моделей для Alembic и тестов.
Импортирует Base и ВСЕ модели проекта, чтобы `alembic revision --autogenerate`
и `alembic check` видели полную схему, а не только часть таблиц.
"""
from app.core.database import Base  # noqa: F401

from app.modules.analytics import models as _analytics  # noqa: F401
from app.modules.anime import models as _anime  # noqa: F401
from app.modules.anime import recommendation_weights as _weights  # noqa: F401
from app.modules.announcements import models as _announcements  # noqa: F401
from app.modules.audit import models as _audit  # noqa: F401
from app.modules.comments import models as _comments  # noqa: F401
from app.modules.notifications import models as _notifications  # noqa: F401
from app.modules.playlists import models as _playlists  # noqa: F401
from app.modules.reports import models as _reports  # noqa: F401
from app.modules.system import models as _system  # noqa: F401
from app.modules.user import models as _user  # noqa: F401
from app.modules.watchlist import models as _watchlist  # noqa: F401
