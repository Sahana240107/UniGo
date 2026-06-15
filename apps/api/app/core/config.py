from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "local"
    frontend_origin: str = "http://localhost:3000"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_db_url: str = ""
    ors_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

