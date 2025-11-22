const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Path to Assetto Corsa installation
const AC_PATH = 'C:\\GAMES\\Assetto Corsa';

// Maximum width for resizing badges
const MAX_WIDTH = 1024;

// Get championship files to find which cars are used
const championshipDir = path.join(__dirname, '..', 'app', 'data', 'championship', 'Le Mans Classic', 'Season 01');
const badgesDir = path.join(__dirname, '..', 'public', 'badges');

// Create badges directory if it doesn't exist
if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
  console.log(`Created directory: ${badgesDir}`);
}

// Collect unique car names from championship files
const carNames = new Set();

const files = fs.readdirSync(championshipDir)
  .filter(file => file.endsWith('.json'));

console.log(`Scanning ${files.length} championship files for car names...`);

files.forEach(file => {
  const filePath = path.join(championshipDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (data.driver_statistics) {
    Object.values(data.driver_statistics).forEach(stats => {
      if (stats.car_name) {
        carNames.add(stats.car_name);
      }
    });
  }
});

console.log(`\nFound ${carNames.size} unique cars`);
console.log('\nCopying badges...');

let copiedCount = 0;
let skippedCount = 0;
let notFoundCount = 0;
let resizedCount = 0;

// Process badges with async operations
async function processBadges() {
  for (const carName of carNames) {
    const badgePath = path.join(AC_PATH, 'content', 'cars', carName, 'ui', 'badge.png');
    const destPath = path.join(badgesDir, `${carName}.png`);

    if (fs.existsSync(destPath)) {
      console.log(`⊘ Skipped (already exists): ${carName}.png`);
      skippedCount++;
    } else if (fs.existsSync(badgePath)) {
      try {
        // Get image metadata to check dimensions
        const metadata = await sharp(badgePath).metadata();

        if (metadata.width && metadata.width > MAX_WIDTH) {
          // Resize if wider than MAX_WIDTH
          await sharp(badgePath)
            .resize(MAX_WIDTH, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .toFile(destPath);
          console.log(`✓ Copied and resized: ${carName}.png (${metadata.width}px → ${MAX_WIDTH}px)`);
          resizedCount++;
        } else {
          // Copy as-is if smaller than or equal to MAX_WIDTH
          await sharp(badgePath).toFile(destPath);
          console.log(`✓ Copied: ${carName}.png (${metadata.width}px)`);
        }
        copiedCount++;
      } catch (error) {
        console.log(`✗ Error processing ${carName}: ${error.message}`);
        notFoundCount++;
      }
    } else {
      console.log(`✗ Not found: ${carName}`);
      notFoundCount++;
    }
  }
}

processBadges().then(() => {
  console.log(`\n✅ Done!`);
  console.log(`Copied: ${copiedCount}`);
  console.log(`  - Resized: ${resizedCount}`);
  console.log(`  - As-is: ${copiedCount - resizedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Not found: ${notFoundCount}`);
  console.log(`Total: ${carNames.size}`);
}).catch(error => {
  console.error('Error processing badges:', error);
  process.exit(1);
});
