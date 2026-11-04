import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    announcement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    announcementRead: {
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
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

const announcement = {
  id: "announcement-1",
  title: "Campus Update",
  message: "The marketplace will be available throughout the week.",
  isUrgent: false,
  isActive: true,
  publishedAt: new Date("2026-11-04T10:00:00.000Z"),
  createdAt: new Date("2026-11-04T10:00:00.000Z"),
  updatedAt: new Date("2026-11-04T10:00:00.000Z"),
  createdById: "owner-1",
};

const createToken = (userId) =>
  jwt.sign(
    { userId },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

const auth = (userId = "student-1") => ({
  Authorization: `Bearer ${createToken(userId)}`,
});

describe("UniMart announcement routes", () => {
  let transaction;
  let io;

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

    prisma.announcement.findMany.mockResolvedValue([]);
    prisma.announcement.findFirst.mockResolvedValue(null);
    prisma.announcement.findUnique.mockResolvedValue(announcement);
    prisma.announcement.count.mockResolvedValue(0);
    prisma.announcement.create.mockResolvedValue(announcement);
    prisma.announcement.update.mockResolvedValue({
      ...announcement,
      isActive: false,
    });

    prisma.announcementRead.createMany.mockResolvedValue({ count: 0 });
    prisma.announcementRead.upsert.mockResolvedValue({});
    prisma.adminAction.create.mockResolvedValue({ id: "action-1" });

    transaction = {
      announcement: {
        create: vi.fn().mockResolvedValue(announcement),
      },
      adminAction: {
        create: vi.fn().mockResolvedValue({ id: "action-1" }),
      },
    };

    prisma.$transaction.mockImplementation(async (operation) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }

      return operation(transaction);
    });

    io = {
      emit: vi.fn(),
    };

    app.set("io", io);
  });

  describe("Student announcement feed", () => {
    it("returns active announcements with the student's read status", async () => {
      const readAt = new Date("2026-11-04T11:00:00.000Z");

      prisma.announcement.findMany.mockResolvedValueOnce([
        {
          ...announcement,
          reads: [],
        },
        {
          ...announcement,
          id: "announcement-2",
          title: "Important Notice",
          isUrgent: true,
          reads: [{ readAt }],
        },
      ]);

      const response = await request(app)
        .get("/api/announcements")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.announcements).toHaveLength(2);

      expect(response.body.announcements[0].isRead).toBe(false);
      expect(response.body.announcements[0].readAt).toBeNull();

      expect(response.body.announcements[1].isRead).toBe(true);
      expect(response.body.announcements[1].readAt).toBe(
        readAt.toISOString()
      );

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          take: 100,
          include: {
            reads: {
              where: { userId: "student-1" },
              select: { readAt: true },
            },
          },
        })
      );
    });

    it("returns the unread announcement count for the logged-in student", async () => {
      prisma.announcement.count.mockResolvedValueOnce(4);

      const response = await request(app)
        .get("/api/announcements/unread-count")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        unreadCount: 4,
      });

      expect(prisma.announcement.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
          reads: {
            none: { userId: "student-1" },
          },
        },
      });
    });
  });

  describe("Marking announcements as read", () => {
    it("marks one active announcement as read", async () => {
      prisma.announcement.findFirst.mockResolvedValueOnce({
        id: "announcement-1",
      });

      const response = await request(app)
        .patch("/api/announcements/announcement-1/read")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(prisma.announcementRead.upsert).toHaveBeenCalledWith({
        where: {
          announcementId_userId: {
            announcementId: "announcement-1",
            userId: "student-1",
          },
        },
        update: {},
        create: {
          announcementId: "announcement-1",
          userId: "student-1",
        },
      });
    });

    it("returns 404 when the announcement is missing or archived", async () => {
      prisma.announcement.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .patch("/api/announcements/missing-announcement/read")
        .set(auth());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Announcement not found");

      expect(prisma.announcementRead.upsert).not.toHaveBeenCalled();
    });

    it("marks all unread active announcements as read", async () => {
      prisma.announcement.findMany.mockResolvedValueOnce([
        { id: "announcement-1" },
        { id: "announcement-2" },
        { id: "announcement-3" },
      ]);

      prisma.announcementRead.createMany.mockResolvedValueOnce({
        count: 3,
      });

      const response = await request(app)
        .patch("/api/announcements/read-all")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.markedCount).toBe(3);

      expect(prisma.announcementRead.createMany).toHaveBeenCalledWith({
        data: [
          {
            announcementId: "announcement-1",
            userId: "student-1",
          },
          {
            announcementId: "announcement-2",
            userId: "student-1",
          },
          {
            announcementId: "announcement-3",
            userId: "student-1",
          },
        ],
        skipDuplicates: true,
      });
    });

    it("does not create read receipts when there are no unread announcements", async () => {
      prisma.announcement.findMany.mockResolvedValueOnce([]);

      const response = await request(app)
        .patch("/api/announcements/read-all")
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.markedCount).toBe(0);
      expect(prisma.announcementRead.createMany).not.toHaveBeenCalled();
    });
  });

  describe("Owner announcement management", () => {
    it("returns announcement history with pagination and read counts", async () => {
      prisma.announcement.findMany.mockResolvedValueOnce([
        {
          ...announcement,
          createdBy: {
            id: "owner-1",
            name: "Owner",
            email: owner.email,
          },
          _count: {
            reads: 12,
          },
        },
      ]);

      prisma.announcement.count.mockResolvedValueOnce(21);

      const response = await request(app)
        .get("/api/announcements/admin?page=2&limit=10")
        .set(auth("owner-1"));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.announcements).toHaveLength(1);
      expect(response.body.announcements[0].readCount).toBe(12);

      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { publishedAt: "desc" },
        })
      );
    });

    it("does not allow a student to access announcement history", async () => {
      const response = await request(app)
        .get("/api/announcements/admin")
        .set(auth("student-1"));

      expect(response.status).toBe(403);
      expect(prisma.announcement.findMany).not.toHaveBeenCalled();
    });

    it("publishes an announcement, records the audit action and emits a real-time event", async () => {
      const response = await request(app)
        .post("/api/announcements")
        .set(auth("owner-1"))
        .send({
          title: "  Campus Update  ",
          message: "  The marketplace is now open.  ",
          isUrgent: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.announcement.id).toBe("announcement-1");

      expect(transaction.announcement.create).toHaveBeenCalledWith({
        data: {
          title: "Campus Update",
          message: "The marketplace is now open.",
          isUrgent: true,
          createdById: "owner-1",
        },
      });

      expect(transaction.adminAction.create).toHaveBeenCalledWith({
        data: {
          action: "ANNOUNCEMENT_CREATED",
          reason: "Published announcement: Campus Update",
          actorId: "owner-1",
        },
      });

      expect(io.emit).toHaveBeenCalledWith(
        "announcement:new",
        expect.objectContaining({
          id: "announcement-1",
          title: "Campus Update",
          message: "The marketplace will be available throughout the week.",
          isUrgent: false,
        })
      );
    });

    it("rejects an announcement with an invalid title", async () => {
      const response = await request(app)
        .post("/api/announcements")
        .set(auth("owner-1"))
        .send({
          title: "   ",
          message: "A valid announcement message.",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(transaction.announcement.create).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it("archives an announcement and records the audit action", async () => {
      const response = await request(app)
        .patch("/api/announcements/announcement-1/archive")
        .set(auth("owner-1"));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(prisma.announcement.update).toHaveBeenCalledWith({
        where: { id: "announcement-1" },
        data: { isActive: false },
      });

      expect(prisma.adminAction.create).toHaveBeenCalledWith({
        data: {
          action: "ANNOUNCEMENT_ARCHIVED",
          reason: "Archived announcement: Campus Update",
          actorId: "owner-1",
        },
      });
    });
  });
});