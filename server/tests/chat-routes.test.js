
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

import app from "../src/app.js";

process.env.JWT_SECRET = "unimart-test-secret";

const BUYER_ID = "buyer-123";
const SELLER_ID = "seller-456";
const CONVERSATION_ID = "conversation-789";
const PRODUCT_ID = "product-123";

const token = jwt.sign(
  { userId: BUYER_ID },
  process.env.JWT_SECRET,
  { algorithm: "HS256" }
);

const auth = {
  Authorization: `Bearer ${token}`,
};

const conversation = {
  id: CONVERSATION_ID,
  productId: PRODUCT_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  buyerLastReadAt: null,
  sellerLastReadAt: null,
};

const sampleMessage = {
  id: "message-123",
  content: "Is this laptop available?",
  conversationId: CONVERSATION_ID,
  senderId: BUYER_ID,
  sender: {
    id: BUYER_ID,
    name: "Buyer",
  },
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();

  app.set("io", undefined);

  prismaMock.user.findUnique.mockResolvedValue({
    id: BUYER_ID,
    email: "buyer@sst.scaler.com",
    role: "STUDENT",
    suspendedAt: null,
  });
});

describe("Chat routes", () => {
  describe("POST /api/chat/conversations", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .post("/api/chat/conversations")
        .send({ productId: PRODUCT_ID });

      expect(response.status).toBe(401);
      expect(prismaMock.conversation.upsert).not.toHaveBeenCalled();
    });

    it("rejects a missing product ID", async () => {
      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "A valid product ID is required"
      );
    });

    it("rejects an invalid product ID", async () => {
      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: "   " });

      expect(response.status).toBe(400);
    });

    it("returns 404 when the product does not exist", async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: PRODUCT_ID });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Product is not available"
      );
    });

    it("rejects products that are not available", async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PRODUCT_ID,
        sellerId: SELLER_ID,
        status: "SOLD",
      });

      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: PRODUCT_ID });

      expect(response.status).toBe(404);
      expect(prismaMock.conversation.upsert).not.toHaveBeenCalled();
    });

    it("prevents sellers from chatting about their own products", async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PRODUCT_ID,
        sellerId: BUYER_ID,
        status: "AVAILABLE",
        moderationStatus: "ACTIVE",
      });

      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: PRODUCT_ID });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "You cannot chat about your own product"
      );
    });

    it("creates or retrieves a conversation successfully", async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: PRODUCT_ID,
        sellerId: SELLER_ID,
        status: "AVAILABLE",
        moderationStatus: "ACTIVE",
      });

      prismaMock.conversation.upsert.mockResolvedValue(conversation);

      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: ` ${PRODUCT_ID} ` });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(prismaMock.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId_buyerId: {
              productId: PRODUCT_ID,
              buyerId: BUYER_ID,
            },
          },
          create: {
            productId: PRODUCT_ID,
            buyerId: BUYER_ID,
            sellerId: SELLER_ID,
          },
        })
      );
    });

    it("handles database errors", async () => {
      prismaMock.product.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .post("/api/chat/conversations")
        .set(auth)
        .send({ productId: PRODUCT_ID });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to create conversation"
      );
    });
  });

  describe("GET /api/chat/conversations", () => {
    it("requires authentication", async () => {
      const response = await request(app).get(
        "/api/chat/conversations"
      );

      expect(response.status).toBe(401);
    });

    it("returns conversations with unread counts", async () => {
      prismaMock.conversation.findMany.mockResolvedValue([
        conversation,
      ]);

      prismaMock.message.count.mockResolvedValue(3);

      const response = await request(app)
        .get("/api/chat/conversations")
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].unreadCount).toBe(3);

      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { buyerId: BUYER_ID },
              { sellerId: BUYER_ID },
            ],
          },
        })
      );

      expect(prismaMock.message.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: CONVERSATION_ID,
            senderId: { not: BUYER_ID },
          }),
        })
      );
    });

    it("uses the seller's last-read timestamp for seller conversations", async () => {
      const sellerConversation = {
        ...conversation,
        buyerId: SELLER_ID,
        sellerId: BUYER_ID,
        sellerLastReadAt: new Date("2026-01-01"),
      };

      prismaMock.conversation.findMany.mockResolvedValue([
        sellerConversation,
      ]);

      prismaMock.message.count.mockResolvedValue(2);

      const response = await request(app)
        .get("/api/chat/conversations")
        .set(auth);

      expect(response.status).toBe(200);

      expect(prismaMock.message.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gt: sellerConversation.sellerLastReadAt,
            },
          }),
        })
      );
    });

    it("returns an empty list when there are no conversations", async () => {
      prismaMock.conversation.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/chat/conversations")
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toEqual([]);
    });

    it("handles database errors", async () => {
      prismaMock.conversation.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .get("/api/chat/conversations")
        .set(auth);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to fetch conversations"
      );
    });

    it("handles unread-count database errors", async () => {
      prismaMock.conversation.findMany.mockResolvedValue([
        conversation,
      ]);

      prismaMock.message.count.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .get("/api/chat/conversations")
        .set(auth);

      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/chat/conversations/:id/messages", () => {
    it("requires authentication", async () => {
      const response = await request(app).get(
        `/api/chat/conversations/${CONVERSATION_ID}/messages`
      );

      expect(response.status).toBe(401);
    });

    it("returns 404 for conversations the user cannot access", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
        .set(auth);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Conversation not found");
    });

    it("fetches messages and marks the buyer's conversation as read", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(conversation);
      prismaMock.conversation.update.mockResolvedValue(conversation);
      prismaMock.message.findMany.mockResolvedValue([sampleMessage]);

      const response = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(1);

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: CONVERSATION_ID },
        data: {
          buyerLastReadAt: expect.any(Date),
        },
      });

      expect(prismaMock.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: CONVERSATION_ID,
            createdAt: {
              lte: expect.any(Date),
            },
          },
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("marks the seller's conversation as read", async () => {
      const sellerConversation = {
        ...conversation,
        buyerId: SELLER_ID,
        sellerId: BUYER_ID,
      };

      prismaMock.conversation.findFirst.mockResolvedValue(
        sellerConversation
      );

      prismaMock.conversation.update.mockResolvedValue(
        sellerConversation
      );

      prismaMock.message.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
        .set(auth);

      expect(response.status).toBe(200);

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: CONVERSATION_ID },
        data: {
          sellerLastReadAt: expect.any(Date),
        },
      });
    });

    it("handles database errors", async () => {
      prismaMock.conversation.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .get(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
        .set(auth);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to fetch messages"
      );
    });
  });

  describe("POST /api/chat/conversations/:id/messages", () => {
    const messageUrl =
      `/api/chat/conversations/${CONVERSATION_ID}/messages`;

    it("requires authentication", async () => {
      const response = await request(app)
        .post(messageUrl)
        .send({ content: "Hello" });

      expect(response.status).toBe(401);
    });

    it("rejects empty messages", async () => {
      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "   " });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Message must contain 1 to 2000 characters"
      );
    });

    it("rejects messages longer than 2000 characters", async () => {
      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "a".repeat(2001) });

      expect(response.status).toBe(400);
      expect(prismaMock.message.create).not.toHaveBeenCalled();
    });

    it("rejects non-string message content", async () => {
      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: 12345 });

      expect(response.status).toBe(400);
    });

    it("returns 404 when the conversation does not exist or is inaccessible", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "Hello!" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Conversation not found");
    });

    it("sends a message and updates the conversation", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(conversation);
      prismaMock.message.create.mockResolvedValue(sampleMessage);
      prismaMock.conversation.update.mockResolvedValue(conversation);

      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "  Is this laptop available?  " });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            content: "Is this laptop available?",
            conversationId: CONVERSATION_ID,
            senderId: BUYER_ID,
          },
        })
      );

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: CONVERSATION_ID },
        data: {
          updatedAt: expect.any(Date),
        },
      });
    });

    it("notifies both participants through Socket.IO", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(conversation);
      prismaMock.message.create.mockResolvedValue(sampleMessage);
      prismaMock.conversation.update.mockResolvedValue(conversation);

      const emit = vi.fn();
      const toSeller = {
        emit,
      };
      const toBuyer = {
        to: vi.fn().mockReturnValue(toSeller),
      };
      const io = {
        to: vi.fn().mockReturnValue(toBuyer),
      };

      app.set("io", io);

      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "Hello!" });

      expect(response.status).toBe(201);

      expect(io.to).toHaveBeenCalledWith(`user:${BUYER_ID}`);
      expect(toBuyer.to).toHaveBeenCalledWith(`user:${SELLER_ID}`);

      expect(emit).toHaveBeenCalledWith(
        "new_message",
        expect.objectContaining({
          conversationId: CONVERSATION_ID,
        })
      );
    });

    it("sends a message successfully when Socket.IO is unavailable", async () => {
      prismaMock.conversation.findFirst.mockResolvedValue(conversation);
      prismaMock.message.create.mockResolvedValue(sampleMessage);
      prismaMock.conversation.update.mockResolvedValue(conversation);

      app.set("io", undefined);

      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "Hello!" });

      expect(response.status).toBe(201);
    });

    it("handles database errors", async () => {
      prismaMock.conversation.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .post(messageUrl)
        .set(auth)
        .send({ content: "Hello!" });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to send message"
      );
    });
  });
});
