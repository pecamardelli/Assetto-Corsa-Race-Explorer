'use client';

import * as FlagIcons from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';

interface FlagIconProps {
  nation: string;
}

// Mapping from 3-letter codes (ISO 3166-1 alpha-3) to 2-letter codes (ISO 3166-1 alpha-2)
const countryCodeMap: Record<string, string> = {
  'ARG': 'AR', // Argentina
  'BRA': 'BR', // Brazil
  'ITA': 'IT', // Italy
  'UAE': 'AE', // United Arab Emirates
  'ESP': 'ES', // Spain
  'RUS': 'RU', // Russia
  'UKR': 'UA', // Ukraine
  'ROU': 'RO', // Romania
  'USA': 'US', // United States
  'POL': 'PL', // Poland
  'JPN': 'JP', // Japan
  'TUR': 'TR', // Turkey
  'SWE': 'SE', // Sweden
  'IRA': 'IR', // Iran
  'UN': 'UN',  // Unknown
};

export default function FlagIcon({ nation }: FlagIconProps) {
  const nationUpper = nation.toUpperCase();

  // Convert 3-letter code to 2-letter code
  const countryCode = countryCodeMap[nationUpper] || nationUpper;

  // Check if flag exists for this country code
  if (!hasFlag(countryCode)) {
    return (
      <div className="flex justify-center">
        <span className="font-mono uppercase text-zinc-400 text-sm">{nation}</span>
      </div>
    );
  }

  // Dynamically get the flag component
  const FlagComponent = (FlagIcons as any)[countryCode];

  if (!FlagComponent) {
    return (
      <div className="flex justify-center">
        <span className="font-mono uppercase text-zinc-400 text-sm">{nation}</span>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <FlagComponent
        title={nation}
        className="h-6 rounded shadow-sm"
      />
    </div>
  );
}
