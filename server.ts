import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import 'dotenv/config';
import fs from "fs-extra";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "v-uploads");

// Ensure uploads directory exists
fs.ensureDirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || "uploads";
    // Sanitize folder path to prevent directory traversal
    const safeFolder = folder.replace(/\.\./g, "").replace(/^\/+/, "");
    const dest = path.join(UPLOADS_DIR, safeFolder);
    fs.ensureDirSync(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  console.log(`[Server] Starting in ${NODE_ENV} mode...`);

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static uploads
  app.use("/v-uploads", express.static(UPLOADS_DIR));

  // Helper to clean environment variables from common copy-paste issues (spaces, quotes)
  const cleanEnvVar = (val: string | undefined): string => {
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
    
    return cleaned;
  };

  const apiRouter = express.Router();

  // Explicitly defined API routes on the app object for maximum reliability
  app.get("/api/ping", (req, res) => {
    console.log("[API] Ping received");
    res.json({ status: "pong", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy to apiRouter for structured routes
  app.use("/api", (req, res, next) => {
    console.log(`[API Incoming] ${req.method} ${req.path}`);
    next();
  }, apiRouter);

  apiRouter.get("/ping", (req, res) => {
    res.json({ status: "api-router-pong" });
  });

  // File Upload API directly on app or router
  apiRouter.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }
    
    // Construct the URL relative to the server
    const folder = req.body.folder || "uploads";
    const safeFolder = folder.replace(/\.\./g, "").replace(/^\/+/, "");
    const fileUrl = `/v-uploads/${safeFolder}/${req.file.filename}`;
    
    res.json({ 
      url: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype
    });
  });

  // List Files API (to replace Firebase listAll)
  apiRouter.get("/files/:folder(*)", async (req, res) => {
    try {
      const folder = req.params.folder || "";
      const safeFolder = folder.replace(/\.\./g, "").replace(/^\/+/, "");
      const fullPath = path.join(UPLOADS_DIR, safeFolder);
      
      if (!fs.existsSync(fullPath)) {
        return res.json([]);
      }

      const files = await fs.readdir(fullPath);
      const fileData = await Promise.all(
        files.map(async (fileName) => {
          const stats = await fs.stat(path.join(fullPath, fileName));
          if (stats.isDirectory()) return null;
          
          return {
            name: fileName,
            url: `/v-uploads/${safeFolder}/${fileName}`,
            size: stats.size,
            mtime: stats.mtime
          };
        })
      );

      res.json(fileData.filter(Boolean));
    } catch (error) {
      console.error("[API] Error listing files:", error);
      res.status(500).json({ error: "No se pudieron listar los archivos" });
    }
  });

  // Delete File API
  apiRouter.delete("/files", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL requerida" });
      
      // Convert URL back to path
      const relativePath = url.replace("/v-uploads/", "");
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      
      if (fs.existsSync(fullPath)) {
        await fs.remove(fullPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Archivo no encontrado" });
      }
    } catch (error) {
      console.error("[API] Error deleting file:", error);
      res.status(500).json({ error: "No se pudo eliminar el archivo" });
    }
  });

  apiRouter.get("/livekit/test", async (req, res) => {
    try {
      const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT || 'APIyitjwDR9K97b');
      const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET || 'glnVXRbmmKcykLZmi6sxh9PIQpb07GNxzH2JihD9knF');
      let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || 'wss://camweb-0hhnitxi.livekit.cloud');

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

      // Prioritize environment variables from Secrets panel
      const apiKey = cleanEnvVar(process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT || 'APIyitjwDR9K97b');
      const apiSecret = cleanEnvVar(process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET || process.env.LIVEKIT_API_CLAVE_SECRETA || 'glnVXRbmmKcykLZmi6sxh9PIQpb07GNxzH2JihD9knF');
      let livekitUrl = cleanEnvVar(process.env.LIVEKIT_URL || process.env.LIVEKIT_HOST || process.env.VITE_LIVEKIT_URL || 'wss://camweb-0hhnitxi.livekit.cloud');

      // Basic cleaning for Secret (just trim standard whitespace)
      const finalSecret = apiSecret.trim();

      // Log configuration status (WITHOUT showing the full secret)
      console.log(`[LiveKit] Token Request - Room: ${room}, Identity: ${identity}`);
      console.log(`[LiveKit] Config - Key: ${apiKey ? 'Found (' + apiKey.substring(0, 4) + '...)' : 'MISSING'}`);
      console.log(`[LiveKit] Config - Secret: ${finalSecret ? 'Found (' + finalSecret.length + ' chars)' : 'MISSING'}`);
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

  // Fallback for /api that didn't match any route
  app.all("/api/*", (req, res) => {
    console.warn(`[API] 404 - Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
  });

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
