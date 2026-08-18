import { Championship, ChampionshipCategory } from '../types/race';

/**
 * The client-safe half of the category machinery.
 *
 * `championship-categories.ts` reads categories.json off disk and so can only ever
 * run on the server. The shape it produces and the counting done over it are needed
 * in the browser too — the front page's category rows are rendered inside a client
 * component — so they live here, where there is nothing for Next to fail to bundle.
 */

export interface CategorySection {
  category: ChampionshipCategory;
  championships: Championship[];
  /**
   * The photo behind the category's row: its own if it declares one, otherwise the
   * banner of the first championship in it that has one. A category is a shelf of
   * championships, so one of their photographs represents it honestly enough, and a
   * new category is presentable the day it is added rather than the day someone
   * gets round to making artwork for it.
   */
  bannerUrl?: string;
}

/** How many races a championship has actually run, practice and qualifying aside. */
export function raceCount(championship: Championship): number {
  return championship.sessions.filter(session => {
    const sessionType = session.data.session_type || session.data.session_info.session_type;
    return sessionType === 'race';
  }).length;
}
