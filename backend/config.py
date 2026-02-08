from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SERPAPI_KEY: str = ""
    OPENAI_API_KEY: str = ""
    MOCK_MODE: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    MAX_INPUT_LENGTH: int = 500
    RATE_LIMIT: str = "30/minute"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str) and v.strip():
            return [o.strip() for o in v.split(",") if o.strip()]
        return ["http://localhost:3000", "http://localhost:3001"]


settings = Settings()
