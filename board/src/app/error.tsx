'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Something went wrong</h1>
        <p className="text-zinc-400 text-sm mb-2">{error.message || 'An unexpected error occurred.'}</p>
        {error.digest && (
          <p className="text-zinc-600 text-xs mb-6 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={reset}
            className="bg-pink-500 hover:bg-pink-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link href="/" className="text-zinc-400 hover:text-zinc-300 text-sm transition-colors">
            ← Board
          </Link>
        </div>
      </div>
    </div>
  );
}
