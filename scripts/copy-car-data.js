const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Path to Assetto Corsa installation
const AC_PATH = 'C:\\GAMES\\Assetto Corsa';
const carsSourceDir = path.join(AC_PATH, 'content', 'cars');
const carsDestDir = path.join(__dirname, '..', 'app', 'data', 'cars');
const badgesDir = path.join(__dirname, '..', 'public', 'badges');

// Maximum width for resizing badges
const MAX_WIDTH = 1024;

// Get championship files to find which cars are used
const championshipDir = path.join(__dirname, '..', 'app', 'data', 'championship', 'e3dabc14-e97d-4951-b132-761ffad3608d');

// Create destination directories if they don't exist
if (!fs.existsSync(carsDestDir)) {
  fs.mkdirSync(carsDestDir, { recursive: true });
  console.log(`Created directory: ${carsDestDir}`);
}

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
console.log('\nCopying car data and badges...');

let carDataCopied = 0;
let carDataSkipped = 0;
let carDataNotFound = 0;
let badgesCopied = 0;
let badgesSkipped = 0;
let badgesNotFound = 0;
let badgesResized = 0;

async function processCars() {
  for (const carName of carNames) {
    const uiCarJsonPath = path.join(carsSourceDir, carName, 'ui', 'ui_car.json');
    const carDataDestPath = path.join(carsDestDir, `${carName}.json`);
    const badgePath = path.join(carsSourceDir, carName, 'ui', 'badge.png');
    const badgeDestPath = path.join(badgesDir, `${carName}.png`);

    // Copy car data
    if (fs.existsSync(carDataDestPath)) {
      console.log(`⊘ Car data skipped (already exists): ${carName}.json`);
      carDataSkipped++;
    } else if (fs.existsSync(uiCarJsonPath)) {
      try {
        // Read the ui_car.json file
        const carData = JSON.parse(fs.readFileSync(uiCarJsonPath, 'utf8'));

        // Remove power_curve, torque_curve, powerCurve, torqueCurve, and tags
        delete carData.power_curve;
        delete carData.torque_curve;
        delete carData.powerCurve;
        delete carData.torqueCurve;
        delete carData.tags;

        // Write to destination
        fs.writeFileSync(carDataDestPath, JSON.stringify(carData, null, 2), 'utf8');
        console.log(`✓ Car data copied: ${carName}.json`);
        carDataCopied++;
      } catch (error) {
        console.log(`✗ Error copying car data ${carName}: ${error.message}`);
        carDataNotFound++;
      }
    } else {
      console.log(`✗ ui_car.json not found: ${carName}`);
      carDataNotFound++;
    }

    // Copy and resize badge
    if (fs.existsSync(badgeDestPath)) {
      console.log(`⊘ Badge skipped (already exists): ${carName}.png`);
      badgesSkipped++;
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
            .toFile(badgeDestPath);
          console.log(`✓ Badge copied and resized: ${carName}.png (${metadata.width}px → ${MAX_WIDTH}px)`);
          badgesResized++;
        } else {
          // Copy as-is if smaller than or equal to MAX_WIDTH
          await sharp(badgePath).toFile(badgeDestPath);
          console.log(`✓ Badge copied: ${carName}.png (${metadata.width}px)`);
        }
        badgesCopied++;
      } catch (error) {
        console.log(`✗ Error processing badge ${carName}: ${error.message}`);
        badgesNotFound++;
      }
    } else {
      console.log(`✗ Badge not found: ${carName}`);
      badgesNotFound++;
    }
  }
}

processCars().then(() => {
  console.log(`\n✅ Done!`);
  console.log(`\nCar Data:`);
  console.log(`  Copied: ${carDataCopied}`);
  console.log(`  Skipped: ${carDataSkipped}`);
  console.log(`  Not found/Error: ${carDataNotFound}`);
  console.log(`\nBadges:`);
  console.log(`  Copied: ${badgesCopied}`);
  console.log(`    - Resized: ${badgesResized}`);
  console.log(`    - As-is: ${badgesCopied - badgesResized}`);
  console.log(`  Skipped: ${badgesSkipped}`);
  console.log(`  Not found: ${badgesNotFound}`);
  console.log(`\nTotal cars processed: ${carNames.size}`);
}).catch(error => {
  console.error('Error processing cars:', error);
  process.exit(1);
});
