/**
 * URL to File Conversion
 */
export const urlToFile = async (imageUrl, filename) => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    console.error('Error converting URL to File:', error);
    throw error;
  }
};

/**
 * Standard Image Labels
 */
export const IMAGE_LABELS = [
  'Main Product',
  'White Background',
  'Lifestyle- L/R/B',
  'Lifestyle',
  'Infographics',
  'Detail Shot 1',
  'Detail Shot 2',
  'Additional 1',
  'Additional 2',
  'Additional 3',
  'Additional 4',
  'Additional 5',
  'Additional 6',
  'Additional 7',
  'Additional 8',
  'Additional 9',
  'Additional 10',
];

/**
 * Loading Messages for Generation
 */
export const LOADING_MESSAGES = [
  "Painting pixels...",
  "Creating magic...",
  "Crafting your image...",
  "Generating masterpiece...",
  "Conjuring visuals...",
  "Building your vision...",
  "Adding colors...",
  "Focusing creativity...",
  "Launching generation...",
  "Mixing digital paint...",
  "Rendering pixels...",
  "Blooming your image...",
  "Flowing with creativity...",
  "Shining up pixels...",
  "Uploading your image...",
  "Storing in the cloud...",
  "Processing upload...",
];

export const MAX_REGEN = 2;
export const SELECTION_LIMIT = 7;
export const MIN_REQUIRED = 5;
