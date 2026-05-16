import { AccessToken } from 'livekit-server-sdk';

const cleanEnvVar = (val) => {
  if (!val) return '';
  let cleaned = val.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "").trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  return cleaned;
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const room = req.query.room;
    const identity = req.query.identity;

    if (!room || !identity || typeof identity !== 'string' || typeof room !== 'string') {
      return res.status(400).json({ error: "Se requiere nombre de sala e identidad válida" });
    }

    const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || 'APIyitjwDR9K97b');
    const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || 'glnVXRbmmKcykLZmi6sxh9PIQpb07GNxzH2JihD9knF');
    let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || 'wss://camweb-0hhnitxi.livekit.cloud');

    const cleanIdentity = identity.trim().replace(/\s+/g, '_');
    const cleanRoom = room.trim().replace(/\s+/g, '_');

    const at = new AccessToken(apiKey, apiSecret, { 
      identity: cleanIdentity,
      name: cleanIdentity,
      ttl: 3600
    });

    at.addGrant({ 
      roomJoin: true, 
      room: cleanRoom,
      canPublish: true, 
      canSubscribe: true,
      canPublishData: true
    });

    const token = await at.toJwt();
    res.json({ token, url: livekitUrl });
  } catch (error) {
    console.error("[API] Error generating token:", error);
    res.status(500).json({ error: "Error interno al generar el token" });
  }
}
