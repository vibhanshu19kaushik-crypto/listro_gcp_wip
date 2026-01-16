#!/usr/bin/env python3
"""
Amazon Metadata Scraper - Improved Version
Scrapes category, gender, age group and subcategory accurately
Uses Secret Manager for Gemini authentication
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

# ✅ Import Secret Manager utilities for Gemini
try:
    from secret_manager import get_gemini_models
    credentials, text_model, image_model = get_gemini_models()
    GEMINI_AVAILABLE = True
    print("✅ Gemini initialized via Secret Manager", file=sys.stderr)
except Exception as e:
    print(f"⚠️ Warning: Could not initialize Gemini: {e}", file=sys.stderr)
    text_model = None
    GEMINI_AVAILABLE = False

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

PROXIES = {
    "http": "http://username:password@host:port",
    "https": "http://username:password@host:port"
}

ALLOWED_GENDERS = ["Boys", "Women", "Baby Boys", "Baby Girls", "Girl", "Men", "Unisex"]
ALLOWED_AGE_GROUPS = ["Kids", "Adults", "All Ages"]


def fetch_html(url):
    try:
        session = requests.Session()
        session.headers.update(HEADERS)

        # FIX: apply proxy only if real (logic preserved)
        if (
            PROXIES.get("http")
            and "username:password@host:port" not in PROXIES.get("http", "")
        ):
            session.proxies.update(PROXIES)

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

        # FIX: removed verify=False (bot fingerprint)
        resp = session.get(url, timeout=20)
        resp.raise_for_status()

        lower = resp.text.lower()

        # FIX: CAPTCHA must HARD FAIL
        if "captcha" in lower or "robot check" in lower:
            print(f"❌ CAPTCHA detected for {url}", file=sys.stderr)
            return None

        return resp.text

    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching URL {url}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching URL: {e}", file=sys.stderr)
        return None
    

def fetch_html_with_playwright(url):
    """
    Fallback browser fetch using Playwright
    Used ONLY when requests-based fetch is blocked
    """
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            )

            context = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1366, "height": 768},
                locale="en-US"
            )

            page = context.new_page()

            page.goto(url, wait_until="domcontentloaded", timeout=45000)

            # Hard wait for Amazon JS
            page.wait_for_timeout(3000)

            html = page.content()

            browser.close()

            # Detect captcha even in browser
            if "captcha" in html.lower() or "robot" in html.lower():
                print("❌ CAPTCHA even in Playwright", file=sys.stderr)
                return None

            print("✅ HTML fetched via Playwright", file=sys.stderr)
            return html

    except Exception as e:
        print(f"❌ Playwright fetch failed: {e}", file=sys.stderr)
        return None



def parse_amazon(html_text):
    if not html_text:
        return "", [], []

    try:
        soup = BeautifulSoup(html_text, "html.parser")

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
                if text and len(text) > 3:
                    bullets.append(text)

        bullets = list(dict.fromkeys(bullets))

        breadcrumbs = []
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
                        text = re.sub(r'\s+', ' ', text).strip()
                        breadcrumbs.append(text)
                if breadcrumbs:
                    break

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

        if not breadcrumbs:
            hidden_cats = soup.find_all("span", {"class": "a-list-item"})
            for cat in hidden_cats:
                text = cat.get_text(strip=True)
                if 'category' in text.lower() or 'department' in text.lower():
                    matches = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', text)
                    if matches:
                        breadcrumbs = matches
                        break

        breadcrumbs = [bc for bc in breadcrumbs if bc and len(bc) > 1]
        breadcrumbs = list(dict.fromkeys(breadcrumbs))

        irrelevant = ['see more', 'home', 'all departments', 'main menu', 'shop by department']
        breadcrumbs = [bc for bc in breadcrumbs if bc.lower() not in irrelevant]

        print(f"✅ Extracted {len(breadcrumbs)} breadcrumbs: {breadcrumbs}", file=sys.stderr)
        return title, bullets, breadcrumbs

    except Exception as e:
        print(f"❌ Error parsing HTML: {e}", file=sys.stderr)
        return "", [], []


def call_gemini(prompt_text):
    """Call Gemini API using initialized model from Secret Manager."""
    if not GEMINI_AVAILABLE or text_model is None:
        raise Exception("Gemini model not initialized")

    try:
        from google.generativeai import types
        
        response = text_model.generate_content(
            prompt_text,
            generation_config=types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,
            ),
        )
        
        if response and hasattr(response, 'text'):
            return {"candidates": [{"content": {"parts": [{"text": response.text}]}}]}
        else:
            raise Exception("No response from Gemini")
    
    except Exception as e:
        print(f"❌ Error calling Gemini: {e}", file=sys.stderr)
        raise


def extract_json_from_response(resp):
    try:
        text = resp["candidates"][0]["content"]["parts"][0]["text"]
    except:
        return {"error": "Malformed Gemini response"}

    text = text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except:
            pass

    return {"error": "Invalid JSON returned", "raw": text[:200]}


def normalize_gender(g):
    if not g or g.lower() == "unknown":
        return "unknown"

    g_low = g.lower()

    # FIX: extended mapping (non-breaking)
    if "lady" in g_low or "female" in g_low:
        return "Women"

    if "unisex" in g_low or "all" in g_low or "universal" in g_low:
        return "Unisex"

    if "baby boy" in g_low or "infant boy" in g_low:
        return "Baby Boys"
    if "baby girl" in g_low or "infant girl" in g_low:
        return "Baby Girls"

    if "boys" in g_low or g_low == "boy" or "boy's" in g_low:
        return "Boys"
    if "girls" in g_low or g_low == "girl" or "girl's" in g_low:
        return "Girl"

    if "women" in g_low or "woman" in g_low or "women's" in g_low or "woman's" in g_low:
        return "Women"
    if "men" in g_low or "man" in g_low or "men's" in g_low or "man's" in g_low:
        return "Men"

    return "unknown"


def normalize_age_group(gender, title, bullets, breadcrumbs):
    all_text = (title + " " + " ".join(bullets) + " " + " ".join(breadcrumbs)).lower()

    kids_keywords = ["kid", "boys", "girls", "child", "children", "toddler", "baby", "infant", "preschool", "teen", "youth"]
    adult_keywords = ["adult", "men", "women", "man", "woman", "grown", "mature"]

    for bc in breadcrumbs:
        bc_low = bc.lower()
        if any(k in bc_low for k in kids_keywords):
            return "Kids"
        if any(k in bc_low for k in adult_keywords):
            return "Adults"

    if gender in ["Boys", "Girl", "Baby Boys", "Baby Girls"]:
        return "Kids"
    if gender in ["Men", "Women"]:
        return "Adults"

    if any(k in all_text for k in kids_keywords):
        return "Kids"
    if any(k in all_text for k in adult_keywords):
        return "Adults"

    if "baby" in title.lower() or "toddler" in title.lower() or "infant" in title.lower():
        return "Kids"

    return "Adults"


def extract_category_from_breadcrumbs(breadcrumbs):
    """
    Extract category (1st/root value) and subcategory (last value) from breadcrumbs.
    Example: ['Home & Kitchen', 'Kitchen & Home Appliances', 'Coffee, Tea & Espresso', 'Coffee Maker Accessories', 'Measuring Spoons']
    Should return: ('Home & Kitchen', 'Measuring Spoons')
    """
    if not breadcrumbs:
        return "unknown", "unknown"
    
    # Category is the first breadcrumb (root value)
    category = breadcrumbs[0]
    
    # Subcategory is the last breadcrumb
    subcategory = breadcrumbs[-1]
    
    print(f"📁 Extracted category: {category}, subcategory: {subcategory}", file=sys.stderr)
    return category, subcategory


def extract_department_from_breadcrumbs(breadcrumbs, category):
    """
    Extract department from breadcrumbs - simply return the 2nd value as-is from Amazon.
    Example: ['Home & Kitchen', 'Kitchen & Home Appliances', 'Coffee, Tea & Espresso', 'Coffee Maker Accessories', 'Measuring Spoons']
    Should return: 'Kitchen & Home Appliances' (the 2nd breadcrumb)
    """
    if not breadcrumbs or len(breadcrumbs) < 2:
        return "unknown"
    
    # Simply return the second breadcrumb as the department (no mapping)
    department = breadcrumbs[1]
    print(f"🏠 Extracted department: {department}", file=sys.stderr)
    return department



def classify_product_simple(title, bullets, breadcrumbs):
    category, subcategory = extract_category_from_breadcrumbs(breadcrumbs)
    department = extract_department_from_breadcrumbs(breadcrumbs, category)

    gender_raw = "unknown"
    for bc in breadcrumbs:
        bc_low = bc.lower()
        if any(g in bc_low for g in ["men", "women", "boys", "girls", "boy", "girl", "baby", "unisex"]):
            gender_raw = bc
            break

    if gender_raw == "unknown":
        title_low = title.lower()
        if "men" in title_low:
            gender_raw = "Men"
        elif "women" in title_low:
            gender_raw = "Women"
        elif "boys" in title_low:
            gender_raw = "Boys"
        elif "girls" in title_low:
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
        "department": department,
        "age_group": age_group,
        "note": "simple_fallback"
    }


def classify_product_with_gemini(title, bullets, breadcrumbs):
    """Classify product using Gemini if available, otherwise use simple classification."""
    # Guard against empty input
    if not title and not breadcrumbs:
        return classify_product_simple(title, bullets, breadcrumbs)

    # Use simple classification if Gemini not available
    if not GEMINI_AVAILABLE:
        return classify_product_simple(title, bullets, breadcrumbs)

    category, subcategory = extract_category_from_breadcrumbs(breadcrumbs)
    department = extract_department_from_breadcrumbs(breadcrumbs, category)

    gender_raw = "unknown"
    all_text = (title + " " + " ".join(bullets) + " " + " ".join(breadcrumbs)).lower()

    if "men" in all_text:
        gender_raw = "Men"
    elif "women" in all_text:
        gender_raw = "Women"
    elif "boys" in all_text:
        gender_raw = "Boys"
    elif "girls" in all_text:
        gender_raw = "Girl"
    elif "baby boy" in all_text:
        gender_raw = "Baby Boys"
    elif "baby girl" in all_text:
        gender_raw = "Baby Girls"
    elif "unisex" in all_text:
        gender_raw = "Unisex"

    gender = normalize_gender(gender_raw)

    product_info = f"""
PRODUCT INFORMATION:
Title: {title}

Key Features:
{chr(10).join(['- ' + b for b in bullets[:5]])}

Product Categories (breadcrumbs):
{chr(10).join(['> ' + bc for bc in breadcrumbs])}

Current Analysis:
- Likely Category: {category}
- Likely Department: {department}
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

{product_info}

Return ONLY a JSON object with these exact keys:
{{
 "gender": "<gender>",
 "category": "<category>",
 "subcategory": "<subcategory>",
 "age_group": "<age_group>",
 "confidence": "<high/medium/low>"
}}
"""

    try:
        resp = call_gemini(prompt)
        parsed = extract_json_from_response(resp)

        if "error" in parsed:
            return classify_product_simple(title, bullets, breadcrumbs)

        parsed["gender"] = normalize_gender(parsed.get("gender", gender))
        if parsed.get("age_group") not in ALLOWED_AGE_GROUPS:
            parsed["age_group"] = normalize_age_group(parsed["gender"], title, bullets, breadcrumbs)

        parsed["category"] = parsed.get("category") or category
        parsed["subcategory"] = parsed.get("subcategory") or subcategory
        parsed["department"] = department  # Always use extracted department
        parsed["note"] = "gemini_classified"
        parsed["confidence"] = parsed.get("confidence", "medium")

        return parsed

    except Exception:
        return classify_product_simple(title, bullets, breadcrumbs)


def scrape_amazon_metadata(asin):
    try:
        url = f"https://www.amazon.in/dp/{asin}"
        print(f"🔍 Fetching URL: {url}", file=sys.stderr)

        html_text = fetch_html(url)

        # 🔁 Fallback to Playwright if blocked
        if not html_text:
            print("🔁 Falling back to Playwright...", file=sys.stderr)
            html_text = fetch_html_with_playwright(url)

        if not html_text:
            print(f"❌ Failed to fetch HTML even with Playwright for ASIN {asin}", file=sys.stderr)
            return {
                "success": False,
                "asin": asin,
                "error": "Failed to fetch HTML (blocked)",
                "category": "unknown",
                "gender": "unknown",
                "age_group": "Adults",
                "subcategory": "unknown",
                "department": "unknown",
                "title": "",
                "breadcrumbs": []
            }

        title, bullets, breadcrumbs = parse_amazon(html_text)

        # FIX: logical retry once if title missing
        if not title:
            html_text = fetch_html(url)
            if html_text:
                title, bullets, breadcrumbs = parse_amazon(html_text)

        result = classify_product_with_gemini(title, bullets, breadcrumbs)

        return {
            "success": True,
            "asin": asin,
            "url": url,
            "title": title,
            "category": result.get("category", "unknown"),
            "gender": result.get("gender", "unknown"),
            "age_group": result.get("age_group", "Adults"),
            "subcategory": result.get("subcategory", "unknown"),
            "department": result.get("department", "unknown"),
            "breadcrumbs": breadcrumbs,
            "bullets": bullets[:10],
            "classification_note": result.get("note", "unknown"),
            "confidence": result.get("confidence", "medium"),
            "raw_breadcrumbs_count": len(breadcrumbs)
        }

    except Exception as e:
        print(f"❌ Error scraping metadata for ASIN {asin}: {e}", file=sys.stderr)
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
            "department": "unknown",
            "title": "",
            "breadcrumbs": []
        }


def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    asin = sys.argv[1]
    print(f"🚀 Starting scrape for ASIN: {asin}", file=sys.stderr)

    result = scrape_amazon_metadata(asin)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

