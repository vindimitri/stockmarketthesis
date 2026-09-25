from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://fdax:fdax@localhost:5433/fdax"
    tz: str = "Europe/Berlin"
    default_from: str = "08:00"
    default_to: str = "22:00"
    tape_delay_seconds: int = 900
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080"
    api_port: int = 8001


settings = Settings()
