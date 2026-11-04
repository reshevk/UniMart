
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app.js";
import allowedOrigins from "./config/cors.js";
import { prisma } from "./lib/prisma.js";

const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
];

const missingEnvVars = requiredEnvVars.filter(
  (key) => !process.env[key]?.trim()
);

if (
  process.env.JWT_SECRET &&
  Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32
) {
  console.error("JWT_SECRET must be at least 32 bytes long.");
  process.exit(1);
}

if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      !decoded.userId.trim()
    ) {
      return next(new Error("Invalid authentication token"));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        suspendedAt: true,
      },
    });

    if (!user) {
      return next(new Error("Account no longer exists"));
    }

    if (user.suspendedAt) {
      return next(new Error("Your account has been suspended"));
    }

    socket.userId = user.id;
    socket.userRole = user.role;

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);

  console.log(`User connected to chat: ${socket.userId}`);

  socket.on("disconnect", () => {
    console.log(`User disconnected from chat: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`UniMart server running on port ${PORT}`);
});
