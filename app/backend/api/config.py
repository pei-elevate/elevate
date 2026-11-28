from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str
    postgres_password: str
    postgres_db: str

    # MyDoc (api/mydoc). Without a URL, Elevate does not fetch inspection requests.
    mydoc_url: str | None = None
    mydoc_poll_seconds: float = 30
    mydoc_timeout_seconds: float = 10

    # Inspection reports (PDF). A Docker volume in compose.yml, so they survive restarts.
    reports_dir: Path = Path("/data/reports")

    @property
    def database_url(self) -> URL:
        # URL.create encodes the password, so any character is allowed.
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


settings = Settings()
