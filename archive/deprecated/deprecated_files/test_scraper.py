#!/usr/bin/env python3
"""Test scraper to verify what data is being extracted"""

import sys
from scraper import scrape_amazon_with_retry

# Test URL - Home & Kitchen product
test_url = "https://www.amazon.in/dp/B0FHDVSCPC"

print("=" * 80)
print("TESTING SCRAPER")
print("=" * 80)
print(f"URL: {test_url}\n")

result = scrape_amazon_with_retry(test_url)

if result and result.get('success'):
    print("\n✅ Scraping successful!\n")
    
    print("=" * 80)
    print("CATEGORY:")
    print("=" * 80)
    print(f"Category: {result.get('category', 'N/A')}\n")
    
    print("=" * 80)
    print("PRODUCT DETAILS:")
    print("=" * 80)
    product_details = result.get('productDetails', {})
    for key, value in product_details.items():
        print(f"  {key}: {value[:100] if isinstance(value, str) else value}")
    print(f"Total: {len(product_details)} items\n")
    
    print("=" * 80)
    print("MANUFACTURING DETAILS:")
    print("=" * 80)
    manufacturing_details = result.get('manufacturingDetails', {})
    for key, value in manufacturing_details.items():
        print(f"  {key}: {value[:100] if isinstance(value, str) else value}")
    print(f"Total: {len(manufacturing_details)} items\n")
    
    print("=" * 80)
    print("TECHNICAL DETAILS (Home & Kitchen):")
    print("=" * 80)
    technical_details = result.get('technicalDetails', {})
    if technical_details and isinstance(technical_details, dict):
        for key, value in technical_details.items():
            print(f"  {key}: {value[:100] if isinstance(value, str) else value}")
        print(f"Total: {len(technical_details)} items\n")
    else:
        print(f"  {technical_details}\n")
    
    print("=" * 80)
    print("WHAT'S IN THE BOX:")
    print("=" * 80)
    print(f"  {result.get('whatsInBox', 'N/A')}\n")
    
    print("=" * 80)
    print("SAFETY INFO:")
    print("=" * 80)
    print(f"  {result.get('safetyInfo', 'N/A')}\n")
    
else:
    print(f"\n❌ Scraping failed: {result.get('error', 'Unknown error')}\n")
