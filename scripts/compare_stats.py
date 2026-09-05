"""Compare a racestats.py result with the Commendatore stats module's, side by side.

    python compare_stats.py                 # latest pair, by date, from AC's out folder
    python compare_stats.py PY.json LUA.json

While the Lua module writes to out/race_statistics_lua and the Python app to
out/race_statistics, every session produces one file in each. This pairs them (nearest
session dates) and prints, per driver, where the two disagree: laps, lap times beyond
a tolerance, positions, retired flags, crashes, score. Equal files print one line.
"""
import json
import os
import sys
from datetime import datetime

OUT = os.path.join(os.path.expanduser('~'), 'Documents', 'Assetto Corsa', 'out')
LAP_TOLERANCE = 0.5      # seconds: the Lua clock and the Python clock tick on different frames
SPEED_TOLERANCE = 2.0    # km/h


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def latest_pair():
    def files(folder):
        full = os.path.join(OUT, folder)
        if not os.path.isdir(full):
            return []
        return [os.path.join(full, n) for n in os.listdir(full) if n.endswith('.json')]

    py = files('race_statistics')
    lua = files('race_statistics_lua')
    if not py or not lua:
        sys.exit('need one file in each of race_statistics and race_statistics_lua')

    def stamp(path):
        return datetime.strptime(load(path)['session_info']['date'], '%Y-%m-%d %H:%M:%S')

    lua_file = max(lua, key=stamp)
    lua_stamp = stamp(lua_file)
    py_file = min(py, key=lambda p: abs((stamp(p) - lua_stamp).total_seconds()))
    return py_file, lua_file


def compare(py_path, lua_path):
    a, b = load(py_path), load(lua_path)
    print('python:', py_path)
    print('lua:   ', lua_path)
    ia, ib = a['session_info'], b['session_info']
    diffs = []
    for key in ('session_type', 'finished', 'track', 'total_cars', 'race_laps'):
        if ia.get(key) != ib.get(key):
            diffs.append('session_info.%s: py %r  lua %r' % (key, ia.get(key), ib.get(key)))
    if ib.get('traffic_race'):
        print('lua file is in the TRAFFIC shape: positions and retired flags are expected to differ')

    da, db = a['driver_statistics'], b['driver_statistics']
    for name in sorted(set(da) | set(db)):
        if name not in da or name not in db:
            diffs.append('%s: only in %s' % (name, 'python' if name in da else 'lua'))
            continue
        x, y = da[name], db[name]
        if x['laps_completed'] != y['laps_completed']:
            diffs.append('%s laps: py %d  lua %d' % (name, x['laps_completed'], y['laps_completed']))
        for i, (p, q) in enumerate(zip(x['lap_times'], y['lap_times']), start=1):
            if abs(p - q) > LAP_TOLERANCE:
                diffs.append('%s lap %d: py %.3f  lua %.3f' % (name, i, p, q))
        if x['position'] != y['position']:
            diffs.append('%s position: py %s  lua %s' % (name, x['position'], y['position']))
        if x.get('retired') != y.get('retired'):
            diffs.append('%s retired: py %s  lua %s' % (name, x.get('retired'), y.get('retired')))
        if x['crashes']['total_crashes'] != y['crashes']['total_crashes']:
            diffs.append('%s crashes: py %d  lua %d' % (name, x['crashes']['total_crashes'], y['crashes']['total_crashes']))
        if abs(x['max_speed_kmh'] - y['max_speed_kmh']) > SPEED_TOLERANCE:
            diffs.append('%s max speed: py %.1f  lua %.1f' % (name, x['max_speed_kmh'], y['max_speed_kmh']))
        if x['overtakes_made'] != y['overtakes_made'] or x['times_overtaken'] != y['times_overtaken']:
            diffs.append('%s overtakes: py %d/%d  lua %d/%d' % (name, x['overtakes_made'], x['times_overtaken'],
                                                               y['overtakes_made'], y['times_overtaken']))
        if x['total_score'] != y['total_score']:
            diffs.append('%s score: py %d  lua %d' % (name, x['total_score'], y['total_score']))

    if not diffs:
        print('identical within tolerance (%d drivers)' % len(da))
        return 0
    print('%d differences:' % len(diffs))
    for d in diffs:
        print('  ' + d)
    return 1


if __name__ == '__main__':
    if len(sys.argv) == 3:
        sys.exit(compare(sys.argv[1], sys.argv[2]))
    sys.exit(compare(*latest_pair()))
