
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  X,
  Check,
  Plus,
  ShoppingBag,
  CheckCircle2,
  Tag,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import API from "../api";

export default function MyListings() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      try {
        const response = await API.get("/products/my-listings");

        if (!cancelled) {
          setProducts(response.data.products || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || "Could not load your listings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchListings();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableCount = products.filter(
    (product) => product.status !== "SOLD"
  ).length;

  const soldCount = products.filter(
    (product) => product.status === "SOLD"
  ).length;

  function startEditing(product) {
    setEditingId(product.id);
    setForm({
      title: product.title || "",
      description: product.description || "",
      price: product.price ?? "",
      category: product.category || "",
      condition: product.condition || "",
      sellerWhatsapp: product.sellerWhatsapp || "",
    });
  }

  async function saveChanges(id) {
    if (!form.title?.trim()) {
      alert("Please enter a product title.");
      return;
    }

    if (!form.price || Number(form.price) <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    try {
      setSaving(true);

      const response = await API.patch(`/products/${id}`, form);

      setProducts((current) =>
        current.map((product) =>
          product.id === id ? response.data.product : product
        )
      );

      setEditingId(null);
      alert("Listing updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Could not update listing.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(product) {
    const newStatus =
      product.status === "SOLD" ? "AVAILABLE" : "SOLD";

    try {
      setUpdatingStatusId(product.id);

      const response = await API.patch(`/products/${product.id}`, {
        status: newStatus,
      });

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? response.data.product : item
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Could not update status.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function deleteListing(id) {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this listing?"
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);

      await API.delete(`/products/${id}`);

      setProducts((current) =>
        current.filter((product) => product.id !== id)
      );
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete listing.");
    } finally {
      setDeletingId(null);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function getProductImages(product) {
    return Array.from(
      new Set([
        ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
        ...(product.imageUrl ? [product.imageUrl] : []),
      ])
    );
  }

  return (
    <div className="min-h-screen bg-[#f7faf7] px-4 py-7 text-gray-900 sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Back navigation */}
        <Link
          to="/account"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-green-100 bg-white/80 px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-xl transition hover:border-green-200 hover:text-green-800"
        >
          <ArrowLeft size={17} />
          Back to account
        </Link>

        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-green-700">
              <Sparkles size={15} />
              Seller dashboard
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-gray-950 sm:text-4xl">
              My Listings
            </h1>

            <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
              Keep track of your products, update your listings, and manage
              what you're selling on UniMart.
            </p>
          </div>

          <Link
            to="/sell"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/10 transition hover:-translate-y-0.5 hover:bg-green-800"
          >
            <Plus size={19} />
            Sell another item
          </Link>
        </div>

        {/* Statistics */}
        {!loading && !error && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl border border-green-100 bg-white/85 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 sm:text-sm">
                  Total listings
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
                {products.length}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Products you've listed
              </p>
            </div>

            <div className="rounded-2xl border border-green-100 bg-white/85 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 sm:text-sm">
                  Available
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-green-700 sm:text-3xl">
                {availableCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Open for buyers
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-gray-100 bg-white/85 p-4 shadow-sm backdrop-blur-xl sm:col-span-1 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 sm:text-sm">
                  Sold
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                  <Check size={18} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-gray-700 sm:text-3xl">
                {soldCount}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Successfully marked sold
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex animate-pulse flex-col gap-4 rounded-3xl border border-green-100 bg-white p-5 sm:flex-row"
              >
                <div className="h-40 rounded-2xl bg-green-50 sm:w-40" />
                <div className="flex-1 space-y-4 py-2">
                  <div className="h-4 w-24 rounded bg-green-100" />
                  <div className="h-6 w-2/3 rounded bg-green-100" />
                  <div className="h-4 w-1/3 rounded bg-green-100" />
                  <div className="h-10 w-48 rounded bg-green-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-white shadow-sm">
            <div className="flex flex-col items-center px-6 py-14 text-center sm:py-20">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-50 to-green-100 text-green-700">
                <Package size={39} strokeWidth={1.5} />
              </div>

              <h2 className="text-2xl font-bold text-gray-900">
                Your marketplace starts here
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
                You haven't listed anything yet. Give your unused items a
                second life by listing them on UniMart.
              </p>

              <Link
                to="/sell"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/10 transition hover:-translate-y-0.5 hover:bg-green-800"
              >
                <Plus size={18} />
                List your first item
              </Link>

              <p className="mt-5 text-xs font-semibold text-green-700">
                Built for SST. 💚
              </p>
            </div>
          </div>
        ) : (
          /* Product listings */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Your products
              </h2>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                {products.length}{" "}
                {products.length === 1 ? "listing" : "listings"}
              </span>
            </div>

            {products.map((product) => {
              const isEditing = editingId === product.id;
              const productImages = getProductImages(product);
              const isSold = product.status === "SOLD";

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-[1.75rem] border border-green-100/80 bg-white/90 shadow-[0_8px_35px_rgba(22,101,52,0.045)] backdrop-blur-xl transition hover:shadow-[0_12px_40px_rgba(22,101,52,0.075)] sm:rounded-[2rem]"
                >
                  {isEditing ? (
                    /* Edit form */
                    <div className="p-5 sm:p-7">
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                            Manage product
                          </p>
                          <h2 className="mt-1 text-xl font-bold text-gray-900">
                            Edit listing
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="rounded-xl border border-gray-100 p-2.5 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
                          aria-label="Cancel editing"
                        >
                          <X size={19} />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {[
                          ["title", "Product title"],
                          ["price", "Price (₹)"],
                          ["category", "Category"],
                          ["condition", "Condition"],
                          ["sellerWhatsapp", "WhatsApp number"],
                        ].map(([name, label]) => (
                          <label key={name} className="block">
                            <span className="mb-2 block text-xs font-bold text-gray-600">
                              {label}
                            </span>

                            <input
                              name={name}
                              type={name === "price" ? "number" : "text"}
                              value={form[name] ?? ""}
                              onChange={updateField}
                              min={name === "price" ? "1" : undefined}
                              placeholder={
                                name === "sellerWhatsapp"
                                  ? "WhatsApp number"
                                  : label
                              }
                              className="w-full rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                            />
                          </label>
                        ))}

                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-xs font-bold text-gray-600">
                            Description
                          </span>

                          <textarea
                            name="description"
                            value={form.description ?? ""}
                            onChange={updateField}
                            rows={4}
                            placeholder="Describe your product..."
                            className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
                          />
                        </label>
                      </div>

                      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => saveChanges(product.id)}
                          disabled={saving}
                          className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-green-900/10 transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Check size={17} />
                          {saving ? "Saving changes..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Listing card */
                    <div className="flex flex-col gap-5 p-4 sm:flex-row sm:gap-6 sm:p-5">
                      {/* Product images */}
                      <div className="w-full shrink-0 sm:w-44">
                        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-[#eaf6ec] sm:h-40">
                          {productImages.length > 0 ? (
                            <img
                              src={productImages[0]}
                              alt={product.title}
                              className="h-full w-full object-contain p-3"
                            />
                          ) : (
                            <Package
                              size={42}
                              strokeWidth={1.3}
                              className="text-green-300"
                            />
                          )}

                          {isSold && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                              <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-gray-800 shadow-lg">
                                Sold
                              </span>
                            </div>
                          )}

                          {productImages.length > 1 && (
                            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                              <ImageIcon size={11} />
                              {productImages.length} photos
                            </span>
                          )}
                        </div>

                        {productImages.length > 1 && (
                          <div className="mt-2 grid grid-cols-4 gap-1.5">
                            {productImages.slice(1, 5).map((image, index) => (
                              <div
                                key={image}
                                className="h-10 overflow-hidden rounded-lg bg-green-50"
                              >
                                <img
                                  src={image}
                                  alt={`${product.title} image ${index + 2}`}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Product information */}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-800">
                            {product.category || "Other"}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                              isSold
                                ? "bg-gray-100 text-gray-600"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSold ? "bg-gray-400" : "bg-green-600"
                              }`}
                            />
                            {isSold ? "Sold" : "Available"}
                          </span>
                        </div>

                        <h2 className="mt-3 break-words text-lg font-bold leading-snug text-gray-900 sm:text-xl">
                          {product.title}
                        </h2>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {product.condition && (
                            <span className="flex items-center gap-1">
                              <Tag size={13} />
                              {product.condition}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <ImageIcon size={13} />
                            {productImages.length}{" "}
                            {productImages.length === 1 ? "photo" : "photos"}
                          </span>
                        </div>

                        <p className="mt-3 text-2xl font-extrabold tracking-tight text-green-700">
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                          <button
                            type="button"
                            onClick={() => startEditing(product)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-3.5 py-2.5 text-xs font-bold text-green-800 transition hover:bg-green-50 sm:text-sm"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => changeStatus(product)}
                            disabled={updatingStatusId === product.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                          >
                            {updatingStatusId === product.id ? (
                              "Updating..."
                            ) : (
                              <>
                                <Check size={15} />
                                Mark as {isSold ? "Available" : "Sold"}
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteListing(product.id)}
                            disabled={deletingId === product.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-3.5 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                          >
                            <Trash2 size={15} />
                            {deletingId === product.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-green-100 py-7 text-center">
          <p className="text-xs font-semibold tracking-wide text-green-800">
            Built for SST. 💚
          </p>
        </footer>
      </div>
    </div>
  );
}
