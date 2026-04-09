// share-modal.js - Fixed with null check
document.addEventListener('DOMContentLoaded', function() {
    const shareButton = document.getElementById('share-button');
    const modal = document.getElementById('share-modal');
    
    // Add null checks
    if (shareButton && modal) {
        shareButton.addEventListener('click', function() {
            modal.style.display = 'block';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    } else {
        console.log('Share modal elements not found');
    }
});