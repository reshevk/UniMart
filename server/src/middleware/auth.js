
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const EMPTY_PERMISSIONS = {
  manageListings: false,
  manageReports: false,
  manageUsers: false,
  manageAnnouncements: false,
};

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  if (
    !decoded ||
    typeof decoded !== "object" ||
    typeof decoded.userId !== "string" ||
    !decoded.userId.trim()
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        suspendedAt: true,
        tokenVersion: true,
        adminTeamMembership: {
          select: {
            canManageListings: true,
            canManageReports: true,
            canManageUsers: true,
            canManageAnnouncements: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists",
      });
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
    }

    if (user.suspendedAt) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended",
      });
    }

    const membership = user.adminTeamMembership;

    const permissions =
      user.role === "OWNER"
        ? {
            manageListings: true,
            manageReports: true,
            manageUsers: true,
            manageAnnouncements: true,
          }
        : user.role === "ADMIN" && membership
          ? {
              manageListings: membership.canManageListings,
              manageReports: membership.canManageReports,
              manageUsers: membership.canManageUsers,
              manageAnnouncements: membership.canManageAnnouncements,
            }
          : { ...EMPTY_PERMISSIONS };

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== "OWNER") {
    return res.status(403).json({
      success: false,
      message: "Owner access required",
    });
  }

  return next();
}

export function requireAdmin(req, res, next) {
  if (!["OWNER", "ADMIN"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Owner access required",
    });
  }

  return next();
}

export function requirePermission(permission) {
  const validPermissions = [
    "manageListings",
    "manageReports",
    "manageUsers",
    "manageAnnouncements",
  ];

  if (!validPermissions.includes(permission)) {
    throw new Error(`Invalid admin permission: ${permission}`);
  }

  return (req, res, next) => {
    if (req.user?.role === "OWNER") {
      return next();
    }

    if (
      req.user?.role !== "ADMIN" ||
      req.user.permissions?.[permission] !== true
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
        requiredPermission: permission,
      });
    }

    return next();
  };
}
