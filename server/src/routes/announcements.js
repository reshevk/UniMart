
import express from "express";
import { prisma } from "../lib/prisma.js";
import {
  authenticateToken,
  requirePermission,
} from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

// GET /api/announcements
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;

    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: [
        { isUrgent: "desc" },
        { publishedAt: "desc" },
      ],
      take: 100,
      include: {
        reads: {
          where: { userId },
          select: { readAt: true },
        },
      },
    });

    const data = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      isUrgent: announcement.isUrgent,
      publishedAt: announcement.publishedAt,
      isRead: announcement.reads.length > 0,
      readAt: announcement.reads[0]?.readAt || null,
    }));

    res.json({ success: true, announcements: data });
  } catch (error) {
    console.error("Fetch announcements error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
    });
  }
});

// GET /api/announcements/unread-count
router.get("/unread-count", async (req, res) => {
  try {
    const unreadCount = await prisma.announcement.count({
      where: {
        isActive: true,
        reads: {
          none: { userId: req.user.userId },
        },
      },
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("Unread announcement count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
    });
  }
});

// PATCH /api/announcements/read-all
router.patch("/read-all", async (req, res) => {
  try {
    const userId = req.user.userId;

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        reads: { none: { userId } },
      },
      select: { id: true },
    });

    if (announcements.length > 0) {
      await prisma.announcementRead.createMany({
        data: announcements.map((announcement) => ({
          announcementId: announcement.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    res.json({
      success: true,
      message: "All announcements marked as read",
      markedCount: announcements.length,
    });
  } catch (error) {
    console.error("Mark all announcements read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark announcements as read",
    });
  }
});

// PATCH /api/announcements/:id/read
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const announcement = await prisma.announcement.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId,
        },
      },
      update: {},
      create: {
        announcementId: id,
        userId,
      },
    });

    res.json({
      success: true,
      message: "Announcement marked as read",
    });
  } catch (error) {
    console.error("Mark announcement read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark announcement as read",
    });
  }
});

// GET /api/announcements/admin
router.get(
  "/admin",
  requirePermission("manageAnnouncements"),
  async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
      );

      const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: { reads: true },
            },
          },
        }),
        prisma.announcement.count(),
      ]);

      res.json({
        success: true,
        announcements: announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          message: announcement.message,
          isUrgent: announcement.isUrgent,
          isActive: announcement.isActive,
          publishedAt: announcement.publishedAt,
          createdAt: announcement.createdAt,
          updatedAt: announcement.updatedAt,
          createdBy: announcement.createdBy,
          readCount: announcement._count.reads,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Admin announcement history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch announcement history",
      });
    }
  }
);

// POST /api/announcements
router.post(
  "/",
  requirePermission("manageAnnouncements"),
  async (req, res) => {
    try {
      const { title, message, isUrgent = false } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 120
      ) {
        return res.status(400).json({
          success: false,
          message: "Title is required and must be at most 120 characters",
        });
      }

      if (
        typeof message !== "string" ||
        !message.trim() ||
        message.trim().length > 5000
      ) {
        return res.status(400).json({
          success: false,
          message: "Message is required and must be at most 5000 characters",
        });
      }

      if (typeof isUrgent !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isUrgent must be true or false",
        });
      }

      const announcement = await prisma.$transaction(async (tx) => {
        const created = await tx.announcement.create({
          data: {
            title: title.trim(),
            message: message.trim(),
            isUrgent,
            createdById: req.user.userId,
          },
        });

        await tx.adminAction.create({
          data: {
            action: "ANNOUNCEMENT_CREATED",
            reason: `Published announcement: ${title.trim()}`,
            actorId: req.user.userId,
          },
        });

        return created;
      });

      const io = req.app.get("io");

      io?.emit("announcement:new", {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        isUrgent: announcement.isUrgent,
        publishedAt: announcement.publishedAt,
      });

      res.status(201).json({
        success: true,
        message: "Announcement published successfully",
        announcement,
      });
    } catch (error) {
      console.error("Create announcement error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to publish announcement",
      });
    }
  }
);

// PATCH /api/announcements/:id/archive
router.patch(
  "/:id/archive",
  requirePermission("manageAnnouncements"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found",
        });
      }

      if (!existing.isActive) {
        return res.json({
          success: true,
          message: "Announcement is already archived",
        });
      }

      await prisma.$transaction([
        prisma.announcement.update({
          where: { id },
          data: { isActive: false },
        }),
        prisma.adminAction.create({
          data: {
            action: "ANNOUNCEMENT_ARCHIVED",
            reason: `Archived announcement: ${existing.title}`,
            actorId: req.user.userId,
          },
        }),
      ]);

      res.json({
        success: true,
        message: "Announcement archived successfully",
      });
    } catch (error) {
      console.error("Archive announcement error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to archive announcement",
      });
    }
  }
);

export default router;
