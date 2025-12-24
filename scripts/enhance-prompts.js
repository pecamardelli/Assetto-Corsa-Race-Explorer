const fs = require('fs');
const path = require('path');

// Physical feature variations by ethnicity/region
const ethnicityFeatures = {
  // Latin American
  Argentina: [
    { skin: 'light tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'European-Latin features' },
    { skin: 'olive skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'strong jawline' },
    { skin: 'medium tan skin', hair: 'wavy dark hair', eyes: 'hazel eyes', features: 'Mediterranean features' },
  ],
  Bolivia: [
    { skin: 'tan skin', hair: 'straight black hair', eyes: 'dark brown eyes', features: 'indigenous features, prominent cheekbones' },
    { skin: 'medium brown skin', hair: 'dark brown hair', eyes: 'deep brown eyes', features: 'Andean features' },
  ],
  Brazil: [
    { skin: 'medium brown skin', hair: 'black curly hair', eyes: 'dark eyes', features: 'Afro-Brazilian features' },
    { skin: 'tan skin', hair: 'dark wavy hair', eyes: 'brown eyes', features: 'mixed heritage features' },
    { skin: 'light olive skin', hair: 'brown hair', eyes: 'green eyes', features: 'European-Brazilian features' },
  ],
  Chile: [
    { skin: 'light tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Chilean features' },
  ],
  Ecuadorian: [
    { skin: 'tan skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'indigenous Ecuadorian features' },
  ],
  Mexican: [
    { skin: 'brown skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'mestizo features' },
    { skin: 'tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Latin American features' },
  ],
  Panamanian: [
    { skin: 'medium brown skin', hair: 'black hair', eyes: 'dark eyes', features: 'Central American features' },
  ],
  Venezuelan: [
    { skin: 'tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Venezuelan features' },
  ],

  // European - Nordic
  Danish: [
    { skin: 'fair skin', hair: 'blonde hair', eyes: 'blue eyes', features: 'Scandinavian features' },
    { skin: 'light skin', hair: 'light brown hair', eyes: 'grey eyes', features: 'Nordic jawline' },
  ],
  Swedish: [
    { skin: 'fair skin', hair: 'blonde hair', eyes: 'blue eyes', features: 'sharp Nordic features' },
    { skin: 'pale skin', hair: 'light blonde hair', eyes: 'light blue eyes', features: 'Scandinavian bone structure' },
  ],

  // European - Germanic
  German: [
    { skin: 'fair skin', hair: 'blonde hair', eyes: 'blue eyes', features: 'Germanic features, strong jaw' },
    { skin: 'light skin', hair: 'light brown hair', eyes: 'green eyes', features: 'angular features' },
    { skin: 'fair skin', hair: 'dark blonde hair', eyes: 'grey eyes', features: 'square jaw' },
  ],
  Belgian: [
    { skin: 'fair skin', hair: 'brown hair', eyes: 'blue eyes', features: 'Western European features' },
  ],
  Dutch: [
    { skin: 'fair skin', hair: 'blonde hair', eyes: 'blue eyes', features: 'tall Dutch features' },
  ],

  // European - British Isles
  British: [
    { skin: 'fair skin', hair: 'brown hair', eyes: 'blue eyes', features: 'British features' },
    { skin: 'pale skin', hair: 'dark brown hair', eyes: 'green eyes', features: 'angular British face' },
  ],
  Irish: [
    { skin: 'fair skin', hair: 'red hair', eyes: 'green eyes', features: 'Celtic features, freckles' },
    { skin: 'pale skin', hair: 'dark hair', eyes: 'blue eyes', features: 'Irish features' },
  ],
  Scottish: [
    { skin: 'fair skin', hair: 'auburn hair', eyes: 'blue eyes', features: 'Scottish features, rugged look' },
  ],

  // European - Romance
  Italian: [
    { skin: 'olive skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Mediterranean features' },
    { skin: 'tan skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'Roman nose, strong features' },
    { skin: 'light olive skin', hair: 'dark wavy hair', eyes: 'hazel eyes', features: 'classic Italian features' },
  ],
  Spanish: [
    { skin: 'olive skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Iberian features' },
    { skin: 'tan skin', hair: 'black hair', eyes: 'dark eyes', features: 'Mediterranean features' },
  ],
  French: [
    { skin: 'light skin', hair: 'brown hair', eyes: 'blue eyes', features: 'Gallic features' },
    { skin: 'fair skin', hair: 'dark hair', eyes: 'brown eyes', features: 'French features' },
  ],

  // European - Slavic
  Russian: [
    { skin: 'fair skin', hair: 'dark blonde hair', eyes: 'blue eyes', features: 'Slavic features, broad face' },
    { skin: 'light skin', hair: 'brown hair', eyes: 'grey eyes', features: 'Eastern European features' },
  ],
  Ukrainian: [
    { skin: 'fair skin', hair: 'blonde hair', eyes: 'blue eyes', features: 'Ukrainian features' },
  ],
  Polish: [
    { skin: 'fair skin', hair: 'light brown hair', eyes: 'blue eyes', features: 'Polish features' },
  ],
  Czech: [
    { skin: 'fair skin', hair: 'brown hair', eyes: 'blue eyes', features: 'Czech features' },
  ],

  // European - Other
  Croatian: [
    { skin: 'light tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Balkan features' },
  ],
  Greece: [
    { skin: 'olive skin', hair: 'dark hair', eyes: 'brown eyes', features: 'Greek features' },
  ],
  Romanian: [
    { skin: 'light tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Romanian features' },
  ],
  Turkish: [
    { skin: 'olive skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'Turkish features' },
  ],

  // European - Other regions
  Georgian: [
    { skin: 'olive skin', hair: 'black hair', eyes: 'dark eyes', features: 'Caucasian features, prominent brow' },
  ],

  // Asian
  Chinese: [
    { skin: 'light skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'East Asian features' },
  ],
  Japanese: [
    { skin: 'light skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'Japanese features' },
  ],
  Iranian: [
    { skin: 'olive skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'Persian features, strong nose' },
  ],

  // Middle Eastern
  Emirati: [
    { skin: 'tan skin', hair: 'black hair', eyes: 'dark brown eyes', features: 'Arab features, well-groomed beard' },
    { skin: 'olive skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'Middle Eastern features, short beard' },
  ],

  // African
  Kenyan: [
    { skin: 'dark brown skin', hair: 'short black hair', eyes: 'dark brown eyes', features: 'East African features' },
  ],
  Nigerian: [
    { skin: 'dark skin', hair: 'short black hair', eyes: 'dark eyes', features: 'West African features' },
  ],

  // American
  American: [
    { skin: 'fair skin', hair: 'brown hair', eyes: 'blue eyes', features: 'Caucasian American features' },
    { skin: 'light tan skin', hair: 'dark brown hair', eyes: 'brown eyes', features: 'American features' },
    { skin: 'olive skin', hair: 'black hair', eyes: 'brown eyes', features: 'Italian-American features' },
    { skin: 'medium brown skin', hair: 'black hair', eyes: 'dark eyes', features: 'African-American features' },
  ],
};

// Age-related features
const getAgeFeatures = (age) => {
  if (age < 25) {
    return 'youthful face, smooth skin';
  } else if (age < 30) {
    return 'mature features';
  } else if (age < 35) {
    return 'early 30s appearance, slight facial definition';
  } else if (age < 40) {
    return 'weathered features, some wrinkles';
  } else {
    return 'mature face, visible wrinkles, distinguished look';
  }
};

// Random facial hair options by ethnicity
const getFacialHair = (nationality, randomSeed) => {
  const options = {
    stubble: 'light stubble',
    beard: 'short well-groomed beard',
    goatee: 'goatee',
    clean: 'clean-shaven',
    mustache: 'thin mustache',
  };

  // Middle Eastern drivers more likely to have beards
  if (['Emirati', 'Iranian', 'Turkish'].includes(nationality)) {
    const choices = ['beard', 'stubble', 'goatee'];
    return options[choices[randomSeed % choices.length]];
  }

  // Everyone else random
  const allChoices = Object.keys(options);
  return options[allChoices[randomSeed % allChoices.length]];
};

// Generate unique seed from name
const generateSeed = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Enhance a single driver's prompt
const enhanceDriverPrompt = (driverName, driverData) => {
  const { nationality, age } = driverData;
  const seed = generateSeed(driverName);

  // Get ethnicity-specific features
  const ethnicFeatures = ethnicityFeatures[nationality] || ethnicityFeatures.American;
  const selectedFeatures = ethnicFeatures[seed % ethnicFeatures.length];

  // Get age features
  const ageFeatures = getAgeFeatures(age);

  // Get facial hair
  const facialHair = getFacialHair(nationality, seed);

  // Build enhanced positive prompt
  const positivePrompt = `realistic professional studio portrait photograph, ${nationality} racing driver, ${age} years old, male, ${selectedFeatures.skin}, ${selectedFeatures.hair}, ${selectedFeatures.eyes}, ${selectedFeatures.features}, ${ageFeatures}, ${facialHair}, athletic build, medium close-up portrait, head and shoulders visible, neutral confident expression, looking at camera, natural skin texture with pores and details, professional studio lighting, plain grey background, sharp focus on face, photorealistic, high detail, professional headshot`;

  const negativePrompt = 'smile, grin, showing teeth, exaggerated expression, happy, laughing, fashion model pose, heavy makeup, racing helmet, hat, cap, sunglasses, goggles, glasses, extreme close-up, cropped face, out of frame, plastic skin, smooth skin, CGI, 3D render, illustration, drawing, painting, cartoon, anime, celebrity lookalike, famous person, multiple people, text, watermark, low quality, blurry';

  return {
    ...driverData,
    positive_prompt: positivePrompt,
    negative_prompt: negativePrompt,
  };
};

// Main function
const main = () => {
  const promptsFile = path.join(__dirname, 'assetto_corsa_drivers_prompts.json');
  const outputFile = path.join(__dirname, 'assetto_corsa_drivers_prompts.json');

  console.log('🎨 Enhancing Driver Prompts with Ethnicity & Age Features\n');

  // Load existing prompts
  const prompts = JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
  const driverNames = Object.keys(prompts);

  console.log(`📋 Found ${driverNames.length} drivers to enhance\n`);

  // Enhance each driver
  const enhancedPrompts = {};
  driverNames.forEach((name, index) => {
    const enhanced = enhanceDriverPrompt(name, prompts[name]);
    enhancedPrompts[name] = enhanced;

    console.log(`✓ [${index + 1}/${driverNames.length}] ${name} (${enhanced.nationality}, ${enhanced.age})`);
  });

  // Save enhanced prompts
  fs.writeFileSync(outputFile, JSON.stringify(enhancedPrompts, null, 2));

  console.log(`\n✅ Enhanced prompts saved to: ${outputFile}`);
  console.log('\n🎯 Features added:');
  console.log('   - Ethnicity-specific skin tones, hair, and eyes');
  console.log('   - Age-appropriate facial features');
  console.log('   - Randomized facial hair (consistent per driver)');
  console.log('   - Enhanced lighting and detail keywords');
  console.log('   - Nordic drivers: blonde hair, fair skin, blue/grey eyes');
  console.log('   - Latin American: tan/brown skin, dark hair');
  console.log('   - Southern European: olive skin, Mediterranean features');
  console.log('   - And more variations...\n');
};

if (require.main === module) {
  main();
}

module.exports = { enhanceDriverPrompt, generateSeed };
