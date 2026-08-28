import { ChampionshipOpponent } from '../types/race';

/**
 * Racing classes: the several races run at once inside one race.
 *
 * An endurance grid is not one field. A 2015 World Endurance round put four classes on
 * the road together — LMP1 hybrids twenty seconds a lap faster than the GT cars they
 * were lapping — and each of them was a championship of its own. The GTE driver who
 * came home fourteenth overall and first of the GT cars won their race. Scoring that
 * field as one table would hand every point to the prototypes and leave two thirds of
 * the entry list racing for nothing.
 *
 * So a class is declared per entry, in the `.champ`, as a free-text label:
 *
 *     { "name": "Nico Hülkenberg", "car": "ks_porsche_919_hybrid_2015", "class": "LMP1" }
 *
 * and everything downstream — points, wins, podiums, poles, fastest laps — is settled
 * among the entries that share it.
 *
 * Note what this is *not*. It is not [[car-classes]], which brackets cars by engine
 * displacement so a 1100 is not asked to beat a 2900; that is a property of the car,
 * derived from its specs, and it decides how an oversized field is split into batches.
 * This is a property of the *entry*, authored by hand, and it decides who a driver's
 * result is measured against. A championship can use one, both or neither.
 *
 * A championship that declares no classes at all is the ordinary case and stays
 * exactly as it was: every entry lands in one unnamed class, and scoring against
 * "everyone in my class" is scoring against the whole field. Every season on file
 * before this existed therefore reads back identically, which is the point — the
 * feature had to be free for the fifteen championships that do not want it.
 */

/**
 * The class of an entry that declares none: the single, unnamed class every
 * single-class championship runs in.
 */
export const UNCLASSED = '';

/** The class an entry runs in, or {@link UNCLASSED} where it declares none. */
export function classOfEntry(opponent: ChampionshipOpponent): string {
  const declared = opponent.class?.trim();

  return declared ? declared : UNCLASSED;
}

/**
 * Does this roster run more than one class?
 *
 * Asked wherever the answer changes what is *shown* rather than what is scored — a
 * single-class season should not grow a column of empty class badges, and its
 * standings should stay one table rather than one table in a wrapper.
 */
export function isMultiClass(opponents: readonly ChampionshipOpponent[]): boolean {
  return orderedClasses(opponents).length > 1;
}

/**
 * The classes a roster runs, in the order they should be presented.
 *
 * That order is the roster's own: the class of the first entry declaring it comes
 * first. Endurance entry lists have always been written fastest class downwards, so
 * authoring the roster in that order is enough to get LMP1 above LMGTE Pro above
 * LMGTE Am without a second place to declare it — and a roster written in some other
 * order is presented the way its author wrote it, which is the behaviour least likely
 * to surprise them.
 */
export function orderedClasses(opponents: readonly ChampionshipOpponent[]): string[] {
  const seen: string[] = [];

  for (const opponent of opponents) {
    const name = classOfEntry(opponent);
    if (!seen.includes(name)) seen.push(name);
  }

  return seen;
}

/**
 * Which class each driver races in, across any number of rosters.
 *
 * Rosters plural for the same reason {@link trafficNames} takes plural: a season's
 * table asks its own entry list, the all-time table asks every season of every
 * championship at once. Where a name appears in more than one roster the first class
 * found wins, and a name that appears in no roster at all — a driver present in a
 * result file but since removed from the entry list — is absent from the map and
 * treated as {@link UNCLASSED} by the lookups below.
 */
export function classNames(
  rosters: Iterable<readonly ChampionshipOpponent[]>
): Map<string, string> {
  const classes = new Map<string, string>();

  for (const roster of rosters) {
    for (const opponent of roster) {
      if (!classes.has(opponent.name)) classes.set(opponent.name, classOfEntry(opponent));
    }
  }

  return classes;
}

/**
 * A lookup that answers {@link UNCLASSED} for anyone it has never heard of.
 *
 * Every scoring path wants this shape rather than a Map, because an unknown driver
 * must not become a class of one: a result file naming somebody the roster has since
 * dropped should still be scored against the field they actually raced.
 */
export type ClassLookup = (driver: string) => string;

/** {@link ClassLookup} over a name→class map. */
export function classLookup(classes: ReadonlyMap<string, string>): ClassLookup {
  return driver => classes.get(driver) ?? UNCLASSED;
}

/** The lookup a single-class championship uses: everyone in the same unnamed class. */
export const SINGLE_CLASS: ClassLookup = () => UNCLASSED;

/**
 * How a class is written on a standings table.
 *
 * Only the empty class needs translating — it is one field, so it is labelled as the
 * whole of it rather than as a class among others. Every other label is the author's
 * own string, shown as written.
 */
export function classLabel(name: string): string {
  return name === UNCLASSED ? 'Overall' : name;
}
