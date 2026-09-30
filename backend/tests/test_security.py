"""
Regression-тесты на исправленные уязвимости (см. AUDIT.md).
Каждый тест падает на старом коде и проходит на новом.
"""
import io
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select, update

from app.core import security
from app.core.file_upload import UnsafePath, _reencode_image, safe_media_path
from app.modules.anime.enums import AnimeSection
from app.modules.anime.models import Anime, Clip
from app.modules.system.admin_router import _cell
from app.modules.user.models import RefreshToken, User, UserRole
from tests.conftest import TEST_PASSWORD, auth_headers

XHR = {"X-Requested-With": "XMLHttpRequest"}


async def _clip(db_session, video_path="videos/demo/clip.mp4") -> Clip:
    anime = Anime(title="Demo", image="/x.png", section=AnimeSection.POPULAR)
    db_session.add(anime)
    await db_session.flush()
    clip = Clip(title="Ep 1", anime_id=anime.id, video_path=video_path)
    db_session.add(clip)
    await db_session.commit()
    await db_session.refresh(clip)
    return clip


# ── A01 / API3: эскалация привилегий через регистрацию и профиль ────────────

async def test_register_cannot_set_role(client: AsyncClient, test_user_data):
    resp = await client.post("/api/v1/users/", json={**test_user_data, "role": "admin"})
    assert resp.status_code == 422


async def test_register_backdoor_email_gets_viewer_role(client: AsyncClient, test_user_data):
    data = {**test_user_data, "email": "admin@example.com"}
    resp = await client.post("/api/v1/users/", json=data)
    assert resp.status_code == 201
    assert resp.json()["role"] == "viewer"


async def test_update_me_cannot_change_role(client: AsyncClient, make_user):
    user = await make_user()
    resp = await client.put("/api/v1/users/me", json={"role": "admin"}, headers=auth_headers(user))
    assert resp.status_code == 422


async def test_update_me_email_requires_current_password(client: AsyncClient, make_user):
    user = await make_user()
    headers = auth_headers(user)
    resp = await client.put("/api/v1/users/me", json={"email": "new@example.com"}, headers=headers)
    assert resp.status_code == 403
    resp = await client.put(
        "/api/v1/users/me",
        json={"email": "new@example.com", "current_password": TEST_PASSWORD},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@example.com"


async def test_public_profile_hides_private_fields(client: AsyncClient, make_user):
    viewer = await make_user()
    other = await make_user(permissions={"manage_anime": True})
    resp = await client.get(f"/api/v1/users/{other.id}", headers=auth_headers(viewer))
    assert resp.status_code == 200
    body = resp.json()
    assert "email" not in body and "permissions" not in body and "banned_until" not in body


async def test_weak_password_is_422_not_500(client: AsyncClient, test_user_data):
    resp = await client.post("/api/v1/users/", json={**test_user_data, "password": "aaaaaaaa"})
    assert resp.status_code == 422


# ── A01: админские и разрушительные эндпоинты ───────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("DELETE", "/api/v1/clips/{id}"),
    ("PATCH", "/api/v1/clips/{id}"),
    ("POST", "/api/v1/seed/"),
    ("POST", "/api/v1/clips/{id}/studio"),
    ("GET", "/api/v1/clips/{id}/audio"),
    ("GET", "/api/v1/tasks/abc/status"),
    ("POST", "/api/v1/downloads/zip"),
    ("GET", "/api/v1/admin/users"),
])
async def test_anonymous_is_rejected(client: AsyncClient, db_session, method, path):
    clip = await _clip(db_session)
    resp = await client.request(method, path.format(id=clip.id), json={})
    assert resp.status_code in (401, 404), resp.text
    assert await db_session.get(Clip, clip.id) is not None


@pytest.mark.parametrize("method,path", [
    ("DELETE", "/api/v1/clips/{id}"),
    ("PATCH", "/api/v1/clips/{id}"),
    ("POST", "/api/v1/seed/"),
    ("GET", "/api/v1/admin/users"),
    ("GET", "/api/v1/admin/stats"),
    ("GET", "/api/v1/admin/export/users"),
])
async def test_viewer_gets_404_on_admin_routes(client: AsyncClient, db_session, make_user, method, path):
    clip = await _clip(db_session)
    viewer = await make_user()
    resp = await client.request(method, path.format(id=clip.id), json={}, headers=auth_headers(viewer))
    assert resp.status_code == 404


async def test_admin_can_list_users(client: AsyncClient, make_user):
    admin = await make_user(role=UserRole.ADMIN)
    resp = await client.get("/api/v1/admin/users", headers=auth_headers(admin))
    assert resp.status_code == 200


async def test_clip_video_path_traversal_rejected(client: AsyncClient, db_session, make_user):
    clip = await _clip(db_session)
    admin = await make_user(role=UserRole.ADMIN)
    for bad in ("../../.env", "/etc/passwd/../../x", "C:\\Windows\\win.ini", "videos/../../../.env"):
        resp = await client.patch(f"/api/v1/clips/{clip.id}", json={"video_path": bad}, headers=auth_headers(admin))
        assert resp.status_code == 422, bad


def test_safe_media_path_blocks_escape():
    assert safe_media_path("/static/videos/a/b.mp4").name == "b.mp4"
    for bad in ("../.env", "videos/../../x", "", "a\x00b"):
        with pytest.raises(UnsafePath):
            safe_media_path(bad)


async def test_download_rejects_clip_outside_static(client: AsyncClient, db_session):
    clip = await _clip(db_session, video_path="../../.env")  # старые «грязные» данные в БД
    sign = await client.get(f"/api/v1/downloads/sign/{clip.id}")
    token = sign.json()["token"]
    resp = await client.get(f"/api/v1/downloads/clip/{clip.id}", params={"token": token})
    assert resp.status_code == 404


# ── A07: токены и сессии ────────────────────────────────────────────────────

async def _login(client: AsyncClient, user: User):
    return await client.post(
        "/api/v1/auth/login",
        data={"username": user.username, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


async def test_login_sets_strict_httponly_refresh_cookie(client: AsyncClient, make_user):
    user = await make_user()
    resp = await _login(client, user)
    assert resp.status_code == 200
    cookie = resp.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api/v1/auth" in cookie


async def test_unknown_user_and_wrong_password_look_the_same(client: AsyncClient, make_user):
    user = await make_user()
    wrong = await client.post("/api/v1/auth/login", data={"username": user.username, "password": "Nope12345!"})
    unknown = await client.post("/api/v1/auth/login", data={"username": "ghost", "password": "Nope12345!"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


async def test_refresh_requires_xhr_header(client: AsyncClient, make_user):
    user = await make_user()
    await _login(client, user)
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 403


async def test_refresh_rotation_and_reuse_detection(client: AsyncClient, db_session, make_user):
    user = await make_user()
    await _login(client, user)
    first = client.cookies.get("refresh_token")

    resp = await client.post("/api/v1/auth/refresh", headers=XHR)
    assert resp.status_code == 200
    second = client.cookies.get("refresh_token")
    assert second and second != first

    # Выходим за окно «гонки вкладок» и повторно используем первый токен — как вор.
    await db_session.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == security.hash_refresh_token(first))
        .values(used_at=datetime.now(timezone.utc) - timedelta(minutes=5))
    )
    await db_session.commit()
    client.cookies.set("refresh_token", first, path="/api/v1/auth")
    stolen = await client.post("/api/v1/auth/refresh", headers=XHR)
    assert stolen.status_code == 401

    # Вся семья отозвана: легитимный второй токен тоже больше не работает.
    client.cookies.set("refresh_token", second, path="/api/v1/auth")
    legit = await client.post("/api/v1/auth/refresh", headers=XHR)
    assert legit.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient, db_session, make_user):
    user = await make_user()
    await _login(client, user)
    raw = client.cookies.get("refresh_token")
    assert (await client.post("/api/v1/auth/logout", headers=XHR)).status_code == 200
    row = (await db_session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == security.hash_refresh_token(raw))
    )).scalar_one()
    await db_session.refresh(row)
    assert row.revoked_at is not None


async def test_refresh_token_is_stored_hashed(client: AsyncClient, db_session, make_user):
    user = await make_user()
    await _login(client, user)
    raw = client.cookies.get("refresh_token")
    stored = (await db_session.execute(select(RefreshToken.token_hash))).scalars().all()
    assert raw not in stored and security.hash_refresh_token(raw) in stored


async def test_ws_ticket_is_not_an_access_token(client: AsyncClient, make_user):
    user = await make_user()
    ticket = security.create_ws_ticket(user.id, "notifications")
    resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {ticket}"})
    assert resp.status_code == 401


async def test_invalid_token_is_401_not_403(client: AsyncClient):
    resp = await client.get("/api/v1/users/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


async def test_alg_none_token_rejected(client: AsyncClient, make_user):
    import jwt as pyjwt
    user = await make_user(role=UserRole.ADMIN)
    forged = pyjwt.encode({"sub": str(user.id), "type": "access"}, key=None, algorithm="none")
    resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


async def test_admin_ws_ticket_denied_for_viewer(client: AsyncClient, make_user):
    viewer = await make_user()
    resp = await client.post("/api/v1/auth/ws-ticket", params={"channel": "admin"}, headers=auth_headers(viewer))
    assert resp.status_code == 404


async def test_banned_user_access_token_rejected(client: AsyncClient, make_user):
    user = await make_user(banned_until=datetime.now(timezone.utc) + timedelta(days=1))
    resp = await client.get("/api/v1/users/me", headers=auth_headers(user))
    assert resp.status_code == 401


# ── A09/A10: утечки в ошибках ────────────────────────────────────────────────

async def test_validation_error_does_not_echo_password(client: AsyncClient):
    secret = "SuperSecret-Passw0rd!"
    resp = await client.post("/api/v1/users/", json={"email": "not-an-email", "username": "x", "password": secret})
    assert resp.status_code == 422
    assert secret not in resp.text


async def test_api_security_headers(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'none'" in resp.headers["content-security-policy"]
    assert "x-xss-protection" not in resp.headers


# ── Загрузки и экспорт ──────────────────────────────────────────────────────

def test_reencode_strips_exif_and_rejects_non_images():
    img = Image.new("RGB", (10, 10), "red")
    exif = Image.Exif()
    exif[0x8825] = {2: (55, 45, 0)}  # GPSInfo
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    data, ext = _reencode_image(buf.getvalue())
    assert ext == ".jpg"
    assert not Image.open(io.BytesIO(data)).getexif()

    with pytest.raises(ValueError):
        _reencode_image(b"<html><script>alert(1)</script></html>")


async def test_upload_image_rejects_html(client: AsyncClient, make_user):
    admin = await make_user(role=UserRole.ADMIN)
    files = {"file": ("evil.html", b"<script>alert(1)</script>", "text/html")}
    resp = await client.post("/api/v1/upload/image", files=files, headers=auth_headers(admin))
    assert resp.status_code == 400


def test_csv_formula_injection_is_neutralised():
    assert _cell("=HYPERLINK(\"http://evil\")").startswith("'")
    assert _cell("+1") == "'+1"
    assert _cell("normal") == "normal"
    assert _cell(42) == 42
