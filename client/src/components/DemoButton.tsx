import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

// One click into a throwaway demo account (deleted after 24 hours).
export function DemoButton({ className = 'button button-ghost', label = 'Try the demo' }: { className?: string; label?: string }) {
  const { tryDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    try {
      await tryDemo();
      navigate('/games', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={busy}>
        {busy ? 'Starting demo…' : label}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
