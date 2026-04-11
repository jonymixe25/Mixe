import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { room, identity } = req.query;
    
    if (!room || !identity) {
      return res.status(400).json({ error: "Missing room or identity" });
    }

    const apiKey = process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT || 'APIouZ8zkp2nVDD';
    const apiSecret = process.env.LIVEKIT_API_SECRET || '6TIvnesUcT9AorWdTGaSXnlJKBf99bbl6GqzrCIYOfDA';
    const livekitUrl = process.env.LIVEKIT_URL || 'wss://vidamixe-kxkfgn4j.livekit.cloud';

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error("[API] LiveKit credentials missing. Required: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL");
      return res.status(500).json({ error: "LiveKit credentials not configured in environment variables" });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: identity as string });
    at.addGrant({ 
      roomJoin: true, 
      room: room as string,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = await at.toJwt();
    res.status(200).json({ token, url: livekitUrl });
  } catch (error) {
    console.error("[API] Error generating LiveKit token:", error);
    res.status(500).json({ error: "Internal server error generating token" });
  }
}
