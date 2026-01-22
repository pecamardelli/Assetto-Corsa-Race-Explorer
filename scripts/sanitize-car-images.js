const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const GALLERY_DIR = path.join(__dirname, '..', 'public', 'car-gallery');
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif'];

/**
 * Get all image files in a directory
 */
function getImageFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Extract number from filename
 */
function extractNumber(filename) {
  const basename = path.basename(filename, path.extname(filename));
  const match = basename.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Convert a single image to WebP
 */
async function convertToWebP(inputPath) {
  const outputPath = path.join(
    path.dirname(inputPath),
    path.basename(inputPath, path.extname(inputPath)) + '.webp'
  );

  // Skip if already WebP
  if (path.extname(inputPath).toLowerCase() === '.webp') {
    return { success: true, savedBytes: 0, skipped: true };
  }

  try {
    console.log(`    Converting: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);

    const inputStats = fs.statSync(inputPath);

    // Convert to WebP with optimization
    await sharp(inputPath)
      .webp({
        quality: 90,
        effort: 6
      })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const savedKB = ((inputStats.size - outputStats.size) / 1024).toFixed(1);
    const savedPercent = (((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1);

    console.log(`      ✓ Converted: ${(inputStats.size / 1024).toFixed(1)}KB → ${(outputStats.size / 1024).toFixed(1)}KB (saved ${savedKB}KB, ${savedPercent}%)`);

    // Delete original file
    fs.unlinkSync(inputPath);
    console.log(`      🗑️  Deleted: ${path.basename(inputPath)}`);

    return {
      success: true,
      savedBytes: inputStats.size - outputStats.size,
      skipped: false
    };
  } catch (err) {
    console.error(`      ✗ Error converting ${path.basename(inputPath)}:`, err.message);
    return {
      success: false,
      savedBytes: 0,
      skipped: false
    };
  }
}

/**
 * Sanitize images in a car folder
 */
async function sanitizeCarFolder(carFolder) {
  const carId = path.basename(carFolder);
  console.log(`\n📁 Processing: ${carId}`);

  // Get all image files
  const imageFiles = getImageFiles(carFolder);

  if (imageFiles.length === 0) {
    console.log('  ℹ️  No images found, skipping...');
    return { processed: 0, failed: 0, savedBytes: 0 };
  }

  console.log(`  Found ${imageFiles.length} image(s)`);

  // Separate numbered and unnumbered files
  const withNumbers = imageFiles
    .map(file => ({
      path: file,
      number: extractNumber(file)
    }))
    .filter(item => item.number !== null)
    .sort((a, b) => a.number - b.number);

  const unnumberedFiles = imageFiles
    .filter(file => extractNumber(file) === null);

  // Combine: numbered files first, then unnumbered files appended at the end
  const allFilesToProcess = [
    ...withNumbers.map(item => item.path),
    ...unnumberedFiles
  ];

  console.log('\n  Step 1: Renaming files to convention...');

  // STEP 1: Create mapping of current files to target names
  const renameMap = new Map();
  for (let i = 0; i < allFilesToProcess.length; i++) {
    const originalPath = allFilesToProcess[i];
    const newNumber = String(i + 1).padStart(2, '0');
    const ext = path.extname(originalPath);
    const targetPath = path.join(carFolder, `${newNumber}${ext}`);

    renameMap.set(originalPath, targetPath);
  }

  // Find files that need to be moved out of the way
  const conflicts = [];
  for (const [source, target] of renameMap.entries()) {
    if (source !== target && fs.existsSync(target)) {
      // Target exists and is different from source
      if (!renameMap.has(target)) {
        // Target will not be renamed, so it's a conflict
        conflicts.push(target);
      }
    }
  }

  // Delete conflicting files that are not in our rename list
  for (const conflict of conflicts) {
    console.log(`    🗑️  Removing conflicting file: ${path.basename(conflict)}`);
    fs.unlinkSync(conflict);
  }

  // Perform renames
  const renamedFiles = [];
  for (const [source, target] of renameMap.entries()) {
    if (source === target) {
      renamedFiles.push(target);
      console.log(`    ✓ Already correct: ${path.basename(target)}`);
    } else {
      try {
        fs.renameSync(source, target);
        renamedFiles.push(target);
        console.log(`    Renamed: ${path.basename(source)} → ${path.basename(target)}`);
      } catch (err) {
        console.error(`    ✗ Error renaming ${path.basename(source)}:`, err.message);
        renamedFiles.push(source);
      }
    }
  }

  console.log('\n  Step 2: Converting to WebP...');

  // STEP 2: Convert all files to WebP if necessary
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let totalSaved = 0;

  for (const filePath of renamedFiles) {
    const result = await convertToWebP(filePath);

    if (result.success) {
      if (result.skipped) {
        skipped++;
        console.log(`    ✓ Already WebP: ${path.basename(filePath)}`);
      } else {
        converted++;
        totalSaved += result.savedBytes;
      }
    } else {
      failed++;
    }
  }

  // Log info about unnumbered files that were processed
  if (unnumberedFiles.length > 0) {
    console.log(`\n  ℹ️  Processed ${unnumberedFiles.length} unnumbered file(s) (assigned sequential numbers)`);
  }

  console.log(`\n  Summary: ${converted} converted, ${skipped} already WebP, ${failed} failed`);

  return { processed: converted + skipped, failed, savedBytes: totalSaved };
}

/**
 * Main function
 */
async function main() {
  console.log('🖼️  Car Gallery Image Sanitizer\n');
  console.log('='.repeat(60));
  console.log('\nConfiguration:');
  console.log(`  Gallery directory: ${GALLERY_DIR}`);
  console.log(`  Output format: WebP`);
  console.log(`  Naming convention: 01.webp, 02.webp, 03.webp, ...`);
  console.log('\n' + '='.repeat(60));

  // Check if gallery directory exists
  if (!fs.existsSync(GALLERY_DIR)) {
    console.error(`\n❌ Gallery directory not found: ${GALLERY_DIR}`);
    process.exit(1);
  }

  // Get all car folders
  const entries = fs.readdirSync(GALLERY_DIR, { withFileTypes: true });
  const carFolders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(GALLERY_DIR, entry.name));

  if (carFolders.length === 0) {
    console.log('\n⚠️  No car folders found in gallery directory');
    process.exit(0);
  }

  console.log(`\nFound ${carFolders.length} car folder(s) to process\n`);

  // Process each car folder
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSavedBytes = 0;
  const failedCars = [];

  for (let i = 0; i < carFolders.length; i++) {
    const result = await sanitizeCarFolder(carFolders[i]);

    totalProcessed += result.processed;
    totalFailed += result.failed;
    totalSavedBytes += result.savedBytes;

    if (result.failed > 0) {
      failedCars.push(path.basename(carFolders[i]));
    }

    // Small delay between folders
    if (i < carFolders.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Sanitization Summary:\n');
  console.log(`  ✓ Images processed: ${totalProcessed}`);
  console.log(`  ✗ Failed: ${totalFailed}`);
  console.log(`  🗂️  Car folders: ${carFolders.length}`);
  console.log(`  💾 Total space saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);

  if (failedCars.length > 0) {
    console.log('\n  Cars with failures:');
    failedCars.forEach(car => console.log(`    - ${car}`));
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the script
if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { sanitizeCarFolder };
