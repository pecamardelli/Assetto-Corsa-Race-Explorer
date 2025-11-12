'use client';

interface FlagIconProps {
  nation: string;
}

export default function FlagIcon({ nation }: FlagIconProps) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Fallback to text if flag not found
    const target = e.currentTarget;
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent) {
      parent.innerHTML = `<span class="font-mono uppercase text-zinc-400 text-sm">${nation}</span>`;
    }
  };

  return (
    <div className="flex justify-center">
      <img
        src={`https://flagcdn.com/w40/${nation.toLowerCase()}.png`}
        alt={nation}
        className="h-6 rounded shadow-sm"
        onError={handleError}
      />
    </div>
  );
}
