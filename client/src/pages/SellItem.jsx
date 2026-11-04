import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ImagePlus,
  Package,
  Tag,
  IndianRupee,
  Phone,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Camera,
  Trash2,
} from "lucide-react";
import API from "../api";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function SellItem() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  function showMessage(text, type = "error") {
    setMessage(text);
    setMessageType(type);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleImageChange(e) {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) return;

    setMessage("");
    setMessageType("");

    const validFiles = [];

    if (images.length >= MAX_IMAGES) {
      showMessage(`You can upload a maximum of ${MAX_IMAGES} images.`);
      e.target.value = "";
      return;
    }

    for (const file of selectedFiles) {
      if (images.length + validFiles.length >= MAX_IMAGES) {
        showMessage(`You can upload a maximum of ${MAX_IMAGES} images.`);
        break;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        showMessage("Only JPG, PNG, and WEBP images are allowed.");
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        showMessage(`${file.name} exceeds the 5 MB image size limit.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setImages((current) => [...current, ...validFiles]);

      setPreviews((current) => [
        ...current,
        ...validFiles.map((file) => URL.createObjectURL(file)),
      ]);
    }

    e.target.value = "";
  }

  function removeImage(index) {
    setPreviews((current) => {
      URL.revokeObjectURL(current[index]);
      return current.filter((_, i) => i !== index);
    });

    setImages((current) => current.filter((_, i) => i !== index));
  }

  function validateForm() {
    if (!formData.title.trim()) {
      showMessage("Please enter a product title.");
      return false;
    }

    if (formData.title.trim().length < 3) {
      showMessage("Product title must contain at least 3 characters.");
      return false;
    }

    if (!formData.description.trim()) {
      showMessage("Please enter a product description.");
      return false;
    }

    if (!formData.price || Number(formData.price) <= 0) {
      showMessage("Please enter a valid product price.");
      return false;
    }

    if (!Number.isFinite(Number(formData.price))) {
      showMessage("Please enter a valid product price.");
      return false;
    }

    if (!formData.category) {
      showMessage("Please select a product category.");
      return false;
    }

    if (!formData.condition) {
      showMessage("Please select the product condition.");
      return false;
    }

    const whatsapp = formData.sellerWhatsapp.replace(/\D/g, "");

    if (!/^(?:91)?[6-9]\d{9}$/.test(whatsapp)) {
      showMessage(
        "Enter a valid 10-digit Indian WhatsApp number, optionally with country code 91."
      );
      return false;
    }

    return true;
  }

  async function uploadImages() {
    if (images.length === 0) return [];

    const imageData = new FormData();

    images.forEach((image) => {
      imageData.append("images", image);
    });

    const response = await API.post("/products/upload", imageData);

    return response.data.imageUrls || [];
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const imageUrls = await uploadImages();

      const response = await API.post("/products", {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        sellerWhatsapp: formData.sellerWhatsapp.replace(/\D/g, ""),
        imageUrls,
      });

      showMessage(
        response.data.message ||
          "Your product has been listed successfully!",
        "success"
      );

      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (error) {
      console.error("Product creation error:", error);

      showMessage(
        error.response?.data?.message ||
          "Unable to create your listing. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-[#e3eee7] bg-[#f8fbf9] px-4 py-3.5 text-sm text-[#18352a] outline-none transition-all duration-200 placeholder:text-[#9aaba0] hover:border-green-300 focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100/70 disabled:opacity-60";

  const labelClass =
    "mb-2.5 block text-sm font-semibold text-[#244b37]";

  const sectionClass =
    "rounded-3xl border border-[#e6efe9] bg-white/90 p-5 shadow-[0_8px_30px_rgba(24,68,44,0.035)] sm:p-7";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f9f5] text-[#18352a]">
      <div className="pointer-events-none absolute -left-32 top-32 h-80 w-80 rounded-full bg-green-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-[550px] h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />

      <nav className="sticky top-0 z-40 border-b border-green-900/[0.07] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#209b68] to-[#075b3b] text-white shadow-lg shadow-green-900/15">
              <Package size={21} />
            </div>

            <div>
              <span className="text-xl font-extrabold tracking-tight text-[#173d2c]">
                Uni<span className="text-[#15915b]">Mart</span>
              </span>
              <p className="text-[10px] font-medium tracking-wider text-[#83978a]">
                BUILT FOR SST
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl border border-green-100 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-[#38684d] transition hover:border-green-300 hover:bg-green-50 sm:text-sm"
          >
            <ArrowLeft size={16} />
            <span>Marketplace</span>
          </Link>
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200/70 bg-white/75 px-3 py-1.5 text-xs font-semibold text-green-800 shadow-sm">
              <Sparkles size={14} />
              Your campus marketplace
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#173d2c] sm:text-4xl">
              Sell something
              <span className="text-[#15915b]"> today.</span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#75877b] sm:text-base">
              Turn unused items into something useful for another student.
              Create your listing in just a few steps.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#315840]">
                Student marketplace
              </p>
              <p className="mt-0.5 text-[11px] text-[#829388]">
                Built for SST
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {message && (
            <div
              role="alert"
              className={`flex items-start gap-3 rounded-2xl border p-4 text-sm shadow-sm ${
                messageType === "success"
                  ? "border-green-200 bg-green-50/90 text-green-800"
                  : "border-red-200 bg-red-50/90 text-red-700"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
              )}

              <p className="font-medium leading-6">{message}</p>
            </div>
          )}

          <section className={sectionClass}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                    <Camera size={18} />
                  </div>
                  <h2 className="text-base font-bold text-[#214532]">
                    Product photos
                  </h2>
                </div>

                <p className="mt-2 text-xs leading-5 text-[#87968c]">
                  Good photos help your item get noticed.
                  Add up to {MAX_IMAGES} images.
                </p>
              </div>

              <span className="shrink-0 rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />

            {previews.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#c9dfd0] bg-[#f7fbf8] px-5 py-12 text-center transition duration-200 hover:border-green-500 hover:bg-green-50/70"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-green-100 bg-white text-green-700 shadow-sm transition group-hover:scale-105 group-hover:shadow-md">
                  <ImagePlus size={29} />
                </div>

                <p className="text-sm font-bold text-[#315840]">
                  Click to upload product photos
                </p>

                <p className="mt-2 text-xs text-[#91a096]">
                  JPG, PNG or WEBP · Maximum 5 MB per image
                </p>

                <span className="mt-5 rounded-xl bg-[#16865a] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-green-900/10 transition group-hover:bg-[#0d7048]">
                  Choose images
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {previews.map((preview, index) => (
                  <div
                    key={preview}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-green-100 bg-green-50"
                  >
                    <img
                      src={preview}
                      alt={`Product preview ${index + 1}`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute right-2 top-2 rounded-xl bg-black/60 p-2 text-white shadow-sm transition hover:bg-red-600"
                    >
                      <X size={15} />
                    </button>

                    {index === 0 && (
                      <span className="absolute bottom-2 left-2 rounded-lg bg-[#147d50] px-2 py-1 text-[9px] font-extrabold tracking-wide text-white">
                        COVER PHOTO
                      </span>
                    )}
                  </div>
                ))}

                {images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 text-green-700 transition hover:border-green-500 hover:bg-green-50"
                  >
                    <ImagePlus size={24} />
                    <span className="text-xs font-bold">Add more</span>
                  </button>
                )}
              </div>
            )}

            {previews.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-[#829388]">
                  First image will be your cover photo.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    previews.forEach((preview) =>
                      URL.revokeObjectURL(preview)
                    );
                    setPreviews([]);
                    setImages([]);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 transition hover:text-red-700"
                >
                  <Trash2 size={13} />
                  Remove all
                </button>
              </div>
            )}
          </section>

          <section className={sectionClass}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Package size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#214532]">
                  Item details
                </h2>
                <p className="mt-0.5 text-xs text-[#87968c]">
                  Tell buyers what you are selling.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="title" className={labelClass}>
                  Product title <span className="text-red-500">*</span>
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Scientific Calculator"
                  maxLength={100}
                  required
                  disabled={loading}
                  className={inputClass}
                />

                <p className="mt-2 text-right text-[11px] text-[#9aa99e]">
                  {formData.title.length}/100 characters
                </p>
              </div>

              <div>
                <label htmlFor="description" className={labelClass}>
                  Description <span className="text-red-500">*</span>
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the item, its condition, how long you've used it, and any useful details..."
                  rows={5}
                  maxLength={1000}
                  required
                  disabled={loading}
                  className={`${inputClass} resize-y`}
                />

                <p className="mt-2 text-right text-[11px] text-[#9aa99e]">
                  {formData.description.length}/1000 characters
                </p>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Tag size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#214532]">
                  Pricing and classification
                </h2>
                <p className="mt-0.5 text-xs text-[#87968c]">
                  Help buyers find the right item.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className={labelClass}>
                  Selling price <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <IndianRupee
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#81968a]"
                  />

                  <input
                    id="price"
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="Enter price"
                    min="0.01"
                    step="0.01"
                    required
                    disabled={loading}
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className={labelClass}>
                  Category <span className="text-red-500">*</span>
                </label>

                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  <option value="Books">Books</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Cycles">Cycles</option>
                  <option value="Food & Snacks">Food & Snacks</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="condition" className={labelClass}>
                  Product condition <span className="text-red-500">*</span>
                </label>

                <select
                  id="condition"
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={inputClass}
                >
                  <option value="">Select product condition</option>
                  <option value="New">New</option>
                  <option value="Like New">Like New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Phone size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#214532]">
                  Contact information
                </h2>
                <p className="mt-0.5 text-xs text-[#87968c]">
                  Give interested buyers a way to reach you.
                </p>
              </div>
            </div>

            <label htmlFor="sellerWhatsapp" className={labelClass}>
              WhatsApp number <span className="text-red-500">*</span>
            </label>

            <input
              id="sellerWhatsapp"
              name="sellerWhatsapp"
              type="tel"
              inputMode="numeric"
              value={formData.sellerWhatsapp}
              onChange={handleChange}
              placeholder="e.g. 9876543210"
              maxLength={13}
              required
              disabled={loading}
              className={inputClass}
            />

            <p className="mt-2 text-xs leading-5 text-[#87968c]">
              Buyers can use this number to contact you about your listing.
              Enter your 10-digit Indian number, optionally with country code 91.
            </p>
          </section>

          <section className="rounded-3xl border border-green-200/70 bg-gradient-to-br from-[#eaf6ed] via-white to-[#f1f9f2] p-5 shadow-[0_8px_30px_rgba(24,68,44,0.035)] sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm">
                <Sparkles size={20} />
              </div>

              <div>
                <h2 className="font-bold text-[#214532]">
                  Ready to publish?
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#75877b]">
                  Double-check your details and photos. Your listing will
                  become available to other students once published.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <Link
                to="/"
                className="flex items-center justify-center rounded-xl border border-green-200 bg-white px-5 py-3.5 text-sm font-semibold text-[#42634e] transition hover:bg-green-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/15 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 size={19} className="animate-spin" />
                    Publishing your listing...
                  </>
                ) : (
                  <>
                    <Upload size={19} />
                    Publish listing
                  </>
                )}
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-[#94a399]">
              By publishing, you confirm that your listing details are accurate.
            </p>
          </section>
        </form>

        <footer className="pb-4 pt-8 text-center">
          <p className="text-xs font-semibold tracking-wide text-[#8ba092]">
            Built for SST
          </p>
          <p className="mt-1 text-[10px] text-[#a3b0a7]">
            Made for your campus community.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default SellItem;