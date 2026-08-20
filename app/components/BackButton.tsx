'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  fallbackUrl?: string;
  children?: React.ReactNode;
}

export default function BackButton({ fallbackUrl = '/', children }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-4"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {children || 'Back'}
    </button>
  );
}
