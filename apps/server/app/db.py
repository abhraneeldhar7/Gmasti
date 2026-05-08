from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import settings


@contextmanager
def get_db():
    with psycopg.connect(
        settings.database_url,
        row_factory=dict_row,
        autocommit=False,
    ) as connection:
        yield connection

