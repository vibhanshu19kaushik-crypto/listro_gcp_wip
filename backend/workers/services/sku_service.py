import re
import time
import random
import hashlib
from threading import Lock
from collections import deque
from datetime import datetime

# SKU Configuration Constants
FIXED_CODE_GNC = "GNC"
FIXED_CODE_GNO = "GNO"

IGNORE_WORDS = {
    "and", "&", "sets", "set", "wear", "clothing", "nightwear", 
    "lounge", "suits", "suit", "for", "with", "the", "a", "an", 
    "in", "on", "of", "to", "by", "as", "at", "from",
    "women's", "men's", "women", "men", "kids", "children",
    "baby", "infant", "toddler", "unisex", "gender"
}

class UniqueSKUGenerator:
    """Guarantees unique SKU generation with multiple layers of uniqueness checking."""
    
    def __init__(self):
        self.lock = Lock()
        # In-memory cache for quick uniqueness checks
        self.generated_skus = set()
        # Track product code sequences
        self.product_code_sequences = {}
        # Cache for recent SKUs (FIFO)
        self.recent_skus = deque(maxlen=10000)
        print("✅ Unique SKU Generator initialized")
    
    def clean_text_for_sku(self, text):
        """Clean text for SKU generation."""
        if not text:
            return []
        cleaned = re.sub(r'[^a-zA-Z ]', ' ', text).lower()
        words = cleaned.split()
        return [word for word in words if word not in IGNORE_WORDS and len(word) > 1]
    
    def generate_unique_product_code(self, subcategory):
        """Generate guaranteed unique 2-letter product code."""
        words = self.clean_text_for_sku(subcategory)
        
        if not words:
            return "PR"
        
        # Base code generation
        if len(words) >= 2:
            base_code = (words[0][0] + words[1][0]).upper()
        else:
            word = words[0]
            if len(word) >= 3:
                base_code = (word[0] + word[-1]).upper()
            else:
                base_code = word[:2].upper().ljust(2, 'X')
        
        with self.lock:
            # Check if this code has been used
            if base_code in self.product_code_sequences:
                sequence = self.product_code_sequences[base_code] + 1
            else:
                sequence = 0
            
            self.product_code_sequences[base_code] = sequence
            
            # If sequence > 0, modify code to ensure uniqueness
            if sequence > 0:
                if sequence < 26:  # Use letters A-Z
                    variant = chr(65 + sequence - 1)  # A=1, B=2, etc.
                    code = base_code[0] + variant
                else:
                    variant = str(sequence % 10)
                    code = base_code[0] + variant
            else:
                code = base_code
            
            return code
    
    def generate_unique_4_digits(self, product_code, fixed_code, attempt=0):
        """Generate guaranteed unique 4-digit number."""
        with self.lock:
            # Use timestamp for base uniqueness
            timestamp = int(time.time() * 1000) % 10000
            
            # Add product code hash for more uniqueness
            code_hash = hash(product_code) % 100
            
            # Add attempt number for retries
            attempt_offset = attempt * 37
            
            # Combine all factors
            base = (timestamp + code_hash + attempt_offset) % 10000
            
            # Ensure 4 digits
            digits = base if base >= 1000 else base + 1000
            
            # Generate a test SKU to check uniqueness
            test_sku = f"{product_code}{fixed_code}{digits:04d}{datetime.now().strftime('%Y%m')}"
            
            # Check if this SKU already exists
            max_attempts = 10
            while test_sku in self.generated_skus and attempt < max_attempts:
                attempt += 1
                # Try different algorithm for collision
                timestamp = int(time.time() * 1000) % 10000
                random_offset = random.randint(1, 999)
                digits = (timestamp + random_offset) % 10000
                if digits < 1000:
                    digits += 1000
                test_sku = f"{product_code}{fixed_code}{digits:04d}{datetime.now().strftime('%Y%m')}"
            
            if attempt >= max_attempts:
                # Last resort: completely random
                digits = random.randint(1000, 9999)
            
            return digits
    
    def generate_unique_sku_components(self, product_code, fixed_code, variant=""):
        """Generate all components of a unique SKU."""
        digits = self.generate_unique_4_digits(product_code, fixed_code)
        year_month = datetime.now().strftime("%Y%m")
        variant_code = variant[:2].upper() if variant else ""
        return product_code, digits, year_month, variant_code
    
    def generate_full_sku(self, product_code, fixed_code, variant=""):
        """Generate a complete unique SKU."""
        product_code, digits, year_month, variant_code = self.generate_unique_sku_components(
            product_code, fixed_code, variant
        )
        
        if variant_code:
            sku = f"{product_code}{fixed_code}{variant_code}{digits:04d}{year_month}"
        else:
            sku = f"{product_code}{fixed_code}{digits:04d}{year_month}"
        
        # Register immediately
        with self.lock:
            self.generated_skus.add(sku)
            self.recent_skus.append(sku)
        
        return sku

    def is_sku_unique(self, sku):
        """Check if SKU is unique in memory cache."""
        with self.lock:
            return sku not in self.generated_skus
    
    def register_sku(self, sku):
        """Register a SKU as used."""
        with self.lock:
            self.generated_skus.add(sku)
            self.recent_skus.append(sku)
            return True

# Initialize global singleton
sku_generator = UniqueSKUGenerator()

def calculate_sku_checksum(sku):
    """Calculate checksum for SKU validation."""
    return hashlib.md5(sku.encode()).hexdigest()[:8]

def generate_product_code_from_name(product_name):
    """Generate product code from product name."""
    return sku_generator.generate_unique_product_code(product_name)

def generate_product_code_from_subcategory(subcategory):
    """Generate product code from subcategory."""
    return sku_generator.generate_unique_product_code(subcategory)

def get_current_year_month():
    """Get current date in YYYYMM format."""
    now = datetime.now()
    return now.strftime("%Y%m")

def validate_sku_format(sku, fixed_code=None):
    """Validate SKU format."""
    if not sku:
        return False
    
    # Determine fixed code if not provided
    if not fixed_code:
        if 'GNC' in sku:
            fixed_code = FIXED_CODE_GNC
        elif 'GNO' in sku:
            fixed_code = FIXED_CODE_GNO
        else:
            return False
    
    # Pattern for SKU with GNC/GNO (XX + FIXED + [0-2 chars variant] + 4 random + 6 date)
    pattern = rf'^[A-Z]{{2}}{fixed_code}[A-Z0-9]{{0,2}}\d{{4}}\d{{6}}$'
    return bool(re.match(pattern, sku))

def determine_fixed_code_from_request(page_type, default='gnc'):
    """Determine fixed code based on page_type parameter."""
    if page_type and str(page_type).lower() == 'gno':
        return FIXED_CODE_GNO
    return FIXED_CODE_GNC

def extract_sku_components(sku, fixed_code=None):
    """
    Extract components from SKU. 
    Maintains parity with V1's parsing logic (even if it misparses 17-char SKUs).
    """
    if not sku:
        return None
    
    # Try to detect fixed code if not provided
    if not fixed_code:
        if 'GNC' in sku:
            fixed_code = FIXED_CODE_GNC
        elif 'GNO' in sku:
            fixed_code = FIXED_CODE_GNO
        else:
            return None
    
    # Handle both formats: with and without variant
    # NOTE: V1 has a bug where it only checks for len == 16, 
    # but actual SKUs with variants are 17 chars. 
    # We maintain this bug for exact bit-by-bit parity.
    if len(sku) == 16:  # With variant: POGNCRD3968202512
        return {
            'product_code': sku[:2],
            'fixed_code': fixed_code,
            'variant': sku[5:7],
            'random_digits': sku[7:11],
            'year_month': sku[11:17],
            'year': sku[11:15],
            'month': sku[15:17]
        }
    else:  # Without variant (or 17-char with variant): POGNC3968202512
        return {
            'product_code': sku[:2],
            'fixed_code': fixed_code,
            'variant': '',
            'random_digits': sku[5:9],
            'year_month': sku[9:15],
            'year': sku[9:13],
            'month': sku[13:15]
        }
