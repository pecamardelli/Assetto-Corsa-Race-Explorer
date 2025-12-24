const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'app', 'lib', 'driver-profiles');

console.log('Adding isFictional flag to all driver profiles...\n');

// Read all profile files
const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));

let updated = 0;
let skipped = 0;

files.forEach(file => {
  const filePath = path.join(PROFILES_DIR, file);
  const profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Check if already has the property
  if (profile.hasOwnProperty('isFictional')) {
    console.log(`⏭️  Skipped: ${profile.name} (already has isFictional flag)`);
    skipped++;
    return;
  }

  // Add the property
  profile.isFictional = true;

  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
  console.log(`✓ Updated: ${profile.name} → isFictional: true`);
  updated++;
});

console.log(`\n📊 Summary:`);
console.log(`   Updated: ${updated}`);
console.log(`   Skipped: ${skipped}`);
console.log(`   Total: ${files.length}`);
