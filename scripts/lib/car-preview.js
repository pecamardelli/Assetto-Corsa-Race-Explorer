/**
 * The one way a car's card image gets made: a skin preview out of the Assetto Corsa
 * install, re-encoded as `public/car-gallery/<car_id>/01.webp`.
 *
 * Two callers share it and must agree on the result, which is why it is one module.
 * `scripts/copy-car-previews.js` runs it over every car in `app/data/cars` by hand, and
 * `app/lib/launch/car-import.ts` runs it for the one car a player has just picked in the
 * app - a pick used to bring the car's data and badge across and leave the picture
 * behind, so the Supra and the 812 Superfast raced whole seasons without one
 * (2026-09-19). Plain CommonJS so the script can `require` it and the app can import it
 * (tsconfig has allowJs).
 *
 * `01.webp` is the file the app reads: getCarPreviewUrl() returns
 * `/car-gallery/<id>/01.webp` or null, and CarGallery numbers its photos from 01.
 * Writing anything else leaves the car with no image at all.
 */
const fs = require("fs");
const path = require("path");

/** What a skin folder may hold as its preview, in the order it is looked for. */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".dds"];

/** The preview file inside one skin folder, or null. */
function previewIn(skinDir) {
  let files;
  try {
    files = fs.readdirSync(skinDir);
  } catch {
    return null;
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file, ext).toLowerCase();
    if (basename.startsWith("preview") && IMAGE_EXTENSIONS.includes(ext)) {
      return path.join(skinDir, file);
    }
  }
  return null;
}

/**
 * A preview for the car at `carDir`: the `preferredSkin`'s when it has one, otherwise
 * the first skin folder's that does. Null when the car has no usable preview at all.
 */
function findSkinPreview(carDir, preferredSkin) {
  const skinsDir = path.join(carDir, "skins");
  if (!fs.existsSync(skinsDir)) {
    return null;
  }
  if (preferredSkin) {
    const preferred = previewIn(path.join(skinsDir, preferredSkin));
    if (preferred) return preferred;
  }
  const skinFolders = fs
    .readdirSync(skinsDir)
    .filter((item) => fs.statSync(path.join(skinsDir, item)).isDirectory());
  for (const skinFolder of skinFolders) {
    const found = previewIn(path.join(skinsDir, skinFolder));
    if (found) return found;
  }
  return null;
}

/**
 * Re-encode `inputPath` as a WebP at `outputPath`, at most 1024 wide - the quality the
 * rest of the gallery was built at. Returns "processed" for a WebP source and
 * "converted" for anything else. No byte-copy fallback: copying a DDS or PNG to a
 * .webp path only yields an image the browser refuses, so a failure is thrown.
 *
 * sharp is required here rather than at the top so that a caller which only wants the
 * lookup (or runs where the encoder is broken) is not taken down with it.
 */
async function writePreviewWebp(inputPath, outputPath) {
  const sharp = require("sharp");
  const ext = path.extname(inputPath).toLowerCase();
  let image = sharp(inputPath);
  const metadata = await image.metadata();
  if (metadata.width > 1024) {
    image = image.resize(1024, null, { fit: "inside", withoutEnlargement: true });
  }
  await image.webp({ quality: 85, effort: 6 }).toFile(outputPath);
  return ext === ".webp" ? "processed" : "converted";
}

/**
 * Make an entry's on-disk casing match `name` exactly.
 *
 * Windows resolves paths case-insensitively, so mkdir/writeFile against a new casing
 * silently reuses the existing entry and keeps its old name. The app puts car ids
 * straight into URLs, which a case-sensitive host will not forgive, so drift has to be
 * corrected rather than tolerated. The rename goes via a temp name because a
 * same-name-different-case rename is a no-op here. Returns true when a rename happened.
 */
function ensureExactCase(parentDir, name) {
  let entries;
  try {
    entries = fs.readdirSync(parentDir);
  } catch {
    return false;
  }
  const actual = entries.find((e) => e.toLowerCase() === name.toLowerCase());
  if (!actual || actual === name) {
    return false;
  }
  const tmp = path.join(parentDir, `__case__${name}`);
  fs.renameSync(path.join(parentDir, actual), tmp);
  fs.renameSync(tmp, path.join(parentDir, name));
  return true;
}

/**
 * Put `01.webp` in place for one car, if it is not there already.
 *
 * Returns "exists" when photo 01 was already there (anything already there wins),
 * "not_found" when the install has no preview for the car, otherwise what
 * writePreviewWebp returned. Errors from the encoder propagate.
 */
async function importCarPreview(acCarsDir, galleryDir, carId, preferredSkin) {
  const carOutputDir = path.join(galleryDir, carId);
  fs.mkdirSync(carOutputDir, { recursive: true });
  ensureExactCase(galleryDir, carId);

  const outputPath = path.join(carOutputDir, "01.webp");
  if (fs.existsSync(outputPath)) {
    return "exists";
  }
  const previewPath = findSkinPreview(path.join(acCarsDir, carId), preferredSkin);
  if (!previewPath) {
    return "not_found";
  }
  return writePreviewWebp(previewPath, outputPath);
}

module.exports = {
  IMAGE_EXTENSIONS,
  findSkinPreview,
  writePreviewWebp,
  ensureExactCase,
  importCarPreview,
};
