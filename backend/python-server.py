from dotenv import load_dotenv
load_dotenv()

import os
import io
import uuid
from datetime import datetime
import json
import re
import subprocess
import sys
from flask import Flask, request, jsonify, send_from_directory, send_file


import gspread
from google.oauth2.service_account import Credentials

def connect_to_sheet():
    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        creds = Credentials.from_service_account_file("service_account.json", scopes=scopes)
        client = gspread.authorize(creds)
        sheet = client.open("UserCredentials").worksheet("Data")
        print("✅ Connected to Google Sheet: UserCredentials → Data")
        return sheet
    except Exception as e:
        print(f"❌ Error connecting to Google Sheets: {e}")
        return None  # Return None instead of raising


import uuid
import smtplib
from email.mime.text import MIMEText
from threading import Thread
import time
import requests

def send_reset_email(email, token):
    """
    Sends reset email using Google Apps Script Web App.
    """
    try:
        apps_script_url = "https://script.google.com/macros/s/AKfycbwILFRXaL-mo7Gr7IH5HujSkN3vxYytYr_4097xh26C4EsoK-nYHFThaHKx3T5oZmjk/exec"
        payload = {"email": email, "token": token}

        response = requests.post(apps_script_url, json=payload)
        response.raise_for_status()

        result = response.json()
        if result.get("success"):
            print(f"✅ Reset email sent successfully to {email}")
        else:
            print(f"⚠️ Apps Script responded with error: {result.get('error')}")
    except Exception as e:
        print(f"❌ Error sending reset email via Apps Script: {e}")


from flask_cors import CORS
from PIL import Image
import google.generativeai as genai
from google.cloud import storage
from google.generativeai import types
from google.cloud.exceptions import Forbidden


app = Flask(__name__)

# ✅ Enable CORS properly for your frontend
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)


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
   print(f"âœ“ Gemini Text model initialized: {TEXT_MODEL_ID}")
except Exception as e:
   print(f"âœ— Text model initialization error: {e}")
   raise


try:
   # Image model for image generation
   image_model = genai.GenerativeModel(IMAGE_MODEL_ID)
   print(f"âœ“ Gemini Image model initialized: {IMAGE_MODEL_ID}")
except Exception as e:
   print(f"âœ— Image model initialization error: {e}")
   raise


OUTPUT_DIR = "generated_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# --- GOOGLE CLOUD STORAGE CONFIG ---


GCS_BUCKET_NAME = "amz-image-stores"


try:
   storage_client = storage.Client()
   print("âœ“ Google Cloud Storage client initialized.")
except Exception as e:
   print(f"âœ— GCS client initialization error: {e}")
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
       print(f"âœ“ Uploaded to GCS. Public URL: {gcs_public_url}")
       return gcs_public_url
   except Forbidden:
       error_message = f"GCS Permission Denied (403): Ensure ADC user has 'Storage Admin' role for bucket '{GCS_BUCKET_NAME}'."
       print(f"âœ— GCS upload failed: {error_message}")
       raise Exception(error_message)
   except Exception as e:
       error_message = f"GCS Upload Failed: {type(e).__name__} - {str(e)}"
       print(f"âœ— GCS upload failed: {error_message}")
       raise Exception(error_message)


# ===============================================================
# NANO BAANA - PROMPT FUNCTIONS FOR IMAGE GENERATION (Final Version with Reference Rules)
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
    return(
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
        headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        headers['Access-Control-Allow-Credentials'] = 'true'
        return resp


# Fallback user data when Google Sheets is not available
FALLBACK_USERS = {
    "admin@listro.com": {"password": "admin123", "first_time": False},
    "test@listro.com": {"password": "test@listro.com", "first_time": True},  # First time user
    "demo@listro.com": {"password": "demo123", "first_time": False}
}

# --- AUTHENTICATION ENDPOINTS ---

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({"success": False, "error": "Email and password are required"}), 400

        # Try to connect to Google Sheets first
        sheet = connect_to_sheet()
        
        if sheet is not None:
            # Google Sheets is available - use it
            try:
                records = sheet.get_all_records()
                print(f"🔍 Google Sheets records found: {len(records)}")
                print(f"🔍 Looking for email: {email}")
                
                # Debug: Print first few records (without passwords for security)
                for i, record in enumerate(records[:3]):
                    debug_record = {k: v if k != 'password' else '***' for k, v in record.items()}
                    print(f"🔍 Record {i}: {debug_record}")

                # Find user by email (handle both lowercase and capitalized column names)
                user_record = None
                for record in records:
                    # Try both 'email'/'Email' and handle different casing
                    record_email = record.get("email", record.get("Email", "")).strip().lower()
                    if record_email == email:
                        user_record = record
                        print(f"✅ Found user record for {email}")
                        break

                if not user_record:
                    print(f"❌ No user found for email: {email}")
                    return jsonify({"success": False, "error": "Invalid email or password"}), 401

                # Check if password matches (handle both lowercase and capitalized column names)
                stored_password = str(user_record.get("password", user_record.get("Password", ""))).strip()
                print(f"🔍 Stored password: {stored_password}, Input password: {password}")
                
                if password != stored_password:
                    return jsonify({"success": False, "error": "Invalid email or password"}), 401

                # Check if it's first time login - check FirstLogin column or if password equals email
                first_login_flag = user_record.get("FirstLogin", user_record.get("firstLogin", "")).strip().lower()
                first_time = first_login_flag == "yes" or stored_password == email

                return jsonify({
                    "success": True, 
                    "message": "Login successful",
                    "first_time": first_time,
                    "email": email
                })
            except Exception as sheets_error:
                print(f"❌ Google Sheets error, falling back to local auth: {sheets_error}")
                # Fall through to fallback authentication
        
        # Fallback authentication when Google Sheets is not available
        print("🔄 Using fallback authentication system")
        
        if email not in FALLBACK_USERS:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        
        user_data = FALLBACK_USERS[email]
        if password != user_data["password"]:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        
        return jsonify({
            "success": True, 
            "message": "Login successful (fallback mode)",
            "first_time": user_data["first_time"],
            "email": email
        })

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
   if "image" not in request.files:
       return jsonify({"error": "No image uploaded"}), 400


   file = request.files["image"]
   img_stream = io.BytesIO(file.read())
   img_stream.seek(0)
   try:
       uploaded_image = Image.open(img_stream).convert("RGB")
   except Exception as e:
       return jsonify({"error": f"Invalid image file: {str(e)}"}), 400


   try:
       style_index = int(request.form.get("style_index", -1))
   except ValueError:
       return jsonify({"error": "Invalid style_index"}), 400


   if not (0 <= style_index < len(PROMPT_FUNCTIONS)):
       return jsonify({"error": "style_index out of range"}), 400


   attributes_str = request.form.get("attributes", "{}")
   try:
       attributes = json.loads(attributes_str)
   except json.JSONDecodeError:
       return jsonify({"error": "Invalid attributes JSON"}), 400


   prompt_template = PROMPT_FUNCTIONS[style_index]()
   final_prompt = replace_placeholders(prompt_template, attributes)


   try:
       full_prompt = (
           "Transform this photo photorealistically for premium e-commerce quality. "
           f"Instructions: {final_prompt} Avoid distortion, blur, watermarks, or cropping."
       )


       response = image_model.generate_content(
           [uploaded_image, full_prompt],
           generation_config=genai.types.GenerationConfig(
               temperature=0.6, top_p=0.9, top_k=40
           ),
       )


       found_image = False
       for part in response.candidates[0].content.parts:
           if hasattr(part, "inline_data") and part.inline_data and part.inline_data.mime_type.startswith("image/"):
               image_bytes = part.inline_data.data
               img = Image.open(io.BytesIO(image_bytes))
               unique_filename = f"generated_{uuid.uuid4().hex}.jpg"
               local_path = os.path.join(OUTPUT_DIR, unique_filename)
               img.save(local_path, format='JPEG', quality=95, optimize=True)


               gcs_url = None
               try:
                   if storage_client:
                       gcs_blob_name = f"generated/{unique_filename}"
                       gcs_url = upload_to_gcs(local_path, gcs_blob_name)
                   else:
                       print("âš  GCS client not available, skipping upload")
               except Exception as gcs_error:
                   print(f"âš  GCS upload failed: {gcs_error}")


               preview_url = request.host_url.rstrip('/') + '/generated_images/' + unique_filename


               found_image = True
               return jsonify({
                   "success": True,
                   "filename": unique_filename,
                   "gcs_url": gcs_url,
                   "preview_url": preview_url,
                   "file_size": os.path.getsize(local_path),
                   "image_size": f"{img.width}x{img.height}",
                   "style_index": style_index
               }), 200


       if not found_image:
           return jsonify({"error": "No image returned from model."}), 500
   except Exception as e:
       import traceback
       print(traceback.format_exc())
       return jsonify({"error": f"Generation/Upload failed: {str(e)}"}), 500


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
    if task_type == 'name':
        instruction = "TASK: Write exactly one labeled line: Product Name: [title here]"
    else:
        instruction = "TASK: Write exactly one labeled line: Product Description: [description here]"
    return f"""
You are an expert Amazon e-commerce copywriter specializing in Clothing.
Generate a {'product title' if task_type == 'name' else 'product description'} based on the provided details.
{instruction}

Available Product Information:
Subcategory: {subcategory}
{product_details if product_details else 'No additional details provided'}

IMPORTANT:
- For title: Generate around 150 characters (Max 200 characters), include key features, benefits, and target audience
- For description:  Generate around 1600 characters (Max 2000 characters), focus on material, fit, benefits, care instructions, and usage scenarios
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
Product Name: Generic Brand Premium Cotton T-Shirt | Comfortable Everyday Casual Wear | Breathable Fabric for Men & Women | Ideal for Workouts, Lounge, and Outdoor Activities | Available in Multiple Colors and Sizes | Soft, Durable, and Machine Washable

Output for description:
Product Description: Crafted from 100% pure cotton, this apparel piece is suitable for routine wear across a variety of everyday settings. The fabric is naturally soft to the touch and allows consistent airflow, making it appropriate for use in both warm and mild conditions. The cotton construction supports breathability during extended periods of use while maintaining a comfortable feel against the skin.

The design follows a regular fit profile, providing sufficient room for movement without appearing oversized or restrictive. Attention has been given to the structure and finish to support shape retention when proper care guidelines are followed. The fabric weight is selected to allow flexible use, whether worn independently or combined with additional layers such as outerwear or lightweight jackets.

Its understated styling allows for simple coordination with different wardrobe components, including denim, casual bottoms, or seasonal layers. The overall form is intended for versatility, allowing use across leisure settings, light physical tasks, or home environments. The neckline and sleeves are finished to offer stability during repeated use while maintaining a consistent structure over time.

Care requirements include routine machine washing under standard conditions. Cleaning with similar colors and drying according to label instructions is recommended. Size availability covers a broad range to support varied body proportions. Designed for functional daily wear, this item offers a balanced blend of material quality, structure, and wearability intended for long-term use.


Subcategory: {subcategory}
Details: {product_details if product_details else 'Basic clothing item'}
"""

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
    raw_output = call_gemini(prompt, 4000)  # Increased token limit for longer titles
    label = "Product Name:"
    if raw_output.startswith(label):
        return raw_output[len(label):].strip()
    return raw_output

def generate_product_description(subcategory, product_details):
    prompt = create_base_prompt(subcategory, product_details, 'description')
    raw_output = call_gemini(prompt, 4000)  # Increased token limit for longer descriptions
    label = "Product Description:"
    if raw_output.startswith(label):
        return raw_output[len(label):].strip()
    return raw_output

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
                    product_details_lines.append(f"{k}: {cleaned_v}")

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
                    minimal_details.append(f"{k}: {v}")

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
            return jsonify({'success': True, 'generated_title': generated_title})

        elif task_type == 'description':
            generated_description = generate_product_description(subcategory, product_details)
            if generated_description.startswith("Generation Failed:"):
                return jsonify({'success': False, 'error': generated_description}), 500
            return jsonify({'success': True, 'generated_description': generated_description})

        else:
            return jsonify({'success': False, 'error': 'Unknown type specified'}), 400

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)