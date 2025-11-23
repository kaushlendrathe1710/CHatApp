import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { otpService } from "./otp-service";
import { storage } from "./storage";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
        isRegistered: boolean;
        role?: string;
      };
    }
  }
}

// Extend session type to include userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
    email: string;
  }
}

// Authentication middleware - attaches user to req for convenience
export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          isRegistered: user.isRegistered,
          role: user.role,
        };
        next();
      } else {
        req.session.destroy(() => {});
        res.status(401).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
}

// Request OTP schema
const requestOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Verify OTP schema
const verifyOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// Register user schema
const registerUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  mobileNumber: z.string().min(10, "Valid mobile number is required"),
});

// Rate limiters
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 requests per 15 minutes per IP
  message: "Too many OTP requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 verification attempts per 15 minutes per IP
  message: "Too many verification attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Setup auth routes
export function setupAuth(app: Express) {
  // Request OTP
  app.post('/api/auth/request-otp', otpRequestLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = requestOTPSchema.parse(req.body);

      const result = await otpService.sendOTP(email);

      res.json({
        success: true,
        message: "OTP sent successfully",
        expiresIn: result.expiresIn,
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // Verify OTP
  app.post('/api/auth/verify-otp', otpVerifyLimiter, async (req: Request, res: Response) => {
    try {
      const { email, otp } = verifyOTPSchema.parse(req.body);

      const isValid = await otpService.verifyOTP(email, otp);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);

      if (!user) {
        // Create new user with email only
        user = await storage.createUser({
          email,
          isRegistered: false,
        });
      }

      // Set session
      req.session.userId = user.id;
      req.session.email = user.email;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          isRegistered: user.isRegistered,
        },
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Register user (first-time users only)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { fullName, username, mobileNumber } = registerUserSchema.parse(req.body);

      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already taken" });
      }

      // Update user with registration details
      const user = await storage.updateUser(req.session.userId, {
        fullName,
        username,
        mobileNumber,
        isRegistered: true,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          isRegistered: user.isRegistered,
        },
      });
    } catch (error) {
      console.error("Error registering user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Get current user
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        profileImageUrl: user.profileImageUrl,
        status: user.status,
        role: user.role,
        lastSeen: user.lastSeen,
        isRegistered: user.isRegistered,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}
