import { promises as fs } from 'fs';
import path from 'path';
import { Championship, ChampionshipCategory } from '../types/race';
import { CategorySection } from './category-view';

/**
 * The shelves the front page sorts championships onto.
 *
 * A championship's folder says what it is called and what it raced, but not what
 * kind of racing it is — there is nothing in a .champ file that tells a Grand Prix
 * season from a run down a coast road. So the grouping is declared rather than
 * inferred, in app/data/championship/categories.json, which is also what fixes the
 * order the categories and their contents appear in.
 *
 * Nothing is lost by not being listed. A championship the file does not mention
 * still appears, under "Unsorted", which is the signal to go and file it.
 */

const CATEGORIES_FILE = path.join(
  process.cwd(),
  'app',
  'data',
  'championship',
  'categories.json'
);

/** Where a championship goes when categories.json has not been told about it. */
const UNSORTED_ID = 'unsorted';

export async function readCategories(): Promise<ChampionshipCategory[]> {
  try {
    const contents = await fs.readFile(CATEGORIES_FILE, 'utf8');
    const parsed = JSON.parse(contents.replace(/^﻿/, '')) as {
      categories?: ChampionshipCategory[];
    };
    return parsed.categories ?? [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // No file at all is a fair state — everything simply lands in Unsorted. Any
    // other failure is worth saying out loud, since the front page will look wrong.
    if (code !== 'ENOENT') console.error('Could not read categories.json:', error);
    return [];
  }
}

function bannerFor(
  category: ChampionshipCategory,
  championships: Championship[]
): string | undefined {
  if (category.banner) return category.banner;
  return championships.find(entry => entry.bannerUrl)?.bannerUrl;
}

/**
 * Championships arranged under their categories.
 *
 * Both orders come from the file: the categories in the order they are declared,
 * and within each one the championships in the order they are listed, rather than
 * alphabetically or by however the folders happened to be read off disk. A category
 * that ends up holding nothing is dropped, so removing a championship's folder does
 * not leave an empty shelf behind.
 */
export function groupByCategory(
  championships: Championship[],
  categories: ChampionshipCategory[]
): CategorySection[] {
  const byFolder = new Map(championships.map(entry => [entry.folderName, entry]));
  const filed = new Set<string>();

  const sections: CategorySection[] = categories.map(category => {
    const held = category.championships
      .map(folderName => {
        const championship = byFolder.get(folderName);
        if (championship) filed.add(folderName);
        return championship;
      })
      .filter((entry): entry is Championship => entry !== undefined)
      .map(entry => ({ ...entry, categoryId: category.id }));

    return { category, championships: held, bannerUrl: bannerFor(category, held) };
  });

  const unsorted = championships
    .filter(entry => !filed.has(entry.folderName))
    .map(entry => ({ ...entry, categoryId: UNSORTED_ID }));

  if (unsorted.length) {
    const category: ChampionshipCategory = {
      id: UNSORTED_ID,
      name: 'Unsorted',
      description: 'Not yet filed under a category in categories.json.',
      accent: 'zinc',
      championships: unsorted.map(entry => entry.folderName),
    };
    sections.push({
      category,
      championships: unsorted,
      bannerUrl: bannerFor(category, unsorted),
    });
  }

  return sections.filter(section => section.championships.length > 0);
}

/** One category by id, with its championships. Null when there is no such shelf. */
export async function getCategorySection(
  categoryId: string,
  championships: Championship[]
): Promise<CategorySection | null> {
  const categories = await readCategories();
  const sections = groupByCategory(championships, categories);
  return sections.find(section => section.category.id === categoryId) ?? null;
}

export type { CategorySection };
export { raceCount } from './category-view';
