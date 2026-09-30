import httpx
import logging
import asyncio
from app.core.database import AsyncSessionLocal
from app.modules.system.models import SystemSettings
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def get_webhook_config():
    async with AsyncSessionLocal() as db:
        settings = await db.scalar(select(SystemSettings).limit(1))
        return settings

async def send_discord_webhook(url: str, message: str, title: str = "System Alert"):
    if not url:
        return
    
    payload = {
        "embeds": [{
            "title": title,
            "description": message,
            "color": 5814783  # Discord blurple
        }]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5.0)
    except Exception as e:
        logger.error(f"Failed to send Discord webhook: {e}")

async def send_telegram_message(token: str, chat_id: str, message: str):
    if not token or not chat_id:
        return
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5.0)
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")

async def dispatch_webhooks(title: str, message: str, is_html: bool = False):
    """
    Fire-and-forget utility to send notifications to configured platforms.
    """
    settings = await get_webhook_config()
    if not settings:
        return

    tasks = []
    
    if settings.discord_webhook_url:
        tasks.append(send_discord_webhook(settings.discord_webhook_url, message, title))
        
    if settings.telegram_bot_token and settings.telegram_chat_id:
        # If HTML is provided, we can use it for Telegram. Discord embeds use markdown.
        tg_message = f"<b>{title}</b>\n\n{message}"
        tasks.append(send_telegram_message(settings.telegram_bot_token, settings.telegram_chat_id, tg_message))
        
    if tasks:
        # Run in background without blocking
        asyncio.create_task(asyncio.gather(*tasks, return_exceptions=True))
