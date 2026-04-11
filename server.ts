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
      console.log(`[API] Token request - Room: ${room}, Identity: ${identity}`);
      
      if (!room || !identity) {
        return res.status(400).json({ error: "Missing room or identity" });
      }

      const apiKey = process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const livekitUrl = process.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret || !livekitUrl) {
        console.error("[API] LiveKit credentials missing. Required: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL");
        return res.status(500).json({ error: "LiveKit credentials not configured in Secrets" });
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
      console.log(`[API] Token generated successfully for room ${room}`);
      res.json({ token, url: livekitUrl });
    } catch (error) {
      console.error("[API] Error generating LiveKit token:", error);
      res.status(500).json({ error: "Internal server error generating token" });
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
