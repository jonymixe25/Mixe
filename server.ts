import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  console.log(`[Server] Starting in ${NODE_ENV} mode...`);

  const apiRouter = express.Router();

  apiRouter.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  apiRouter.get("/livekit/test", async (req, res) => {
    try {
      const cleanEnvVar = (val: string | undefined) => {
        if (!val) return '';
        // Remove ANY non-standard characters, invisible control characters, and trim
        let cleaned = val.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "").trim();
        
        // Remove surrounding quotes ONLY IF they wrap the entire string
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }
        
        // Handle case where user pasted "KEY=VALUE" (common in .env copy-paste)
        if (/^[A-Z0-9_]+=[^=]/.test(cleaned)) {
          const firstEq = cleaned.indexOf('=');
          cleaned = cleaned.substring(firstEq + 1).trim();
          // Re-check for quotes after splitting
          if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
          }
        }
        
        // Final trim and character cleaning
        return cleaned;
      };

      const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT);
      const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET);
      let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST);

      const debugInfo = {
        urlFound: !!livekitUrl,
        keyFound: !!apiKey,
        secretFound: !!apiSecret,
        keyPrefix: apiKey ? apiKey.substring(0, 4) : '',
        keySuffix: apiKey ? apiKey.substring(apiKey.length - 4) : '',
        keyLength: apiKey ? apiKey.length : 0,
        secretLength: apiSecret ? apiSecret.length : 0,
        url: livekitUrl || 'None',
        isCloud: livekitUrl ? livekitUrl.includes('livekit.cloud') : false
      };

      if (!apiKey || !apiSecret || !livekitUrl) {
        return res.status(500).json({ 
          status: 'error', 
          message: 'Faltan variables de entorno en el panel de Secrets (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)', 
          debug: debugInfo 
        });
      }

      // LiveKit Project IDs often get mistaken for API Keys
      if (debugInfo.isCloud && !apiKey.startsWith('API')) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de API Key incorrecto. En LiveKit Cloud, la clave debe empezar por "API". Parece que has usado el ID del Proyecto.',
          debug: debugInfo
        });
      }

      // Ensure URL has protocol for RoomServiceClient
      let svcUrl = livekitUrl;
      if (!svcUrl.startsWith('http') && !svcUrl.startsWith('ws')) {
        svcUrl = `https://${svcUrl}`;
      }
      svcUrl = svcUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      
      console.log(`[API] Testing LiveKit connection to: ${svcUrl}`);
      const roomService = new RoomServiceClient(svcUrl, apiKey, apiSecret);
      
      // Attempt a real operation
      await roomService.listRooms();
      
      res.json({ 
        status: 'ok', 
        message: '¡Conexión con LiveKit exitosa!', 
        debug: { ...debugInfo, urlUsed: svcUrl } 
      });
    } catch (error) {
      console.error("[API] LiveKit Test Error:", error);
      
      let message = error instanceof Error ? error.message : 'Error desconocido de conexión';
      let hint = '';

      if (message.toLowerCase().includes('unauthorized') || message.includes('401')) {
        message = "Credenciales incorrectas (Unauthorized)";
        hint = "Verifica que la API Key y el Secret sean correctos y pertenezcan al proyecto indicado en la URL.";
      } else if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN') || message.toLowerCase().includes('fetch failed')) {
        message = "No se pudo alcanzar el servidor (URL o Red)";
        hint = "Verifica que la LIVEKIT_URL sea correcta (ej: wss://proyecto.livekit.cloud).";
      }

      res.status(500).json({ 
        status: 'error', 
        message,
        hint,
        debug: {
            errorType: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });

  apiRouter.get("/livekit/token", async (req, res) => {
    try {
      const { room, identity } = req.query;
      
      if (!room || !identity || typeof identity !== 'string' || typeof room !== 'string') {
        console.warn(`[API] Invalid token request: room=${room}, identity=${identity}`);
        return res.status(400).json({ error: "Se requiere nombre de sala e identidad válida" });
      }

      // Function to clean environment variables from common copy-paste issues (spaces, quotes)
      const cleanEnvVar = (val: string | undefined) => {
        if (!val) return '';
        let cleaned = val.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "").trim();
        // Remove surrounding quotes ONLY IF they wrap the entire string
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }
        
        // Handle case where user pasted "KEY=VALUE"
        if (/^[A-Z0-9_]+=[^=]/.test(cleaned)) {
          const firstEq = cleaned.indexOf('=');
          cleaned = cleaned.substring(firstEq + 1).trim();
          // Re-check for quotes after splitting KEY=VALUE
          if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.substring(1, cleaned.length - 1).trim();
          }
        }
        
        return cleaned;
      };

      // Prioritize environment variables from Secrets panel
      const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT);
      const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET || process.env.LIVEKIT_API_CLAVE_SECRETA);
      let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || process.env.VITE_LIVEKIT_URL);

      // Advanced cleaning for Secret (extra cautious about invisible chars)
      const sanitizeSecret = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();
      const finalSecret = sanitizeSecret(apiSecret);

      // Log configuration status (WITHOUT showing the full secret)
      console.log(`[LiveKit] Token Request - Room: ${room}, Identity: ${identity}`);
      console.log(`[LiveKit] Config - Key: ${apiKey ? 'Found (' + apiKey.substring(0, 4) + '...)' : 'MISSING'}`);
      console.log(`[LiveKit] Config - Secret: ${finalSecret ? 'Found (' + finalSecret.length + ' chars, ' + (finalSecret !== apiSecret ? 'CLEANED' : 'CLEAN') + ')' : 'MISSING'}`);
      console.log(`[LiveKit] Config - URL: ${livekitUrl || 'MISSING'}`);

      // Clean identity and room (no spaces allowed in some LiveKit identifiers)
      const cleanIdentity = (typeof identity === 'string' ? identity : '').trim().replace(/\s+/g, '_');
      const cleanRoom = (typeof room === 'string' ? room : '').trim().replace(/\s+/g, '_');

      if (!cleanIdentity || !cleanRoom) {
        return res.status(400).json({ error: "Identidad o sala vacía" });
      }

      // Basic URL sanitization
      if (livekitUrl) {
        livekitUrl = livekitUrl.trim().replace(/\/+$/, '');
        if (livekitUrl.startsWith('https://')) {
          livekitUrl = livekitUrl.replace('https://', 'wss://');
        } else if (livekitUrl.startsWith('http://')) {
          livekitUrl = livekitUrl.replace('http://', 'ws://');
        } else if (!livekitUrl.includes('://')) {
          livekitUrl = `wss://${livekitUrl}`;
        }
      }

      // Check if keys look like placeholders
      const isPlaceholder = (val: string) => /^(TU_API_KEY|TU_API_SECRET|MY_.*_KEY|your-.*|YOUR_.*|<.*>)$/i.test(val);

      if (!apiKey || !apiSecret || !livekitUrl) {
        console.error("[API] Configuración de LiveKit incompleta.");
        return res.status(500).json({ 
          error: "Configuración incompleta: Por favor, introduce LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET en el panel de Secrets." 
        });
      }

      if (isPlaceholder(apiKey) || isPlaceholder(apiSecret) || isPlaceholder(livekitUrl)) {
        return res.status(500).json({ 
          error: "Se detectaron valores de ejemplo (placeholders) en la configuración. Por favor, sustitúyelos por tus claves reales de LiveKit Cloud en el panel de Secrets." 
        });
      }

      // Basic length check for API Key/Secret
      if (apiKey.length < 5 || apiSecret.length < 5) {
        return res.status(500).json({ 
          error: "Las claves de LiveKit parecen ser demasiado cortas o inválidas. Verifica que hayas copiado la API Key y el Secret correctamente del panel de LiveKit Cloud." 
        });
      }

      // Check for common error: using project ID instead of API Key
      if (livekitUrl.includes('livekit.cloud') && !apiKey.startsWith('API')) {
        console.error("[API] Error de clave: Se está usando el Project ID en lugar de la API Key.");
        return res.status(500).json({
          error: "Error de configuración: La API Key de LiveKit Cloud debe empezar por 'API'. No uses el 'Project ID'. Genera una clave en el panel de LiveKit Cloud > Settings > Keys (ej: APIxxx)."
        });
      }

      console.log(`[API] Solicitud de Token: Sala=${cleanRoom}, Usuario=${cleanIdentity}, URL=${livekitUrl}`);
      
      try {
        const at = new AccessToken(apiKey, finalSecret, { 
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

        // Optional: Verify token signature locally to catch early mismatches (though at.toJwt() already uses them)
        // There's no easy way to test the secret without an external call or manual signature check,
        // so we'll just log and return.
        
        console.log(`[API] Token generado con éxito para ${cleanIdentity}`);
        res.json({ token, url: livekitUrl });
      } catch (tokenErr) {
        console.error("[API] Error crítico al firmar el token JWT:", tokenErr);
        res.status(500).json({ error: "No se pudo firmar el token de LiveKit. Verifica que el Secret sea correcto." });
      }
    } catch (error) {
      console.error("[API] Error al generar el token de LiveKit:", error);
      res.status(500).json({ error: "Error interno al generar el token de acceso" });
    }
  });

  // API 404 handler
  apiRouter.use((req, res) => {
    console.warn(`[API] Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: `API route not found: ${req.path}` });
  });

  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`[Server] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
