/**
 * scrapingService.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js
 * Manages the execution of dual Python scrapers and ASIN metadata extraction.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Run a python scraper and return its JSON output
 */
function runPythonScraper(scriptPath, args) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Spawning scraper: python3 ${scriptPath} ${args.join(' ')}`);
    const pythonProcess = spawn('python3', [scriptPath, ...args]);
    
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Scraper ${scriptPath} exited with code ${code}`);
        console.error(`stderr: ${stderrData}`);
        return reject(new Error(`Scraper failed with code ${code}`));
      }
      try {
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (e) {
        console.error(`❌ Failed to parse JSON from ${scriptPath}:`, stdoutData.substring(0, 500));
        reject(new Error('Invalid JSON output from scraper'));
      }
    });
  });
}

/**
 * Scrape product details using dual scrapers
 */
async function scrapeProduct(url) {
  if (!url) throw new Error('URL is required');

  const SCRAPER_DIR = path.join(__dirname, '..', 'scrapers');
  const mainScraper = path.join(SCRAPER_DIR, 'scraper.py');
  const imageScraper = path.join(SCRAPER_DIR, 'amz_scraper.py');

  console.log(`🔍 Starting dual scrape for: ${url.substring(0, 80)}...`);

  try {
    // Run both scrapers in parallel
    const [mainData, imageData] = await Promise.all([
      runPythonScraper(mainScraper, [url]),
      runPythonScraper(imageScraper, [url])
    ]);

    // Merge logic (matches legacy server.js)
    const result = {
      ...mainData,
      scraped_images: imageData.images || [],
      source_url: url,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Scrape complete for ${url.substring(0, 50)}`);
    return result;
  } catch (error) {
    console.error(`❌ Dual scrape failed: ${error.message}`);
    throw error;
  }
}

/**
 * Extract metadata from ASIN directly
 */
async function scrapeMetadataFromAsin(asin) {
  if (!asin) throw new Error('ASIN is required');

  const SCRAPER_DIR = path.join(__dirname, '..', 'scrapers');
  const metadataScript = path.join(SCRAPER_DIR, 'get_metadata.py');

  console.log(`🔍 Fetching metadata for ASIN: ${asin}`);

  try {
    const result = await runPythonScraper(metadataScript, [asin]);
    return result;
  } catch (error) {
    console.error(`❌ Metadata extraction failed for ${asin}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  scrapeProduct,
  scrapeMetadataFromAsin
};
