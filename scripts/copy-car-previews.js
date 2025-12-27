const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Configuration
const AC_CARS_DIR = "C:\\GAMES\\Assetto Corsa\\content\\cars";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "car-gallery");
const CAR_DATA_DIR = path.join(__dirname, "..", "app", "data", "cars");

// Supported image formats
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".dds"];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Find all car data files to know which cars to process
 */
function getCarList() {
  if (!fs.existsSync(CAR_DATA_DIR)) {
    console.error(`\n⚠️  Car data directory not found: ${CAR_DATA_DIR}`);
    return [];
  }

  const files = fs.readdirSync(CAR_DATA_DIR);
  const carIds = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));

  return carIds;
}

/**
 * Find a random skin preview in the car's skins folder
 */
function findRandomSkinPreview(carId) {
  const carDir = path.join(AC_CARS_DIR, carId);

  // Check if car directory exists
  if (!fs.existsSync(carDir)) {
    return null;
  }

  const skinsDir = path.join(carDir, "skins");

  // Check if skins directory exists
  if (!fs.existsSync(skinsDir)) {
    return null;
  }

  // Get all skin folders
  const skinFolders = fs
    .readdirSync(skinsDir)
    .filter((item) => {
      const itemPath = path.join(skinsDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

  if (skinFolders.length === 0) {
    return null;
  }

  // Try each skin folder to find one with a preview
  for (const skinFolder of skinFolders) {
    const skinPath = path.join(skinsDir, skinFolder);

    // Look for preview_*.extension files
    const files = fs.readdirSync(skinPath);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file, ext).toLowerCase();

      // Check if it's a preview file with supported extension
      if (basename.startsWith("preview") && IMAGE_EXTENSIONS.includes(ext)) {
        return path.join(skinPath, file);
      }
    }
  }

  return null;
}

/**
 * Convert image to PNG if necessary and resize
 */
async function processImage(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  try {
    let image = sharp(inputPath);

    // Get image metadata to check dimensions
    const metadata = await image.metadata();

    // Resize if image is too large (max 1024 width, maintaining aspect ratio)
    if (metadata.width > 1024) {
      image = image.resize(1024, null, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to PNG if not already
    if (ext !== ".png") {
      await image.png({ quality: 90 }).toFile(outputPath);
      return "converted";
    } else {
      // Just copy if already PNG
      await image.png({ quality: 90 }).toFile(outputPath);
      return "processed";
    }
  } catch (err) {
    // If sharp fails (e.g., DDS format not supported), try direct copy
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
      fs.copyFileSync(inputPath, outputPath);
      return "copied";
    }
    throw err;
  }
}

/**
 * Process a single car
 */
async function processCar(carId, index, total) {
  // Create car output directory
  const carOutputDir = path.join(OUTPUT_DIR, carId);
  if (!fs.existsSync(carOutputDir)) {
    fs.mkdirSync(carOutputDir, { recursive: true });
  }

  // Check if 00.png already exists
  const outputPath = path.join(carOutputDir, "00.png");
  if (fs.existsSync(outputPath)) {
    console.log(
      `[${index}/${total}] ⊘ ${carId.padEnd(40)} - Preview already exists`
    );
    return { status: "skipped", carId };
  }

  // Find a random skin preview
  const previewPath = findRandomSkinPreview(carId);

  if (!previewPath) {
    console.log(
      `[${index}/${total}] ✗ ${carId.padEnd(40)} - No preview found`
    );
    return { status: "not_found", carId };
  }

  try {
    const processType = await processImage(previewPath, outputPath);
    console.log(
      `[${index}/${total}] ✓ ${carId.padEnd(40)} - Preview ${processType}`
    );
    return { status: "success", carId, processType };
  } catch (err) {
    console.log(
      `[${index}/${total}] ✗ ${carId.padEnd(40)} - Error: ${err.message}`
    );
    return { status: "error", carId, error: err.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🚗 Car Preview Copy Script\n");
  console.log("=".repeat(60));

  // Check if AC cars directory exists
  if (!fs.existsSync(AC_CARS_DIR)) {
    console.error(`\n❌ Assetto Corsa cars directory not found!`);
    console.error(`   Expected: ${AC_CARS_DIR}`);
    console.error(`\n   Please check the path and try again.\n`);
    process.exit(1);
  }

  // Get list of cars to process
  console.log("\n📄 Loading car list...");
  const carIds = getCarList();
  console.log(`   Found ${carIds.length} cars to process`);

  if (carIds.length === 0) {
    console.error("\n⚠️  No cars found to process!\n");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n🚀 Processing car previews...\n");

  const results = {
    success: 0,
    skipped: 0,
    not_found: 0,
    error: 0,
  };

  const notFoundCars = [];
  const errorCars = [];

  for (let i = 0; i < carIds.length; i++) {
    const result = await processCar(carIds[i], i + 1, carIds.length);

    if (result.status === "success") {
      results.success++;
    } else if (result.status === "skipped") {
      results.skipped++;
    } else if (result.status === "not_found") {
      results.not_found++;
      notFoundCars.push(result.carId);
    } else if (result.status === "error") {
      results.error++;
      errorCars.push({ carId: result.carId, error: result.error });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Summary:\n");
  console.log(`  ✓ Successfully processed: ${results.success}`);
  console.log(`  ⊘ Already existed: ${results.skipped}`);
  console.log(`  ✗ Preview not found: ${results.not_found}`);
  console.log(`  ✗ Errors: ${results.error}`);
  console.log(`  📦 Total cars: ${carIds.length}`);

  if (notFoundCars.length > 0) {
    console.log("\n  Cars without previews:");
    notFoundCars.forEach((carId) => console.log(`    - ${carId}`));
  }

  if (errorCars.length > 0) {
    console.log("\n  Cars with errors:");
    errorCars.forEach(({ carId, error }) =>
      console.log(`    - ${carId}: ${error}`)
    );
  }

  console.log(`\n  📁 Output directory: ${OUTPUT_DIR}`);
  console.log("\n" + "=".repeat(60) + "\n");
}

// Run the script
if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { processCar };
