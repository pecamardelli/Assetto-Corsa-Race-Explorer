/**
 * Copy each car's skin preview out of Assetto Corsa into public/car-gallery.
 *
 * The output is `<car_id>/01.webp`, because that is the file the app reads:
 * getCarPreviewUrl() in app/lib/car-data.ts returns `/car-gallery/<id>/01.webp`
 * or null, and CarGallery numbers its photos from 01. Photos 02+ are added by
 * hand. Writing anything else here leaves the car with no image at all.
 *
 * Car ids are case-sensitive to the app (they end up in URLs) but not to
 * Windows, so this also repairs a gallery folder whose casing has drifted -
 * see ensureExactCase().
 */
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
 * Resize to at most 1024 wide and write the result as WebP.
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

    // Always WebP, matching the quality the rest of the gallery was built at.
    await image.webp({ quality: 85, effort: 6 }).toFile(outputPath);
    return ext === ".webp" ? "processed" : "converted";
  } catch (err) {
    // No byte-copy fallback: the output must be a real WebP, so copying a DDS
    // or PNG to a .webp path would just produce an image the browser refuses.
    throw err;
  }
}

/**
 * Make an entry's on-disk casing match `name` exactly.
 *
 * Windows resolves paths case-insensitively, so mkdir/writeFile against a new
 * casing silently reuses the existing entry and keeps its old name. The app
 * puts car ids straight into URLs, which a case-sensitive host will not
 * forgive, so drift has to be corrected rather than tolerated. The rename goes
 * via a temp name because a same-name-different-case rename is a no-op here.
 */
function ensureExactCase(parentDir, name) {
  const actual = fs
    .readdirSync(parentDir)
    .find((e) => e.toLowerCase() === name.toLowerCase());

  if (!actual || actual === name) {
    return false;
  }

  const tmp = path.join(parentDir, `__case__${name}`);
  fs.renameSync(path.join(parentDir, actual), tmp);
  fs.renameSync(tmp, path.join(parentDir, name));
  console.log(`    ↳ gallery folder re-cased: ${actual} -> ${name}`);
  return true;
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
  ensureExactCase(OUTPUT_DIR, carId);

  // Photo 01 is the preview the app asks for; anything already there wins.
  const outputPath = path.join(carOutputDir, "01.webp");
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
