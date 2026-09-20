from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://fdax:fdax@localhost:5433/fdax"
    raw_dir: Path = Path("./data/raw")
    fdax_isin: str = "DE0009652388"
    mfs_base_url: str = "https://mfs.deutsche-boerse.com"
    source_prefix: str = "DEUR-posttrade"
    tz: str = "Europe/Berlin"
    user_agent: str = "fdax-ingest/0.1 (private research; delayed MiFID post-trade)"
    follow_poll_seconds: float = 20.0
    tape_delay_seconds: int = 900
