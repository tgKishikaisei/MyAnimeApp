"""
Integration tests for Auth API endpoints.
"""

import pytest
from httpx import AsyncClient


class TestAuthAPI:
    """Test authentication endpoints"""
    
    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, test_user_data):
        """Test successful user registration"""
        response = await client.post("/api/v1/users/", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["username"] == test_user_data["username"]
        assert "password" not in data
        assert "hashed_password" not in data
    
    @pytest.mark.asyncio
    async def test_register_missing_field(self, client: AsyncClient):
        """Test registration with missing required field"""
        invalid_data = {
            "email": "test@example.com",
            # Missing username and password
        }
        
        response = await client.post("/api/v1/users/", json=invalid_data)
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user_data):
        """Test successful login"""
        # Register user first
        await client.post("/api/v1/users/", json=test_user_data)
        
        # Login
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        response = await client.post(
            "/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_login_with_email(self, client: AsyncClient, test_user_data):
        """Test login using email instead of username"""
        # Register user first
        await client.post("/api/v1/users/", json=test_user_data)
        
        # Login with email
        login_data = {
            "username": test_user_data["email"],  # Using email
            "password": test_user_data["password"]
        }
        response = await client.post(
            "/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user_data):
        """Test login with incorrect password"""
        # Register user first
        await client.post("/api/v1/users/", json=test_user_data)
        
        # Try login with wrong password
        login_data = {
            "username": test_user_data["username"],
            "password": "WrongPassword123!"
        }
        response = await client.post(
            "/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 401
