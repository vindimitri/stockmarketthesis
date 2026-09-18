from collections.abc import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from fdax_api.config import settings

pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=5,
    kwargs={"row_factory": dict_row, "autocommit": True},
    open=False,
)


def open_pool() -> None:
    if pool.closed:
        pool.open()


def close_pool() -> None:
    if not pool.closed:
        pool.close()


def get_conn() -> Generator[psycopg.Connection, None, None]:
    with pool.connection() as conn:
        yield conn
