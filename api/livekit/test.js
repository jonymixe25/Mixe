import { RoomServiceClient } from 'livekit-server-sdk';

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
    const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT || 'APIyitjwDR9K97b');
    const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET || 'glnVXRbmmKcykLZmi6sxh9PIQpb07GNxzH2JihD9knF');
    let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || 'wss://camweb-0hhnitxi.livekit.cloud');

    const debugInfo = {
      urlFound: !!livekitUrl,
      keyFound: !!apiKey,
      secretFound: !!apiSecret,
      version: "1.0.2"
    };

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Faltan variables de entorno', 
        debug: debugInfo 
      });
    }

    let svcUrl = livekitUrl;
    if (!svcUrl.startsWith('http') && !svcUrl.startsWith('ws')) {
      svcUrl = `https://${svcUrl}`;
    }
    svcUrl = svcUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    
    const roomService = new RoomServiceClient(svcUrl, apiKey, apiSecret);
    await roomService.listRooms();
    
    res.json({ 
      status: 'ok', 
      message: '¡Conexión con LiveKit exitosa!', 
      version: "1.0.2"
    });
  } catch (error) {
    console.error("[API] LiveKit Test Error:", error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Error desconocido de conexión',
      version: "1.0.2"
    });
  }
}
