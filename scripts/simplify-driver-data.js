const fs = require('fs');
const path = require('path');

// Physical feature variations by ethnicity/region
const featuresByNationality = {
  // Latin American
  Argentina: [
    'light tan skin, dark brown hair, brown eyes, European-Latin features, athletic build',
    'olive skin, black hair, dark brown eyes, strong jawline, athletic build',
    'medium tan skin, wavy dark hair, hazel eyes, Mediterranean features, athletic build',
  ],
  Bolivia: [
    'tan skin, straight black hair, dark brown eyes, indigenous features, prominent cheekbones, athletic build',
    'medium brown skin, dark brown hair, deep brown eyes, Andean features, athletic build',
  ],
  Brazil: [
    'medium brown skin, black curly hair, dark eyes, Afro-Brazilian features, athletic build',
    'tan skin, dark wavy hair, brown eyes, mixed heritage features, athletic build',
    'light olive skin, brown hair, green eyes, European-Brazilian features, athletic build',
  ],
  Chile: [
    'light tan skin, dark brown hair, brown eyes, Chilean features, athletic build',
  ],
  Ecuadorian: [
    'tan skin, black hair, dark brown eyes, indigenous Ecuadorian features, athletic build',
  ],
  Mexican: [
    'brown skin, black hair, dark brown eyes, mestizo features, athletic build',
    'tan skin, dark brown hair, brown eyes, Latin American features, athletic build',
  ],
  Panamanian: [
    'medium brown skin, black hair, dark eyes, Central American features, athletic build',
  ],
  Venezuelan: [
    'tan skin, dark brown hair, brown eyes, Venezuelan features, athletic build',
  ],

  // European - Nordic
  Danish: [
    'fair skin, blonde hair, blue eyes, Scandinavian features, athletic build',
    'light skin, light brown hair, grey eyes, Nordic jawline, athletic build',
  ],
  Swedish: [
    'fair skin, blonde hair, blue eyes, sharp Nordic features, athletic build',
    'pale skin, light blonde hair, light blue eyes, Scandinavian bone structure, athletic build',
  ],

  // European - Germanic
  German: [
    'fair skin, blonde hair, blue eyes, Germanic features, strong jaw, athletic build',
    'light skin, light brown hair, green eyes, angular features, athletic build',
    'fair skin, dark blonde hair, grey eyes, square jaw, athletic build',
  ],
  Belgium: [
    'fair skin, brown hair, blue eyes, Western European features, athletic build',
  ],
  Dutch: [
    'fair skin, blonde hair, blue eyes, tall Dutch features, athletic build',
  ],

  // European - British Isles
  British: [
    'fair skin, brown hair, blue eyes, British features, athletic build',
    'pale skin, dark brown hair, green eyes, angular British face, athletic build',
  ],
  Irish: [
    'fair skin, red hair, green eyes, Celtic features, freckles, athletic build',
    'pale skin, dark hair, blue eyes, Irish features, athletic build',
  ],
  Scottish: [
    'fair skin, auburn hair, blue eyes, Scottish features, rugged look, athletic build',
  ],

  // European - Romance
  Italian: [
    'olive skin, dark brown hair, brown eyes, Mediterranean features, athletic build',
    'tan skin, black hair, dark brown eyes, Roman nose, strong features, athletic build',
    'light olive skin, dark wavy hair, hazel eyes, classic Italian features, athletic build',
  ],
  Spanish: [
    'olive skin, dark brown hair, brown eyes, Iberian features, athletic build',
    'tan skin, black hair, dark eyes, Mediterranean features, athletic build',
  ],
  French: [
    'light skin, brown hair, blue eyes, Gallic features, athletic build',
    'fair skin, dark hair, brown eyes, French features, athletic build',
  ],

  // European - Slavic
  Russian: [
    'fair skin, dark blonde hair, blue eyes, Slavic features, broad face, athletic build',
    'light skin, brown hair, grey eyes, Eastern European features, athletic build',
  ],
  Ukrainian: [
    'fair skin, blonde hair, blue eyes, Ukrainian features, athletic build',
  ],
  Polish: [
    'fair skin, light brown hair, blue eyes, Polish features, athletic build',
  ],
  Czech: [
    'fair skin, brown hair, blue eyes, Czech features, athletic build',
  ],

  // European - Other
  Croatia: [
    'light tan skin, dark brown hair, brown eyes, Balkan features, athletic build',
  ],
  Croatian: [
    'light tan skin, dark brown hair, brown eyes, Balkan features, athletic build',
  ],
  Greek: [
    'olive skin, dark hair, brown eyes, Greek features, athletic build',
  ],
  Romanian: [
    'light tan skin, dark brown hair, brown eyes, Romanian features, athletic build',
  ],
  Turkish: [
    'olive skin, black hair, dark brown eyes, Turkish features, athletic build',
  ],
  Georgian: [
    'olive skin, black hair, dark eyes, Caucasian features, prominent brow, athletic build',
  ],

  // Asian
  China: [
    'light skin, black hair, dark brown eyes, East Asian features, athletic build',
  ],
  Japanese: [
    'light skin, black hair, dark brown eyes, Japanese features, athletic build',
  ],
  Iranian: [
    'olive skin, black hair, dark brown eyes, Persian features, strong nose, athletic build',
  ],

  // Middle Eastern
  Emirati: [
    'tan skin, black hair, dark brown eyes, Arab features, well-groomed beard, athletic build',
    'olive skin, dark brown hair, brown eyes, Middle Eastern features, short beard, athletic build',
  ],

  // African
  Kenyan: [
    'dark brown skin, short black hair, dark brown eyes, East African features, athletic build',
  ],
  Nigerian: [
    'dark skin, short black hair, dark eyes, West African features, athletic build',
  ],

  // American
  American: [
    'fair skin, brown hair, blue eyes, Caucasian American features, athletic build',
    'light tan skin, dark brown hair, brown eyes, American features, athletic build',
    'olive skin, black hair, brown eyes, Italian-American features, athletic build',
    'medium brown skin, black hair, dark eyes, African-American features, athletic build',
  ],
};

// Facial hair options
const facialHairOptions = [
  'light stubble',
  'short well-groomed beard',
  'goatee',
  'clean-shaven',
  'thin mustache',
];

// Age descriptors
const getAgeDescriptor = (age) => {
  if (age < 25) return 'youthful face, smooth skin';
  if (age < 30) return 'mature features';
  if (age < 35) return 'early 30s appearance, slight facial definition';
  if (age < 40) return 'weathered features, some wrinkles';
  return 'mature face, visible wrinkles, distinguished look';
};

// Generate consistent random seed from name
const generateSeed = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Get random facial hair (Middle Eastern more likely to have beards)
const getFacialHair = (nationality, seed) => {
  if (['Emirati', 'Iranian', 'Turkish'].includes(nationality)) {
    const options = ['short well-groomed beard', 'light stubble', 'goatee'];
    return options[seed % options.length];
  }
  return facialHairOptions[seed % facialHairOptions.length];
};

// Transform driver data
const transformDriverData = (driverName, oldData) => {
  const { nationality, age } = oldData;
  const seed = generateSeed(driverName);

  // Get nationality-specific features
  const nationalityFeatures = featuresByNationality[nationality] || featuresByNationality.American;
  const baseFeatures = nationalityFeatures[seed % nationalityFeatures.length];

  // Get age features
  const ageFeatures = getAgeDescriptor(age);

  // Get facial hair
  const facialHair = getFacialHair(nationality, Math.floor(seed / 2));

  // Combine all features
  const features = `${baseFeatures}, ${ageFeatures}, ${facialHair}`;

  return {
    nationality,
    age,
    features
  };
};

// Main function
const main = () => {
  const inputFile = path.join(__dirname, 'assetto_corsa_drivers_prompts.json');
  const outputFile = path.join(__dirname, 'assetto_corsa_drivers_prompts.json');

  console.log('🔄 Simplifying driver data structure...\n');

  // Load existing data
  const oldData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const driverNames = Object.keys(oldData);

  console.log(`📋 Processing ${driverNames.length} drivers\n`);

  // Transform each driver
  const newData = {};
  driverNames.forEach((name, index) => {
    const transformed = transformDriverData(name, oldData[name]);
    newData[name] = transformed;

    if ((index + 1) % 20 === 0) {
      console.log(`✓ Processed ${index + 1}/${driverNames.length} drivers...`);
    }
  });

  console.log(`✓ Processed ${driverNames.length}/${driverNames.length} drivers\n`);

  // Save new data
  fs.writeFileSync(outputFile, JSON.stringify(newData, null, 2));

  console.log('✅ Driver data simplified!\n');
  console.log('New structure:');
  console.log('  {');
  console.log('    "nationality": "...",');
  console.log('    "age": XX,');
  console.log('    "features": "physical description..."');
  console.log('  }\n');

  // Show examples
  console.log('📋 Examples:\n');
  const exampleDrivers = ['Mario Ravioli', 'Hugo Fast', 'Lars Overdriven', 'Kevin Pirongo'];
  exampleDrivers.forEach(name => {
    if (newData[name]) {
      console.log(`${name} (${newData[name].nationality}, ${newData[name].age}):`);
      console.log(`  ${newData[name].features}\n`);
    }
  });

  console.log(`💾 Saved to: ${outputFile}\n`);
};

if (require.main === module) {
  main();
}

module.exports = { transformDriverData, generateSeed };
