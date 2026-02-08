const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const PORTRAITS_DIR = path.join(__dirname, '..', 'public', 'driver-portraits');
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif'];

/**
 * Get all image files in the portraits directory
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
 * Sanitize a filename to a consistent convention:
 * lowercase, spaces to underscores, remove non-alphanumeric (except underscores)
 */
function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_áéíóúàèìòùäëïöüâêîôûãõñçšžđ-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Convert a single image to WebP
 */
async function convertToWebP(inputPath) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const sanitized = sanitizeFilename(basename);
  const outputPath = path.join(path.dirname(inputPath), sanitized + '.webp');

  // Skip if already a correctly named WebP
  if (inputPath === outputPath) {
    return { success: true, savedBytes: 0, skipped: true };
  }

  try {
    const inputStats = fs.statSync(inputPath);

    // Convert to WebP with optimization
    await sharp(inputPath)
      .webp({
        quality: 90,
        effort: 6
      })
      .toFile(outputPath + '.tmp');

    // Rename tmp to final (handles case where input and output basenames match but extension differs)
    if (fs.existsSync(outputPath) && outputPath !== inputPath) {
      fs.unlinkSync(outputPath);
    }
    fs.renameSync(outputPath + '.tmp', outputPath);

    const outputStats = fs.statSync(outputPath);
    const savedKB = ((inputStats.size - outputStats.size) / 1024).toFixed(1);
    const savedPercent = (((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1);

    console.log(`  ${path.basename(inputPath)} -> ${path.basename(outputPath)}  (${(inputStats.size / 1024).toFixed(1)}KB -> ${(outputStats.size / 1024).toFixed(1)}KB, saved ${savedPercent}%)`);

    // Delete original file if it's different from the output
    if (inputPath !== outputPath) {
      fs.unlinkSync(inputPath);
    }

    return {
      success: true,
      savedBytes: inputStats.size - outputStats.size,
      skipped: false,
      renamed: basename !== sanitized
    };
  } catch (err) {
    // Clean up tmp file on error
    if (fs.existsSync(outputPath + '.tmp')) {
      fs.unlinkSync(outputPath + '.tmp');
    }
    console.error(`  Error converting ${path.basename(inputPath)}:`, err.message);
    return {
      success: false,
      savedBytes: 0,
      skipped: false,
      renamed: false
    };
  }
}

/**
 * Check for duplicate basenames (e.g., driver.png and driver.jpg)
 */
function findDuplicates(files) {
  const byBasename = new Map();

  for (const file of files) {
    const basename = sanitizeFilename(path.basename(file, path.extname(file)));
    if (!byBasename.has(basename)) {
      byBasename.set(basename, []);
    }
    byBasename.get(basename).push(file);
  }

  return byBasename;
}

/**
 * Main function
 */
async function main() {
  console.log('Driver Portrait Sanitizer\n');
  console.log('='.repeat(60));
  console.log('\nConfiguration:');
  console.log(`  Portraits directory: ${PORTRAITS_DIR}`);
  console.log(`  Output format: WebP (quality 90)`);
  console.log(`  Naming: lowercase_with_underscores.webp`);
  console.log('\n' + '='.repeat(60));

  // Check if directory exists
  if (!fs.existsSync(PORTRAITS_DIR)) {
    console.error(`\nPortraits directory not found: ${PORTRAITS_DIR}`);
    process.exit(1);
  }

  // Get all image files
  const imageFiles = getImageFiles(PORTRAITS_DIR);

  if (imageFiles.length === 0) {
    console.log('\nNo images found in portraits directory');
    process.exit(0);
  }

  console.log(`\nFound ${imageFiles.length} image(s)\n`);

  // Check for duplicates
  const grouped = findDuplicates(imageFiles);
  const duplicates = [...grouped.entries()].filter(([, files]) => files.length > 1);

  if (duplicates.length > 0) {
    console.log('Duplicate basenames detected (keeping newest):');
    for (const [basename, files] of duplicates) {
      // Sort by mtime, keep newest
      files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      console.log(`  ${basename}:`);
      files.forEach((f, i) => {
        const marker = i === 0 ? 'KEEP' : 'DELETE';
        console.log(`    [${marker}] ${path.basename(f)}`);
      });
      // Delete older duplicates
      for (let i = 1; i < files.length; i++) {
        fs.unlinkSync(files[i]);
      }
    }
    console.log('');
  }

  // Refresh file list after removing duplicates
  const filesToProcess = getImageFiles(PORTRAITS_DIR);

  console.log('Converting to WebP...\n');

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let renamed = 0;
  let totalSaved = 0;

  for (const filePath of filesToProcess) {
    const result = await convertToWebP(filePath);

    if (result.success) {
      if (result.skipped) {
        skipped++;
        console.log(`  ${path.basename(filePath)} (already WebP, skipped)`);
      } else {
        converted++;
        totalSaved += result.savedBytes;
        if (result.renamed) renamed++;
      }
    } else {
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\nSummary:\n');
  console.log(`  Converted: ${converted}`);
  console.log(`  Already WebP: ${skipped}`);
  console.log(`  Renamed: ${renamed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Space saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the script
if (require.main === module) {
  main().catch(err => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
}

module.exports = { sanitizeFilename, convertToWebP };
