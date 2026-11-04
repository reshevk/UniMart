
import express from "express";
import { prisma } from "../lib/prisma.js";
import {
  authenticateToken,
  requireOwner,
  requireAdmin,
  requirePermission,
} from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

function getPagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

const permissionFields = {
  manageListings: "canManageListings",
  manageReports: "canManageReports",
  manageUsers: "canManageUsers",
  manageAnnouncements: "canManageAnnouncements",
};

function getPermissionData(body) {
  const data = {};

  for (const field of Object.values(permissionFields)) {
    if (typeof body[field] !== "boolean") {
      return null;
    }

    data[field] = body[field];
  }

  return data;
}

// DASHBOARD OVERVIEW
router.get("/overview", requireAdmin, async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalListings,
      activeListings,
      hiddenListings,
      pendingReports,
      recentActions,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({
        where: { role: "STUDENT", suspendedAt: null },
      }),
      prisma.user.count({
        where: { role: "STUDENT", suspendedAt: { not: null } },
      }),
      prisma.product.count(),
      prisma.product.count({
        where: {
          moderationStatus: "ACTIVE",
          status: "AVAILABLE",
        },
      }),
      prisma.product.count({
        where: { moderationStatus: "HIDDEN" },
      }),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.adminAction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
          targetUser: {
            select: { id: true, name: true, email: true },
          },
          targetProduct: {
            select: { id: true, title: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      overview: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalListings,
        activeListings,
        hiddenListings,
        pendingReports,
      },
      recentActions,
    });
  } catch (error) {
    next(error);
  }
});

// SEARCH AND LIST STUDENTS
router.get(
  "/users",
  requirePermission("manageUsers"),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = getPagination(req);
      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";

      const where = {
        role: "STUDENT",
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            suspendedAt: true,
            suspensionReason: true,
            createdAt: true,
            _count: {
              select: {
                products: true,
                receivedWarnings: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return res.json({
        success: true,
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET STUDENT DETAILS AND WARNING HISTORY
router.get(
  "/users/:id",
  requirePermission("manageUsers"),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          role: "STUDENT",
        },
        select: {
          id: true,
          name: true,
          email: true,
          suspendedAt: true,
          suspensionReason: true,
          createdAt: true,
          products: {
            select: {
              id: true,
              title: true,
              price: true,
              status: true,
              moderationStatus: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          receivedWarnings: {
            orderBy: { createdAt: "desc" },
            include: {
              issuedBy: {
                select: { name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              submittedReports: true,
              reportsAgainst: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      return res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  }
);

// SUSPEND STUDENT
router.patch(
  "/users/:id/suspend",
  requirePermission("manageUsers"),
  async (req, res, next) => {
    try {
      const reason =
        typeof req.body.reason === "string" ? req.body.reason.trim() : "";

      if (reason.length < 3 || reason.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Suspension reason must be between 3 and 500 characters",
        });
      }

      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, suspendedAt: true },
      });

      if (!target || target.role !== "STUDENT") {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      if (target.suspendedAt) {
        return res.status(409).json({
          success: false,
          message: "Student is already suspended",
        });
      }

      const suspendedAt = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: {
            suspendedAt,
            suspensionReason: reason,
          },
        });

        await tx.adminAction.create({
          data: {
            action: "USER_SUSPENDED",
            reason,
            actorId: req.user.userId,
            targetUserId: target.id,
          },
        });
      });

      const io = req.app.get("io");

      if (io) {
        io.in(`user:${target.id}`).disconnectSockets(true);
      }

      return res.json({
        success: true,
        message: "Student suspended successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// RESTORE STUDENT
router.patch(
  "/users/:id/restore",
  requirePermission("manageUsers"),
  async (req, res, next) => {
    try {
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, suspendedAt: true },
      });

      if (!target || target.role !== "STUDENT") {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      if (!target.suspendedAt) {
        return res.status(409).json({
          success: false,
          message: "Student is not suspended",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: {
            suspendedAt: null,
            suspensionReason: null,
          },
        });

        await tx.adminAction.create({
          data: {
            action: "USER_RESTORED",
            actorId: req.user.userId,
            targetUserId: target.id,
          },
        });
      });

      return res.json({
        success: true,
        message: "Student restored successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// ISSUE OFFICIAL WARNING
router.post(
  "/users/:id/warnings",
  requirePermission("manageUsers"),
  async (req, res, next) => {
    try {
      const message =
        typeof req.body.message === "string" ? req.body.message.trim() : "";
      const reason =
        typeof req.body.reason === "string" ? req.body.reason.trim() : "";

      if (message.length < 10 || message.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Warning message must be between 10 and 1000 characters",
        });
      }

      if (reason.length < 3 || reason.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Warning reason must be between 3 and 500 characters",
        });
      }

      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true },
      });

      if (!target || target.role !== "STUDENT") {
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      const warning = await prisma.$transaction(async (tx) => {
        const createdWarning = await tx.warning.create({
          data: {
            message,
            reason,
            userId: target.id,
            issuedById: req.user.userId,
          },
        });

        await tx.adminAction.create({
          data: {
            action: "WARNING_ISSUED",
            reason,
            actorId: req.user.userId,
            targetUserId: target.id,
          },
        });

        return createdWarning;
      });

      return res.status(201).json({
        success: true,
        message: "Official warning issued successfully",
        warning,
      });
    } catch (error) {
      next(error);
    }
  }
);

// LISTINGS
router.get(
  "/listings",
  requirePermission("manageListings"),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = getPagination(req);
      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim()
          : "";
      const status = req.query.status;

      const allowedStatuses = ["ACTIVE", "HIDDEN", "REMOVED"];

      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid moderation status",
        });
      }

      const where = {
        ...(status ? { moderationStatus: status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                {
                  seller: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
                {
                  seller: {
                    email: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      };

      const [listings, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            seller: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      return res.json({
        success: true,
        listings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// HIDE, RESTORE OR REMOVE LISTING
router.patch(
  "/listings/:id/moderation",
  requirePermission("manageListings"),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const reason =
        typeof req.body.reason === "string" ? req.body.reason.trim() : "";

      const allowedStatuses = ["ACTIVE", "HIDDEN", "REMOVED"];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be ACTIVE, HIDDEN or REMOVED",
        });
      }

      if (reason.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Reason cannot exceed 500 characters",
        });
      }

      if (status !== "ACTIVE" && reason.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Please provide a reason for this moderation action",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { id: true, moderationStatus: true },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }

      if (product.moderationStatus === status) {
        return res.status(409).json({
          success: false,
          message: "Listing already has this moderation status",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: {
            moderationStatus: status,
            moderatedAt: new Date(),
            moderationReason: status === "ACTIVE" ? null : reason,
          },
        });

        await tx.adminAction.create({
          data: {
            action: `LISTING_${status}`,
            reason: reason || null,
            actorId: req.user.userId,
            targetProductId: product.id,
          },
        });
      });

      return res.json({
        success: true,
        message: `Listing ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// REPORTS
router.get(
  "/reports",
  requirePermission("manageReports"),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = getPagination(req);
      const status = req.query.status;

      const allowedStatuses = [
        "PENDING",
        "REVIEWED",
        "DISMISSED",
        "ACTION_TAKEN",
      ];

      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report status",
        });
      }

      const where = status ? { status } : {};

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            reporter: {
              select: { id: true, name: true, email: true },
            },
            reportedUser: {
              select: { id: true, name: true, email: true },
            },
            product: {
              select: {
                id: true,
                title: true,
                moderationStatus: true,
              },
            },
          },
        }),
        prisma.report.count({ where }),
      ]);

      return res.json({
        success: true,
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// REVIEW REPORT
router.patch(
  "/reports/:id",
  requirePermission("manageReports"),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const resolution =
        typeof req.body.resolution === "string"
          ? req.body.resolution.trim()
          : "";

      const allowedStatuses = ["REVIEWED", "DISMISSED", "ACTION_TAKEN"];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report review status",
        });
      }

      if (resolution.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Resolution cannot exceed 1000 characters",
        });
      }

      await prisma.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({
          where: {
            id: req.params.id,
            status: "PENDING",
          },
          data: {
            status,
            reviewedAt: new Date(),
            reviewedBy: req.user.userId,
            resolution: resolution || null,
          },
        });

        if (updated.count === 0) {
          const reportExists = await tx.report.findUnique({
            where: { id: req.params.id },
            select: { id: true },
          });

          if (!reportExists) {
            const error = new Error("Report not found");
            error.status = 404;
            throw error;
          }

          const error = new Error("Report has already been reviewed");
          error.status = 409;
          throw error;
        }

        const report = await tx.report.findUnique({
          where: { id: req.params.id },
          select: {
            reportedUserId: true,
            productId: true,
          },
        });

        await tx.adminAction.create({
          data: {
            action: `REPORT_${status}`,
            reason: resolution || null,
            actorId: req.user.userId,
            targetUserId: report.reportedUserId,
            targetProductId: report.productId,
          },
        });
      });

      return res.json({
        success: true,
        message: "Report reviewed successfully",
      });
    } catch (error) {
      if (error.status === 404 || error.status === 409) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      next(error);
    }
  }
);

// ADMIN AUDIT LOG - OWNER ONLY
router.get("/activity", requireOwner, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
          targetUser: {
            select: { id: true, name: true, email: true },
          },
          targetProduct: {
            select: { id: true, title: true },
          },
        },
      }),
      prisma.adminAction.count(),
    ]);

    return res.json({
      success: true,
      actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ADMIN TEAM MANAGEMENT - OWNER ONLY
// ==========================================

// GET ALL TEAM MEMBERS
router.get("/team", requireOwner, async (req, res, next) => {
  try {
    const members = await prisma.adminTeamMember.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      members,
    });
  } catch (error) {
    next(error);
  }
});

// ADD AN EXISTING STUDENT TO THE ADMIN TEAM
router.post("/team", requireOwner, async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!/^[^\s@]+@sst\.scaler\.com$/i.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid college email address",
      });
    }

    const permissions = getPermissionData(req.body);

    if (!permissions) {
      return res.status(400).json({
        success: false,
        message: "All four permissions must be provided as true or false",
      });
    }

    const target = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Ask this student to register first.",
      });
    }

    if (target.role !== "STUDENT") {
      return res.status(409).json({
        success: false,
        message: "This account is already an admin or owner",
      });
    }

    const member = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { role: "ADMIN" },
      });

      const created = await tx.adminTeamMember.create({
        data: {
          userId: target.id,
          invitedById: req.user.userId,
          ...permissions,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.adminAction.create({
        data: {
          action: "ADMIN_TEAM_MEMBER_ADDED",
          actorId: req.user.userId,
          targetUserId: target.id,
        },
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Team member added successfully",
      member,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "This student is already a team member",
      });
    }

    next(error);
  }
});

// UPDATE TEAM MEMBER PERMISSIONS
router.patch("/team/:id", requireOwner, async (req, res, next) => {
  try {
    const permissions = getPermissionData(req.body);

    if (!permissions) {
      return res.status(400).json({
        success: false,
        message: "All four permissions must be provided as true or false",
      });
    }

    const existing = await prisma.adminTeamMember.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!existing || existing.user.role !== "ADMIN") {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    const member = await prisma.$transaction(async (tx) => {
      const updated = await tx.adminTeamMember.update({
        where: { id: existing.id },
        data: permissions,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.adminAction.create({
        data: {
          action: "ADMIN_TEAM_PERMISSIONS_UPDATED",
          actorId: req.user.userId,
          targetUserId: existing.userId,
        },
      });

      return updated;
    });

    return res.json({
      success: true,
      message: "Team member permissions updated",
      member,
    });
  } catch (error) {
    next(error);
  }
});

// REMOVE TEAM MEMBER
router.delete("/team/:id", requireOwner, async (req, res, next) => {
  try {
    const existing = await prisma.adminTeamMember.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!existing || existing.user.role !== "ADMIN") {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    if (existing.userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove yourself from the admin team",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminTeamMember.delete({
        where: { id: existing.id },
      });

      await tx.user.update({
        where: { id: existing.userId },
        data: { role: "STUDENT" },
      });

      await tx.adminAction.create({
        data: {
          action: "ADMIN_TEAM_MEMBER_REMOVED",
          actorId: req.user.userId,
          targetUserId: existing.userId,
        },
      });
    });

    return res.json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
