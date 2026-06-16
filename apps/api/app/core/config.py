from pydantic_settings import BaseSettings, SettingsConfigDict
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

FIREBASE_CREDENTIALS_JSON = os.environ.get("FIREBASE_CREDENTIALS_JSON")


class Settings(BaseSettings):
    app_env: str = "local"
    frontend_origin: str = "https://uni-go-web.vercel.app"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_db_url: str = ""
    ors_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

