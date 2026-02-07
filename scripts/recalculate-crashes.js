const fs = require('fs');
const path = require('path');

const MIN_CRASH_G = 50;

function findSessionFiles(dir) {
  const files = [];

  function walkDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.startsWith('stats_') && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return files;
}

function recalculateCrashes(crashes) {
  if (!crashes || !crashes.crash_intensities_g) {
    return crashes;
  }

  // Filter crashes to only keep those >= MIN_CRASH_G
  const filteredCrashes = crashes.crash_intensities_g.filter(g => g >= MIN_CRASH_G);

  // Recalculate stats
  const totalCrashes = filteredCrashes.length;
  const totalCrashIntensity = filteredCrashes.reduce((sum, g) => sum + g, 0);
  const worstCrashG = totalCrashes > 0 ? Math.max(...filteredCrashes) : 0;
  const averageCrashG = totalCrashes > 0 ? Math.round((totalCrashIntensity / totalCrashes) * 100) / 100 : 0;

  return {
    total_crash_intensity: Math.round(totalCrashIntensity * 100) / 100,
    worst_crash_g: worstCrashG,
    total_crashes: totalCrashes,
    average_crash_g: averageCrashG,
    crash_intensities_g: filteredCrashes
  };
}

function processSessionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  let modified = false;
  let crashesRemoved = 0;
  let crashesKept = 0;

  if (data.driver_statistics) {
    for (const [driverName, stats] of Object.entries(data.driver_statistics)) {
      if (stats.crashes && stats.crashes.crash_intensities_g) {
        const originalCount = stats.crashes.crash_intensities_g.length;
        const newCrashes = recalculateCrashes(stats.crashes);
        const newCount = newCrashes.crash_intensities_g.length;

        if (originalCount !== newCount) {
          modified = true;
          crashesRemoved += originalCount - newCount;
        }
        crashesKept += newCount;

        stats.crashes = newCrashes;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return { modified, crashesRemoved, crashesKept };
}

function main() {
  const dataDir = path.join(__dirname, '..', 'app', 'data', 'championship');

  console.log(`Scanning for session files in: ${dataDir}`);
  console.log(`Filtering crashes below ${MIN_CRASH_G}G\n`);

  const sessionFiles = findSessionFiles(dataDir);
  console.log(`Found ${sessionFiles.length} session files\n`);

  let totalFilesModified = 0;
  let totalCrashesRemoved = 0;
  let totalCrashesKept = 0;

  for (const filePath of sessionFiles) {
    const { modified, crashesRemoved, crashesKept } = processSessionFile(filePath);

    if (modified) {
      totalFilesModified++;
      const relativePath = path.relative(dataDir, filePath);
      console.log(`Modified: ${relativePath} (removed ${crashesRemoved} low-G crashes)`);
    }

    totalCrashesRemoved += crashesRemoved;
    totalCrashesKept += crashesKept;
  }

  console.log('\n--- Summary ---');
  console.log(`Files processed: ${sessionFiles.length}`);
  console.log(`Files modified: ${totalFilesModified}`);
  console.log(`Crashes removed (< ${MIN_CRASH_G}G): ${totalCrashesRemoved}`);
  console.log(`Crashes kept (>= ${MIN_CRASH_G}G): ${totalCrashesKept}`);
}

main();
