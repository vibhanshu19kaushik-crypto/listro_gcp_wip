from flask import Blueprint, request, jsonify
from services.sku_service import (
    sku_generator, 
    calculate_sku_checksum, 
    determine_fixed_code_from_request,
    extract_sku_components,
    FIXED_CODE_GNC
)
from services.ai_service import (
    generate_product_name,
    generate_product_description,
    generate_amazon_keywords,
    extract_product_attributes,
    extract_attributes_fallback,
    sanitize_text
)

product_bp = Blueprint('product', __name__)

@product_bp.route('/generate-sku-for-listing', methods=['POST'])
def generate_sku_for_listing():
    """
    Generate SKU specifically for product listing with guaranteed uniqueness.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        
        # Extract product information
        product_title = data.get('title', '').strip()
        subcategory = data.get('subcategory', '').strip()
        category = data.get('category', '').strip()
        variant = data.get('variant', '').strip()
        attributes = data.get('attributes', {})
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        # Determine fixed code
        fixed_code = determine_fixed_code_from_request(page_type)
        page_source = 'NewProductCreationPage' if fixed_code == FIXED_CODE_GNC else 'ComparisonSetupPage'
        
        # Try to extract product name from title if available
        product_name = product_title or attributes.get('product_name', '') or attributes.get('name', '')
        
        # Determine product code source (priority: subcategory > product name > category)
        if subcategory:
            product_code = sku_generator.generate_unique_product_code(subcategory)
        elif product_name:
            product_code = sku_generator.generate_unique_product_code(product_name)
        elif category:
            product_code = sku_generator.generate_unique_product_code(category)
        else:
            product_code = "PR"
        
        # Generate guaranteed unique SKU
        sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
        checksum = calculate_sku_checksum(sku)
        
        # Prepare detailed response (Parity with V1)
        components = extract_sku_components(sku, fixed_code)
        
        # Generate source string for explanation (emulating V1 logic)
        source = f"Subcategory: '{subcategory}'" if subcategory else \
                 f"Product name: '{product_name}'" if product_name else \
                 f"Category: '{category}'" if category else "Default"
                 
        explanation = f"SKU generated from {source} for {page_source}. Format: {product_code}(product code) + {fixed_code}(fixed) + {variant[:2].upper() if variant else ''}(variant) + {components['random_digits']}(unique digits) + {components['year_month']}(date)"
        
        return jsonify({
            'success': True,
            'sku': sku,
            'checksum': checksum,
            'components': components,
            'explanation': explanation,
            'generated_from': source,
            'fixed_code': fixed_code,
            'page_source': page_source,
            'uniqueness_guarantee': True,
            'format_example': f"Format: 2-letter code + {fixed_code} + [0-2 char variant] + 4 unique digits + YYYYMM",
            'message': f'SKU generated with guaranteed uniqueness for {page_source}'
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Failed to generate unique SKU"
        }), 500

@product_bp.route('/generate-title-description', methods=['POST'])
def generate_title_description():
    """
    Generate AI title or description.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        subcategory = data.get('subcategory', '')
        task_type = data.get('type', 'title')

        # Process product details
        product_details_lines = []
        for k, v in data.items():
            if k not in ('subcategory', 'type') and v is not None:
                cleaned_v = str(v).strip()
                if cleaned_v and cleaned_v not in ('N/A', 'null'):
                    # Sanitize input based on task type
                    sanitized_v = sanitize_text(cleaned_v, allow_pipes=(task_type == 'title'), is_description=(task_type == 'description'))
                    product_details_lines.append(f"{k}: {sanitized_v}")

        product_details = "\n".join(product_details_lines)

        # Fallback for subcategory if missing
        if not subcategory:
            subcategory = data.get('Generic Name') or data.get('Product Type') or data.get('Category') or "Clothing Item"

        if not product_details:
            return jsonify({
                'success': False,
                'error': 'Please provide at least some product details like Brand, Material, Fit, etc.'
            }), 400

        if task_type == 'title':
            generated_title = generate_product_name(subcategory, product_details)
            if generated_title.startswith("Generation Failed:"):
                return jsonify({'success': False, 'error': generated_title}), 500
            
            # Final truncation check
            if len(generated_title) > 190:
                generated_title = generated_title[:187] + "..."
            
            return jsonify({'success': True, 'generated_title': generated_title})

        elif task_type == 'description':
            generated_description = generate_product_description(subcategory, product_details)
            if generated_description.startswith("Generation Failed:"):
                return jsonify({'success': False, 'error': generated_description}), 500
            
            # Final truncation check
            if len(generated_description) > 1950:
                generated_description = generated_description[:1947] + "..."
            
            return jsonify({'success': True, 'generated_description': generated_description})

        else:
            return jsonify({'success': False, 'error': 'Unknown type specified'}), 400

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500


@product_bp.route('/generate-keywords', methods=['POST'])
def generate_keywords():
    """
    Generate Amazon-optimized backend search terms.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        
        # Extract product information
        product_title = data.get('title', '')
        product_category = data.get('category', '')
        product_subcategory = data.get('subcategory', 'Clothing')
        product_details = data.get('details', {})
        
        if not product_title:
            return jsonify({'success': False, 'error': 'Product title is required'}), 400
            
        final_keywords = generate_amazon_keywords(
            product_title, 
            product_category, 
            product_subcategory, 
            product_details
        )
        
        if final_keywords:
            return jsonify({
                'success': True,
                'keywords': final_keywords,
                'message': 'Amazon backend keywords generated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to generate keywords. Please check AI service health.'
            }), 500
            
    except Exception as e:
        print(f"❌ Error in generate-keywords route: {str(e)}")
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500


@product_bp.route('/extract-attributes-from-keywords', methods=['POST'])
def extract_attributes_from_keywords():
    """
    Extract and suggest product attributes from keywords.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        keywords = data.get('keywords', '')
        existing_attributes = data.get('existing_attributes', {})
        
        if not keywords:
            return jsonify({
                'success': False,
                'error': 'Keywords are required'
            }), 400
        
        # Try AI extraction first
        suggested_attributes = extract_product_attributes(keywords, existing_attributes)
        
        if suggested_attributes is not None:
            return jsonify({
                'success': True,
                'suggested_attributes': suggested_attributes,
                'message': f'Found {len(suggested_attributes)} attribute suggestions'
            })
        
        # Fallback to regex extraction
        print("⚠️ AI extraction failed or returned no results, using fallback")
        fallback_suggestions = extract_attributes_fallback(keywords, existing_attributes)
        
        return jsonify({
            'success': True,
            'suggested_attributes': fallback_suggestions,
            'message': f'Found {len(fallback_suggestions)} attribute suggestions (fallback)'
        })
            
    except Exception as e:
        print(f"❌ Error in extract-attributes-from-keywords route: {str(e)}")
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500
