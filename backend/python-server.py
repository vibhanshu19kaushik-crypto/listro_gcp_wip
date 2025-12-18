import os
from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv

# Only load .env in non-production environments
if os.getenv("ENV", "local") != "production":
    load_dotenv()

import io
import uuid
from datetime import datetime
import json
import re
import subprocess
import sys
import requests
from flask_cors import CORS
from PIL import Image
import google.generativeai as genai
from google.cloud import storage
from google.generativeai import types
from google.cloud.exceptions import Forbidden

# --- Google Sheets client for Lead login ---
import gspread
from google.oauth2.service_account import Credentials

_LEAD_SPREADSHEET_ID = "1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4"
_LEAD_SHEET_NAME = "Data"            # Lead spreadsheet tab is "Data"
_USER_SPREADSHEET_ID = "1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto"
_USER_SHEET_NAME = "Data"            # KAM/User spreadsheet tab is "Data"
_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# credentials.json must be placed in backend/ and the service account must have access to the sheet
_gc = None
try:
    creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")
    _creds = Credentials.from_service_account_file(creds_path, scopes=_SCOPES)
    _gc = gspread.authorize(_creds)
    print("Google Sheets client initialized for lead-login.")
except Exception as e:
    print("Warning: could not initialize Google Sheets client for lead login:", str(e))
    _gc = None

def connect_to_sheet():
    """
    Open the main User (KAM) worksheet and return the worksheet object.
    Returns None if sheets access is not configured or on error.
    """
    if _gc is None:
        return None
    try:
        sh = _gc.open_by_key(_USER_SPREADSHEET_ID)
        ws = sh.worksheet(_USER_SHEET_NAME)
        return ws
    except Exception as e:
        print("connect_to_sheet error:", e)
        return None

app = Flask(__name__)

# Get config from environment (works for local + Cloud Run)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
PORT = int(os.getenv("PORT", "5000"))
DEBUG_MODE = os.getenv("FLASK_DEBUG", "true").lower() == "true"

# ✅ CORS origin configurable via env
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(app, resources={r"/*": {"origins": FRONTEND_ORIGIN}}, supports_credentials=True)

# --- CONFIGURATION ---

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("Gemini API Key (GOOGLE_API_KEY) missing in .env file")

genai.configure(api_key=GOOGLE_API_KEY)

# Separate models for text and image generation
TEXT_MODEL_ID = "gemini-2.5-flash"
IMAGE_MODEL_ID = "gemini-2.5-flash-image-preview"

try:
    # Text model for text generation
    text_model = genai.GenerativeModel(TEXT_MODEL_ID)
    print(f"✅ Gemini Text model initialized: {TEXT_MODEL_ID}")
except Exception as e:
    print(f"❌ Text model initialization error: {e}")
    raise

try:
    # Image model for image generation
    image_model = genai.GenerativeModel(IMAGE_MODEL_ID)
    print(f"✅ Gemini Image model initialized: {IMAGE_MODEL_ID}")
except Exception as e:
    print(f"❌ Image model initialization error: {e}")
    raise

OUTPUT_DIR = "generated_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- GOOGLE CLOUD STORAGE CONFIG ---

GCS_BUCKET_NAME = "listro-image-store"

try:
    # ✅ Uses ADC (local: GOOGLE_APPLICATION_CREDENTIALS; Cloud Run: SA identity)
    storage_client = storage.Client()
    print("✅ Google Cloud Storage client initialized (ADC).")
except Exception as e:
    print(f"❌ GCS client initialization error: {e}")
    storage_client = None  # Fail gracefully

def upload_to_gcs(local_file_path, destination_blob_name):
    """
    Uploads a file to GCS, makes it public, and returns the public URL.
    """
    if not storage_client:
        raise Exception("GCS client not available")

    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)
    try:
        print(f"DEBUG: Uploading {local_file_path} to gs://{GCS_BUCKET_NAME}/{destination_blob_name}")
        blob.upload_from_filename(local_file_path)
        gcs_public_url = blob.public_url
        print(f"✅ Uploaded to GCS. Public URL: {gcs_public_url}")
        return gcs_public_url
    except Forbidden:
        error_message = (
            f"GCS Permission Denied (403): "
            f"Ensure service account has 'Storage Object Creator' or "
            f"'Storage Object Admin' for bucket '{GCS_BUCKET_NAME}'."
        )
        print(f"❌ GCS upload failed: {error_message}")
        raise Exception(error_message)
    except Exception as e:
        error_message = f"GCS Upload Failed: {type(e).__name__} - {str(e)}"
        print(f"❌ GCS upload failed: {error_message}")
        raise Exception(error_message)

# ===============================================================
# NANO BAANA - PROMPT FUNCTIONS FOR IMAGE GENERATION
# ===============================================================

def get_prompt_amazon_main_image():
    return (
        "ROLE: Professional Amazon product photographer for apparel.\n\n"
        "OBJECTIVE: Full-body photo of model wearing garment on PURE WHITE BACKGROUND ONLY.\n\n"
        "CRITICAL - WHITE BACKGROUND: Background MUST be pure white RGB(255,255,255) and #FFFFFF. NO shadows, NO grey, NO cream, NO gradients. Only clinical pure white.\n\n"
        "REFERENCE IMAGE USAGE:\n"
        "- If dress only: Place on new model\n"
        "- If dress on model: Extract dress design, create NEW different model\n"
        "Copy exact: colors, patterns, textures, design details. Never modify garment.\n\n"
        "REQUIREMENTS:\n"
        "- Show complete body head-to-toe with feet visible\n"
        "- Pure white background RGB(255,255,255) - ZERO shadows anywhere\n"
        "- Model fills 85%+ of frame, centered, natural standing pose\n"
        "- Garment exactly matches reference - same colors, patterns, details\n"
        "- Even lighting, no background shadows, sharp focus\n"
        "- Minimum 1000px (recommend 2000x2500px)\n"
        "- Prohibited: Text, logos, watermarks, props, shadows, grey backgrounds\n\n"
        "VALIDATION: Pure white RGB(255,255,255), zero shadows, full body visible, garment matches reference exactly.\n\n"
        "Product: [Category], [Gender], [AgeGroup], [Style], [SubCategory]"
    )

def get_prompt_amazon_product_only_image():
    return (
        "ROLE: Expert Amazon product photographer specializing in ghost mannequin technique for e-commerce listings.\n\n"
        "CRITICAL REQUIREMENTS - MUST FOLLOW:\n"
        "1. BACKGROUND: Absolute pure white #FFFFFF RGB(255,255,255) - NOT off-white, NOT cream, NOT gray\n"
        "2. NO HUMANS: Zero body parts visible - no hands, arms, legs, feet, neck, or any human skin/form\n"
        "3. NO SHADOWS: Completely shadowless - no drop shadows, edge shadows, or gradient effects\n\n"
        "TECHNICAL SPECIFICATIONS:\n"
        "- Image dimensions: Minimum 1600x1600px, square aspect ratio preferred\n"
        "- Background: Pure white with NO gradients, NO subtle tones, NO variations\n"
        "- Lighting: Bright, flat, even lighting that eliminates ALL shadows completely\n"
        "- Product fill: Garment occupies 80-90% of frame, perfectly centered\n"
        "- Focus: Crystal sharp on fabric texture and details\n\n"
        "GHOST MANNEQUIN TECHNIQUE:\n"
        "- Garment appears to float in 3D space with natural draping\n"
        "- Show dimensional form as if worn by INVISIBLE mannequin (not human)\n"
        "- Internal structure visible (collar, sleeves shaped naturally)\n"
        "- NO hint of human form - use hollow mannequin concept\n"
        "- Structured garments: maintain shape without visible support\n"
        "- Flowing garments: elegant draping as if on invisible dress form\n\n"
        "AMAZON COMPLIANCE:\n"
        "- Zero watermarks, logos, text overlays, or graphics\n"
        "- Zero props (hangers, clips, pins, mannequin parts)\n"
        "- Zero reflections or environmental elements\n"
        "- Product edges must be clean and well-defined against white\n"
        "- Colors must match reference image exactly\n\n"
        "EXECUTION INSTRUCTIONS:\n"
        "Study the reference image to capture: fabric texture, color accuracy, pattern details, cut and style.\n"
        "Generate the garment ONLY - extracted and isolated on pure bright white.\n"
        "Ensure maximum contrast between product and background for clean selection.\n"
        "Verify final image passes Amazon's automated background check (must read as pure white).\n\n"
        "FINAL CHECKLIST:\n"
        "✓ Background is absolute white #FFFFFF (not off-white or cream)\n"
        "✓ Zero human body parts anywhere in image\n"
        "✓ Zero shadows or dark areas on background\n"
        "✓ Product perfectly centered and fills 80-90% of frame\n"
        "✓ No text, watermarks, or props visible\n"
        "✓ Sharp focus with accurate colors matching reference\n\n"
        "Product Context: [Category], [Gender], [AgeGroup], [SubCategory]"
    )

def get_prompt_amazon_lifestyle_image():
    return (
        "ROLE: You are a professional lifestyle fashion photographer creating Amazon secondary product images.\n\n"
        "OBJECTIVE: Create a full-body lifestyle photo showing a model wearing the exact garment in a real-world setting.\n\n"
        "CONTEXT: Use the reference image to copy the garment's exact colors, patterns, and design. Create a NEW lifestyle photo with the same garment on a model in an appropriate background environment.\n\n"
        "BACKGROUND SELECTION (choose based on garment):\n"
        "- Traditional/Ethnic → Wedding venue, festival, cultural event\n"
        "- Formal Wear → Hotel lobby, office, restaurant\n"
        "- Casual Wear → Coffee shop, park, street, home\n"
        "- Activewear → Gym, yoga studio, outdoor fitness area\n"
        "- Party/Evening → Lounge, rooftop, nightlife venue\n"
        "- Loungewear → Bedroom, living room, cozy indoor space\n"
        "- Business Casual → Cafe, co-working space, modern office\n\n"
        "KEY REQUIREMENTS:\n"
        "- Show full body from head to toe with feet visible\n"
        "- Background must be realistic lifestyle setting (not plain white)\n"
        "- Model naturally posed in the environment (sitting, standing, walking)\n"
        "- Garment stays exactly the same as reference - same colors, patterns, design\n"
        "- Product clearly visible and main focus\n"
        "- Natural lighting, authentic scene\n"
        "- No text, logos, watermarks, or distracting elements\n"
        "- Minimum 1600x1600px resolution\n\n"
        "CRITICAL: The background MUST be a lifestyle environment, NOT a plain background. The model should look natural in the setting while the garment remains the primary focus.\n\n"
        "Product Context: [Category], [Gender], [AgeGroup], [SubCategory]"
    )

def get_prompt_amazon_angle_image():
    return (
        "ROLE: You are a professional product photographer. Analyze the reference image and recreate it on a model in a lifestyle setting.\n\n"
        "KEEP GARMENT IDENTICAL: Same colors, patterns, fabric, design details. DO NOT alter the garment.\n\n"
        "CATEGORY: [Traditional/Ethnic | Formal | Casual | Activewear | Party/Evening | Loungewear | Business Casual]\n\n"
        "BACKGROUNDS:\n"
        "Traditional/Ethnic: Wedding venue, festival with decorations\n"
        "Formal: Hotel lobby, corporate office, upscale restaurant\n"
        "Casual: Coffee shop, park, city street, living room\n"
        "Activewear: Gym with equipment, yoga studio, running track\n"
        "Party/Evening: Cocktail lounge, rooftop terrace at night\n"
        "Loungewear: Bedroom with bed, living room with sofa\n"
        "Business Casual: Modern cafe, co-working space, office\n\n"
        "OUTPUT SPECS:\n"
        "Full body head-to-toe with feet visible\n"
        "Model centered, garment fills 70-80% of frame\n"
        "Sharp, detailed background with visible furniture/decor\n"
        "Natural pose interacting with environment\n"
        "Natural lighting, 1600x1600px minimum\n"
        "No text, logos, watermarks, or plain backgrounds\n\n"
        "CRITICAL: Change only background and pose. The garment stays exactly the same.\n\n"
        "Product Context: [Category], [Gender], [AgeGroup], [SubCategory]"
    )

def get_prompt_amazon_infographic():
    return (
        "You are a professional Amazon product infographic designer. Analyze the reference image and create a clean infographic layout.\n\n"
        "KEEP GARMENT IDENTICAL: Same colors, patterns, fabric, design details. DO NOT alter the garment design.\n\n"
        "INFOGRAPHIC REQUIREMENTS:\n"
        "Clean white or light background\n"
        "Product centered and clearly visible\n"
        "3-5 key feature callouts with simple icons\n"
        "Short descriptive text for each feature\n"
        "Minimal, professional Amazon-compliant design\n"
        "No models, no lifestyle backgrounds\n"
        "No crowded text or excessive graphics\n\n"
        "LAYOUT STYLE:\n"
        "Modern and clean visual hierarchy\n"
        "Feature callouts positioned around product\n"
        "Simple line icons or minimal graphics\n"
        "Easy-to-read fonts\n"
        "Balanced composition\n\n"
        "OUTPUT SPECS:\n"
        "High-resolution square format (minimum 1600x1600px)\n"
        "Professional e-commerce quality\n"
        "No watermarks, logos, or distracting elements\n\n"
        "CRITICAL: Use reference image only for garment color and texture. Create clean infographic layout with feature highlights."
    )

PROMPT_FUNCTIONS = [
    get_prompt_amazon_main_image,         # ✅ Full human model, head-to-toe
    get_prompt_amazon_product_only_image, # 🚫 No model
    get_prompt_amazon_lifestyle_image,    # ✅ Full human model
    get_prompt_amazon_angle_image,        # ✅ Full human model
    get_prompt_amazon_infographic         # 🚫 No model
]

def replace_placeholders(prompt: str, attributes: dict) -> str:
    pattern = r"\[(\w+)\]"

    def replacer(match):
        key = match.group(1)
        return attributes.get(key, f"[{key}]")

    return re.sub(pattern, replacer, prompt)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        resp = app.make_default_options_response()
        headers = resp.headers
        # ✅ use env-based origin instead of hardcoded localhost
        headers["Access-Control-Allow-Origin"] = FRONTEND_ORIGIN
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        headers["Access-Control-Allow-Credentials"] = "true"
        return resp

# NOTE: Removed hardcoded fallback users. Authentication now requires Google Sheets access.
# Place service account credentials.json in backend/ and share both sheets with that service account.

# --- AUTHENTICATION ENDPOINTS ---

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        # Require Google Sheets for authentication
        sheet = connect_to_sheet()
        if sheet is None:
            return jsonify({"success": False, "error": "User authentication not configured (missing Google Sheets access)"}), 500

        # Google Sheets is available - use it
        try:
            records = sheet.get_all_records()
            # Find user by email (case-insensitive column names)
            user_record = None
            for record in records:
                record_email = (record.get("email") or record.get("Email") or "").strip().lower()
                if record_email == email:
                    user_record = record
                    break

            if not user_record:
                return jsonify({"success": False, "error": "Invalid email or password"}), 401

            stored_password = str(user_record.get("password") or user_record.get("Password") or "").strip()
            if password != stored_password:
                return jsonify({"success": False, "error": "Invalid email or password"}), 401

            # first_time detection (if a FirstLogin column exists or password equals email)
            first_login_flag = (user_record.get("FirstLogin") or user_record.get("firstLogin") or "").strip().lower()
            first_time = first_login_flag == "yes" or stored_password == email

            return jsonify({
                "success": True,
                "message": "Login successful",
                "first_time": first_time,
                "email": email
            })
        except Exception as sheets_error:
            print(f"❌ Google Sheets error during /login: {sheets_error}")
            return jsonify({"success": False, "error": "Failed to read user credentials sheet"}), 500

    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"success": False, "error": "Server error during login"}), 500

@app.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()

        if not email:
            return jsonify({"success": False, "error": "Email is required"}), 400

        # Try to connect to Google Sheets first
        sheet = connect_to_sheet()

        if sheet is not None:
            # Google Sheets is available
            try:
                records = sheet.get_all_records()
                # Check both lowercase and capitalized column names
                user_exists = any(
                    record.get("email", record.get("Email", "")).strip().lower() == email
                    for record in records
                )

                if not user_exists:
                    return jsonify({"success": False, "error": "Email not found"}), 404

                # Generate reset token and send email
                reset_token = str(uuid.uuid4())
                send_reset_email(email, reset_token)

                return jsonify({
                    "success": True,
                    "message": "Reset link sent to your email",
                    "pending_approval": False
                })
            except Exception as sheets_error:
                print(f"❌ Google Sheets error, using fallback: {sheets_error}")

        # Fallback mode
        print("🔄 Using fallback password reset")

        if email not in FALLBACK_USERS:
            return jsonify({"success": False, "error": "Email not found"}), 404

        # In fallback mode, just return success without actually sending email
        return jsonify({
            "success": True,
            "message": "Password reset simulated (fallback mode). Use demo credentials.",
            "pending_approval": False
        })
    except Exception as e:
        print(f"❌ Reset password error: {e}")
        return jsonify({"success": False, "error": "Server error during password reset"}), 500

@app.route("/update-password", methods=["POST"])
def update_password():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        new_password = data.get("password", "").strip()
        token = data.get("token", "")  # Reset token (not implemented in this basic version)

        if not email or not new_password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        # Try to connect to Google Sheets first
        sheet = connect_to_sheet()

        if sheet is not None:
            # Google Sheets is available
            try:
                records = sheet.get_all_records()

                # Find user by email (handle both lowercase and capitalized column names)
                user_record = None
                row_index = None
                for i, record in enumerate(records):
                    record_email = record.get("email", record.get("Email", "")).strip().lower()
                    if record_email == email:
                        user_record = record
                        row_index = i + 2  # +2 because enumerate starts at 0 and sheet rows start at 1, plus header
                        break

                if not user_record:
                    return jsonify({"success": False, "error": "User not found"}), 404

                # Update password in Google Sheets - find the Password column
                # First, get the header row to find the correct column index
                header_row = sheet.row_values(1)
                password_col = None
                for col_idx, header in enumerate(header_row):
                    if header.lower() == 'password':
                        password_col = col_idx + 1  # gspread uses 1-based indexing
                        break

                if password_col:
                    sheet.update_cell(row_index, password_col, new_password)
                    # Also update FirstLogin to 'No' if it exists
                    for col_idx, header in enumerate(header_row):
                        if header.lower() == 'firstlogin':
                            sheet.update_cell(row_index, col_idx + 1, 'No')
                            break

                return jsonify({
                    "success": True,
                    "message": "Password updated successfully"
                })
            except Exception as sheets_error:
                print(f"❌ Google Sheets error, using fallback: {sheets_error}")

        # Fallback mode
        print("🔄 Using fallback password update")

        if email not in FALLBACK_USERS:
            return jsonify({"success": False, "error": "User not found"}), 404

        # In fallback mode, update the in-memory user data
        FALLBACK_USERS[email]["password"] = new_password
        FALLBACK_USERS[email]["first_time"] = False

        return jsonify({
            "success": True,
            "message": "Password updated successfully (fallback mode)"
        })
    except Exception as e:
        print(f"❌ Update password error: {e}")
        return jsonify({"success": False, "error": "Server error during password update"}), 500

# --- IMAGE GENERATION ENDPOINT ---

@app.route("/generate-image", methods=["POST"])
def generate_image_api():
    try:
        if "image" not in request.files:
            return jsonify({"success": False, "error": "No image uploaded"}), 400

        file = request.files["image"]
        img_stream = io.BytesIO(file.read())
        img_stream.seek(0)

        try:
            uploaded_image = Image.open(img_stream).convert("RGB")
        except Exception as e:
            return jsonify({"success": False, "error": f"Invalid image file: {str(e)}"}), 400

        # ✅ HARD LIMIT: shrink very large images to keep memory + API happy
        try:
            max_size = (1536, 1536)  # good balance between quality + size
            uploaded_image.thumbnail(max_size, Image.LANCZOS)
        except Exception as e:
            print(f"⚠️ Failed to resize image: {e}")

        # --- parse inputs ---
        try:
            style_index = int(request.form.get("style_index", -1))
        except ValueError:
            return jsonify({"success": False, "error": "Invalid style_index"}), 400

        if not (0 <= style_index < len(PROMPT_FUNCTIONS)):
            return jsonify({"success": False, "error": "style_index out of range"}), 400

        attributes_str = request.form.get("attributes", "{}")
        try:
            attributes = json.loads(attributes_str)
        except json.JSONDecodeError:
            return jsonify({"success": False, "error": "Invalid attributes JSON"}), 400

        prompt_template = PROMPT_FUNCTIONS[style_index]()
        final_prompt = replace_placeholders(prompt_template, attributes)

        full_prompt = (
            "Transform this photo photorealistically for premium e-commerce quality. "
            "Avoid distortion, blur, watermarks, or cropping. "
            f"Instructions: {final_prompt}"
        )

        # ✅ add retries for transient INTERNAL errors
        last_error = None
        response = None
        for attempt in range(2):
            try:
                print(f"🧠 Gemini image generation attempt {attempt + 1}")
                response = image_model.generate_content(
                    [uploaded_image, full_prompt],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.6,
                        top_p=0.9,
                        top_k=40,
                    ),
                )
                break
            except Exception as e:
                last_error = e
                import traceback
                print("❌ Gemini image generation failed")
                print(traceback.format_exc())
        
        if response is None:
            # give a clean error back to frontend
            msg = f"Image generation failed on server: {type(last_error).__name__} - {last_error}"
            return jsonify({"success": False, "error": msg}), 502

        # --- extract image from Gemini response (ROBUST) ---
        image_bytes = None

        candidate = response.candidates[0]
        content = candidate.content

        for part in getattr(content, "parts", []):
            if hasattr(part, "inline_data") and part.inline_data:
                if part.inline_data.mime_type.startswith("image/"):
                    image_bytes = part.inline_data.data
                    break

        if not image_bytes:
            raise Exception("Gemini did not return image data")

        # --- save locally ---
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        unique_filename = f"generated_{uuid.uuid4().hex}.jpg"
        local_path = os.path.join(OUTPUT_DIR, unique_filename)

        img.save(local_path, format="JPEG", quality=95, optimize=True)

        if not os.path.exists(local_path):
            raise Exception("Local image save failed")

        print(f"✅ Image saved locally: {local_path}")

        # --- upload to GCS ---
        gcs_url = None
        try:
            gcs_blob_name = f"generated/{unique_filename}"
            gcs_url = upload_to_gcs(local_path, gcs_blob_name)
        except Exception as gcs_error:
            print(f"⚠️ GCS upload failed: {gcs_error}")

        preview_url = request.host_url.rstrip("/") + "/generated_images/" + unique_filename

        return jsonify({
            "success": True,
            "filename": unique_filename,
            "gcs_url": gcs_url,
            "preview_url": preview_url,
            "file_size": os.path.getsize(local_path),
            "image_size": f"{img.width}x{img.height}",
            "style_index": style_index,
        }), 200

    except Exception as e:
        import traceback
        print(f"❌ Error in generate_image_api: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route("/generated_images/<filename>")
def serve_generated_image(filename):
    """Serve generated images securely"""
    try:
        file_path = os.path.join(OUTPUT_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "Image file not found"}), 404
        return send_file(file_path, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({"error": f"Error serving image: {str(e)}"}), 500

@app.route("/api/debug-images")
def debug_images():
    """Debug endpoint to list generated images info"""
    try:
        files = os.listdir(OUTPUT_DIR)
        file_info = []
        for file in files:
            file_path = os.path.join(OUTPUT_DIR, file)
            file_info.append({
                'name': file,
                'size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'exists': os.path.exists(file_path)
            })
        return jsonify({
            "output_dir": OUTPUT_DIR,
            "absolute_path": os.path.abspath(OUTPUT_DIR),
            "files": file_info
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- TEXT GENERATION HELPERS ---

def create_base_prompt(subcategory, product_details, task_type):
    # Separate instructions for title vs description
    title_char_warning = """
IMPORTANT CHARACTER RESTRICTIONS FOR TITLES:
- USE pipe operators (|) as separators between key features - this is GOOD for Amazon
- ALLOW basic punctuation: periods (.), commas (,), apostrophes (')
- NO other special characters or symbols: &, ~, !, @, #, $, %, ^, *, (, ), _, +, =, {, }, [, ], \\, :, ;, ", <, >, ?, /, `, °, •, ·, ®, ©, ™
- NO emojis, arrows (→, ←, ↑, ↓), stars (★, ☆), checkmarks (✓, ✔), hearts (❤, ♥), or other Unicode symbols
- Use only: Letters (A-Z, a-z), numbers (0-9), commas (,), periods (.), apostrophes ('), hyphens (-), pipes (|), spaces, and parentheses for sizing (e.g., S, M, L)
"""
    
    description_char_warning = """
IMPORTANT CHARACTER RESTRICTIONS FOR DESCRIPTIONS:
- ALLOW basic punctuation: periods (.), commas (,), apostrophes ('), colons (:), semicolons (;), parentheses ()
- NO special characters or symbols: &, |, ~, !, @, #, $, %, ^, *, _, +, =, {, }, [, ], \\, ", <, >, ?, /, `, °, •, ·, ®, ©, ™
- NO emojis, arrows (→, ←, ↑, ↓), stars (★, ☆), checkmarks (✓, ✔), hearts (❤, ♥), or other Unicode symbols
- Use only: Letters (A-Z, a-z), numbers (0-9), basic punctuation, hyphens (-), spaces
- For bullet points, use plain text: "Features:" or "Benefits:" instead of symbols
"""
    
    if task_type == 'name':
        instruction = "TASK: Write exactly one labeled line: Product Name: [title here]"
        char_warning = title_char_warning
    else:
        instruction = "TASK: Write exactly one labeled line: Product Description: [description here]"
        char_warning = description_char_warning
    
    return f"""
You are an expert Amazon e-commerce copywriter specializing in Clothing.
Generate a {'product title' if task_type == 'name' else 'product description'} based on the provided details.
{instruction}

{char_warning}

Available Product Information:
Subcategory: {subcategory}
{product_details if product_details else 'No additional details provided'}

IMPORTANT:
- For title: Generate around 150 characters (Max 190 characters), include key features, benefits, and target audience
- For description: Generate around 1600 characters (Max 1950 characters), focus on material, fit, benefits, care instructions, and usage scenarios
- Use factual information only from the provided details
- If details are limited, create a professional comprehensive description
- No promotional language, be factual and descriptive
- No repetitions and end description with a complete sentence
- Include paragraphs for better readability in description
- Follow the character limits STRICTLY.
- Read examples below - learn from it and then produce.

EXAMPLES:
Even with minimal information, create professional output:

Input:
Subcategory: T-Shirt
Brand: Generic Brand
Material: Cotton

Output for title:
Product Name: Generic Brand Premium Cotton T-Shirt | Comfortable Everyday Casual Wear | Breathable Fabric for Men and Women | Ideal for Workouts, Lounge, and Outdoor Activities | Available in Multiple Colors and Sizes | Soft, Durable, and Machine Washable

Output for description:
Product Description: Crafted from 100 percent pure cotton, this apparel piece is suitable for routine wear across a variety of everyday settings. The fabric is naturally soft to the touch and allows consistent airflow, making it appropriate for use in both warm and mild conditions. The cotton construction supports breathability during extended periods of use while maintaining a comfortable feel against the skin.

The design follows a regular fit profile, providing sufficient room for movement without appearing oversized or restrictive. Attention has been given to the structure and finish to support shape retention when proper care guidelines are followed. The fabric weight is selected to allow flexible use, whether worn independently or combined with additional layers such as outerwear or lightweight jackets.

Its understated styling allows for simple coordination with different wardrobe components, including denim, casual bottoms, or seasonal layers. The overall form is intended for versatility, allowing use across leisure settings, light physical tasks, or home environments. The neckline and sleeves are finished to offer stability during repeated use while maintaining a consistent structure over time.

Care requirements include routine machine washing under standard conditions. Cleaning with similar colors and drying according to label instructions is recommended. Size availability covers a broad range to support varied body proportions. Designed for functional daily wear, this item offers a balanced blend of material quality, structure, and wearability intended for long-term use.

Subcategory: {subcategory}
Details: {product_details if product_details else 'Basic clothing item'}
"""

def sanitize_text(text, allow_pipes=False, is_description=False):
    """
    Remove special characters, symbols, and ASCII art that might cause Amazon listing suppression.
    Keep only safe characters.
    
    Args:
        text: The text to sanitize
        allow_pipes: If True, pipe characters (|) are allowed (for titles)
        is_description: If True, apply description-specific rules
    """
    if not text:
        return text
    
    # First, replace common problematic symbols with text equivalents
    replacements = {
        '&': ' and ',
        '~': '-',
        '•': '-',
        '·': '-',
        '→': ' to ',
        '←': ' from ',
        '↑': ' up ',
        '↓': ' down ',
        '✓': 'yes',
        '✔': 'yes',
        '★': '',
        '☆': '',
        '❤': '',
        '♥': '',
        '®': '',
        '©': '',
        '™': '',
        '°': ' degrees ',
        '½': 'half',
        '¼': 'quarter',
        '¾': 'three quarters',
        '×': ' x ',
        '÷': ' divided by ',
        '±': ' plus or minus ',
        '≥': ' greater than or equal to ',
        '≤': ' less than or equal to ',
        '≠': ' not equal to ',
        '≈': ' approximately ',
        '℃': ' Celsius ',
        '℉': ' Fahrenheit ',
        '€': ' EUR',
        '£': ' GBP',
        '¥': ' JPY',
        '$': 'USD ',
        '%': ' percent',
    }
    
    # Don't replace pipe if allowed
    if not allow_pipes:
        replacements['|'] = ' '
    
    for symbol, replacement in replacements.items():
        text = text.replace(symbol, replacement)
    
    # Remove any remaining special characters except safe ones
    import re
    
    if allow_pipes:
        # For titles: allow pipes as separators, plus basic punctuation
        # Allow: letters, numbers, spaces, pipes, commas, periods, apostrophes, hyphens, parentheses
        title_pattern = r'[^a-zA-Z0-9\s\-\|,\.\'\'\(\)]'
    elif is_description:
        # For descriptions: no pipes, but allow more punctuation
        # Allow: letters, numbers, spaces, commas, periods, apostrophes, colons, semicolons, parentheses, hyphens
        title_pattern = r'[^a-zA-Z0-9\s\-,\.\'\':;\(\)\n\r]'
    else:
        # Default: basic punctuation only
        title_pattern = r'[^a-zA-Z0-9\s\-,\.\'\'\(\)]'
    
    text = re.sub(title_pattern, ' ', text)
    
    # Clean up multiple spaces and ensure proper spacing around pipes
    if allow_pipes:
        # Ensure spaces around pipes for better readability
        text = re.sub(r'\s*\|\s*', ' | ', text)
    
    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Fix common punctuation issues
    text = re.sub(r'\s+\.', '.', text)  # Remove space before period
    text = re.sub(r'\s+,', ',', text)  # Remove space before comma
    text = re.sub(r',\s*,', ',', text)  # Remove multiple commas
    text = re.sub(r'\.\s*\.', '.', text)  # Remove multiple periods
    
    return text

def call_gemini(prompt, max_tokens):
    try:
        response = text_model.generate_content(
            prompt,
            generation_config=types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=max_tokens,
            ),
        )
        if not response.candidates:
            return "Generation Failed: Model returned no candidates/output."

        candidate = response.candidates[0]
        finish_reason = candidate.finish_reason

        FINISH_REASON_SAFETY = 2
        FINISH_REASON_STOP = 1

        if finish_reason == FINISH_REASON_SAFETY:
            blocked_category_name = ""
            if candidate.safety_ratings:
                try:
                    blocked_category_name = candidate.safety_ratings[0].category.name
                except AttributeError:
                    blocked_category_name = f"Code {candidate.safety_ratings[0].category}"
            return f"Generation Failed: Output Blocked by Safety Filters (Finish Reason: SAFETY). Blocked Category: {blocked_category_name}"

        if finish_reason == FINISH_REASON_STOP and hasattr(response, "text") and response.text:
            return response.text.strip()

        return "Generation Failed: Model stopped with non-success reason."
    except Exception as e:
        return f"Generation Failed: API Error. {type(e).__name__} - {str(e)}"

def generate_product_name(subcategory, product_details):
    prompt = create_base_prompt(subcategory, product_details, 'name')
    raw_output = call_gemini(prompt, 4000)
    label = "Product Name:"
    if raw_output.startswith(label):
        raw_output = raw_output[len(label):].strip()
    
    # Sanitize the output - ALLOW pipes for titles, but not other special chars
    sanitized_output = sanitize_text(raw_output, allow_pipes=True, is_description=False)
    
    # Strict character limit check for title: MAX 190 characters
    if len(sanitized_output) > 190:
        # Truncate to 190 chars at nearest word boundary before a pipe
        truncated = sanitized_output[:190]
        # Try to truncate at the last pipe for cleaner cut
        last_pipe = truncated.rfind('|')
        if last_pipe > 140:  # Only use if we have enough content (around 75% of title)
            sanitized_output = truncated[:last_pipe].strip()
        else:
            # Try to truncate at the last space
            last_space = truncated.rfind(' ')
            if last_space > 160:  # If we have a reasonable space to cut at
                sanitized_output = truncated[:last_space].strip()
            else:
                sanitized_output = truncated
    
    # Ensure we have proper pipe usage
    # Remove any trailing or leading pipes
    sanitized_output = sanitized_output.strip('|').strip()
    
    return sanitized_output

def generate_product_description(subcategory, product_details):
    prompt = create_base_prompt(subcategory, product_details, 'description')
    raw_output = call_gemini(prompt, 4000)
    label = "Product Description:"
    if raw_output.startswith(label):
        raw_output = raw_output[len(label):].strip()
    
    # Sanitize the output - NO pipes for descriptions, but allow punctuation
    sanitized_output = sanitize_text(raw_output, allow_pipes=False, is_description=True)
    
    # Strict character limit check for description: MAX 1950 characters
    if len(sanitized_output) > 1950:
        # For descriptions, truncate to 1950 characters at sentence boundary if possible
        truncated = sanitized_output[:1950]
        # Try to find the last sentence end
        last_period = truncated.rfind('.')
        last_exclamation = truncated.rfind('!')
        last_question = truncated.rfind('?')
        
        # Find the last sentence boundary
        sentence_end = max(last_period, last_exclamation, last_question)
        
        if sentence_end > 1800:  # If we have a reasonable sentence end
            sanitized_output = truncated[:sentence_end + 1].strip()
        else:
            # Otherwise truncate at the last word boundary
            last_space = truncated.rfind(' ')
            if last_space > 1850:
                sanitized_output = truncated[:last_space].strip() + '.'
            else:
                sanitized_output = truncated
    
    # Additional cleanup for descriptions
    import re
    
    # Ensure no markdown or HTML tags
    sanitized_output = re.sub(r'<[^>]+>', '', sanitized_output)
    
    # Replace any bullet-like symbols with plain text or new paragraphs
    sanitized_output = re.sub(r'^[\-\*\+]\s+', '', sanitized_output, flags=re.MULTILINE)
    sanitized_output = re.sub(r'^\d+[\.\)]\s+', '', sanitized_output, flags=re.MULTILINE)
    
    # Clean up multiple newlines and spaces
    sanitized_output = re.sub(r'\n\s*\n\s*\n+', '\n\n', sanitized_output)
    sanitized_output = re.sub(r' +', ' ', sanitized_output)
    
    return sanitized_output

# --- TEXT GENERATION ENDPOINT ---

@app.route('/api/generate-title-description', methods=['POST'])
def generate_title_description():
    try:
        data = request.get_json()
        print(f"📝 Received text generation request: {data}")

        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        subcategory = data.get('subcategory', '')
        task_type = data.get('type', 'title')

        product_details_lines = []

        for k, v in data.items():
            if k not in ('subcategory', 'type') and v is not None:
                cleaned_v = str(v).strip()
                if cleaned_v and cleaned_v != 'N/A' and cleaned_v != 'null':
                    # Sanitize input based on task type
                    sanitized_v = sanitize_text(cleaned_v, allow_pipes=(task_type == 'title'), is_description=(task_type == 'description'))
                    product_details_lines.append(f"{k}: {sanitized_v}")

        product_details = "\n".join(product_details_lines)

        print(f"🔍 Processed data - Subcategory: '{subcategory}', Details lines: {len(product_details_lines)}")
        print(f"📋 Product details: {product_details}")

        if not subcategory:
            if 'Generic Name' in data:
                subcategory = data.get('Generic Name', '')
            elif 'Product Type' in data:
                subcategory = data.get('Product Type', '')
            elif 'Category' in data:
                subcategory = data.get('Category', '')

        if not subcategory:
            subcategory = "Clothing Item"
            print("⚠️ No subcategory found, using default")

        if not product_details and len(product_details_lines) == 0:
            print("❌ No valid product details found after cleaning")
            minimal_details = []
            for k, v in data.items():
                if k not in ('subcategory', 'type') and v:
                    sanitized_v = sanitize_text(str(v), allow_pipes=(task_type == 'title'), is_description=(task_type == 'description'))
                    minimal_details.append(f"{k}: {sanitized_v}")

            if minimal_details:
                product_details = "\n".join(minimal_details)
                print(f"⚡ Using minimal details: {product_details}")
            else:
                return jsonify({
                    'success': False,
                    'error': 'Please provide at least some product details like Brand, Material, Fit, etc.'
                }), 400

        print(f"✅ Final - Subcategory: '{subcategory}', Details count: {len(product_details_lines)}")

        if task_type == 'title':
            generated_title = generate_product_name(subcategory, product_details)
            if generated_title.startswith("Generation Failed:"):
                return jsonify({'success': False, 'error': generated_title}), 500
            
            # Final check for title length
            if len(generated_title) > 190:
                print(f"⚠️ Title exceeds 190 chars: {len(generated_title)}")
                # One more truncation if needed
                generated_title = generated_title[:187] + "..."
            
            print(f"📏 Title length: {len(generated_title)} characters")
            return jsonify({'success': True, 'generated_title': generated_title})

        elif task_type == 'description':
            generated_description = generate_product_description(subcategory, product_details)
            if generated_description.startswith("Generation Failed:"):
                return jsonify({'success': False, 'error': generated_description}), 500
            
            # Final check for description length
            if len(generated_description) > 1950:
                print(f"⚠️ Description exceeds 1950 chars: {len(generated_description)}")
                # One more truncation if needed
                generated_description = generated_description[:1947] + "..."
            
            print(f"📏 Description length: {len(generated_description)} characters")
            return jsonify({'success': True, 'generated_description': generated_description})

        else:
            return jsonify({'success': False, 'error': 'Unknown type specified'}), 400

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500
        
# --- METADATA SCRAPING ENDPOINT ---

@app.route('/api/scrape-metadata-from-asin', methods=['POST'])
def scrape_metadata_from_asin():
    """
    Scrape product metadata (Category, Gender, Age Group, Subcategory) from ASIN
    """
    try:
        data = request.get_json()
        asin = data.get('asin')
        
        if not asin:
            return jsonify({"success": False, "error": "ASIN is required"}), 400
        
        print(f"🔄 Scraping metadata for ASIN: {asin}")
        
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        metadata_scraper_path = os.path.join(script_dir, 'amz_metadata_scraper.py')
        
        # Check if the scraper file exists
        if not os.path.exists(metadata_scraper_path):
            print(f"❌ Metadata scraper file not found: {metadata_scraper_path}")
            return jsonify({
                "success": False,
                "error": "Metadata scraper not configured",
                "fallback": True
            }), 500
        
        # Run the scraper as a subprocess
        try:
            result = subprocess.run(
                [sys.executable, metadata_scraper_path, asin],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                print(f"❌ Metadata scraper failed: {result.stderr}")
                return jsonify({
                    "success": False,
                    "error": f"Scraper failed: {result.stderr[:200]}",
                    "fallback": True
                }), 500
            
            # Parse the JSON output
            try:
                metadata = json.loads(result.stdout)
                print(f"✅ Metadata scraped successfully: {metadata}")
                
                # If scraper failed but returned something, use fallback
                if not metadata.get("success", False):
                    return jsonify({
                        "success": False,
                        "error": metadata.get("error", "Unknown error"),
                        "fallback": True,
                        "metadata": {
                            "category": "unknown",
                            "gender": "unknown",
                            "age_group": "Adults",
                            "subcategory": "unknown"
                        }
                    }), 200
                
                return jsonify({
                    "success": True,
                    "metadata": {
                        "category": metadata.get("category", "unknown"),
                        "gender": metadata.get("gender", "unknown"),
                        "age_group": metadata.get("age_group", "Adults"),
                        "subcategory": metadata.get("subcategory", "unknown"),
                        "title": metadata.get("title", ""),
                        "breadcrumbs": metadata.get("breadcrumbs", [])
                    },
                    "asin": asin
                })
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse scraper output: {e}")
                return jsonify({
                    "success": False,
                    "error": "Failed to parse scraper output",
                    "fallback": True,
                    "raw_output": result.stdout[:500]
                }), 500
                
        except subprocess.TimeoutExpired:
            print(f"❌ Metadata scraper timed out for ASIN: {asin}")
            return jsonify({
                "success": False,
                "error": "Scraping timed out",
                "fallback": True
            }), 500
            
        except Exception as e:
            print(f"❌ Error running metadata scraper: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Scraper error: {str(e)}",
                "fallback": True
            }), 500
            
    except Exception as e:
        print(f"❌ Error in /api/scrape-metadata-from-asin: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

# --- TEST ENDPOINTS ---

@app.route("/api/test-gemini-image", methods=["POST"])
def test_gemini_image():
    """Test endpoint to check if Gemini can generate any image"""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        img_stream = io.BytesIO(file.read())
        img_stream.seek(0)
        uploaded_image = Image.open(img_stream).convert("RGB")

        # Very simple test prompt
        test_prompt = "Create a simple product photo with white background"

        print("🧪 Testing basic Gemini image generation...")
        response = image_model.generate_content([uploaded_image, test_prompt])

        test_result = {
            "has_response": True,
            "response_type": type(response).__name__,
            "has_text": hasattr(response, 'text'),
            "text_length": len(response.text) if hasattr(response, 'text') and response.text else 0,
            "has_parts": hasattr(response, 'parts'),
            "parts_count": len(response.parts) if hasattr(response, 'parts') else 0,
            "has_candidates": hasattr(response, 'candidates'),
            "candidates_count": len(response.candidates) if hasattr(response, 'candidates') else 0,
        }

        # Check for image
        image_found = False
        if hasattr(response, 'parts'):
            for i, part in enumerate(response.parts):
                if hasattr(part, 'inline_data') and part.inline_data:
                    test_result[f"part_{i}_has_image"] = True
                    image_found = True
                else:
                    test_result[f"part_{i}_has_image"] = False

        test_result["image_found"] = image_found

        if hasattr(response, 'text') and response.text:
            test_result["text_preview"] = response.text[:500]

        return jsonify({
            "success": True,
            "test_result": test_result,
            "message": "Gemini test completed"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Test failed: {str(e)}",
            "message": "Gemini test failed - check API key and permissions"
        }), 500

# ✅ define SCRAPED_IMAGES_DIR so /api/health won't crash
SCRAPED_IMAGES_DIR = os.getenv("SCRAPED_IMAGES_DIR", "scraped_images")

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "gemini_text": TEXT_MODEL_ID,
            "gemini_image": IMAGE_MODEL_ID,
            "gcs": "available" if storage_client else "unavailable",
            "output_dir": OUTPUT_DIR,
            "scraped_dir": SCRAPED_IMAGES_DIR,
            "web_scraping": "available"
        }
    })

# ===========================
# KEYWORDS GENERATION ENDPOINTS
# ===========================

@app.route('/api/generate-keywords', methods=['POST'])
def generate_keywords():
    """Generate trending keywords from golden product"""
    try:
        data = request.get_json()
        
        # Extract product information
        product_title = data.get('title', '')
        product_category = data.get('category', '')
        product_subcategory = data.get('subcategory', 'Clothing')
        product_details = data.get('details', {})
        
        # Prepare prompt for Gemini
        prompt = f"""
        ROLE: You are an expert Amazon SEO specialist and keyword researcher.
        
        TASK: Generate exactly 7-8 high-performing, trending Amazon keywords for this product.
        
        PRODUCT INFORMATION:
        - Title: {product_title}
        - Category: {product_category}
        - Subcategory: {product_subcategory}
        - Key Details: {json.dumps(product_details, indent=2) if product_details else 'Not specified'}
        
        KEYWORD REQUIREMENTS:
        1. Generate EXACTLY 7-8 keywords (no more, no less)
        2. Each keyword: 2-4 words maximum
        3. Include: Main product terms, use-case keywords, feature keywords, style keywords
        4. Consider: Seasonality, current trends, search volume
        5. Prioritize: High-conversion, buyer-intent keywords
        6. Format: Semicolon-separated (keyword1; keyword2; keyword3)
        7. Character limit: Maximum 250 characters total
        
        KEYWORD CATEGORIES TO COVER:
        - Primary product keywords
        - Feature-based keywords
        - Use-case/occasion keywords
        - Style/design keywords
        - Material/fabric keywords
        - Target audience keywords
        - Benefit-driven keywords
        
        EXAMPLES:
        Input: "Women's Cotton Summer Dress"
        Output: "summer dresses for women; cotton maxi dress; floral print dress; beach wedding dress; casual sundress; bohemian style dress; party wear dress"
        
        Input: "Men's Running Shoes"
        Output: "running shoes for men; lightweight sneakers; gym training shoes; breathable running footwear; marathon running shoes; sports shoes; athletic footwear"
        
        Now generate keywords for the provided product.
        Return ONLY the semicolon-separated keywords, nothing else.
        """
        
        # Call Gemini
        response = text_model.generate_content(
            prompt,
            generation_config=types.GenerationConfig(
                temperature=0.8,
                top_p=0.9,
                top_k=40,
                max_output_tokens=200,
            ),
        )
        
        if response.text:
            keywords_text = response.text.strip()
            
            # Clean up response
            keywords_text = keywords_text.replace('Keywords:', '').replace('"', '').strip()
            keywords_text = re.sub(r'^\d+\.\s*', '', keywords_text, flags=re.MULTILINE)
            keywords_text = ' '.join(keywords_text.split())  # Remove extra whitespace
            
            # Ensure semicolon format
            if ';' not in keywords_text and '\n' in keywords_text:
                keywords_text = '; '.join([k.strip() for k in keywords_text.split('\n') if k.strip()])
            elif ';' not in keywords_text:
                keywords_text = keywords_text.replace(',', ';')
            
            # Count keywords
            keyword_list = [k.strip() for k in keywords_text.split(';') if k.strip()]
            
            # Ensure we have 7-8 keywords
            if len(keyword_list) < 7:
                # Generate additional keywords if needed
                supplement_prompt = f"Add {7 - len(keyword_list)} more relevant Amazon keywords for {product_title}. Format: keyword1; keyword2; ..."
                supplement_response = text_model.generate_content(supplement_prompt)
                if supplement_response.text:
                    supplement_text = supplement_response.text.strip().replace('"', '').strip()
                    supplement_list = [k.strip() for k in supplement_text.split(';') if k.strip()]
                    keyword_list.extend(supplement_list[:7 - len(keyword_list)])
            
            # Limit to 8 keywords maximum
            keyword_list = keyword_list[:8]
            
            # Join back with semicolons
            final_keywords = '; '.join(keyword_list)
            
            # Ensure character limit
            if len(final_keywords) > 250:
                final_keywords = final_keywords[:247] + '...'
            
            return jsonify({
                'success': True,
                'keywords': final_keywords,
                'count': len(keyword_list),
                'character_count': len(final_keywords)
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No response from AI model',
                'fallback_keywords': f"{product_subcategory}; {product_category} apparel; fashion clothing; trendy wear"
            }), 500
            
    except Exception as e:
        print(f"❌ Error generating keywords: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to generate keywords: {str(e)}',
            'fallback_keywords': 'clothing; apparel; fashion; wear; outfit; dress; style'
        }), 500

@app.route('/api/extract-attributes-from-keywords', methods=['POST'])
def extract_attributes_from_keywords():
    """Extract and suggest product attributes from keywords"""
    try:
        data = request.get_json()
        keywords = data.get('keywords', '')
        existing_attributes = data.get('existing_attributes', {})
        
        if not keywords:
            return jsonify({
                'success': False,
                'error': 'Keywords are required'
            }), 400
        
        # Prepare prompt
        prompt = f"""
        ROLE: You are an Amazon product listing expert.
        
        TASK: Analyze these product keywords and suggest values for common product attributes.
        
        KEYWORDS: {keywords}
        
        EXISTING ATTRIBUTES (don't change if already filled):
        {json.dumps(existing_attributes, indent=2)}
        
        COMMON ATTRIBUTES TO FILL:
        1. material (e.g., cotton, polyester, silk)
        2. color (e.g., black, blue, red, floral print)
        3. pattern (e.g., solid, striped, printed)
        4. style (e.g., casual, formal, bohemian)
        5. occasion (e.g., wedding, party, casual, office)
        6. season (e.g., summer, winter, all-season)
        7. fit (e.g., slim, regular, loose)
        8. brand_name (extract from keywords if present)
        9. care_instructions (suggest based on material)
        10. size_type (e.g., regular, plus size, petite)
        
        INSTRUCTIONS:
        1. Only suggest for EMPTY attributes (value is empty string or not in existing_attributes)
        2. Extract information naturally from keywords
        3. Be specific and accurate
        4. Return ONLY a JSON object with attribute:value pairs
        5. Example: {{"material": "cotton", "color": "navy blue", "pattern": "solid"}}
        
        Return JSON only, no other text.
        """
        
        response = text_model.generate_content(
            prompt,
            generation_config=types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=500,
            ),
        )
        
        if response.text:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                try:
                    suggested_attributes = json.loads(json_match.group())
                    
                    # Filter out attributes that are already filled
                    final_suggestions = {}
                    for key, value in suggested_attributes.items():
                        if key not in existing_attributes or not str(existing_attributes.get(key, '')).strip():
                            final_suggestions[key] = value
                    
                    return jsonify({
                        'success': True,
                        'suggested_attributes': final_suggestions,
                        'message': f'Found {len(final_suggestions)} attribute suggestions'
                    })
                except json.JSONDecodeError:
                    # Fallback: extract key-value pairs manually
                    return extract_attributes_fallback(response.text, existing_attributes)
            else:
                return extract_attributes_fallback(response.text, existing_attributes)
        else:
            return jsonify({
                'success': False,
                'error': 'No response from AI',
                'suggested_attributes': {}
            }), 500
            
    except Exception as e:
        print(f"❌ Error extracting attributes: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to extract attributes: {str(e)}',
            'suggested_attributes': {}
        }), 500

def extract_attributes_fallback(text, existing_attributes):
    """Fallback method to extract attributes from text"""
    suggestions = {}
    
    # Common attribute patterns
    patterns = {
        'material': r'(cotton|polyester|silk|wool|linen|denim|leather|nylon|spandex|rayon)',
        'color': r'(black|white|blue|red|green|yellow|pink|purple|orange|brown|grey|gray|navy|maroon)',
        'pattern': r'(solid|striped|floral|printed|checkered|polka dot|geometric|abstract)',
        'style': r'(casual|formal|bohemian|vintage|modern|traditional|ethnic|western)',
        'occasion': r'(wedding|party|casual|office|beach|formal|everyday|evening)',
        'season': r'(summer|winter|spring|fall|autumn|all-season|year-round)',
        'fit': r'(slim|regular|loose|fitted|relaxed|tailored|oversized)'
    }
    
    text_lower = text.lower()
    
    for attribute, pattern in patterns.items():
        if attribute not in existing_attributes or not str(existing_attributes.get(attribute, '')).strip():
            match = re.search(pattern, text_lower)
            if match:
                suggestions[attribute] = match.group(1)
    
    return jsonify({
        'success': True,
        'suggested_attributes': suggestions,
        'message': f'Found {len(suggestions)} attribute suggestions (fallback)'
    })

@app.route("/lead-login", methods=["POST"])
def lead_login():
    """
    POST /lead-login
    Body: { email, password }
    Validates against LeadCredentials sheet (columns: email, password, active)
    Responses:
      200 { success: True, role: "lead" }
      400/401/403/404/500 with { success: False, error: "..." }
    """
    if _gc is None:
        return jsonify(success=False, error="Lead authentication not configured on server"), 500

    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify(success=False, error="Email and password required"), 400

    try:
        sh = _gc.open_by_key(_LEAD_SPREADSHEET_ID)
        ws = sh.worksheet(_LEAD_SHEET_NAME)
        records = ws.get_all_records()
    except Exception as e:
        print("Error reading lead credentials sheet:", e)
        return jsonify(success=False, error="Failed to read credentials sheet"), 500

    # expected columns: email, password, active
    for row in records:
        row_email = str(row.get("email", "")).strip().lower()
        if row_email == email:
            row_password = str(row.get("password", "")).strip()
            if row_password != password:
                return jsonify(success=False, error="Invalid credentials"), 401

            active_val = str(row.get("active", "")).strip().lower()
            if active_val in ("1", "true", "yes", "y", "active"):
                return jsonify(success=True, role="lead")
            else:
                return jsonify(success=False, error="Account not active"), 403

    return jsonify(success=False, error="User not found"), 404

if __name__ == "__main__":
    # ✅ Use PORT env var so Cloud Run can control the port.
    # Locally you can leave it at 5000 (default) or override with PORT in .env.
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"Starting Flask on 0.0.0.0:{port}, debug={debug}, origin={FRONTEND_ORIGIN}")
    print(f"📁 Output directory: {os.path.abspath(OUTPUT_DIR)}")
    print(f"📁 Directory exists: {os.path.exists(OUTPUT_DIR)}")
    print(f"📁 Directory writable: {os.access(OUTPUT_DIR, os.W_OK)}")
    app.run(host="0.0.0.0", port=port, debug=debug)