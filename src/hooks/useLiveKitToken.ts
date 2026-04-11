import { useState, useEffect } from 'react';

export const useLiveKitToken = (room: string, identity: string) => {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !identity) {
      setToken(null);
      setUrl(null);
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
          const text = await response.text();
          console.error('El servidor no devolvió JSON:', text.substring(0, 200));
          throw new Error(`El servidor no devolvió JSON (posible error de configuración). Respuesta: ${text.substring(0, 50)}...`);
        }

        const data = await response.json();
        setToken(data.token);
        setUrl(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchToken();
  }, [room, identity]);

  return { token, url, error };
};
