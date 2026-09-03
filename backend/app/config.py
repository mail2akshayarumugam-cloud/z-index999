from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:akshay2006@localhost:5432/scam_shield_db"
    database_url_sync: str = "postgresql://postgres:akshay2006@localhost:5432/scam_shield_db"

    hive_base_url: str = "http://localhost:8000"

    api_host: str = "0.0.0.0"
    api_port: int = 8001

    secret_key: str = "dev-secret-key-change-in-production"

    allowed_origins: str = "http://localhost:5174,http://localhost:3000"

    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
