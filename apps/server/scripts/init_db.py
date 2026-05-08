from pathlib import Path
import os

from dotenv import load_dotenv
from psycopg import connect


def main() -> None:
    server_dir = Path(__file__).resolve().parents[1]
    load_dotenv(server_dir / ".env")
    schema_path = server_dir / "app" / "sql" / "schema.sql"

    database_url = os.getenv("DATABASE_URL")

    if not database_url or "YOUR_PASSWORD" in database_url:
        raise RuntimeError("Fill DATABASE_URL in apps/server/.env before running init_db.py.")

    with connect(database_url, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(schema_path.read_text(encoding="utf-8"))

    print("Database schema initialized.")


if __name__ == "__main__":
    main()
