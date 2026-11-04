import express from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

const ALLOWED_REASONS = [
  "Scam or fraud",
  "Prohibited or unsafe item",
  "Misleading listing information",
  "Harassment or abusive behaviour",
  "Spam or duplicate listing",
  "Other",
];

router.post("/", async (req, res, next) => {
  try {
    const { targetType, productId, reportedUserId, reason } = req.body;

    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : "";

    if (!["LISTING", "USER"].includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: "Choose whether to report a listing or a student.",
      });
    }

    if (!ALLOWED_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid report reason.",
      });
    }

    if (description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 1000 characters.",
      });
    }

    const reporterId = req.user.userId;
    let targetData;

    if (targetType === "LISTING") {
      if (
        typeof productId !== "string" ||
        !productId.trim() ||
        reportedUserId
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid listing is required.",
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          sellerId: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Listing not found.",
        });
      }

      if (product.sellerId === reporterId) {
        return res.status(403).json({
          success: false,
          message: "You cannot report your own listing.",
        });
      }

      targetData = { productId: product.id };
    } else {
      if (
        typeof reportedUserId !== "string" ||
        !reportedUserId.trim() ||
        productId
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid student account is required.",
        });
      }

      const reportedUser = await prisma.user.findUnique({
        where: { id: reportedUserId },
        select: {
          id: true,
          role: true,
        },
      });

      if (!reportedUser || reportedUser.role !== "STUDENT") {
        return res.status(404).json({
          success: false,
          message: "Student not found.",
        });
      }

      if (reportedUser.id === reporterId) {
        return res.status(403).json({
          success: false,
          message: "You cannot report yourself.",
        });
      }

      targetData = { reportedUserId: reportedUser.id };
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId,
        status: "PENDING",
        ...targetData,
      },
      select: { id: true },
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a pending report for this target.",
      });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        ...targetData,
        reason,
        description: description || null,
      },
      select: {
        id: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Your report has been submitted successfully.",
      report,
    });
  } catch (error) {
    next(error);
  }
});

export default router;