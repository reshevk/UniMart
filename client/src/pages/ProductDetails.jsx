
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
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ShoppingBag,
  MapPin,
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

function getHostelLabel(hostel) {
  const hostelLabels = {
    UNI_WORLD_1: "UniWorld 1",
    UNI_WORLD_2: "UniWorld 2",
  };

  return hostelLabels[hostel] || "Not specified";
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
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

        const products = response.data.products || [];
        setAllProducts(products);

        const foundProduct = products.find((item) => item.id === id);

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

  const recommendations = allProducts
    .filter(
      (item) =>
        item.id !== id &&
        item.status !== "REMOVED" &&
        item.status !== "SOLD"
    )
    .sort((a, b) => {
      const aMatch = a.category === product?.category ? 1 : 0;
      const bMatch = b.category === product?.category ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 4);

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
    return (
      <div className="min-h-screen bg-[#f7faf7] px-5 py-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-8 h-5 w-24 rounded bg-green-100" />
          <div className="grid gap-10 md:grid-cols-2">
            <div className="h-[420px] rounded-[2rem] bg-green-100/70" />
            <div className="space-y-5">
              <div className="h-5 w-28 rounded bg-green-100" />
              <div className="h-10 w-3/4 rounded bg-green-100" />
              <div className="h-10 w-1/3 rounded bg-green-100" />
              <div className="h-32 rounded-2xl bg-green-100" />
              <div className="h-14 rounded-2xl bg-green-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f7faf7] px-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green-100 text-green-700">
          <Package size={38} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Product unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {error || "Product not found."}
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-800"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7faf7] px-4 py-6 sm:px-6 sm:py-9 md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 rounded-xl border border-green-100 bg-white/80 px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-xl transition hover:border-green-200 hover:text-green-800"
          >
            <ArrowLeft
              size={17}
              className="transition group-hover:-translate-x-1"
            />
            Back to marketplace
          </button>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <span>UniMart</span>
            <ChevronRight size={14} />
            <span>{product.category}</span>
            <ChevronRight size={14} />
            <span className="max-w-32 truncate text-green-700">
              Product details
            </span>
          </div>
        </div>

        {/* Main product layout */}
        <div className="grid items-start gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          {/* Image gallery */}
          <section className="min-w-0">
            <div className="overflow-hidden rounded-[1.75rem] border border-green-100/80 bg-white/80 p-3 shadow-[0_15px_50px_rgba(22,101,52,0.07)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-4">
              <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-green-50 via-white to-[#eaf6ec] sm:h-[420px] md:h-[480px]">
                {productImages.length > 0 ? (
                  <>
                    <img
                      src={productImages[selectedImage]}
                      alt={`${product.title} - Image ${selectedImage + 1}`}
                      className="h-full w-full object-contain p-4 sm:p-8"
                    />

                    {productImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={showPreviousImage}
                          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/85 text-green-800 shadow-lg backdrop-blur-xl transition hover:scale-105 hover:bg-white sm:left-4 sm:h-12 sm:w-12"
                          aria-label="Previous image"
                        >
                          <ArrowLeft size={20} />
                        </button>

                        <button
                          type="button"
                          onClick={showNextImage}
                          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/85 text-green-800 shadow-lg backdrop-blur-xl transition hover:scale-105 hover:bg-white sm:right-4 sm:h-12 sm:w-12"
                          aria-label="Next image"
                        >
                          <ArrowRight size={20} />
                        </button>

                        <span className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                          {selectedImage + 1} / {productImages.length}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-green-200">
                    <Package size={76} strokeWidth={1.2} />
                    <span className="text-sm font-medium text-green-700/60">
                      No product image
                    </span>
                  </div>
                )}

                <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-green-800 shadow-sm backdrop-blur-xl">
                  <Sparkles size={13} />
                  UniMart listing
                </div>
              </div>

              {productImages.length > 1 && (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                  {productImages.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl border-2 bg-green-50 transition sm:h-[78px] sm:w-[78px] ${
                        selectedImage === index
                          ? "border-green-600 ring-2 ring-green-100"
                          : "border-transparent opacity-70 hover:border-green-300 hover:opacity-100"
                      }`}
                      aria-label={`View image ${index + 1}`}
                      aria-pressed={selectedImage === index}
                    >
                      <img
                        src={image}
                        alt={`${product.title} thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trust note */}
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-green-100/80 bg-white/65 p-4 backdrop-blur-xl">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <ShieldCheck size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Shop within your campus community
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Connect with the seller, ask questions, and agree on a safe
                  way to exchange the item.
                </p>
              </div>
            </div>
          </section>

          {/* Product information */}
          <section className="min-w-0">
            <div className="rounded-[1.75rem] border border-green-100/80 bg-white/80 p-5 shadow-[0_15px_50px_rgba(22,101,52,0.06)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800">
                  {product.category}
                </span>
                {product.condition && (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
                    {product.condition}
                  </span>
                )}
              </div>

              <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-gray-950 sm:text-3xl lg:text-[2.15rem]">
                {product.title}
              </h1>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-green-100 pb-6">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-gray-400">
                    Listed price
                  </p>
                  <p className="text-3xl font-extrabold tracking-tight text-green-700 sm:text-4xl">
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="rounded-xl bg-green-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-700/60">
                    Marketplace
                  </p>
                  <p className="text-sm font-bold text-green-800">
                    Built for SST
                  </p>
                </div>
              </div>

              {/* Seller card */}
              <div className="mt-6 rounded-2xl border border-green-100 bg-gradient-to-r from-green-50/90 to-white p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-800">
                    <User size={23} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Listed by
                    </p>
                    <p className="mt-0.5 truncate font-bold text-gray-900">
                      {product.seller?.name || "Student"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      SST student marketplace
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-green-700 shadow-sm">
                    <ShieldCheck size={13} />
                    Campus
                  </div>
                </div>
              </div>

              {/* Product attributes */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <Tag size={17} />
                    <span className="text-xs font-semibold text-gray-500">
                      Condition
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {product.condition || "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <ShoppingBag size={17} />
                    <span className="text-xs font-semibold text-gray-500">
                      Category
                    </span>
                  </div>
                  <p className="truncate text-sm font-bold text-gray-900">
                    {product.category || "Other"}
                  </p>
                </div>

                <div className="rounded-xl border border-green-100 bg-green-50/70 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <MapPin size={17} />
                    <span className="text-xs font-semibold text-gray-500">
                      Hostel
                    </span>
                  </div>
                  <p className="text-sm font-bold text-green-900">
                    {getHostelLabel(product.hostel)}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="mt-7">
                <h2 className="text-base font-bold text-gray-900">
                  About this item
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {product.description || "No description provided."}
                </p>
              </div>

              {/* Contact actions */}
              <div className="mt-7 space-y-3 border-t border-green-100 pt-6">
                {product.sellerWhatsapp ? (
                  <button
                    onClick={contactSeller}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/15 transition hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-xl"
                  >
                    <MessageCircle size={19} />
                    Contact seller on WhatsApp
                  </button>
                ) : (
                  <div className="rounded-2xl bg-gray-100 p-4 text-center text-sm text-gray-500">
                    Seller hasn't added a WhatsApp number yet.
                  </div>
                )}

                <button
                  onClick={startChat}
                  disabled={chatLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white py-4 text-sm font-bold text-green-800 transition hover:border-green-400 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageCircle size={19} />
                  {chatLoading ? "Opening chat..." : "Chat with seller"}
                </button>

                {chatError && (
                  <p className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-600">
                    {chatError}
                  </p>
                )}
              </div>

              {/* Report actions */}
              <div className="mt-6 border-t border-gray-100 pt-5">
                <p className="mb-3 text-center text-xs font-medium text-gray-400">
                  Something doesn't look right?
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => openReport("LISTING")}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Flag size={15} />
                    Report listing
                  </button>

                  <button
                    type="button"
                    onClick={() => openReport("USER")}
                    disabled={!sellerId}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Flag size={15} />
                    Report seller
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="mt-14 sm:mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-green-700">
                  <Sparkles size={15} />
                  Discover more
                </div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                  You might also like
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  More items from your campus marketplace.
                </p>
              </div>

              <button
                onClick={() => navigate("/")}
                className="flex shrink-0 items-center gap-1 text-xs font-bold text-green-700 transition hover:text-green-900 sm:text-sm"
              >
                Explore all
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {recommendations.map((item) => {
                const image =
                  item.imageUrl ||
                  (Array.isArray(item.imageUrls) ? item.imageUrls[0] : null);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/products/${item.id}`)}
                    className="group min-w-0 overflow-hidden rounded-2xl border border-green-100/80 bg-white/85 text-left shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg hover:shadow-green-900/5 sm:rounded-3xl"
                  >
                    <div className="flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 to-[#eaf6ec] sm:h-48">
                      {image ? (
                        <img
                          src={image}
                          alt={item.title}
                          className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105 sm:p-5"
                        />
                      ) : (
                        <Package
                          size={38}
                          className="text-green-200"
                          strokeWidth={1.3}
                        />
                      )}
                    </div>

                    <div className="p-3 sm:p-4">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-green-700">
                        {item.category || "Other"}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-bold text-gray-900 sm:text-base">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-base font-extrabold text-green-700">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-14 border-t border-green-100 py-7 text-center">
          <p className="text-xs font-semibold tracking-wide text-green-800">
            Built for SST
          </p>
        </footer>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-green-100 bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <Flag size={20} />
                </div>
                <h2
                  id="report-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Report {reportTarget === "LISTING" ? "listing" : "seller"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Help keep UniMart safe. Your report will be reviewed by the
                  UniMart team.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportLoading}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close report dialog"
              >
                <X size={20} />
              </button>
            </div>

            {reportSuccess ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <ShieldCheck size={21} />
                  </div>
                  <p className="font-bold text-green-900">
                    Report submitted
                  </p>
                  <p className="mt-1 text-sm leading-6 text-green-800">
                    {reportSuccess}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="w-full rounded-xl bg-green-700 py-3.5 font-semibold text-white transition hover:bg-green-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-5">
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
                    className="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-sm outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
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
                    Additional details{" "}
                    <span className="font-normal text-gray-400">
                      (optional)
                    </span>
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
                    className="w-full resize-y rounded-xl border border-gray-200 p-3.5 text-sm outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  />

                  <p className="mt-1.5 text-right text-xs text-gray-400">
                    {reportDescription.length}/1000
                  </p>
                </div>

                {reportError && (
                  <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {reportError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reportLoading}
                  className="w-full rounded-xl bg-green-700 py-3.5 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
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
