
import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import allowedOrigins from "./config/cors.js";

import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import chatRoutes from "./routes/chat.js";
import { authenticateToken } from "./middleware/auth.js";
import adminRoutes from "./routes/admin.js";
import warningRoutes from "./routes/warnings.js";
import announcementRoutes from "./routes/announcements.js";
import reportRoutes from "./routes/reports.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/chat", authenticateToken, chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/warnings", warningRoutes);
app.use("/api/announcements", announcementRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to UniMArt API!");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "UniMArt backend is running!",
  });
});

// GET /api/auth/me
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isOwner = user.role === "OWNER";
    const isAdmin = ["OWNER", "ADMIN"].includes(user.role);

    return res.json({
      success: true,
      user: {
        ...user,
        isOwner,
        isAdmin,
        permissions: req.user.permissions || {
          manageUsers: false,
          manageListings: false,
          manageReports: false,
          manageAnnouncements: false,
        },
      },
    });
  } catch (error) {
    console.error("Profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
