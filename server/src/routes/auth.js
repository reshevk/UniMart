
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

// In-memory rate limiter
const rateLimitStore = new Map();

function rateLimit(windowMs, maxRequests, message) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.path}:${req.ip}`;

    for (const [storedKey, value] of rateLimitStore) {
      if (now - value.startTime >= windowMs) {
        rateLimitStore.delete(storedKey);
      }
    }

    let record = rateLimitStore.get(key);

    if (!record || now - record.startTime >= windowMs) {
      record = {
        startTime: now,
        count: 0,
      };
    }

    record.count++;

    rateLimitStore.set(key, record);

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil(
        (windowMs - (now - record.startTime)) / 1000
      );

      res.set("Retry-After", String(retryAfter));

      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
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

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
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
        await transporter.sendMail({
          from: `"UniMart" <${process.env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: "Your UniMart verification code",
          text: `Your UniMart verification code is ${otp}. It expires in 10 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px;">
              <h2 style="color: #075c3b;">Welcome to UniMart!</h2>
              <p>Use this code to verify your SST student email address:</p>
              <h1 style="letter-spacing: 8px; color: #16865a;">${otp}</h1>
              <p>This code expires in 10 minutes.</p>
              <p>If you did not request this code, you can ignore this email.</p>
            </div>
          `,
        });
      } catch (mailError) {
        await prisma.pendingRegistration.deleteMany({
          where: { email: normalizedEmail },
        });

        console.error("OTP email error:", mailError);

        return res.status(500).json({
          success: false,
          message: "Unable to send verification email. Please try again later.",
        });
      }

      res.json({
        success: true,
        message: "Verification code sent to your college email",
      });
    } catch (error) {
      console.error("Registration OTP error:", error);

      res.status(500).json({
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

      if (pending.expiresAt < new Date()) {
        await prisma.pendingRegistration.delete({
          where: { email: normalizedEmail },
        });

        return res.status(400).json({
          success: false,
          message: "Verification code expired. Please register again.",
        });
      }

      if (pending.attempts >= 5) {
        await prisma.pendingRegistration.delete({
          where: { email: normalizedEmail },
        });

        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Please register again.",
        });
      }

      const otpMatches = await bcrypt.compare(otp, pending.otpHash);

      if (!otpMatches) {
        const updatedAttempts = pending.attempts + 1;

        if (updatedAttempts >= 5) {
          await prisma.pendingRegistration.delete({
            where: { email: normalizedEmail },
          });
        } else {
          await prisma.pendingRegistration.update({
            where: { email: normalizedEmail },
            data: { attempts: updatedAttempts },
          });
        }

        return res.status(400).json({
          success: false,
          message: "Incorrect verification code",
        });
      }

      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: pending.name,
            email: pending.email,
            password: pending.password,
            emailVerified: true,
          },
        });

        await tx.pendingRegistration.delete({
          where: { email: normalizedEmail },
        });

        return createdUser;
      });

      res.status(201).json({
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

      res.status(500).json({
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

      res.json({
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

      res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }
  }
);

export default router;
