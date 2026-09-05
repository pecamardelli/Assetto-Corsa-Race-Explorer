"""Drive racestats.acUpdate through simulated races and check the lap accounting.

    python test_racestats_laps.py

`ac` and `acsys` only exist inside Assetto Corsa, so they are stubbed here and the real
racestats.py is imported on top of them -- what is tested is the shipping file.

The case that matters is a race where AC's own lap counter never moves. That is not
hypothetical: every call that repositions a car is documented "invalidates current lap
time", the Test Drive mode repositions cars to put them back on the road after a crash,
and CSP has nothing that adds a lap back. Before this, such a race scored zero laps for
everyone and the championship got no times at all.
"""
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- the stub sim
LAP_LENGTH_S = 100.0          # seconds a simulated car takes to get round
FRAME = 1.0 / 60.0


class Sim(object):
    def __init__(self, cars, ac_counter_works=True, grid=False):
        self.cars = cars
        self.ac_counter_works = ac_counter_works
        self.t = 0.0
        self.laps = dict((i, 0) for i in range(cars))
        self.lap_time_ms = dict((i, 0.0) for i in range(cars))
        self.grid = grid
        # Where each car starts. On the grid that is BEHIND the start line -- spline
        # near 1.0, wrapping to 0 the instant the race begins, which is the exact shape
        # of a completed lap and the reason the half-way test exists. Otherwise a small
        # stagger so they do not all cross together.
        if grid:
            self.start = dict((i, 0.98 - i * 0.002) for i in range(cars))
        else:
            self.start = dict((i, i * 0.01) for i in range(cars))
        self.spline = dict(self.start)

    def step(self, dt):
        self.t += dt
        for i in range(self.cars):
            before = self.spline[i]
            self.spline[i] = (self.start[i] + self.t / LAP_LENGTH_S) % 1.0
            self.lap_time_ms[i] += dt * 1000.0
            if before > 0.9 and self.spline[i] < 0.1:
                if self.ac_counter_works:
                    self.laps[i] += 1
                    self.lap_time_ms[i] = 0.0
                else:
                    # AC saw the crossing but threw the lap away: the counter stays put
                    # and the timer keeps running, which is what an invalidated lap
                    # looks like from here.
                    pass


SIM = None


class acsys_stub(object):
    class CS(object):
        LapCount = 'LapCount'
        LapTime = 'LapTime'
        NormalizedSplinePosition = 'Spline'
        SpeedMS = 'SpeedMS'
        AccG = 'AccG'


ac_stub = types.ModuleType('ac')
ac_stub.log = lambda *a: None
ac_stub.console = lambda *a: None
ac_stub.newApp = lambda *a: 0
ac_stub.setSize = lambda *a: None
ac_stub.setPosition = lambda *a: None
ac_stub.setTitle = lambda *a: None
ac_stub.addLabel = lambda *a: 0
ac_stub.getTrackName = lambda *a: 'new_forest_3_0'
ac_stub.getTrackConfiguration = lambda *a: ''
ac_stub.getTrackLength = lambda *a: 3628.75
ac_stub.getCarsCount = lambda: SIM.cars
ac_stub.getDriverName = lambda i: 'Driver %d' % i
ac_stub.getCarName = lambda i: 'car_%d' % i
ac_stub.getCarLeaderboardPosition = lambda i: i + 1


def _car_state(i, what):
    if what == 'LapCount':
        return SIM.laps[i]
    if what == 'LapTime':
        return SIM.lap_time_ms[i]
    if what == 'Spline':
        return SIM.spline[i]
    if what == 'SpeedMS':
        return 30.0
    if what == 'AccG':
        return [0.0, 0.0, 0.0]
    return 0


ac_stub.getCarState = _car_state

sys.modules['ac'] = ac_stub
sys.modules['acsys'] = acsys_stub

sys.path.insert(0, HERE)
import racestats  # noqa: E402

fails = []


def check(name, got, want, tol=0):
    ok = abs(got - want) <= tol if isinstance(want, (int, float)) else got == want
    print(("  PASS  " if ok else "  FAIL  ") + name + "   got %r want %r" % (got, want))
    if not ok:
        fails.append(name)


def run(cars, seconds, ac_counter_works, grid=False):
    """Reset the app's state and run a race through acUpdate frame by frame."""
    global SIM
    SIM = Sim(cars, ac_counter_works, grid)

    racestats.car_stats = {}
    racestats.prev_positions = {}
    racestats.prev_lap_counts = {}
    racestats.prev_g_forces = {}
    racestats.last_crash_times = {}
    racestats.prev_splines = {}
    racestats.lap_started_at = {}
    racestats.last_lap_at = {}
    racestats.went_round = {}
    racestats.total_cars = 0
    racestats.session_active = False
    racestats.session_total_time = 0.0
    racestats.previous_session_time = 0.0

    steps = int(seconds / FRAME)
    for _ in range(steps):
        SIM.step(FRAME)
        racestats.acUpdate(FRAME)
    return racestats.car_stats


print("\nA race AC counts normally: 3 cars, 320 s, 100 s laps")
stats = run(3, 320.0, ac_counter_works=True)
for i in range(3):
    print("    car %d: %d laps, times %s" % (
        i, len(stats[i].lap_times), [round(t / 1000.0, 2) for t in stats[i].lap_times]))
check("car 0 completed 3 laps", len(stats[0].lap_times), 3)
check("its laps are ~100 s", stats[0].lap_times[1] / 1000.0, 100.0, 0.5)
check("no car recorded a duplicate", max(len(stats[i].lap_times) for i in range(3)), 3)

print("\nThe same race with AC's counter frozen (every lap invalidated)")
stats = run(3, 320.0, ac_counter_works=False)
for i in range(3):
    print("    car %d: %d laps, times %s" % (
        i, len(stats[i].lap_times), [round(t / 1000.0, 2) for t in stats[i].lap_times]))
check("car 0 still completed 3 laps", len(stats[0].lap_times), 3)
check("timed from our own clock, still ~100 s", stats[0].lap_times[1] / 1000.0, 100.0, 0.5)
check("car 2 too", len(stats[2].lap_times), 3)

print("\nBoth triggers firing at once must still be one lap")
# ac_counter_works=True means the counter moves on the very frame the spline wraps.
stats = run(1, 220.0, ac_counter_works=True)
check("2 laps in 220 s, not 4", len(stats[0].lap_times), 2)

print("\nA car that never completes a lap records none")
stats = run(2, 40.0, ac_counter_works=True)
check("no laps after 40 s of a 100 s lap", len(stats[0].lap_times), 0)
check("  and no phantom lap at t=0 either", len(stats[1].lap_times), 0)

print("\nThe scored output still builds")
stats = run(3, 320.0, ac_counter_works=False)
d = stats[0].to_dict(position=1, total_cars=3, track_length_m=3628.75, race_laps=3,
                     best_lap_time=min(stats[0].lap_times) / 1000.0, has_fastest_lap=True)
print("    laps_completed=%s best_lap=%s total_time=%s score=%s" % (
    d['laps_completed'], d['best_lap'], d['total_time_formatted'], d['total_score']))
check("laps_completed reaches the results file", d['laps_completed'], 3)
check("best_lap is a real time", d['best_lap'] > 90.0, True)
check("total_score is not the no-laps penalty", d['total_score'] > 0, True)

print("\nCars starting on the grid, behind the start line")
# 0.98 wraps to 0 about two seconds in. Without the half-way test that is a lap for
# every car, timed at about two seconds -- and every one of them then finishes the race
# a lap early, which is the failure that matters far more than the bogus time.
stats = run(3, 60.0, ac_counter_works=True, grid=True)
for i in range(3):
    print("    car %d after 60 s: %d laps %s" % (
        i, len(stats[i].lap_times), [round(t / 1000.0, 2) for t in stats[i].lap_times]))
check("the grid itself does not score a lap", len(stats[0].lap_times), 0)
check("  nor for the car at the back", len(stats[2].lap_times), 0)

stats = run(3, 160.0, ac_counter_works=True, grid=True)
print("    car 0 after 160 s: %d laps %s" % (
    len(stats[0].lap_times), [round(t / 1000.0, 2) for t in stats[0].lap_times]))
check("the real lap still counts once it has been driven", len(stats[0].lap_times), 1)
check("  and it is a full lap, not the 2 s from grid to line",
      stats[0].lap_times[0] / 1000.0, 100.0, 2.5)

print("\nRace positions come from our laps, not AC's leaderboard")
# AC's leaderboard (the stub's i + 1) says car 0 leads. Give car 2 an extra lap and make
# car 1 quicker than car 0 over the same laps: the order has to be 2, 1, 0.
stats = run(3, 320.0, ac_counter_works=False)
stats[2].lap_times.append(95000.0)
stats[1].lap_times = [t - 3000.0 for t in stats[1].lap_times]
saved = {}
racestats.read_launch_context = lambda: {'sessions': ['race'], 'laps': 3, 'traffic': True}
racestats.current_session_number = 0
_open = open


class _Sink(object):
    def __init__(self, *a, **k):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def write(self, text):
        saved.setdefault('text', '')
        saved['text'] += text


import builtins  # noqa: E402
builtins.open = lambda *a, **k: _Sink()
try:
    os.makedirs = lambda *a, **k: None
    racestats.os.path.exists = lambda *a: True
    completed = racestats.save_current_session()
finally:
    builtins.open = _open
import json  # noqa: E402
result = json.loads(saved['text'])
order = sorted(result['driver_statistics'].items(), key=lambda kv: kv[1]['position'])
print("    " + ", ".join("%s P%d (%d laps, %.0f s)" % (
    name, d['position'], d['laps_completed'], d['total_time_seconds']) for name, d in order))
check("the car with the most laps wins", order[0][0], 'Driver 2')
check("equal laps rank by racing time", order[1][0], 'Driver 1')
check("AC's leaderboard leader is last", order[2][0], 'Driver 0')
check("the session counts as finished by our laps", completed, True)
check("fewer laps than the winner reads as retired", result['driver_statistics']['Driver 0']['retired'], True)

print("\nA normal race keeps AC's leaderboard order")
saved.clear()
racestats.read_launch_context = lambda: {'sessions': ['race'], 'laps': 3}
builtins.open = lambda *a, **k: _Sink()
try:
    racestats.save_current_session()
finally:
    builtins.open = _open
result = json.loads(saved['text'])
order = sorted(result['driver_statistics'].items(), key=lambda kv: kv[1]['position'])
check("without the traffic flag AC's leaderboard leader stays first", order[0][0], 'Driver 0')

print("\n%d failed" % len(fails) if fails else "\nall passed")
for f in fails:
    print("  FAILED:", f)
raise SystemExit(1 if fails else 0)
