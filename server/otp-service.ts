import otpGenerator from 'otp-generator';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

export class OTPService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeMailer();
  }

  private initializeMailer() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.warn('SMTP credentials not configured. Email sending will fail.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  generateOTP(): string {
    return otpGenerator.generate(OTP_LENGTH, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
  }

  async hashOTP(otp: string): Promise<string> {
    return bcrypt.hash(otp, SALT_ROUNDS);
  }

  async compareOTP(plainOTP: string, hashedOTP: string): Promise<boolean> {
    return bcrypt.compare(plainOTP, hashedOTP);
  }

  getOTPExpiry(): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
    return expiry;
  }

  async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not initialized. Check SMTP configuration.');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Your Login OTP - Messaging App',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-box { background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Login Verification</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>You requested to log in to your account. Use the OTP code below to complete your login:</p>
                  
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  
                  <div class="warning">
                    <strong>Security Notice:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                      <li>This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong></li>
                      <li>You have <strong>${MAX_OTP_ATTEMPTS} attempts</strong> to enter the correct code</li>
                      <li>Never share this code with anyone</li>
                    </ul>
                  </div>
                  
                  <p>If you didn't request this code, please ignore this email or contact support if you have concerns about your account security.</p>
                  
                  <div class="footer">
                    <p>${new Date().getFullYear()} Messaging App. All rights reserved.</p>
                    <p>This is an automated email. Please do not reply.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Your Login OTP Code: ${otp}

This code is valid for ${OTP_EXPIRY_MINUTES} minutes.
You have ${MAX_OTP_ATTEMPTS} attempts to enter the correct code.

If you didn't request this code, please ignore this email.

- Messaging App Team
        `.trim(),
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      return false;
    }
  }

  isOTPExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  hasExceededMaxAttempts(attempts: number): boolean {
    return attempts >= MAX_OTP_ATTEMPTS;
  }
}

export const otpService = new OTPService();
