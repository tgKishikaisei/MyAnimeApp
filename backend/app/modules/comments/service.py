"""
Сервисный слой модуля Комментариев.
Отвечает за сложную логику построения древовидных комментариев, 
подсчет эмодзи-реакций с помощью агрегации SQL и управление таймкодами для видеоплеера.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.modules.comments.models import Comment, CommentReaction, ALLOWED_EMOJIS
from app.modules.user.models import User


class CommentService:
    """
    Бизнес-логика системы комментариев.
    Инкапсулирует тяжелые SQL запросы, чтобы API эндпоинты оставались быстрыми и чистыми.
    """

    def _serialize_comment(
        self,
        comment: Comment,
        username: str,
        avatar_url: str | None,
        reactions: dict,
        my_reaction: str | None,
        replies: list = [],
    ) -> Dict[str, Any]:
        """
        Собирает все разрозненные данные о комментарии в один красивый JSON-ответ для фронтенда.
        Здесь объединяются:
        1. Сам текст комментария.
        2. Имя и аватарка автора.
        3. Все лайки/реакции в виде словаря {"👍": 5, "🔥": 2}.
        4. Реакция текущего пользователя (если он ставил).
        5. Ответы на этот комментарий (ветка диалога).
        """
        return {
            "id": comment.id,
            "user_id": comment.user_id,
            "username": username or "Аноним",
            "avatar_url": avatar_url,
            "content": comment.content,
            "created_at": comment.created_at,
            "parent_id": comment.parent_id,
            "timecode_seconds": comment.timecode_seconds,   # Секунда видео (если комментарий привязан к видео)
            "reactions": reactions,                         # Словарь всех реакций
            "my_reaction": my_reaction,                     # Реакция, которую поставил ТЫ
            "replies": replies,                             # Вложенные комментарии (ответы)
        }

    async def get_target_comments(
        self, db: AsyncSession, target_type: str, target_id: int, current_user_id: int | None = None
    ) -> List[Dict[str, Any]]:
        """
        Главный метод загрузки комментариев (например, для страницы аниме или страницы новостей).
        Строит ДЕРЕВО (отцы и дети), делая всего 2-3 запроса к базе данных, чтобы избежать проблемы N+1.
        """
        # 1. ЗАПРОС К БАЗЕ: Загружаем все неудаленные и не спам комментарии для конкретного объекта страницы.
        # Одновременно приклеиваем (JOIN) данные о пользователе (имя, аватар).
        query = (
            select(Comment, User.username, User.avatar_url)
            .outerjoin(User, Comment.user_id == User.id)
            .where(Comment.target_type == target_type)
            .where(Comment.target_id == target_id)
            .where(Comment.is_deleted == False)
            .where(Comment.is_spam == False)
            .order_by(Comment.created_at)
        )
        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return []

        # Собираем ID всех комментариев, чтобы одним махом запросить к ним лайки
        comment_ids = [r.Comment.id for r in rows]

        # 2. ЗАПРОС К БАЗЕ: Группируем реакции (func.count) по ID комментария и типу эмодзи.
        # На выходе получаем плоский список: (Comment_1, "👍", 10), (Comment_1, "🔥", 5)
        reactions_query = (
            select(CommentReaction.comment_id, CommentReaction.emoji, func.count().label("cnt"))
            .where(CommentReaction.comment_id.in_(comment_ids))
            .group_by(CommentReaction.comment_id, CommentReaction.emoji)
        )
        reactions_result = await db.execute(reactions_query)
        reactions_rows = reactions_result.all()

        # Трансформируем плоский список в удобный словарь: {comment_id: {"👍": 3, "🔥": 1}}
        reactions_map: Dict[int, Dict[str, int]] = {}
        for r in reactions_rows:
            if r.comment_id not in reactions_map:
                reactions_map[r.comment_id] = {}
            reactions_map[r.comment_id][r.emoji] = r.cnt

        # 3. ЗАПРОС К БАЗЕ (ОПЦИОНАЛЬНО): Если запрос делает авторизованный юзер,
        # ищем среди всех этих реакций те, которые поставил ЛИЧНО ОН (чтобы подсветить кнопку красным цветом фронте).
        my_reactions_map: Dict[int, str] = {}
        if current_user_id:
            my_query = select(CommentReaction.comment_id, CommentReaction.emoji).where(
                CommentReaction.comment_id.in_(comment_ids),
                CommentReaction.user_id == current_user_id,
            )
            my_result = await db.execute(my_query)
            for row in my_result.all():
                my_reactions_map[row.comment_id] = row.emoji

        # 4. ПОСТРОЕНИЯ ДЕРЕВА В ПАМЯТИ: (Алгоритм сборки ответов в древовидную структуру)
        comment_map: Dict[int, Dict[str, Any]] = {}
        for row in rows:
            c = row.Comment
            # Пропускаем комментарий через сериализатор
            comment_map[c.id] = self._serialize_comment(
                c,
                row.username,
                row.avatar_url,
                reactions=reactions_map.get(c.id, {}),
                my_reaction=my_reactions_map.get(c.id),
                replies=[],
            )

        roots: List[Dict[str, Any]] = []
        for row in rows:
            c = row.Comment
            node = comment_map[c.id]
            # Если нет родителя — это корневой комментарий (верхний уровень)
            if c.parent_id is None:
                roots.append(node)
            # Если есть родитель — кладем этот комментарий внутрь свойства `replies` его отца
            elif c.parent_id in comment_map:
                comment_map[c.parent_id]["replies"].append(node)

        # Переворачиваем, чтобы свежие корневые комментарии были сверху
        roots.reverse()
        return roots

    async def create_comment(
        self,
        db: AsyncSession,
        user_id: int,
        target_type: str,
        target_id: int,
        content: str,
        toxicity_score: float,
        is_spam: bool,
        parent_id: int | None = None,
        timecode_seconds: float | None = None,
    ) -> Comment:
        """Создаёт комментарий или ответ на комментарий (если передан `parent_id`)."""
        
        # Защита от взлома: проверяем, что родительский комментарий существует и привязан к той же статье/аниме
        if parent_id is not None:
            parent = await db.get(Comment, parent_id)
            if not parent or parent.target_type != target_type or parent.target_id != target_id:
                raise ValueError(
                    "Неверный parent_id: родительский комментарий не найден или не совпадает с целевой страницей"
                )

        comment = Comment(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
            content=content,
            toxicity_score=toxicity_score, # Оценка токсичности нейросетью (0.0 - 1.0)
            is_spam=is_spam,               # Пометка спама
            parent_id=parent_id,
            timecode_seconds=timecode_seconds,
        )
        db.add(comment)
        # Внимание: db.commit() вызывается выше в роутере, здесь только db.add
        return comment

    async def get_clip_timecode_comments(
        self, db: AsyncSession, clip_id: int, current_user_id: int | None = None
    ) -> List[Dict[str, Any]]:
        """
        Специальный метод исключительно для видео-плеера (В стиле SoundCloud/NicoNico).
        Возвращает комментарии, отсортированные по времени их появления в видео (timecode_seconds).
        Используется для рендера белых точек маркеров на полосе прокрутки плеера.
        """
        query = (
            select(Comment, User.username, User.avatar_url)
            .outerjoin(User, Comment.user_id == User.id)
            .where(Comment.target_type == "clip")
            .where(Comment.target_id == clip_id)
            .where(Comment.is_deleted == False)
            .where(Comment.is_spam == False)
            # Сначала сортируем строго по секунде видео, и только потом по дате
            .order_by(Comment.timecode_seconds.asc().nulls_last(), Comment.created_at.asc())
        )
        result = await db.execute(query)
        rows = result.all()
        comment_ids = [r.Comment.id for r in rows]

        # Подгружаем лайки/эмоции аналогично методу get_target_comments
        reactions_map: Dict[int, Dict[str, int]] = {}
        my_reactions_map: Dict[int, str] = {}

        if comment_ids:
            reactions_query = (
                select(CommentReaction.comment_id, CommentReaction.emoji, func.count().label("cnt"))
                .where(CommentReaction.comment_id.in_(comment_ids))
                .group_by(CommentReaction.comment_id, CommentReaction.emoji)
            )
            for r in (await db.execute(reactions_query)).all():
                reactions_map.setdefault(r.comment_id, {})[r.emoji] = r.cnt

            if current_user_id:
                my_q = select(CommentReaction.comment_id, CommentReaction.emoji).where(
                    CommentReaction.comment_id.in_(comment_ids),
                    CommentReaction.user_id == current_user_id,
                )
                for row in (await db.execute(my_q)).all():
                    my_reactions_map[row.comment_id] = row.emoji

        # Возвращаем плоский массив, так как для таймкодов дерево (вложенность) не имеет смысла
        return [
            self._serialize_comment(
                row.Comment, row.username, row.avatar_url,
                reactions=reactions_map.get(row.Comment.id, {}),
                my_reaction=my_reactions_map.get(row.Comment.id),
            )
            for row in rows
        ]

    async def toggle_reaction(
        self,
        db: AsyncSession,
        comment_id: int,
        user_id: int,
        emoji: str,
    ) -> Dict[str, Any]:
        """
        Переключатель реакций (Лайк, Сердце, Смех). Логика работы (Toggle):
        - Если юзер ставит "Лайк", а у него УЖЕ стоял "Лайк" → Лайк снимается.
        - Если юзер ставит "Смех", а у него стоял "Лайк" → "Лайк" меняется на "Смех" (перезапись).
        - Если реакций не было → Ставится "Смех".
        """
        if emoji not in ALLOWED_EMOJIS:
            raise ValueError(f"Недопустимая реакция: {emoji}. Злоумышленник пытается отправить XSS.")

        # 1. Ищем существующую реакцию пользователя на этот конкретный комментарий
        existing_q = select(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == user_id,
        )
        existing = (await db.execute(existing_q)).scalar_one_or_none()

        my_reaction: str | None = None

        if existing:
            if existing.emoji == emoji:
                # Убираем реакцию (юзер сам снял свой лайк)
                await db.delete(existing)
                await db.flush() # flush синхронизирует сессию с БД, но еще не коммитит транзакцию
            else:
                # Юзер передумал и поставил другой эмодзи (Меняем огонь на лайк)
                existing.emoji = emoji
                await db.flush()
                my_reaction = emoji
        else:
            # Юзер ставит реакцию впервые
            new_reaction = CommentReaction(comment_id=comment_id, user_id=user_id, emoji=emoji)
            db.add(new_reaction)
            await db.flush()
            my_reaction = emoji

        # 2. Теперь нужно вернуть фронтенду СВЕЖИЕ счетчики всех реакций для этого коммента
        counts_q = (
            select(CommentReaction.emoji, func.count().label("cnt"))
            .where(CommentReaction.comment_id == comment_id)
            .group_by(CommentReaction.emoji)
        )
        counts = (await db.execute(counts_q)).all()
        reactions = {r.emoji: r.cnt for r in counts}

        # Возвращаем новые счетчики фронтенду, чтобы он сразу обновил цифры в UI без перезагрузки страницы
        return {"reactions": reactions, "my_reaction": my_reaction}


# Глобальный экземпляр
comment_service = CommentService()
