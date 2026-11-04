
import expressRateLimit from "express-rate-limit";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

function rateLimit(windowMs, maxRequests, message) {
  return expressRateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "7d",
    }
  );
}

async function sendVerificationEmail(email, otp) {
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
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email }],
      subject: "Your UniMart verification code",
      textContent: `Your UniMart verification code is ${otp}. It expires in 10 minutes.`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px;">
          <h2 style="color: #075c3b;">Welcome to UniMart!</h2>
          <p>Use this code to verify your SST student email address:</p>
          <h1 style="letter-spacing: 8px; color: #16865a;">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Brevo API request failed with status ${response.status}: ${errorBody}`
    );
  }
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
      subject: "Your UniMart password reset code",
      textContent: `Your UniMart password reset code is ${otp}. It expires in 10 minutes.`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px;">
          <h2 style="color: #075c3b;">Reset your UniMart password</h2>
          <p>Use this code to reset your password:</p>
          <h1 style="letter-spacing: 8px; color: #16865a;">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API request failed with status ${response.status}: ${errorBody}`);
  }
}

// SEND REGISTRATION OTP
router.post(
  "/register",
  rateLimit(
    15 * 60 * 1000,
    5,
    "Too many registration requests. Please try again later."
  ),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@sst\.scaler\.com$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Only valid SST student email addresses are allowed",
        });
      }

      if (password.length < 8 || password.length > 128) {
        return res.status(400).json({
          success: false,
          message: "Password must be between 8 and 128 characters",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered",
        });
      }

      const existingPending = await prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
      });

      if (
        existingPending &&
        Date.now() - existingPending.lastSentAt.getTime() < 60 * 1000
      ) {
        return res.status(429).json({
          success: false,
          message: "Please wait 60 seconds before requesting another OTP",
        });
      }

      const otp = randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const hashedPassword = await bcrypt.hash(password, 10);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.pendingRegistration.upsert({
        where: { email: normalizedEmail },
        update: {
          name: name.trim(),
          password: hashedPassword,
          otpHash,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
        },
        create: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          otpHash,
          expiresAt,
        },
      });

      try {
        await sendVerificationEmail(normalizedEmail, otp);
      } catch (mailError) {
        await prisma.pendingRegistration.deleteMany({
          where: {
            email: normalizedEmail,
            otpHash,
          },
        });

        console.error("OTP email error:", mailError);

        return res.status(500).json({
          success: false,
          message: "Unable to send verification email. Please try again later.",
        });
      }

      return res.json({
        success: true,
        message: "Verification code sent to your college email",
      });
    } catch (error) {
      console.error("Registration OTP error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to start registration",
      });
    }
  }
);

// VERIFY OTP AND CREATE ACCOUNT
router.post(
  "/verify-email",
  rateLimit(
    15 * 60 * 1000,
    10,
    "Too many verification requests. Please try again later."
  ),
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (
        typeof email !== "string" ||
        typeof otp !== "string" ||
        !email.trim() ||
        !otp
      ) {
        return res.status(400).json({
          success: false,
          message: "Email and verification code are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 6-digit verification code",
        });
      }

      const pending = await prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
      });

      if (!pending) {
        return res.status(404).json({
          success: false,
          message: "No pending registration found. Please register again.",
        });
      }

      if (pending.expiresAt <= new Date()) {
        await prisma.pendingRegistration.deleteMany({
          where: {
            email: normalizedEmail,
            expiresAt: { lte: new Date() },
          },
        });

        return res.status(400).json({
          success: false,
          message: "Verification code expired. Please register again.",
        });
      }

      if (pending.attempts >= 5) {
        await prisma.pendingRegistration.deleteMany({
          where: {
            email: normalizedEmail,
            attempts: { gte: 5 },
          },
        });

        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Please register again.",
        });
      }

      const otpMatches = await bcrypt.compare(otp, pending.otpHash);

      if (!otpMatches) {
        const attemptUpdate = await prisma.pendingRegistration.updateMany({
          where: {
            email: normalizedEmail,
            otpHash: pending.otpHash,
            expiresAt: { gt: new Date() },
            AND: [
              { attempts: pending.attempts },
              { attempts: { lt: 5 } },
            ],
          },
          data: {
            attempts: { increment: 1 },
          },
        });

        if (attemptUpdate.count === 0) {
          const currentPending =
            await prisma.pendingRegistration.findUnique({
              where: { email: normalizedEmail },
            });

          if (!currentPending) {
            return res.status(404).json({
              success: false,
              message: "Registration expired or already completed.",
            });
          }

          if (
            currentPending.expiresAt <= new Date() ||
            currentPending.attempts >= 5
          ) {
            await prisma.pendingRegistration.deleteMany({
              where: {
                email: normalizedEmail,
                OR: [
                  { expiresAt: { lte: new Date() } },
                  { attempts: { gte: 5 } },
                ],
              },
            });

            return res.status(429).json({
              success: false,
              message: "Too many attempts or verification code expired. Please register again.",
            });
          }
        } else if (pending.attempts + 1 >= 5) {
          await prisma.pendingRegistration.deleteMany({
            where: {
              email: normalizedEmail,
              attempts: { gte: 5 },
            },
          });
        }

        return res.status(400).json({
          success: false,
          message: "Incorrect verification code",
        });
      }

      const user = await prisma.$transaction(async (tx) => {
        const claimed = await tx.pendingRegistration.deleteMany({
          where: {
            email: normalizedEmail,
            otpHash: pending.otpHash,
            expiresAt: { gt: new Date() },
            attempts: { lt: 5 },
          },
        });

        if (claimed.count !== 1) {
          return null;
        }

        return tx.user.create({
          data: {
            name: pending.name,
            email: pending.email,
            password: pending.password,
            emailVerified: true,
          },
        });
      });

      if (!user) {
        return res.status(409).json({
          success: false,
          message: "Verification code was already used or is no longer valid. Please register again.",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Email verified! Your account has been created.",
        token: createToken(user),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Email verification error:", error);

      return res.status(500).json({
        success: false,
        message: "Email verification failed",
      });
    }
  }
);

// LOGIN
router.post(
  "/login",
  rateLimit(
    15 * 60 * 1000,
    10,
    "Too many login attempts. Please try again later."
  ),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: "Please verify your college email before logging in",
        });
      }

      if (user.suspendedAt) {
        return res.status(403).json({
          success: false,
          message:
            "Your account has been suspended. Please contact the administrator.",
        });
      }

      return res.json({
        success: true,
        message: "Login successful",
        token: createToken(user),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }
  }
);


// CHANGE PASSWORD — authenticated users only
router.post(
  "/change-password",
  authenticateToken,
  rateLimit(15 * 60 * 1000, 5, "Too many password change attempts. Please try again later."),
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
      });

      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
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

// SEND PASSWORD RESET OTP
router.post(
  "/forgot-password",
  rateLimit(15 * 60 * 1000, 5, "Too many password reset requests. Please try again later."),
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

      if (!/^[^\s@]+@sst\.scaler\.com$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid SST student email address",
        });
      }

      const genericResponse = {
        success: true,
        message: "If an account exists for this email, a password reset code has been sent.",
      };

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (!user) {
        return res.json(genericResponse);
      }

      const existing = await prisma.passwordResetOtp.findUnique({
        where: { email: normalizedEmail },
      });

      if (
        existing &&
        Date.now() - existing.lastSentAt.getTime() < 60 * 1000
      ) {
        return res.json(genericResponse);
      }

      const otp = randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const now = new Date();

      await prisma.passwordResetOtp.upsert({
        where: { email: normalizedEmail },
        update: {
          otpHash,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          attempts: 0,
          lastSentAt: now,
        },
        create: {
          email: normalizedEmail,
          otpHash,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
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
      }

      return res.json(genericResponse);
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to process password reset request",
      });
    }
  }
);

// VERIFY OTP AND RESET PASSWORD
router.post(
  "/reset-password",
  rateLimit(15 * 60 * 1000, 10, "Too many password reset attempts. Please try again later."),
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (
        typeof email !== "string" ||
        typeof otp !== "string" ||
        typeof newPassword !== "string" ||
        !email.trim() ||
        !otp ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Email, verification code, and new password are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@sst\.scaler\.com$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid SST student email address",
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
          message: "Password must be between 8 and 128 characters",
        });
      }

      const resetRecord = await prisma.passwordResetOtp.findUnique({
        where: { email: normalizedEmail },
      });

      if (!resetRecord) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification code. Request a new code.",
        });
      }

      if (
        resetRecord.expiresAt <= new Date() ||
        resetRecord.attempts >= 5
      ) {
        await prisma.passwordResetOtp.deleteMany({
          where: { email: normalizedEmail },
        });

        return res.status(400).json({
          success: false,
          message: "Verification code expired or attempts exceeded. Request a new code.",
        });
      }

      const otpMatches = await bcrypt.compare(otp, resetRecord.otpHash);

      if (!otpMatches) {
        const updated = await prisma.passwordResetOtp.updateMany({
          where: {
            email: normalizedEmail,
            otpHash: resetRecord.otpHash,
            expiresAt: { gt: new Date() },
            AND: [
              { attempts: resetRecord.attempts },
              { attempts: { lt: 5 } },
            ],
          },
          data: { attempts: { increment: 1 } },
        });

        if (updated.count && resetRecord.attempts + 1 >= 5) {
          await prisma.passwordResetOtp.deleteMany({
            where: {
              email: normalizedEmail,
              attempts: { gte: 5 },
            },
          });
        }

        return res.status(400).json({
          success: false,
          message: "Incorrect verification code",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.passwordResetOtp.deleteMany({
          where: {
            email: normalizedEmail,
            otpHash: resetRecord.otpHash,
            expiresAt: { gt: new Date() },
            attempts: { lt: 5 },
          },
        });

        if (claimed.count !== 1) {
          return false;
        }

        const updatedUser = await tx.user.updateMany({
          where: { email: normalizedEmail },
          data: { password: hashedPassword },
        });

        return updatedUser.count === 1;
      });

      if (!result) {
        return res.status(400).json({
          success: false,
          message: "Verification code is invalid or expired. Request a new code.",
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
