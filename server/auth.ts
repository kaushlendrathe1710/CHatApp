import session from "express-session";
import type { Express, RequestHandler, Request } from "express";
import connectPg from "connect-pg-simple";

declare module 'express-session' {
  interface SessionData {
    userId: string;
    verifiedEmail?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export function getAuthenticatedUserId(req: Request): string {
  if (!req.session?.userId) {
    throw new Error('Unauthorized');
  }
  return req.session.userId;
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  try {
    getAuthenticatedUserId(req);
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};
