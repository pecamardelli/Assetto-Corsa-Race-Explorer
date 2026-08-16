import fs from 'fs';
import path from 'path';

export interface CarData {
  name?: string;
  brand?: string;
  class?: string;
  specs?: Record<string, any>;
  year?: number;
  [key: string]: any;
}

const carsDataDir = path.join(process.cwd(), 'app', 'data', 'cars');
const galleryDir = path.join(process.cwd(), 'public', 'car-gallery');

// Cache for car data to avoid repeated file reads
const carDataCache = new Map<string, CarData | null>();

// A handful of cars never had a skin preview copied over, so the lookup is cached
// the same way the data is: pages ask for it once per car and per render.
const previewCache = new Map<string, string | null>();

/**
 * Load car data from the cars data folder
 * @param carName - The car folder name (e.g., "ks_ferrari_250_gto")
 * @returns Car data object or null if not found
 */
export function getCarData(carName: string): CarData | null {
  // Check cache first
  if (carDataCache.has(carName)) {
    return carDataCache.get(carName)!;
  }

  try {
    const carFilePath = path.join(carsDataDir, `${carName}.json`);

    if (!fs.existsSync(carFilePath)) {
      carDataCache.set(carName, null);
      return null;
    }

    const carData = JSON.parse(fs.readFileSync(carFilePath, 'utf8')) as CarData;
    carDataCache.set(carName, carData);
    return carData;
  } catch (error) {
    console.error(`Error loading car data for ${carName}:`, error);
    carDataCache.set(carName, null);
    return null;
  }
}

/**
 * Get the display name for a car
 * @param carName - The car folder name
 * @returns The car's display name or formatted car_name as fallback
 */
export function getCarName(carName: string): string {
  const carData = getCarData(carName);
  if (carData?.name) {
    return carData.name;
  }
  // Fallback to formatted car_name
  return carName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Where a car's skin preview can be loaded from, or null when none was copied.
 * The gallery script lands the preview first, so photo 01 is that shot.
 * @param carName - The car folder name
 */
export function getCarPreviewUrl(carName: string): string | null {
  if (previewCache.has(carName)) {
    return previewCache.get(carName)!;
  }

  const url = fs.existsSync(path.join(galleryDir, carName, '01.webp'))
    ? `/car-gallery/${carName}/01.webp`
    : null;
  previewCache.set(carName, url);
  return url;
}

/**
 * Get separated brand, model, and year for a car
 * @param carName - The car folder name
 * @returns Object with brand, model, year, and full name
 */
export function getCarDetails(carName: string): {
  name: string;
  brand: string;
  model: string;
  year: string;
} {
  const carData = getCarData(carName);

  if (!carData) {
    const formattedName = carName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      name: formattedName,
      brand: 'Unknown',
      model: formattedName,
      year: ''
    };
  }

  const fullName = carData.name || carName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const brand = carData.brand || 'Unknown';
  const year = carData.year?.toString() || '';

  // Remove brand from model name if it starts with the brand
  let model = fullName;
  if (brand !== 'Unknown' && fullName.toLowerCase().startsWith(brand.toLowerCase())) {
    model = fullName.substring(brand.length).trim();
  }

  // Remove year from model name if present (check for 4-digit year)
  if (year) {
    const yearPattern = new RegExp(`\\b${year}\\b`, 'g');
    model = model.replace(yearPattern, '').trim();
    // Clean up extra spaces
    model = model.replace(/\s+/g, ' ').trim();
  }

  return {
    name: fullName,
    brand: brand,
    model: model || fullName,
    year: year
  };
}
