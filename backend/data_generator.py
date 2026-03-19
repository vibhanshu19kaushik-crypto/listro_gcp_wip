import os
import time
import json
import logging
from typing import List, Dict
from dotenv import load_dotenv
import gspread
from google.oauth2.service_account import Credentials
import google.generativeai as genai
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# CONFIGURATION & SETUP
# ---------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Target Sheet Details
TARGET_SHEET_ID = "1K5FzXGI05hG4BMW7RjHB401U42LVRhtzWfGemK3rlqw" # Replace with your actual sheet ID
TARGET_TAB_NAME = "Grocery & Gourmet Foods"

# ---------------------------------------------------------------------------
# GEMINI AI SCHEMA DEFINITION (Forces Strict JSON Output)
# ---------------------------------------------------------------------------
class ProductContent(BaseModel):
    Quote: str = Field(description="A short, mouth-watering, premium tagline (Max 6 words).")
    Prompt_1: str = Field(description="Ultra-high resolution product hero background. Left-aligned staging, right-side negative space. 8k.")
    Use_Cases: str = Field(description="Strict format: Why You'll Love It: [Benefit 1]. [Benefit 2]. [Benefit 3]. [Benefit 4].")
    Prompt_2: str = Field(description="Lifestyle setting where product is used. Left-aligned action, right-side negative space. 8k.")
    Tasting_Notes: str = Field(description="Strict format: Flavor Profile: [Note 1]. [Note 2]. [Note 3]. [Note 4].")
    Prompt_3: str = Field(description="Extreme close-up macro photography of texture/ingredients. Left focus, right-side negative space. 8k.")

# ---------------------------------------------------------------------------
# THE MASTER PROMPT
# ---------------------------------------------------------------------------
MASTER_PROMPT_TEMPLATE = """
You are a Master Food Art Director and Expert Copywriter working for a premium brand. 
Generate highly specific, structured visual prompts and marketing copy for a product in the {category} category, specifically within the {department} department and {subcategory} subcategory.

### THE VISUAL RULES (PROMPTS 1, 2, & 3)
1. The main subject/product MUST always be described as positioned on the LEFT or CENTER-LEFT of the frame.
2. The RIGHT side of the image MUST be described as "ample negative space," "soft-focus bokeh," or "clean background" for text overlay. 
3. Adapt the aesthetic to the food item (e.g., rustic wood for bakery, bright marble for fresh produce, moody slate for wines).
4. End all prompts with "8k resolution, photorealistic."

### THE COPY RULES (USE CASES & TASTING NOTES)
Our backend Python script parses this text strictly. You MUST follow this exact format:
- You must provide EXACTLY 4 phrases, separated by periods. 
- DO NOT use bullet points, asterisks, or newlines.
- Use Cases format: `Why You'll Love It: [Benefit 1]. [Benefit 2]. [Benefit 3]. [Benefit 4].`
- Tasting Notes format: `Flavor Profile: [Sensory 1]. [Sensory 2]. [Texture 3]. [Finish 4].`
"""

# ---------------------------------------------------------------------------
# INITIALIZATION FUNCTIONS
# ---------------------------------------------------------------------------
def get_gspread_client():
    """Initializes Google Sheets client."""
    creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")
    if os.path.exists(creds_path):
        creds = Credentials.from_service_account_file(
            creds_path,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        return gspread.authorize(creds)
    else:
        raise FileNotFoundError("credentials.json not found. Please add it to the root directory.")

def get_gemini_client():
    """Initializes Gemini client with API key or Secret Manager fallback."""
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        logger.info("✅ Gemini configured with API key from .env")
        return genai.GenerativeModel("gemini-2.5-flash")
    else:
        # Fallback to Secret Manager (project-wide standard)
        try:
            from secret_manager import configure_gemini_with_service_account
            _, text_model, _ = configure_gemini_with_service_account()
            logger.info("✅ Gemini configured via Secret Manager")
            return text_model
        except Exception as sm_error:
            logger.error(f"❌ Failed to configure Gemini via Secret Manager: {sm_error}")
            raise ValueError(
                "GEMINI_API_KEY not found in .env and Secret Manager configuration failed. "
                "Please check your permissions or .env file."
            )

# ---------------------------------------------------------------------------
# HELPER: DYNAMIC COLUMN LOOKUP
# ---------------------------------------------------------------------------
def get_column_map(headers: List[str]) -> Dict[str, int]:
    """Returns a map of required headers to their 0-indexed column positions."""
    mapping = {}
    required = {
        "Category": "category",
        "Department": "department",
        "Subcategory": "subcategory",
        "Quote": "quote",
        "Prompt 1 (Quote background)": "prompt1",
        "Use Cases": "use_cases",
        "Prompt 2 (Use Case Background)": "prompt2",
        "Tasting Notes": "tasting_notes",
        "Prompt 3 (Texture Background)": "prompt3"
    }

    for header_name, key in required.items():
        try:
            mapping[key] = headers.index(header_name)
        except ValueError:
            logger.warning(f"⚠️ Column '{header_name}' NOT found in sheet headers.")
            mapping[key] = -1
    
    return mapping

def col_to_letter(col_index: int) -> str:
    """Converts 0-indexed column integer to Excel-style letter (A, B, C...)."""
    letter = ""
    col_index += 1  # 1-indexed for logic
    while col_index > 0:
        col_index, remainder = divmod(col_index - 1, 26)
        letter = chr(65 + remainder) + letter
    return letter

# ---------------------------------------------------------------------------
# MAIN EXECUTION LOOP
# ---------------------------------------------------------------------------
def main():
    gc = get_gspread_client()
    model = get_gemini_client()
    
    logger.info("Connecting to Google Sheet...")
    sheet = gc.open_by_key(TARGET_SHEET_ID).worksheet(TARGET_TAB_NAME)
    
    # Fetch all data to find empty rows
    data = sheet.get_all_values()
    if not data:
        return
    
    headers = data[0]
    col_map = get_column_map(headers)
    
    # Check if necessary input columns are present
    if any(col_map[k] == -1 for k in ["category", "department", "subcategory", "quote"]):
        logger.error("❌ Required columns (Category, Department, Subcategory, Quote) missing from headers.")
        return

    logger.info(f"Found {len(data)-1} total rows. Scanning for missing data...")

    # Iterate through rows (skipping header)
    for index, row in enumerate(data[1:], start=2): # start=2 because Sheets are 1-indexed and row 1 is headers
        
        # Pull data based on dynamic indices
        category = row[col_map["category"]].strip() if len(row) > col_map["category"] else ""
        department = row[col_map["department"]].strip() if len(row) > col_map["department"] else ""
        subcategory = row[col_map["subcategory"]].strip() if len(row) > col_map["subcategory"] else ""
        quote = row[col_map["quote"]].strip() if len(row) > col_map["quote"] else ""

        # SKIP LOGIC: If Quote exists or Category is empty, skip.
        if quote or not category:
            continue
            
        logger.info(f"Row {index}: Generating data for {department} -> {subcategory}...")

        # Format the prompt with current row's variables
        prompt_text = MASTER_PROMPT_TEMPLATE.format(
            category=category,
            department=department,
            subcategory=subcategory
        )

        try:
            # Call Gemini with strict JSON schema
            response = model.generate_content(
                prompt_text,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=ProductContent,
                    temperature=0.7,
                ),
            )
            
            # Parse the response dictionary
            result = json.loads(response.text)
            
            # 🚀 DYNAMIC WRITING LOGIC
            # We build a list of updates for this specific row
            update_cells = [
                (col_map["quote"], result["Quote"]),
                (col_map["prompt1"], result["Prompt_1"]),
                (col_map["use_cases"], result["Use_Cases"]),
                (col_map["prompt2"], result["Prompt_2"]),
                (col_map["tasting_notes"], result["Tasting_Notes"]),
                (col_map["prompt3"], result["Prompt_3"])
            ]

            # Filter out columns that don't exist in the sheet
            valid_updates = [(col_idx, val) for col_idx, val in update_cells if col_idx != -1]
            
            if not valid_updates:
                continue

            # Sort by column index to potentially find ranges
            valid_updates.sort()

            # Batch the logic: If all columns are sequential, update as a range
            # Otherwise, update cell by cell (for safety and flexibility)
            for col_idx, val in valid_updates:
                col_letter = col_to_letter(col_idx)
                cell_address = f"{col_letter}{index}"
                sheet.update_acell(cell_address, val)
            
            logger.info(f"Row {index}: Success! Updated all available columns.")
            
            # Rate Limiting: Pause for 3 seconds to respect Gemini and GSheets API limits
            time.sleep(3)
            
        except Exception as e:
            logger.error(f"Row {index}: Failed to generate or update. Error: {e}")
            logger.info("Pausing for 10 seconds before continuing due to error...")
            time.sleep(10)
            continue

    logger.info("Data generation complete!")

if __name__ == "__main__":
    main()