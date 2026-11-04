import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    pendingRegistration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const JWT_SECRET = "unimart-test-secret";

describe("UniMart authentication and security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe("Registration validation", () => {
    it("rejects registration with missing fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test Student" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("All fields are required");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects email addresses outside the college domain", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Student",
          email: "student@gmail.com",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Only valid SST student email addresses are allowed"
      );
    });

    it("rejects passwords shorter than 8 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Student",
          email: "student@sst.scaler.com",
          password: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Password must be between 8 and 128 characters"
      );
    });

    it("rejects passwords longer than 128 characters", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Student",
          email: "student@sst.scaler.com",
          password: "a".repeat(129),
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Password must be between 8 and 128 characters"
      );
    });

    it("rejects an already registered email", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "existing-user",
        email: "student@sst.scaler.com",
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Student",
          email: "student@sst.scaler.com",
          password: "password123",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Email is already registered");
    });
  });

  describe("Email verification validation", () => {
    it("rejects missing email or OTP", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ email: "student@sst.scaler.com" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Email and verification code are required"
      );
    });

    it("rejects an OTP that is not six digits", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({
          email: "student@sst.scaler.com",
          otp: "123",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Enter a valid 6-digit verification code"
      );

      expect(prisma.pendingRegistration.findUnique).not.toHaveBeenCalled();
    });

    it("rejects verification when no pending registration exists", async () => {
      prisma.pendingRegistration.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({
          email: "student@sst.scaler.com",
          otp: "123456",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "No pending registration found. Please register again."
      );
    });
  });

  describe("Login validation", () => {
    it("rejects missing login credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "student@sst.scaler.com" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Email and password are required"
      );
    });

    it("rejects an incorrect password", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "student-1",
        email: "student@sst.scaler.com",
        password: "$2b$10$invalidhashforpasswordcomparison",
        emailVerified: true,
        suspendedAt: null,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "student@sst.scaler.com",
          password: "wrongpassword",
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects login for an unverified account", async () => {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("password123", 4);

      prisma.user.findUnique.mockResolvedValue({
        id: "student-1",
        email: "student@sst.scaler.com",
        password: passwordHash,
        emailVerified: false,
        suspendedAt: null,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "student@sst.scaler.com",
          password: "password123",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Please verify your college email before logging in"
      );
    });

    it("rejects login for a suspended account", async () => {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("password123", 4);

      prisma.user.findUnique.mockResolvedValue({
        id: "student-1",
        email: "student@sst.scaler.com",
        password: passwordHash,
        emailVerified: true,
        suspendedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "student@sst.scaler.com",
          password: "password123",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain(
        "Your account has been suspended"
      );
    });
  });

  describe("JWT authentication", () => {
    it("rejects requests without an authorization token", async () => {
      const response = await request(app).get(
        "/api/chat/conversations"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Authentication required");
    });

    it("rejects an invalid JWT", async () => {
      const response = await request(app)
        .get("/api/chat/conversations")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid or expired token");
    });

    it("rejects an expired JWT", async () => {
      const token = jwt.sign(
        { userId: "student-1" },
        JWT_SECRET,
        {
          algorithm: "HS256",
          expiresIn: -1,
        }
      );

      const response = await request(app)
        .get("/api/chat/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid or expired token");
    });

    it("rejects a valid token when the account no longer exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const token = jwt.sign(
        { userId: "deleted-user" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/chat/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Account no longer exists");
    });

    it("rejects protected requests from suspended accounts", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "student-1",
        email: "student@sst.scaler.com",
        role: "STUDENT",
        suspendedAt: new Date(),
      });

      const token = jwt.sign(
        { userId: "student-1" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/chat/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Your account has been suspended"
      );
    });
  });
});