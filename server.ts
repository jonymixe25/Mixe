import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken } from 'livekit-server-sdk';

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

  apiRouter.get("/livekit/token", async (req, res) => {
    try {
      const { room, identity } = req.query;
      
      if (!room || !identity || typeof identity !== 'string' || typeof room !== 'string') {
        console.warn(`[API] Invalid token request: room=${room}, identity=${identity}`);
        return res.status(400).json({ error: "Se requiere nombre de sala e identidad válida" });
      }

      console.log(`[API] Generando token - Sala: ${room}, Identidad: ${identity}`);

      // Prioritize environment variables from Secrets panel
      const apiKey = process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const livekitUrl = process.env.LIVEKIT_URL || 'wss://vidamixe-kxkfgn4j.livekit.cloud';

      if (!apiKey || !apiSecret) {
        console.error("[API] Credenciales de LiveKit no encontradas en las variables de entorno.");
        return res.status(500).json({ 
          error: "Configuración de LiveKit incompleta. Por favor, añade LIVEKIT_API_KEY y LIVEKIT_API_SECRET en el panel de Secrets." 
        });
      }

      const at = new AccessToken(apiKey, apiSecret, { 
        identity: identity,
        name: identity, // Display name in LiveKit dashboard/tools
      });

      at.addGrant({ 
        roomJoin: true, 
        room: room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true
      });

      const token = await at.toJwt();
      console.log(`[API] Token generado con éxito para la sala ${room}`);
      res.json({ token, url: livekitUrl });
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
    const distPath = path.join(__dirname, 'dist');
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
