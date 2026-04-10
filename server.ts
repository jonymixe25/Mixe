import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken } from 'livekit-server-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use("/api", (req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/livekit/token", async (req, res) => {
    try {
      const { room, identity } = req.query;
      console.log(`Token request for room: ${room}, identity: ${identity}`);
      
      if (!room || !identity) {
        return res.status(400).json({ error: "Missing room or identity" });
      }

      const apiKey = process.env.LIVEKIT_API_KEY || process.env.CLAVE_API_DE_LIVEKIT;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        console.error("LiveKit credentials missing in environment");
        return res.status(500).json({ error: "LiveKit credentials not configured" });
      }

      const at = new AccessToken(apiKey, apiSecret, { identity: identity as string });
      at.addGrant({ roomJoin: true, room: room as string });

      const token = await at.toJwt();
      console.log(`[API] Token generated for room ${room}`);
      res.json({ token });
    } catch (error) {
      console.error("[API] Error generating LiveKit token:", error);
      res.status(500).json({ error: "Internal server error generating token" });
    }
  });

  // Catch-all for unmatched API routes
  app.use("/api/*", (req, res) => {
    console.warn(`[API] Route not found: ${req.originalUrl}`);
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

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
