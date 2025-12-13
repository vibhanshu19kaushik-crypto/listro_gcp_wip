#!/usr/bin/env python3
"""
Amazon Metadata Scraper - Improved Version
Scrapes category, gender, age group and subcategory accurately
"""

import os
import json
import requests
import html
import re
from bs4 import BeautifulSoup
import urllib3
import sys

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Try to get GEMINI_API_KEY from environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # Try to load from .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    except:
        pass

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
}

ALLOWED_GENDERS = ["Boys", "Women", "Baby Boys", "Baby Girls", "Girl", "Men", "Unisex"]
ALLOWED_AGE_GROUPS = ["Kids", "Adults", "All Ages"]

def fetch_html(url):
    """Fetch HTML from Amazon with proper headers and session"""
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        
        # Add retry logic
        from requests.adapters import HTTPAdapter
        from requests.packages.urllib3.util.retry import Retry
        
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        resp = session.get(url, timeout=30, verify=False)
        resp.raise_for_status()
        
        # Check if we got a valid HTML response
        if 'captcha' in resp.text.lower() or 'robot' in resp.text.lower():
            print(f"⚠️ Possible CAPTCHA or blocking detected for {url}", file=sys.stderr)
            
        return resp.text
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching URL {url}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching URL: {e}", file=sys.stderr)
        return None

def parse_amazon(html_text):
    """Parse Amazon product page with multiple extraction methods"""
    if not html_text:
        return "", [], []
    
    try:
        soup = BeautifulSoup(html_text, "html.parser")
        
        # Title - multiple selectors
        title = ""
        title_selectors = [
            "#productTitle",
            "h1#title",
            "h1.a-size-large",
            "span#productTitle",
            "#title_feature_div h1"
        ]
        
        for selector in title_selectors:
            title_tag = soup.select_one(selector)
            if title_tag:
                title = title_tag.get_text(strip=True)
                break
        
        # Bullets/Features - multiple selectors
        bullets = []
        bullet_selectors = [
            "#feature-bullets ul li span.a-list-item",
            "#feature-bullets li",
            ".a-unordered-list .a-list-item",
            "#detailBullets_feature_div li"
        ]
        
        for selector in bullet_selectors:
            for li in soup.select(selector):
                text = li.get_text(" ", strip=True)
                if text and len(text) > 3:  # Filter out very short texts
                    bullets.append(text)
        
        # Remove duplicates while preserving order
        bullets = list(dict.fromkeys(bullets))
        
        # Breadcrumbs - multiple extraction methods
        breadcrumbs = []
        
        # Method 1: Standard breadcrumb section
        bc_selectors = [
            "#wayfinding-breadcrumbs_feature_div",
            "#wayfinding-breadcrumbs_container",
            ".a-breadcrumb",
            "#nav-breadcrumb",
            "ul.a-unordered-list.a-horizontal.a-size-small"
        ]
        
        for selector in bc_selectors:
            bc_section = soup.select_one(selector)
            if bc_section:
                for a in bc_section.find_all("a"):
                    text = html.unescape(a.get_text(" ", strip=True))
                    if text and text.lower() not in ['home', 'main menu', 'back to results']:
                        # Clean the text
                        text = re.sub(r'\s+', ' ', text).strip()
                        breadcrumbs.append(text)
                if breadcrumbs:
                    break
        
        # Method 2: Extract from product details
        if not breadcrumbs:
            detail_sections = soup.select("#detailBullets_feature_div span.a-text-bold")
            for section in detail_sections:
                text = section.get_text(strip=True)
                if 'category' in text.lower() or 'department' in text.lower():
                    next_span = section.find_next_sibling("span")
                    if next_span:
                        categories = next_span.get_text(strip=True)
                        breadcrumbs = [cat.strip() for cat in categories.split('›') if cat.strip()]
                        break
        
        # Method 3: Look for category information in hidden spans
        if not breadcrumbs:
            hidden_cats = soup.find_all("span", {"class": "a-list-item"})
            for cat in hidden_cats:
                text = cat.get_text(strip=True)
                if 'category' in text.lower() or 'department' in text.lower():
                    # Extract category names
                    matches = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', text)
                    if matches:
                        breadcrumbs = matches
                        break
        
        # Clean breadcrumbs - remove empty, duplicates, and common irrelevant items
        breadcrumbs = [bc for bc in breadcrumbs if bc and len(bc) > 1]
        breadcrumbs = list(dict.fromkeys(breadcrumbs))  # Remove duplicates
        
        # Filter out common irrelevant items
        irrelevant = ['see more', 'home', 'all departments', 'main menu', 'shop by department']
        breadcrumbs = [bc for bc in breadcrumbs if bc.lower() not in irrelevant]
        
        print(f"✅ Extracted {len(breadcrumbs)} breadcrumbs: {breadcrumbs}", file=sys.stderr)
        
        return title, bullets, breadcrumbs
        
    except Exception as e:
        print(f"❌ Error parsing HTML: {e}", file=sys.stderr)
        return "", [], []

def call_gemini(prompt_text):
    """Call Gemini API with improved error handling"""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not found in environment")
    
    payload = {"contents": [{"parts": [{"text": prompt_text}]}]}
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    
    try:
        # Create session with retry
        session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(max_retries=3)
        session.mount("https://", adapter)
        
        resp = session.post(GEMINI_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()
        
    except requests.exceptions.SSLError:
        # Try without SSL verification as fallback
        resp = requests.post(GEMINI_URL, headers=headers, json=payload, timeout=30, verify=False)
        resp.raise_for_status()
        return resp.json()
        
    except Exception as e:
        print(f"❌ Error calling Gemini API: {e}", file=sys.stderr)
        raise

def extract_json_from_response(resp):
    """Extract JSON from Gemini response"""
    try:
        text = resp["candidates"][0]["content"]["parts"][0]["text"]
    except:
        return {"error": "Malformed Gemini response"}
    
    # Clean the response
    text = text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    
    # Find JSON in the response
    try:
        # Try to parse directly first
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)
        except:
            pass
    
    return {"error": "Invalid JSON returned", "raw": text[:200]}

def normalize_gender(g):
    """Normalize gender to allowed values with improved logic"""
    if not g or g.lower() == "unknown":
        return "unknown"
    
    g_low = g.lower()
    
    # Check for unisex first
    if "unisex" in g_low or "all" in g_low or "universal" in g_low:
        return "Unisex"
    
    # Check for baby categories
    if "baby boy" in g_low or "infant boy" in g_low:
        return "Baby Boys"
    if "baby girl" in g_low or "infant girl" in g_low:
        return "Baby Girls"
    
    # Check for kids
    if "boys" in g_low or g_low == "boy" or "boy's" in g_low:
        return "Boys"
    if "girls" in g_low or g_low == "girl" or "girl's" in g_low:
        return "Girl"
    
    # Check for adults
    if "women" in g_low or "woman" in g_low or "women's" in g_low or "woman's" in g_low:
        return "Women"
    if "men" in g_low or "man" in g_low or "men's" in g_low or "man's" in g_low:
        return "Men"
    
    return "unknown"

def normalize_age_group(gender, title, bullets, breadcrumbs):
    """Determine age group with improved logic"""
    # Combine all text for analysis
    all_text = (title + " " + " ".join(bullets) + " " + " ".join(breadcrumbs)).lower()
    
    # Kids keywords
    kids_keywords = ["kid", "boys", "girls", "child", "children", "toddler", "baby", "infant", "preschool", "teen", "youth"]
    
    # Adult keywords
    adult_keywords = ["adult", "men", "women", "man", "woman", "grown", "mature"]
    
    # Check breadcrumbs for age hints
    for bc in breadcrumbs:
        bc_low = bc.lower()
        if any(k in bc_low for k in kids_keywords):
            return "Kids"
        if any(k in bc_low for k in adult_keywords):
            return "Adults"
    
    # Check gender
    if gender in ["Boys", "Girl", "Baby Boys", "Baby Girls"]:
        return "Kids"
    if gender in ["Men", "Women"]:
        return "Adults"
    
    # Check text content
    if any(k in all_text for k in kids_keywords):
        return "Kids"
    if any(k in all_text for k in adult_keywords):
        return "Adults"
    
    # Check specific patterns in title
    title_low = title.lower()
    if "baby" in title_low or "toddler" in title_low or "infant" in title_low:
        return "Kids"
    
    # Default to Adults if gender is unknown
    return "Adults"

def extract_category_from_breadcrumbs(breadcrumbs):
    """Extract category and subcategory from breadcrumbs intelligently"""
    if not breadcrumbs:
        return "unknown", "unknown"
    
    # Filter out common non-category items
    category_keywords = ['clothing', 'shoes', 'electronics', 'home', 'kitchen', 'beauty', 
                        'sports', 'toys', 'books', 'health', 'grocery', 'automotive']
    
    filtered_breadcrumbs = []
    for bc in breadcrumbs:
        bc_low = bc.lower()
        # Keep if it contains category keywords or is likely a category
        if any(keyword in bc_low for keyword in category_keywords) or len(bc.split()) <= 3:
            filtered_breadcrumbs.append(bc)
    
    if not filtered_breadcrumbs:
        return breadcrumbs[0], breadcrumbs[-1]
    
    category = filtered_breadcrumbs[0]
    
    # For subcategory, try to find the most specific item
    if len(filtered_breadcrumbs) > 1:
        subcategory = filtered_breadcrumbs[-1]
    else:
        subcategory = category
    
    return category, subcategory

def classify_product_simple(title, bullets, breadcrumbs):
    """Simple classification without Gemini (fallback)"""
    category, subcategory = extract_category_from_breadcrumbs(breadcrumbs)
    
    # Try to extract gender from breadcrumbs and title
    gender_raw = "unknown"
    
    # Check breadcrumbs first
    for bc in breadcrumbs:
        bc_low = bc.lower()
        if any(g in bc_low for g in ["men", "women", "boys", "girls", "boy", "girl", "baby", "unisex"]):
            gender_raw = bc
            break
    
    # Check title if not found in breadcrumbs
    if gender_raw == "unknown":
        title_low = title.lower()
        if "men" in title_low or "man" in title_low or "men's" in title_low:
            gender_raw = "Men"
        elif "women" in title_low or "woman" in title_low or "women's" in title_low:
            gender_raw = "Women"
        elif "boys" in title_low or "boy" in title_low or "boy's" in title_low:
            gender_raw = "Boys"
        elif "girls" in title_low or "girl" in title_low or "girl's" in title_low:
            gender_raw = "Girl"
        elif "baby boy" in title_low:
            gender_raw = "Baby Boys"
        elif "baby girl" in title_low:
            gender_raw = "Baby Girls"
    
    gender = normalize_gender(gender_raw)
    age_group = normalize_age_group(gender, title, bullets, breadcrumbs)
    
    return {
        "gender": gender,
        "category": category,
        "subcategory": subcategory,
        "age_group": age_group,
        "note": "simple_fallback"
    }

def classify_product_with_gemini(title, bullets, breadcrumbs):
    """Classify product using Gemini AI"""
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not found, using simple classification", file=sys.stderr)
        return classify_product_simple(title, bullets, breadcrumbs)
    
    category, subcategory = extract_category_from_breadcrumbs(breadcrumbs)
    
    # Extract initial gender guess
    gender_raw = "unknown"
    all_text = (title + " " + " ".join(bullets) + " " + " ".join(breadcrumbs)).lower()
    
    if "men" in all_text or "man" in all_text:
        gender_raw = "Men"
    elif "women" in all_text or "woman" in all_text:
        gender_raw = "Women"
    elif "boys" in all_text or "boy" in all_text:
        gender_raw = "Boys"
    elif "girls" in all_text or "girl" in all_text:
        gender_raw = "Girl"
    elif "baby boy" in all_text:
        gender_raw = "Baby Boys"
    elif "baby girl" in all_text:
        gender_raw = "Baby Girls"
    elif "unisex" in all_text:
        gender_raw = "Unisex"
    
    gender = normalize_gender(gender_raw)
    
    # Prepare product info for Gemini
    product_info = f"""
PRODUCT INFORMATION:
Title: {title}

Key Features:
{chr(10).join(['- ' + b for b in bullets[:5]])}

Product Categories (breadcrumbs):
{chr(10).join(['> ' + bc for bc in breadcrumbs])}

Current Analysis:
- Likely Category: {category}
- Likely Subcategory: {subcategory}
- Detected Gender: {gender}
"""
    
    prompt = f"""
You are an expert Amazon product classifier. Analyze the product information below and classify it.

IMPORTANT RULES:
1. Gender MUST be one of these exact values: {', '.join(ALLOWED_GENDERS)}
2. Age Group MUST be one of these exact values: {', '.join(ALLOWED_AGE_GROUPS)}
3. Category should be the main product category (from breadcrumbs)
4. Subcategory should be the most specific product type

ANALYSIS GUIDELINES:
- "Kids" age group for: baby items, children's clothing, toys for children, school items
- "Adults" age group for: adult clothing, electronics, tools, household items
- "All Ages" for items usable by everyone: books, movies, some home decor
- Consider "Unisex" for items designed for both genders
- Use breadcrumbs as primary source for category/subcategory

{product_info}

Return ONLY a JSON object with these exact keys:
{{
  "gender": "<gender from allowed list>",
  "category": "<main category>",
  "subcategory": "<specific subcategory>",
  "age_group": "<age group from allowed list>",
  "confidence": "<high/medium/low>"
}}
"""
    
    try:
        print("🤖 Calling Gemini API for classification...", file=sys.stderr)
        resp = call_gemini(prompt)
        parsed = extract_json_from_response(resp)
        
        if "error" in parsed:
            print(f"⚠️ Gemini classification error: {parsed['error']}", file=sys.stderr)
            return classify_product_simple(title, bullets, breadcrumbs)
        
        # Validate and normalize the response
        parsed_gender = parsed.get("gender", gender)
        parsed["gender"] = normalize_gender(parsed_gender)
        
        parsed_age = parsed.get("age_group", "")
        if parsed_age not in ALLOWED_AGE_GROUPS:
            parsed["age_group"] = normalize_age_group(parsed["gender"], title, bullets, breadcrumbs)
        
        # Ensure category and subcategory are not empty
        if not parsed.get("category") or parsed.get("category") == "unknown":
            parsed["category"] = category
        if not parsed.get("subcategory") or parsed.get("subcategory") == "unknown":
            parsed["subcategory"] = subcategory
        
        parsed["note"] = "gemini_classified"
        parsed["confidence"] = parsed.get("confidence", "medium")
        
        return parsed
        
    except Exception as e:
        print(f"⚠️ Gemini API call failed: {e}", file=sys.stderr)
        return classify_product_simple(title, bullets, breadcrumbs)

def scrape_amazon_metadata(asin):
    """
    Scrape Amazon product metadata from ASIN
    Returns comprehensive product information
    """
    try:
        url = f"https://www.amazon.in/dp/{asin}"
        print(f"🔍 Fetching URL: {url}", file=sys.stderr)
        
        html_text = fetch_html(url)
        
        if not html_text:
            print(f"❌ Failed to fetch HTML for ASIN {asin}", file=sys.stderr)
            return {
                "success": False,
                "asin": asin,
                "error": "Failed to fetch HTML - possible blocking or invalid ASIN",
                "category": "unknown",
                "gender": "unknown",
                "age_group": "Adults",
                "subcategory": "unknown",
                "title": "",
                "breadcrumbs": []
            }
        
        title, bullets, breadcrumbs = parse_amazon(html_text)
        
        if not title:
            print(f"⚠️ No title found for ASIN {asin}", file=sys.stderr)
        
        print(f"✅ Title: {title[:80]}...", file=sys.stderr)
        print(f"✅ Found {len(bullets)} bullet points", file=sys.stderr)
        print(f"✅ Breadcrumbs ({len(breadcrumbs)}): {breadcrumbs}", file=sys.stderr)
        
        # Try Gemini classification first, fallback to simple if fails
        result = classify_product_with_gemini(title, bullets, breadcrumbs)
        
        print(f"✅ Classification result:", file=sys.stderr)
        print(f"   - Gender: {result.get('gender')}", file=sys.stderr)
        print(f"   - Category: {result.get('category')}", file=sys.stderr)
        print(f"   - Subcategory: {result.get('subcategory')}", file=sys.stderr)
        print(f"   - Age Group: {result.get('age_group')}", file=sys.stderr)
        
        return {
            "success": True,
            "asin": asin,
            "url": url,
            "title": title,
            "category": result.get("category", "unknown"),
            "gender": result.get("gender", "unknown"),
            "age_group": result.get("age_group", "Adults"),
            "subcategory": result.get("subcategory", "unknown"),
            "breadcrumbs": breadcrumbs,
            "bullets": bullets[:10],  # Limit to first 10 bullets
            "classification_note": result.get("note", "unknown"),
            "confidence": result.get("confidence", "medium"),
            "raw_breadcrumbs_count": len(breadcrumbs)
        }
        
    except Exception as e:
        print(f"❌ Error scraping metadata for ASIN {asin}: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "asin": asin,
            "error": str(e),
            "category": "unknown",
            "gender": "unknown", 
            "age_group": "Adults",
            "subcategory": "unknown",
            "title": "",
            "breadcrumbs": []
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print('Usage: python amz_metadata_scraper.py <ASIN> [output_file.json]')
        print('Example: python amz_metadata_scraper.py B0G2C8FH49 result.json')
        sys.exit(1)
    
    asin = sys.argv[1]
    print(f"🚀 Starting scrape for ASIN: {asin}", file=sys.stderr)
    
    result = scrape_amazon_metadata(asin)
    
    # Output result
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"💾 Results saved to {output_file}", file=sys.stderr)
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result

if __name__ == "__main__":
    main()