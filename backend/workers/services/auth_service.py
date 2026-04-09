import os
import gspread
from google.auth import default
from google.oauth2.service_account import Credentials

# Configuration
USER_SPREADSHEET_ID = "1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto"
USER_SHEET_NAME = "Data"
LEAD_SPREADSHEET_ID = "1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4"
LEAD_SHEET_NAME = "Data"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Global client
gc = None

def init_sheets_client():
    """Initialize the Google Sheets client using ADC or fallback credentials."""
    global gc
    try:
        # Try ADC (Cloud Run / GAE)
        creds, project = default(scopes=SCOPES)
        gc = gspread.authorize(creds)
        print("✅ Auth Service: Sheets client initialized with ADC")
    except Exception as adc_error:
        print(f"⚠️ Auth Service: ADC not available: {adc_error}")
        # Fallback: credentials.json
        try:
            creds_path = os.path.join(os.getcwd(), "credentials.json")
            if os.path.exists(creds_path):
                creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
                gc = gspread.authorize(creds)
                print("✅ Auth Service: Sheets client initialized with credentials.json")
            else:
                # Also try the gcp-service-account-key.json we used for secrets
                key_path = os.path.join(os.getcwd(), "gcp-service-account-key.json")
                if os.path.exists(key_path):
                    creds = Credentials.from_service_account_file(key_path, scopes=SCOPES)
                    gc = gspread.authorize(creds)
                    print("✅ Auth Service: Sheets client initialized with gcp-service-account-key.json")
                else:
                    print("❌ Auth Service: No credentials found for Google Sheets")
                    gc = None
        except Exception as e:
            print(f"❌ Auth Service: Failed fallback initialization: {e}")
            gc = None

# Initialize on import
init_sheets_client()

def connect_to_sheet():
    """Open the User worksheet."""
    if gc is None:
        return None
    try:
        sh = gc.open_by_key(USER_SPREADSHEET_ID)
        ws = sh.worksheet(USER_SHEET_NAME)
        return ws
    except Exception as e:
        print(f"❌ Auth Service: connect_to_sheet error: {e}")
        return None

def connect_to_lead_sheet():
    """Open the Lead worksheet."""
    if gc is None:
        return None
    try:
        sh = gc.open_by_key(LEAD_SPREADSHEET_ID)
        ws = sh.worksheet(LEAD_SHEET_NAME)
        return ws
    except Exception as e:
        print(f"❌ Auth Service: connect_to_lead_sheet error: {e}")
        return None
