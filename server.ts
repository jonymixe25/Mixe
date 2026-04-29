import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import 'dotenv/config';
import fs from "fs-extra";
import multer from "multer";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(process.cwd(), "v-uploads");
const SITE_ASSETS_DIR = path.join(UPLOADS_DIR, "site-assets");
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");
const CHAT_UPLOADS_DIR = path.join(UPLOADS_DIR, "chat-uploads");

// Ensure all required upload directories exist immediately
[UPLOADS_DIR, SITE_ASSETS_DIR, THUMBNAILS_DIR, CHAT_UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`[Server] Creating directory: ${dir}`);
    fs.ensureDirSync(dir);
  }
});

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
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for all /api requests
  app.use("/api", (req, res, next) => {
    res.setHeader('X-API-Version', '1.0.2');
    res.setHeader('Access-Control-Expose-Headers', 'X-API-Version');
    console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
    next();
  });

  const apiRouter = express.Router();

  // Explicitly defined API routes on the apiRouter
  apiRouter.get("/ping", (req, res) => {
    res.json({ status: "pong", version: "1.0.2", timestamp: new Date().toISOString() });
  });

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", version: "1.0.2" });
  });

  // LiveKit Routes
  apiRouter.get("/livekit/test", async (req, res) => {
    console.log(`[API] LiveKit Test Hit - Version: 1.0.2`);
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
          message: 'Faltan variables de entorno (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)', 
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
  });

  apiRouter.get("/livekit/token", async (req, res) => {
    try {
      const { room, identity } = req.query;
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
  });

  // File APIs
  apiRouter.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });
    const folder = req.body.folder || "uploads";
    const safeFolder = folder.replace(/\.\./g, "").replace(/^\/+/, "");
    const fileUrl = `/v-uploads/${safeFolder}/${req.file.filename}`;
    res.json({ url: fileUrl, fileName: req.file.originalname, fileSize: req.file.size, fileType: req.file.mimetype });
  });

  apiRouter.get("/files/:folder(*)", async (req, res) => {
    try {
      const folder = req.params.folder || "";
      const safeFolder = folder.replace(/\.\./g, "").replace(/^\/+/, "");
      const fullPath = path.join(UPLOADS_DIR, safeFolder);
      if (!fs.existsSync(fullPath)) return res.json([]);
      const files = await fs.readdir(fullPath);
      const fileData = await Promise.all(files.map(async (fileName) => {
        const stats = await fs.stat(path.join(fullPath, fileName));
        if (stats.isDirectory()) return null;
        return { name: fileName, url: `/v-uploads/${safeFolder}/${fileName}`, size: stats.size, mtime: stats.mtime };
      }));
      res.json(fileData.filter(Boolean));
    } catch (error) {
      res.status(500).json({ error: "Error listing files" });
    }
  });

  apiRouter.delete("/files", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL requerida" });
      const relativePath = url.replace("/v-uploads/", "");
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      if (fs.existsSync(fullPath)) {
        await fs.remove(fullPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Archivo no encontrado" });
      }
    } catch (error) {
      res.status(500).json({ error: "Error deleting file" });
    }
  });

  // Mount the router
  app.use("/api", apiRouter);

  // Fallback for /api that didn't match any route
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.originalUrl}`, version: "1.0.2" });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Helper to clean environment variables
const cleanEnvVar = (val: string | undefined): string => {
  if (!val) return '';
  let cleaned = val.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "").trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  return cleaned;
};

startServer();
