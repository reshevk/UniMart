import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    warning: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const JWT_SECRET = "unimart-test-secret";

const student = {
  id: "student-1",
  email: "student@sst.scaler.com",
  role: "STUDENT",
  suspendedAt: null,
};

const createToken = () =>
  jwt.sign(
    { userId: "student-1" },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

const auth = () => ({
  Authorization: `Bearer ${createToken()}`,
});

describe("UniMart student warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.JWT_SECRET = JWT_SECRET;

    prisma.user.findUnique.mockResolvedValue(student);

    prisma.warning.findMany.mockResolvedValue([]);
    prisma.warning.updateMany.mockResolvedValue({ count: 1 });
    prisma.warning.findFirst.mockResolvedValue(null);
  });

  describe("GET /api/warnings", () => {
    it("returns the logged-in student's warnings", async () => {
      prisma.warning.findMany.mockResolvedValue([
        {
          id: "warning-1",
          message: "Please follow marketplace rules.",
          reason: "Repeated policy violations",
          acknowledgedAt: null,
          issuedBy: {
            name: "Owner",
          },
        },
        {
          id: "warning-2",
          message: "Please follow the listing guidelines.",
          reason: "Incorrect listing information",
          acknowledgedAt: new Date(),
          issuedBy: {
            name: "Owner",
          },
        },
      ]);

      const response = await request(app)
        .get("/api/warnings")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.warnings).toHaveLength(2);
      expect(response.body.unreadCount).toBe(1);

      expect(prisma.warning.findMany).toHaveBeenCalledWith({
        where: {
          userId: "student-1",
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          issuedBy: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    it("returns zero unread warnings when all are acknowledged", async () => {
      prisma.warning.findMany.mockResolvedValue([
        {
          id: "warning-1",
          acknowledgedAt: new Date(),
        },
        {
          id: "warning-2",
          acknowledgedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get("/api/warnings")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.unreadCount).toBe(0);
    });

    it("does not return warnings belonging to another student", async () => {
      const response = await request(app)
        .get("/api/warnings")
        .set(auth());

      expect(response.status).toBe(200);

      expect(prisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: "student-1",
          },
        })
      );
    });
  });

  describe("PATCH /api/warnings/:id/acknowledge", () => {
    it("successfully acknowledges a warning", async () => {
      const response = await request(app)
        .patch("/api/warnings/warning-1/acknowledge")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(prisma.warning.updateMany).toHaveBeenCalledWith({
        where: {
          id: "warning-1",
          userId: "student-1",
          acknowledgedAt: null,
        },
        data: {
          acknowledgedAt: expect.any(Date),
        },
      });
    });

    it("returns 404 when the warning does not exist or belongs to another student", async () => {
      prisma.warning.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.warning.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/warnings/missing-warning/acknowledge")
        .set(auth());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Warning not found");

      expect(prisma.warning.findFirst).toHaveBeenCalledWith({
        where: {
          id: "missing-warning",
          userId: "student-1",
        },
        select: {
          id: true,
          acknowledgedAt: true,
        },
      });
    });

    it("returns 409 when a warning has already been acknowledged", async () => {
      prisma.warning.updateMany.mockResolvedValue({
        count: 0,
      });

      prisma.warning.findFirst.mockResolvedValue({
        id: "warning-1",
        acknowledgedAt: new Date(),
      });

      const response = await request(app)
        .patch("/api/warnings/warning-1/acknowledge")
        .set(auth());

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Warning has already been acknowledged"
      );
    });
  });
});