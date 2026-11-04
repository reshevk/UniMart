
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    report: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const JWT_SECRET = "unimart-test-secret";

function token(userId = "student-1") {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );
}

const validListingReport = {
  targetType: "LISTING",
  productId: "product-1",
  reason: "Scam or fraud",
  description: "The seller appears to be misleading buyers.",
};

describe("Student report submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === "student-1") {
        return Promise.resolve({
          id: "student-1",
          role: "STUDENT",
          email: "student@sst.scaler.com",
          suspendedAt: null,
        });
      }

      if (where.id === "seller-1") {
        return Promise.resolve({
          id: "seller-1",
          role: "STUDENT",
        });
      }

      return Promise.resolve(null);
    });

    prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      sellerId: "seller-1",
    });

    prisma.report.findFirst.mockResolvedValue(null);

    prisma.report.create.mockResolvedValue({
      id: "report-1",
      reason: "Scam or fraud",
      description: validListingReport.description,
      status: "PENDING",
      createdAt: new Date(),
    });
  });

  it("rejects report submission without authentication", async () => {
    const response = await request(app)
      .post("/api/reports")
      .send(validListingReport);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("rejects an invalid report target type", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        ...validListingReport,
        targetType: "INVALID",
      });

    expect(response.status).toBe(400);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid report reason", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        ...validListingReport,
        reason: "Something made up",
      });

    expect(response.status).toBe(400);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("rejects descriptions longer than 1000 characters", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        ...validListingReport,
        description: "a".repeat(1001),
      });

    expect(response.status).toBe(400);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("rejects reports for listings that do not exist", async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send(validListingReport);

    expect(response.status).toBe(404);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("prevents students from reporting their own listing", async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      sellerId: "student-1",
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send(validListingReport);

    expect(response.status).toBe(403);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("prevents duplicate pending reports for the same listing", async () => {
    prisma.report.findFirst.mockResolvedValue({
      id: "existing-report",
    });

    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send(validListingReport);

    expect(response.status).toBe(409);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("successfully submits a listing report", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send(validListingReport);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: "student-1",
          productId: "product-1",
          reason: "Scam or fraud",
          description: validListingReport.description,
        }),
      })
    );
  });

  it("successfully submits a seller report", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        targetType: "USER",
        reportedUserId: "seller-1",
        reason: "Harassment or abusive behaviour",
        description: "The seller sent abusive messages.",
      });

    expect(response.status).toBe(201);

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: "student-1",
          reportedUserId: "seller-1",
          reason: "Harassment or abusive behaviour",
        }),
      })
    );
  });

  it("prevents students from reporting themselves", async () => {
    const response = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        targetType: "USER",
        reportedUserId: "student-1",
        reason: "Other",
      });

    expect(response.status).toBe(403);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });
});
