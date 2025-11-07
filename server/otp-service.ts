import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { db } from "./db";
import { otps } from "@shared/schema";
import { eq, and, gt, lt } from "drizzle-orm";

export class OTPService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(
    email: string
  ): Promise<{ success: boolean; expiresIn: number }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.info(
        `sendOTP: generating OTP for=${email} expiresAt=${expiresAt.toISOString()}`
      );
      // Invalidate all previous OTPs for this email
      await db.delete(otps).where(eq(otps.email, email));
      console.debug(`sendOTP: cleared previous OTPs for=${email}`);

      // Hash the OTP before storing
      const hashedOTP = await bcrypt.hash(otp, 10);

      // store masked OTP in logs only (last 2 digits) to help debugging without leaking full code
      const masked = `***${otp.slice(-2)}`;
      console.debug(
        `sendOTP: storing hashed OTP for=${email} masked=${masked}`
      );

      await db.insert(otps).values({
        email,
        otp: hashedOTP,
        expiresAt,
      });
      console.info(
        `sendOTP: inserted OTP row for=${email} expiresAt=${expiresAt.toISOString()}`
      );

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: "Your Login OTP - Messaging App",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-box { background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; border: 2px solid #667eea; }
                .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Verification Code</h1>
                </div>
                <div class="content">
                  <p>Hello!</p>
                  <p>You requested to log in to your messaging account. Use the following OTP to complete your login:</p>
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  <p><strong>This code will expire in 10 minutes.</strong></p>
                  <p>If you didn't request this code, please ignore this email.</p>
                  <div class="footer">
                    <p>This is an automated message, please do not reply.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.info(
        `sendOTP: mail sent to=${email} messageId=${
          info?.messageId || "unknown"
        }`
      );

      return { success: true, expiresIn: 600 };
    } catch (error) {
      console.error("sendOTP error:", error);
      throw new Error("Failed to send OTP");
    }
  }

  async verifyOTP(email: string, otpCode: string): Promise<boolean> {
    try {
      const now = new Date();
      console.info(`verifyOTP: attempt for=${email} at=${now.toISOString()}`);

      // find non-verified OTPs that have NOT expired (expiresAt > now)
      const result = await db
        .select()
        .from(otps)
        .where(
          and(
            eq(otps.email, email),
            eq(otps.verified, false),
            // ensure the stored expiresAt is still in the future
            gt(otps.expiresAt, now)
          )
        )
        .limit(1);

      console.debug(
        "verifyOTP: db result count=",
        result.length,
        "email=",
        email
      );
      if (result.length > 0) {
        // log metadata but never the hashed OTP value directly in info-level logs
        console.debug(
          `verifyOTP: found row id=${result[0].id} expiresAt=${new Date(
            result[0].expiresAt
          ).toISOString()}`
        );
      }
      if (result.length === 0) {
        console.warn(
          `verifyOTP: no valid OTP row found for=${email} (maybe expired or already used)`
        );
        return false;
      }

      // Verify the hashed OTP
      const isValid = await bcrypt.compare(otpCode, result[0].otp);

      console.info(
        `verifyOTP: comparison result for=${email} valid=${isValid}`
      );
      if (!isValid) {
        console.warn(`verifyOTP: invalid OTP provided for=${email}`);
        return false;
      }

      // Mark as verified and delete after successful verification
      await db.delete(otps).where(eq(otps.id, result[0].id));
      console.info(
        `verifyOTP: successful verification and deleted row id=${result[0].id} for=${email}`
      );

      return true;
    } catch (error) {
      console.error("verifyOTP error:", error);
      return false;
    }
  }

  async cleanupExpiredOTPs(): Promise<void> {
    try {
      const now = new Date();
      console.info(`cleanupExpiredOTPs: running at=${now.toISOString()}`);
      const res = await db.delete(otps).where(lt(otps.expiresAt, now));
      console.info("cleanupExpiredOTPs: finished", res);
    } catch (error) {
      console.error("Error cleaning up expired OTPs:", error);
    }
  }
}

export const otpService = new OTPService();

setInterval(() => {
  otpService.cleanupExpiredOTPs();
}, 60 * 60 * 1000);
