
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        }
      } catch (err) {
        setError("Unable to load product details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  function contactSeller() {
    if (!product?.sellerWhatsapp) return;

    const message = `Hi! I'm interested in your listing "${product.title}" on UniMart. Is it still available?`;
    const url = `https://wa.me/${product.sellerWhatsapp}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
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
        <div className="rounded-3xl bg-white/70 border border-green-100 overflow-hidden min-h-80 flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full min-h-80 object-cover"
            />
          ) : (
            <Package size={80} className="text-green-200" />
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
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;
