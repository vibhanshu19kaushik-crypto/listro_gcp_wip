#!/usr/bin/env python3
"""
Amazon Scraper for Web Interface
- Returns structured JSON data
- Enhanced with anti-blocking techniques
"""

import os
import requests
from bs4 import BeautifulSoup
import sys
import re
import json
import time
import random

# Enhanced headers to mimic real browser behavior
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "DNT": "1",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"'
}

def is_valid_product_image(url):
    """Validate if URL is likely a real product image (not icon/sprite)"""
    if not url or 'http' not in url:
        return False
    
    # Exclude common non-product images
    exclude_patterns = [
        'sprite', 'icon', 'logo', 'arrow', 'pixel', 
        'transparent', 'badge', 'star', 'prime', 'nav-', 
        'btn-', 'button', '1x1', 'spacer'
    ]
    
    if any(pattern in url.lower() for pattern in exclude_patterns):
        return False
    
    # Must be from Amazon CDN
    valid_domains = [
        'images-na.ssl-images-amazon.com',
        'm.media-amazon.com',
        'images-amazon.com'
    ]
    
    if not any(domain in url for domain in valid_domains):
        return False
    
    # Should have image extension or format indicator
    if not re.search(r'\.(jpg|jpeg|png|webp)|/images/I/', url, re.IGNORECASE):
        return False
    
    return True

def detect_category_from_page(soup):
    """Detect product category from page breadcrumbs or department"""
    try:
        # Method 1: Check breadcrumbs
        breadcrumb = soup.find("div", id="wayfinding-breadcrumbs_feature_div")
        if breadcrumb:
            breadcrumb_text = breadcrumb.get_text().lower()
            if any(keyword in breadcrumb_text for keyword in ['home', 'kitchen', 'appliance', 'furniture', 'décor']):
                return 'Home & Kitchen'
            if any(keyword in breadcrumb_text for keyword in ['clothing', 'fashion', 'accessories', 'apparel']):
                return 'Clothing & Accessories'
        
        # Method 2: Check navigation links
        nav_links = soup.find_all("a", class_="a-link-normal")
        for link in nav_links[:10]:  # Check first 10 links
            link_text = link.get_text().lower()
            if any(keyword in link_text for keyword in ['home & kitchen', 'home kitchen', 'kitchen & dining']):
                return 'Home & Kitchen'
        
        return 'Unknown'
    except:
        return 'Unknown'

def extract_product_overview(soup):
    """Extract Product Overview section from productOverview_feature_div"""
    product_overview = {}
    
    print("📋 Extracting Product Overview...", file=sys.stderr)
    
    try:
        # Find the productOverview_feature_div element
        overview_div = soup.find("div", {"id": "productOverview_feature_div"})
        
        if overview_div:
            print("   ✅ Found productOverview_feature_div", file=sys.stderr)
            
            # Look for table with product overview data
            table = overview_div.find("table")
            if table:
                # Extract all rows from the table
                rows = table.find_all("tr")
                for row in rows:
                    # Find key (th or td with class containing 'label' or first td)
                    cells = row.find_all(["th", "td"])
                    if len(cells) >= 2:
                        key = cells[0].get_text(strip=True)
                        value = cells[1].get_text(strip=True)
                        if key and value:
                            product_overview[key] = value
                            print(f"   Product Overview - {key}: {value[:50]}...", file=sys.stderr)
            else:
                # Try alternative extraction - look for divs with key-value pairs
                divs = overview_div.find_all("div", class_=lambda x: x and "po-" in str(x))
                for div in divs:
                    spans = div.find_all("span")
                    if len(spans) >= 2:
                        key = spans[0].get_text(strip=True)
                        value = spans[1].get_text(strip=True)
                        if key and value:
                            product_overview[key] = value
                            print(f"   Product Overview - {key}: {value[:50]}...", file=sys.stderr)
            
            print(f"✅ Total Product Overview items: {len(product_overview)}", file=sys.stderr)
        else:
            print("   ⚠️ productOverview_feature_div not found", file=sys.stderr)
    
    except Exception as e:
        print(f"⚠️ Error extracting product overview: {e}", file=sys.stderr)
    
    return product_overview

def extract_product_information_with_subsections(soup):
    """Extract Product Information section with all subsections dynamically (excluding Feedback)"""
    product_information = {}
    
    print("📋 Extracting Product Information with subsections...", file=sys.stderr)
    
    try:
        # Find the main product details section (prodDetails)
        prod_details = soup.find("div", {"id": "prodDetails"})
        
        if not prod_details:
            print("   ⚠️ prodDetails section not found", file=sys.stderr)
            return product_information
        
        print("   ✅ Found prodDetails section", file=sys.stderr)
        
        # Find all h2 headings which indicate subsections
        subsection_headings = prod_details.find_all("h2")
        
        for heading in subsection_headings:
            subsection_name = heading.get_text(strip=True)
            
            # Skip Feedback section
            if "feedback" in subsection_name.lower():
                print(f"   ⏭️ Skipping Feedback section", file=sys.stderr)
                continue
            
            print(f"   📌 Processing subsection: {subsection_name}", file=sys.stderr)
            
            # Initialize subsection data
            subsection_data = {}
            
            # Find the next table after this heading
            current_element = heading.find_next_sibling()
            
            while current_element and current_element.name not in ['h1', 'h2', 'h3']:
                # Check if it's a table
                if current_element.name == 'table':
                    rows = current_element.find_all("tr")
                    for row in rows:
                        th = row.find("th")
                        td = row.find("td")
                        if th and td:
                            key = th.get_text(strip=True)
                            value = td.get_text(strip=True)
                            # Skip review/rank related items
                            if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                                subsection_data[key] = value
                                print(f"      {subsection_name} - {key}: {value[:50]}...", file=sys.stderr)
                
                # Move to next sibling
                current_element = current_element.find_next_sibling()
            
            # Add subsection to product_information if data was found
            if subsection_data:
                product_information[subsection_name] = subsection_data
                print(f"   ✅ {subsection_name}: {len(subsection_data)} items", file=sys.stderr)
            else:
                print(f"   ⚠️ {subsection_name}: No data found", file=sys.stderr)
        
        print(f"✅ Total Product Information subsections: {len(product_information)}", file=sys.stderr)
    
    except Exception as e:
        print(f"⚠️ Error extracting product information with subsections: {e}", file=sys.stderr)
    
    return product_information

def extract_more_product_details(soup):
    """Extract More Product Details from detailBulletsWithExceptions_feature_V2 section"""
    more_details = {}
    
    print("📋 Extracting More Product Details (detailBulletsWithExceptions)...", file=sys.stderr)
    
    try:
        # Find the detailBulletsWithExceptions_feature_V2 div
        detail_bullets_div = soup.find("div", {"id": "detailBulletsWrapper_feature_div"})
        
        if not detail_bullets_div:
            # Try alternative ID
            detail_bullets_div = soup.find("div", {"id": "detailBullets_feature_div"})
        
        if detail_bullets_div:
            print("   ✅ Found detailBullets section", file=sys.stderr)
            
            # Look for all list items containing key-value pairs
            list_items = detail_bullets_div.find_all("li")
            
            for item in list_items:
                # Get the full text of the list item
                full_text = item.get_text(strip=True)
                
                # Try to split by colon to separate key and value
                if ':' in full_text:
                    parts = full_text.split(':', 1)  # Split only on first colon
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = parts[1].strip()
                        
                        # Skip if key or value is empty
                        if key and value:
                            # Skip certain items we don't want
                            skip_items = ["Best Sellers Rank", "Customer Reviews", "Date First Available"]
                            if not any(skip in key for skip in skip_items):
                                more_details[key] = value
                                print(f"   More Product Details - {key}: {value[:50]}...", file=sys.stderr)
                else:
                    # Alternative: Try to find spans with class that might indicate key/value
                    spans = item.find_all("span")
                    if len(spans) >= 2:
                        # First span (usually bold) is the key
                        key_span = spans[0]
                        key_text = key_span.get_text(strip=True)
                        
                        # Remove colon from key
                        key = key_text.rstrip(':').strip()
                        
                        # Second span is the value
                        value_span = spans[1]
                        value = value_span.get_text(strip=True)
                        
                        if key and value:
                            skip_items = ["Best Sellers Rank", "Customer Reviews", "Date First Available"]
                            if not any(skip in key for skip in skip_items):
                                more_details[key] = value
                                print(f"   More Product Details - {key}: {value[:50]}...", file=sys.stderr)
            
            print(f"✅ Total More Product Details items: {len(more_details)}", file=sys.stderr)
        else:
            print("   ⚠️ detailBullets section not found", file=sys.stderr)
    
    except Exception as e:
        print(f"⚠️ Error extracting more product details: {e}", file=sys.stderr)
    
    return more_details

def extract_home_kitchen_details(soup):
    """Extract Product Information section with Technical Details, Additional Information, and What's in the box for Home & Kitchen"""
    technical_details = {}
    additional_info = {}
    whats_in_box = ""
    product_information_heading = ""
    product_details_list = {}  # The bottom list without heading
    
    print("🏠 Extracting Home & Kitchen specific details...", file=sys.stderr)
    
    # Extract "Product information" heading (the main section heading on Amazon)
    try:
        prod_details_section = soup.find("div", {"id": "prodDetails"})
        if prod_details_section:
            h2_heading = prod_details_section.find("h2")
            if h2_heading:
                product_information_heading = h2_heading.get_text(strip=True)
                print(f"📋 Product Information Heading: '{product_information_heading}'", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting product information heading: {e}", file=sys.stderr)
    
    # Extract Technical Details (from Product Information > Technical Details table)
    # This is the table with ID "productDetails_techSpec_section_1"
    try:
        print("📋 Extracting Technical Details (Product Information section)...", file=sys.stderr)
        tech_table = soup.find("table", {"id": "productDetails_techSpec_section_1"})
        if tech_table:
            print("   ✅ Found Technical Details table", file=sys.stderr)
            rows = tech_table.find_all("tr")
            for row in rows:
                th = row.find("th")
                td = row.find("td")
                if th and td:
                    key = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                        technical_details[key] = value
                        print(f"   Tech Detail - {key}: {value[:50]}...", file=sys.stderr)
        else:
            print("   ⚠️ Technical Details table not found", file=sys.stderr)
        
        print(f"✅ Total Technical Details: {len(technical_details)} items", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting technical details: {e}", file=sys.stderr)
    
    # Extract Additional Information (from Product Information > Additional Information table)
    # This is the table with ID "productDetails_detailBullets_sections1"
    try:
        print("📋 Extracting Additional Information (Product Information section)...", file=sys.stderr)
        additional_info_table = soup.find("table", {"id": "productDetails_detailBullets_sections1"})
        if additional_info_table:
            print("   ✅ Found Additional Information table", file=sys.stderr)
            rows = additional_info_table.find_all("tr")
            for row in rows:
                th = row.find("th")
                td = row.find("td")
                if th and td:
                    key = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                        additional_info[key] = value
                        print(f"   Additional Info - {key}: {value[:50]}...", file=sys.stderr)
        else:
            print("   ⚠️ Additional Information table not found", file=sys.stderr)
        
        print(f"✅ Total Additional Information: {len(additional_info)} items", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting additional information: {e}", file=sys.stderr)
    
    # Extract Product Details List (the bottom list, no heading shown on UI)
    # This is from detailBulletsWrapper_feature_div or similar sections
    try:
        print("📋 Extracting Product Details List (bottom section)...", file=sys.stderr)
        
        # Method 1: detailBulletsWrapper_feature_div
        detail_bullets = soup.find("div", {"id": "detailBulletsWrapper_feature_div"})
        if detail_bullets:
            print("   ✅ Found detailBulletsWrapper section", file=sys.stderr)
            list_items = detail_bullets.find_all("li")
            for li in list_items:
                key_span = li.find("span", class_="a-text-bold")
                if key_span:
                    key = key_span.get_text(strip=True).rstrip(":")
                    full_text = li.get_text(strip=True)
                    value = full_text.replace(key_span.get_text(strip=True), "").strip(": ")
                    if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                        product_details_list[key] = value
                        print(f"   Product Detail - {key}: {value[:50]}...", file=sys.stderr)
        
        # Method 2: Check product details section with unordered lists
        product_details_section = soup.find("div", {"id": "productDetails_feature_div"})
        if product_details_section:
            lists = product_details_section.find_all("ul", class_="a-unordered-list")
            for ul in lists:
                list_items = ul.find_all("li")
                for li in list_items:
                    text = li.get_text(strip=True)
                    if ":" in text:
                        parts = text.split(":", 1)
                        if len(parts) == 2:
                            key = parts[0].strip()
                            value = parts[1].strip()
                            if key and value and key not in product_details_list:
                                product_details_list[key] = value
                                print(f"   Product Detail - {key}: {value[:50]}...", file=sys.stderr)
        
        print(f"✅ Total Product Details List: {len(product_details_list)} items", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting product details list: {e}", file=sys.stderr)
    
    # Extract "What's in the box"
    try:
        print("📦 Searching for What's in the Box...", file=sys.stderr)
        
        # Method 0: NEW - Look for h2 heading "What is in the box?" and get all content under it
        h2_headings = soup.find_all('h2')
        for h2 in h2_headings:
            h2_text = h2.get_text(strip=True)
            if re.search(r"What'?s?\s+(?:is\s+)?in\s+the\s+(?:box|package)", h2_text, re.IGNORECASE):
                print(f"   Found h2 heading: '{h2_text}'", file=sys.stderr)
                # Get all content after this heading until the next heading or section
                content_parts = []
                next_element = h2.find_next_sibling()
                while next_element and next_element.name not in ['h1', 'h2', 'h3', 'h4']:
                    elem_text = next_element.get_text(strip=True)
                    if elem_text:
                        content_parts.append(elem_text)
                    next_element = next_element.find_next_sibling()
                    # Stop after collecting a few elements to avoid getting too much
                    if len(content_parts) >= 5:
                        break
                
                if content_parts:
                    whats_in_box = ' | '.join(content_parts)
                    print(f"   ✅ What's in the box (from h2): {whats_in_box[:150]}...", file=sys.stderr)
                    break
        
        # Method 1: Look for specific section by text (original method)
        if not whats_in_box:
            whats_in_box_section = soup.find(string=re.compile(r"What'?s in the (box|Box|package|Package)", re.IGNORECASE))
            if whats_in_box_section:
                print("   Found 'What's in the Box' heading", file=sys.stderr)
                parent = whats_in_box_section.find_parent()
                if parent:
                    # Get the next sibling or content
                    content = parent.find_next_sibling()
                    if content:
                        whats_in_box = content.get_text(strip=True)
                        print(f"   ✅ What's in the box: {whats_in_box[:100]}...", file=sys.stderr)
                    else:
                        # Try getting content from within the parent
                        parent_text = parent.get_text(strip=True)
                        # Remove the heading text
                        whats_in_box = parent_text.replace(whats_in_box_section.strip(), "").strip()
                        if whats_in_box:
                            print(f"   ✅ What's in the box (from parent): {whats_in_box[:100]}...", file=sys.stderr)
        
        # Method 2: Check in technical details
        if not whats_in_box:
            print("   Checking technical details for package content...", file=sys.stderr)
            for key, value in list(technical_details.items()):
                if any(word in key.lower() for word in ['box', 'package', 'includes', 'included', 'components']):
                    whats_in_box = value
                    print(f"   ✅ What's in the box (from tech details key '{key}'): {whats_in_box[:100]}...", file=sys.stderr)
                    break
        
        # Method 3: Search in all text for pattern "What's in the box:" followed by content
        if not whats_in_box:
            print("   Searching entire page for 'What's in the box' pattern...", file=sys.stderr)
            page_text = soup.get_text()
            match = re.search(r"What'?s in the (?:box|package)[:\-\s]+([^\n]+)", page_text, re.IGNORECASE)
            if match:
                whats_in_box = match.group(1).strip()
                print(f"   ✅ What's in the box (from page text): {whats_in_box[:100]}...", file=sys.stderr)
        
        if not whats_in_box:
            print("   ❌ What's in the box: Not found on page", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting what's in the box: {e}", file=sys.stderr)
    
    # Extract Safety Information
    safety_info = ""
    try:
        print("⚠️ Searching for Safety Information...", file=sys.stderr)
        
        # Method 1: Look for Safety Information heading
        safety_section = soup.find(string=re.compile(r"Safety Information", re.IGNORECASE))
        if safety_section:
            print("   Found 'Safety Information' heading", file=sys.stderr)
            parent = safety_section.find_parent()
            if parent:
                # Get the next content (could be sibling or within parent)
                content = parent.find_next_sibling()
                if content:
                    safety_info = content.get_text(strip=True)
                    print(f"   ✅ Safety Information: {safety_info[:100]}...", file=sys.stderr)
                elif parent.parent:
                    # Sometimes content is in a div after the heading
                    next_div = parent.parent.find_next_sibling()
                    if next_div:
                        safety_info = next_div.get_text(strip=True)
                        print(f"   ✅ Safety Information (from parent): {safety_info[:100]}...", file=sys.stderr)
                else:
                    # Try getting from parent itself
                    parent_text = parent.get_text(strip=True)
                    safety_info = parent_text.replace(safety_section.strip(), "").strip()
                    if safety_info:
                        print(f"   ✅ Safety Information (from parent text): {safety_info[:100]}...", file=sys.stderr)
        
        # Method 2: Search in all text
        if not safety_info:
            print("   Searching entire page for 'Safety Information' pattern...", file=sys.stderr)
            page_text = soup.get_text()
            match = re.search(r"Safety Information[:\-\s]+([^\n]{10,200})", page_text, re.IGNORECASE)
            if match:
                safety_info = match.group(1).strip()
                print(f"   ✅ Safety Information (from page text): {safety_info[:100]}...", file=sys.stderr)
        
        if not safety_info:
            print("   ❌ Safety Information: Not found on page", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error extracting safety information: {e}", file=sys.stderr)
    
    return technical_details, additional_info, whats_in_box, safety_info, product_information_heading, product_details_list

def fetch_html_with_selenium(url):
    """
    Fallback browser fetch using Selenium (EXACTLY like amz_metadata_scraper)
    Used when requests-based fetch is blocked by Amazon
    """
    driver = None
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        import time as sel_time

        print("🌐 [SELENIUM] Initializing Selenium for product scraping...", file=sys.stderr)

        # Chrome options for headless mode
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--disable-software-rasterizer")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument(f"user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Use system chromium if available (for Cloud Run)
        chrome_bin = os.getenv("CHROME_BIN", "/usr/bin/chromium")
        chromedriver_path = os.getenv("CHROMEDRIVER_PATH", "/usr/bin/chromedriver")
        
        if os.path.exists(chrome_bin):
            chrome_options.binary_location = chrome_bin
            print(f"✅ [SELENIUM] Using system Chrome: {chrome_bin}", file=sys.stderr)
        
        # Initialize the driver
        if os.path.exists(chromedriver_path):
            service = Service(chromedriver_path)
            print(f"✅ [SELENIUM] Using system chromedriver: {chromedriver_path}", file=sys.stderr)
        else:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
            print(f"✅ [SELENIUM] Using webdriver-manager chromedriver", file=sys.stderr)
        
        driver = webdriver.Chrome(service=service, options=chrome_options)
        print(f"✅ [SELENIUM] WebDriver initialized", file=sys.stderr)

        # Load the page
        print(f"📄 [SELENIUM] Loading Amazon product page...", file=sys.stderr)
        driver.get(url)
        sel_time.sleep(4)  # Wait for initial load

        # Scroll through page to trigger lazy loading
        print(f"📜 [SELENIUM] Scrolling to load all content...", file=sys.stderr)
        for i in range(5):
            driver.execute_script("window.scrollBy(0, window.innerHeight);")
            sel_time.sleep(1)
        
        # Scroll back to top
        driver.execute_script("window.scrollTo(0, 0);")
        sel_time.sleep(2)

        # Get page source
        html = driver.page_source

        # Detect captcha
        if "captcha" in html.lower() or "robot check" in html.lower():
            print("❌ [SELENIUM] CAPTCHA detected", file=sys.stderr)
            return None

        print("✅ [SELENIUM] HTML fetched successfully via Selenium", file=sys.stderr)
        return html

    except Exception as e:
        print(f"❌ [SELENIUM] Selenium fetch failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass


def scrape_amazon_with_retry(url, max_retries=2):
    """Scrape with exponential backoff retry logic - max 2 attempts with Selenium fallback"""
    # Fix URL if missing scheme
    if url and not url.startswith(('http://', 'https://')):
        if url.startswith('www.'):
            url = 'https://' + url
        elif url.startswith('amazon.'):
            url = 'https://' + url
        else:
            # Assume it's an Amazon URL
            url = 'https://' + url
        print(f"🔧 Fixed URL scheme: {url}", file=sys.stderr)
    
    # First, try with requests (fast)
    for attempt in range(max_retries):
        try:
            timeout = 15 + (attempt * 10)  # 15s, 25s
            delay = random.uniform(2, 5) if attempt > 0 else random.uniform(1, 3)
            
            print(f"🔍 Attempt {attempt + 1}/{max_retries}: Starting to scrape: {url}", file=sys.stderr)
            time.sleep(delay)
            
            # Create a session to maintain cookies
            session = requests.Session()
            
            # Set cookies that Amazon expects
            session.cookies.set('session-id', '000-0000000-0000000')
            session.cookies.set('i18n-prefs', 'INR')
            session.cookies.set('lc-acbin', 'en_IN')
            
            # Make the request with enhanced headers and session
            r = session.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
            
            print(f"📡 Response status code: {r.status_code}", file=sys.stderr)
            
            if r.status_code == 503:
                print(f"⚠️ Amazon service temporarily unavailable (503), retrying...", file=sys.stderr)
                continue
            elif r.status_code != 200:
                if attempt < max_retries - 1:
                    print(f"⚠️ Status {r.status_code}, retrying...", file=sys.stderr)
                    continue
                # Don't return error yet - try Selenium fallback
                print(f"⚠️ Status {r.status_code}, will try Selenium fallback", file=sys.stderr)
                break
            
            # Check if we got a CAPTCHA page
            if "api-services-support@amazon.com" in r.text or "Type the characters you see in this image" in r.text:
                print("⚠️ CAPTCHA detected - Amazon is blocking automated requests", file=sys.stderr)
                if attempt < max_retries - 1:
                    print("⚠️ Retrying due to CAPTCHA...", file=sys.stderr)
                    continue
                # Don't return error yet - try Selenium fallback
                print("⚠️ CAPTCHA detected, will try Selenium fallback", file=sys.stderr)
                break
            
            # Successfully got the page
            print("✅ [REQUESTS] Successfully fetched HTML via requests", file=sys.stderr)
            return scrape_amazon_content(r, url)
            
        except requests.Timeout:
            print(f"⏱️ Attempt {attempt + 1}: Timeout after {timeout}s", file=sys.stderr)
            if attempt < max_retries - 1:
                print(f"⏱️ Retrying with longer timeout...", file=sys.stderr)
                continue
            # Don't return error yet - try Selenium fallback
            print(f"⏱️ Timeout, will try Selenium fallback", file=sys.stderr)
            break
            
        except requests.RequestException as e:
            print(f"❌ Attempt {attempt + 1}: Network error: {e}", file=sys.stderr)
            if attempt < max_retries - 1:
                continue
            # Don't return error yet - try Selenium fallback
            print(f"❌ Network error, will try Selenium fallback", file=sys.stderr)
            break
            
        except Exception as e:
            print(f"❌ Attempt {attempt + 1}: Unexpected error: {e}", file=sys.stderr)
            if attempt < max_retries - 1:
                continue
            # Don't return error yet - try Selenium fallback
            print(f"❌ Unexpected error, will try Selenium fallback", file=sys.stderr)
            break
    
    # If requests failed, try Selenium fallback
    print("🔄 [SELENIUM] Requests failed, attempting Selenium fallback...", file=sys.stderr)
    html = fetch_html_with_selenium(url)
    
    if html:
        # Create a mock response object to pass to scrape_amazon_content
        class MockResponse:
            def __init__(self, text):
                self.text = text
                self.status_code = 200
        
        print("✅ [SELENIUM] Processing HTML from Selenium", file=sys.stderr)
        return scrape_amazon_content(MockResponse(html), url)
    else:
        print("❌ [SELENIUM] Selenium fallback also failed", file=sys.stderr)
        return {"success": False, "error": "Failed to fetch product data. Amazon may be blocking automated requests."}


def scrape_amazon_content(r, url):
    """Extract content from successful response"""
    try:
        soup = BeautifulSoup(r.text, "html.parser")

        # DEBUG: Check if feature-bullets exists
        feature_bullets_div = soup.find("div", id="feature-bullets")
        print(f"🔍 Feature-bullets div found: {feature_bullets_div is not None}", file=sys.stderr)
        if feature_bullets_div:
            print(f"🔍 Feature-bullets content length: {len(str(feature_bullets_div))}", file=sys.stderr)
            # Log first 500 chars of the div content
            div_text = feature_bullets_div.get_text(strip=True)
            print(f"🔍 Feature-bullets text preview: {div_text[:500]}...", file=sys.stderr)

        # Title
        title_elem = soup.find(id="productTitle")
        title = title_elem.text.strip() if title_elem else "N/A"
        print(f"📝 Title found: {title[:50]}...", file=sys.stderr)
        
        # If title is still N/A, try alternative selectors
        if title == "N/A":
            # Try h1 with product title class
            title_elem = soup.find("h1", class_=lambda x: x and "product" in x.lower())
            if title_elem:
                title = title_elem.text.strip()
            else:
                # Try span with id containing productTitle
                title_elem = soup.find("span", id=lambda x: x and "productTitle" in x.lower() if x else False)
                if title_elem:
                    title = title_elem.text.strip()
        
        print(f"📝 Final title: {title[:50]}...", file=sys.stderr)

        # Product Description
        desc_elem = soup.find(id="productDescription")
        product_description = desc_elem.text.strip() if desc_elem else "N/A"

        # About this Item - Feature Bullets (targeted extraction)
        bullets = []
        print("🔍 Starting targeted 'About this item' extraction...", file=sys.stderr)

        # Method 1: Look for the actual feature bullet points in the product page
        # Amazon often stores feature bullets in specific spans with class "a-list-item"
        feature_bullets_div = soup.find("div", id="feature-bullets")
        if feature_bullets_div:
            print("📋 Found feature-bullets div", file=sys.stderr)
            
            # Look for span elements that contain the actual feature text
            # These are typically the bullet points customers see
            feature_spans = feature_bullets_div.find_all("span", class_="a-list-item")
            
            for span in feature_spans:
                text = span.get_text(strip=True)
                # Skip empty text, "About this item" header, and other non-feature content
                if (text and 
                    len(text) > 10 and 
                    "about this item" not in text.lower() and
                    not re.search(r'[0-9]\s*star', text) and
                    not re.search(r'customer reviews?', text.lower()) and
                    not re.search(r'secure transaction', text.lower()) and
                    not re.search(r'to view this video', text.lower()) and
                    not re.search(r'clothing\s*&\s*accessories', text.lower())):
                    
                    # Clean the text
                    cleaned_text = re.sub(r'\s+', ' ', text)
                    cleaned_text = re.sub(r'[\u200e\u200f]', '', cleaned_text)
                    bullets.append(cleaned_text)
                    print(f"   - Feature Bullet: {cleaned_text[:80]}...", file=sys.stderr)

        # Method 2: If no bullets found in the main location, try alternative patterns
        if len(bullets) < 3:
            print("🔍 Trying alternative feature bullet locations...", file=sys.stderr)
            
            # Try to find unordered lists that contain feature bullets
            feature_lists = soup.find_all("ul", class_=lambda x: x and "a-unordered-list" in str(x))
            
            for ul in feature_lists:
                # Check if this list is likely to contain product features
                list_text = ul.get_text(strip=True).lower()
                if any(keyword in list_text for keyword in ['fabric', 'material', 'design', 'comfort', 'stretch']):
                    list_items = ul.find_all("li")
                    for li in list_items:
                        text = li.get_text(strip=True)
                        if text and len(text) > 20 and text not in bullets:
                            bullets.append(text)
                            print(f"   - List Feature: {text[:80]}...", file=sys.stderr)

        # Method 3: Extract from script data (Amazon often stores features in JSON)
        if len(bullets) < 3:
            print("🔍 Checking script tags for feature data...", file=sys.stderr)
            script_tags = soup.find_all('script', type='text/javascript')
            
            for script in script_tags:
                if not script.string:
                    continue
                    
                script_text = script.string
                # Look for feature data in various JSON patterns
                patterns = [
                    r'"featureBullets":\s*(\[.*?\])',
                    r'featureBullets\s*:\s*(\[.*?\])',
                    r'"feature_bullets":\s*(\[.*?\])',
                    r'data-feature-bullets\s*=\s*"([^"]*)"'
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, script_text, re.DOTALL)
                    for match in matches:
                        try:
                            # Try to parse as JSON
                            if match.startswith('['):
                                feature_list = json.loads(match)
                                for feature in feature_list:
                                    if isinstance(feature, str) and feature not in bullets:
                                        bullets.append(feature)
                                        print(f"   - JSON Feature: {feature[:80]}...", file=sys.stderr)
                            else:
                                # Handle string format
                                features = [f.strip() for f in match.split(';') if f.strip()]
                                for feature in features:
                                    if feature not in bullets:
                                        bullets.append(feature)
                                        print(f"   - String Feature: {feature[:80]}...", file=sys.stderr)
                        except:
                            pass

        # Method 4: DISABLED - Do NOT use template features as they can be misleading
        # Only use actual scraped features from the product page
        if len(bullets) < 3:
            print("⚠️  Warning: Found fewer than 3 feature bullets. Will use actual scraped features only.", file=sys.stderr)
            print("   (Template feature generation is disabled to ensure accuracy)", file=sys.stderr)

        # Method 5: Final fallback - ONLY use this if NO features were found at all
        # Extract meaningful sentences from description that sound like actual product features
        if len(bullets) == 0:
            print("🔍 No features found. Extracting feature-like sentences from description as last resort...", file=sys.stderr)
            
            description_text = product_description.lower()
            feature_keywords = ['fabric', 'material', 'blend', 'comfort', 'breathable', 'moisture', 
                            'wicking', 'hydrophobic', 'lightweight', 'ultralight', 'stretch', 
                            'flexibility', 'design', 'fit', 'style', 'collar', 'sleeve']
            
            sentences = re.split(r'[.!?]+', product_description)
            for sentence in sentences:
                sentence = sentence.strip()
                if (sentence and 
                    len(sentence) > 30 and 
                    len(sentence) < 150 and
                    any(keyword in sentence.lower() for keyword in feature_keywords) and
                    sentence not in bullets and
                    len(bullets) < 5):  # Limit to 5 features max
                    
                    bullets.append(sentence)
                    print(f"   - Desc Feature: {sentence[:80]}...", file=sys.stderr)
        elif len(bullets) < 3:
            print(f"   ℹ️  Only found {len(bullets)} actual feature(s) from product page", file=sys.stderr)

        # Clean and filter the final bullets - Be LESS aggressive to keep real features
        def is_high_quality_feature(text):
            """Filter to keep only high-quality feature bullet points and exclude reviews"""
            text_lower = text.lower()
            
            # CRITICAL: Exclude customer reviews - these should NEVER be in features
            review_indicators = [
                'reviewed in',
                'verified purchase',
                'out of 5 stars',
                'helpful',
                'report',
                'read more',
                'images in this review',
                'one person found this',
                'people found this',
                'size:',
                'colour:',
                'color:',
                'style:',
                'i bought',
                'i purchased',
                'i recently',
                'great quality and comfortable fit!',
                'the quality of',
                'highly recommend',
                'stars'  # Catches rating stars like "5.0 out of 5 stars"
            ]
            
            for indicator in review_indicators:
                if indicator in text_lower:
                    return False
            
            # Exclude description-like text (long marketing paragraphs)
            exclude_phrases = [
                'experience superior',
                'crafted with advanced',
                'the fabric quickly',
                'the innovative',
                'preferred by professional',
                'it is perfect for',
                'elevate your workout',
                'designed specifically for',
                'this tee offers',
                'helping you stay',
                'allowing you to move',
                'giving you unrestricted',
                'this t-shirt features',
                'combines functional design',
                'supports your active lifestyle'
            ]
            
            for phrase in exclude_phrases:
                if phrase in text_lower:
                    return False
            
            # For short features (like "Stylish | Casual"), accept them if they're not too short
            if len(text) >= 10:
                return True
            
            return False

        # Apply final filtering
        filtered_bullets = []
        for bullet in bullets:
            if is_high_quality_feature(bullet):
                # Final cleaning
                cleaned = re.sub(r'\s+', ' ', bullet)
                cleaned = re.sub(r'[\u200e\u200f]', '', cleaned)
                cleaned = cleaned.strip()
                
                # Accept features that are at least 10 chars (lowered from 20)
                if cleaned and len(cleaned) >= 10:
                    filtered_bullets.append(cleaned)
                    print(f"✅ Final Feature: {cleaned[:80]}...", file=sys.stderr)

        bullets = filtered_bullets

        # DISABLED: Do NOT use predefined features - show actual scraped features only
        # Even if we have fewer than 3 features, it's better to show the real ones
        # than to add fake/generic features that may not match the product
        if len(bullets) < 3:
            print(f"⚠️  Warning: Only found {len(bullets)} feature bullets", file=sys.stderr)
            print("   (Not adding generic features - using actual scraped data only)", file=sys.stderr)

        print(f"✅ Final feature bullet count: {len(bullets)}", file=sys.stderr)
        for i, bullet in enumerate(bullets, 1):
            print(f"   {i}. {bullet}", file=sys.stderr)

        # Extract Product Details from detailBulletsWrapper_feature_div
        product_details = {}
        manufacturing_details = {}
        additional_info = {}

        detail_bullets_div = soup.find("div", id="detailBulletsWrapper_feature_div")
        if detail_bullets_div:
            print("📋 Found detailBulletsWrapper_feature_div section", file=sys.stderr)
            
            # Find all list items in the detail bullets
            list_items = detail_bullets_div.find_all("li", class_="a-list-item")
            
            for li in list_items:
                # Find the key (bold text) and value
                key_spans = li.find_all("span", class_="a-text-bold")
                value_spans = li.find_all("span")
                
                if key_spans:
                    key_span = key_spans[0]
                    key = key_span.get_text(strip=True)
                    
                    # Clean the key - remove trailing colon and special characters
                    key = re.sub(r'[:\s&rlm;&lrm;]+$', '', key).strip()
                    
                    # Get the value - it's usually in the next span after the key span
                    # We need to find the span that contains the actual value
                    value = ""
                    
                    # Method 1: Look for spans that don't have a-text-bold class
                    for span in value_spans:
                        if 'a-text-bold' not in span.get('class', []):
                            text = span.get_text(strip=True)
                            if text and text != key:
                                value = text
                                break
                    
                    # Method 2: If no value found, extract from the entire li text
                    if not value:
                        full_text = li.get_text(strip=True)
                        # Remove the key part to get the value
                        value = full_text.replace(key, "").strip(": ").strip()
                    
                    # Clean the value
                    value = re.sub(r'^[:\s&rlm;&lrm;]+', '', value).strip()
                    
                    if key and value:
                        # Skip Best Sellers Rank and Customer Reviews
                        if "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                            print(f"   - {key}: {value}", file=sys.stderr)
                            
                            # Categorize the details
                            if any(field in key.lower() for field in ['manufacturer', 'packer', 'importer', 'country of origin', 'item weight', 'item dimensions', 'asin', 'item model number']):
                                manufacturing_details[key] = value
                            else:
                                product_details[key] = value
        else:
            print("❌ detailBulletsWrapper_feature_div not found", file=sys.stderr)

        # If no product details found in the main section, try alternative locations
        if not product_details and not manufacturing_details:
            print("🔍 Trying alternative locations for product details...", file=sys.stderr)
            
            # Try detailBullets_feature_div directly
            detail_div = soup.find("div", id="detailBullets_feature_div")
            if detail_div:
                print("📋 Found detailBullets_feature_div section", file=sys.stderr)
                list_items = detail_div.find_all("li")
                for li in list_items:
                    key_span = li.find("span", class_="a-text-bold")
                    if key_span:
                        key = key_span.get_text(strip=True).rstrip(":")
                        full_text = li.get_text(strip=True)
                        key_text = key_span.get_text(strip=True)
                        value = full_text.replace(key_text, "").strip(": ")
                        if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                            if any(field in key.lower() for field in ['manufacturer', 'packer', 'importer', 'country of origin', 'item weight', 'item dimensions', 'asin', 'item model number']):
                                manufacturing_details[key] = value
                            else:
                                product_details[key] = value
                            print(f"   - {key}: {value}", file=sys.stderr)
            
            # ALWAYS check product details tables (don't skip if list items found)
            # Table 1: Tech spec table (productDetails_techSpec_section_1)
            tech_spec_table = soup.find("table", id="productDetails_techSpec_section_1")
            if tech_spec_table:
                print("📋 Found tech spec table (productDetails_techSpec_section_1)", file=sys.stderr)
                rows = tech_spec_table.find_all("tr")
                for row in rows:
                    th = row.find("th")
                    td = row.find("td")
                    if th and td:
                        key = th.get_text(strip=True)
                        value = td.get_text(strip=True)
                        if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                            # Don't overwrite if already exists
                            if key not in product_details and key not in manufacturing_details:
                                if any(field in key.lower() for field in ['manufacturer', 'packer', 'importer', 'country of origin', 'item weight', 'item dimensions', 'asin', 'item model number']):
                                    manufacturing_details[key] = value
                                else:
                                    product_details[key] = value
                                print(f"   techSpec - {key}: {value[:50]}...", file=sys.stderr)
            
            # Table 2: Detail bullets table (productDetails_detailBullets_sections1) - Material, Colour, Brand
            detail_bullets_table = soup.find("table", id="productDetails_detailBullets_sections1")
            if detail_bullets_table:
                print("📋 Found detail bullets table (productDetails_detailBullets_sections1) - Material/Colour/Brand", file=sys.stderr)
                rows = detail_bullets_table.find_all("tr")
                for row in rows:
                    th = row.find("th")
                    td = row.find("td")
                    if th and td:
                        key = th.get_text(strip=True)
                        value = td.get_text(strip=True)
                        if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                            # Don't overwrite if already exists
                            if key not in product_details and key not in manufacturing_details:
                                if any(field in key.lower() for field in ['manufacturer', 'packer', 'importer', 'country of origin', 'item weight', 'item dimensions', 'asin', 'item model number']):
                                    manufacturing_details[key] = value
                                else:
                                    product_details[key] = value
                                print(f"   detailBullets - {key}: {value[:50]}...", file=sys.stderr)
            else:
                print("❌ productDetails_detailBullets_sections1 table NOT found", file=sys.stderr)
            
            # Table 3: Product overview/specification table (often contains Material, Colour, Brand)
            # This table is often in a section near the product title
            spec_tables = soup.find_all("table", class_="a-normal a-spacing-micro")
            if spec_tables:
                print(f"📋 Found {len(spec_tables)} specification tables (Material/Colour/Brand)", file=sys.stderr)
                for idx, table in enumerate(spec_tables):
                    rows = table.find_all("tr")
                    for row in rows:
                        cells = row.find_all("td")
                        if len(cells) >= 2:
                            key = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True)
                            if key and value and "Best Sellers Rank" not in key and "Customer Reviews" not in key:
                                # Don't overwrite if already exists
                                if key not in product_details and key not in manufacturing_details:
                                    product_details[key] = value
                                    print(f"   specTable[{idx}] - {key}: {value[:50]}...", file=sys.stderr)

        # Extract high-quality product images using enhanced method
        # ⭐ CRITICAL: ONLY extract from div#imageBlock (product gallery)
        # NO other page sections (reviews, Q&A, related products)
        images = []
        seen_image_ids = set()  # Track unique image IDs (e.g., "91SKiZOwceL") to prevent duplicates
        
        print("🖼️ Starting enhanced image extraction (GALLERY ONLY)...", file=sys.stderr)
        
        # First, find the imageBlock container
        image_block = soup.find("div", id="imageBlock")
        if not image_block:
            print("❌ imageBlock not found - cannot extract gallery images", file=sys.stderr)
            images = []
        else:
            print("✅ Found imageBlock container - extracting gallery images ONLY", file=sys.stderr)
        
            def get_image_id(url):
                """Extract unique image ID from Amazon URL (e.g., 'I/91SKiZOwceL' from full URL)"""
                match = re.search(r'/I/([A-Za-z0-9]+)', url)
                return match.group(1) if match else url
            
            # Method 1: data-a-dynamic-image attribute (most reliable for high quality)
            # ONLY search WITHIN imageBlock
            dynamic_images = image_block.find_all('img', {'data-a-dynamic-image': True})
            for img in dynamic_images:
                try:
                    dynamic_data = img.get('data-a-dynamic-image', '{}')
                    image_dict = json.loads(dynamic_data)
                    for img_url in image_dict.keys():
                        if is_valid_product_image(img_url):
                            # Convert to highest quality using ._SL1500_.
                            high_quality_url = re.sub(r'\._[A-Z0-9_]+\.', '._SL1500_.', img_url)
                            image_id = get_image_id(high_quality_url)
                            
                            # Only add if this unique image ID hasn't been seen
                            if image_id not in seen_image_ids:
                                images.append(high_quality_url)
                                seen_image_ids.add(image_id)
                                print(f"✅ Found dynamic image: {high_quality_url[:80]}...", file=sys.stderr)
                except Exception as e:
                    print(f"⚠️ Error parsing dynamic image: {e}", file=sys.stderr)
            
            # Method 2: JavaScript/Script tags (but ONLY for imageBlock-related scripts)
            # Look for scripts specifically about imageBlock, colorImages, etc.
            script_tags = soup.find_all('script', string=re.compile('colorImages|imageBlockNR|ImageBlockATF'))
            for script in script_tags:
                try:
                    script_text = script.string
                    # Enhanced patterns to try for high-quality images
                    patterns = [
                        r'"hiRes":"(https://[^"]+)"',
                        r'"large":"(https://[^"]+)"',
                        r'"thumb":"(https://[^"]+)"',
                        r'https://m\.media-amazon\.com/images/I/[^"]+\._[A-Z0-9_]+\.[a-z]+',
                        # NEW PATTERNS for additional image data structures:
                        r'"imageGalleryData":\s*\[\s*{[^}]*"mainUrl":"([^"]+)"',
                        r'"altImages":\s*\[\s*"([^"]+)"',
                        r'"variant":"MAIN"[^}]*"url":"([^"]+)"',
                        r'"landing":"(https://[^"]+)"'
                    ]
                    
                    for pattern in patterns:
                        matches = re.findall(pattern, script_text)
                        for img_url in matches:
                            if is_valid_product_image(img_url):
                                high_quality_url = re.sub(r'\._[A-Z0-9_]+\.', '._SL1500_.', img_url)
                                image_id = get_image_id(high_quality_url)
                                
                                if image_id not in seen_image_ids:
                                    images.append(high_quality_url)
                                    seen_image_ids.add(image_id)
                                    print(f"📸 Found script image: {high_quality_url[:80]}...", file=sys.stderr)
                except Exception as e:
                    print(f"⚠️ Error parsing script: {e}", file=sys.stderr)
            
            # Method 3: Direct img tags with src (ONLY within imageBlock!)
            # ⭐ CRITICAL: Do NOT use soup.find_all() - that searches entire page!
            # ONLY search within the imageBlock container
            if image_block:
                img_tags = image_block.find_all('img', src=True)
                for img in img_tags:
                    src = img.get('src', '')
                    if src and is_valid_product_image(src):
                        # Convert to highest quality
                        high_quality_url = re.sub(r'\._[A-Z0-9_]+\.', '._SL1500_.', src)
                        image_id = get_image_id(high_quality_url)
                        
                        if image_id not in seen_image_ids:
                            images.append(high_quality_url)
                            seen_image_ids.add(image_id)
                            print(f"📸 Found img tag: {high_quality_url[:80]}...", file=sys.stderr)


        # Extract ASIN from URL or page
        asin_match = re.search(r"/dp/([A-Z0-9]{10})", url)
        asin = asin_match.group(1) if asin_match else "unknown"

        # If ASIN not in manufacturing details, try to find it in the page
        if asin == "unknown":
            asin_pattern = re.search(r'"asin":"([A-Z0-9]{10})"', r.text)
            if asin_pattern:
                asin = asin_pattern.group(1)

        # Ensure ASIN is in manufacturing details if found
        if asin != "unknown" and "ASIN" not in manufacturing_details:
            manufacturing_details["ASIN"] = asin

        # Detect category and extract category-specific fields
        category = detect_category_from_page(soup)
        print(f"🏷️ Detected category: {category}", file=sys.stderr)
        
        # Extract Product Overview (for all products)
        product_overview = extract_product_overview(soup)
        
        # Extract Product Information with subsections (for all products)
        product_information_subsections = extract_product_information_with_subsections(soup)
        
        # Extract More Product Details from detailBulletsWithExceptions (for all products)
        more_product_details = extract_more_product_details(soup)
        
        # Extract additional fields from Home & Kitchen structure (works for all categories)
        # This extracts Technical Details, Additional Info, What's in Box, Safety Info
        tech_details, add_info, box_contents, safety_information, prod_info_heading, prod_details_list = extract_home_kitchen_details(soup)
        technical_details = tech_details
        whats_in_box = box_contents
        safety_info = safety_information
        product_information_heading = prod_info_heading
        product_details_list = prod_details_list
        
        # Merge additional info if not already present
        for key, value in add_info.items():
            if key not in additional_info:
                additional_info[key] = value

        print(f"✅ Successfully scraped product: {title[:50]}...", file=sys.stderr)
        print(f"📊 Found {len(images)} UNIQUE images (all will be returned)", file=sys.stderr)
        print(f"📊 Found {len(product_details)} product details", file=sys.stderr)

        # Build result with new structure
        result = {
            "success": True,
            "title": title,
            "description": product_description,
            "bullets": bullets,
            "productOverview": product_overview if product_overview else {"status": "No data available"},
            "productInformation": product_information_subsections if product_information_subsections else {"status": "No data available"},
            "moreProductDetails": more_product_details if more_product_details else {"status": "No data available"},
            "productDetails": product_details if product_details else {"status": "No data available"},
            "additionalInfo": additional_info,
            "manufacturingDetails": manufacturing_details,
            "images": images,  # Return ALL unique images found (no limit, no padding)
            "asin": asin,
            "category": category,
            # Add these fields for ALL categories (not just Home & Kitchen)
            "technicalDetails": technical_details if technical_details else {"status": "No data available"},
            "whatsInBox": whats_in_box if whats_in_box else "Not specified",
            "safetyInfo": safety_info if safety_info else "Not specified",
            "productInformationHeading": product_information_heading if product_information_heading else "Product Information",
            "productDetailsList": product_details_list if product_details_list else {"status": "No data available"}
        }
        
        # DEBUG: Log what data was extracted for this product
        print("\n🔍 ===== DATA EXTRACTION SUMMARY =====", file=sys.stderr)
        print(f"Category: {category}", file=sys.stderr)
        print(f"Product Overview: {len(product_overview)} items" if product_overview else "Product Overview: EMPTY", file=sys.stderr)
        print(f"Product Information Subsections: {len(product_information_subsections)} subsections" if product_information_subsections else "Product Information: EMPTY", file=sys.stderr)
        if product_information_subsections:
            for subsection_name in product_information_subsections.keys():
                print(f"  - {subsection_name}: {len(product_information_subsections[subsection_name])} items", file=sys.stderr)
        print(f"More Product Details: {len(more_product_details)} items" if more_product_details else "More Product Details: EMPTY", file=sys.stderr)
        print(f"Product Details: {len(product_details)} items" if product_details else "Product Details: EMPTY", file=sys.stderr)
        if product_details:
            for key in list(product_details.keys())[:3]:
                print(f"  - {key}: {product_details[key][:50]}...", file=sys.stderr)
        print(f"Manufacturing Details: {len(manufacturing_details)} items" if manufacturing_details else "Manufacturing Details: EMPTY", file=sys.stderr)
        if manufacturing_details:
            for key in list(manufacturing_details.keys())[:3]:
                print(f"  - {key}: {manufacturing_details[key][:50]}...", file=sys.stderr)
        print(f"Additional Info: {len(additional_info)} items" if additional_info else "Additional Info: EMPTY", file=sys.stderr)
        print(f"Technical Details: {len(technical_details)} items" if technical_details else "Technical Details: EMPTY", file=sys.stderr)
        print("===== END SUMMARY =====\n", file=sys.stderr)
        
        # Log what we found
        print(f"📋 Product Overview: {len(product_overview)} items", file=sys.stderr)
        print(f"📋 Product Information subsections: {len(product_information_subsections)}", file=sys.stderr)
        print(f"📋 More Product Details: {len(more_product_details)} items", file=sys.stderr)
        print(f"🔧 Technical Details: {len(technical_details)} items", file=sys.stderr)
        print(f"📦 What's in box: {'Found' if whats_in_box else 'Not found'}", file=sys.stderr)
        print(f"⚠️ Safety Info: {'Found' if safety_info else 'Not found'}", file=sys.stderr)
        print(f"🏭 Found {len(manufacturing_details)} manufacturing details", file=sys.stderr)
        print(f"🖼️ Found {len(images)} product images", file=sys.stderr)
        
        return result  # Return dict, not JSON string

    except Exception as e:
        print(f"❌ Error during content extraction: {str(e)}", file=sys.stderr)
        return {"success": False, "error": str(e)}

def scrape_amazon(url):
    """Main scraping function with retry logic - max 2 retries"""
    return scrape_amazon_with_retry(url, max_retries=2)

def main():
    if len(sys.argv) < 2:
        error_result = {"success": False, "error": "URL parameter required"}
        print(json.dumps(error_result))
        return

    url = sys.argv[1]
    result = scrape_amazon(url)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()