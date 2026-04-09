import os
import time
from datetime import datetime
from flask import Blueprint, request, jsonify
from services.sku_service import (
    sku_generator,
    calculate_sku_checksum,
    determine_fixed_code_from_request,
    validate_sku_format,
    extract_sku_components,
    generate_product_code_from_subcategory,
    generate_product_code_from_name,
    get_current_year_month,
    FIXED_CODE_GNC,
    FIXED_CODE_GNO
)

sku_bp = Blueprint('sku', __name__)

@sku_bp.route('/generate-sku', methods=['POST'])
def generate_sku():
    """
    Generate SKU from product name or subcategory with GUARANTEED uniqueness.
    Version 2 (Modular)
    """
    try:
        data = request.get_json()
        product_name = data.get('productName', '').strip()
        subcategory = data.get('subcategory', '').strip()
        category = data.get('category', '').strip()
        variant = data.get('variant', '').strip()
        page_type = data.get('page_type', 'gnc')  # 'gnc' or 'gno'
        
        fixed_code = determine_fixed_code_from_request(page_type)
        page_source = 'NewProductCreationPage (GNC)' if fixed_code == FIXED_CODE_GNC else 'ComparisonSetupPage (GNO)'
        
        if subcategory:
            product_code = generate_product_code_from_subcategory(subcategory)
            source = f"subcategory: '{subcategory}'"
        elif product_name:
            product_code = generate_product_code_from_name(product_name)
            source = f"product name: '{product_name}'"
        elif category:
            product_code = generate_product_code_from_subcategory(category)
            source = f"category: '{category}'"
        else:
            return jsonify({
                'success': False,
                'error': 'Either productName, subcategory, or category is required'
            }), 400
        
        sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
        checksum = calculate_sku_checksum(sku)
        components = extract_sku_components(sku, fixed_code)
        
        return jsonify({
            'success': True,
            'sku': sku,
            'checksum': checksum,
            'format': f"{product_code}{fixed_code}{variant[:2].upper() if variant else ''}{components['random_digits']}{components['year_month']}",
            'components': components,
            'generated_from': source,
            'fixed_code_used': fixed_code,
            'page_type': page_type,
            'uniqueness_guarantee': True,
            'message': f'SKU generated with guaranteed uniqueness for {page_source}'
        })
        
    except Exception as e:
        print(f"❌ Error generating unique SKU: {str(e)}")
        timestamp = int(time.time())
        emergency_sku = f"EM{FIXED_CODE_GNC}{timestamp % 10000:04d}{datetime.now().strftime('%Y%m')}"
        return jsonify({
            'success': False,
            'error': f'Failed to generate unique SKU: {str(e)}',
            'fallback_sku': emergency_sku,
            'fallback_checksum': calculate_sku_checksum(emergency_sku)
        }), 500

@sku_bp.route('/generate-unique-sku-batch', methods=['POST'])
def generate_unique_sku_batch():
    """Generate multiple unique SKUs in batch."""
    try:
        data = request.get_json()
        count = min(int(data.get('count', 1)), 100)
        subcategory = data.get('subcategory', '').strip()
        variant_prefix = data.get('variant_prefix', '').strip()
        page_type = data.get('page_type', 'gnc')
        
        if not subcategory:
            return jsonify({'success': False, 'error': 'Subcategory is required'}), 400
        
        fixed_code = determine_fixed_code_from_request(page_type)
        product_code = generate_product_code_from_subcategory(subcategory)
        generated_skus = []
        
        for i in range(count):
            variant = f"{variant_prefix}{i+1:02d}" if variant_prefix else ""
            sku = sku_generator.generate_full_sku(product_code, fixed_code, variant)
            generated_skus.append({
                'sku': sku,
                'checksum': calculate_sku_checksum(sku),
                'sequence': i + 1,
                'variant': variant[:2].upper() if variant else '',
                'components': extract_sku_components(sku, fixed_code),
                'fixed_code': fixed_code
            })
        
        return jsonify({
            'success': True,
            'count': len(generated_skus),
            'generated_skus': generated_skus,
            'uniqueness_guarantee': True
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sku_bp.route('/validate-sku', methods=['POST'])
def validate_sku():
    """Validate SKU format and uniqueness."""
    try:
        data = request.get_json()
        sku = data.get('sku', '').strip().upper()
        page_type = data.get('page_type', 'gnc')
        
        if not sku:
            return jsonify({'success': False, 'error': 'SKU is required'}), 400
        
        expected_fixed_code = determine_fixed_code_from_request(page_type)
        contains_gnc = 'GNC' in sku
        contains_gno = 'GNO' in sku
        
        if not (contains_gnc or contains_gno):
            return jsonify({'success': True, 'isValid': False, 'message': 'Invalid format (missing GNC/GNO)'})
        
        actual_fixed_code = FIXED_CODE_GNC if contains_gnc else FIXED_CODE_GNO
        is_valid_format = validate_sku_format(sku, actual_fixed_code)
        is_unique = sku_generator.is_sku_unique(sku)
        
        if is_valid_format:
            components = extract_sku_components(sku, actual_fixed_code)
            return jsonify({
                'success': True,
                'isValid': True,
                'isUnique': is_unique,
                'sku': sku,
                'components': components,
                'fixed_code_used': actual_fixed_code,
                'fixed_code_matches': actual_fixed_code == expected_fixed_code
            })
        else:
            return jsonify({'success': True, 'isValid': False, 'message': 'Invalid SKU format pattern'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sku_bp.route('/check-sku-exists', methods=['POST'])
def check_sku_exists():
    """Check if SKU already exists in cache."""
    try:
        data = request.get_json()
        sku = data.get('sku', '').strip().upper()
        if not sku:
            return jsonify({'success': False, 'error': 'SKU is required'}), 400
        
        exists = not sku_generator.is_sku_unique(sku)
        return jsonify({
            'success': True,
            'exists': exists,
            'sku': sku,
            'message': f'SKU {"exists" if exists else "does not exist"} in memory cache'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sku_bp.route('/suggest-sku', methods=['POST'])
def suggest_sku():
    """Suggest multiple SKU options."""
    try:
        data = request.get_json()
        product_name = data.get('productName', '').strip()
        subcategory = data.get('subcategory', '').strip()
        variant = data.get('variant', '').strip()
        page_type = data.get('page_type', 'gnc')
        
        if not (product_name or subcategory):
            return jsonify({'success': False, 'error': 'Name or subcategory required'}), 400
        
        fixed_code = determine_fixed_code_from_request(page_type)
        product_code = generate_product_code_from_subcategory(subcategory) if subcategory else generate_product_code_from_name(product_name)
        
        suggestions = []
        for i in range(3):
            current_variant = f"{variant}{i+1:02d}"[:2] if variant else f"{i+1:02d}"
            sku = sku_generator.generate_full_sku(product_code, fixed_code, current_variant)
            suggestions.append({
                'sku': sku,
                'checksum': calculate_sku_checksum(sku),
                'variant': current_variant.upper()
            })
        
        return jsonify({'success': True, 'suggestions': suggestions})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sku_bp.route('/sku-uniqueness-report', methods=['GET'])
def sku_uniqueness_report():
    """Get report on SKU generation statistics."""
    try:
        with sku_generator.lock:
            total_generated = len(sku_generator.generated_skus)
            recent_count = len(sku_generator.recent_skus)
        
        return jsonify({
            'success': True,
            'report': {
                'total_skus_generated': total_generated,
                'recent_skus_in_cache': recent_count,
                'timestamp': datetime.now().isoformat()
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sku_bp.route('/reset-sku-cache', methods=['POST'])
def reset_sku_cache():
    """Reset SKU cache (admin only)."""
    try:
        data = request.get_json()
        admin_token = data.get('admin_token', '')
        if admin_token != os.getenv('ADMIN_TOKEN', 'admin123'):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        
        with sku_generator.lock:
            sku_generator.generated_skus.clear()
            sku_generator.product_code_sequences.clear()
            sku_generator.recent_skus.clear()
            
        return jsonify({'success': True, 'message': 'SKU cache reset successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
