"""
Application configuration using Pydantic Settings.
Reads from environment variables or .env file.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "sqlite:///./data/billiard.db"

    # Security
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours

    # Application
    debug: bool = False
    environment: str = "production"

    # CORS
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Backup
    backup_dir: str = "./backups"

    # Business settings (configurable but with safe defaults)
    business_name: str = "Billiard Hall"
    timezone: str = "Asia/Colombo"

    @property
    def sqlite_db_path(self) -> str:
        if self.database_url.startswith("sqlite:///"):
            return self.database_url.replace("sqlite:///", "")
        return "./data/billiard.db"


settings = Settings()

