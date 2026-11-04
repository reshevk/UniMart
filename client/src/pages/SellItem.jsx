
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ImagePlus,
  Package,
  Tag,
  IndianRupee,
  FileText,
  Phone,
  X,
} from "lucide-react";
import API from "../api";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function SellItem() {
  const navigate = useNavigate();
  const previewUrlsRef = useRef(new Set());

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    sellerWhatsapp: "",
  });

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrls.clear();
    };
  }, []);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleImageChange(e) {
    const selectedImages = Array.from(e.target.files || []);

    if (selectedImages.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;

    if (remainingSlots <= 0) {
      setMessage("You can upload a maximum of 5 images.");
      e.target.value = "";
      return;
    }

    if (selectedImages.length > remainingSlots) {
      setMessage(
        `You can select only ${remainingSlots} more image(s).`
      );
      e.target.value = "";
      return;
    }

    for (const image of selectedImages) {
      if (!ALLOWED_TYPES.includes(image.type)) {
        setMessage("Please select only JPG, PNG or WebP images.");
        e.target.value = "";
        return;
      }

      if (image.size > MAX_FILE_SIZE) {
        setMessage("Each image must be 5 MB or smaller.");
        e.target.value = "";
        return;
      }
    }

    const newPreviews = selectedImages.map((image) => {
      const url = URL.createObjectURL(image);
      previewUrlsRef.current.add(url);

      return {
        file: image,
        url,
      };
    });

    setImages((previousImages) => [
      ...previousImages,
      ...selectedImages,
    ]);

    setPreviews((previousPreviews) => [
      ...previousPreviews,
      ...newPreviews,
    ]);

    setMessage("");
    e.target.value = "";
  }

  function removeImage(index) {
    const previewToRemove = previews[index];

    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
      previewUrlsRef.current.delete(previewToRemove.url);
    }

    setImages((previousImages) =>
      previousImages.filter((_, i) => i !== index)
    );

    setPreviews((previousPreviews) =>
      previousPreviews.filter((_, i) => i !== index)
    );

    setMessage("");
  }

  async function uploadImages() {
    const imageData = new FormData();

    images.forEach((image) => {
      imageData.append("images", image);
    });

    const response = await API.post(
      "/products/upload",
      imageData
    );

    const imageUrls = response.data.imageUrls;

    if (
      !Array.isArray(imageUrls) ||
      imageUrls.length !== images.length
    ) {
      throw new Error("Image upload returned an invalid response.");
    }

    return imageUrls;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const whatsapp = formData.sellerWhatsapp.trim();
    const digits = whatsapp.replace(/\D/g, "");

    if (
      whatsapp &&
      !(/^\d{10}$/.test(digits) || /^91\d{10}$/.test(digits))
    ) {
      setMessage("Enter a valid 10-digit Indian WhatsApp number.");
      return;
    }

    setLoading(true);

    try {
      let imageUrls = [];

      if (images.length > 0) {
        setMessage("Uploading your images... Please wait.");
        imageUrls = await uploadImages();
      }

      setMessage("Publishing your listing...");

      const response = await API.post("/products", {
        ...formData,
        price: Number(formData.price),
        imageUrls,
      });

      setMessage(response.data.message);

      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Unable to list your product. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4faf6] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-green-800 hover:text-green-600"
        >
          <ArrowLeft size={18} />
          Back to UniMart
        </Link>

        <div className="rounded-3xl border border-white bg-white/75 p-6 shadow-xl backdrop-blur-xl sm:p-10">
          <div className="mb-8">
            <div className="mb-4 inline-flex rounded-2xl bg-green-100 p-3 text-green-800">
              <Package size={26} />
            </div>

            <h1 className="text-3xl font-bold text-[#075c3b]">
              Sell an Item
            </h1>

            <p className="mt-2 text-gray-500">
              Give your unused items a new home within your college.
            </p>
          </div>

          {message && (
            <div className="mb-6 rounded-xl bg-green-100 p-3 text-sm font-medium text-green-800">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Product Title
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Tag size={18} className="text-gray-400" />

                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Engineering Mathematics Textbook"
                  className="w-full py-3 outline-none"
                  maxLength={100}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Description
              </label>

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <FileText size={18} className="mt-3 text-gray-400" />

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your item's condition and other details..."
                  className="w-full resize-none py-3 outline-none"
                  rows={4}
                  maxLength={1000}
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Price (₹)
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                  <IndianRupee size={18} className="text-gray-400" />

                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="500"
                    className="w-full py-3 outline-none"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Category
                </label>

                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none"
                  required
                >
                  <option value="">Select category</option>
                  <option value="Books">Books</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Cycles">Cycles</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Item Condition
              </label>

              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none"
                required
              >
                <option value="">Select condition</option>
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                WhatsApp Number (Optional)
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Phone size={18} className="text-gray-400" />

                <input
                  type="tel"
                  name="sellerWhatsapp"
                  value={formData.sellerWhatsapp}
                  onChange={handleChange}
                  placeholder="10-digit WhatsApp number"
                  className="w-full py-3 outline-none"
                  maxLength={15}
                />
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Enter your 10-digit Indian number, with or without +91.
                Buyers can use it to contact you.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Product Images (Optional)
              </label>

              <div className="rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 p-5">
                {previews.length > 0 && (
                  <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {previews.map((preview, index) => (
                      <div
                        key={`${preview.file.name}-${index}`}
                        className="relative overflow-hidden rounded-xl border border-green-200 bg-white p-2"
                      >
                        <img
                          src={preview.url}
                          alt={`Product preview ${index + 1}`}
                          className="h-32 w-full rounded-lg object-cover"
                        />

                        {index === 0 && (
                          <span className="mt-2 block text-center text-xs font-semibold text-green-800">
                            Cover image
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          disabled={loading}
                          className="absolute right-3 top-3 rounded-full bg-white p-2 text-red-600 shadow hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Remove image ${index + 1}`}
                        >
                          <X size={16} />
                        </button>

                        <p className="mt-1 truncate text-center text-xs text-gray-500">
                          {preview.file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {images.length < MAX_IMAGES && (
                  <label className="flex cursor-pointer flex-col items-center p-4 text-center transition hover:bg-green-50">
                    <ImagePlus size={34} className="mb-3 text-green-700" />

                    <span className="font-semibold text-gray-700">
                      Click to add product images
                    </span>

                    <span className="mt-2 text-xs text-gray-500">
                      JPG, PNG or WebP · Maximum 5 MB each
                    </span>

                    <span className="mt-1 text-xs font-medium text-green-800">
                      {images.length} of {MAX_IMAGES} images selected
                    </span>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                )}

                {images.length === MAX_IMAGES && (
                  <p className="text-center text-sm font-medium text-green-800">
                    Maximum of 5 images selected.
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Publish Listing"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SellItem;
