import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    report: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    warning: {
      create: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const JWT_SECRET = "unimart-test-secret";

const owner = {
  id: "owner-1",
  email: "owner@sst.scaler.com",
  role: "OWNER",
  suspendedAt: null,
};

const student = {
  id: "student-1",
  name: "Test Student",
  email: "student@sst.scaler.com",
  role: "STUDENT",
  suspendedAt: null,
  suspensionReason: null,
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
};

const createToken = () =>
  jwt.sign(
    { userId: "owner-1" },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

const auth = () => ({
  Authorization: `Bearer ${createToken()}`,
});

describe("UniMart admin read routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    prisma.user.findUnique.mockResolvedValue(owner);

    prisma.user.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValue(0);
    prisma.report.count.mockResolvedValue(0);

    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);

    prisma.product.findMany.mockResolvedValue([]);
    prisma.report.findMany.mockResolvedValue([]);

    prisma.adminAction.findMany.mockResolvedValue([]);
    prisma.adminAction.count.mockResolvedValue(0);
  });

  describe("Dashboard overview", () => {
    it("returns dashboard statistics and recent admin actions", async () => {
      prisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(90)
        .mockResolvedValueOnce(10);

      prisma.product.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(35)
        .mockResolvedValueOnce(5);

      prisma.report.count.mockResolvedValueOnce(4);

      prisma.adminAction.findMany.mockResolvedValueOnce([
        {
          id: "action-1",
          action: "USER_SUSPENDED",
          actor: owner,
          targetUser: student,
          targetProduct: null,
        },
      ]);

      const response = await request(app)
        .get("/api/admin/overview")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.overview).toEqual({
        totalUsers: 100,
        activeUsers: 90,
        suspendedUsers: 10,
        totalListings: 50,
        activeListings: 35,
        hiddenListings: 5,
        pendingReports: 4,
      });

      expect(response.body.recentActions).toHaveLength(1);

      expect(prisma.adminAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("Student list and search", () => {
    it("returns students with pagination", async () => {
      prisma.user.findMany.mockResolvedValueOnce([student]);
      prisma.user.count.mockResolvedValueOnce(21);

      const response = await request(app)
        .get("/api/admin/users?page=2&limit=10")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toHaveLength(1);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "STUDENT" },
          skip: 10,
          take: 10,
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("searches students by name or email", async () => {
      prisma.user.findMany.mockResolvedValueOnce([student]);
      prisma.user.count.mockResolvedValueOnce(1);

      const response = await request(app)
        .get("/api/admin/users?search=student")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: "STUDENT",
            OR: [
              {
                name: {
                  contains: "student",
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: "student",
                  mode: "insensitive",
                },
              },
            ],
          },
        })
      );
    });
  });

  describe("Student details", () => {
    it("returns student details, listings and warning history", async () => {
      const detailedStudent = {
        ...student,
        products: [
          {
            id: "product-1",
            title: "Used Calculator",
            price: 500,
            status: "AVAILABLE",
            moderationStatus: "ACTIVE",
          },
        ],
        receivedWarnings: [
          {
            id: "warning-1",
            message: "Please follow marketplace rules.",
            reason: "Repeated policy violations",
            issuedBy: {
              name: "Owner",
              email: owner.email,
            },
          },
        ],
        _count: {
          submittedReports: 1,
          reportsAgainst: 2,
        },
      };

      prisma.user.findFirst.mockResolvedValueOnce(detailedStudent);

      const response = await request(app)
        .get("/api/admin/users/student-1")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe("student-1");
      expect(response.body.user.products).toHaveLength(1);
      expect(response.body.user.receivedWarnings).toHaveLength(1);
      expect(response.body.user._count.reportsAgainst).toBe(2);

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "student-1",
            role: "STUDENT",
          },
        })
      );
    });

    it("returns 404 when the requested student does not exist", async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/admin/users/missing-student")
        .set(auth());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Student not found");
    });
  });

  describe("Listing management", () => {
    it("returns listings filtered by moderation status", async () => {
      const listing = {
        id: "product-1",
        title: "Used Calculator",
        moderationStatus: "HIDDEN",
        seller: student,
      };

      prisma.product.findMany.mockResolvedValueOnce([listing]);
      prisma.product.count.mockResolvedValueOnce(1);

      const response = await request(app)
        .get("/api/admin/listings?status=HIDDEN&page=1&limit=10")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.listings).toHaveLength(1);
      expect(response.body.listings[0].moderationStatus).toBe("HIDDEN");

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moderationStatus: "HIDDEN" },
          skip: 0,
          take: 10,
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("Report management", () => {
    it("returns reports filtered by status", async () => {
      const report = {
        id: "report-1",
        reason: "Suspicious listing",
        status: "PENDING",
        reporter: student,
        reportedUser: student,
        product: {
          id: "product-1",
          title: "Used Calculator",
          moderationStatus: "ACTIVE",
        },
      };

      prisma.report.findMany.mockResolvedValueOnce([report]);
      prisma.report.count.mockResolvedValueOnce(1);

      const response = await request(app)
        .get("/api/admin/reports?status=PENDING")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reports).toHaveLength(1);
      expect(response.body.reports[0].status).toBe("PENDING");

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING" },
          skip: 0,
          take: 20,
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("Admin activity log", () => {
    it("returns recent admin actions with pagination", async () => {
      const action = {
        id: "action-1",
        action: "USER_SUSPENDED",
        reason: "Repeated policy violations",
        actor: owner,
        targetUser: student,
        targetProduct: null,
        createdAt: new Date("2026-11-04T10:00:00.000Z"),
      };

      prisma.adminAction.findMany.mockResolvedValueOnce([action]);
      prisma.adminAction.count.mockResolvedValueOnce(31);

      const response = await request(app)
        .get("/api/admin/activity?page=2&limit=10")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.actions).toHaveLength(1);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 31,
        totalPages: 4,
      });

      expect(prisma.adminAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });
});