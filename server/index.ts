import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, broadcastToConversation } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import "dotenv/config";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Background cleanup job for disappearing messages
  // Run every 5 minutes to check for expired messages
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  const runCleanup = async () => {
    try {
      const deletedMessages = await storage.deleteExpiredMessages();
      
      if (deletedMessages.length > 0) {
        log(`Deleted ${deletedMessages.length} expired message(s)`);
        
        // Broadcast message deletions to relevant conversations
        deletedMessages.forEach(({ messageId, conversationId }) => {
          broadcastToConversation(conversationId, {
            type: 'message_deleted',
            data: { messageId, conversationId },
          });
        });
      }
    } catch (error) {
      console.error('Error running cleanup job:', error);
    }
  };

  // Run cleanup immediately on startup, then every 5 minutes
  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  log('Disappearing messages cleanup job started');
})();
