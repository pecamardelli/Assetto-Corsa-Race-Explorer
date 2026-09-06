'use client';

import type React from 'react';
import * as FlagIcons from 'country-flag-icons/react/3x2';
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
  'FIN': 'FI', // Finland
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
  'PRT': 'PT', // Portugal
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
  // Added 2026-09-05 with the regional challenges: rosters and tracks now reach beyond
  // Europe and the Americas, and a code the map does not know falls through as text.
  'AUS': 'AU', // Australia
  'NZL': 'NZ', // New Zealand
  'ZAF': 'ZA', // South Africa
  'DZA': 'DZ', // Algeria
  'MAR': 'MA', // Morocco
  'TUN': 'TN', // Tunisia
  'EGY': 'EG', // Egypt
  'CRI': 'CR', // Costa Rica
  'VCT': 'VC', // Saint Vincent and the Grenadines
  'COL': 'CO', // Colombia
  'PER': 'PE', // Peru
  'URY': 'UY', // Uruguay
  'PRY': 'PY', // Paraguay
  'ECU': 'EC', // Ecuador
  'CUB': 'CU', // Cuba
  'THA': 'TH', // Thailand
  'KOR': 'KR', // South Korea
  'TWN': 'TW', // Taiwan
  'MYS': 'MY', // Malaysia
  'IDN': 'ID', // Indonesia
  'SGP': 'SG', // Singapore
  'HKG': 'HK', // Hong Kong
  'PHL': 'PH', // Philippines
  'VNM': 'VN', // Vietnam
  'IND': 'IN', // India
  'SAU': 'SA', // Saudi Arabia
  'QAT': 'QA', // Qatar
  'ISR': 'IL', // Israel
  'NOR': 'NO', // Norway
  'ISL': 'IS', // Iceland
  'LUX': 'LU', // Luxembourg
  'SVK': 'SK', // Slovakia
  'SVN': 'SI', // Slovenia
  'SRB': 'RS', // Serbia
  'BGR': 'BG', // Bulgaria
  'EST': 'EE', // Estonia
  'LVA': 'LV', // Latvia
  'LTU': 'LT', // Lithuania
  'WLS': 'GB-WLS', // Wales
  'NIR': 'GB-NIR', // Northern Ireland
  // Full country names
  'ITALY': 'IT',
  'FRANCE': 'FR',
  'GERMANY': 'DE',
  'BELGIUM': 'BE',
  'CANADA': 'CA',
  'NEW ZEALAND': 'NZ',
  'ARGENTINA': 'AR',
  'BAHRAIN': 'BH',
  'CHINA': 'CN',
  'JAPAN': 'JP',
  'MOROCCO': 'MA',
  'NETHERLANDS': 'NL',
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
  // Track countries as the installed ui_track.json files spell them (audited 2026-09-05:
  // every country string in app/data/tracks resolves through this map).
  'WALES': 'GB-WLS',
  'NORTHERN IRELAND': 'GB-NIR',
  'IRELAND': 'IE',
  'ROMANIA': 'RO',
  'ALGERIA': 'DZ',
  'SOUTH AFRICA': 'ZA',
  'COSTA RICA': 'CR',
  'SAINT VINCENT AND THE GRENADINES': 'VC',
  'ST VINCENT AND THE GRENADINES': 'VC',
  'AUSTRALIA': 'AU',
  'PORTUGAL': 'PT',
  'SWEDEN': 'SE',
  'NORWAY': 'NO',
  'FINLAND': 'FI',
  'DENMARK': 'DK',
  'POLAND': 'PL',
  'CZECH REPUBLIC': 'CZ',
  'CZECHIA': 'CZ',
  'RUSSIA': 'RU',
  'TURKEY': 'TR',
  'GREECE': 'GR',
  'BRAZIL': 'BR',
  'BRASIL': 'BR',
  'MEXICO': 'MX',
  'MÉXICO': 'MX',
  'CHILE': 'CL',
  'URUGUAY': 'UY',
  'COLOMBIA': 'CO',
  'PERU': 'PE',
  'VENEZUELA': 'VE',
  'INDIA': 'IN',
  'KOREA': 'KR',
  'SOUTH KOREA': 'KR',
  'TAIWAN': 'TW',
  'MALAYSIA': 'MY',
  'INDONESIA': 'ID',
  'THAILAND': 'TH',
  'SINGAPORE': 'SG',
  'UNITED ARAB EMIRATES': 'AE',
  'SAUDI ARABIA': 'SA',
  'QATAR': 'QA',
  'EGYPT': 'EG',
  'TUNISIA': 'TN',
  'KENYA': 'KE',
  'ROMÂNIA': 'RO',
  'FRANCIA': 'FR',
  'ALEMANIA': 'DE',
  'ESTADOS UNIDOS': 'US',
  'REINO UNIDO': 'GB',
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

// A fictional road (Mountain Route, Black Cat County's "Fantasy" city) has no country to
// fly; the chequered flag says so without spelling FICTIONAL across the table.
const NO_COUNTRY = ['', 'FICTIONAL', 'FANTASY', 'FICTION', 'NONE', 'N/A', 'UNKNOWN', 'UN'];

export default function FlagIcon({ nation }: FlagIconProps) {
  const nationUpper = (nation ?? '').trim().toUpperCase();

  if (NO_COUNTRY.includes(nationUpper)) {
    return (
      <div className="flex justify-center">
        <Image
          src="/racing-flag.svg"
          alt={nation || 'no country'}
          title={nation || 'no country'}
          width={36}
          height={24}
          className="h-6 w-auto opacity-70"
          unoptimized
        />
      </div>
    );
  }

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
  const flags = FlagIcons as unknown as Record<string, React.ComponentType<{ title?: string; className?: string }> | undefined>;
  const FlagComponent = flags[countryCode];

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
