
import { v2 as cloudinary } from "cloudinary";
import express from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_IMAGES,
  },
});

const handleImageUpload = (req, res, next) => {
  upload.array("images", MAX_IMAGES)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const status =
        error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

      return res.status(status).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Each image must be 5 MB or smaller."
            : "Invalid image upload. You can upload up to 5 images.",
      });
    }

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Unable to process image upload.",
      });
    }

    next();
  });
};

const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_CLOUD = "vibzzs2e";

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  if (typeof url !== "string" || url.length > 2048) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === CLOUDINARY_HOST &&
      parsed.pathname.startsWith(
        `/${CLOUDINARY_CLOUD}/image/upload/`
      )
    );
  } catch {
    return false;
  }
}

function validateImageUrls(imageUrls) {
  return (
    Array.isArray(imageUrls) &&
    imageUrls.length <= MAX_IMAGES &&
    imageUrls.every(isValidImageUrl)
  );
}

function validateProductFields({
  title,
  description,
  category,
  condition,
}) {
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

// Upload multiple images securely to Cloudinary
router.post(
  "/upload",
  authenticateToken,
  handleImageUpload,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one image.",
        });
      }

      const validatedFiles = [];

      // Validate every image before uploading any of them
      for (const file of req.files) {
        const fileType = await fileTypeFromBuffer(file.buffer);

        if (
          !fileType ||
          ALLOWED_IMAGE_TYPES[fileType.mime] !== fileType.ext
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Only valid JPG, PNG, and WebP images are allowed.",
          });
        }

        validatedFiles.push(file);
      }

      const imageUrls = [];

      // Upload validated images to Cloudinary
      for (const file of validatedFiles) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "unimart",
              resource_type: "image",
            },
            (error, uploadedImage) => {
              if (error) {
                reject(error);
              } else {
                resolve(uploadedImage);
              }
            }
          );

          stream.end(file.buffer);
        });

        imageUrls.push(result.secure_url);
      }

      return res.status(200).json({
        success: true,
        imageUrls,
      });
    } catch (error) {
      console.error("Image upload error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Image upload failed. Please try again.",
      });
    }
  }
);

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
      imageUrls,
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
          "Price must be greater than zero and no more than 10000000.",
      });
    }

    const finalImageUrls =
      imageUrls !== undefined
        ? imageUrls
        : imageUrl
          ? [imageUrl]
          : [];

    if (
      !validateImageUrls(finalImageUrls) ||
      (imageUrl && !isValidImageUrl(imageUrl))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid product images.",
      });
    }

    const whatsapp = normalizeWhatsapp(sellerWhatsapp);

    if (whatsapp === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid 10-digit Indian WhatsApp number.",
      });
    }

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        category: category.trim(),
        condition: condition.trim(),
        imageUrl: finalImageUrls[0] || null,
        imageUrls: finalImageUrls,
        sellerWhatsapp: whatsapp,
        sellerId: req.user.userId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product listed successfully.",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product.",
    });
  }
});

// Get available listings
router.get("/", async (req, res) => {
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

    return res.json({ success: true, products });
  } catch (error) {
    console.error("Fetch products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products.",
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

    return res.json({ success: true, products });
  } catch (error) {
    console.error("Fetch my listings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your listings.",
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
      imageUrls,
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
        message: "Listing not found or you are not its owner.",
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
          message: "Title must be between 3 and 100 characters.",
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
          message: "Description must be between 10 and 2000 characters.",
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
            "Price must be greater than zero and no more than 10000000.",
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
          message: "Invalid category.",
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
          message: "Invalid condition.",
        });
      }

      data.condition = condition.trim();
    }

    if (imageUrls !== undefined || imageUrl !== undefined) {
      const finalImageUrls =
        imageUrls !== undefined
          ? imageUrls
          : imageUrl
            ? [imageUrl]
            : [];

      if (
        !validateImageUrls(finalImageUrls) ||
        (imageUrl && !isValidImageUrl(imageUrl))
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide valid product images.",
        });
      }

      data.imageUrls = finalImageUrls;
      data.imageUrl = finalImageUrls[0] || null;
    }

    if (sellerWhatsapp !== undefined) {
      const whatsapp = normalizeWhatsapp(sellerWhatsapp);

      if (whatsapp === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid 10-digit Indian WhatsApp number.",
        });
      }

      data.sellerWhatsapp = whatsapp;
    }

    if (status !== undefined) {
      if (!["AVAILABLE", "SOLD"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid listing status.",
        });
      }

      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid changes provided.",
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return res.json({
      success: true,
      message: "Listing updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update listing.",
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
        message: "Listing not found or you are not its owner.",
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Listing deleted successfully.",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete listing.",
    });
  }
});

export default router;
