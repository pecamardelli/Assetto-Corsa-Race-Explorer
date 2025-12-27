const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const GALLERY_DIR = path.join(__dirname, '..', 'public', 'car-gallery');
const CAR_LIST_FILE = path.join(__dirname, '..', 'car-list.json');
const IMAGES_PER_CAR = 3;
const DOWNLOAD_DELAY = 2000; // 2 seconds between requests to be respectful

/**
 * Download a file from a URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Get search query for a car
 */
function getSearchQuery(carData) {
  const year = carData.year || '';
  const brand = carData.brand || '';
  const name = carData.name || carData.id;

  // Build search query
  return `${year} ${brand} ${name} car`.trim().replace(/\s+/g, ' ');
}

/**
 * Search Google Images and get image URLs
 * Note: This is a simplified version. In practice, you might need to use Google Custom Search API
 * or a service like SerpAPI for reliable results.
 */
async function searchGoogleImages(query, numImages = 3) {
  console.log(`    Searching: "${query}"`);

  // This is a placeholder. In a real implementation, you would:
  // 1. Use Google Custom Search API with your API key
  // 2. Or use a service like SerpAPI
  // 3. Or use Playwright/Puppeteer to scrape (slower but works)

  // For now, return empty array - user should manually add images
  // or use the ComfyUI generation script instead
  console.log(`    ⚠️  Automated Google Images search not implemented`);
  console.log(`    Please manually download images for this car or use ComfyUI generation`);

  return [];
}

/**
 * Download images for a single car
 */
async function downloadCarImages(carData, index, total) {
  console.log(`\n[${index}/${total}] ${carData.name}`);
  console.log(`  🏭 ${carData.brand} | Year: ${carData.year || 'N/A'}`);

  const carDir = path.join(GALLERY_DIR, carData.id);

  // Check if car already has images
  const existingImages = fs.existsSync(carDir)
    ? fs.readdirSync(carDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    : [];

  if (existingImages.length >= IMAGES_PER_CAR) {
    console.log(`  ✓ Already has ${existingImages.length} images, skipping...`);
    return { success: existingImages.length, failed: 0 };
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(carDir)) {
    fs.mkdirSync(carDir, { recursive: true });
  }

  const searchQuery = getSearchQuery(carData);
  const imageUrls = await searchGoogleImages(searchQuery, IMAGES_PER_CAR);

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < imageUrls.length && i < IMAGES_PER_CAR; i++) {
    const url = imageUrls[i];
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const outputPath = path.join(carDir, `download_${i + 1}${ext}`);

    try {
      console.log(`  [${i + 1}/${IMAGES_PER_CAR}] Downloading...`);
      await downloadFile(url, outputPath);
      console.log(`    ✓ Downloaded: ${path.basename(outputPath)}`);
      downloaded++;

      // Delay between downloads
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
      }
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
      failed++;
    }
  }

  return { success: downloaded, failed };
}

/**
 * Main function
 */
async function main() {
  console.log('🖼️  Car Image Downloader (Google Images)\n');
  console.log('='.repeat(60));

  console.log('\n⚠️  IMPORTANT NOTICE:');
  console.log('Google Images scraping is complex and may violate Terms of Service.');
  console.log('This script provides a framework but requires manual implementation.');
  console.log('\nRecommended alternatives:');
  console.log('  1. Use ComfyUI generation: node scripts/generate-car-photos.js');
  console.log('  2. Manually download images and place in car folders');
  console.log('  3. Use Google Custom Search API (requires API key)');
  console.log('  4. Use a paid service like SerpAPI\n');
  console.log('='.repeat(60));

  // Load car list
  if (!fs.existsSync(CAR_LIST_FILE)) {
    console.error(`\n❌ Car list not found: ${CAR_LIST_FILE}`);
    process.exit(1);
  }

  const cars = JSON.parse(fs.readFileSync(CAR_LIST_FILE, 'utf8'));
  console.log(`\nLoaded ${cars.length} cars`);
  console.log(`Target: ${IMAGES_PER_CAR} images per car (${cars.length * IMAGES_PER_CAR} total)\n`);

  let totalDownloaded = 0;
  let totalFailed = 0;
  let carsSkipped = 0;

  for (let i = 0; i < cars.length; i++) {
    const result = await downloadCarImages(cars[i], i + 1, cars.length);

    if (result.success === 0 && result.failed === 0) {
      carsSkipped++;
    } else {
      totalDownloaded += result.success;
      totalFailed += result.failed;
    }

    // Small delay between cars
    if (i < cars.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Download Summary:\n');
  console.log(`  ✓ Images downloaded: ${totalDownloaded}`);
  console.log(`  ✗ Failed: ${totalFailed}`);
  console.log(`  ⏭️  Cars skipped (already have images): ${carsSkipped}`);
  console.log(`\n  📁 Gallery directory: ${GALLERY_DIR}`);

  console.log('\n💡 Next steps:');
  console.log('  1. Manually add more images to car folders if needed');
  console.log('  2. Run: node scripts/sanitize-car-images.js');
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the script
if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { downloadCarImages };
