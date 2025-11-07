# Production Setup Guide

## 🚀 Deploying to Production

When you publish your app on Replit, the development environment secrets are **NOT automatically copied** to production. You need to manually configure them.

## 📧 Required SMTP Configuration

Your app uses email-based OTP authentication, which requires SMTP credentials to send verification codes.

### Step 1: Get SMTP Credentials

Choose one of these email providers:

#### Option A: Gmail (Recommended for Testing)
1. Use a Gmail account
2. Enable 2-Factor Authentication
3. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Create a new app password for "Mail"
   - Copy the 16-character password

**Settings:**
- `SMTP_HOST`: smtp.gmail.com
- `SMTP_PORT`: 587
- `SMTP_SECURE`: false
- `SMTP_USER`: your-email@gmail.com
- `SMTP_PASSWORD`: your-app-password (16 characters)
- `SMTP_FROM_EMAIL`: your-email@gmail.com

#### Option B: SendGrid (Recommended for Production)
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create an API key
3. Use the API key as password

**Settings:**
- `SMTP_HOST`: smtp.sendgrid.net
- `SMTP_PORT`: 587
- `SMTP_SECURE`: false
- `SMTP_USER`: apikey
- `SMTP_PASSWORD`: your-sendgrid-api-key
- `SMTP_FROM_EMAIL`: your-verified-sender@yourdomain.com

#### Option C: Mailgun
1. Sign up at https://mailgun.com (free tier: 5,000 emails/month)
2. Get SMTP credentials from dashboard

**Settings:**
- `SMTP_HOST`: smtp.mailgun.org
- `SMTP_PORT`: 587
- `SMTP_SECURE`: false
- `SMTP_USER`: your-mailgun-username
- `SMTP_PASSWORD`: your-mailgun-password
- `SMTP_FROM_EMAIL`: noreply@yourdomain.com

### Step 2: Configure Production Secrets

1. **Open your published/deployed app** (e.g., chatapp.churumuru.com)
2. **Click the "Deployments" tab** in Replit
3. **Go to "Environment Variables" or "Secrets"** in your deployment settings
4. **Add each secret** with the values from your chosen provider:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

5. **Redeploy your app** after adding the secrets

### Step 3: Test Production Login

1. Visit your production URL (e.g., chatapp.churumuru.com)
2. Click "Get Started" or "Sign In"
3. Enter your email
4. Check your inbox for the OTP code
5. Enter the code to complete login

## 🔒 Other Required Secrets

Make sure these are also configured in production:

- `SESSION_SECRET`: A random string for session encryption (generate with: `openssl rand -hex 32`)
- `DATABASE_URL`: Your production database URL (usually auto-configured by Replit)

## 🐛 Troubleshooting

### "SMTP not configured" error
- Double-check all SMTP secrets are added in **production** environment
- Redeploy after adding secrets

### "Email authentication failed" error
- Verify SMTP_USER and SMTP_PASSWORD are correct
- For Gmail: Ensure you're using an App Password, not your regular password
- Check 2FA is enabled for Gmail

### "Unable to connect to email server" error
- Check SMTP_HOST and SMTP_PORT are correct
- Verify your network/firewall isn't blocking SMTP connections
- Try SMTP_PORT=465 with SMTP_SECURE=true for SSL

### Still having issues?
1. Check server logs in deployment dashboard
2. Verify all secrets are exactly as shown (no extra spaces)
3. Try testing with a different email address

## ✅ Development vs Production

| Environment | Configuration Location |
|-------------|----------------------|
| **Development** | Secrets tab in Replit workspace |
| **Production** | Deployment > Environment Variables |

Remember: Changes to development secrets don't affect production and vice versa!
