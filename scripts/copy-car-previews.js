/**
 * Copy each car's skin preview out of Assetto Corsa into public/car-gallery.
 *
 * The output is `<car_id>/01.webp`, because that is the file the app reads:
 * getCarPreviewUrl() in app/lib/car-data.ts returns `/car-gallery/<id>/01.webp`
 * or null, and CarGallery numbers its photos from 01. Photos 02+ are added by
 * hand. Writing anything else here leaves the car with no image at all.
 *
 * The lookup, the encoding and the case repair live in lib/car-preview.js, which
 * the app's own car importer shares: a car picked in the app gets its preview the
 * same way at pick time, and this script is the catch-up for everything already in
 * app/data/cars. It is not part of the build; run it by hand.
 *
 * Car ids are case-sensitive to the app (they end up in URLs) but not to
 * Windows, so this also repairs a gallery folder whose casing has drifted.
 */
const fs = require("fs");
const path = require("path");
const { importCarPreview } = require("./lib/car-preview");

// Configuration
const AC_CARS_DIR = "C:\\GAMES\\Assetto Corsa\\content\\cars";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "car-gallery");
const CAR_DATA_DIR = path.join(__dirname, "..", "app", "data", "cars");

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
 * Process a single car
 */
async function processCar(carId, index, total) {
  const before = fs
    .readdirSync(OUTPUT_DIR)
    .find((e) => e.toLowerCase() === carId.toLowerCase());

  try {
    const outcome = await importCarPreview(AC_CARS_DIR, OUTPUT_DIR, carId);
    if (before && before !== carId) {
      console.log(`    ↳ gallery folder re-cased: ${before} -> ${carId}`);
    }
    if (outcome === "exists") {
      console.log(
        `[${index}/${total}] ⊘ ${carId.padEnd(40)} - Preview already exists`
      );
      return { status: "skipped", carId };
    }
    if (outcome === "not_found") {
      console.log(
        `[${index}/${total}] ✗ ${carId.padEnd(40)} - No preview found`
      );
      return { status: "not_found", carId };
    }
    console.log(
      `[${index}/${total}] ✓ ${carId.padEnd(40)} - Preview ${outcome}`
    );
    return { status: "success", carId, processType: outcome };
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

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
