from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


    database_url: str = "sqlite:///./data/billiard.db"


    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480


    debug: bool = False
    environment: str = "production"


    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


    backup_dir: str = "./backups"


    business_name: str = "Pool Town"
    timezone: str = "Asia/Colombo"

    @property
    def sqlite_db_path(self) -> str:
        if self.database_url.startswith("sqlite:///"):
            return self.database_url.replace("sqlite:///", "")
        return "./data/billiard.db"


settings = Settings()
