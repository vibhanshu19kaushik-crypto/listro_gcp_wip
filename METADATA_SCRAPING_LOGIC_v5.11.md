# Metadata Scraping Logic - v5.11 (Current Working Version)

**Date**: January 29, 2026  
**Purpose**: Document current metadata scraping implementation for "Load Metadata ASIN" feature

---

## Overview

The metadata scraping extracts **Category, Gender, Age Group, Department, and Subcategory** from Amazon product pages using breadcrumb navigation and intelligent classification.

---

## Architecture

### Files Involved
1. **`backend/amz_metadata_scraper.py`** - Main scraper logic
2. **`backend/python-server.py`** - Flask endpoint at `/api/scrape-metadata-from-asin`

### Endpoint Details

**Endpoint**: `POST /api/scrape-metadata-from-asin`

**Request Body**:
```json
{
  "asin": "B00E96GRDK"
}
```

**Response (Clothing Products)**:
```json
{
  "success": true,
  "asin": "B00E96GRDK",
  "url": "https://www.amazon.in/dp/B00E96GRDK",
  "title": "Product Title",
  "category": "Clothing & Accessories",
  "gender": "Men",
  "age_group": "Adults",
  "subcategory": "T-Shirts",
  "breadcrumbs": ["Clothing & Accessories", "Men", "T-Shirts & Polos", "T-Shirts"],
  "is_clothing": true
}
```

**Response (Non-Clothing Products)**:
```json
{
  "success": true,
  "asin": "B07ABC123",
  "url": "https://www.amazon.in/dp/B07ABC123",
  "title": "Product Title",
  "category": "Home & Kitchen",
  "department": "Kitchen & Home Appliances",
  "subcategory": "Coffee Maker Accessories",
  "breadcrumbs": ["Home & Kitchen", "Kitchen & Home Appliances", "Coffee, Tea & Espresso", "Coffee Maker Accessories", "Measuring Spoons"],
  "is_clothing": false
}
```

---

## Scraping Strategy (Dual Fetch)

### Step 1: Try Requests Library First
```python
def fetch_html(url):
    # Use requests with:
    # - User-Agent rotation
    # - Exponential backoff (2 retries)
    # - Anti-blocking headers
    # - CAPTCHA detection
```

### Step 2: Fallback to Selenium
```python
def fetch_html_with_selenium(url):
    # If requests blocked, use Selenium with:
    # - Headless Chrome
    # - Realistic user-agent
    # - Page scrolling to trigger lazy loading
    # - Anti-automation detection bypass
```

**Key Point**: Same dual strategy as image scraper - requests first for speed, Selenium as fallback when blocked.

---

## Breadcrumb Extraction Logic

### Primary Selectors (in order of priority):
```python
bc_selectors = [
    "#wayfinding-breadcrumbs_feature_div",      # Main breadcrumb container
    "#wayfinding-breadcrumbs_container",        # Alternative container
    ".a-breadcrumb",                            # Generic breadcrumb class
    "#nav-breadcrumb",                          # Navigation breadcrumb
    "ul.a-unordered-list.a-horizontal.a-size-small"  # List format
]
```

### Fallback Extraction Methods:
1. **Detail Bullets Section**: Extract from `#detailBullets_feature_div` looking for "category" or "department" keywords
2. **Hidden Categories**: Search `span.a-list-item` for category mentions
3. **Pattern Matching**: Regex extraction of capitalized category names

### Breadcrumb Cleaning:
```python
# Remove irrelevant entries
irrelevant = ['see more', 'home', 'all departments', 'main menu', 'shop by department']
breadcrumbs = [bc for bc in breadcrumbs if bc.lower() not in irrelevant]

# Remove duplicates while preserving order
breadcrumbs = list(dict.fromkeys(breadcrumbs))
```

---

## Category/Subcategory/Department Extraction

### Function: `extract_category_from_breadcrumbs(breadcrumbs)`

**Logic**:
```python
# Category = First breadcrumb (root category)
category = breadcrumbs[0]

# Subcategory = Last breadcrumb (most specific)
subcategory = breadcrumbs[-1]
```

**Example**:
```python
breadcrumbs = ['Home & Kitchen', 'Kitchen & Home Appliances', 'Coffee, Tea & Espresso', 'Coffee Maker Accessories', 'Measuring Spoons']

category = 'Home & Kitchen'        # First item
subcategory = 'Measuring Spoons'   # Last item
```

### Function: `extract_department_from_breadcrumbs(breadcrumbs, category)`

**Logic**:
```python
# Department = Second breadcrumb (only for non-clothing)
department = breadcrumbs[1] if len(breadcrumbs) >= 2 else "unknown"
```

**Example**:
```python
breadcrumbs = ['Home & Kitchen', 'Kitchen & Home Appliances', 'Coffee, Tea & Espresso']

department = 'Kitchen & Home Appliances'  # Second item
```

---

## Clothing vs Non-Clothing Logic

### Detection:
```python
clothing_categories = [
    "clothing", "fashion", "shoes", "bags", "accessories", 
    "jewellery", "watches", "luggage", "handbags", "apparel"
]
is_clothing = any(keyword in category.lower() for keyword in clothing_categories)
```

### Return Fields:

**IF CLOTHING** (`is_clothing = True`):
- `category` (e.g., "Clothing & Accessories")
- `gender` (e.g., "Men", "Women", "Boys", "Girl", "Baby Boys", "Baby Girls", "Unisex")
- `age_group` (e.g., "Adults", "Kids", "All Ages")
- `subcategory` (e.g., "T-Shirts")
- `is_clothing: true`

**IF NON-CLOTHING** (`is_clothing = False`):
- `category` (e.g., "Home & Kitchen")
- `department` (e.g., "Kitchen & Home Appliances")
- `subcategory` (e.g., "Coffee Maker Accessories")
- `is_clothing: false`
- NO gender/age_group fields

---

## Gender Classification (Clothing Only)

### Function: `normalize_gender(g)`

**Allowed Values**:
```python
ALLOWED_GENDERS = ["Boys", "Women", "Baby Boys", "Baby Girls", "Girl", "Men", "Unisex"]
```

**Normalization Logic**:
```python
# Extended mapping
"lady" or "female" → "Women"
"baby boy" or "infant boy" → "Baby Boys"
"baby girl" or "infant girl" → "Baby Girls"
"boys" or "boy" → "Boys"
"girls" or "girl" → "Girl"
"women" or "woman" → "Women"
"men" or "man" → "Men"
"unisex" or "all" or "universal" → "Unisex"
```

### Extraction Sources (in order):
1. **Breadcrumbs**: Check if any breadcrumb contains gender keywords
2. **Title**: Check product title for gender mentions
3. **Gemini AI** (if available): Use AI classification with prompt
4. **Simple Fallback**: Default to "unknown"

---

## Age Group Classification (Clothing Only)

### Function: `normalize_age_group(gender, title, bullets, breadcrumbs)`

**Allowed Values**:
```python
ALLOWED_AGE_GROUPS = ["Kids", "Adults", "All Ages"]
```

**Logic**:
```python
# 1. Check breadcrumbs first (highest priority)
kids_keywords = ["kid", "boys", "girls", "child", "children", "toddler", "baby", "infant", "preschool", "teen", "youth"]
adult_keywords = ["adult", "men", "women", "man", "woman", "grown", "mature"]

# 2. Infer from gender
if gender in ["Boys", "Girl", "Baby Boys", "Baby Girls"]:
    return "Kids"
if gender in ["Men", "Women"]:
    return "Adults"

# 3. Check all text (title + bullets + breadcrumbs)
if any(keyword in all_text for keyword in kids_keywords):
    return "Kids"
if any(keyword in all_text for keyword in adult_keywords):
    return "Adults"

# 4. Default fallback
return "Adults"
```

---

## Gemini AI Classification (Optional)

### Function: `classify_product_with_gemini(title, bullets, breadcrumbs)`

**When Used**: For clothing products only, to improve gender/age group accuracy

**Prompt Structure**:
```
You are an expert Amazon product classifier.

PRODUCT INFORMATION:
Title: {title}
Key Features: {bullets}
Product Categories: {breadcrumbs}

IMPORTANT RULES:
1. Gender MUST be one of: Boys, Women, Baby Boys, Baby Girls, Girl, Men, Unisex
2. Age Group MUST be one of: Kids, Adults, All Ages
3. Category should be main category (from breadcrumbs)
4. Subcategory should be most specific type

Return ONLY a JSON object:
{
  "gender": "<gender>",
  "category": "<category>",
  "subcategory": "<subcategory>",
  "age_group": "<age_group>",
  "confidence": "<high/medium/low>"
}
```

**Fallback**: If Gemini fails or unavailable, use `classify_product_simple()`

---

## Error Handling

### Error Types:
1. **`blocked`**: Page fetch failed after all retries
2. **`invalid_asin`**: 404 page not found
3. **`unavailable`**: Product currently unavailable
4. **`scraper_error`**: Unexpected error during scraping

### Resilience Features:
- Continue even if breadcrumbs empty (use title for classification)
- Continue even if only partial data extracted
- Multiple fallback extraction methods
- Graceful degradation when Gemini unavailable

---

## Key Implementation Details

### 1. Secret Manager Integration
```python
from secret_manager import get_gemini_models
credentials, text_model, image_model = get_gemini_models()
```

### 2. User-Agent Rotation
```python
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) Chrome/114.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/116.0"
]
```

### 3. Exponential Backoff
```python
SCRAPER_MAX_RETRIES = 2
SCRAPER_BACKOFF_FACTOR = 1.0
backoff = SCRAPER_BACKOFF_FACTOR * (2 ** (attempt - 1))
jitter = random.uniform(0, 1)
sleep_time = backoff + jitter
```

---

## Python Server Endpoint Integration

### Location: `backend/python-server.py`

```python
@app.route('/api/scrape-metadata-from-asin', methods=['POST'])
def scrape_metadata_from_asin():
    try:
        data = request.get_json()
        asin = data.get('asin')
        
        if not asin:
            return jsonify({"success": False, "error": "ASIN is required"}), 400
        
        # Import scraper
        from amz_metadata_scraper import scrape_amazon_metadata
        
        # Call scraper
        result = scrape_amazon_metadata(asin)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Metadata scraping failed: {str(e)}"
        }), 500
```

---

## Summary of Key Logic

1. **Dual Fetch Strategy**: Requests → Selenium fallback (same as image scraper)
2. **Breadcrumb Priority**: wayfinding-breadcrumbs → detail bullets → hidden categories
3. **Category**: First breadcrumb (root)
4. **Subcategory**: Last breadcrumb (most specific)
5. **Department**: Second breadcrumb (non-clothing only)
6. **Clothing Detection**: Check category against clothing keywords
7. **Gender/Age Group**: Only for clothing products
8. **Gemini AI**: Optional enhancement for better classification
9. **Error Resilience**: Continue with partial data, multiple fallbacks

---

## Testing Examples

### Example 1: Clothing Product
```bash
curl -X POST http://localhost:8080/api/scrape-metadata-from-asin \
  -H "Content-Type: application/json" \
  -d '{"asin": "B07XYZ123"}'
```

Expected: `category`, `gender`, `age_group`, `subcategory`, `is_clothing: true`

### Example 2: Non-Clothing Product
```bash
curl -X POST http://localhost:8080/api/scrape-metadata-from-asin \
  -H "Content-Type: application/json" \
  -d '{"asin": "B00E96GRDK"}'
```

Expected: `category`, `department`, `subcategory`, `is_clothing: false`

---

## Files to Apply This Logic To (After Code Restore)

1. **`backend/amz_metadata_scraper.py`**:
   - Implement dual fetch (requests + Selenium)
   - Breadcrumb extraction with multiple selectors
   - `extract_category_from_breadcrumbs()`: category = first, subcategory = last
   - `extract_department_from_breadcrumbs()`: department = second
   - Clothing vs non-clothing detection
   - Gender/age group classification

2. **`backend/python-server.py`**:
   - Ensure `/api/scrape-metadata-from-asin` endpoint exists
   - Import and call `scrape_amazon_metadata(asin)`
   - Return proper JSON response

---

**End of Documentation**
