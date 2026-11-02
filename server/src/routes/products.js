
import { v2 as cloudinary } from "cloudinary";
import express from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate Cloudinary signed upload details
router.post("/upload-signature", authenticateToken, (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = {
      timestamp,
      upload_preset: "unimart_signed",
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      success: true,
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: "unimart_signed",
    });
  } catch (error) {
    console.error("Cloudinary signature error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to authorize image upload",
    });
  }
});

const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_CLOUD = "vibzzs2e";

function normalizeWhatsapp(number) {
  if (number === undefined || number === null || number === "") {
    return null;
  }

  if (typeof number !== "string") {
    return undefined;
  }

  const digits = number.replace(/\D/g, "");

  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  if (/^91\d{10}$/.test(digits)) return digits;

  return undefined;
}

function isValidImageUrl(url) {
  if (url === undefined || url === null || url === "") {
    return true;
  }

  if (typeof url !== "string" || url.length > 2048) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === CLOUDINARY_HOST &&
      parsed.pathname.startsWith(`/${CLOUDINARY_CLOUD}/image/upload/`)
    );
  } catch {
    return false;
  }
}

function validateProductFields({ title, description, category, condition }) {
  return (
    typeof title === "string" &&
    title.trim().length >= 3 &&
    title.trim().length <= 100 &&
    typeof description === "string" &&
    description.trim().length >= 10 &&
    description.trim().length <= 2000 &&
    typeof category === "string" &&
    category.trim().length >= 1 &&
    category.trim().length <= 50 &&
    typeof condition === "string" &&
    condition.trim().length >= 1 &&
    condition.trim().length <= 30
  );
}

// Create a listing
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      imageUrl,
      sellerWhatsapp,
    } = req.body;

    if (!validateProductFields({ title, description, category, condition })) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide valid product details. Title must be 3-100 characters and description 10-2000 characters.",
      });
    }

    const numericPrice = Number(price);

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      numericPrice > 10000000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Price must be greater than zero and no more than 10000000",
      });
    }

    if (!isValidImageUrl(imageUrl)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid product image",
      });
    }

    const whatsapp = normalizeWhatsapp(sellerWhatsapp);

    if (whatsapp === undefined) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit Indian WhatsApp number",
      });
    }

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        category: category.trim(),
        condition: condition.trim(),
        imageUrl: imageUrl || null,
        sellerWhatsapp: whatsapp,
        sellerId: req.user.userId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Product listed successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
});

// Get available listings
router.get("/", authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "AVAILABLE" },
      include: {
        seller: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, products });
  } catch (error) {
    console.error("Fetch products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
});

// Get the logged-in user's listings
router.get("/my-listings", authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { sellerId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, products });
  } catch (error) {
    console.error("Fetch my listings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your listings",
    });
  }
});

// Update a listing or change its status
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      price,
      category,
      condition,
      imageUrl,
      sellerWhatsapp,
      status,
    } = req.body;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        sellerId: req.user.userId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not its owner",
      });
    }

    const data = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must be between 3 and 100 characters",
        });
      }

      data.title = title.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.trim().length < 10 ||
        description.trim().length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be between 10 and 2000 characters",
        });
      }

      data.description = description.trim();
    }

    if (price !== undefined) {
      const numericPrice = Number(price);

      if (
        price === null ||
        price === "" ||
        !Number.isFinite(numericPrice) ||
        numericPrice <= 0 ||
        numericPrice > 10000000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Price must be greater than zero and no more than 10000000",
        });
      }

      data.price = numericPrice;
    }

    if (category !== undefined) {
      if (
        typeof category !== "string" ||
        category.trim().length < 1 ||
        category.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
        });
      }

      data.category = category.trim();
    }

    if (condition !== undefined) {
      if (
        typeof condition !== "string" ||
        condition.trim().length < 1 ||
        condition.trim().length > 30
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid condition",
        });
      }

      data.condition = condition.trim();
    }

    if (imageUrl !== undefined) {
      if (!isValidImageUrl(imageUrl)) {
        return res.status(400).json({
          success: false,
          message: "Please upload a valid product image",
        });
      }

      data.imageUrl = imageUrl || null;
    }

    if (sellerWhatsapp !== undefined) {
      const whatsapp = normalizeWhatsapp(sellerWhatsapp);

      if (whatsapp === undefined) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid 10-digit Indian WhatsApp number",
        });
      }

      data.sellerWhatsapp = whatsapp;
    }

    if (status !== undefined) {
      if (!["AVAILABLE", "SOLD"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid listing status",
        });
      }

      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid changes provided",
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    res.json({
      success: true,
      message: "Listing updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update listing",
    });
  }
});

// Delete a listing
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        sellerId: req.user.userId,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not its owner",
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete listing",
    });
  }
});

export default router;
