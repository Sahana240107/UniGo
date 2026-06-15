"""
Alias module so imports like `from app.db.supabase_client import supabase`
work alongside the original supabase.py get_supabase() pattern.
"""
from app.db.supabase import get_supabase

supabase = get_supabase()