import express from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import expressRateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function rateLimit(windowMs, limit, message) {
  return expressRateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });
}

function validCollegeEmail(email) {
  return /^[^\s@]+@sst\.scaler\.com$/.test(email);
}

async function sendPasswordResetEmail(email, otp) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "UniMart";

  if (!apiKey || !senderEmail) {
    throw new Error("Brevo email configuration is missing");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject: "Reset your UniMart password",
      textContent: `Your UniMart password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px">
          <h2 style="color:#075c3b">Reset your UniMart password</h2>
          <p>Use this code to reset your password:</p>
          <h1 style="letter-spacing:8px;color:#16865a">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Brevo request failed: ${response.status}`);
  }
}

// CHANGE PASSWORD — requires an authenticated session
router.post(
  "/change-password",
  authenticateToken,
  rateLimit(15 * 60 * 1000, 5, "Too many password change attempts. Try again later."),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      if (newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({
          success: false,
          message: "New password must be between 8 and 128 characters",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, password: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }

      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from your current password",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to change password",
      });
    }
  }
);

// REQUEST PASSWORD RESET OTP
router.post(
  "/forgot-password",
  rateLimit(15 * 60 * 1000, 5, "Too many reset requests. Please try again later."),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "College email is required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!validCollegeEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid SST college email address",
        });
      }

      const genericMessage =
        "If an account exists for this email, a password reset code has been sent.";

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      // Do not reveal whether an account exists.
      if (!user) {
        return res.json({ success: true, message: genericMessage });
      }

      const existing = await prisma.passwordResetOtp.findUnique({
        where: { email: normalizedEmail },
      });

      if (
        existing &&
        Date.now() - existing.lastSentAt.getTime() < OTP_COOLDOWN_MS
      ) {
        return res.json({ success: true, message: genericMessage });
      }

      const otp = randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const now = new Date();

      await prisma.passwordResetOtp.upsert({
        where: { email: normalizedEmail },
        update: {
          otpHash,
          expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
          attempts: 0,
          lastSentAt: now,
        },
        create: {
          email: normalizedEmail,
          otpHash,
          expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
          attempts: 0,
          lastSentAt: now,
        },
      });

      try {
        await sendPasswordResetEmail(normalizedEmail, otp);
      } catch (mailError) {
        await prisma.passwordResetOtp.deleteMany({
          where: { email: normalizedEmail, otpHash },
        });
        console.error("Password reset email error:", mailError);

        return res.status(500).json({
          success: false,
          message: "Unable to send reset email. Please try again later.",
        });
      }

      return res.json({ success: true, message: genericMessage });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to process password reset",
      });
    }
  }
);

// VERIFY OTP AND RESET PASSWORD
router.post(
  "/reset-password",
  rateLimit(15 * 60 * 1000, 10, "Too many password reset attempts. Try again later."),
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (
        typeof email !== "string" ||
        typeof otp !== "string" ||
        typeof newPassword !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Email, verification code, and new password are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!validCollegeEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid SST college email address",
        });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 6-digit verification code",
        });
      }

      if (newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({
          success: false,
          message: "New password must be between 8 and 128 characters",
        });
      }

      const reset = await prisma.passwordResetOtp.findUnique({
        where: { email: normalizedEmail },
      });

      if (!reset) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset code. Request a new one.",
        });
      }

      if (reset.expiresAt <= new Date()) {
        await prisma.passwordResetOtp.deleteMany({
          where: { email: normalizedEmail, expiresAt: { lte: new Date() } },
        });

        return res.status(400).json({
          success: false,
          message: "Reset code expired. Request a new one.",
        });
      }

      if (reset.attempts >= MAX_OTP_ATTEMPTS) {
        await prisma.passwordResetOtp.deleteMany({
          where: { email: normalizedEmail, attempts: { gte: MAX_OTP_ATTEMPTS } },
        });

        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Request a new code.",
        });
      }

      if (!(await bcrypt.compare(otp, reset.otpHash))) {
        await prisma.passwordResetOtp.updateMany({
          where: {
            email: normalizedEmail,
            otpHash: reset.otpHash,
            attempts: reset.attempts,
            expiresAt: { gt: new Date() },
          },
          data: { attempts: { increment: 1 } },
        });

        await prisma.passwordResetOtp.deleteMany({
          where: {
            email: normalizedEmail,
            attempts: { gte: MAX_OTP_ATTEMPTS },
          },
        });

        return res.status(400).json({
          success: false,
          message: "Incorrect verification code",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.passwordResetOtp.deleteMany({
          where: {
            email: normalizedEmail,
            otpHash: reset.otpHash,
            expiresAt: { gt: new Date() },
            attempts: { lt: MAX_OTP_ATTEMPTS },
          },
        });

        if (claimed.count !== 1) return false;

        const user = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });

        if (!user) return false;

        await tx.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });

        return true;
      });

      if (!updated) {
        return res.status(400).json({
          success: false,
          message: "Reset code is no longer valid. Request a new one.",
        });
      }

      return res.json({
        success: true,
        message: "Password reset successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to reset password",
      });
    }
  }
);

export default router;
