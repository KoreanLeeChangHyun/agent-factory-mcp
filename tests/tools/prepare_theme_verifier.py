"""Grant an explicitly disposable test identity the application database privileges."""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main() -> None:
    admin_url = os.environ["AGENT_FACTORY_TEST_ADMIN_DATABASE_URL"]
    test_url = os.environ["AGENT_FACTORY_TEST_DATABASE_URL"]
    test_engine = create_async_engine(test_url)
    admin_engine = create_async_engine(admin_url)
    try:
        async with test_engine.connect() as connection:
            role = await connection.scalar(text("SELECT current_user"))
        if not isinstance(role, str) or not role:
            raise RuntimeError("could not resolve disposable verifier role")
        quoted_role = admin_engine.dialect.identifier_preparer.quote(role)
        async with admin_engine.begin() as connection:
            await connection.execute(text(f"GRANT USAGE ON SCHEMA public TO {quoted_role}"))
            await connection.execute(
                text(
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES "
                    f"IN SCHEMA public TO {quoted_role}"
                )
            )
            await connection.execute(
                text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {quoted_role}")
            )
    finally:
        await test_engine.dispose()
        await admin_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
