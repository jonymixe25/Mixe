import { useState, useEffect } from 'react';

export const useLiveKitToken = (room: string, identity: string) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !identity) {
      setToken(null);
      return;
    }

    const fetchToken = async () => {
      try {
        const response = await fetch(`/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch token');
        }
        const data = await response.json();
        setToken(data.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchToken();
  }, [room, identity]);

  return { token, error };
};
