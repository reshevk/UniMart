import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Trash2,
  Package,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import API from "../api";

export default function Wishlist() {
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("unimart_wishlist") || "[]"
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    API.get("/products")
      .then((response) => {
        if (active) {
          setProducts(response.data.products || []);
        }
      })
      .catch(() => {
        if (active) {
          setError("Could not load your saved products. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const savedProducts = products.filter(
    (product) =>
      wishlistIds.includes(product.id) &&
      product.status !== "REMOVED" &&
      product.status !== "SOLD"
  );

  function removeFromWishlist(id) {
    const updated = wishlistIds.filter((itemId) => itemId !== id);

    setWishlistIds(updated);
    localStorage.setItem("unimart_wishlist", JSON.stringify(updated));
  }

  function clearWishlist() {
    setWishlistIds([]);
    localStorage.setItem("unimart_wishlist", JSON.stringify([]));
  }

  function formatPrice(price) {
    return Number(price).toLocaleString("en-IN");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f9f5] text-[#18352a]">
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-green-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-[550px] h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />

      <nav className="sticky top-0 z-40 border-b border-green-900/[0.07] bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#209b68] to-[#075b3b] text-white shadow-lg shadow-green-900/15">
              <ShoppingBag size={21} />
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
            Marketplace
          </Link>
        </div>
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200/70 bg-white/75 px-3 py-1.5 text-xs font-semibold text-green-800 shadow-sm">
              <Sparkles size={14} />
              Your personal collection
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <Heart size={25} className="fill-red-500" />
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-[#173d2c] sm:text-4xl">
                My Wishlist
              </h1>
            </div>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#75877b] sm:text-base">
              Keep the things you love close. Your saved campus finds,
              all in one place.
            </p>
          </div>

          {!loading && !error && savedProducts.length > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-green-100 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl">
              <div>
                <p className="text-2xl font-extrabold text-[#1c7549]">
                  {savedProducts.length}
                </p>
                <p className="text-[11px] font-medium text-[#84958a]">
                  Saved items
                </p>
              </div>

              <div className="h-9 w-px bg-green-100" />

              <button
                type="button"
                onClick={clearWishlist}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={15} />
                Clear all
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-green-100 bg-white"
              >
                <div className="aspect-[4/3] animate-pulse bg-green-50" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-20 animate-pulse rounded bg-green-100" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-6 w-1/3 animate-pulse rounded bg-green-100" />
                  <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertCircle size={27} />
            </div>

            <h2 className="text-lg font-bold text-[#244b37]">
              Something went wrong
            </h2>

            <p className="mt-2 text-sm text-[#87968c]">{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#16865a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0d7048]"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : savedProducts.length === 0 ? (
          <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-[0_12px_40px_rgba(24,68,44,0.04)]">
            <div className="relative flex flex-col items-center px-5 py-16 text-center sm:py-20">
              <div className="pointer-events-none absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full bg-green-100/50 blur-3xl" />

              <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-green-100 bg-green-50 text-green-700 shadow-sm">
                <Heart size={37} />
              </div>

              <h2 className="text-xl font-extrabold text-[#214532] sm:text-2xl">
                Your wishlist is waiting
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-6 text-[#87968c]">
                You haven't saved anything yet. Explore the marketplace
                and tap the heart on products you'd like to revisit.
              </p>

              <Link
                to="/"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/15 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <ShoppingBag size={17} />
                Explore marketplace
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#54705d]">
                Your saved products
              </p>

              <span className="text-xs text-[#93a198]">
                {savedProducts.length}{" "}
                {savedProducts.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {savedProducts.map((product) => (
                <article
                  key={product.id}
                  className="group overflow-hidden rounded-3xl border border-[#e4eee7] bg-white shadow-[0_8px_30px_rgba(24,68,44,0.045)] transition duration-300 hover:-translate-y-1 hover:border-green-200 hover:shadow-[0_16px_40px_rgba(24,68,44,0.10)]"
                >
                  <div className="relative overflow-hidden bg-[#f0f7f1]">
                    <Link
                      to={`/product/${product.id}`}
                      className="block aspect-[4/3]"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package
                            size={48}
                            className="text-green-700/35"
                          />
                        </div>
                      )}
                    </Link>

                    <div className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-green-800 shadow-sm backdrop-blur-xl">
                      {product.category || "Other"}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromWishlist(product.id)}
                      aria-label={`Remove ${product.title} from wishlist`}
                      title="Remove from wishlist"
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 bg-white/90 text-red-500 shadow-sm backdrop-blur-xl transition hover:scale-105 hover:bg-red-50"
                    >
                      <Heart size={17} className="fill-red-500" />
                    </button>
                  </div>

                  <div className="p-5">
                    <Link to={`/product/${product.id}`}>
                      <h2 className="line-clamp-1 text-base font-bold text-[#244b37] transition hover:text-green-700">
                        {product.title}
                      </h2>
                    </Link>

                    {product.condition && (
                      <p className="mt-1.5 text-xs text-[#8a9a8f]">
                        Condition: {product.condition}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="flex items-center gap-0.5 text-xl font-extrabold tracking-tight text-[#147c4d]">
                        <IndianRupee size={17} />
                        {formatPrice(product.price)}
                      </p>

                      <Link
                        to={`/product/${product.id}`}
                        className="rounded-xl bg-green-50 px-3.5 py-2.5 text-xs font-bold text-green-800 transition hover:bg-green-100"
                      >
                        View item
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromWishlist(product.id)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 py-3 text-xs font-semibold text-red-500 transition hover:border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                      Remove from wishlist
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <footer className="pb-4 pt-10 text-center">
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