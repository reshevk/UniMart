
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Trash2, Package } from "lucide-react";
import API from "../api";

export default function Wishlist() {
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("unimart_wishlist") || "[]");
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/products")
      .then((response) => {
        setProducts(response.data.products || []);
      })
      .catch(() => {
        setError("Could not load wishlist products.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const savedProducts = products.filter((product) =>
    wishlistIds.includes(product.id)
  );

  function removeFromWishlist(id) {
    const updated = wishlistIds.filter((itemId) => itemId !== id);
    setWishlistIds(updated);
    localStorage.setItem("unimart_wishlist", JSON.stringify(updated));
  }

  return (
    <div className="min-h-screen bg-[#f4faf6] px-5 py-10 text-[#18352a]">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-950"
        >
          <ArrowLeft size={18} />
          Back to marketplace
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Heart size={30} className="fill-red-500 text-red-500" />
            <h1 className="text-3xl font-bold">My Wishlist</h1>
          </div>

          <p className="mt-2 text-gray-500">
            Products you've saved for later.
          </p>
        </div>

        {loading ? (
          <p className="py-16 text-center text-gray-500">
            Loading your wishlist...
          </p>
        ) : error ? (
          <p className="rounded-2xl bg-red-50 p-5 text-center text-red-600">
            {error}
          </p>
        ) : savedProducts.length === 0 ? (
          <div className="rounded-3xl border border-green-100 bg-white p-12 text-center">
            <Heart size={42} className="mx-auto mb-4 text-green-700" />

            <h2 className="text-xl font-bold">
              Your wishlist is empty
            </h2>

            <p className="mt-2 text-gray-500">
              Tap the heart on a product to save it here.
            </p>

            <Link
              to="/"
              className="mt-6 inline-block rounded-xl bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
            >
              Explore products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedProducts.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-sm"
              >
                <Link to={`/product/${product.id}`}>
                  <div className="flex h-52 items-center justify-center overflow-hidden bg-green-50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={40} className="text-green-700/50" />
                    )}
                  </div>
                </Link>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
                    {product.category}
                  </p>

                  <Link to={`/product/${product.id}`}>
                    <h2 className="mt-2 text-lg font-bold hover:text-green-700">
                      {product.title}
                    </h2>
                  </Link>

                  <p className="mt-2 text-xl font-bold text-green-800">
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </p>

                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={17} />
                    Remove from Wishlist
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
