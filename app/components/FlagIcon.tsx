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
  'AFG': 'AF', // Afghanistan
  'ARG': 'AR', // Argentina
  'AUT': 'AT', // Austria
  'BEL': 'BE', // Belgium
  'BGD': 'BD', // Bangladesh
  'BOL': 'BO', // Bolivia
  'BRA': 'BR', // Brazil
  'CAN': 'CA', // Canada
  'CHE': 'CH', // Switzerland
  'CHL': 'CL', // Chile
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
  'GRC': 'GR', // Greece
  'ENG': 'GB-ENG', // England
  'HUN': 'HU', // Hungary
  'IRA': 'IR', // Iran
  'IRE': 'IE', // Ireland (alternative code)
  'IRL': 'IE', // Ireland
  'ITA': 'IT', // Italy
  'JOR': 'JO', // Jordan
  'JPN': 'JP', // Japan
  'KEN': 'KE', // Kenya
  'LBY': 'LY', // Libya
  'MCO': 'MC', // Monaco
  'MON': 'MC', // Monaco (alternative code)
  'MEX': 'MX', // Mexico
  'NGA': 'NG', // Nigeria
  'NLD': 'NL', // Netherlands
  'PAN': 'PA', // Panama
  'POL': 'PL', // Poland
  'ROU': 'RO', // Romania
  'RUS': 'RU', // Russia
  'SCO': 'GB-SCT', // Scotland
  'SCT': 'GB-SCT', // Scotland (alternative code)
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
  'CANADA': 'CA',
  'NEW ZEALAND': 'NZ',
  'UNITED STATES': 'US',
  'U.S.A.': 'US',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'SCOTLAND': 'GB-SCT',
  'ENGLAND': 'GB-ENG',
  'HUNGARY': 'HU',
  'LIBYA': 'LY',
  'SPAIN': 'ES',
  'SWITZERLAND': 'CH',
  'AUSTRIA': 'AT',
  'MONACO': 'MC',
  // Countries as their own tracks name them: a ui_track.json carries whatever its
  // author typed, and an Italian track is as likely to say Italia as Italy.
  'ITALIA': 'IT',
  'DEUTSCHLAND': 'DE',
  'ÖSTERREICH': 'AT',
  'OSTERREICH': 'AT',
  'SCHWEIZ': 'CH',
  'SUISSE': 'CH',
  'SVIZZERA': 'CH',
  'BELGIQUE': 'BE',
  'BELGIË': 'BE',
  'BELGIE': 'BE',
  'ESPAÑA': 'ES',
  'ESPANA': 'ES',
  'MAGYARORSZÁG': 'HU',
  'MAGYARORSZAG': 'HU',
  'NEDERLAND': 'NL',
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
        <Image
          src={`/flags/${countryCode}.svg`}
          alt={nation}
          title={nation}
          width={36}
          height={24}
          className="h-6 w-auto rounded shadow-sm"
          unoptimized
        />
      </div>
    );
  }

  // Dynamically get the flag component - try the country code directly first
  const FlagComponent = (FlagIcons as any)[countryCode];

  if (FlagComponent) {
    return (
      <div className="flex justify-center">
        <FlagComponent
          title={nation}
          className="h-6 rounded shadow-sm"
        />
      </div>
    );
  }

  // Fallback: show country code as text
  return (
    <div className="flex justify-center">
      <span className="font-mono uppercase text-zinc-400 text-sm" title={nation}>{countryCode}</span>
    </div>
  );
}
