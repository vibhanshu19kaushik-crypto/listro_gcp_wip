import re
import os
import json
import traceback
import google.generativeai as genai
from google.cloud import storage
from google.cloud.exceptions import Forbidden
from secret_manager import get_gemini_models

# Initialize Gemini models
try:
    credentials, text_model, image_model = get_gemini_models()
    print("✅ Gemini models initialized successfully in AI Service")
except Exception as e:
    print(f"❌ Failed to initialize Gemini models in AI Service: {e}")
    text_model = None
    image_model = None

OUTPUT_DIR = "generated_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)
SCRAPED_IMAGES_DIR = os.getenv("SCRAPED_IMAGES_DIR", "scraped_images")
os.makedirs(SCRAPED_IMAGES_DIR, exist_ok=True)

# GCS Configuration
GCS_BUCKET_NAME = "listro-image-store"
storage_client = None
try:
    storage_client = storage.Client()
except Exception as e:
    print(f"⚠️ GCS storage client not available: {e}")

def upload_to_gcs(local_file_path, destination_blob_name):
    """Uploads a file to GCS, makes it public, and returns the public URL."""
    if not storage_client:
        raise Exception("GCS client not available")
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)
    try:
        blob.upload_from_filename(local_file_path)
        return blob.public_url
    except Forbidden:
        raise Exception(f"GCS Permission Denied for bucket '{GCS_BUCKET_NAME}'")
    except Exception as e:
        raise Exception(f"GCS Upload Failed: {str(e)}")

def replace_placeholders(prompt: str, attributes: dict) -> str:
    """Replace [placeholder] with attribute values in prompt."""
    pattern = r"\[(\w+)\]"
    def replacer(match):
        key = match.group(1)
        return attributes.get(key, f"[{key}]")
    return re.sub(pattern, replacer, prompt)

# --- Amazon Image Prompt Templates ---
def get_prompt_amazon_main_image():
    return "Ultra-photorealistic Amazon main product image, white background, [product_name], premium lighting, head-to-toe full view."

def get_prompt_amazon_product_only_image():
    return "Ultra-photorealistic Amazon product-only image, white background, [product_name], no model, studio lighting."

def get_prompt_amazon_lifestyle_image():
    return "Ultra-photorealistic Amazon lifestyle image, [product_name] in use in a premium natural setting, full human model."

def get_prompt_amazon_angle_image():
    return "Ultra-photorealistic Amazon angled product image, white background, [product_name] shown from 45-degree angle."

def get_prompt_amazon_infographic():
    return "Ultra-photorealistic Amazon infographic base image, clean background, [product_name] with space for text callouts."

PROMPT_FUNCTIONS = [
    get_prompt_amazon_main_image,
    get_prompt_amazon_product_only_image,
    get_prompt_amazon_lifestyle_image,
    get_prompt_amazon_angle_image,
    get_prompt_amazon_infographic
]

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
    """
    if not text:
        return text
    
    replacements = {
        '&': ' and ', '~': '-', '•': '-', '·': '-', '→': ' to ', '←': ' from ',
        '↑': ' up ', '↓': ' down ', '✓': 'yes', '✔': 'yes', '★': '', '☆': '',
        '❤': '', '♥': '', '®': '', '©': '', '™': '', '°': ' degrees ',
        '½': 'half', '¼': 'quarter', '¾': 'three quarters', '×': ' x ',
        '÷': ' divided by ', '±': ' plus or minus ', '≥': ' greater than or equal to ',
        '≤': ' less than or equal to ', '≠': ' not equal to ', '≈': ' approximately ',
        '℃': ' Celsius ', '℉': ' Fahrenheit ', '€': ' EUR', '£': ' GBP',
        '¥': ' JPY', '$': 'USD ', '%': ' percent',
    }
    
    if not allow_pipes:
        replacements['|'] = ' '
    
    for symbol, replacement in replacements.items():
        text = text.replace(symbol, replacement)
    
    if allow_pipes:
        title_pattern = r'[^a-zA-Z0-9\s\-\|,\.\'\'\(\)]'
    elif is_description:
        title_pattern = r'[^a-zA-Z0-9\s\-,\.\'\':;\(\)\n\r]'
    else:
        title_pattern = r'[^a-zA-Z0-9\s\-,\.\'\'\(\)]'
    
    text = re.sub(title_pattern, ' ', text)
    
    if allow_pipes:
        text = re.sub(r'\s*\|\s*', ' | ', text)
    
    text = re.sub(r'\s+', ' ', text).strip()
    
    text = re.sub(r'\s+\.', '.', text)
    text = re.sub(r'\s+,', ',', text)
    text = re.sub(r',\s*,', ',', text)
    text = re.sub(r'\.\s*\.', '.', text)
    
    return text

def call_gemini(prompt, max_tokens):
    if not text_model:
        return "Generation Failed: Gemini model not initialized."
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
        
        # Finish reasons per Google Generative AI docs
        # FINISH_REASON_STOP = 1
        # FINISH_REASON_SAFETY = 2
        if finish_reason == 2: # SAFETY
            blocked_category_name = ""
            if candidate.safety_ratings:
                try:
                    blocked_category_name = candidate.safety_ratings[0].category.name
                except AttributeError:
                    blocked_category_name = f"Code {candidate.safety_ratings[0].category}"
            return f"Generation Failed: Output Blocked by Safety Filters (Finish Reason: SAFETY). Blocked Category: {blocked_category_name}"

        if finish_reason == 1 and hasattr(response, "text") and response.text:
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
    
    sanitized_output = sanitize_text(raw_output, allow_pipes=True, is_description=False)
    
    if len(sanitized_output) > 190:
        truncated = sanitized_output[:190]
        last_pipe = truncated.rfind('|')
        if last_pipe > 140:
            sanitized_output = truncated[:last_pipe].strip()
        else:
            last_space = truncated.rfind(' ')
            if last_space > 160:
                sanitized_output = truncated[:last_space].strip()
            else:
                sanitized_output = truncated
    
    sanitized_output = sanitized_output.strip('|').strip()
    return sanitized_output

def generate_product_description(subcategory, product_details):
    prompt = create_base_prompt(subcategory, product_details, 'description')
    raw_output = call_gemini(prompt, 4000)
    label = "Product Description:"
    if raw_output.startswith(label):
        raw_output = raw_output[len(label):].strip()
    
    sanitized_output = sanitize_text(raw_output, allow_pipes=False, is_description=True)
    
    if len(sanitized_output) > 1950:
        truncated = sanitized_output[:1950]
        last_period = truncated.rfind('.')
        last_exclamation = truncated.rfind('!')
        last_question = truncated.rfind('?')
        sentence_end = max(last_period, last_exclamation, last_question)
        
        if sentence_end > 1800:
            sanitized_output = truncated[:sentence_end + 1].strip()
        else:
            last_space = truncated.rfind(' ')
            if last_space > 1850:
                sanitized_output = truncated[:last_space].strip() + '.'
            else:
                sanitized_output = truncated
    
    sanitized_output = re.sub(r'<[^>]+>', '', sanitized_output)
    sanitized_output = re.sub(r'^[\-\*\+]\s+', '', sanitized_output, flags=re.MULTILINE)
    sanitized_output = re.sub(r'^\d+[\.\)]\s+', '', sanitized_output, flags=re.MULTILINE)
    sanitized_output = re.sub(r'\n\s*\n\s*\n+', '\n\n', sanitized_output)
    sanitized_output = re.sub(r' +', ' ', sanitized_output)
    
    return sanitized_output

def generate_amazon_keywords(product_title, product_category, product_subcategory, product_details):
    """Generate Amazon-optimized backend search terms for SEO ranking"""
    if not text_model:
        return None
        
    material = product_details.get('material', '')
    color = product_details.get('color', '')
    pattern = product_details.get('pattern', '')
    occasion = product_details.get('occasion', '')
    
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
    
    Now generate Amazon backend search terms for:
    {product_title}
    
    Return ONLY semicolon-separated keywords, no explanations.
    """
    
    try:
        response = text_model.generate_content(
            prompt,
            generation_config=types.GenerationConfig(
                temperature=0.8,
                top_p=0.9,
                top_k=40,
                max_output_tokens=200,
            ),
        )
        
        if not response.text:
            return None
            
        keywords_text = response.text.strip()
        keywords_text = keywords_text.replace('"', '').replace('Keywords:', '').strip()
        keywords_text = re.sub(r'^\d+[\.\)]\s*', '', keywords_text, flags=re.MULTILINE)
        keywords_text = re.sub(r'[-•*]\s*', '', keywords_text)
        
        lines = keywords_text.split('\n')
        keyword_lines = []
        for line in lines:
            line = line.strip()
            if line.lower().startswith(('note:', 'tip:', 'remember:', 'important:', 'amazon')):
                break
            if line and not line.lower().startswith(('these keywords', 'the keywords', 'keywords can')):
                keyword_lines.append(line)
        
        keywords_text = ' '.join(keyword_lines)
        
        if ';' not in keywords_text:
            if '\n' in keywords_text:
                lines = [k.strip() for k in keywords_text.split('\n') if k.strip()]
                keywords_text = '; '.join(lines)
            else:
                keywords_text = keywords_text.replace(',', ';')
        
        raw_keywords = [k.strip() for k in keywords_text.split(';') if k.strip()]
        cleaned_keywords = []
        
        for kw in raw_keywords:
            kw = re.sub(r'[.,;:!?]+$', '', kw)
            kw = ' '.join(kw.split())
            if len(kw.split()) <= 6 and not kw.endswith('.') and not kw.startswith(('The ', 'This ', 'These ')):
                cleaned_keywords.append(kw.lower())
        
        if len(cleaned_keywords) < 7:
            amazon_keyword_boosters = [
                f"{product_subcategory.lower()} for {occasion.lower()}" if occasion else "",
                f"{material.lower()} {product_subcategory.lower()}" if material else "",
                f"{color.lower()} {pattern.lower()} {product_subcategory.lower()}" if color and pattern else "",
                f"buy {product_subcategory.lower()} online",
                f"{product_subcategory.lower()} amazon",
                f"{product_subcategory.lower()} for wedding",
                f"{product_subcategory.lower()} for office",
                f"{product_subcategory.lower()} for party",
                f"long {product_subcategory.lower()}",
                f"short {product_subcategory.lower()}",
                f"designer {product_subcategory.lower()}",
            ]
            for booster in amazon_keyword_boosters:
                if booster and booster not in cleaned_keywords and len(cleaned_keywords) < 8:
                    cleaned_keywords.append(booster)
        
        cleaned_keywords = cleaned_keywords[:8]
        final_keywords = '; '.join(cleaned_keywords)
        
        if len(final_keywords) > 250:
            words = final_keywords.split('; ')
            truncated = []
            char_count = 0
            for word in words:
                if char_count + len(word) + 2 <= 250:
                    truncated.append(word)
                    char_count += len(word) + 2
                else:
                    break
            if truncated:
                final_keywords = '; '.join(truncated)
            else:
                final_keywords = final_keywords[:247] + '...'
                
        return final_keywords
        
    except Exception as e:
        print(f"❌ Error in generate_amazon_keywords: {str(e)}")
        return None

def extract_product_attributes(keywords, existing_attributes):
    """Extract and suggest product attributes from keywords using AI"""
    if not text_model:
        return None
        
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
    
    try:
        response = text_model.generate_content(
            prompt,
            generation_config=types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=500,
            ),
        )
        
        if response.text:
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                try:
                    suggested_attributes = json.loads(json_match.group())
                    final_suggestions = {}
                    for key, value in suggested_attributes.items():
                        if key not in existing_attributes or not str(existing_attributes.get(key, '')).strip():
                            final_suggestions[key] = value
                    return final_suggestions
                except json.JSONDecodeError:
                    return None
        return None
    except Exception as e:
        print(f"❌ Error in extract_product_attributes: {str(e)}")
        return None

def extract_attributes_fallback(text, existing_attributes):
    """Fallback method to extract attributes from text using regex"""
    suggestions = {}
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
    return suggestions
