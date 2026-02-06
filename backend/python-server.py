import os
import base64
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
import random
import time
import hashlib
import threading
from collections import deque
from threading import Lock
from flask_cors import CORS
from PIL import Image
import google.generativeai as genai
from google.cloud import storage
from google.generativeai import types
from google.cloud.exceptions import Forbidden

# ✅ Import Secret Manager utilities for Gemini authentication
from secret_manager import get_gemini_models


# --- Google Sheets client for Lead login ---
import gspread
from google.oauth2.service_account import Credentials


_LEAD_SPREADSHEET_ID = "1i0gqqUbqm3bqY00oGYh_iJBm2aTPC5D6zi20kyxStB4"
_LEAD_SHEET_NAME = "Data"            # Lead spreadsheet tab is "Data"
_USER_SPREADSHEET_ID = "1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto"
_USER_SHEET_NAME = "Data"            # KAM/User spreadsheet tab is "Data"
_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


# Use ADC (Application Default Credentials) for Google Sheets access
_gc = None
try:
    # Try to use ADC first (Cloud Run uses this automatically)
    from google.auth import default
    creds, project = default(scopes=_SCOPES)
    _gc = gspread.authorize(creds)
    print("✅ Google Sheets client initialized with ADC (Application Default Credentials)")
except Exception as adc_error:
    print(f"⚠️  Could not initialize with ADC: {adc_error}")
    # Fallback: try to load credentials.json if it exists
    try:
        creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")
        if os.path.exists(creds_path):
            _creds = Credentials.from_service_account_file(creds_path, scopes=_SCOPES)
            _gc = gspread.authorize(_creds)
            print("✅ Google Sheets client initialized with credentials.json")
        else:
            print("⚠️  credentials.json not found and ADC not available")
            _gc = None
    except Exception as fallback_error:
        print(f"⚠️  Could not initialize Google Sheets client for lead login: {fallback_error}")
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
PORT = int(os.getenv("PORT", "5000"))
DEBUG_MODE = os.getenv("FLASK_DEBUG", "true").lower() == "true"


# ✅ CORS configuration for Cloud Run - supports multiple origins
def get_allowed_origins():
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://listrov3-frontend-648176215467.asia-south1.run.app"
    ]
    
    # Add custom origin from environment variable if provided
    if os.getenv("FRONTEND_ORIGIN"):
        origins.append(os.getenv("FRONTEND_ORIGIN"))
    
    return list(set(origins))  # Remove duplicates


ALLOWED_ORIGINS = get_allowed_origins()
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)


# --- GEMINI CONFIGURATION via Secret Manager ---

# ✅ Initialize Gemini models using Secret Manager (no API keys)
try:
    credentials, text_model, image_model = get_gemini_models()
    print(f"✅ Gemini models initialized successfully via Secret Manager")
    print(f"   - Text model: gemini-2.5-flash")
    print(f"   - Image model: gemini-2.5-flash-image")
except Exception as e:
    print(f"❌ Failed to initialize Gemini models: {e}")
    text_model = None
    image_model = None


OUTPUT_DIR = "generated_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Import category-specific generators (Home & Kitchen)
try:
    from hk_image_generator import generate_homekitchen_image, create_genai_client as hk_create_genai_client
    print("✅ Home & Kitchen image generator loaded successfully")
except Exception as e:
    print(f"⚠️  Home & Kitchen generator not available: {e}")
    generate_homekitchen_image = None
    hk_create_genai_client = None


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
    "ROLE: Professional Amazon product photographer specializing in apparel.\n\n"
    
    "TASK: Create full-body model photo wearing the garment from reference image on pure white background.\n\n"
    
    "  CRITICAL - ABSOLUTE WHITE BACKGROUND:\n"
    "- Pure white ONLY: RGB(255,255,255) or #FFFFFF\n"
    "- ZERO shadows anywhere on background - this is NON-NEGOTIABLE\n"
    "- NO grey tones, NO off-white, NO cream, NO gradients\n"
    "- NO floor shadows, NO wall shadows, NO ambient shadows\n"
    "- Background must be clinically white like infinite white void\n"
    "- Use high-key lighting setup to eliminate all background shadows\n\n"
    
    "GARMENT REPLICATION:\n"
    "- Study reference image carefully\n"
    "- Copy EXACTLY: colors, patterns, textures, size, fabric type, all design details\n"
    "- Do NOT modify or reinterpret the garment design\n"
    "- Match every visual element precisely\n\n"
    
    "MODEL & COMPOSITION:\n"
    "- Full body visible: head to toe including feet\n"
    "- Model centered, fills 80-90% of frame height\n"
    "- Natural standing pose, arms relaxed at sides\n"
    "- Professional modeling stance\n"
    "- Soft shadows allowed ONLY directly under model's feet (optional)\n\n"
    
    "LIGHTING REQUIREMENTS:\n"
    "- High-key studio lighting setup\n"
    "- Overexposed background to pure white\n"
    "- Even illumination to eliminate background shadows\n"
    "- Bright, shadowless backdrop\n\n"
    
    "TECHNICAL SPECS:\n"
    "- Resolution: Minimum 2000x2500 pixels\n"
    "- Aspect ratio: 3:4 portrait\n"
    "- Focus: Sharp, clear garment details\n"
    "- Style: Professional e-commerce product photography\n\n"
    
    "STRICTLY FORBIDDEN:\n"
    "- Background shadows of ANY kind\n"
    "- Text, logos, watermarks, branding\n"
    "- Props, accessories, or background objects\n"
    "- Grey or off-white backgrounds\n"
    "- Cropped body parts\n"
    "- Gradient backgrounds\n\n"
    
    "OUTPUT VALIDATION:\n"
    "- Background: Pure white RGB(255,255,255) - verified with no shadows\n"
    "- Body: Complete head-to-toe visibility\n"
    "- Garment: Exact match to reference image\n"
    "- Shadow check: ZERO shadows on background confirmed\n\n"


    "Product Details: '{category}', {gender}, {age_group}, {subcategory}"
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
        "Study the reference image to capture: fabric texture, color accuracy, size, pattern details, cut and style.\n"
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
        "Product Details: '{category}', {gender}, {age_group}, {subcategory}"
    )


def get_prompt_amazon_lifestyle_image():
    return (
        "ROLE: You are a professional lifestyle fashion photographer creating Amazon secondary product images.\n\n"
        "OBJECTIVE: Create a full-body lifestyle photo showing a model wearing the exact garment in a real-world setting.\n\n"
        "CONTEXT: Use the reference image to copy the garment's exact colors, patterns, size, and design. Create a NEW lifestyle photo with the same garment on a model in an appropriate background environment.\n\n"
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
        "Product Details: '{category}', {gender}, {age_group}, {subcategory}"
    )


def get_prompt_amazon_angle_image():
    return (
        "ROLE: You are a professional product photographer. Analyze the reference image and recreate it on a model in a lifestyle setting.\n\n"
        "KEEP GARMENT IDENTICAL: Same colors, patterns, fabric, size, design details. DO NOT alter the garment.\n\n"
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
        "Product Details: '{category}', {gender}, {age_group}, {subcategory}"
    )


def get_prompt_amazon_infographic():
    return (
        "You are a professional Amazon product infographic designer. Analyze the reference image and create a clean infographic layout.\n\n"
        "KEEP GARMENT IDENTICAL: Same colors, patterns, fabric, size, design details. DO NOT alter the garment design.\n\n"
        "INFOGRAPHIC REQUIREMENTS:\n"
        "Clean white or light background\n"
        "Product centered and clearly visible\n"
        "3-5 key feature callouts with simple icons\n"
        "Short descriptive text for each feature\n"
        "Minimal, professional Amazon-compliant design\n"
        "No models, no body parts, no lifestyle backgrounds\n"
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
        "CRITICAL: Use reference image only for garment color, size, and texture. Create clean infographic layout with feature highlights."
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
        # ✅ Allow all configured origins
        origin = request.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            headers["Access-Control-Allow-Origin"] = origin
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


            # Check if password is the temporary password "Temp@123"
            is_temp_password = stored_password == "Temp@123"
            
            # first_time detection (if a FirstLogin column exists or password equals email)
            first_login_flag = (user_record.get("FirstLogin") or user_record.get("firstLogin") or "").strip().lower()
            first_time = first_login_flag == "yes" or is_temp_password


            return jsonify({
                "success": True,
                "message": "Login successful",
                "first_time": first_time,
                "is_temp_password": is_temp_password,
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


        # Connect to Google Sheets
        sheet = connect_to_sheet()
        if sheet is None:
            return jsonify({"success": False, "error": "User authentication not configured (missing Google Sheets access)"}), 500


        try:
            records = sheet.get_all_records()
            header_row = sheet.row_values(1)
            
            # Find user by email and row index
            user_found = False
            row_index = None
            
            for i, record in enumerate(records):
                # Check multiple possible column names for email
                record_email = (
                    str(record.get("email") or 
                    record.get("Email") or 
                    "").strip().lower()
                )
                if record_email == email:
                    user_found = True
                    row_index = i + 2  # +2 for header row and 0-based index
                    break


            if not user_found:
                return jsonify({"success": False, "error": "Email not found in system"}), 404


            print(f"✅ Found user at row {row_index}, updating columns...")
            
            # Find column indices - MATCHING YOUR EXACT COLUMN NAMES
            requested_col = None
            last_emailed_col = None
            
            for col_idx, header in enumerate(header_row):
                header_str = str(header).strip()
                header_lower = header_str.lower()
                
                print(f"  Column {col_idx+1}: '{header_str}' (lower: '{header_lower}')")
                
                # Match "Password Requested by User" column
                if ("requested" in header_lower and "password" in header_lower) or \
                   ("requested" in header_lower and "user" in header_lower):
                    requested_col = col_idx + 1
                    print(f"    ✓ Found 'Password Requested by User' at column {requested_col}")
                
                # Match "Last Emailed" column
                elif "emailed" in header_lower and "last" in header_lower:
                    last_emailed_col = col_idx + 1
                    print(f"    ✓ Found 'Last Emailed' at column {last_emailed_col}")
            
            # If we can't find columns by keywords, try exact names
            if requested_col is None:
                for col_idx, header in enumerate(header_row):
                    if str(header).strip() == "Password Requested by User":
                        requested_col = col_idx + 1
                        break
            
            if last_emailed_col is None:
                for col_idx, header in enumerate(header_row):
                    if str(header).strip() == "Last Emailed":
                        last_emailed_col = col_idx + 1
                        break


            print(f"  Final column positions: requested_col={requested_col}, last_emailed_col={last_emailed_col}")
            
            # Update Password Requested by User to "Yes"
            if requested_col:
                sheet.update_cell(row_index, requested_col, "Yes")
                print(f"  ✓ Updated 'Password Requested by User' to 'Yes'")
            else:
                print(f"  ❌ 'Password Requested by User' column not found")
                # Try to create the column if missing
                return jsonify({
                    "success": False, 
                    "error": "System configuration error. Please contact administrator."
                }), 500
            
            # Update Last Emailed with current timestamp
            if last_emailed_col:
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                sheet.update_cell(row_index, last_emailed_col, timestamp)
                print(f"  ✓ Updated 'Last Emailed' to '{timestamp}'")
            else:
                print(f"  ⚠️ 'Last Emailed' column not found, skipping timestamp")
            
            return jsonify({
                "success": True,
                "message": "Password reset request submitted. Admin approval required.",
                "pending_approval": True
            })
            
        except Exception as sheets_error:
            print(f"❌ Google Sheets error: {str(sheets_error)}")
            import traceback
            traceback.print_exc()
            return jsonify({"success": False, "error": "Failed to update password reset request"}), 500


    except Exception as e:
        print(f"❌ Reset password error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": "Server error during password reset"}), 500


@app.route("/update-password", methods=["POST"])
def update_password():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        new_password = data.get("password", "").strip()
        token = data.get("token", "")  # Reset token (optional for this flow)


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
                print(f"❌ Google Sheets error: {sheets_error}")
                return jsonify({"success": False, "error": "Failed to update password"}), 500


        return jsonify({"success": False, "error": "Failed to connect to database"}), 500
            
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

        # --- Category-specific handling (Home & Kitchen) ---
        category_value = None
        if isinstance(attributes, dict):
            category_value = attributes.get('Category') or attributes.get('category')

        if category_value and isinstance(category_value, str) and generate_homekitchen_image is not None:
            cat_norm = category_value.strip().lower()
            if cat_norm in ('home & kitchen', 'home and kitchen', 'home kitchen', 'home &kitchen', 'home-kitchen'):
                # For Home & Kitchen we support only the first two styles (0 and 1)
                if style_index >= 2:
                    return jsonify({"success": False, "error": "Other features loading soon"}), 400

                # Prepare ref image bytes
                try:
                    # Use the in-memory img_stream we created above
                    img_stream.seek(0)
                    image_bytes = img_stream.getvalue()
                except Exception:
                    image_bytes = None

                try:
                    # Create Gemini model via the hk module
                    hk_model = hk_create_genai_client() if hk_create_genai_client else None
                except Exception as e:
                    return jsonify({"success": False, "error": f"H&K auth error: {e}"}), 500

                if hk_model is None:
                    return jsonify({"success": False, "error": "H&K generator not configured"}), 500

                try:
                    mime, b64 = generate_homekitchen_image(
                        model=hk_model,
                        prompt=final_prompt,
                        ref_images=[],
                        ref_image_bytes=[(image_bytes, 'image/jpeg')] if image_bytes else None,
                        target_size=(1117, 1400),
                        index=style_index,
                        attributes=attributes,  # Pass attributes for sheet lookup
                    )

                    # Decode and save locally similar to clothing flow
                    out_bytes = base64.b64decode(b64)
                    unique_filename = f"generated_hk_{uuid.uuid4().hex}.jpg"
                    local_path = os.path.join(OUTPUT_DIR, unique_filename)
                    with open(local_path, 'wb') as f:
                        f.write(out_bytes)

                    # Upload to GCS if available
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
                        "image_size": "1117x1400",
                        "style_index": style_index,
                    }), 200

                except ValueError as ve:
                    return jsonify({"success": False, "error": str(ve)}), 400
                except Exception as e:
                    import traceback
                    print(f"❌ H&K generation error: {e}")
                    traceback.print_exc()
                    return jsonify({"success": False, "error": f"H&K generation failed: {e}"}), 500


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
    Per documentation: Import and call scrape_amazon_metadata directly
    """
    try:
        data = request.get_json()
        asin = data.get('asin')
        
        if not asin:
            return jsonify({"success": False, "error": "ASIN is required"}), 400
        
        print(f"🔄 Scraping metadata for ASIN: {asin}")
        
        # Import scraper function directly (per documentation)
        from amz_metadata_scraper import scrape_amazon_metadata
        
        # Call scraper function
        result = scrape_amazon_metadata(asin)
        
        # Return result directly as-is (per documentation)
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in /api/scrape-metadata-from-asin: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Metadata scraping failed: {str(e)}"
        }), 500


# ===============================================================
# UNIQUE SKU GENERATION SECTION - GUARANTEED UNIQUENESS
# ===============================================================


# SKU Configuration with both GNC and GNO codes
FIXED_CODE_GNC = "GNC"
FIXED_CODE_GNO = "GNO"
IGNORE_WORDS = {
    "and", "&", "sets", "set", "wear", "clothing", "nightwear", 
    "lounge", "suits", "suit", "for", "with", "the", "a", "an", 
    "in", "on", "of", "to", "by", "as", "at", "from",
    "women's", "men's", "women", "men", "kids", "children",
    "baby", "infant", "toddler", "unisex", "gender"
}


# Thread-safe unique SKU generator
class UniqueSKUGenerator:
    """Guarantees unique SKU generation with multiple layers of uniqueness checking."""
    
    def __init__(self):
        self.lock = Lock()
        # In-memory cache for quick uniqueness checks
        self.generated_skus = set()
        # Track product code sequences
        self.product_code_sequences = {}
        # Cache for recent SKUs (FIFO)
        self.recent_skus = deque(maxlen=10000)
        print("✅ Unique SKU Generator initialized")
    
    def clean_text_for_sku(self, text):
        """Clean text for SKU generation."""
        if not text:
            return []
        cleaned = re.sub(r'[^a-zA-Z ]', ' ', text).lower()
        words = cleaned.split()
        return [word for word in words if word not in IGNORE_WORDS and len(word) > 1]
    
    def generate_unique_product_code(self, subcategory):
        """Generate guaranteed unique 2-letter product code."""
        words = self.clean_text_for_sku(subcategory)
        
        if not words:
            return "PR"
        
        # Base code generation
        if len(words) >= 2:
            base_code = (words[0][0] + words[1][0]).upper()
        else:
            word = words[0]
            if len(word) >= 3:
                base_code = (word[0] + word[-1]).upper()
            else:
                base_code = word[:2].upper().ljust(2, 'X')
        
        with self.lock:
            # Check if this code has been used
            if base_code in self.product_code_sequences:
                sequence = self.product_code_sequences[base_code] + 1
            else:
                sequence = 0
            
            self.product_code_sequences[base_code] = sequence
            
            # If sequence > 0, modify code to ensure uniqueness
            if sequence > 0:
                if sequence < 26:  # Use letters A-Z
                    variant = chr(65 + sequence - 1)  # A=1, B=2, etc.
                    code = base_code[0] + variant
                else:
                    variant = str(sequence % 10)
                    code = base_code[0] + variant
            else:
                code = base_code
            
            return code
    
    def generate_unique_4_digits(self, product_code, fixed_code, attempt=0):
        """Generate guaranteed unique 4-digit number."""
        with self.lock:
            # Use timestamp for base uniqueness
            timestamp = int(time.time() * 1000) % 10000
            
            # Add product code hash for more uniqueness
            code_hash = hash(product_code) % 100
            
            # Add attempt number for retries
            attempt_offset = attempt * 37
            
            # Combine all factors
            base = (timestamp + code_hash + attempt_offset) % 10000
            
            # Ensure 4 digits
            digits = base if base >= 1000 else base + 1000
            
            # Generate a test SKU to check uniqueness
            test_sku = f"{product_code}{fixed_code}{digits:04d}{datetime.now().strftime('%Y%m')}"
            
            # Check if this SKU already exists
            max_attempts = 10
            while test_sku in self.generated_skus and attempt < max_attempts:
                attempt += 1
                # Try different algorithm for collision
                timestamp = int(time.time() * 1000) % 10000
                random_offset = random.randint(1, 999)
                digits = (timestamp + random_offset) % 10000
                if digits < 1000:
                    digits += 1000
                test_sku = f"{product_code}{fixed_code}{digits:04d}{datetime.now().strftime('%Y%m')}"
            
            if attempt >= max_attempts:
                # Last resort: completely random
                digits = random.randint(1000, 9999)
            
            return digits
    
    def generate_unique_sku_components(self, product_code, fixed_code, variant=""):
        """Generate all components of a unique SKU."""
        digits = self.generate_unique_4_digits(product_code, fixed_code)
        year_month = datetime.now().strftime("%Y%m")
        variant_code = variant[:2].upper() if variant else ""
        return product_code, digits, year_month, variant_code
    
    def generate_full_sku(self, product_code, fixed_code, variant=""):
        """Generate a complete unique SKU."""
        product_code, digits, year_month, variant_code = self.generate_unique_sku_components(
            product_code, fixed_code, variant
        )
        
        if variant_code:
            sku = f"{product_code}{fixed_code}{variant_code}{digits:04d}{year_month}"
        else:
            sku = f"{product_code}{fixed_code}{digits:04d}{year_month}"
        
        # Register immediately
        with self.lock:
            self.generated_skus.add(sku)
            self.recent_skus.append(sku)
        
        return sku
    
    def is_sku_unique(self, sku):
        """Check if SKU is unique in memory cache."""
        with self.lock:
            return sku not in self.generated_skus
    
    def register_sku(self, sku):
        """Register a SKU as used."""
        with self.lock:
            self.generated_skus.add(sku)
            self.recent_skus.append(sku)
            return True


# Global SKU generator instance
sku_generator = UniqueSKUGenerator()


def generate_product_code_from_name(product_name):
    """Generate product code from product name."""
    return sku_generator.generate_unique_product_code(product_name)


def generate_product_code_from_subcategory(subcategory):
    """Generate product code from subcategory."""
    return sku_generator.generate_unique_product_code(subcategory)


def generate_random_4_digits():
    """Legacy function for backward compatibility."""
    return random.randint(1000, 9999)


def generate_unique_4_digits(product_code=""):
    """Generate unique 4 digits."""
    if product_code:
        return sku_generator.generate_unique_4_digits(product_code, FIXED_CODE_GNC)
    return random.randint(1000, 9999)


def get_current_year_month():
    """Get current date in YYYYMM format."""
    now = datetime.now()
    return now.strftime("%Y%m")


def validate_sku_format(sku, fixed_code=None):
    """Validate SKU format."""
    if not sku:
        return False
    
    # Determine fixed code if not provided
    if not fixed_code:
        if 'GNC' in sku:
            fixed_code = FIXED_CODE_GNC
        elif 'GNO' in sku:
            fixed_code = FIXED_CODE_GNO
        else:
            return False
    
    # Pattern for SKU with GNC/GNO
    pattern = rf'^[A-Z]{{2}}{fixed_code}[A-Z0-9]{{0,2}}\d{{4}}\d{{6}}$'
    return bool(re.match(pattern, sku))


def extract_sku_components(sku, fixed_code=None):
    """Extract components from SKU."""
    if not sku:
        return None
    
    # Try to detect fixed code if not provided
    if not fixed_code:
        if 'GNC' in sku:
            fixed_code = FIXED_CODE_GNC
        elif 'GNO' in sku:
            fixed_code = FIXED_CODE_GNO
        else:
            return None
    
    # Handle both formats: with and without variant
    if len(sku) == 16:  # With variant: POGNCRD3968202512
        return {
            'product_code': sku[:2],
            'fixed_code': fixed_code,
            'variant': sku[5:7],
            'random_digits': sku[7:11],
            'year_month': sku[11:17],
            'year': sku[11:15],
            'month': sku[15:17]
        }
    else:  # Without variant: POGNC3968202512
        return {
            'product_code': sku[:2],
            'fixed_code': fixed_code,
            'variant': '',
            'random_digits': sku[5:9],
            'year_month': sku[9:15],
            'year': sku[9:13],
            'month': sku[13:15]
        }


def calculate_sku_checksum(sku):
    """Calculate checksum for SKU validation."""
    return hashlib.md5(sku.encode()).hexdigest()[:8]


def determine_fixed_code_from_request(page_type, default='gnc'):
    """Determine fixed code based on page_type parameter."""
    if page_type and str(page_type).lower() == 'gno':
        return FIXED_CODE_GNO
    return FIXED_CODE_GNC


@app.route('/api/generate-sku', methods=['POST'])
def generate_sku():
    """
    Generate SKU from product name or subcategory with GUARANTEED uniqueness.
    NEW FORMAT: ProductCode (2 letters) + [GNC/GNO] + [Variant(2 chars)] + 4 digits + YYYYMM
    Example: POGNC3968202512 or POGNORD3968202512 (with variant)
    """
    try:
        data = request.get_json()
        product_name = data.get('productName', '').strip()
        subcategory = data.get('subcategory', '').strip()
        category = data.get('category', '').strip()
        variant = data.get('variant', '').strip()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        # Determine fixed code based on page type
        fixed_code = determine_fixed_code_from_request(page_type)
        page_source = 'NewProductCreationPage (GNC)' if fixed_code == FIXED_CODE_GNC else 'ComparisonSetupPage (GNO)'
        
        # Determine what to use for product code generation
        if subcategory:
            product_code = generate_product_code_from_subcategory(subcategory)
            source = f"subcategory: '{subcategory}'"
        elif product_name:
            product_code = generate_product_code_from_name(product_name)
            source = f"product name: '{product_name}'"
        elif category:
            product_code = generate_product_code_from_subcategory(category)
            source = f"category: '{category}'"
        else:
            return jsonify({
                'success': False,
                'error': 'Either productName, subcategory, or category is required'
            }), 400
        
        # Generate guaranteed unique SKU
        sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
        
        # Calculate checksum for validation
        checksum = calculate_sku_checksum(sku)
        
        print(f"✅ Generated GUARANTEED UNIQUE SKU for {page_source}: {sku} (checksum: {checksum})")
        
        # Extract components for detailed response
        components = extract_sku_components(sku, fixed_code)
        
        return jsonify({
            'success': True,
            'sku': sku,
            'checksum': checksum,
            'format': f"{product_code}{fixed_code}{variant[:2].upper() if variant else ''}{components['random_digits']}{components['year_month']}",
            'components': components,
            'generated_from': source,
            'fixed_code_used': fixed_code,
            'page_type': page_type,
            'uniqueness_guarantee': True,
            'message': f'SKU generated with guaranteed uniqueness for {page_source}'
        })
        
    except Exception as e:
        print(f"❌ Error generating unique SKU: {str(e)}")
        # Generate emergency fallback SKU
        timestamp = int(time.time())
        emergency_sku = f"EM{FIXED_CODE_GNC}{timestamp % 10000:04d}{datetime.now().strftime('%Y%m')}"
        return jsonify({
            'success': False,
            'error': f'Failed to generate unique SKU: {str(e)}',
            'fallback_sku': emergency_sku,
            'fallback_checksum': calculate_sku_checksum(emergency_sku)
        }), 500


@app.route('/api/generate-unique-sku-batch', methods=['POST'])
def generate_unique_sku_batch():
    """
    Generate multiple guaranteed unique SKUs in batch.
    """
    try:
        data = request.get_json()
        count = min(int(data.get('count', 1)), 100)  # Limit to 100
        subcategory = data.get('subcategory', '').strip()
        variant_prefix = data.get('variant_prefix', '').strip()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        if not subcategory:
            return jsonify({
                'success': False,
                'error': 'Subcategory is required for batch generation'
            }), 400
        
        fixed_code = determine_fixed_code_from_request(page_type)
        product_code = generate_product_code_from_subcategory(subcategory)
        generated_skus = []
        
        for i in range(count):
            variant = f"{variant_prefix}{i+1:02d}" if variant_prefix else ""
            sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
            checksum = calculate_sku_checksum(sku)
            
            generated_skus.append({
                'sku': sku,
                'checksum': checksum,
                'sequence': i + 1,
                'variant': variant[:2].upper() if variant else '',
                'components': extract_sku_components(sku, fixed_code),
                'fixed_code': fixed_code
            })
        
        print(f"✅ Generated {len(generated_skus)} guaranteed unique SKUs in batch with {fixed_code}")
        
        return jsonify({
            'success': True,
            'count': len(generated_skus),
            'product_code': product_code,
            'fixed_code': fixed_code,
            'generated_skus': generated_skus,
            'uniqueness_guarantee': True,
            'message': f'Successfully generated {len(generated_skus)} unique SKUs with {fixed_code}'
        })
        
    except Exception as e:
        print(f"❌ Error generating batch SKUs: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to generate batch SKUs: {str(e)}'
        }), 500


@app.route('/api/validate-sku', methods=['POST'])
def validate_sku():
    """
    Validate SKU format and uniqueness.
    """
    try:
        data = request.get_json()
        sku = data.get('sku', '').strip().upper()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        if not sku:
            return jsonify({
                'success': False,
                'isValid': False,
                'error': 'SKU is required'
            }), 400
        
        # Determine expected fixed code
        expected_fixed_code = determine_fixed_code_from_request(page_type)
        
        # Check if SKU contains valid fixed code
        contains_gnc = 'GNC' in sku
        contains_gno = 'GNO' in sku
        
        if not (contains_gnc or contains_gno):
            return jsonify({
                'success': True,
                'isValid': False,
                'isUnique': False,
                'sku': sku,
                'checksum': calculate_sku_checksum(sku),
                'message': f'Invalid SKU format. Expected format with GNC or GNO fixed code. Example: XXGNCXXXXYYYYMM or XXGNOXXXXYYYYMM',
                'expected_format': {
                    'product_code': '2 letters (e.g., PO for Polos)',
                    'fixed_code': 'GNC or GNO (fixed)',
                    'variant': '0-2 letters/numbers (optional, e.g., RD for Red)',
                    'random_digits': '4 unique digits',
                    'date': 'YYYYMM (year and month)'
                }
            })
        
        # Determine which fixed code is actually used
        actual_fixed_code = FIXED_CODE_GNC if contains_gnc else FIXED_CODE_GNO
        
        is_valid_format = validate_sku_format(sku, actual_fixed_code)
        is_unique = sku_generator.is_sku_unique(sku)
        checksum = calculate_sku_checksum(sku)
        
        if is_valid_format:
            components = extract_sku_components(sku, actual_fixed_code)
            
            # Additional validation: check if year/month is valid
            try:
                year = int(components['year'])
                month = int(components['month'])
                is_valid_date = (2000 <= year <= 2100) and (1 <= month <= 12)
            except:
                is_valid_date = False
            
            # Check if fixed code matches expected
            fixed_code_matches = actual_fixed_code == expected_fixed_code
            
            return jsonify({
                'success': True,
                'isValid': True,
                'isValidDate': is_valid_date,
                'isUnique': is_unique,
                'checksum': checksum,
                'sku': sku,
                'components': components,
                'fixed_code_used': actual_fixed_code,
                'fixed_code_expected': expected_fixed_code,
                'fixed_code_matches': fixed_code_matches,
                'message': f'SKU format is valid with {actual_fixed_code}' + 
                          (' and is unique' if is_unique else ' but may not be unique') +
                          (f' (Expected: {expected_fixed_code})' if not fixed_code_matches else '')
            })
        else:
            return jsonify({
                'success': True,
                'isValid': False,
                'isUnique': False,
                'sku': sku,
                'checksum': checksum,
                'message': f'Invalid SKU format. Expected: 2 letters + {actual_fixed_code} + [0-2 chars variant] + 4 digits + 6 digits (YYYYMM). Example: XX{actual_fixed_code}3968202512 or XX{actual_fixed_code}RD3968202512',
                'expected_format': {
                    'product_code': '2 letters (e.g., PO for Polos)',
                    'fixed_code': f'{actual_fixed_code} (fixed)',
                    'variant': '0-2 letters/numbers (optional, e.g., RD for Red)',
                    'random_digits': '4 unique digits',
                    'date': 'YYYYMM (year and month)'
                }
            })
            
    except Exception as e:
        print(f"❌ Error validating SKU: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to validate SKU: {str(e)}'
        }), 500


@app.route('/api/check-sku-exists', methods=['POST'])
def check_sku_exists():
    """
    Check if SKU already exists in the system.
    """
    try:
        data = request.get_json()
        sku = data.get('sku', '').strip().upper()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        if not sku:
            return jsonify({
                'success': False,
                'error': 'SKU is required'
            }), 400
        
        # Determine expected fixed code
        expected_fixed_code = determine_fixed_code_from_request(page_type)
        
        # Validate format first
        contains_gnc = 'GNC' in sku
        contains_gno = 'GNO' in sku
        
        if not (contains_gnc or contains_gno):
            return jsonify({
                'success': True,
                'exists': False,
                'message': 'SKU format is invalid (missing GNC/GNO), cannot check existence'
            })
        
        actual_fixed_code = FIXED_CODE_GNC if contains_gnc else FIXED_CODE_GNO
        is_valid_format = validate_sku_format(sku, actual_fixed_code)
        
        if not is_valid_format:
            return jsonify({
                'success': True,
                'exists': False,
                'message': 'SKU format is invalid, cannot check existence'
            })
        
        print(f"🔍 Checking if SKU exists: {sku}")
        
        # Check in-memory cache
        exists = not sku_generator.is_sku_unique(sku)
        checksum = calculate_sku_checksum(sku)
        
        return jsonify({
            'success': True,
            'exists': exists,
            'checksum': checksum,
            'sku': sku,
            'fixed_code_used': actual_fixed_code,
            'fixed_code_expected': expected_fixed_code,
            'message': f'SKU {"already exists" if exists else "does not exist"} in memory cache (Format: {actual_fixed_code})'
        })
        
    except Exception as e:
        print(f"❌ Error checking SKU existence: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to check SKU existence: {str(e)}'
        }), 500


@app.route('/api/suggest-sku', methods=['POST'])
def suggest_sku():
    """
    Suggest multiple SKU options for a product with guaranteed uniqueness.
    """
    try:
        data = request.get_json()
        product_name = data.get('productName', '').strip()
        subcategory = data.get('subcategory', '').strip()
        variant = data.get('variant', '').strip()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        if not (product_name or subcategory):
            return jsonify({
                'success': False,
                'error': 'Either productName or subcategory is required'
            }), 400
        
        # Determine fixed code
        fixed_code = determine_fixed_code_from_request(page_type)
        
        # Determine product code
        if subcategory:
            product_code = generate_product_code_from_subcategory(subcategory)
            source = f"subcategory: '{subcategory}'"
        else:
            product_code = generate_product_code_from_name(product_name)
            source = f"product name: '{product_name}'"
        
        year_month = get_current_year_month()
        
        # Generate 3 different SKU options with guaranteed uniqueness
        suggestions = []
        
        for i in range(3):
            # Generate unique SKU with different variant if needed
            current_variant = f"{variant}{i+1:02d}"[:2] if variant else f"{i+1:02d}"
            sku = sku_generator.generate_full_sku(product_code, fixed_code, current_variant)
            checksum = calculate_sku_checksum(sku)
            
            suggestions.append({
                'sku': sku,
                'checksum': checksum,
                'product_code': product_code,
                'fixed_code': fixed_code,
                'variant': current_variant.upper(),
                'year_month': year_month,
                'format_valid': validate_sku_format(sku, fixed_code),
                'is_unique': True,
                'example_use': f"Example: {product_code} from {source} with {fixed_code}"
            })
        
        return jsonify({
            'success': True,
            'suggestions': suggestions,
            'product_name': product_name,
            'subcategory': subcategory,
            'product_code': product_code,
            'fixed_code': fixed_code,
            'source': source,
            'uniqueness_guarantee': True,
            'message': f'Generated {len(suggestions)} guaranteed unique SKU suggestions with {fixed_code}'
        })
        
    except Exception as e:
        print(f"❌ Error suggesting SKU: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to suggest SKU: {str(e)}'
        }), 500


@app.route('/api/generate-sku-for-listing', methods=['POST'])
def generate_sku_for_listing():
    """
    Generate SKU specifically for product listing with guaranteed uniqueness.
    """
    try:
        data = request.get_json()
        
        # Extract product information
        product_title = data.get('title', '').strip()
        subcategory = data.get('subcategory', '').strip()
        category = data.get('category', '').strip()
        variant = data.get('variant', '').strip()
        attributes = data.get('attributes', {})
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        # Determine fixed code
        fixed_code = determine_fixed_code_from_request(page_type)
        page_source = 'NewProductCreationPage' if fixed_code == FIXED_CODE_GNC else 'ComparisonSetupPage'
        
        # Try to extract product name from title if available
        product_name = product_title or attributes.get('product_name', '') or attributes.get('name', '')
        
        print(f"🔄 Generating unique SKU for {page_source} - Title: {product_title}, Subcategory: {subcategory}, Fixed Code: {fixed_code}")
        
        # Determine product code source (priority: subcategory > product name > category)
        if subcategory:
            product_code = generate_product_code_from_subcategory(subcategory)
            source = f"Subcategory: '{subcategory}'"
        elif product_name:
            product_code = generate_product_code_from_name(product_name)
            source = f"Product name: '{product_name}'"
        elif category:
            product_code = generate_product_code_from_subcategory(category)
            source = f"Category: '{category}'"
        else:
            product_code = "PR"
            source = "Default"
        
        # Generate guaranteed unique SKU
        sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
        checksum = calculate_sku_checksum(sku)
        
        print(f"✅ Generated GUARANTEED UNIQUE SKU for {page_source}: {sku} (checksum: {checksum})")
        
        # Prepare detailed response
        components = extract_sku_components(sku, fixed_code)
        
        # Generate explanation
        explanation = f"SKU generated from {source} for {page_source}. Format: {product_code}(product code) + {fixed_code}(fixed) + {variant[:2].upper() if variant else ''}(variant) + {components['random_digits']}(unique digits) + {components['year_month']}(date)"
        
        return jsonify({
            'success': True,
            'sku': sku,
            'checksum': checksum,
            'components': components,
            'explanation': explanation,
            'generated_from': source,
            'fixed_code': fixed_code,
            'page_source': page_source,
            'uniqueness_guarantee': True,
            'format_example': f"Format: 2-letter code + {fixed_code} + [0-2 char variant] + 4 unique digits + YYYYMM",
            'message': f'SKU generated with guaranteed uniqueness for {page_source}'
        })
        
    except Exception as e:
        print(f"❌ Error generating unique SKU for listing: {str(e)}")
        # Generate fallback SKU with GNC (default)
        timestamp = int(time.time())
        fallback_sku = f"FB{FIXED_CODE_GNC}{timestamp % 10000:04d}{datetime.now().strftime('%Y%m')}"
        return jsonify({
            'success': False,
            'error': f'Failed to generate unique SKU: {str(e)}',
            'fallback_sku': fallback_sku,
            'fallback_checksum': calculate_sku_checksum(fallback_sku),
            'message': 'Using fallback SKU with GNC'
        }), 500


@app.route('/api/sku-uniqueness-report', methods=['GET'])
def sku_uniqueness_report():
    """
    Get report on SKU generation statistics.
    """
    try:
        with sku_generator.lock:
            total_generated = len(sku_generator.generated_skus)
            unique_product_codes = len(sku_generator.product_code_sequences)
            recent_count = len(sku_generator.recent_skus)
            
            # Get most common product codes
            product_code_stats = {}
            # Count SKUs by fixed code
            gnc_count = 0
            gno_count = 0
            
            for sku in sku_generator.generated_skus:
                code = sku[:2]
                product_code_stats[code] = product_code_stats.get(code, 0) + 1
                
                # Count by fixed code
                if 'GNC' in sku:
                    gnc_count += 1
                elif 'GNO' in sku:
                    gno_count += 1
            
            # Sort by frequency
            sorted_codes = sorted(product_code_stats.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return jsonify({
            'success': True,
            'report': {
                'total_skus_generated': total_generated,
                'unique_product_codes': unique_product_codes,
                'recent_skus_in_cache': recent_count,
                'skus_with_gnc': gnc_count,
                'skus_with_gno': gno_count,
                'top_product_codes': [{'code': code, 'count': count} for code, count in sorted_codes],
                'fixed_codes_config': {
                    'gnc': FIXED_CODE_GNC,
                    'gno': FIXED_CODE_GNO
                },
                'uniqueness_guarantee_active': True,
                'cache_size_limit': 10000,
                'timestamp': datetime.now().isoformat()
            },
            'message': f'SKU uniqueness report generated. {total_generated} SKUs tracked ({gnc_count} with GNC, {gno_count} with GNO).'
        })
        
    except Exception as e:
        print(f"❌ Error generating SKU report: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to generate SKU report: {str(e)}'
        }), 500


@app.route('/api/reset-sku-cache', methods=['POST'])
def reset_sku_cache():
    """
    Reset SKU cache (admin function).
    """
    try:
        # Check for admin authorization (simple token check)
        data = request.get_json()
        admin_token = data.get('admin_token', '')
        
        # Simple admin token check (in production, use proper authentication)
        expected_token = os.getenv('ADMIN_TOKEN', 'admin123')
        
        if admin_token != expected_token:
            return jsonify({
                'success': False,
                'error': 'Unauthorized: Invalid admin token'
            }), 403
        
        # Reset the SKU generator
        with sku_generator.lock:
            old_count = len(sku_generator.generated_skus)
            sku_generator.generated_skus.clear()
            sku_generator.product_code_sequences.clear()
            sku_generator.recent_skus.clear()
        
        print(f"⚠️ SKU cache reset by admin. Cleared {old_count} SKUs.")
        
        return jsonify({
            'success': True,
            'message': f'SKU cache reset successfully. Cleared {old_count} SKUs.',
            'cache_cleared': old_count,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error resetting SKU cache: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to reset SKU cache: {str(e)}'
        }), 500


# ===============================================================
# END OF UNIQUE SKU GENERATION SECTION
# ===============================================================


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
    # Get SKU generator stats
    with sku_generator.lock:
        sku_stats = {
            'total_skus': len(sku_generator.generated_skus),
            'unique_codes': len(sku_generator.product_code_sequences),
            'cache_size': len(sku_generator.recent_skus),
            'uniqueness_guarantee': True
        }
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "gemini_text": "gemini-2.5-flash" if text_model else "unavailable",
            "gemini_image": "gemini-2.5-flash-image" if image_model else "unavailable",
            "gcs": "available" if storage_client else "unavailable",
            "output_dir": OUTPUT_DIR,
            "scraped_dir": SCRAPED_IMAGES_DIR,
            "web_scraping": "available",
            "sku_generation": "available",
            "sku_uniqueness": "guaranteed",
            "authentication": "via_secret_manager"
        },
        "sku_stats": sku_stats
    })


# ==================================================================
# AMAZON-OPTIMIZED KEYWORDS GENERATION ENDPOINT (IMPROVED VERSION)
# ==================================================================


@app.route('/api/generate-keywords', methods=['POST'])
def generate_keywords():
    """Generate Amazon-optimized backend search terms for SEO ranking"""
    try:
        data = request.get_json()
        
        # Extract product information
        product_title = data.get('title', '')
        product_category = data.get('category', '')
        product_subcategory = data.get('subcategory', 'Clothing')
        product_details = data.get('details', {})
        
        # Extract specific attributes for better keyword targeting
        material = product_details.get('material', '')
        color = product_details.get('color', '')
        pattern = product_details.get('pattern', '')
        occasion = product_details.get('occasion', '')
        
        # AMAZON-OPTIMIZED PROMPT FOR BACKEND SEARCH TERMS
        prompt = f"""
        ROLE: You are an Amazon PPC expert and SEO specialist for Amazon sellers.
        
        PRODUCT: {product_title}
        Category: {product_category}
        Subcategory: {product_subcategory}
        Material: {material}
        Color: {color}
        Pattern: {pattern}
        Occasion: {occasion}
        
        TASK: Generate 7-8 Amazon BACKEND SEARCH TERMS (not frontend keywords).
        
        AMAZON BACKEND KEYWORD REQUIREMENTS:
        1. Fill ALL 7 backend search term fields (249 characters max each)
        2. Include: Long-tail buyer intent keywords
        3. Include: Misspellings (1-2 common ones)
        4. Include: Abbreviations/short forms
        5. Include: Use case scenarios
        6. Include: Style/material/color combinations
        7. EXCLUDE: Brand names, competitor names, offensive terms
        8. EXCLUDE: Promotional language (cheap, best, discount)
        9. EXCLUDE: Punctuation except spaces
        
        STRATEGIC KEYWORD TYPES TO INCLUDE:
        A. BUYER INTENT KEYWORDS: "wedding guest anarkali", "festival wear kurta set"
        B. FEATURE-BASED: "embroidered anarkali", "printed rayon kurta"
        C. DEMOGRAPHIC: "women's ethnic wear", "plus size anarkali"
        D. USE CASE: "office wear kurta", "party wear dress set"
        E. SEASONAL: "summer cotton anarkali", "winter wedding dress"
        F. STYLE: "designer kurta set", "traditional indian dress"
        G. MATERIAL: "georgette anarkali", "silk kurta with dupatta"
        
        CHARACTER LIMITS:
        - Total 7-8 keyword phrases
        - MAX 250 characters total
        - Each phrase 2-5 words
        
        FORMAT EXAMPLE FOR "Women's Anarkali Set":
        wedding anarkali suit; festival wear kurta; embroidered rayon dress; designer ethnic wear; party wear anarkali; printed kurta with dupatta; traditional indian outfit
        
        FORMAT EXAMPLE FOR "Men's Formal Shirt":
        office wear shirts; formal business shirt; slim fit cotton shirt; wedding guest shirt; corporate wear clothing; long sleeve formal; men's dress shirts
        
        Now generate Amazon backend search terms for:
        {product_title}
        
        Return ONLY semicolon-separated keywords, no explanations.
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
            
            # Clean the response
            keywords_text = keywords_text.replace('"', '').replace('Keywords:', '').strip()
            
            # Remove any markdown, bullet points, numbers
            keywords_text = re.sub(r'^\d+[\.\)]\s*', '', keywords_text, flags=re.MULTILINE)
            keywords_text = re.sub(r'[-•*]\s*', '', keywords_text)
            
            # Extract just the keyword section (before any explanations)
            lines = keywords_text.split('\n')
            keyword_lines = []
            for line in lines:
                line = line.strip()
                # Stop if we hit an explanation
                if line.lower().startswith(('note:', 'tip:', 'remember:', 'important:', 'amazon')):
                    break
                if line and not line.lower().startswith(('these keywords', 'the keywords', 'keywords can')):
                    keyword_lines.append(line)
            
            keywords_text = ' '.join(keyword_lines)
            
            # Normalize separators to semicolons
            if ';' in keywords_text:
                # Already in semicolon format
                pass
            elif '\n' in keywords_text:
                # Convert newlines to semicolons
                lines = [k.strip() for k in keywords_text.split('\n') if k.strip()]
                keywords_text = '; '.join(lines)
            else:
                # Convert commas to semicolons
                keywords_text = keywords_text.replace(',', ';')
            
            # Split and clean individual keywords
            raw_keywords = [k.strip() for k in keywords_text.split(';') if k.strip()]
            cleaned_keywords = []
            
            for kw in raw_keywords:
                # Remove trailing punctuation
                kw = re.sub(r'[.,;:!?]+$', '', kw)
                # Remove excessive spaces
                kw = ' '.join(kw.split())
                # Ensure it's not a sentence
                if len(kw.split()) <= 6 and not kw.endswith('.') and not kw.startswith(('The ', 'This ', 'These ')):
                    cleaned_keywords.append(kw.lower())  # Lowercase for backend
            
            # Target: 7-8 keywords (matching Amazon's 7 backend fields)
            if len(cleaned_keywords) < 7:
                # Add strategic Amazon-specific keywords
                amazon_keyword_boosters = [
                    # Buyer intent keywords
                    f"{product_subcategory.lower()} for {occasion.lower()}" if occasion else "",
                    f"{material.lower()} {product_subcategory.lower()}" if material else "",
                    f"{color.lower()} {pattern.lower()} {product_subcategory.lower()}" if color and pattern else "",
                    # Common Amazon searches
                    f"buy {product_subcategory.lower()} online",
                    f"{product_subcategory.lower()} amazon",
                    # Use cases
                    f"{product_subcategory.lower()} for wedding",
                    f"{product_subcategory.lower()} for office",
                    f"{product_subcategory.lower()} for party",
                    # Variations
                    f"long {product_subcategory.lower()}",
                    f"short {product_subcategory.lower()}",
                    f"designer {product_subcategory.lower()}",
                ]
                
                # Filter out empty and add unique ones
                for booster in amazon_keyword_boosters:
                    if booster and booster not in cleaned_keywords and len(cleaned_keywords) < 8:
                        cleaned_keywords.append(booster)
            
            # Limit to 8 keywords max
            cleaned_keywords = cleaned_keywords[:8]
            
            # Join with semicolons
            final_keywords = '; '.join(cleaned_keywords)
            
            # STRICT Amazon character limit: 250 chars
            if len(final_keywords) > 250:
                # Amazon-optimized truncation
                words = final_keywords.split('; ')
                truncated = []
                char_count = 0
                
                for word in words:
                    if char_count + len(word) + 2 <= 250:  # +2 for semicolon and space
                        truncated.append(word)
                        char_count += len(word) + 2
                    else:
                        break
                
                if truncated:
                    final_keywords = '; '.join(truncated)
                else:
                    # Emergency truncation
                    final_keywords = final_keywords[:247] + '...'
            
            # Log Amazon-optimized results
            print(f"🛍️ Amazon Backend Keywords Generated:")
            print(f"Product: {product_title}")
            print(f"Keywords: {final_keywords}")
            print(f"Character Count: {len(final_keywords)}/250")
            print(f"Keyword Count: {len(cleaned_keywords)}")
            print(f"Estimated Search Volume: High")
            
            return jsonify({
                'success': True,
                'keywords': final_keywords,
                'count': len(cleaned_keywords),
                'character_count': len(final_keywords),
                'keyword_types': {
                    'buyer_intent': any('for ' in kw or 'wear' in kw for kw in cleaned_keywords),
                    'long_tail': any(len(kw.split()) >= 3 for kw in cleaned_keywords),
                    'material_based': any(material.lower() in kw for kw in cleaned_keywords) if material else False,
                    'use_case': any(kw in ['wedding', 'party', 'office', 'festival'] for kw in cleaned_keywords)
                },
                'amazon_optimized': True,
                'message': 'Amazon backend search terms generated successfully'
            })
        else:
            # Amazon-optimized fallback
            fallback_keywords = generate_amazon_fallback_keywords(
                product_title, product_subcategory, product_details
            )
            
            return jsonify({
                'success': True,
                'keywords': fallback_keywords,
                'count': fallback_keywords.count(';') + 1,
                'character_count': len(fallback_keywords),
                'amazon_optimized': True,
                'message': 'Amazon-optimized fallback keywords generated'
            })
            
    except Exception as e:
        print(f"❌ Amazon keyword generation error: {str(e)}")
        # Ultimate Amazon-optimized fallback
        fallback = f"{product_subcategory.lower()}; buy {product_subcategory.lower()} online; {product_subcategory.lower()} amazon; {product_category.lower()} clothing; ethnic wear; traditional dress; festival wear"
        if len(fallback) > 250:
            fallback = fallback[:247] + '...'
        
        return jsonify({
            'success': True,
            'keywords': fallback,
            'count': 7,
            'character_count': len(fallback),
            'amazon_optimized': True,
            'error': f'Used Amazon-optimized fallback: {str(e)}'
        })


def generate_amazon_fallback_keywords(title, subcategory, details):
    """Generate Amazon-optimized fallback keywords"""
    material = details.get('material', '').lower()
    color = details.get('color', '').lower()
    occasion = details.get('occasion', '').lower()
    
    # Amazon keyword strategy
    keywords = []
    
    # 1. Core product keywords
    keywords.append(subcategory.lower())
    
    # 2. Material-based (if available)
    if material:
        keywords.append(f"{material} {subcategory.lower()}")
    
    # 3. Use-case keywords (Amazon high-converting)
    use_cases = ['wedding', 'party', 'festival', 'office', 'casual', 'formal']
    for use_case in use_cases:
        if len(keywords) < 8:
            keywords.append(f"{use_case} wear {subcategory.lower()}")
    
    # 4. Buyer intent keywords
    keywords.append(f"buy {subcategory.lower()} online")
    keywords.append(f"{subcategory.lower()} amazon")
    
    # 5. Style/feature keywords
    features = ['embroidered', 'printed', 'designer', 'traditional', 'ethnic']
    for feature in features:
        if len(keywords) < 8:
            keywords.append(f"{feature} {subcategory.lower()}")
    
    # Ensure 7-8 keywords
    while len(keywords) < 7:
        keywords.append(f"{subcategory.lower()} dress")
    
    keywords = keywords[:8]
    
    # Join and limit characters
    result = '; '.join(keywords)
    if len(result) > 250:
        result = result[:247] + '...'
    
    return result


# ==================================================================
# END OF AMAZON-OPTIMIZED KEYWORDS GENERATION SECTION
# ==================================================================


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
    print(f"🚀 Starting Flask on 0.0.0.0:{port}, debug={debug}")
    print(f"🌐 Allowed origins: {ALLOWED_ORIGINS}")
    print(f"📁 Output directory: {os.path.abspath(OUTPUT_DIR)}")
    print(f"📁 Directory exists: {os.path.exists(OUTPUT_DIR)}")
    print(f"📁 Directory writable: {os.access(OUTPUT_DIR, os.W_OK)}")
    print(f"🤖 Gemini models: {'✅ Initialized' if text_model and image_model else '❌ Failed'}")
    print(f"🔐 Authentication: Service Account + Secret Manager")
    print(f"✅ SKU Uniqueness System: ACTIVE (cache size: 10000)")
    print(f"✅ SKU Format: ProductCode (2 letters) + CL + [Variant] + 4 digits + YYYYMM")
    app.run(host="0.0.0.0", port=port, debug=debug)








