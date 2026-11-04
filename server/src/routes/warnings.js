
import express from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

// GET WARNINGS FOR THE LOGGED-IN STUDENT
router.get("/", async (req, res, next) => {
  try {
    const warnings = await prisma.warning.findMany({
      where: {
        userId: req.user.userId,
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

    return res.json({
      success: true,
      warnings,
      unreadCount: warnings.filter(
        (warning) => !warning.acknowledgedAt
      ).length,
    });
  } catch (error) {
    next(error);
  }
});

// ACKNOWLEDGE A WARNING
router.patch("/:id/acknowledge", async (req, res, next) => {
  try {
    const result = await prisma.warning.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.userId,
        acknowledgedAt: null,
      },
      data: {
        acknowledgedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const warning = await prisma.warning.findFirst({
        where: {
          id: req.params.id,
          userId: req.user.userId,
        },
        select: {
          id: true,
          acknowledgedAt: true,
        },
      });

      if (!warning) {
        return res.status(404).json({
          success: false,
          message: "Warning not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Warning has already been acknowledged",
      });
    }

    return res.json({
      success: true,
      message: "Warning acknowledged successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
