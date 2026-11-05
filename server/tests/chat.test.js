import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { prismaMock, fileTypeMock, cloudinaryUploadStream } = vi.hoisted(
  () => ({
    prismaMock: {
      user: {
        findUnique: vi.fn(),
      },
      product: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
    fileTypeMock: vi.fn(),
    cloudinaryUploadStream: vi.fn(),
  })
);

vi.mock("../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: fileTypeMock,
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload_stream: cloudinaryUploadStream,
    },
  },
}));

import app from "../src/app.js";

const USER_ID = "student-123";
const PRODUCT_ID = "product-456";

process.env.JWT_SECRET = "unimart-test-secret";

const token = jwt.sign(
  { userId: USER_ID },
  process.env.JWT_SECRET,
  { algorithm: "HS256" }
);

const auth = {
  Authorization: `Bearer ${token}`,
};

const IMAGE_URL =
  "https://res.cloudinary.com/vibzzs2e/image/upload/v123/unimart/laptop.jpg";

const validProduct = {
  title: "Used Laptop",
  description: "A laptop in excellent working condition.",
  price: 25000,
  category: "Electronics",
  condition: "Good",
   hostel: "UNI_WORLD_1",
};

const existingProduct = {
  id: PRODUCT_ID,
  ...validProduct,
  imageUrl: IMAGE_URL,
  imageUrls: [IMAGE_URL],
  sellerId: USER_ID,
  sellerWhatsapp: "919876543210",
  status: "AVAILABLE",
  moderationStatus: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.user.findUnique.mockResolvedValue({
    id: USER_ID,
    email: "student@sst.scaler.com",
    role: "STUDENT",
    suspendedAt: null,
  });
});

describe("Product routes", () => {
  describe("GET /api/products", () => {
    it("returns available and active listings without authentication", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        existingProduct,
      ]);

      const response = await request(app).get("/api/products");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.products).toHaveLength(1);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "AVAILABLE",
            moderationStatus: "ACTIVE",
          },
        })
      );

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns an empty array when no listings exist", async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const response = await request(app).get("/api/products");

      expect(response.status).toBe(200);
      expect(response.body.products).toEqual([]);
    });

    it("handles database errors", async () => {
      prismaMock.product.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app).get("/api/products");

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to fetch products."
      );
    });
  });

  describe("GET /api/products/my-listings", () => {
    it("requires authentication", async () => {
      const response = await request(app).get(
        "/api/products/my-listings"
      );

      expect(response.status).toBe(401);
    });

    it("returns only the logged-in user's listings", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        existingProduct,
      ]);

      const response = await request(app)
        .get("/api/products/my-listings")
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: USER_ID },
        })
      );
    });
  });

  describe("POST /api/products", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .post("/api/products")
        .send(validProduct);

      expect(response.status).toBe(401);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it("creates a listing with valid details", async () => {
      prismaMock.product.create.mockResolvedValue(existingProduct);

      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send(validProduct);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Product listed successfully."
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: {
          ...validProduct,
          imageUrl: null,
          imageUrls: [],
          sellerWhatsapp: null,
          sellerId: USER_ID,
        },
      });
    });

    it("trims listing text before saving", async () => {
      prismaMock.product.create.mockResolvedValue(existingProduct);

      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          title: "  Used Laptop  ",
          description: "  A laptop in excellent working condition.  ",
          category: "  Electronics  ",
          condition: "  Good  ",
        });

      expect(response.status).toBe(201);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Used Laptop",
            description: "A laptop in excellent working condition.",
            category: "Electronics",
            condition: "Good",
          }),
        })
      );
    });

    it("normalizes the Indian WhatsApp number", async () => {
      prismaMock.product.create.mockResolvedValue(existingProduct);

      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          sellerWhatsapp: "98765-43210",
        });

      expect(response.status).toBe(201);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerWhatsapp: "919876543210",
          }),
        })
      );
    });

    it("rejects invalid product details", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          title: "AB",
        });

      expect(response.status).toBe(400);
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it.each([0, -1, 10000001, "invalid", ""])(
      "rejects invalid price: %s",
      async (price) => {
        const response = await request(app)
          .post("/api/products")
          .set(auth)
          .send({
            ...validProduct,
            price,
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(
          "Price must be greater than zero"
        );
      }
    );

    it("rejects invalid image URLs", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          imageUrl: "https://example.com/image.jpg",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Please provide valid product images."
      );
    });

    it("rejects more than five image URLs", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          imageUrls: Array(6).fill(IMAGE_URL),
        });

      expect(response.status).toBe(400);
    });

    it("rejects invalid WhatsApp numbers", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(auth)
        .send({
          ...validProduct,
          sellerWhatsapp: "12345",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        "valid 10-digit Indian WhatsApp number"
      );
    });
  });

  describe("PATCH /api/products/:id", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .send({ title: "Updated Laptop" });

      expect(response.status).toBe(401);
    });

    it("returns 404 when the listing does not belong to the user", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({ title: "Updated Laptop" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "Listing not found or you are not its owner."
      );
    });

    it("updates valid listing details", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);
      prismaMock.product.update.mockResolvedValue({
        ...existingProduct,
        title: "Updated Laptop",
        price: 20000,
      });

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({
          title: "Updated Laptop",
          price: 20000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: {
          title: "Updated Laptop",
          price: 20000,
        },
      });
    });

    it("rejects an invalid updated title", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({ title: "AB" });

      expect(response.status).toBe(400);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    it("rejects an invalid updated price", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({ price: -100 });

      expect(response.status).toBe(400);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });

    it("rejects invalid listing statuses", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({ status: "DELETED" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid listing status.");
    });

    it("allows a listing to be marked as sold", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);
      prismaMock.product.update.mockResolvedValue({
        ...existingProduct,
        status: "SOLD",
      });

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({ status: "SOLD" });

      expect(response.status).toBe(200);

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { status: "SOLD" },
      });
    });

    it("rejects requests containing no changes", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "No valid changes provided."
      );
    });

    it("validates updated image URLs", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);

      const response = await request(app)
        .patch(`/api/products/${PRODUCT_ID}`)
        .set(auth)
        .send({
          imageUrls: ["https://example.com/fake.jpg"],
        });

      expect(response.status).toBe(400);
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/products/:id", () => {
    it("requires authentication", async () => {
      const response = await request(app).delete(
        `/api/products/${PRODUCT_ID}`
      );

      expect(response.status).toBe(401);
    });

    it("returns 404 when the listing does not belong to the user", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/products/${PRODUCT_ID}`)
        .set(auth);

      expect(response.status).toBe(404);
      expect(prismaMock.product.delete).not.toHaveBeenCalled();
    });

    it("deletes the user's own listing", async () => {
      prismaMock.product.findFirst.mockResolvedValue(existingProduct);
      prismaMock.product.delete.mockResolvedValue(existingProduct);

      const response = await request(app)
        .delete(`/api/products/${PRODUCT_ID}`)
        .set(auth);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Listing deleted successfully."
      );

      expect(prismaMock.product.delete).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
      });
    });
  });

  describe("POST /api/products/upload", () => {
    it("requires authentication", async () => {
      const response = await request(app)
        .post("/api/products/upload");

      expect(response.status).toBe(401);
    });

    it("rejects requests without images", async () => {
      const response = await request(app)
        .post("/api/products/upload")
        .set(auth);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Please select at least one image."
      );
    });

    it("rejects files that are not valid images", async () => {
      fileTypeMock.mockResolvedValue({
        mime: "application/pdf",
        ext: "pdf",
      });

      const response = await request(app)
        .post("/api/products/upload")
        .set(auth)
        .attach("images", Buffer.from("not an image"), {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Only valid JPG, PNG, and WebP images are allowed."
      );

      expect(cloudinaryUploadStream).not.toHaveBeenCalled();
    });

    it("uploads a valid image to Cloudinary", async () => {
      fileTypeMock.mockResolvedValue({
        mime: "image/jpeg",
        ext: "jpg",
      });

      cloudinaryUploadStream.mockImplementation(
        (options, callback) => ({
          end: vi.fn(() => {
            callback(null, {
              secure_url: IMAGE_URL,
            });
          }),
        })
      );

      const response = await request(app)
        .post("/api/products/upload")
        .set(auth)
        .attach("images", Buffer.from("fake-image-data"), {
          filename: "laptop.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.imageUrls).toEqual([IMAGE_URL]);

      expect(cloudinaryUploadStream).toHaveBeenCalledWith(
        {
          folder: "unimart",
          resource_type: "image",
        },
        expect.any(Function)
      );
    });

    it("rejects uploads larger than 5 MB", async () => {
      const largeImage = Buffer.alloc(5 * 1024 * 1024 + 1);

      const response = await request(app)
        .post("/api/products/upload")
        .set(auth)
        .attach("images", largeImage, {
          filename: "large.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(413);
      expect(response.body.message).toBe(
        "Each image must be 5 MB or smaller."
      );

      expect(fileTypeMock).not.toHaveBeenCalled();
    });

    it("rejects more than five uploaded images", async () => {
      const uploadRequest = request(app)
        .post("/api/products/upload")
        .set(auth);

      for (let i = 0; i < 6; i += 1) {
        uploadRequest.attach(
          "images",
          Buffer.from(`image-${i}`),
          {
            filename: `image-${i}.jpg`,
            contentType: "image/jpeg",
          }
        );
      }

      const response = await uploadRequest;

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Invalid image upload. You can upload up to 5 images."
      );
    });

    it("handles Cloudinary upload failures", async () => {
      fileTypeMock.mockResolvedValue({
        mime: "image/jpeg",
        ext: "jpg",
      });

      cloudinaryUploadStream.mockImplementation(
        (options, callback) => ({
          end: vi.fn(() => {
            callback(new Error("Cloudinary unavailable"));
          }),
        })
      );

      const response = await request(app)
        .post("/api/products/upload")
        .set(auth)
        .attach("images", Buffer.from("fake-image-data"), {
          filename: "laptop.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Image upload failed. Please try again."
      );
    });
  });
});