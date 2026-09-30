"""
Integration tests for Anime API endpoints.
"""
import pytest
from httpx import AsyncClient


class TestAnimeAPI:
    """Test anime catalog endpoints"""

    @pytest.mark.asyncio
    async def test_get_anime_list_unauthenticated(self, client: AsyncClient):
        """Anime catalog should be publicly accessible"""
        response = await client.get("/api/v1/animes/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_anime_list_pagination(self, client: AsyncClient):
        """Test pagination params are accepted"""
        response = await client.get("/api/v1/animes/?skip=0&limit=5")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_anime(self, client: AsyncClient):
        """Requesting a non-existent anime should return 404"""
        response = await client.get("/api/v1/animes/999999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_search_anime(self, client: AsyncClient):
        """Search endpoint should respond with a list"""
        response = await client.get("/api/v1/animes/?search=naruto")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Health check endpoint must always return 200"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestWatchlistAPI:
    """Test watchlist endpoints (requires auth)"""

    async def _get_token(self, client: AsyncClient, test_user_data: dict) -> str:
        """Helper — register + login, return token."""
        import uuid
        # Use unique email to avoid conflicts
        uid = uuid.uuid4().hex[:8]
        data = {**test_user_data, "username": f"user_{uid}", "email": f"user_{uid}@test.com"}
        await client.post("/api/v1/users/", json=data)
        resp = await client.post(
            "/api/v1/auth/login",
            data={"username": data["username"], "password": data["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        return resp.json()["access_token"]

    @pytest.mark.asyncio
    async def test_watchlist_requires_auth(self, client: AsyncClient):
        """Watchlist without token should return 401 or 403"""
        response = await client.get("/api/v1/watchlist/")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_watchlist_get_empty(self, client: AsyncClient, test_user_data):
        """New user should have an empty watchlist"""
        token = await self._get_token(client, test_user_data)
        response = await client.get(
            "/api/v1/watchlist/",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json() == []
