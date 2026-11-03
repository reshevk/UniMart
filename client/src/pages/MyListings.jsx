
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import API from "../api";

export default function MyListings() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  async function loadListings() {
    try {
      const response = await API.get("/products/my-listings");
      setProducts(response.data.products || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your listings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  function startEditing(product) {
    setEditingId(product.id);
    setForm({
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      condition: product.condition,
      sellerWhatsapp: product.sellerWhatsapp || "",
    });
  }

  async function saveChanges(id) {
    try {
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
    }
  }

  async function changeStatus(product) {
    const newStatus =
      product.status === "SOLD" ? "AVAILABLE" : "SOLD";

    try {
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
      await API.delete(`/products/${id}`);
      setProducts((current) =>
        current.filter((product) => product.id !== id)
      );
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete listing.");
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="min-h-screen bg-[#f4faf6] px-5 py-10 text-[#18352a]">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/account"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-950"
        >
          <ArrowLeft size={18} />
          Back to account
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Listings</h1>
            <p className="mt-2 text-gray-500">
              Manage the products you've listed on UniMart.
            </p>
          </div>

          <Link
            to="/sell"
            className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
          >
            + Sell another item
          </Link>
        </div>

        {loading ? (
          <p className="py-16 text-center text-gray-500">
            Loading your listings...
          </p>
        ) : error ? (
          <p className="rounded-2xl bg-red-50 p-5 text-center text-red-600">
            {error}
          </p>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-green-100 bg-white p-12 text-center">
            <Package size={40} className="mx-auto mb-4 text-green-700" />
            <h2 className="text-xl font-bold">No listings yet</h2>
            <p className="mt-2 text-gray-500">
              Your products will appear here after you list them.
            </p>
            <Link
              to="/sell"
              className="mt-6 inline-block rounded-xl bg-green-700 px-6 py-3 font-semibold text-white"
            >
              List your first item
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {products.map((product) => {
              const isEditing = editingId === product.id;

              const productImages = Array.from(
                new Set([
                  ...(Array.isArray(product.imageUrls)
                    ? product.imageUrls
                    : []),
                  ...(product.imageUrl ? [product.imageUrl] : []),
                ])
              );

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Edit listing</h2>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg p-2 hover:bg-gray-100"
                          aria-label="Cancel editing"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {[
                        ["title", "Title"],
                        ["description", "Description"],
                        ["price", "Price (₹)"],
                        ["category", "Category"],
                        ["condition", "Condition"],
                        ["sellerWhatsapp", "WhatsApp number"],
                      ].map(([name, label]) => (
                        <label key={name} className="block">
                          <span className="mb-1 block text-sm font-medium text-gray-600">
                            {label}
                          </span>

                          {name === "description" ? (
                            <textarea
                              name={name}
                              value={form[name]}
                              onChange={updateField}
                              rows={3}
                              className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-green-600"
                            />
                          ) : (
                            <input
                              name={name}
                              type={name === "price" ? "number" : "text"}
                              value={form[name]}
                              onChange={updateField}
                              className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-green-600"
                            />
                          )}
                        </label>
                      ))}

                      <button
                        onClick={() => saveChanges(product.id)}
                        className="flex items-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
                      >
                        <Check size={18} />
                        Save changes
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <div className="w-full shrink-0 sm:w-40">
                        <div className="flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-green-50">
                          {productImages.length > 0 ? (
                            <img
                              src={productImages[0]}
                              alt={product.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package
                              size={36}
                              className="text-green-700/50"
                            />
                          )}
                        </div>

                        {productImages.length > 1 && (
                          <div className="mt-2 grid grid-cols-4 gap-1">
                            {productImages.slice(1, 5).map((image, index) => (
                              <img
                                key={image}
                                src={image}
                                alt={`${product.title} image ${index + 2}`}
                                className="h-9 w-full rounded-md object-cover"
                              />
                            ))}
                          </div>
                        )}

                        {productImages.length > 0 && (
                          <p className="mt-1 text-center text-xs text-gray-500">
                            {productImages.length} image
                            {productImages.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                            {product.category}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              product.status === "SOLD"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {product.status === "SOLD"
                              ? "Sold"
                              : "Available"}
                          </span>
                        </div>

                        <h2 className="mt-3 break-words text-xl font-bold">
                          {product.title}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          {product.condition}
                        </p>

                        <p className="mt-2 text-xl font-bold text-green-800">
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => startEditing(product)}
                            className="flex items-center gap-2 rounded-xl border border-green-200 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>

                          <button
                            onClick={() => changeStatus(product)}
                            className="rounded-xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800"
                          >
                            Mark as{" "}
                            {product.status === "SOLD"
                              ? "Available"
                              : "Sold"}
                          </button>

                          <button
                            onClick={() => deleteListing(product.id)}
                            className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                            Delete
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
      </div>
    </div>
  );
}
