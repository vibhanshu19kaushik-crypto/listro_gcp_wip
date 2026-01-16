# Home & Kitchen Image Generation - Integration Summary

## ✅ What Was Done

### 1. **Created Modular H&K Image Generator** (`H&K_image.py`)
- Converted from standalone Flask app to importable module
- Exports `generate_homekitchen_image(client, prompt, ref_images, ref_image_bytes, target_size, index)`
- Supports **index 0** (Key Features - 2 bullets) and **index 1** (Why You'll Love It - 4 bullets)
- Raises `ValueError("Other features loading soon")` for index >= 2
- Uses Gemini 2.5 Flash Image + Pillow glassmorphism text overlay
- Generates 1117x1400 JPEG images (101-199KB target)

### 2. **Created Import Shim** (`hk_image.py`)
- Workaround for `H&K_image.py` filename (ampersand not importable)
- Uses `SourceFileLoader` to dynamically load the module
- Re-exports all necessary functions

### 3. **Integrated into Main Backend** (`python-server.py`)
- Added `import base64` at top
- Added safe import of hk_image module at startup
- Modified `/generate-image` endpoint to detect category:
  - If category is "Home & Kitchen" → delegates to `generate_homekitchen_image()`
  - If style_index >= 2 for H&K → returns error "Other features loading soon"
  - Otherwise → uses existing clothing image generation logic
- Returns same response format for both categories

### 4. **Frontend Already Ready** (`ImageComparisonPage.jsx`)
- Already passes `productAttributes` (including `Category`) to backend
- Already shows "coming soon" alert for index >= 5 (covers H&K index >=2)
- No frontend changes needed!

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 python-server.py (Port 5000)             │
│                                                          │
│  /generate-image endpoint:                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Receives: image, style_index, attributes      │  │
│  │ 2. Checks: attributes['Category']                │  │
│  │                                                   │  │
│  │ If "Home & Kitchen":                             │  │
│  │   → import hk_image                              │  │
│  │   → generate_homekitchen_image(index=style_idx)  │  │
│  │   → Returns infographic with text overlay        │  │
│  │                                                   │  │
│  │ If "Clothing" or other:                          │  │
│  │   → Existing PROMPT_FUNCTIONS logic              │  │
│  │   → Returns clothing-style image                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                  ┌─────▼────┐
    │ hk_image │                  │ clothing │
    │  module  │                  │  prompts │
    └──────────┘                  └──────────┘
         ↓
    ┌────▼─────────┐
    │ H&K_image.py │
    │              │
    │ - Gemini AI  │
    │ - Pillow     │
    │ - Glassmor-  │
    │   phism text │
    └──────────────┘
```

## 🎯 How It Works

### For Clothing Category:
1. User uploads reference image
2. Clicks "Generate" button (index 0-4)
3. Backend uses existing `PROMPT_FUNCTIONS[style_index]`
4. Returns clothing-style AI image

### For Home & Kitchen Category:
1. User uploads reference image  
2. Clicks "Generate" button:
   - **Index 0** → Generates "Key Features" infographic (2 bullets)
   - **Index 1** → Generates "Why You'll Love It" infographic (4 bullets)
   - **Index 2-4** → Shows error "Other features loading soon"
   - **Index 5+** → Frontend shows "coming soon" alert (existing behavior)
3. Backend delegates to `generate_homekitchen_image()`
4. Returns infographic with glassmorphism text overlay

## 📋 Testing Checklist

### Test Clothing Category (Unchanged):
- [ ] Select Clothing category product
- [ ] Upload reference image
- [ ] Click Generate buttons 0-4 → Should generate clothing images as before
- [ ] Click Generate buttons 5+ → Should show "coming soon" alert
- [ ] Verify images uploaded to GCS correctly

### Test Home & Kitchen Category (New):
- [ ] Select Home & Kitchen category product
- [ ] Upload reference image
- [ ] Click 1st Generate button (index 0) → Should generate "Key Features" infographic
- [ ] Click 2nd Generate button (index 1) → Should generate "Why You'll Love It" infographic
- [ ] Click 3rd Generate button (index 2) → Should show "Other features loading soon" error
- [ ] Click 4th+ Generate buttons → Should show error/alert
- [ ] Verify infographic text overlay is visible
- [ ] Verify images uploaded to GCS correctly

## 🚀 How to Run

```bash
# Install H&K dependencies (if not already installed)
cd backend
pip install google-generativeai pillow python-dotenv werkzeug

# Run main server (single process handles both categories)
python python-server.py

# Server starts on port 5000
# Clothing: Uses existing logic
# Home & Kitchen: Uses hk_image module
```

## 🔧 Environment Variables

Make sure these are set in `.env` or environment:

```bash
# For local development
GEMINI_API_KEY=your-api-key-here

# OR for Cloud Run (Vertex AI)
USE_VERTEX_AI=true
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
```

## 📝 Files Modified/Created

### Created:
- ✅ `backend/H&K_image.py` - Home & Kitchen image generation module
- ✅ `backend/hk_image.py` - Import shim for H&K_image.py
- ✅ `backend/requirements-homekitchen.txt` - H&K dependencies

### Modified:
- ✅ `backend/python-server.py` - Added category detection and H&K integration

### Unchanged:
- ✅ Frontend files - No changes needed!
- ✅ Existing clothing logic - Still works as before

## 🎨 Technical Details

### H&K Image Specs:
- **Size**: 1117x1400 pixels (portrait)
- **Format**: JPEG (101-199KB optimized)
- **Style**: Luxury e-commerce with glassmorphism text overlay
- **Text**: Dynamic color based on background brightness
- **Effect**: Frosted glass blur + rounded box + bullet points

### Prompts:
- **Index 0**: "Key Features" heading + 2 feature bullets
- **Index 1**: "Why You'll Love It" heading + 4 feature bullets
- Both use same base scene generation, different text overlays

## 🔐 Security Notes

- Single backend process - no additional ports exposed
- Same authentication/CORS as existing server
- Category detection prevents unauthorized access to H&K generator
- File uploads validated same as clothing category

## ✨ Future Enhancements

To add more H&K image styles (index 2, 3, 4...):
1. Update `generate_homekitchen_image()` in `H&K_image.py`
2. Add new text_data configurations for each index
3. Remove `if index >= 2` check
4. No frontend changes needed!
