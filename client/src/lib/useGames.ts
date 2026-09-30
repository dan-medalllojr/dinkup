import { useEffect, useState } from 'react';
import type { GameListItem } from '@dinkup/shared';
import { api, ApiError } from './api.ts';

// Fetches /api/games for a query string. Aborts the previous request when the
// query changes, so a slow old response can't overwrite a newer one.
export function useGames(query: string) {
  const [games, setGames] = useState<GameListItem[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<{ games: GameListItem[] }>('GET', `/games${query ? `?${query}` : ''}`, undefined, { signal: controller.signal })
      .then((res) => setGames(res.games))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  return { games, error, loading };
}
