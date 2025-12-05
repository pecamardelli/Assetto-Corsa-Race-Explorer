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

## Collecting Race Data

### Assetto Corsa Python App

The `scripts/racestats.py` file is a custom Assetto Corsa app that automatically collects race data during gameplay.

**Installation:**
1. Copy `racestats.py` to: `Documents\Assetto Corsa\apps\python\racestats\racestats.py`
2. Enable in Assetto Corsa: Settings > General > UI Modules > Check "Race Statistics"

**Usage:**
1. Run Assetto Corsa and start a race session
2. App runs in background tracking all driver statistics
3. On session end, JSON file auto-saves to: `Documents\Assetto Corsa\out\race_statistics\`

The app tracks: lap times, overtakes, crashes (with G-force detection), distance covered, speeds, and calculates performance scores.

## Adding Race Data

Race data files collected by the Assetto Corsa app should be placed in the `app/data` directory.

### Quick Race Results

Place race result JSON files in the `app/data/quick_race/` directory.

**File naming convention**: `stats_[track]_[timestamp].json`

**Example**: `stats_ks_brands_hatch-indy_20251111_023723.json`

### Championship Data

Championships are organized by name and season:

**Directory structure**: `app/data/championship/[Championship Name]/`

Each championship can have multiple seasons:

1. **Season definition file**: `app/data/championship/[Championship Name]/season_[XX].champ`
   - This is the `.champ` file from Assetto Corsa
   - Found in: `Documents\Assetto Corsa\champ\[uuid].champ` (Assetto Corsa names these with a UUID)
   - Copy and rename it to match your season number (e.g., `season_01.champ`, `season_02.champ`)
   - Contains season metadata (name, rules, opponents, rounds) in JSON format

2. **Race result files**: `app/data/championship/[Championship Name]/season_[XX]/[race-file].json`
   - Place race results in a folder matching the season
   - Same format as quick race results
   - Example: `app/data/championship/Campeonato Argentino/season_01/stats_ks_barcelona-layout_gp_session_race_20251204_230027.json`

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
│   ├── data/                           # Race data files
│   │   ├── quick_race/                 # Quick race sessions
│   │   ├── championship/               # Championship data
│   │   │   └── [Championship Name]/    # Individual championships
│   │   │       ├── season_01.champ     # Season definition
│   │   │       ├── season_01/          # Season 1 race results
│   │   │       ├── season_02.champ     # Season 2 definition
│   │   │       └── season_02/          # Season 2 race results
│   │   ├── cars/                       # Car metadata JSON files
│   │   └── tracks/                     # Track metadata JSON files
│   ├── lib/                            # Utility functions
│   ├── components/                     # React components
│   ├── race/                           # Race detail pages
│   ├── championship/                   # Championship pages
│   └── drivers/                        # All-time standings
├── public/
│   ├── badges/                         # Car badge images
│   └── flags/                          # Regional flag SVGs
└── scripts/                            # Utility scripts
```
