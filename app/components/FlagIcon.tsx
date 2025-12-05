'use client';

import * as FlagIcons from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';
import Image from 'next/image';

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
  'HRV': 'HR', // Croatia (alternative code)
  'CZE': 'CZ', // Czech Republic
  'DEU': 'DE', // Germany
  'DNK': 'DK', // Denmark
  'ESP': 'ES', // Spain
  'FRA': 'FR', // France
  'GBR': 'GB', // Great Britain
  'GEO': 'GE', // Georgia
  'IRA': 'IR', // Iran
  'IRE': 'IE', // Ireland (alternative code)
  'IRL': 'IE', // Ireland
  'ITA': 'IT', // Italy
  'JPN': 'JP', // Japan
  'KEN': 'KE', // Kenya
  'MEX': 'MX', // Mexico
  'PAN': 'PA', // Panama
  'POL': 'PL', // Poland
  'ROU': 'RO', // Romania
  'RUS': 'RU', // Russia
  'SCO': 'GB-SCT', // Scotland
  'SWE': 'SE', // Sweden
  'TUR': 'TR', // Turkey
  'UAE': 'AE', // United Arab Emirates
  'UKR': 'UA', // Ukraine
  'USA': 'US', // United States
  'VEN': 'VE', // Venezuela
  'UN': 'UN',  // Unknown
  // Full country names
  'ITALY': 'IT',
  'FRANCE': 'FR',
  'GERMANY': 'DE',
  'BELGIUM': 'BE',
  'NEW ZEALAND': 'NZ',
  'UNITED STATES': 'US',
  'U.S.A.': 'US',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'SCOTLAND': 'GB-SCT',
  'SPAIN': 'ES',
  'AUSTRIA': 'AT',
  'MONACO': 'MC',
};

export default function FlagIcon({ nation }: FlagIconProps) {
  const nationUpper = nation.toUpperCase();

  // Convert 3-letter code to 2-letter code
  const countryCode = countryCodeMap[nationUpper] || nationUpper;

  // Handle regional UK flags (Scotland, England, Wales, Northern Ireland)
  // These exist as SVG files but not as React components
  const regionalFlags = ['GB-SCT', 'GB-ENG', 'GB-WLS', 'GB-NIR'];
  if (regionalFlags.includes(countryCode)) {
    return (
      <div className="flex justify-center">
        <img
          src={`/flags/${countryCode}.svg`}
          alt={nation}
          title={nation}
          className="h-6 rounded shadow-sm"
        />
      </div>
    );
  }

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
