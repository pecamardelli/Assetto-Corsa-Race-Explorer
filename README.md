# Race Explorer

A Next.js application for viewing and analyzing Assetto Corsa race results and statistics.

## Features

- **Quick Race Results**: View individual race sessions with detailed driver statistics
- **Championship Management**: Track multi-race championships with standings
- **All-Time Driver Standings**: Career statistics across all races including wins, podiums, crashes, and fastest laps
- **Detailed Statistics**: Lap times, overtakes, crashes with G-force data, and custom scoring

## Getting Started

### Installation

```bash
npm install
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Adding Race Data

Race data files should be placed in the `app/data` directory in JSON format.

### Quick Race Results

Place race result JSON files in the `app/data/quick_race/` directory.

**File naming convention**: `stats_[track]_[timestamp].json`

**Example**: `stats_ks_brands_hatch-indy_20251111_023723.json`

### Championship Data

Championships consist of two parts:

1. **Championship definition file**: `app/data/championship/[uuid].champ`
   - Contains championship metadata (name, rules, opponents, rounds)
   - JSON format

2. **Race result files**: `app/data/championship/[uuid]/[race-file].json`
   - Place race results in a folder matching the championship UUID
   - Same format as quick race results

### Race Result File Format

```json
{
  "session_info": {
    "track": "ks_brands_hatch",
    "track_config": "indy",
    "track_length_km": 1.916,
    "race_laps": 2,
    "date": "2025-11-11 02:37:23",
    "session_duration_seconds": 279.23,
    "crash_penalty_config": {
      "penalty_percent_per_g": 0.01,
      "max_penalty_per_crash_g": 100.0
    }
  },
  "driver_statistics": {
    "Driver Name": {
      "position": 1,
      "car_name": "exmods_av_voisin_c25_aero",
      "total_score": 87558,
      "laps_completed": 2,
      "best_lap": 75.726,
      "average_lap": 79.092,
      "total_time_formatted": "02:38.183",
      "total_time_seconds": 158.184,
      "overtakes_made": 1,
      "times_overtaken": 3,
      "net_positions_gained": -2,
      "crashes": {
        "total_crashes": 0,
        "crash_intensities_g": [],
        "worst_crash_g": 0.0,
        "average_crash_g": 0.0
      }
    }
  }
}
```

### Championship File Format

```json
{
  "name": "Championship Name",
  "rules": {
    "practice": 10,
    "qualifying": 15,
    "points": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    "penalties": true,
    "jumpstart": 10
  },
  "opponents": [
    {
      "name": "Driver Name",
      "nation": "US",
      "car": "car_model_name",
      "skin": "skin_name",
      "ballast": 0,
      "restrictor": 0
    }
  ],
  "rounds": [
    {
      "track": "ks_brands_hatch",
      "laps": 10,
      "weather": 0,
      "surface": 0
    }
  ],
  "maxCars": 24,
  "changedByCm": false
}
```

## Modifying Score Values

If you need to multiply all scores in existing data files by a factor (e.g., 100):

```bash
node scripts/multiply-scores.js
```

This script will recursively process all JSON files in the `app/data` directory and multiply each driver's `total_score` by 100.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (recommended)

## Project Structure

```
race-explorer/
├── app/
│   ├── data/               # Race data files
│   │   ├── quick_race/     # Quick race sessions
│   │   └── championship/   # Championship data
│   ├── lib/                # Utility functions
│   ├── components/         # React components
│   ├── race/               # Race detail pages
│   ├── championship/       # Championship pages
│   └── drivers/            # All-time standings
└── scripts/                # Utility scripts
```
