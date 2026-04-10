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
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch token');
          }
          throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('El servidor no devolvió JSON. Verifica que la API esté funcionando.');
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
