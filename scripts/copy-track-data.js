const fs = require('fs');
const path = require('path');

// Path to Assetto Corsa installation
const AC_PATH = 'C:\\GAMES\\Assetto Corsa';
const tracksSourceDir = path.join(AC_PATH, 'content', 'tracks');
const tracksDestDir = path.join(__dirname, '..', 'app', 'data', 'tracks');
const trackPreviewsDir = path.join(__dirname, '..', 'public', 'track-previews');

// Get championship files to find which tracks are used
const championshipBaseDir = path.join(__dirname, '..', 'app', 'data', 'championship');

// Create destination directories if they don't exist
if (!fs.existsSync(tracksDestDir)) {
  fs.mkdirSync(tracksDestDir, { recursive: true });
  console.log(`Created directory: ${tracksDestDir}`);
}

if (!fs.existsSync(trackPreviewsDir)) {
  fs.mkdirSync(trackPreviewsDir, { recursive: true });
  console.log(`Created directory: ${trackPreviewsDir}`);
}

// Collect unique track names from championship files
// Track identifier includes both track name and config (e.g., "ks_monza66-wsc")
const trackConfigs = new Set();

// First, scan .champ files for all rounds (including unraced tracks)
// New structure: championship/{championship-name}/season_*.champ
const champDirEntries = fs.readdirSync(championshipBaseDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory());

let champFiles = [];
champDirEntries.forEach(dirent => {
  const champDir = path.join(championshipBaseDir, dirent.name);
  const seasonFiles = fs.readdirSync(champDir)
    .filter(file => file.endsWith('.champ'))
    .map(file => path.join(champDir, file));
  champFiles = champFiles.concat(seasonFiles);
});

console.log(`Scanning ${champFiles.length} .champ files for tracks...`);

champFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''); // Remove BOM
  const data = JSON.parse(content);

  if (data.rounds && Array.isArray(data.rounds)) {
    data.rounds.forEach(round => {
      const trackName = round.track;
      // Split track identifier to separate name and config
      // e.g., "rj_lemans_1967-54" -> trackName: "rj_lemans_1967", config: "54"
      const parts = trackName.split('-');
      const trackConfig = parts.length > 1 ? parts[parts.length - 1] : undefined;
      const baseTrackName = parts.length > 1 ? parts.slice(0, -1).join('-') : trackName;

      const identifier = trackName; // Use the full identifier as-is
      trackConfigs.add(JSON.stringify({ trackName: baseTrackName, trackConfig, identifier }));
    });
  }
});

// Also scan result JSON files for any additional tracks
// New structure: championship/{championship-name}/season_{season}/stats_*.json
champDirEntries.forEach(dirent => {
  const champDir = path.join(championshipBaseDir, dirent.name);

  // Look for season subdirectories
  const seasonDirs = fs.readdirSync(champDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('season_'))
    .map(d => d.name);

  seasonDirs.forEach(seasonDir => {
    const seasonPath = path.join(champDir, seasonDir);
    const files = fs.readdirSync(seasonPath)
      .filter(file => file.endsWith('.json'));

    files.forEach(file => {
      const filePath = path.join(seasonPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (data.session_info) {
        const trackName = data.session_info.track;
        const trackConfig = data.session_info.track_config;

        if (trackName) {
          // Create identifier: trackName-config or just trackName if no config
          const identifier = trackConfig ? `${trackName}-${trackConfig}` : trackName;
          trackConfigs.add(JSON.stringify({ trackName, trackConfig, identifier }));
        }
      }
    });
  });
});

// Parse the unique track configs
const tracks = Array.from(trackConfigs).map(item => JSON.parse(item));

console.log(`\nFound ${tracks.length} unique track configurations`);
console.log('\nCopying track data and previews...');

let trackDataCopied = 0;
let trackDataSkipped = 0;
let trackDataNotFound = 0;
let previewsCopied = 0;
let previewsSkipped = 0;
let previewsNotFound = 0;

tracks.forEach(({ trackName, trackConfig, identifier }) => {
  // Determine source paths
  const trackDir = path.join(tracksSourceDir, trackName);

  // ui_track.json can be in track root or in ui subfolder of config
  let uiTrackJsonPath;
  if (trackConfig) {
    // Try config-specific ui folder first
    uiTrackJsonPath = path.join(trackDir, 'ui', trackConfig, 'ui_track.json');
    if (!fs.existsSync(uiTrackJsonPath)) {
      // Fall back to root ui folder
      uiTrackJsonPath = path.join(trackDir, 'ui', 'ui_track.json');
    }
  } else {
    uiTrackJsonPath = path.join(trackDir, 'ui', 'ui_track.json');
  }

  // preview.png can be in track root or in ui subfolder of config
  let previewPath;
  if (trackConfig) {
    // Try config-specific ui folder first
    previewPath = path.join(trackDir, 'ui', trackConfig, 'preview.png');
    if (!fs.existsSync(previewPath)) {
      // Fall back to root ui folder
      previewPath = path.join(trackDir, 'ui', 'preview.png');
    }
  } else {
    previewPath = path.join(trackDir, 'ui', 'preview.png');
  }

  const trackDataDestPath = path.join(tracksDestDir, `${identifier}.json`);
  const previewDestPath = path.join(trackPreviewsDir, `${identifier}.png`);

  // Copy track data
  if (fs.existsSync(trackDataDestPath)) {
    console.log(`⊘ Track data skipped (already exists): ${identifier}.json`);
    trackDataSkipped++;
  } else if (fs.existsSync(uiTrackJsonPath)) {
    try {
      // Read the ui_track.json file (some tracks ship it with a UTF-8 BOM)
      let rawContent = fs.readFileSync(uiTrackJsonPath, 'utf8').replace(/^\uFEFF/, ''); // Remove BOM

      // Try to parse as-is first
      let trackData;
      let wasSanitized = false;
      try {
        trackData = JSON.parse(rawContent);
      } catch (parseError) {
        // If parsing fails, try to fix common JSON issues
        // Fix unescaped newlines in string values
        rawContent = rawContent.replace(
          /"([^"]+)":\s*"([^"]*(?:\n[^"]*)*?)"/g,
          (match, key, value) => {
            // Escape newlines and other control characters in the value
            const escapedValue = value
              .replace(/\\/g, '\\\\')  // Escape backslashes first
              .replace(/\n/g, '\\n')   // Escape newlines
              .replace(/\r/g, '\\r')   // Escape carriage returns
              .replace(/\t/g, '\\t')   // Escape tabs
              .replace(/"/g, '\\"');   // Escape quotes
            return `"${key}": "${escapedValue}"`;
          }
        );

        // Try parsing again with sanitized content
        trackData = JSON.parse(rawContent);
        wasSanitized = true;
      }

      // Write to destination
      fs.writeFileSync(trackDataDestPath, JSON.stringify(trackData, null, 2), 'utf8');
      if (wasSanitized) {
        console.log(`⚠ Track data sanitized and copied: ${identifier}.json`);
      } else {
        console.log(`✓ Track data copied: ${identifier}.json`);
      }
      trackDataCopied++;
    } catch (error) {
      console.log(`✗ Error copying track data ${identifier}: ${error.message}`);
      trackDataNotFound++;
    }
  } else {
    console.log(`✗ ui_track.json not found: ${identifier}`);
    trackDataNotFound++;
  }

  // Copy preview
  if (fs.existsSync(previewDestPath)) {
    console.log(`⊘ Preview skipped (already exists): ${identifier}.png`);
    previewsSkipped++;
  } else if (fs.existsSync(previewPath)) {
    fs.copyFileSync(previewPath, previewDestPath);
    console.log(`✓ Preview copied: ${identifier}.png`);
    previewsCopied++;
  } else {
    console.log(`✗ Preview not found: ${identifier}`);
    previewsNotFound++;
  }
});

console.log(`\n✅ Done!`);
console.log(`\nTrack Data:`);
console.log(`  Copied: ${trackDataCopied}`);
console.log(`  Skipped: ${trackDataSkipped}`);
console.log(`  Not found/Error: ${trackDataNotFound}`);
console.log(`\nPreviews:`);
console.log(`  Copied: ${previewsCopied}`);
console.log(`  Skipped: ${previewsSkipped}`);
console.log(`  Not found: ${previewsNotFound}`);
console.log(`\nTotal track configurations processed: ${tracks.length}`);
