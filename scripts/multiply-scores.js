const fs = require('fs');
const path = require('path');

function multiplyScoresInFile(filePath) {
  console.log(`Processing: ${filePath}`);

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    let modified = false;

    // Multiply total_score for each driver
    if (data.driver_statistics) {
      for (const driverName in data.driver_statistics) {
        const driver = data.driver_statistics[driverName];
        if (typeof driver.total_score === 'number') {
          driver.total_score = driver.total_score * 100;
          modified = true;
        }
      }
    }

    if (modified) {
      // Write back to file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  ✓ Updated scores in ${path.basename(filePath)}`);
    } else {
      console.log(`  - No scores found in ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      // Process JSON files
      multiplyScoresInFile(fullPath);
    }
  }
}

// Start processing from the data directory
const dataDir = path.join(__dirname, '..', 'app', 'data');
console.log('Starting score multiplication process...\n');
processDirectory(dataDir);
console.log('\nDone!');
