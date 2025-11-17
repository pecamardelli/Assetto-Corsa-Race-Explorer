'use client';

import * as FlagIcons from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';

interface FlagIconProps {
  nation: string;
}

// Mapping from 3-letter codes (ISO 3166-1 alpha-3) and country names to 2-letter codes (ISO 3166-1 alpha-2)
const countryCodeMap: Record<string, string> = {
  // 3-letter codes
  'ARG': 'AR', // Argentina
  'BRA': 'BR', // Brazil
  'CHN': 'CN', // China
  'CRO': 'HR', // Croatia
  'CZE': 'CZ', // Czech Republic
  'DEU': 'DE', // Germany
  'DNK': 'DK', // Denmark
  'ESP': 'ES', // Spain
  'FRA': 'FR', // France
  'GBR': 'GB', // Great Britain
  'IRA': 'IR', // Iran
  'IRL': 'IE', // Ireland
  'ITA': 'IT', // Italy
  'JPN': 'JP', // Japan
  'KEN': 'KE', // Kenya
  'MEX': 'MX', // Mexico
  'POL': 'PL', // Poland
  'ROU': 'RO', // Romania
  'RUS': 'RU', // Russia
  'SCO': 'GB', // Scotland (use GB flag)
  'SWE': 'SE', // Sweden
  'TUR': 'TR', // Turkey
  'UAE': 'AE', // United Arab Emirates
  'UKR': 'UA', // Ukraine
  'USA': 'US', // United States
  'UN': 'UN',  // Unknown
  // Full country names
  'ITALY': 'IT',
  'FRANCE': 'FR',
  'GERMANY': 'DE',
  'BELGIUM': 'BE',
  'NEW ZEALAND': 'NZ',
  'UNITED STATES': 'US',
  'UNITED KINGDOM': 'GB',
  'SPAIN': 'ES',
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
