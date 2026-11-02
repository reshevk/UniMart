
import express from "express";
import { prisma } from "../lib/prisma.js";

const router = express.Router();

// Create or retrieve a conversation for a product
router.post("/conversations", async (req, res) => {
  try {
    const { productId } = req.body;
    const buyerId = req.user.userId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });

    if (!product || product.status !== "AVAILABLE") {
      return res.status(404).json({
        success: false,
        message: "Product is not available",
      });
    }

    if (product.sellerId === buyerId) {
      return res.status(400).json({
        success: false,
        message: "You cannot chat about your own product",
      });
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        productId_buyerId: {
          productId,
          buyerId,
        },
      },
      update: {},
      create: {
        productId,
        buyerId,
        sellerId: product.sellerId,
      },
      include: {
        product: true,
        buyer: {
          select: { id: true, name: true },
        },
        seller: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create conversation",
    });
  }
});

// Get all conversations for the logged-in user
router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        product: true,
        buyer: {
          select: { id: true, name: true },
        },
        seller: {
          select: { id: true, name: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, conversations });
  } catch (error) {
    console.error("Fetch conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
});

// Get messages from a conversation
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
});

// Send a message
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = req.user.userId;
    const content =
      typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!content || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 1 to 2000 characters",
      });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const message = await prisma.message.create({
      data: {
        content,
        conversationId: conversation.id,
        senderId: userId,
      },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const io = req.app.get("io");

    io.to(`user:${conversation.buyerId}`)
      .to(`user:${conversation.sellerId}`)
      .emit("new_message", {
        ...message,
        conversationId: conversation.id,
      });

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
});

export default router;
