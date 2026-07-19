'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Caught:', error);
  }, [error]);

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '20vh' }}>
      <h2 className="main-title">Something went wrong!</h2>
      <p className="sub" style={{ marginBottom: '32px' }}>
        We encountered an unexpected error, but we've successfully caught it to prevent a full crash.
      </p>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className="btn primary"
      >
        Try again
      </button>
      <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        Error details: {error.message || 'Unknown error'}
      </p>
    </div>
  );
}
