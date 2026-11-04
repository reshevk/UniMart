
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
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    report: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
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
  email: "student@sst.scaler.com",
  role: "STUDENT",
  suspendedAt: null,
};

const product = {
  id: "product-1",
  moderationStatus: "ACTIVE",
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

describe("UniMart successful admin operations", () => {
  let transaction;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === "owner-1") {
        return Promise.resolve(owner);
      }

      if (where.id === "student-1") {
        return Promise.resolve(student);
      }

      return Promise.resolve(null);
    });

    prisma.product.findUnique.mockResolvedValue(product);

    transaction = {
      user: {
        update: vi.fn().mockResolvedValue(student),
      },
      product: {
        update: vi.fn().mockResolvedValue(product),
      },
      warning: {
        create: vi.fn().mockResolvedValue({
          id: "warning-1",
          message: "Please follow marketplace rules.",
          reason: "Repeated policy violations",
          userId: "student-1",
          issuedById: "owner-1",
        }),
      },
      report: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          reportedUserId: "student-1",
          productId: "product-1",
        }),
      },
      adminAction: {
        create: vi.fn().mockResolvedValue({ id: "action-1" }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(transaction);
    });
  });

  describe("Student suspension and restoration", () => {
    it("suspends a student and records the audit action", async () => {
      const response = await request(app)
        .patch("/api/admin/users/student-1/suspend")
        .set(auth())
        .send({
          reason: "Repeated policy violations",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(transaction.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "student-1" },
          data: expect.objectContaining({
            suspensionReason: "Repeated policy violations",
            suspendedAt: expect.any(Date),
          }),
        })
      );

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "USER_SUSPENDED",
          reason: "Repeated policy violations",
          actorId: "owner-1",
          targetUserId: "student-1",
        }),
      });
    });

    it("restores a suspended student and records the audit action", async () => {
      prisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === "owner-1") {
          return Promise.resolve(owner);
        }

        return Promise.resolve({
          ...student,
          suspendedAt: new Date(),
        });
      });

      const response = await request(app)
        .patch("/api/admin/users/student-1/restore")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(transaction.user.update).toHaveBeenCalledWith({
        where: { id: "student-1" },
        data: {
          suspendedAt: null,
          suspensionReason: null,
        },
      });

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "USER_RESTORED",
          actorId: "owner-1",
          targetUserId: "student-1",
        }),
      });
    });
  });

  describe("Official warnings", () => {
    it("issues a warning and records the audit action", async () => {
      const response = await request(app)
        .post("/api/admin/users/student-1/warnings")
        .set(auth())
        .send({
          message: "Please follow the marketplace rules.",
          reason: "Repeated policy violations",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.warning.id).toBe("warning-1");

      expect(transaction.warning.create).toHaveBeenCalledWith({
        data: {
          message: "Please follow the marketplace rules.",
          reason: "Repeated policy violations",
          userId: "student-1",
          issuedById: "owner-1",
        },
      });

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "WARNING_ISSUED",
          actorId: "owner-1",
          targetUserId: "student-1",
        }),
      });
    });
  });

  describe("Listing moderation", () => {
    it("hides a listing and records the audit action", async () => {
      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set(auth())
        .send({
          status: "HIDDEN",
          reason: "Listing violates marketplace rules",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(transaction.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "product-1" },
          data: expect.objectContaining({
            moderationStatus: "HIDDEN",
            moderationReason: "Listing violates marketplace rules",
            moderatedAt: expect.any(Date),
          }),
        })
      );

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LISTING_HIDDEN",
          actorId: "owner-1",
          targetProductId: "product-1",
        }),
      });
    });

    it("restores a hidden listing and clears its moderation reason", async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: "product-1",
        moderationStatus: "HIDDEN",
      });

      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set(auth())
        .send({
          status: "ACTIVE",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(transaction.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "product-1" },
          data: expect.objectContaining({
            moderationStatus: "ACTIVE",
            moderationReason: null,
            moderatedAt: expect.any(Date),
          }),
        })
      );

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LISTING_ACTIVE",
          actorId: "owner-1",
          targetProductId: "product-1",
        }),
      });
    });

    it("removes a listing and records the audit action", async () => {
      const response = await request(app)
        .patch("/api/admin/listings/product-1/moderation")
        .set(auth())
        .send({
          status: "REMOVED",
          reason: "Prohibited listing",
        });

      expect(response.status).toBe(200);

      expect(transaction.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moderationStatus: "REMOVED",
            moderationReason: "Prohibited listing",
          }),
        })
      );

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "LISTING_REMOVED",
          actorId: "owner-1",
          targetProductId: "product-1",
        }),
      });
    });
  });

  describe("Report review", () => {
    it("reviews a report and records the audit action", async () => {
      const response = await request(app)
        .patch("/api/admin/reports/report-1")
        .set(auth())
        .send({
          status: "ACTION_TAKEN",
          resolution: "The reported listing was removed.",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(transaction.report.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "report-1",
            status: "PENDING",
          },
          data: expect.objectContaining({
            status: "ACTION_TAKEN",
            reviewedBy: "owner-1",
            resolution: "The reported listing was removed.",
            reviewedAt: expect.any(Date),
          }),
        })
      );

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "REPORT_ACTION_TAKEN",
          actorId: "owner-1",
          targetUserId: "student-1",
          targetProductId: "product-1",
        }),
      });
    });

    it("does not create an audit action when a report was already reviewed", async () => {
      transaction.report.updateMany.mockResolvedValue({ count: 0 });
      transaction.report.findUnique.mockResolvedValue({
        id: "report-1",
      });

      const response = await request(app)
        .patch("/api/admin/reports/report-1")
        .set(auth())
        .send({
          status: "REVIEWED",
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        "Report has already been reviewed"
      );

      expect(transaction.adminAction.create).not.toHaveBeenCalled();
    });
  });
});
