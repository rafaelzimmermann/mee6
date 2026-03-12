"""HTTP client stub for the school app."""

import httpx

from mee6.config import settings


async def fetch_school_content() -> str:
    """Login to the school app and return the calendar/news page content."""
    async with httpx.AsyncClient() as client:
        login_resp = await client.post(
            f"{settings.school_app_url}/login",
            data={
                "username": settings.school_app_username,
                "password": settings.school_app_password,
            },
            follow_redirects=True,
        )
        login_resp.raise_for_status()

        calendar_resp = await client.get(
            f"{settings.school_app_url}/calendar",
            follow_redirects=True,
        )
        calendar_resp.raise_for_status()
        return calendar_resp.text
