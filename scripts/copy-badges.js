const fs = require('fs');
const path = require('path');

// Path to Assetto Corsa installation
const AC_PATH = 'C:\\GAMES\\Assetto Corsa';

// Get championship files to find which cars are used
const championshipDir = path.join(__dirname, '..', 'app', 'data', 'championship', 'e3dabc14-e97d-4951-b132-761ffad3608d');
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

carNames.forEach(carName => {
  const badgePath = path.join(AC_PATH, 'content', 'cars', carName, 'ui', 'badge.png');
  const destPath = path.join(badgesDir, `${carName}.png`);

  if (fs.existsSync(destPath)) {
    console.log(`⊘ Skipped (already exists): ${carName}.png`);
    skippedCount++;
  } else if (fs.existsSync(badgePath)) {
    fs.copyFileSync(badgePath, destPath);
    console.log(`✓ Copied: ${carName}.png`);
    copiedCount++;
  } else {
    console.log(`✗ Not found: ${carName}`);
    notFoundCount++;
  }
});

console.log(`\n✅ Done!`);
console.log(`Copied: ${copiedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Not found: ${notFoundCount}`);
console.log(`Total: ${carNames.size}`);
