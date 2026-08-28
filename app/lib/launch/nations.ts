/**
 * Assetto Corsa wants a spelled-out country in NATION_CODE's sibling field. The
 * three-letter code in the .champ file is what drives the in-game flag, so an
 * unmapped code is cosmetic only and falls back to the code itself.
 */
const NATION_NAMES: Record<string, string> = {
  AFG: 'Afghanistan',
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Belgium',
  BGD: 'Bangladesh',
  BOL: 'Bolivia',
  BRA: 'Brazil',
  CAN: 'Canada',
  CHE: 'Switzerland',
  CHN: 'China',
  CRO: 'Croatia',
  CZE: 'Czech Republic',
  DEU: 'Germany',
  DNK: 'Denmark',
  ECU: 'Ecuador',
  ESP: 'Spain',
  FIN: 'Finland',
  FRA: 'France',
  GBR: 'Great Britain',
  GEO: 'Georgia',
  GRC: 'Greece',
  HRV: 'Croatia',
  IRA: 'Iran',
  IRE: 'Ireland',
  IRL: 'Ireland',
  ITA: 'Italy',
  JOR: 'Jordan',
  JPN: 'Japan',
  KEN: 'Kenya',
  MCO: 'Monaco',
  MEX: 'Mexico',
  NGA: 'Nigeria',
  NLD: 'Netherlands',
  PAN: 'Panama',
  POL: 'Poland',
  PRT: 'Portugal',
  ROU: 'Romania',
  RUS: 'Russia',
  SCO: 'Scotland',
  SCT: 'Scotland',
  SWE: 'Sweden',
  UAE: 'United Arab Emirates',
  UKR: 'Ukraine',
  USA: 'USA',
  VEN: 'Venezuela',
};

export function nationName(code: string): string {
  if (!code) return '';
  return NATION_NAMES[code.toUpperCase()] ?? code;
}
