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

1. Copy `racestats.py` to: `[Assetto Corsa]\apps\python\racestats\racestats.py`
2. Enable in Assetto Corsa: Settings > General > UI Modules > Check "Race Statistics"

**Usage:**

1. Run Assetto Corsa and start a race session
2. App runs in background tracking all driver statistics
3. On session end, JSON file auto-saves to: `Documents\Assetto Corsa\out\race_statistics\`

The app tracks: lap times, overtakes, crashes (with G-force detection), distance covered, speeds, and calculates performance scores.

For a session Race Explorer launched, the app reads
`Documents\Assetto Corsa\out\race_explorer_launch.json` and labels each save from it:

- `session_info.session_type` — `practice`, `qualifying` or `race`, taken from the
  launch's session order
- `session_info.finished` — whether the session reached its natural end. A race
  counts once the leader completes the round's lap count; a qualifying once its
  clock runs out. Close the game before either and the file records `false`.
- `driver_statistics[*].retired` — set on any driver in a race whose total time is
  under the winner's, since they stopped before the end. Being lapped does not
  trigger it: AC lets a car finish the lap it is on when the leader takes the flag,
  so anyone still running banks that last lap after the winner and ends up above
  the winner's total. Practice and qualifying never mark anyone retired.

To apply that rule to races recorded earlier, run
`node scripts/update-retired-flags.js` for a dry run, then add `--write`. Pass a
path fragment (e.g. `"Le Mans"`) to limit it to one championship.

Both come from the launch handshake rather than from AC itself: AC's live session
state lives in shared memory, which needs `ctypes`, and AC's embedded Python 3.3 has
no `_ctypes` module. A session started outside Race Explorer therefore has no targets
to check and is never claimed as finished.

## Launching Sessions

Each round on a season page carries its actions in one menu. They write
`Documents\Assetto Corsa\cfg\race.ini` from the championship's own specs and start
`acs.exe` directly — Content Manager is not involved.

| Entry | Sessions |
| --- | --- |
| **Start Race** | A full weekend: qualifying for the `rules.qualifying` minutes in the `.champ`, then the race over the round's lap count. AC builds the race grid from its own qualifying result. |
| **Race Only** | The race alone, over the round's lap count. Offered when the round has a qualifying filed and no race yet. |
| **Free Run** | Untimed solo practice at the round's track — no AI. |
| **Race Again** | Replaces **Start Race** once the round has been raced: the same weekend, with nothing recorded. |

**Race Only** rebuilds the grid from the qualifying already in the season folder,
since AC has no live qualifying result to line the field up from. The AI take
`CAR_1` upwards in the order they qualified and the player is placed among them with
`[SESSION_0] STARTING_POSITION`, which is how Content Manager grids a quick race —
AC always reads `CAR_0` as the player, whatever position they start from. A driver
the qualifying never classified, added to the roster since it ran, lines up at the
back in roster order. Where a round has been qualified more than once, the last one
sets the grid.

Track grip, weather, lap count, penalties and jump-start rules all come from the
`.champ` round. AI drivers race at level 100 with aggression randomised between 80
and 100; give a driver profile a `skill` number to change their level.

**When the game closes**, the result files the racestats app wrote during the launch
are renamed to the season's convention and moved into
`app/data/championship/[name]/season_[XX]/`, so the round fills itself in. A weekend
run to its end therefore files two sessions.

Only sessions that ended on their own are taken. Close the game part-way through and
that session is left in `Documents\Assetto Corsa\out\race_statistics\` instead of
joining the season — the file is kept rather than deleted, in case you want it. Quit
during the race of a weekend and the qualifying that already finished is still filed.

Because a race is judged finished on the leader's lap count, retiring your own car
does not make the session partial: the race still ran, and it is still recorded.

A session carrying `finished: false` that reaches a season folder anyway — one added
by hand, or filed before this rule existed — shows an **Unfinished** badge beside it
on the season page, and leaves that round's **Start Race** entry in place.

Only one session can run at a time, and the route refuses requests that did not come
from this machine. The `race.ini` that was in place beforehand is kept as
`race.ini.bak` — one rolling copy, overwritten each launch.

**Environment overrides** (all optional):

| Variable | Default |
| --- | --- |
| `AC_ROOT` | `C:\GAMES\Assetto Corsa` |
| `AC_DOCUMENTS` | `%USERPROFILE%\Documents\Assetto Corsa` |
| `AC_PLAYER_NAME` | the `name` in `app/lib/driver-profiles/player.json` |

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
- **Deployment**: Run locally or deploy to Vercel if you want

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
