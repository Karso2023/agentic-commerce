from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SERPAPI_KEY: str = ""
    OPENAI_API_KEY: str = ""
    MOCK_MODE: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3001"]
    MAX_INPUT_LENGTH: int = 500
    RATE_LIMIT: str = "30/minute"


settings = Settings()
