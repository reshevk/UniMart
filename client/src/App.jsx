import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { io } from "socket.io-client";
import API from "./api";
import Register from "./pages/Register";
import Login from "./pages/Login";
import SellItem from "./pages/SellItem";
import ProductDetails from "./pages/ProductDetails";
import MyListings from "./pages/MyListings";
import Wishlist from "./pages/Wishlist";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";

import {
  Search,
  ShoppingBag,
  MessageCircle,
  Plus,
  BookOpen,
  Laptop,
  Shirt,
  Armchair,
  Heart,
  ArrowRight,
  ShieldCheck,
  Menu,
  LogOut,
  User,
  ImageOff,
  Bike,
  Package,
  X,
  Bell,
  CheckCheck,
  AlertTriangle,
} from "lucide-react";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5001";

const categories = [
  { name: "Electronics", icon: Laptop },
  { name: "Books", icon: BookOpen },
  { name: "Accessories", icon: Shirt },
  { name: "Furniture", icon: Armchair },
  { name: "Cycles", icon: Bike },
  { name: "Other", icon: Package },
];

// NOTIFICATION BELL
function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/announcements");
      setAnnouncements(response.data.announcements || []);
    } catch (err) {
      console.error("Announcements error:", err);
      setError(
        err.response?.data?.message ||
          "Could not load announcements. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user || user.role !== "STUDENT") return;

    const token = localStorage.getItem("unimart_token");
    if (!token) return;

    let active = true;

    async function syncUnreadCount() {
      try {
        const response = await API.get("/announcements/unread-count");

        if (active) {
          setUnreadCount(response.data.unreadCount || 0);
        }
      } catch (err) {
        console.error("Unread count error:", err);
      }
    }

    syncUnreadCount();

    const socket = io(SOCKET_URL, {
      auth: { token },
    });

    socket.on("connect_error", (err) => {
      console.error("Announcement socket connection error:", err.message);
    });

    socket.on("announcement:new", (announcement) => {
      if (!active) return;

      console.log("New campus announcement received:", announcement);

      setUnreadCount((current) => current + 1);

      setAnnouncements((current) => {
        if (current.some((item) => item.id === announcement.id)) {
          return current;
        }

        return [
          {
            ...announcement,
            isRead: false,
            readAt: null,
          },
          ...current,
        ];
      });
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [user]);

  function toggleNotifications() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      loadAnnouncements();
    }
  }

  async function markAsRead(announcementId) {
    const announcement = announcements.find(
      (item) => item.id === announcementId
    );

    if (!announcement || announcement.isRead) return;

    try {
      await API.patch(`/announcements/${announcementId}/read`);

      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcementId
            ? { ...item, isRead: true }
            : item
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      console.error("Mark as read error:", err);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);

    try {
      await API.patch("/announcements/read-all");

      setAnnouncements((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all as read error:", err);
      setError("Could not mark announcements as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  if (!user || user.role !== "STUDENT") return null;

  function formatDate(date) {
    if (!date) return "";

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleNotifications}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative flex items-center justify-center rounded-full p-2.5 text-green-800 transition hover:bg-green-50"
      >
        <Bell size={21} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute right-0 top-14 z-50 w-[min(90vw,390px)] overflow-hidden rounded-2xl border border-green-100 bg-white/95 shadow-2xl shadow-green-950/15 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-green-100 px-4 py-4">
              <div>
                <h3 className="font-bold text-green-950">Notifications</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {unreadCount} unread announcement
                  {unreadCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    disabled={markingAll}
                    className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    <CheckCheck size={15} />
                    {markingAll ? "Updating..." : "Read all"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <div className="px-5 py-12 text-center text-sm text-gray-500">
                  Loading announcements...
                </div>
              ) : error ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    type="button"
                    onClick={loadAnnouncements}
                    className="mt-3 rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-200"
                  >
                    Try again
                  </button>
                </div>
              ) : announcements.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700">
                    <Bell size={22} />
                  </div>
                  <p className="font-semibold text-gray-700">
                    You're all caught up!
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    New announcements will appear here.
                  </p>
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className={`border-b border-green-50 px-4 py-4 transition hover:bg-green-50/60 ${
                      !announcement.isRead ? "bg-green-50/40" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          announcement.isUrgent
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {announcement.isUrgent ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="break-words text-sm font-bold text-green-950">
                            {announcement.title}
                          </h4>

                          {announcement.isUrgent && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                              Urgent
                            </span>
                          )}

                          {!announcement.isRead && (
                            <span className="h-2 w-2 rounded-full bg-green-600" />
                          )}
                        </div>

                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
                          {announcement.message}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-400">
                            {formatDate(announcement.publishedAt)}
                          </span>

                          {!announcement.isRead && (
                            <button
                              type="button"
                              onClick={() => markAsRead(announcement.id)}
                              className="text-xs font-semibold text-green-700 hover:text-green-900"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-green-100 bg-green-50/50 px-4 py-3 text-center">
              <p className="text-xs text-green-800/70">
                UniMart campus announcements
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// HOME PAGE
function Home({ user, onLogout }) {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [products, setProducts] = useState([]);
  const [apiError, setApiError] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);

  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("unimart_wishlist") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;

    API.get("/products")
      .then((response) => {
        if (active) {
          setProducts(response.data.products || []);
        }
      })
      .catch((error) => {
        console.error("Products API error:", error);
        if (active) {
          setApiError("Could not load products. Please try again.");
        }
      })
      .finally(() => {
        if (active) {
          setProductsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function toggleWishlist(productId) {
    const updated = wishlistIds.includes(productId)
      ? wishlistIds.filter((id) => id !== productId)
      : [...wishlistIds, productId];

    setWishlistIds(updated);
    localStorage.setItem("unimart_wishlist", JSON.stringify(updated));
  }

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase().trim();
    const title = (product.title || "").toLowerCase();
    const description = (product.description || "").toLowerCase();

    const matchesSearch =
      title.includes(query) || description.includes(query);

    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory("");
  }

  function openProduct(productId) {
    navigate(`/product/${productId}`);
  }

  function openChat(productId) {
    if (!user) {
      navigate("/login");
      return;
    }

    navigate(productId ? `/chat?productId=${productId}` : "/chat");
  }

  return (
    <div className="min-h-screen bg-[#f4faf6] text-[#18352a]">
      <nav className="sticky top-0 z-50 border-b border-green-900/10 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="rounded-xl bg-green-700 p-2 text-white">
              <ShoppingBag size={22} />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Uni<span className="text-green-700">Mart</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link to="/" className="text-green-700">Home</Link>
            <a href="#categories" className="hover:text-green-700">Categories</a>
            <a href="#products" className="hover:text-green-700">Explore</a>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              to="/wishlist"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:bg-green-50"
            >
              <Heart size={18} />
              Wishlist
            </Link>

            <button
              onClick={() => openChat()}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium hover:bg-green-50"
            >
              <MessageCircle size={18} />
              Chat
            </button>

            {user ? (
              <>
                <NotificationBell user={user} />
                <Link
                  to="/account"
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
                >
                  <User size={18} />
                  {user.name}
                </Link>
                <Link
                  to="/sell"
                  className="flex items-center gap-2 rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-700/20 hover:bg-green-800"
                >
                  <Plus size={18} />
                  Sell Item
                </Link>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  <LogOut size={17} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-green-50">
                  Login
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-700/20 hover:bg-green-800"
                >
                  <Plus size={18} />
                  Sell Item
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            {user && <NotificationBell user={user} />}
            <Link
              to={user ? "/account" : "/login"}
              aria-label="Open account"
              className="rounded-lg p-2 hover:bg-green-50"
            >
              <Menu size={24} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-5">
        <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#d9f5e4] via-[#bcebd0] to-[#e9f8ef] px-6 py-16 md:px-14 md:py-24">
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-green-300/30 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-4 py-2 text-sm font-medium text-green-800 backdrop-blur-xl">
              <ShieldCheck size={17} />
              Exclusively for SST students
            </span>

            <h1 className="mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              Your campus.
              <br />
              Your marketplace.
              <br />
              <span className="text-green-700">Your community.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-green-950/70 md:text-lg">
              Buy and sell second-hand products with your college mates.
              Give your unused things a new home.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                document.getElementById("products")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-white/80 bg-white/65 p-2 shadow-xl shadow-green-900/5 backdrop-blur-2xl"
            >
              <Search className="ml-3 shrink-0 text-green-700" size={22} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search books, gadgets, furniture..."
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="rounded-lg p-2 text-gray-500 hover:bg-green-100 hover:text-green-800"
                >
                  <X size={18} />
                </button>
              )}
              <button
                type="submit"
                className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
              >
                Search
              </button>
            </form>

            <p className="mt-5 text-sm text-green-900/60">
              Buy smarter. Sell easier. Connect locally.
            </p>

            <Link
              to={user ? "/sell" : "/register"}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-semibold text-white shadow-lg hover:bg-green-800"
            >
              {user ? "Sell an Item" : "Join UniMart"}
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section id="categories" className="py-14">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Browse categories</h2>
              <p className="mt-1 text-sm text-gray-500">Find exactly what you need</p>
            </div>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory("")}
                className="text-sm font-semibold text-green-700 hover:text-green-900"
              >
                Clear category
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.name;

              return (
                <button
                  key={category.name}
                  onClick={() =>
                    setSelectedCategory(isSelected ? "" : category.name)
                  }
                  className={`group flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg ${
                    isSelected
                      ? "border-green-500 bg-green-100"
                      : "border-white bg-white/70 hover:border-green-200"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition ${
                      isSelected
                        ? "bg-green-700 text-white"
                        : "bg-green-100 text-green-700 group-hover:bg-green-700 group-hover:text-white"
                    }`}
                  >
                    <Icon size={22} />
                  </div>
                  <span className="text-sm font-semibold">{category.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section id="products" className="pb-16">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Trending on campus</h2>
              <p className="mt-1 text-sm text-gray-500">
                Discover what students are selling
              </p>
            </div>

            {(searchQuery || selectedCategory) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 self-start rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
              >
                <X size={16} />
                Clear all filters
              </button>
            )}
          </div>

          {productsLoading ? (
            <p className="py-12 text-center text-gray-500">Loading products...</p>
          ) : apiError ? (
            <p className="py-12 text-center text-red-600">{apiError}</p>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border border-green-100 bg-white/70 px-5 py-12 text-center">
              <ShoppingBag size={36} className="mx-auto mb-3 text-green-700" />
              <h3 className="text-lg font-bold">No products listed yet</h3>
              <p className="mt-2 text-sm text-gray-500">
                Be the first student to list something on UniMart!
              </p>
              <Link
                to={user ? "/sell" : "/register"}
                className="mt-5 inline-flex rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
              >
                Sell an Item
              </Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-green-100 bg-white/70 px-5 py-12 text-center">
              <Search size={36} className="mx-auto mb-3 text-green-700" />
              <h3 className="text-lg font-bold">No matching products found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Try another search or category.
              </p>
              <button
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-gray-500">
                Showing {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"}
              </p>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {filteredProducts.map((product) => {
                  const coverImage =
                    product.imageUrls?.[0] || product.imageUrl;

                  return (
                    <article
                      key={product.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openProduct(product.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openProduct(product.id);
                      }}
                      className="group cursor-pointer overflow-hidden rounded-3xl border border-white bg-white/75 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-green-50">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={product.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-green-700/50">
                            <ImageOff size={38} />
                            <span className="text-xs font-medium">No image available</span>
                          </div>
                        )}

                        <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-green-800 backdrop-blur-xl">
                          {product.condition}
                        </span>

                        <button
                          aria-label="Toggle wishlist"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product.id);
                          }}
                          className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-gray-600 backdrop-blur-xl hover:text-red-500"
                        >
                          <Heart
                            size={18}
                            className={
                              wishlistIds.includes(product.id)
                                ? "fill-red-500 text-red-500"
                                : ""
                            }
                          />
                        </button>
                      </div>

                      <div className="p-5">
                        <p className="text-xs font-medium uppercase tracking-wider text-green-700">
                          {product.category}
                        </p>
                        <h3 className="mt-2 break-words text-lg font-bold">
                          {product.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Seller: {product.seller?.name || "Student"}
                        </p>

                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-xl font-bold text-green-800">
                            ₹{Number(product.price).toLocaleString("en-IN")}
                          </span>
                          <button
                            aria-label={`Chat with seller of ${product.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openChat(product.id);
                            }}
                            className="rounded-xl bg-green-100 p-2.5 text-green-800 hover:bg-green-700 hover:text-white"
                          >
                            <MessageCircle size={19} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="mb-14 flex flex-col items-center justify-between gap-6 rounded-3xl border border-white bg-gradient-to-r from-green-800 to-green-600 p-8 text-center text-white shadow-xl shadow-green-900/10 sm:flex-row sm:text-left md:p-12">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Have something to sell?</h2>
            <p className="mt-2 text-sm text-green-100">
              List your product and connect with students on campus.
            </p>
          </div>
          <Link
            to={user ? "/sell" : "/login"}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-green-800 hover:bg-green-50"
          >
            Start selling <ArrowRight size={18} />
          </Link>
        </section>

        <p className="pb-8 text-center text-xs text-gray-500">
          {apiError || "UniMart marketplace is running"}
        </p>
      </main>

      <footer className="border-t border-green-900/10 bg-white/60 px-5 py-8 text-center">
        <h3 className="text-xl font-bold">
          Uni<span className="text-green-700">Mart</span>
        </h3>
        <p className="mt-2 text-sm text-gray-500">Built for SST. By SST. 💚</p>
        <p className="mt-3 text-xs text-gray-400">
          © 2026 UniMart. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// PROTECTED ROUTE
function ProtectedRoute({ user, loading, children }) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4faf6] text-green-800">
        Checking your login...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}

// OWNER-ONLY ROUTE
function OwnerRoute({ user, loading, children }) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4faf6] text-green-800">
        Checking owner access...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!["OWNER", "ADMIN"].includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

// ACCOUNT PAGE
function Account({ user, onLogout }) {
  const navigate = useNavigate();

  function handleLogout() {
    onLogout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4faf6] px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-white bg-white/75 p-8 text-center shadow-xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <User size={30} />
        </div>
        <h1 className="text-3xl font-bold text-[#075c3b]">
          Welcome, {user.name}!
        </h1>
        <p className="mt-2 text-gray-500">
          You are successfully logged in to UniMart.
        </p>

        <div className="mt-8 rounded-2xl bg-green-50 p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
            Your account
          </p>
          <p className="mt-3 text-sm text-gray-500">Name</p>
          <p className="font-semibold">{user.name}</p>
          <p className="mt-4 text-sm text-gray-500">College email</p>
          <p className="font-semibold">{user.email}</p>
        </div>

        {["OWNER", "ADMIN"].includes(user.role) && (
          <Link
            to="/admin"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#075c3b] py-3 font-semibold text-white shadow-lg shadow-green-900/15 transition hover:bg-green-900"
          >
            <ShieldCheck size={19} />
            Admin Dashboard
            <ArrowRight size={18} />
          </Link>
        )}

        <Link
          to="/sell"
          className="mt-6 block w-full rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800"
        >
          Sell an Item
        </Link>
        <Link
          to="/my-listings"
          className="mt-3 block w-full rounded-xl bg-green-100 py-3 font-semibold text-green-800 hover:bg-green-200"
        >
          Manage My Listings
        </Link>
        <Link
          to="/wishlist"
          className="mt-3 block w-full rounded-xl border border-green-200 py-3 font-semibold text-green-800 hover:bg-green-50"
        >
          My Wishlist
        </Link>
        <Link
          to="/chat"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 py-3 font-semibold text-green-800 hover:bg-green-50"
        >
          <MessageCircle size={18} />
          My Chats
        </Link>
        <Link
          to="/"
          className="mt-3 block w-full rounded-xl border border-green-200 py-3 font-semibold text-green-800 hover:bg-green-50"
        >
          Back to Marketplace
        </Link>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}

// MAIN APP
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkLogin() {
      const token = localStorage.getItem("unimart_token");

      if (!token) {
        if (active) setAuthLoading(false);
        return;
      }

      try {
        const response = await API.get("/auth/me");

        if (active) setUser(response.data.user);
      } catch (error) {
        console.error("Session verification failed:", error);
        localStorage.removeItem("unimart_token");

        if (active) setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(token) {
    localStorage.setItem("unimart_token", token);
    setAuthLoading(true);

    try {
      const response = await API.get("/auth/me");
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      localStorage.removeItem("unimart_token");
      setUser(null);
      console.error("Login verification failed:", error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("unimart_token");
    setUser(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/login"
          element={
            authLoading ? (
              <div className="flex min-h-screen items-center justify-center bg-[#f4faf6] text-green-800">
                Checking your login...
              </div>
            ) : user ? (
              <Navigate to="/account" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/account"
          element={
            <ProtectedRoute user={user} loading={authLoading}>
              <Account user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <OwnerRoute user={user} loading={authLoading}>
              <Admin user={user} />
            </OwnerRoute>
          }
        />

        <Route
          path="/sell"
          element={
            <ProtectedRoute user={user} loading={authLoading}>
              <SellItem />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-listings"
          element={
            <ProtectedRoute user={user} loading={authLoading}>
              <MyListings />
            </ProtectedRoute>
          }
        />

        <Route path="/wishlist" element={<Wishlist />} />

        <Route
          path="/chat"
          element={
            <ProtectedRoute user={user} loading={authLoading}>
              <Chat user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute user={user} loading={authLoading}>
              <Chat user={user} />
            </ProtectedRoute>
          }
        />

        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;