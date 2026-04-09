import os
import io
import uuid
import base64
import json
from flask import Blueprint, request, jsonify, send_file
from PIL import Image
from services.ai_service import (
    image_model, 
    OUTPUT_DIR, 
    PROMPT_FUNCTIONS, 
    replace_placeholders, 
    upload_to_gcs
)
import google.generativeai as genai

# Try to import specialized generators
try:
    from hk_image_generator import generate_homekitchen_image, create_genai_client as hk_create_genai_client
except ImportError:
    generate_homekitchen_image = None
    hk_create_genai_client = None

try:
    from grocery_image_generator import generate_grocery_image, create_genai_client as grocery_create_genai_client
except ImportError:
    generate_grocery_image = None
    grocery_create_genai_client = None

image_bp = Blueprint('image', __name__)

@image_bp.route("/debug-images")
def debug_images():
    """Debug endpoint to list generated images info"""
    try:
        if not os.path.exists(OUTPUT_DIR):
            return jsonify({"output_dir": OUTPUT_DIR, "exists": False, "files": []})
            
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

@image_bp.route("/test-gemini-image", methods=["POST"])
def test_gemini_image():
    """Test endpoint to check if Gemini can process images"""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        if image_model is None:
            return jsonify({"error": "Image model not initialized"}), 503

        file = request.files["image"]
        img_stream = io.BytesIO(file.read())
        img_stream.seek(0)
        uploaded_image = Image.open(img_stream).convert("RGB")

        # Very simple test prompt
        test_prompt = "Create a simple product photo with white background"

        print("🧪 Testing basic Gemini image processing...")
        response = image_model.generate_content([uploaded_image, test_prompt])

        test_result = {
            "has_response": True,
            "response_type": type(response).__name__,
            "has_text": hasattr(response, 'text'),
            "text_length": len(response.text) if hasattr(response, 'text') and response.text else 0,
            "image_found": any(hasattr(part, 'inline_data') and part.inline_data for part in getattr(response, 'parts', []))
        }

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
            "message": "Gemini test failed"
        }), 500

@image_bp.route("/generate-image", methods=["POST"])
def generate_image():
    """Main image generation endpoint with multi-category support."""
    try:
        if "image" not in request.files:
            return jsonify({"success": False, "error": "No image uploaded"}), 400

        file = request.files["image"]
        img_stream = io.BytesIO(file.read())
        img_stream.seek(0)

        try:
            uploaded_image = Image.open(img_stream).convert("RGB")
            # Resize for API efficiency
            uploaded_image.thumbnail((1536, 1536), Image.LANCZOS)
        except Exception as e:
            return jsonify({"success": False, "error": f"Invalid image: {str(e)}"}), 400

        # Parse inputs
        try:
            style_index = int(request.form.get("style_index", -1))
            attributes = json.loads(request.form.get("attributes", "{}"))
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Invalid form data"}), 400

        if not (0 <= style_index < len(PROMPT_FUNCTIONS)):
            return jsonify({"success": False, "error": "style_index out of range"}), 400

        prompt_template = PROMPT_FUNCTIONS[style_index]()
        final_prompt = replace_placeholders(prompt_template, attributes)
        
        # Category-specific routing
        category = (attributes.get('Category') or attributes.get('category') or "").lower()
        
        # Home & Kitchen logic
        if 'home' in category and 'kitchen' in category and generate_homekitchen_image:
            if style_index >= 2:
                return jsonify({"success": False, "error": "Style not supported for H&K"}), 400
            
            img_stream.seek(0)
            image_bytes = img_stream.getvalue()
            hk_model = hk_create_genai_client()
            
            mime, b64 = generate_homekitchen_image(
                model=hk_model, prompt=final_prompt, ref_images=[],
                ref_image_bytes=[(image_bytes, 'image/jpeg')],
                target_size=(1117, 1400), index=style_index, attributes=attributes
            )
            image_data = base64.b64decode(b64)
            filename = f"gen_hk_{uuid.uuid4().hex}.jpg"
        
        # Grocery logic
        elif 'grocery' in category and generate_grocery_image:
            if style_index >= 3:
                return jsonify({"success": False, "error": "Style not supported for Grocery"}), 400
            
            img_stream.seek(0)
            image_bytes = img_stream.getvalue()
            grocery_model = grocery_create_genai_client()
            
            mime, b64 = generate_grocery_image(
                model=grocery_model, prompt=final_prompt, ref_images=[],
                ref_image_bytes=[(image_bytes, 'image/jpeg')],
                target_size=(1117, 1400), index=style_index, attributes=attributes
            )
            image_data = base64.b64decode(b64)
            filename = f"gen_grocery_{uuid.uuid4().hex}.jpg"
            
        # Default Gemini flow
        else:
            full_prompt = f"Transform this photo photorealistically: {final_prompt}"
            response = image_model.generate_content(
                [uploaded_image, full_prompt],
                generation_config=genai.types.GenerationConfig(temperature=0.6)
            )
            
            # Extract image data from parts
            image_data = None
            for part in getattr(response.candidates[0].content, "parts", []):
                if hasattr(part, "inline_data") and part.inline_data:
                    image_data = part.inline_data.data
                    break
            
            if not image_data:
                return jsonify({"success": False, "error": "AI failed to return image"}), 502
            
            filename = f"gen_{uuid.uuid4().hex}.jpg"

        # Save and Upload
        local_path = os.path.join(OUTPUT_DIR, filename)
        with open(local_path, 'wb') as f:
            f.write(image_data)
            
        gcs_url = None
        try:
            gcs_url = upload_to_gcs(local_path, f"generated/{filename}")
        except Exception as e:
            print(f"⚠️ GCS upload failed: {e}")

        preview_url = f"{request.host_url.rstrip('/')}/api/v2/generated_images/{filename}"

        return jsonify({
            "success": True,
            "filename": filename,
            "gcs_url": gcs_url,
            "preview_url": preview_url,
            "style_index": style_index
        })

    except Exception as e:
        print(f"❌ Image Route: Generation error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@image_bp.route("/generated_images/<filename>")
def serve_image(filename):
    """Serve generated images from the output directory."""
    try:
        file_path = os.path.join(OUTPUT_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "Not found"}), 404
        return send_file(file_path, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({"error": str(e)}), 500
