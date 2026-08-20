const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Configuration
const GALLERY_DIR = path.join(__dirname, "..", "public", "car-gallery");

/**
 * Convert a single PNG to WebP
 */
async function convertToWebP(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp");

  // Skip if WebP already exists
  if (fs.existsSync(webpPath)) {
    return { status: "skipped", path: webpPath };
  }

  try {
    await sharp(pngPath)
      .webp({ quality: 85, effort: 6 })
      .toFile(webpPath);

    return { status: "success", path: webpPath };
  } catch (err) {
    return { status: "error", path: pngPath, error: err.message };
  }
}

/**
 * Process all car folders
 */
async function main() {
  console.log("🔄 Converting PNG previews to WebP\n");
  console.log("=".repeat(60));

  if (!fs.existsSync(GALLERY_DIR)) {
    console.error(`\n❌ Gallery directory not found: ${GALLERY_DIR}\n`);
    process.exit(1);
  }

  // Get all car folders
  const carFolders = fs
    .readdirSync(GALLERY_DIR)
    .filter((item) => {
      const itemPath = path.join(GALLERY_DIR, item);
      return fs.statSync(itemPath).isDirectory();
    });

  console.log(`\n📁 Found ${carFolders.length} car folders\n`);
  console.log("=".repeat(60));
  console.log("\n🚀 Processing...\n");

  const results = {
    success: 0,
    skipped: 0,
    error: 0,
  };

  const errors = [];

  for (let i = 0; i < carFolders.length; i++) {
    const carId = carFolders[i];
    const carFolder = path.join(GALLERY_DIR, carId);

    // Find all PNG files in this car folder
    const files = fs.readdirSync(carFolder);
    const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));

    if (pngFiles.length === 0) {
      continue;
    }

    process.stdout.write(
      `[${(i + 1).toString().padStart(3)}/${carFolders.length}] ${carId.padEnd(
        40
      )} - `
    );

    let carSuccess = 0;
    let carSkipped = 0;
    let carError = 0;

    for (const pngFile of pngFiles) {
      const pngPath = path.join(carFolder, pngFile);
      const result = await convertToWebP(pngPath);

      if (result.status === "success") {
        carSuccess++;
        results.success++;
      } else if (result.status === "skipped") {
        carSkipped++;
        results.skipped++;
      } else if (result.status === "error") {
        carError++;
        results.error++;
        errors.push({ carId, file: pngFile, error: result.error });
      }
    }

    if (carError > 0) {
      console.log(`✗ ${carError} error(s)`);
    } else if (carSuccess > 0) {
      console.log(`✓ ${carSuccess} converted`);
    } else {
      console.log(`⊘ ${carSkipped} skipped`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Summary:\n");
  console.log(`  ✓ Successfully converted: ${results.success}`);
  console.log(`  ⊘ Already existed: ${results.skipped}`);
  console.log(`  ✗ Errors: ${results.error}`);
  console.log(`  📦 Total cars: ${carFolders.length}`);

  if (errors.length > 0) {
    console.log("\n  Errors:");
    errors.forEach(({ carId, file, error }) =>
      console.log(`    - ${carId}/${file}: ${error}`)
    );
  }

  console.log(`\n  📁 Output directory: ${GALLERY_DIR}`);
  console.log("\n" + "=".repeat(60) + "\n");
}

// Run the script
if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { convertToWebP };
