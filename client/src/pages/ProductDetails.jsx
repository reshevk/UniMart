
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  User,
  Tag,
  MessageCircle,
} from "lucide-react";
import API from "../api";

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await API.get("/products");
        const foundProduct = response.data.products.find(
          (item) => item.id === id
        );

        if (!foundProduct) {
          setError("This product could not be found.");
        } else {
          setProduct(foundProduct);
          setSelectedImage(0);
        }
      } catch (err) {
        setError("Unable to load product details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const productImages = product
    ? Array.from(
        new Set([
          ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
          ...(product.imageUrl ? [product.imageUrl] : []),
        ])
      )
    : [];

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
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;
