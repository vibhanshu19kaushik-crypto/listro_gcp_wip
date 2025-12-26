#!/usr/bin/env python3
"""
Universal Amazon Scraper 507 - Complete Fix
- Fixed all text corruption
- Removed Best Sellers Rank & Customer Reviews from all sections
- Manufacturing details only in dedicated section
- Product details only from productFactsDesktopExpander
"""

# Suppress warnings to keep stdout clean for JSON output
import warnings
warnings.filterwarnings('ignore')

import requests
from bs4 import BeautifulSoup
import sys
import re
import json
import os
import urllib.request
from urllib.parse import urljoin, urlparse 

# Suppress google.api_core warnings
import logging
logging.getLogger('google.api_core').setLevel(logging.ERROR)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,/;q=0.8",
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

from google.cloud import storage
import os

GCS_BUCKET_NAME = "listro-image-store"

# Initialize GCS storage client
# In Cloud Run: automatically uses service account from metadata service
# Handles both local file-based credentials and ADC
try:
    # Try to initialize with ADC (works in Cloud Run)
    storage_client = storage.Client()
except Exception as e:
    print(f"⚠️  Warning: Failed to initialize GCS client initially: {e}", file=sys.stderr)
    # Fallback: Clear any problematic env vars and try again
    if 'GOOGLE_APPLICATION_CREDENTIALS' in os.environ:
        # Check if the file exists
        creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        if creds_path and not os.path.exists(creds_path):
            print(f"⚠️  Credentials file does not exist: {creds_path}", file=sys.stderr)
            print(f"   Removing GOOGLE_APPLICATION_CREDENTIALS and using ADC...", file=sys.stderr)
            del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
    
    # Try again with ADC
    try:
        storage_client = storage.Client()
        print(f"✅ Successfully initialized GCS client with ADC", file=sys.stderr)
    except Exception as e2:
        print(f"❌ CRITICAL: Failed to initialize GCS client: {e2}", file=sys.stderr)
        raise


def upload_scraped_image_to_gcs(image_bytes, gcs_folder, asin, filename):
    """
    Upload image bytes to GCS and return the GCS path (NOT signed URL).
    The Node.js backend will handle signed URL generation.
    """
    try:
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        blob_path = f"{gcs_folder}/{asin}/{filename}"
        blob = bucket.blob(blob_path)
        # Upload WITHOUT ACL
        blob.upload_from_string(image_bytes, content_type="image/jpeg")
        # Return GCS path (NOT signed URL - Node.js will generate the signed URL)
        gcs_path = f"gs://{GCS_BUCKET_NAME}/{blob_path}"
        print(f"✅ [upload_scraped_image_to_gcs] Successfully uploaded {filename} to {gcs_path}", file=sys.stderr)
        return gcs_path
    except Exception as e:
        import traceback
        print(f"❌ [upload_scraped_image_to_gcs] FAILED to upload {filename}: {e}", file=sys.stderr)
        print(f"❌ [upload_scraped_image_to_gcs] Traceback: {traceback.format_exc()}", file=sys.stderr)
        raise




def safe_extract(element, default="N/A"):
   """Safely extract text from BeautifulSoup element"""
   if element:
       text = element.get_text(strip=True)
       # Fix text corruption in extracted text
       text = fix_text_corruption(text)
       return text if text else default
   return default


def fix_text_corruption(text):
   """Fix ALL text corruption issues comprehensively"""
   if not text:
       return text
  
   # Comprehensive corruption fixes - covers ALL patterns
   corruption_fixes = {
       # Word-level fixes with space issues
       r'\bP\s*o\s*duct\b': 'Product',
       r'\bDi\s*m?\s*ensions\b': 'Dimensions',
       r'\bDate\s+Fi\s*r?\s*st\b': 'Date First',
       r'\bAvai\s*l?\s*ab\s*l?\s*e\b': 'Available',
       r'\bManufactu\s*r?\s*e\b': 'Manufacturer',
       r'\bIte\s*m?\s*\b': 'Item ',
       r'\bMode\s*l?\s*nNu\s*m?\s*be\s*r?\b': 'Model Number',
       r'\bMode\s*l?\s*\b': 'Model',
       r'\bNu\s*m?\s*be\s*r?\b': 'Number',
       r'\bDepa\s*r?\s*t\s*m?\s*ent\b': 'Department',
       r'\bPacke\s*r?\s*\b': 'Packer',
       r'\bI\s*m?\s*po\s*r?\s*te\s*r?\b': 'Importer',
       r'\bGene\s*r?\s*ic\s+Na\s*m?\s*e\b': 'Generic Name',
       r'\bBest\s+Se\s*l?\s*e\s*r?\s*s\s+Rank\b': 'Best Sellers Rank',
       r'\bCusto\s*m?\s*e\s*r?\s+Reviews\b': 'Customer Reviews',
       r'\bSe\s*l?\s*e\s*r?\s*s\b': 'Sellers',
      
       # Compound word fixes
       r'\bDi\s+Di\s+ensions\b': 'Dimensions',
       r'\bIte\s+Mode\s+nNu\s+be\b': 'Item Model Number',
       r'\bIte\s+Weight\b': 'Item Weight',
       r'\bIte\s+Di\s+Di\s+ensions\b': 'Item Dimensions',
      
       # Single letter/syllable fixes
       r'\bens\b': 'Mens',
       r'\bW\s*e?\s*ight\b': 'Weight',
       r'\bNam\s*e?\s*\b': 'Name',
       r'\bR\s*a?\s*nk\b': 'Rank',
      
       # Common partial word corruption
       r'odel\s+nu': 'Model Nu',
       r'ensions': 'Dimensions',
       r'epartm': 'Departm',
       r'mport': 'Import',
       r'anufact': 'Manufact',
   }
  
   # Apply all fixes
   for corrupted, fixed in corruption_fixes.items():
       text = re.sub(corrupted, fixed, text, flags=re.IGNORECASE)
  
   # Remove extra spaces between words
   text = re.sub(r'\s+', ' ', text)
  
   return text.strip()


def clean_key(key):
   """Clean key by removing special characters and fixing text corruption"""
   if not key:
       return key
  
   # First, fix text corruption
   key = fix_text_corruption(key)
  
   # Remove special characters
   key = re.sub(r'[&rlm;&lrm;‏‎]+', '', key)
   key = re.sub(r'\s*:\s*$', '', key)
  
   # Clean up whitespace
   key = re.sub(r'\s+', ' ', key).strip()
  
   return key


def clean_value(value):
   """Clean value text"""
   if not value:
       return value
  
   # Fix text corruption
   value = fix_text_corruption(value)
  
   # Remove special characters
   value = re.sub(r'^[:\s&rlm;&lrm;‏‎]+', '', value)
   value = re.sub(r'[:\s&rlm;&lrm;‏‎]+$', '', value)
  
   return value.strip()


def should_exclude_key(key):
   """Check if key should be excluded from all sections"""
   if not key:
       return True
  
   key_lower = key.lower()
  
   # Excluded keys list
   excluded_keywords = [
       'best sellers rank',
       'best seller rank',
       'customer reviews',
       'customer review',
       'manufacturer',
       'packer',
       'importer',
       'asin'  # ASIN handled separately
   ]
  
   return any(excluded in key_lower for excluded in excluded_keywords)



def download_images(image_urls, asin, gcs_folder):
    """
    Downloads scraped images to memory, uploads them to GCS, and returns GCS URLs.
    Also tracks status for debugging.
    """
    gcs_urls = []
    global last_main_image_status
    last_main_image_status = []
    print(f"🔄 [download_images] Starting download of {len(image_urls)} images for ASIN {asin}", file=sys.stderr)
    for i, url in enumerate(image_urls):
        status = {"asin": asin, "index": i, "imgUrl": url, "gcpUrl": None, "success": False, "error": None}
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                status["error"] = f"HTTP {resp.status_code}"
                last_main_image_status.append(status)
                print(f"⚠️  [download_images] Image {i} download failed: HTTP {resp.status_code}", file=sys.stderr)
                continue
            image_bytes = resp.content
            filename = f"img_{i}.jpg"
            gcs_url = upload_scraped_image_to_gcs(image_bytes, gcs_folder, asin, filename)
            gcs_urls.append(gcs_url)
            status["gcpUrl"] = gcs_url
            status["success"] = True
            print(f"✅ Main image uploaded: asin={asin}, idx={i}, url={gcs_url}", file=sys.stderr)
        except Exception as e:
            import traceback
            status["error"] = str(e)
            print(f"❌ [download_images] Error downloading/uploading image {i} ({url}): {e}", file=sys.stderr)
            print(f"❌ [download_images] Traceback: {traceback.format_exc()}", file=sys.stderr)
        last_main_image_status.append(status)
    print(f"📊 [download_images] Successfully uploaded {len(gcs_urls)} images for ASIN {asin}", file=sys.stderr)
    return gcs_urls

# Helper to get last main image upload status
def get_last_main_image_status():
    global last_main_image_status
    return last_main_image_status if 'last_main_image_status' in globals() else []


def scrape_amazon(url):
   try:
       print(f"🔍 Starting scrape for: {url}", file=sys.stderr)
       response = requests.get(url, headers=HEADERS, timeout=30)
       if response.status_code != 200:
           print(f"❌ HTTP Error: {response.status_code}", file=sys.stderr)
           return {"success": False, "error": f"Failed to fetch page. Status code: {response.status_code}"}
     
       print(f"✅ Page fetched successfully (size: {len(response.text)} bytes)", file=sys.stderr)
       soup = BeautifulSoup(response.text, "html.parser")


       # Extract ASIN from URL
       asin_match = re.search(r"/dp/([A-Z0-9]{10})", url)
       asin = asin_match.group(1) if asin_match else "N/A"
       print(f"📦 ASIN: {asin}", file=sys.stderr)


       # Basic Product Information
       product_info = extract_basic_info(soup, asin, url)
       print(f"✅ Basic info extracted - Title: {product_info.get('title', 'N/A')[:50]}...", file=sys.stderr)


       # Product Details Section 1 - ONLY from productFactsDesktopExpander
       product_details_section1 = extract_product_facts_from_expander_only(soup)


       # About This Item (Feature Bullets)
       about_this_item = extract_about_this_item_universal(soup)
       print(f"✅ Feature bullets: {len(about_this_item)}", file=sys.stderr)


       # Additional Information (clean - no manufacturing, no rankings)
       additional_information = extract_additional_information_clean(soup)


       # Product Description
       product_description = extract_product_description_universal(soup)


       # Product Details Section 2 (Detail Bullets - clean)
       product_details_section2 = extract_detail_bullets_clean(soup)


       # Pricing Information
       pricing_info = extract_pricing_info_universal(soup)


       # Manufacturing Details - ONLY Manufacturer, Packer, Importer, ASIN
       manufacturing_details = extract_manufacturing_details_only(soup, asin)


       # ⭐ Try Selenium FIRST to get ALL images (including JS-rendered)
       print(f"[LOG] 📸 Attempting to extract images with Selenium from {url}...", flush=True)
       print(f"[LOG] 🔍 Starting Selenium extraction...", file=sys.stderr, flush=True)
       selenium_images = extract_all_images_with_selenium(url)
       print(f"[LOG] ✅ Selenium returned {len(selenium_images) if selenium_images else 0} images", flush=True)
       print(f"[LOG] 📊 Selenium images: {selenium_images}", file=sys.stderr, flush=True)
       
       if selenium_images and len(selenium_images) >= 3:
           # Selenium found multiple unique images - use those
           print(f"[LOG] ✅ Using {len(selenium_images)} images from Selenium (JS-rendered)", flush=True)
           print(f"[LOG] 🎯 FINAL CHOICE: Using Selenium images ({len(selenium_images)} unique)", file=sys.stderr, flush=True)
           images = selenium_images
       else:
           # Fallback to BeautifulSoup HTML parsing
           print(f"[LOG] ⚠️  Selenium found {len(selenium_images) if selenium_images else 0} images, using BeautifulSoup HTML parsing...", flush=True)
           print(f"[LOG] 🔄 FALLBACK: Using BeautifulSoup (Selenium had < 3 images)", file=sys.stderr, flush=True)
           images = extract_high_quality_images_universal(soup)
           print(f"[LOG] 📸 Images extracted from HTML: {len(images)}", flush=True)
           print(f"[LOG] 📊 BeautifulSoup images: {images}", file=sys.stderr, flush=True)
      
       # ⭐ SIMPLIFIED: Return Amazon CDN images directly
       # NO upload to GCS, NO conversions
       # Just return the original Amazon image URLs
       
       gcs_urls = images  # Use scraped Amazon URLs directly
       print(f"📊 [scrape_amazon] Using {len(gcs_urls)} total scraped Amazon CDN images", file=sys.stderr)

       result = {
            "success": True,
            "basic_information": product_info,
            "product_details_section1": product_details_section1,
            "about_this_item": about_this_item,
            "additional_information": additional_information,
            "product_description": product_description,
            "product_details_section2": product_details_section2,
            "pricing_information": pricing_info,
            "manufacturing_details": manufacturing_details,

            # Return Amazon CDN images directly (no GCS upload)
            "mainImages": gcs_urls,   # Amazon CDN URLs
            "images": gcs_urls        # Backward compatibility

        }

       print(f"✅ Scraping completed successfully! Returning {len(gcs_urls)} images", file=sys.stderr)
       return result


   except Exception as e:
       print(f"❌ Scraping error: {str(e)}", file=sys.stderr)
       import traceback
       traceback.print_exc(file=sys.stderr)
       return {"success": False, "error": str(e)}


def extract_basic_info(soup, asin, url):
   """Extract basic product information"""
   title = "N/A"
   title_selectors = [
       "span#productTitle",
       "h1#title",
       ".product-title-word",
       "#titleSection h1",
       "#title_feature_div h1"
   ]
  
   for selector in title_selectors:
       title_elem = soup.select_one(selector)
       if title_elem:
           title = safe_extract(title_elem)
           if title != "N/A":
               break
  
   brand = "N/A"
   brand_selectors = [
       "a#bylineInfo",
       "a[href*='/brand/']",
       ".a-link-normal[href*='/brand/']",
       "#bylineInfo",
       "#brand"
   ]
  
   for selector in brand_selectors:
       brand_elem = soup.select_one(selector)
       if brand_elem:
           brand = safe_extract(brand_elem)
           if brand != "N/A":
               break
  
   return {
       "asin": asin,
       "title": title,
       "brand": brand,
       "url": url
   }


def extract_product_facts_from_expander_only(soup):
   """Extract product facts ONLY from productFactsDesktopExpander section"""
   product_details = {}
  
   # ONLY Method: Product Facts Desktop Expander
   product_facts_div = soup.find("div", id="productFactsDesktopExpander")
   if product_facts_div:
       # Find the "Product details" heading
       product_details_heading = product_facts_div.find("h3", class_="product-facts-title",
                                                         string=re.compile("Product details", re.IGNORECASE))
      
       if product_details_heading:
           # Get all detail divs after this heading until next heading
           current_elem = product_details_heading.find_next_sibling()
          
           while current_elem:
               # Stop if we hit another heading
               if current_elem.name == 'h3':
                   break
              
               # Process product-facts-detail divs
               if current_elem.name == 'div':
                   # Check if it's a section with product-facts-detail inside
                   detail_divs = current_elem.find_all("div", class_="product-facts-detail")
                  
                   for detail_div in detail_divs:
                       all_spans = detail_div.find_all("span", class_="a-color-base")
                       if len(all_spans) >= 2:
                           key = safe_extract(all_spans[0])
                           value = safe_extract(all_spans[1])
                          
                           # Exclude unwanted keys
                           if key and value and key != "N/A" and value != "N/A" and not should_exclude_key(key):
                               product_details[key] = value
              
               current_elem = current_elem.find_next_sibling()
  
   return product_details if product_details else {"status": "No data available"}


def extract_about_this_item_universal(soup):
   """Extract About This Item section"""
   bullets = []
  
   # Method 1: Feature bullets
   feature_bullets = soup.find("div", id="feature-bullets")
   if feature_bullets:
       list_items = feature_bullets.find_all("li")
       for li in list_items:
           text = safe_extract(li)
           if text and "about this item" not in text.lower() and text not in bullets:
               bullets.append(text)
  
   # Method 2: Product Facts Desktop Expander
   if not bullets:
       product_facts_div = soup.find("div", id="productFactsDesktopExpander")
       if product_facts_div:
           about_heading = product_facts_div.find("h3", class_="product-facts-title",
                                                  string=re.compile("About this item", re.IGNORECASE))
           if about_heading:
               next_elem = about_heading.find_next_sibling()
               while next_elem:
                   if next_elem.name == "ul":
                       list_items = next_elem.find_all("li")
                       for li in list_items:
                           text = safe_extract(li)
                           if text and text not in bullets:
                               bullets.append(text)
                       break
                   next_elem = next_elem.find_next_sibling()
  
   return bullets if bullets else ["N/A"]


def extract_additional_information_clean(soup):
   """Extract Additional Information - NO manufacturing, NO rankings"""
   additional_info = {}
  
   product_facts_div = soup.find("div", id="productFactsDesktopExpander")
   if product_facts_div:
       additional_heading = product_facts_div.find("h3", class_="product-facts-title",
                                                   string=re.compile("Additional Information", re.IGNORECASE))
       if additional_heading:
           current_elem = additional_heading.find_next_sibling()
           while current_elem:
               if current_elem.name in ['h3', 'hr']:
                   break
              
               if current_elem.name == 'div' and 'product-facts-detail' in current_elem.get('class', []):
                   all_spans = current_elem.find_all("span", class_="a-color-base")
                   if len(all_spans) >= 2:
                       key = safe_extract(all_spans[0])
                       value = safe_extract(all_spans[1])
                      
                       # Exclude unwanted keys
                       if key and value and key != "N/A" and value != "N/A" and not should_exclude_key(key):
                           additional_info[key] = value
              
               current_elem = current_elem.find_next_sibling()
  
   return additional_info if additional_info else {"status": "No data available"}


def extract_product_description_universal(soup):
   """Extract product description"""
   description = "N/A"
  
   desc_selectors = [
       "div#productDescription",
       "div#descriptionAndDetails",
       "div#productDescription_feature_div",
       "div.a-section.description"
   ]
  
   for selector in desc_selectors:
       desc_elem = soup.select_one(selector)
       if desc_elem:
           description = safe_extract(desc_elem)
           if description != "N/A":
               break
  
   if description == "N/A":
       feature_div = soup.find("div", id="feature-bullets")
       if feature_div:
           full_text = feature_div.get_text(strip=True)
           if len(full_text) > 200:
               description = full_text
  
   return description


def extract_detail_bullets_clean(soup):
   """Extract detail bullets - NO manufacturing, NO rankings"""
   data = {}
  
   # Method 1: Detail Bullets Feature Div
   detail_bullets_div = soup.find("div", id="detailBullets_feature_div")
   if detail_bullets_div:
       for li in detail_bullets_div.select("li"):
           k = li.select_one("span.a-text-bold")
           if k:
               key_raw = k.get_text(" ", strip=True)
               key = clean_key(key_raw)
              
               full_text = li.get_text(" ", strip=True)
               key_text = k.get_text(" ", strip=True)
               val = full_text.replace(key_text, "").strip()
               val = clean_value(val)
              
               # Exclude unwanted keys
               if key and val and not should_exclude_key(key):
                   data[key] = val
  
   # Method 2: Detail Bullets Wrapper
   if not data:
       detail_bullets_wrapper = soup.find("div", id="detailBulletsWrapper_feature_div")
       if detail_bullets_wrapper:
           for li in detail_bullets_wrapper.select("li.a-list-item"):
               bold_spans = li.select("span.a-text-bold")
               if bold_spans:
                   key_span = bold_spans[0]
                   key_raw = key_span.get_text(" ", strip=True)
                   key = clean_key(key_raw)
                  
                   value_spans = li.select("span:not(.a-text-bold)")
                   value = ""
                   for span in value_spans:
                       text = span.get_text(" ", strip=True)
                       if text and text != key_raw:
                           value = text
                           break
                  
                   if not value:
                       full_text = li.get_text(" ", strip=True)
                       value = full_text.replace(key_raw, "").strip(": ").strip()
                  
                   value = clean_value(value)
                  
                   # Exclude unwanted keys
                   if key and value and not should_exclude_key(key):
                       data[key] = value
  
   return data if data else {"status": "No data available"}


def extract_pricing_info_universal(soup):
   """Extract pricing information"""
   pricing_info = {
       "current_price": "N/A",
       "list_price": "N/A",
       "savings": "N/A",
       "currency": "USD"
   }
  
   price_selectors = [
       ".a-price-whole",
       ".a-price .a-offscreen",
       "#priceblock_dealprice",
       "#priceblock_ourprice",
       ".a-price-range .a-price .a-offscreen"
   ]
  
   for selector in price_selectors:
       price_elem = soup.select_one(selector)
       if price_elem:
           pricing_info["current_price"] = safe_extract(price_elem)
           break
  
   list_price_selectors = [
       ".a-price.a-text-price .a-offscreen",
       ".a-text-strike",
       "#priceblock_saleprice"
   ]
  
   for selector in list_price_selectors:
       list_price_elem = soup.select_one(selector)
       if list_price_elem:
           pricing_info["list_price"] = safe_extract(list_price_elem)
           break
  
   return pricing_info


def extract_manufacturing_details_only(soup, asin):
   """Extract ONLY Manufacturer, Packer, Importer, and ASIN"""
   manufacturing_details = {}
  
   # Add ASIN
   if asin != "N/A":
       manufacturing_details["ASIN"] = asin
  
   manufacturing_keys = ['manufacturer', 'packer', 'importer']
  
   # Method 1: Additional Information section
   product_facts_div = soup.find("div", id="productFactsDesktopExpander")
   if product_facts_div:
       additional_heading = product_facts_div.find("h3", class_="product-facts-title",
                                                   string=re.compile("Additional Information", re.IGNORECASE))
       if additional_heading:
           current_elem = additional_heading.find_next_sibling()
           while current_elem:
               if current_elem.name in ['h3', 'hr']:
                   break
              
               if current_elem.name == 'div' and 'product-facts-detail' in current_elem.get('class', []):
                   all_spans = current_elem.find_all("span", class_="a-color-base")
                   if len(all_spans) >= 2:
                       key = safe_extract(all_spans[0])
                       value = safe_extract(all_spans[1])
                      
                       if (key and value and key != "N/A" and value != "N/A" and
                           any(mfg_key in key.lower() for mfg_key in manufacturing_keys)):
                           manufacturing_details[key] = value
              
               current_elem = current_elem.find_next_sibling()
  
   # Method 2: Detail bullets
   detail_bullets_div = soup.find("div", id="detailBullets_feature_div")
   if detail_bullets_div:
       for li in detail_bullets_div.select("li"):
           k = li.select_one("span.a-text-bold")
           if k:
               key_raw = k.get_text(" ", strip=True)
               key = clean_key(key_raw)
              
               full_text = li.get_text(" ", strip=True)
               key_text = k.get_text(" ", strip=True)
               val = full_text.replace(key_text, "").strip()
               val = clean_value(val)
              
               if (key and val and
                   any(mfg_key in key.lower() for mfg_key in manufacturing_keys)):
                   manufacturing_details[key] = val
  
   # Method 3: Technical specifications
   tech_spec_sections = soup.find_all("div", id=re.compile(r"productDetails_techSpec_section_\d+"))
   for section in tech_spec_sections:
       for row in section.select("tr"):
           cols = row.select("th, td")
           if len(cols) >= 2:
               key = safe_extract(cols[0])
               value = safe_extract(cols[1])
              
               if (key and value and
                   any(mfg_key in key.lower() for mfg_key in manufacturing_keys)):
                   manufacturing_details[key] = value
  
   return manufacturing_details if manufacturing_details else {"status": "No data available", "ASIN": asin}


def extract_all_images_with_selenium(url):
   """
   Extract ALL images from Amazon product page using Selenium.
   Handles JavaScript-rendered image galleries that BeautifulSoup can't see.
   """
   images = []
   driver = None
   
   try:
       from selenium import webdriver
       from selenium.webdriver.chrome.options import Options
       from selenium.webdriver.chrome.service import Service
       from selenium.webdriver.support.ui import WebDriverWait
       from selenium.webdriver.support import expected_conditions as EC
       from selenium.webdriver.common.by import By
       from webdriver_manager.chrome import ChromeDriverManager
       import time
       
       print("🌐 Initializing Selenium to extract ALL images...", file=sys.stderr)
       
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
       
       # Initialize the driver with auto-downloaded chromedriver
       service = Service(ChromeDriverManager().install())
       driver = webdriver.Chrome(service=service, options=chrome_options)
       
       print(f"✅ Selenium WebDriver initialized", file=sys.stderr)
       
       # Load the page
       print(f"📄 Loading Amazon product page...", file=sys.stderr)
       driver.get(url)
       time.sleep(4)  # Wait for initial load
       
       # Try to click through image thumbnails to trigger lazy loading of ALL images
       print(f"🖱️  Clicking through image thumbnails to load all images...", file=sys.stderr)
       try:
           # Find all image thumbnail buttons/links
           thumbnails = driver.find_elements(By.CSS_SELECTOR, ".imageThumbnail, [data-csa-c-posx], [data-a-image-gallery], .a-spacing-small.item")
           print(f"📸 Found {len(thumbnails)} image thumbnails", file=sys.stderr)
           
           for i, thumb in enumerate(thumbnails[:15]):  # Click up to 15 thumbnails
               try:
                   driver.execute_script("arguments[0].scrollIntoView(true);", thumb)
                   time.sleep(0.5)
                   thumb.click()
                   time.sleep(1)  # Wait for image to load
                   print(f"✅ Clicked thumbnail {i+1}", file=sys.stderr)
               except Exception as e:
                   print(f"⚠️  Could not click thumbnail {i+1}: {e}", file=sys.stderr)
       except Exception as e:
           print(f"⚠️  Could not find/click thumbnails: {e}", file=sys.stderr)
       
       # Scroll through the image gallery to trigger lazy loading
       print(f"📜 Scrolling to load all images...", file=sys.stderr)
       for i in range(5):
           driver.execute_script("window.scrollBy(0, window.innerHeight);")
           time.sleep(1)
       
       # Scroll back to top to ensure main gallery is loaded
       driver.execute_script("window.scrollTo(0, 0);")
       time.sleep(2)
       
       # Extract images from various selectors
       image_urls = set()
       
       print(f"🔍 Method 1: Extracting from data attributes...", file=sys.stderr)
       # Method 1: High-res data attributes (main images)
       try:
           img_elements = driver.find_elements(By.CSS_SELECTOR, "[data-old-hires], [data-a-hires], [data-a-dynamic-image]")
           print(f"   Found {len(img_elements)} elements with data attributes", file=sys.stderr)
           for img in img_elements:
               for attr in ['data-old-hires', 'data-a-hires', 'src', 'data-a-dynamic-image']:
                   url_value = img.get_attribute(attr)
                   if url_value:
                       # Handle data-a-dynamic-image JSON
                       if '{' in url_value:
                           import json
                           try:
                               image_dict = json.loads(url_value)
                               for img_url in image_dict.keys():
                                   if 'media-amazon' in img_url:
                                       image_urls.add(img_url)
                                       print(f"   ✅ From JSON: {img_url[:60]}...", file=sys.stderr)
                           except:
                               pass
                       elif 'media-amazon' in url_value:
                           image_urls.add(url_value)
                           print(f"   ✅ From {attr}: {url_value[:60]}...", file=sys.stderr)
       except Exception as e:
           print(f"   ⚠️  Error: {e}", file=sys.stderr)
       
       print(f"🔍 Method 2: Extracting from picture/img elements...", file=sys.stderr)
       # Method 2: Picture elements with sources
       try:
           picture_elements = driver.find_elements(By.CSS_SELECTOR, "picture img, img[alt*='image'], img[alt*='Image'], .a-dynamic-image")
           print(f"   Found {len(picture_elements)} picture/img elements", file=sys.stderr)
           for img in picture_elements:
               src = img.get_attribute('src')
               srcset = img.get_attribute('srcset')
               if src and 'media-amazon.com' in src:
                   image_urls.add(src)
                   print(f"   ✅ From src: {src[:60]}...", file=sys.stderr)
               if srcset:
                   # Extract high quality URL from srcset
                   for part in srcset.split(','):
                       url_part = part.strip().split()[0]
                       if 'media-amazon.com' in url_part:
                           image_urls.add(url_part)
                           print(f"   ✅ From srcset: {url_part[:60]}...", file=sys.stderr)
       except Exception as e:
           print(f"   ⚠️  Error: {e}", file=sys.stderr)
       
       print(f"🔍 Method 3: Extracting from all img tags...", file=sys.stderr)
       # Method 3: All img tags that contain Amazon images
       try:
           all_imgs = driver.find_elements(By.TAG_NAME, "img")
           print(f"   Found {len(all_imgs)} total img tags", file=sys.stderr)
           count = 0
           for img in all_imgs:
               src = img.get_attribute('src')
               if src and 'media-amazon.com' in src and ('.jpg' in src.lower() or '.png' in src.lower()):
                   if 'sprite' not in src.lower() and 'transparent' not in src.lower():
                       image_urls.add(src)
                       count += 1
           print(f"   ✅ Added {count} Amazon images", file=sys.stderr)
       except Exception as e:
           print(f"   ⚠️  Error: {e}", file=sys.stderr)
       
       print(f"📊 Total unique URLs found: {len(image_urls)}", file=sys.stderr)
       
       # Filter and clean URLs - get high quality versions
       for img_url in image_urls:
           if not img_url or 'sprite' in img_url.lower() or 'transparent' in img_url.lower():
               continue
           
           # Convert to high quality URL
           clean_url = img_url.split('?')[0]  # Remove parameters
           clean_url = re.sub(r'\._[A-Z0-9_]+\.', '._SL1500_.', clean_url)  # Set to high quality
           
           if clean_url not in images:
               images.append(clean_url)
               print(f"✅ Found image: {clean_url[:70]}...", file=sys.stderr)
       
       print(f"📊 Selenium extracted {len(images)} total images", file=sys.stderr)
       
   except Exception as e:
       print(f"⚠️  Selenium image extraction failed: {e}", file=sys.stderr)
       import traceback
       print(f"   Traceback: {traceback.format_exc()}", file=sys.stderr)
   finally:
       if driver:
           try:
               driver.quit()
               print(f"✅ Selenium driver closed", file=sys.stderr)
           except:
               pass
   
   return images  # Return what Selenium found, or empty list if it failed


def extract_high_quality_images_universal(soup):
   """Extract EXACTLY 7 main high-quality product images"""
   images = []
   seen_urls = set()
  
   print("🖼️ Starting image extraction...", file=sys.stderr)
  
   # Method 1: JavaScript data extraction - hiRes images
   script_tags = soup.find_all("script", string=re.compile("colorImages|imageBlock|ImageBlockATF"))
   print(f"📜 Found {len(script_tags)} script tags with image data", file=sys.stderr)
  
   for script in script_tags:
       script_text = script.string
       if script_text:
           # Try multiple patterns
           patterns = [
               r'"hiRes":"(https://[^"]+?)"',
               r'"large":"(https://[^"]+?)"',
               r'"main":\s*{[^}]*"(https://m\.media-amazon\.com/images/I/[^"]+?)"'
           ]
          
           for pattern in patterns:
               matches = re.findall(pattern, script_text)
               for img_url in matches:
                   if img_url not in seen_urls:
                       high_quality_url = img_url.replace("._SL75_", "._SL1500_").replace("._SL100_", "._SL1500_").replace("._SL150_", "._SL1500_").replace("._SL200_", "._SL1500_").replace("._SL500_", "._SL1500_").replace("._SL1000_", "._SL1500_").replace("._SL800_", "._SL1500_")
                      
                       if any(domain in high_quality_url for domain in ["images-na.ssl-images-amazon.com", "m.media-amazon.com"]):
                           images.append(high_quality_url)
                           seen_urls.add(img_url)
                           print(f"✅ Found image {len(images)}: {high_quality_url[:60]}...", file=sys.stderr)
                          
                           if len(images) >= 7:
                               break
              
               if len(images) >= 7:
                   break
      
       if len(images) >= 7:
           break
  
   # Method 2: Data dynamic image attribute
   if len(images) < 7:
       print("📸 Trying data-a-dynamic-image method...", file=sys.stderr)
       image_blocks = soup.find_all(["div", "img", "span"], {"data-a-dynamic-image": True})
       print(f"📦 Found {len(image_blocks)} elements with data-a-dynamic-image", file=sys.stderr)
      
       for block in image_blocks:
           if len(images) >= 7:
               break
              
           dynamic_data = block.get("data-a-dynamic-image", "{}")
           try:
               image_dict = json.loads(dynamic_data)
               for img_url in image_dict.keys():
                   if img_url not in seen_urls:
                       high_quality_url = img_url.replace("._SL75_", "._SL1500_").replace("._SL100_", "._SL1500_").replace("._SL150_", "._SL1500_").replace("._SL200_", "._SL1500_").replace("._SL500_", "._SL1500_").replace("._SL1000_", "._SL1500_").replace("._SL800_", "._SL1500_")
                      
                       if any(domain in high_quality_url for domain in ["images-na.ssl-images-amazon.com", "m.media-amazon.com"]):
                           images.append(high_quality_url)
                           seen_urls.add(img_url)
                           print(f"✅ Found image {len(images)}: {high_quality_url[:60]}...", file=sys.stderr)
                          
                           if len(images) >= 7:
                               break
           except Exception as e:
               print(f"⚠️ Error parsing dynamic image: {e}", file=sys.stderr)
  
   # Method 3: Image block with img tags
   if len(images) < 7:
       print("🔍 Trying img tag method...", file=sys.stderr)
       img_tags = soup.find_all("img", src=re.compile(r"(images-na\.ssl-images-amazon\.com|m\.media-amazon\.com)"))
       print(f"🏷️ Found {len(img_tags)} img tags with Amazon domain", file=sys.stderr)
      
       for img in img_tags:
           if len(images) >= 7:
               break
          
           src = img.get("src", "")
           if src and src not in seen_urls:
               # Skip small icons/logos
               if not any(exclude in src.lower() for exclude in ['sprite', 'icon', 'logo', 'arrow', 'pixel', 'transparent']):
                   high_quality_url = re.sub(r'\._[A-Z0-9_]+\.', '._SL1500_.', src)
                  
                   if any(domain in high_quality_url for domain in ["images-na.ssl-images-amazon.com", "m.media-amazon.com"]):
                       images.append(high_quality_url)
                       seen_urls.add(src)
                       print(f"✅ Found image {len(images)}: {high_quality_url[:60]}...", file=sys.stderr)
  
   # Method 4: landingImage (main product image)
   if len(images) < 7:
       print("🎯 Trying landingImage method...", file=sys.stderr)
       landing_image = soup.find("img", id="landingImage")
       if landing_image:
           data_old_hires = landing_image.get("data-old-hires")
           if data_old_hires and data_old_hires not in seen_urls:
               images.insert(0, data_old_hires)
               seen_urls.add(data_old_hires)
               print(f"✅ Found landing image: {data_old_hires[:60]}...", file=sys.stderr)
  
   print(f"✨ Total images extracted: {len(images)}", file=sys.stderr)
   # IMPORTANT: Return ALL unique images found (no padding, no duplicates)
   # Don't artificially pad to 7 - return what was actually scraped
   if len(images) == 0:
       print("⚠️  WARNING: No images found after all extraction methods", file=sys.stderr)
   return images  # Return actual unique images, not padded


def format_scraped_data(raw_result):
   """
   Format the raw scraped data into a structured format expected by the frontend
   """
   if not raw_result.get("success"):
       return raw_result
  
   # Helper function to convert dict to array of {key, value} objects
   def dict_to_array(data_dict):
       if not data_dict or not isinstance(data_dict, dict):
           return []
       if data_dict.get("status") == "No data available":
           return []
       return [{"key": k, "value": v} for k, v in data_dict.items()]
  
   # Extract basic information
   basic_info = raw_result.get("basic_information", {})
  
   # Combine all product details from different sections
   product_details_combined = {}
  
   # Add product details section 1
   section1 = raw_result.get("product_details_section1", {})
   if isinstance(section1, dict) and section1.get("status") != "No data available":
       product_details_combined.update(section1)
  
   # Add product details section 2
   section2 = raw_result.get("product_details_section2", {})
   if isinstance(section2, dict) and section2.get("status") != "No data available":
       product_details_combined.update(section2)
  
   # Extract image URLs directly (flatten the structure)
   image_urls = raw_result.get("mainImages", [])
  
   # Format the result
   formatted_result = {
       "success": True,
       "product": {
            "title": basic_info.get("title", "N/A"),
            "description": raw_result.get("product_description", "N/A"),
            "asin": basic_info.get("asin", "N/A"),
            "brand": basic_info.get("brand", "N/A"),
            "url": basic_info.get("url", "N/A"),

            # mainImages = only main product images (gold images come from Node scraper)
            "mainImages": image_urls,
            # Backward compatibility for existing frontend code
            "images": image_urls     

        },

       "details": {
           "featureBullets": raw_result.get("about_this_item", []),
           "productDetails": dict_to_array(product_details_combined),
           "manufacturingDetails": dict_to_array(raw_result.get("manufacturing_details", {})),
           "additionalInfo": dict_to_array(raw_result.get("additional_information", {}))
       },
       "pricing": raw_result.get("pricing_information", {}),
       "raw": {
           "basic_information": basic_info,
           "product_details_section1": raw_result.get("product_details_section1", {}),
           "product_details_section2": raw_result.get("product_details_section2", {}),
           "additional_information": raw_result.get("additional_information", {}),
           "manufacturing_details": raw_result.get("manufacturing_details", {}),
           "about_this_item": raw_result.get("about_this_item", []),
           "product_description": raw_result.get("product_description", "N/A"),
           "pricing_information": raw_result.get("pricing_information", {}),
           "images_full": raw_result.get("mainImages", [])
       }
   }
  
   return formatted_result


def main():
   if len(sys.argv) < 2:
       error_result = {"success": False, "error": "URL parameter required"}
       print(json.dumps(error_result, indent=2))
       return


   url = sys.argv[1]
  
   # Check if --formatted flag is provided
   use_formatted = "--formatted" in sys.argv or "-f" in sys.argv
  
   raw_result = scrape_amazon(url)
  
   if use_formatted:
       result = format_scraped_data(raw_result)
   else:
       result = raw_result
  
   print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
   main()



