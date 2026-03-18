import base64
import io
import os
import json
import textwrap
import logging
from typing import List, Optional, Tuple, Dict

from werkzeug.datastructures import FileStorage
from PIL import Image, ImageDraw, ImageFont, ImageStat, ImageFilter
from dotenv import load_dotenv
import gspread
from google.oauth2.service_account import Credentials

# Load environment variables
load_dotenv()

# Configure logging for cost tracking
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import google.generativeai as genai
from google.generativeai import types

APP_TITLE = "Grocery & Gourmet Foods Image Generation Tool - Fail-Safe Pro"

"""Home & Kitchen Image Generation Tool backend.

This backend produces custom infographic images for Home & Kitchen products.

Encoding constraints:           
- All images: JPEG target window ~101KB–199KB
"""

# Output constraints (Strict 100KB - 200KB)
MIN_IMAGE_BYTES = 101 * 1024
MAX_IMAGE_BYTES = 199 * 1024

# Google Sheets configuration for H&K data
HK_SHEET_URL = "https://docs.google.com/spreadsheets/d/1K5FzXGI05hG4BMW7RjHB401U42LVRhtzWfGemK3rlqw/edit?gid=0#gid=0"
HK_SHEET_ID = "1K5FzXGI05hG4BMW7RjHB401U42LVRhtzWfGemK3rlqw"

# Initialize Google Sheets client
_gspread_client = None

def get_gspread_client():
    """Get or create Google Sheets client."""
    global _gspread_client
    if _gspread_client is not None:
        return _gspread_client
    
    try:
        # Try ADC (Application Default Credentials) first
        from google.auth import default
        creds, _ = default(scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
        _gspread_client = gspread.authorize(creds)
        logger.info("✅ Google Sheets client initialized with ADC for H&K data")
        return _gspread_client
    except Exception as adc_error:
        logger.warning(f"⚠️  ADC not available for H&K sheets: {adc_error}")
        
        # Fallback to credentials.json
        try:
            creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")
            if os.path.exists(creds_path):
                creds = Credentials.from_service_account_file(
                    creds_path,
                    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
                )
                _gspread_client = gspread.authorize(creds)
                logger.info("✅ Google Sheets client initialized with credentials.json for H&K data")
                return _gspread_client
            else:
                logger.error("❌ credentials.json not found for H&K sheets")
        except Exception as file_error:
            logger.error(f"❌ Could not initialize Google Sheets client for H&K: {file_error}")
    
    return None


def fetch_grocery_data_from_sheet(category: str, department: str, subcategory: str) -> Optional[Dict[str, str]]:
    """Fetch Home & Kitchen data from Google Sheet based on Category, Department, and Subcategory.
    
    Returns:
        Dict with keys: 'Quote', 'Prompt 1 (Quote background)', 'Use Cases', 'Prompt 2 (Use Case Background)'
        None if no match found or error occurs
    """
    try:
        gc = get_gspread_client()
        if gc is None:
            logger.error("❌ Google Sheets client not available")
            return None
        
        # Open the specific Grocery tab
        sheet = gc.open_by_key(HK_SHEET_ID).worksheet("Grocery & Gourmet Foods")
        
        # Get all records as list of dicts
        records = sheet.get_all_records()
        
        # Normalize inputs for comparison
        cat_norm = category.strip().lower()
        dept_norm = department.strip().lower()
        subcat_norm = subcategory.strip().lower()
        
        logger.info(f"🔍 Searching H&K sheet for: Category='{cat_norm}', Department='{dept_norm}', Subcategory='{subcat_norm}'")
        
        # Search for matching row
        for row in records:
            row_cat = str(row.get('Category', '')).strip().lower()
            row_dept = str(row.get('Department', '')).strip().lower()
            row_subcat = str(row.get('Subcategory', '')).strip().lower()
            
            if row_cat == cat_norm and row_dept == dept_norm and row_subcat == subcat_norm:
                result = {
                    'Quote': str(row.get('Quote', '')).strip(),
                    'Prompt 1 (Quote background)': str(row.get('Prompt 1 (Quote background)', '')).strip(),
                    'Use Cases': str(row.get('Use Cases', '')).strip(),
                    'Prompt 2 (Use Case Background)': str(row.get('Prompt 2 (Use Case Background)', '')).strip(),
                }
                logger.info(f"✅ Found matching H&K data in sheet")
                return result
        
        logger.warning(f"⚠️  No matching H&K data found in sheet for: {category}/{department}/{subcategory}")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error fetching H&K data from sheet: {e}")
        return None


# --- MASTER PROMPT FOR AESTHETIC CLEAN PLATES ---
# This ensures Gemini focuses purely on the visual art.
CLEAN_SCENE_MASTER_PROMPT = """
System Role: Gourmet Food & Lifestyle Photographer.
Objective: Generate a high-end, appetizing lifestyle photograph of the food/grocery product.

CRITICAL COMPOSITION RULE: 
- Position the main product on the LEFT or CENTER-LEFT side of the frame
- Keep the RIGHT 30% of the image relatively empty or with soft bokeh background
- This ensures space for text overlay without covering the product

STRICT RULE: DO NOT ADD ANY TEXT, LABELS, OR ICONS. 
Focus on: 
1. Appetizing lighting (warm, inviting, highlighting freshness and texture)
2. Soft bokeh (blurred) backgrounds on the right side
3. Contextual props (e.g., rustic wooden boards, fresh ingredients, splash of liquid) behind or around the product
4. Product Integrity: Maintain the exact packaging/product from reference images
5. Professional composition: Product prominent on left, breathing room on right
"""

# --- HELPER: TEXT OVERLAY ENGINE (PILLOW) ---
def get_dynamic_styles(img: Image.Image):
    """Analyzes image for a high-end Glassmorphism effect."""
    # Sample the area where the box will sit
    right_slice = img.crop((int(img.width * 0.7), 0, img.width, img.height))
    stat = ImageStat.Stat(right_slice)
    avg_brightness = sum(stat.mean) / 3
    
    if avg_brightness > 130: 
        return {
            "box_fill": (255, 255, 255, 140),  # Low alpha (140) for frosted glass effect
            "text_color": (20, 20, 20, 255),    # High contrast charcoal
            "accent_color": (0, 150, 136, 255)
        }
    else:
        return {
            "box_fill": (0, 0, 0, 150),        # Smoked glass effect
            "text_color": (255, 255, 255, 255), # Pure white
            "accent_color": (255, 215, 0, 255)  # Gold accent
        }


def draw_auto_adjust_text(draw, text, font, color, x, y, max_width, max_height, is_heading=False):
    """
    Automatically scales font down for long headings and wraps features 
    to fit the box width perfectly.
    """
    current_font = font
    
    # 1. AUTO-SCALE: Shrink heading if it's way too wide
    if is_heading:
        while draw.textlength(text, font=current_font) > max_width * 1.5 and current_font.size > 22:
            try:
                current_font = ImageFont.truetype(current_font.path, current_font.size - 2)
            except:
                # Fallback if font path is not available
                break

    # 2. AUTO-WRAP: Break into lines
    words = text.split(' ')
    lines = []
    current_line = []
    for word in words:
        test_line = ' '.join(current_line + [word])
        if draw.textlength(test_line, font=current_font) <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))

    # 3. RENDER & RETURN NEW Y: Ensures no overlap with next bullet
    curr_y = y
    for line in lines:
        draw.text((x, curr_y), line, fill=color, font=current_font)
        curr_y += current_font.size + 6 
    return curr_y


def apply_fancy_quote_overlay(base_img: Image.Image, quote_text: str) -> Image.Image:
    """
    Applies a fancy quote overlay directly on the image without a box.
    The quote is rendered in an elegant, centered style on the right side.
    
    Args:
        base_img: Base image to overlay text on
        quote_text: The quote text to display
    
    Returns:
        Image with quote overlay
    """
    base = base_img.copy().convert("RGBA")
    width, height = base.size
    
    # Analyze brightness to choose text color
    right_slice = base_img.crop((int(width * 0.5), 0, width, height))
    stat = ImageStat.Stat(right_slice)
    avg_brightness = sum(stat.mean) / 3
    
    # Choose text color based on background brightness
    if avg_brightness > 130:
        text_color = (20, 20, 20, 255)  # Dark text for light background
        shadow_color = (255, 255, 255, 180)  # Light shadow
    else:
        text_color = (255, 255, 255, 255)  # White text for dark background
        shadow_color = (0, 0, 0, 180)  # Dark shadow
    
    # Typography helper
    def get_font(size, bold=False):
        font_paths = [
            "Montserrat-Bold.ttf" if bold else "Montserrat-Italic.ttf",
            "Montserrat-Bold.ttf" if bold else "Montserrat-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
        ]
        for font_path in font_paths:
            try:
                font = ImageFont.truetype(font_path, size)
                logger.info(f"✅ Loaded font: {font_path} at size {size}")
                return font
            except Exception as e:
                continue
        logger.warning(f"⚠️ All fonts failed, using default at size {size}")
        return ImageFont.load_default()
    
    # Quote font size - balanced for readability without overwhelming
    quote_size = int(height * 0.07)  # 7% of image height - slightly smaller for elegance
    quote_font = get_font(quote_size, bold=False)  # Back to italic for elegance
    
    # Define text area - use more space for larger text
    margin = int(width * 0.05)
    text_area_start = int(width * 0.45)  # Start slightly left of center
    text_area_width = width - text_area_start - margin
    
    # Wrap text to fit the area
    words = quote_text.split()
    lines = []
    current_line = []
    
    draw_temp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        if draw_temp.textlength(test_line, font=quote_font) <= text_area_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    
    # Calculate total text height with generous line spacing
    line_height = int(quote_size * 1.4)  # 1.4x font size for better readability
    total_text_height = len(lines) * line_height
    
    # Center vertically
    start_y = (height - total_text_height) // 2
    
    # Create overlay for text with subtle shadow
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Render each line centered
    curr_y = start_y
    for line in lines:
        # Calculate x position for center alignment within text area
        line_width = draw.textlength(line, font=quote_font)
        x_pos = text_area_start + (text_area_width - line_width) // 2
        
        # Draw subtle shadow for depth
        shadow_offset = 3
        draw.text((x_pos + shadow_offset, curr_y + shadow_offset), line, 
                 fill=shadow_color, font=quote_font)
        
        # Draw main text
        draw.text((x_pos, curr_y), line, fill=text_color, font=quote_font)
        
        curr_y += line_height
    
    # Composite the overlay
    base = Image.alpha_composite(base, overlay)
    
    return base.convert("RGB")


def apply_pro_infographic_overlay(base_img: Image.Image, text_data: dict) -> Image.Image:
    """
    Programmatically adds text to ensure zero spelling errors.
    Creates true glassmorphism effect with background blur.
    Box auto-adjusts height based on content.
    Expected text_data format:
    {
        "heading": "Heading Text",
        "sub_header": "Sub-heading Text",
        "features": ["Feature 1", "Feature 2"]
    }
    """
    # Create working copies
    base = base_img.copy().convert("RGBA")
    width, height = base.size
    
    # Get Dynamic Colors based on image content
    styles = get_dynamic_styles(base_img)
    
    # --- TYPOGRAPHY HELPER ---
    def get_font(size, bold=False):
        try:
            return ImageFont.truetype("Montserrat-Bold.ttf" if bold else "Montserrat-Regular.ttf", size)
        except:
            try:
                return ImageFont.truetype("Arial.ttf", size)
            except:
                try:
                    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
                except:
                    return ImageFont.load_default()

    # --- DYNAMIC TYPOGRAPHY SIZING (Ratio-based) ---
    header_size = int(height * 0.045)  # 4.5% of image height (~63px for 1400px)
    feature_size = int(header_size * 0.60)  # 60% of header size (~38px)
    
    h_font = get_font(header_size, bold=True)
    f_font = get_font(feature_size)

    # --- BOX POSITIONING (Rule of Thirds) ---
    margin = int(width * 0.05)
    box_width = int(width * 0.35)
    box_x_start = width - box_width - margin
    
    # --- PADDING ---
    padding_x = 30
    padding_y = 40
    
    text_left = box_x_start + padding_x
    text_width = box_width - (padding_x * 2)
    
    # --- CALCULATE REQUIRED HEIGHT (Dry Run) ---
    # Measure how much vertical space the text needs
    temp_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    temp_draw = ImageDraw.Draw(temp_img)
    
    measure_y = 0
    
    # Measure heading with textwrap
    heading = text_data.get("heading", "")
    if heading:
        wrapped_heading = textwrap.wrap(heading, width=int(text_width / (header_size * 0.5)))
        heading_height = len(wrapped_heading) * (header_size + 6)
        measure_y += heading_height + 20
    
    # Measure features with textwrap
    features = text_data.get("features", [])
    for feature in features:
        wrapped_feature = textwrap.wrap(feature, width=int((text_width - 40) / (feature_size * 0.5)))
        feature_height = len(wrapped_feature) * (feature_size + 5)
        measure_y += feature_height + 15
    
    # Calculate final box dimensions
    content_height = measure_y
    box_height = content_height + (padding_y * 2)
    
    # Set constraints
    min_box_height = int(height * 0.25)
    max_box_height = int(height * 0.55)
    box_height = max(min_box_height, min(box_height, max_box_height))
    
    # Position box
    box_top = int(height * 0.30)
    box_bottom = box_top + box_height
    
    if box_bottom > int(height * 0.85):
        box_bottom = int(height * 0.85)
        box_height = box_bottom - box_top
    
    box_rect = [box_x_start, box_top, width - margin, box_bottom]
    
    # --- GLASSMORPHISM EFFECT (True Frosted Glass) ---
    # Step 1: Crop the area where the box will be
    box_region = base.crop(box_rect)
    
    # Step 2: Apply Gaussian blur to create frosted effect
    box_region = box_region.filter(ImageFilter.GaussianBlur(radius=15))
    
    # Step 3: Paste the blurred region back
    base.paste(box_region, (box_rect[0], box_rect[1]))
    
    # Step 4: Create overlay for semi-transparent tint
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    # Step 5: Draw semi-transparent tint over blurred area
    overlay_draw.rounded_rectangle(box_rect, radius=18, fill=styles["box_fill"])
    
    # Step 6: Composite the overlay
    base = Image.alpha_composite(base, overlay)
    
    # --- RENDER TEXT ---
    draw = ImageDraw.Draw(base)
    curr_y = box_top + padding_y
    
    # Render Heading
    if heading:
        wrapped_heading = textwrap.wrap(heading, width=int(text_width / (header_size * 0.5)))
        for line in wrapped_heading:
            draw.text((text_left, curr_y), line, fill=styles["text_color"], font=h_font)
            curr_y += header_size + 6
        curr_y += 20
    
    # Render Features
    bullet_size = 10
    for idx, feature in enumerate(features):
        if curr_y > (box_bottom - padding_y - 30):
            break
        
        # Bullet
        bullet_y = curr_y + 5
        draw.ellipse(
            [text_left, bullet_y, text_left + bullet_size, bullet_y + bullet_size],
            fill=styles["accent_color"]
        )
        
        # Feature text with wrapping
        feature_x = text_left + bullet_size + 15
        feature_width_chars = int((text_width - 40) / (feature_size * 0.5))
        wrapped_lines = textwrap.wrap(feature, width=feature_width_chars)
        
        for line in wrapped_lines:
            draw.text((feature_x, curr_y), line, fill=styles["text_color"], font=f_font)
            curr_y += feature_size + 5
        
        curr_y += 15

    return base.convert("RGB")


def _encode_jpeg_standard(img: Image.Image, *, swatch: bool = False) -> Tuple[str, bytes]:
    """Strictly encode to JPEG.

    Requirements:
    - Target payload size in [MIN_IMAGE_BYTES, MAX_IMAGE_BYTES]
    """

    if img.mode != "RGB":
        img = img.convert("RGB")

    if swatch:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=100)
        return "image/jpeg", buf.getvalue()

    quality = 95
    last_data: Optional[bytes] = None

    # Try to land in the 101–199KB window by adjusting quality.
    while quality >= 10:
        buf = io.BytesIO()
        use_optimize = quality < 80
        img.save(buf, format="JPEG", quality=int(quality), optimize=use_optimize)
        data = buf.getvalue()
        last_data = data
        file_size = len(data)

        if MIN_IMAGE_BYTES <= file_size <= MAX_IMAGE_BYTES:
            return "image/jpeg", data

        if file_size > MAX_IMAGE_BYTES:
            quality -= 5
            continue

        if file_size < MIN_IMAGE_BYTES and quality >= 95:
            return "image/jpeg", data

        break

    return "image/jpeg", last_data or b""


def _guess_mime(filename: str) -> str:
    ext = (filename or "").lower().rsplit(".", 1)[-1]
    if ext in ("jpg", "jpeg"):
        return "image/jpeg"
    if ext in ("png",):
        return "image/png"
    if ext in ("webp",):
        return "image/webp"
    return "application/octet-stream"


def create_genai_client():
    """Configure Gemini API and return the image model.
    
    This uses the same pattern as python-server.py with genai.configure() and GenerativeModel.
    Returns the configured GenerativeModel for image generation.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    if api_key:
        # Configure with API key
        genai.configure(api_key=api_key)
        logger.info("✅ Gemini configured with API key")
        model = genai.GenerativeModel("gemini-2.5-flash-image")
        return model
    else:
        # Try to use Secret Manager (same as python-server.py)
        try:
            from secret_manager import configure_gemini_with_service_account
            credentials, text_model, image_model = configure_gemini_with_service_account()
            logger.info("✅ Gemini configured via Secret Manager")
            return image_model
        except Exception as e:
            logger.error(f"❌ Failed to configure Gemini: {e}")
            raise RuntimeError(
                "Could not configure Gemini. Set GEMINI_API_KEY or configure Secret Manager."
            )


def generate_one_image(
    model,
    prompt: str,
    ref_images: List[FileStorage],
    ref_image_bytes: Optional[List[Tuple[bytes, str]]] = None,
    target_size: Optional[Tuple[int, int]] = None,
    text_data: Optional[dict] = None,
    quote_text: Optional[str] = None,
) -> Tuple[str, str]:
    """Generates one image with fail-safe text overlay, returns (mime_type, base64_data).
    
    Args:
        model: Gemini GenerativeModel instance
        prompt: Generation prompt
        ref_images: Reference images (FileStorage objects)
        ref_image_bytes: Reference image bytes (alternative to ref_images)
        target_size: Target size for output image
        text_data: Dict with 'heading' and 'features' for box overlay
        quote_text: Quote text for fancy overlay (no box)
    """

    # STEP 1: AI generates the visual scene (NO TEXT)
    full_prompt = f"{CLEAN_SCENE_MASTER_PROMPT}\n\nSCENE TO GENERATE: {prompt}\nSTRICT: NO TEXT ON IMAGE."
    
    # Build content parts for Gemini
    content_parts = [full_prompt]

    if ref_image_bytes is not None:
        for raw, mime in ref_image_bytes[:2]:
            if raw:
                # Convert bytes to PIL Image for Gemini
                img = Image.open(io.BytesIO(raw))
                content_parts.append(img)
    else:
        for up in ref_images[:2]:
            try:
                raw = up.read()
                up.seek(0)  # Reset file pointer
                if raw:
                    img = Image.open(io.BytesIO(raw))
                    content_parts.append(img)
            except Exception as e:
                logger.warning(f"Could not read reference image: {e}")
                continue

    logger.info(f"🎨 Generating H&K image with {len(content_parts)-1} reference images")

    try:
        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.8,
            ),
        )
    except Exception as e:
        msg = str(e)
        logger.error(f"❌ Gemini generation failed: {msg}")
        raise RuntimeError(f"Image generation failed: {msg}")

    # Extract first image bytes from response
    for cand in (response.candidates or []):
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in (content.parts or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                data = inline.data

                # Open base image from AI
                base_img = Image.open(io.BytesIO(data)).convert("RGB")
                
                # Resize if needed
                if target_size is not None:
                    base_img = base_img.resize(target_size, resample=Image.Resampling.LANCZOS)
                
                # STEP 2: Apply appropriate text overlay
                if quote_text:
                    # Fancy quote overlay (no box)
                    final_img = apply_fancy_quote_overlay(base_img, quote_text)
                elif text_data:
                    # Box overlay with features
                    final_img = apply_pro_infographic_overlay(base_img, text_data)
                else:
                    final_img = base_img
                
                # Encode to JPEG
                out_mime, out_bytes = _encode_jpeg_standard(final_img, swatch=False)
                return out_mime, base64.b64encode(out_bytes).decode("utf-8")

    raise RuntimeError(
        "Model did not return an inline image in the response."
    )


def _buffer_uploads(images: List[FileStorage]) -> List[Tuple[bytes, str]]:
    """Read upload files into memory bytes once."""
    out: List[Tuple[bytes, str]] = []
    for up in (images or [])[:2]:
        try:
            raw = up.read()
            up.seek(0)  # Reset file pointer
        except Exception:
            raw = b""
        if raw:
            out.append((raw, _guess_mime(up.filename)))
    return out


def generate_grocery_image(
    model,
    prompt: str,
    ref_images: List[FileStorage],
    ref_image_bytes: Optional[List[Tuple[bytes, str]]] = None,
    target_size: Optional[Tuple[int, int]] = None,
    index: int = 0,
    attributes: Optional[Dict[str, str]] = None,
) -> Tuple[str, str]:
    """Generate a single Grocery & Gourmet Foods infographic image for the given index.

    - index 0 -> Key Features (uses "Quote" from sheet)
    - index 1 -> Why You'll Love It (uses "Use Cases" from sheet)
    - index >=2 -> raise ValueError (feature not available yet)
    
    Args:
        model: Gemini GenerativeModel instance
        prompt: Base prompt (may be overridden by sheet data)
        ref_images: Reference images
        ref_image_bytes: Reference image bytes
        target_size: Target image size
        index: Image style index (0 or 1)
        attributes: Product attributes dict with 'Category', 'Department', 'Subcategory'
    """
    if index >= 2:
        raise ValueError("Other features loading soon")

    # Extract attributes for sheet lookup
    category = ""
    department = ""
    subcategory = ""
    
    if attributes:
        category = attributes.get('Category', attributes.get('category', ''))
        department = attributes.get('Department', attributes.get('department', ''))
        subcategory = attributes.get('Subcategory', attributes.get('SubCategory', attributes.get('subcategory', '')))
    
    # Fetch data from Google Sheet
    sheet_data = None
    final_prompt = prompt
    
    if category and department and subcategory:
        logger.info(f"📊 Fetching Grocery data for: {category}/{department}/{subcategory}")
        sheet_data = fetch_grocery_data_from_sheet(category, department, subcategory)
        
        if sheet_data:
            # Use appropriate prompt based on index
            if index == 0:
                # Use Prompt 1 for Quote (first infographic)
                if sheet_data.get('Prompt 1 (Quote background)'):
                    final_prompt = sheet_data['Prompt 1 (Quote background)']
                    logger.info(f"✅ Using Prompt 1 (Quote background) from sheet")
            else:
                # Use Prompt 2 for Use Cases (second infographic)
                if sheet_data.get('Prompt 2 (Use Case Background)'):
                    final_prompt = sheet_data['Prompt 2 (Use Case Background)']
                    logger.info(f"✅ Using Prompt 2 (Use Case Background) from sheet")
    
    # Prepare overlay data based on index
    quote_for_overlay = None
    text_data_for_overlay = None
    
    if index == 0:
        # First infographic: Display "Quote" as fancy text (no box)
        if sheet_data and sheet_data.get('Quote'):
            quote_for_overlay = sheet_data['Quote']
            logger.info(f"✅ Using Quote from sheet for fancy overlay: '{quote_for_overlay[:50]}...'")
        else:
            # Fallback to default quote
            quote_for_overlay = "Savor every bite with premium quality and unmatched flavor."
            logger.warning("⚠️  Using default quote (no sheet data)")
    else:
        # Second infographic: Use "Use Cases" from sheet
        if sheet_data and sheet_data.get('Use Cases'):
            use_cases_text = sheet_data['Use Cases']
            
            # Parse Use Cases - try multiple formats
            heading = "Why You'll Love It"
            features = []
            
            # Format 1: "Heading: Feature 1. Feature 2. Feature 3. Feature 4."
            if ':' in use_cases_text:
                parts = use_cases_text.split(':', 1)
                heading = parts[0].strip()
                features_text = parts[1].strip()
                # Split by period, semicolon, or newline
                features = [f.strip() for f in features_text.replace('\n', '.').split('.') if f.strip()]
            else:
                # Format 2: Just features separated by periods or newlines
                features = [f.strip() for f in use_cases_text.replace('\n', '.').split('.') if f.strip()]
            
            # Ensure we have at least 4 features, pad if needed
            if len(features) < 4:
                features.extend([
                    "Modern aesthetic design",
                    "Easy to use interface",
                    "Durable construction",
                    "Perfect for daily needs"
                ][:4 - len(features)])
            
            text_data_for_overlay = {
                "heading": heading,
                "features": features[:4],  # Limit to 4 features for index 1
            }
            logger.info(f"✅ Using Use Cases from sheet: '{heading}' with {len(text_data_for_overlay['features'])} features")
        else:
            # Fallback to default
            text_data_for_overlay = {
                "heading": "Why You'll Love It",
                "features": [
                    "Crafted with premium, high-quality ingredients.",
                    "Rich, authentic flavor profile.",
                    "Perfect for elevating any meal or occasion.",
                    "Carefully packaged for maximum freshness.",
                ],
            }
            logger.warning("⚠️  Using default Why You'll Love It (no sheet data)")

    # Delegate to existing generator
    mime, b64 = generate_one_image(
        model=model,
        prompt=final_prompt,
        ref_images=ref_images,
        ref_image_bytes=ref_image_bytes,
        target_size=target_size,
        text_data=text_data_for_overlay,
        quote_text=quote_for_overlay,
    )
    return mime, b64


__all__ = [
    "create_genai_client",
    "generate_one_image",
    "_buffer_uploads",
    "generate_grocery_image",
]
