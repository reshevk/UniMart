import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    report: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    adminAction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    warning: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const JWT_SECRET = "unimart-test-secret";

function createToken(userId = "owner-1") {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
}

describe("UniMart admin security and routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      email: "owner@sst.scaler.com",
      role: "OWNER",
      suspendedAt: null,
    });
  });

  describe("Owner-only access", () => {
    it("rejects access without a token", async () => {
      const response = await request(app).get("/api/admin/overview");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Authentication required");
    });

    it("rejects an invalid token", async () => {
      const response = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid or expired token");
    });

    it("rejects student accounts from admin routes", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "student-1",
        email: "student@sst.scaler.com",
        role: "STUDENT",
        suspendedAt: null,
      });

      const response = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", `Bearer ${createToken("student-1")}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Owner access required");
    });

    it("allows the owner to access the admin dashboard", async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.report.count.mockResolvedValue(0);
      prisma.adminAction.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/admin/overview")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.overview).toBeDefined();
      expect(response.body.recentActions).toEqual([]);
    });
  });

  describe("Student management validation", () => {
    it("rejects suspension with an invalid reason", async () => {
      const response = await request(app)
        .patch("/api/admin/users/student-1/suspend")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ reason: "ab" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Suspension reason must be between 3 and 500 characters"
      );


    });

    it("rejects suspension when the student does not exist", async () => {
      prisma.user.findUnique.mockImplementation(({ where }) => {
  if (where.id === "owner-1") {
    return Promise.resolve({
      id: "owner-1",
      email: "owner@sst.scaler.com",
      role: "OWNER",
      suspendedAt: null,
    });
  }

  return Promise.resolve(null);
});

      const response = await request(app)
        .patch("/api/admin/users/student-1/suspend")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ reason: "Repeated policy violations" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Student not found");
    });

    it("rejects issuing a warning with a short message", async () => {
      const response = await request(app)
        .post("/api/admin/users/student-1/warnings")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          message: "Too short",
          reason: "Policy violation",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Warning message must be between 10 and 1000 characters"
      );
    });

    it("rejects issuing a warning with an invalid reason", async () => {
      const response = await request(app)
        .post("/api/admin/users/student-1/warnings")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          message: "Please follow the marketplace rules.",
          reason: "ab",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Warning reason must be between 3 and 500 characters"
      );
    });
  });

  describe("Listing moderation validation", () => {
    it("rejects an invalid moderation status", async () => {
      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          status: "INVALID",
          reason: "Policy violation",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Status must be ACTIVE, HIDDEN or REMOVED"
      );
    });

    it("requires a reason when hiding a listing", async () => {
      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          status: "HIDDEN",
          reason: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Please provide a reason for this moderation action"
      );

      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it("rejects moderation when the listing does not exist", async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          status: "REMOVED",
          reason: "Prohibited item",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Listing not found");
    });

    it("rejects an invalid listing filter status", async () => {
      const response = await request(app)
        .get("/api/admin/listings?status=INVALID")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid moderation status");
    });
  });

  describe("Report management validation", () => {
    it("rejects an invalid report filter status", async () => {
      const response = await request(app)
        .get("/api/admin/reports?status=INVALID")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid report status");
    });

    it("rejects an invalid report review status", async () => {
      const response = await request(app)
        .patch("/api/admin/reports/report-1")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          status: "INVALID",
          resolution: "Reviewed",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Invalid report review status"
      );
    });

    it("rejects a report resolution longer than 1000 characters", async () => {
      const response = await request(app)
        .patch("/api/admin/reports/report-1")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({
          status: "REVIEWED",
          resolution: "a".repeat(1001),
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Resolution cannot exceed 1000 characters"
      );
    });
  });

  describe("Pagination", () => {
    it("uses safe default pagination for the user list", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("caps the requested page size at 50", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const response = await request(app)
        .get("/api/admin/users?page=2&limit=100")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(50);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        })
      );
    });
  });
});