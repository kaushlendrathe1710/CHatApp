import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { db } from './db';
import { otps } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';

export class OTPService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string): Promise<{ success: boolean; expiresIn: number }> {
    try {
      // Check if SMTP is configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        throw new Error('SMTP not configured. Please contact the administrator.');
      }

      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate all previous OTPs for this email
      await db.delete(otps).where(eq(otps.email, email));

      // Hash the OTP before storing
      const hashedOTP = await bcrypt.hash(otp, 10);

      await db.insert(otps).values({
        email,
        otp: hashedOTP,
        expiresAt,
      });

      const mailOptions = {
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject: 'Your Login OTP - Messaging App',
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

      await this.transporter.sendMail(mailOptions);

      return { success: true, expiresIn: 600 };
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('SMTP not configured')) {
        throw error; // Re-throw with the specific message
      }
      
      // Common SMTP errors
      if (error.code === 'EAUTH') {
        throw new Error('Email authentication failed. Please check SMTP credentials.');
      }
      if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        throw new Error('Unable to connect to email server. Please try again later.');
      }
      
      throw new Error('Failed to send OTP email. Please try again.');
    }
  }

  async verifyOTP(email: string, otpCode: string): Promise<boolean> {
    try {
      const now = new Date();
      
      const result = await db
        .select()
        .from(otps)
        .where(
          and(
            eq(otps.email, email),
            eq(otps.verified, false),
            lt(now, otps.expiresAt)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return false;
      }

      // Verify the hashed OTP
      const isValid = await bcrypt.compare(otpCode, result[0].otp);
      
      if (!isValid) {
        return false;
      }

      // Mark as verified and delete after successful verification
      await db.delete(otps).where(eq(otps.id, result[0].id));

      return true;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return false;
    }
  }

  async cleanupExpiredOTPs(): Promise<void> {
    try {
      const now = new Date();
      await db.delete(otps).where(lt(otps.expiresAt, now));
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }
}

export const otpService = new OTPService();

setInterval(() => {
  otpService.cleanupExpiredOTPs();
}, 60 * 60 * 1000);
