#!/usr/bin/env python3
"""
Test breadcrumb extraction logic
"""

# Test breadcrumbs from the Amazon product page
test_breadcrumbs = [
    "Home & Kitchen",
    "Kitchen & Home Appliances",
    "Coffee, Tea & Espresso",
    "Coffee Maker Accessories",
    "Measuring Spoons"
]

print("Testing Breadcrumb Extraction")
print("=" * 60)
print(f"Full breadcrumbs: {test_breadcrumbs}")
print()

# Category: 1st value (root)
category = test_breadcrumbs[0]
print(f"✅ Category (1st/root value): {category}")

# Department: 2nd value (after root)
if len(test_breadcrumbs) >= 2:
    department = test_breadcrumbs[1]
    print(f"✅ Department (2nd value): {department}")
else:
    print("❌ Department: Not available (less than 2 breadcrumbs)")

# Subcategory: Last value
subcategory = test_breadcrumbs[-1]
print(f"✅ Subcategory (last value): {subcategory}")

print()
print("Expected Output:")
print(f"  Category: Home & Kitchen")
print(f"  Department: Kitchen & Home Appliances")
print(f"  Subcategory: Measuring Spoons")
