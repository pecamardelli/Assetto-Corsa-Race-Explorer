'use client';

import * as FlagIcons from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';

interface FlagIconProps {
  nation: string;
}

export default function FlagIcon({ nation }: FlagIconProps) {
  // Convert nation code to uppercase (e.g., 'usa' -> 'US', 'arg' -> 'AR')
  const countryCode = nation.toUpperCase();

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
