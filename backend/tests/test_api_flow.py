
import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_full_flow(client: AsyncClient):
    print("\n--- Testing Full API Flow (Register -> Login -> Me) ---")
    
    # 1. Register a random user
    username = f"user_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    password = "Structure_senior_password1!" # Added '!' to satisfy 'at least one special character' rule
    
    print(f"1. Registering user: {username}")
    response = await client.post("/api/v1/users/", json={
        "email": email,
        "username": username,
        "password": password,
        "full_name": "Test User"
    })
    
    if response.status_code != 201:
        print(f"❌ Registration Failed: {response.status_code} {response.text}")
    
    assert response.status_code == 201
    user_data = response.json()
    assert user_data["email"] == email
    
    # 2. Login
    print("2. Logging in...")
    response = await client.post("/api/v1/auth/login", data={
        "username": username,
        "password": password
    })
    
    assert response.status_code == 200
    token_data = response.json()
    token = token_data["access_token"]
    assert token is not None
    
    # 3. Get Me
    print("3. Getting Profile (/users/me)...")
    response = await client.get("/api/v1/users/me", headers={
        "Authorization": f"Bearer {token}"
    })
    
    assert response.status_code == 200
    me_data = response.json()
    assert me_data["email"] == email
    assert me_data["username"] == username
