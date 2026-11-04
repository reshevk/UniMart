
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  User,
  Tag,
  MessageCircle,
  Flag,
  X,
} from "lucide-react";
import API from "../api";

const REPORT_REASONS = [
  "Scam or fraud",
  "Prohibited or unsafe item",
  "Misleading listing information",
  "Harassment or abusive behaviour",
  "Spam or duplicate listing",
  "Other",
];

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState("LISTING");
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchProduct() {
      try {
        const response = await API.get("/products");

        if (!active) return;

        const foundProduct = response.data.products.find(
          (item) => item.id === id
        );

        if (!foundProduct) {
          setError("This product could not be found.");
        } else {
          setProduct(foundProduct);
          setSelectedImage(0);
        }
      } catch {
        if (active) {
          setError("Unable to load product details. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchProduct();

    return () => {
      active = false;
    };
  }, [id]);

  const productImages = product
    ? Array.from(
        new Set([
          ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
          ...(product.imageUrl ? [product.imageUrl] : []),
        ])
      )
    : [];

  const sellerId = product?.seller?.id || product?.sellerId;

  function contactSeller() {
    if (!product?.sellerWhatsapp) return;

    const message = `Hi! I'm interested in your listing "${product.title}" on UniMart. Is it still available?`;
    const url = `https://wa.me/${product.sellerWhatsapp}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function showPreviousImage() {
    setSelectedImage((current) =>
      current === 0 ? productImages.length - 1 : current - 1
    );
  }

  function showNextImage() {
    setSelectedImage((current) =>
      current === productImages.length - 1 ? 0 : current + 1
    );
  }

  async function startChat() {
    const token = localStorage.getItem("unimart_token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setChatLoading(true);
      setChatError("");

      const response = await API.post("/chat/conversations", {
        productId: id,
      });

      const conversationId = response.data.conversation?.id;

      if (!conversationId) {
        throw new Error("Conversation ID was not returned.");
      }

      navigate(`/chat/${conversationId}`);
    } catch (err) {
      setChatError(
        err.response?.data?.message ||
          err.message ||
          "Unable to start chat. Please try again."
      );
    } finally {
      setChatLoading(false);
    }
  }

  function openReport(target) {
    if (!localStorage.getItem("unimart_token")) {
      navigate("/login");
      return;
    }

    setReportTarget(target);
    setReportReason("");
    setReportDescription("");
    setReportError("");
    setReportSuccess("");
    setReportOpen(true);
  }

  async function submitReport(event) {
    event.preventDefault();

    if (!reportReason) {
      setReportError("Please select a reason.");
      return;
    }

    try {
      setReportLoading(true);
      setReportError("");

      const payload = {
        targetType: reportTarget,
        reason: reportReason,
        description: reportDescription,
      };

      if (reportTarget === "LISTING") {
        payload.productId = id;
      } else {
        if (!sellerId) {
          setReportError("Seller information is unavailable.");
          return;
        }

        payload.reportedUserId = sellerId;
      }

      const response = await API.post("/reports", payload);

      setReportSuccess(
        response.data.message || "Your report has been submitted."
      );
      setReportReason("");
      setReportDescription("");
    } catch (err) {
      setReportError(
        err.response?.data?.message ||
          "Unable to submit your report. Please try again."
      );
    } finally {
      setReportLoading(false);
    }
  }

  if (loading) {
    return <div className="p-10 text-center">Loading product...</div>;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>{error || "Product not found."}</p>
        <button
          onClick={() => navigate("/")}
          className="text-green-700 font-semibold"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-8 md:px-12">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-green-700 font-medium"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
        <div>
          <div className="relative rounded-3xl bg-white/70 border border-green-100 overflow-hidden min-h-80 flex items-center justify-center">
            {productImages.length > 0 ? (
              <>
                <img
                  src={productImages[selectedImage]}
                  alt={`${product.title} - Image ${selectedImage + 1}`}
                  className="w-full h-80 object-contain"
                />

                {productImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-green-800 shadow-md hover:bg-white"
                      aria-label="Previous image"
                    >
                      <ArrowLeft size={20} />
                    </button>

                    <button
                      type="button"
                      onClick={showNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-green-800 shadow-md hover:bg-white"
                      aria-label="Next image"
                    >
                      <ArrowRight size={20} />
                    </button>

                    <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                      {selectedImage + 1} / {productImages.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <Package size={80} className="text-green-200" />
            )}
          </div>

          {productImages.length > 1 && (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {productImages.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={`overflow-hidden rounded-xl border-2 transition ${
                    selectedImage === index
                      ? "border-green-600"
                      : "border-transparent hover:border-green-300"
                  }`}
                  aria-label={`View image ${index + 1}`}
                  aria-pressed={selectedImage === index}
                >
                  <img
                    src={image}
                    alt={`${product.title} thumbnail ${index + 1}`}
                    className="h-16 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-green-700 font-semibold mb-2">
              {product.category}
            </p>

            <h1 className="text-3xl font-bold text-gray-900">
              {product.title}
            </h1>

            <p className="text-3xl font-bold text-green-700 mt-4">
              ₹{Number(product.price).toLocaleString("en-IN")}
            </p>
          </div>

          <div className="bg-white/70 border border-green-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Tag className="text-green-700" size={20} />
              <div>
                <p className="text-sm text-gray-500">Condition</p>
                <p className="font-semibold">{product.condition}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="text-green-700" size={20} />
              <div>
                <p className="text-sm text-gray-500">Seller</p>
                <p className="font-semibold">
                  {product.seller?.name || "Student"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-2">Description</h2>
            <p className="text-gray-600 leading-7 whitespace-pre-wrap">
              {product.description}
            </p>
          </div>

          {product.sellerWhatsapp ? (
            <button
              onClick={contactSeller}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 text-white py-3 font-semibold transition hover:bg-green-700"
            >
              <MessageCircle size={20} />
              Contact Seller on WhatsApp
            </button>
          ) : (
            <div className="rounded-xl bg-gray-100 p-4 text-center text-sm text-gray-500">
              Seller hasn't added a WhatsApp number yet.
            </div>
          )}

          <button
            onClick={startChat}
            disabled={chatLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-green-600 text-green-700 py-3 font-semibold transition hover:bg-green-50 disabled:opacity-50"
          >
            <MessageCircle size={20} />
            {chatLoading ? "Opening chat..." : "Chat with Seller"}
          </button>

          {chatError && (
            <p className="text-sm text-red-600 text-center">{chatError}</p>
          )}

          <div className="border-t border-green-100 pt-4 space-y-3">
            <p className="text-sm text-gray-500 text-center">
              See something that doesn't look right?
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => openReport("LISTING")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 py-3 font-medium hover:bg-red-50 transition"
              >
                <Flag size={17} />
                Report listing
              </button>

              <button
                type="button"
                onClick={() => openReport("USER")}
                disabled={!sellerId}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 py-3 font-medium hover:bg-red-50 transition disabled:opacity-50"
              >
                <Flag size={17} />
                Report seller
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !reportLoading) {
              setReportOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="w-full max-w-lg rounded-3xl border border-green-100 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="report-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Report {reportTarget === "LISTING" ? "listing" : "seller"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Your report will be reviewed by the UniMart team.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportLoading}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close report dialog"
              >
                <X size={20} />
              </button>
            </div>

            {reportSuccess ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
                  {reportSuccess}
                </div>

                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-4">
                <div>
                  <label
                    htmlFor="report-reason"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Why are you reporting this?
                  </label>

                  <select
                    id="report-reason"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Select a reason</option>
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="report-description"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Additional details (optional)
                  </label>

                  <textarea
                    id="report-description"
                    value={reportDescription}
                    onChange={(event) =>
                      setReportDescription(event.target.value)
                    }
                    maxLength={1000}
                    rows={4}
                    placeholder="Tell us a little more about the issue..."
                    className="w-full resize-y rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />

                  <p className="mt-1 text-right text-xs text-gray-400">
                    {reportDescription.length}/1000
                  </p>
                </div>

                {reportError && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {reportError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reportLoading}
                  className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reportLoading ? "Submitting..." : "Submit report"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetails;
