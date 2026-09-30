"""
Unit tests for User Service.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.user.service import user_service
from app.modules.user.schemas import UserCreate
from app.modules.user.models import UserRole


class TestUserService:
    """Test User Service business logic"""
    
    @pytest.mark.asyncio
    async def test_create_user(self, db_session: AsyncSession, test_user_data):
        """Test user creation"""
        user_in = UserCreate(**test_user_data)
        user = await user_service.create_user(db_session, user_in)
        
        assert user.email == test_user_data["email"]
        assert user.username == test_user_data["username"]
        assert user.role == UserRole.VIEWER
        assert user.is_active is True
        assert hasattr(user, 'hashed_password')
        assert user.hashed_password != test_user_data["password"]  # Should be hashed
    
    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, db_session: AsyncSession, test_user_data):
        """Test successful authentication"""
        # Create user
        user_in = UserCreate(**test_user_data)
        await user_service.create_user(db_session, user_in)
        
        # Authenticate with username
        user = await user_service.authenticate_user(
            db_session,
            username=test_user_data["username"],
            password=test_user_data["password"]
        )
        
        assert user is not None
        assert user.username == test_user_data["username"]
    
    @pytest.mark.asyncio
    async def test_authenticate_user_with_email(self, db_session: AsyncSession, test_user_data):
        """Test authentication using email"""
        # Create user
        user_in = UserCreate(**test_user_data)
        await user_service.create_user(db_session, user_in)
        
        # Authenticate with email
        user = await user_service.authenticate_user(
            db_session,
            username=test_user_data["email"],  # Using email as username
            password=test_user_data["password"]
        )
        
        assert user is not None
        assert user.email == test_user_data["email"]
    
    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self, db_session: AsyncSession, test_user_data):
        """Test authentication with wrong password"""
        # Create user
        user_in = UserCreate(**test_user_data)
        await user_service.create_user(db_session, user_in)
        
        # Try wrong password
        user = await user_service.authenticate_user(
            db_session,
            username=test_user_data["username"],
            password="WrongPassword123!"
        )
        
        assert user is None
    
    @pytest.mark.asyncio
    async def test_duplicate_email(self, db_session: AsyncSession, test_user_data):
        """Test creating user with duplicate email"""
        from app.modules.user.exceptions import UserAlreadyExists
        
        user_in = UserCreate(**test_user_data)
        await user_service.create_user(db_session, user_in)
        
        # Try to create another user with same email
        with pytest.raises(UserAlreadyExists):
            await user_service.create_user(db_session, user_in)
