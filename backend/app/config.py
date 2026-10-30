from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://promptmarket:promptmarket@localhost:5432/promptmarket"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    cookie_name: str = "access_token"
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:3000"
    seed_demo_data: bool = True
    default_commission_rate: float = 0.08  # used for admin-owned listings

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
