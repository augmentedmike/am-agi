'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f4f4f5' }}>
            Application error
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            {error.message || 'A critical error occurred.'}
          </p>
          {error.digest && (
            <p style={{ color: '#52525b', fontSize: '0.75rem', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: '#ec4899',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: '1rem',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
