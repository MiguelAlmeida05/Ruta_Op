import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

# Check if credentials exist to avoid crashing on import if env not set
if not url or not key:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not set.")
    supabase = None
else:
    supabase: Client = create_client(url, key)

def get_supabase():
    return supabase
