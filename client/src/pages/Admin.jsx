
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Flag,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  AlertCircle,
  Megaphone,
  Send,
  Archive,
  AlertTriangle,
  X,
} from "lucide-react";
import API from "../api";
import AdminTeam from "./AdminTeam";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Students", icon: Users },
  { id: "listings", label: "Listings", icon: Package },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "activity", label: "Activity Log", icon: History, ownerOnly: true },
  { id: "team", label: "Team Management", icon: Users, ownerOnly: true },
];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="rounded-xl bg-green-50 p-2 text-green-700">
          <Icon size={20} />
        </div>
      </div>
      <p className="text-3xl font-bold text-[#075c3b]">{value ?? 0}</p>
    </div>
  );
}

function Status({ children }) {
  const colors = {
    ACTIVE: "bg-green-100 text-green-800",
    HIDDEN: "bg-yellow-100 text-yellow-800",
    REMOVED: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    REVIEWED: "bg-blue-100 text-blue-800",
    DISMISSED: "bg-gray-100 text-gray-700",
    ACTION_TAKEN: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[children] || "bg-gray-100 text-gray-700"
      }`}
    >
      {children || "UNKNOWN"}
    </span>
  );
}

function Admin({ user }) {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [userSearch, setUserSearch] = useState("");
  const [listingSearch, setListingSearch] = useState("");
  const [listingStatus, setListingStatus] = useState("");
  const [reportStatus, setReportStatus] = useState("PENDING");

  const [warningMessage, setWarningMessage] = useState("");
  const [warningReason, setWarningReason] = useState("");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementUrgent, setAnnouncementUrgent] = useState(false);
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [archivingId, setArchivingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOverview() {
    const response = await API.get("/admin/overview");
    setOverview(response.data.overview);
    setActions(response.data.recentActions || []);
  }

  async function loadUsers(search = userSearch) {
    const response = await API.get("/admin/users", {
      params: { search, page: 1, limit: 50 },
    });
    setUsers(response.data.users || []);
  }

  async function loadListings() {
    const response = await API.get("/admin/listings", {
      params: {
        search: listingSearch,
        status: listingStatus || undefined,
        page: 1,
        limit: 50,
      },
    });
    setListings(response.data.listings || []);
  }

  async function loadReports() {
    const response = await API.get("/admin/reports", {
      params: {
        status: reportStatus || undefined,
        page: 1,
        limit: 50,
      },
    });
    setReports(response.data.reports || []);
  }

  async function loadActivity() {
    const response = await API.get("/admin/activity", {
      params: { page: 1, limit: 50 },
    });
    setActions(response.data.actions || []);
  }

  async function loadAnnouncements() {
    const response = await API.get("/announcements/admin", {
      params: { page: 1, limit: 100 },
    });
    setAnnouncements(response.data.announcements || []);
  }

  async function refreshCurrentTab() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (tab === "overview") await loadOverview();
      if (tab === "users") await loadUsers();
      if (tab === "listings") await loadListings();
      if (tab === "reports") await loadReports();
      if (tab === "announcements") await loadAnnouncements();
      if (tab === "activity") await loadActivity();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  // Load the active tab and refresh its data when its filters change.
  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        if (tab === "overview") {
          const response = await API.get("/admin/overview");

          if (active) {
            setOverview(response.data.overview);
            setActions(response.data.recentActions || []);
          }
        } else if (tab === "users") {
          const response = await API.get("/admin/users", {
            params: {
              search: userSearch,
              page: 1,
              limit: 50,
            },
          });

          if (active) {
            setUsers(response.data.users || []);
          }
        } else if (tab === "listings") {
          const response = await API.get("/admin/listings", {
            params: {
              search: listingSearch,
              status: listingStatus || undefined,
              page: 1,
              limit: 50,
            },
          });

          if (active) {
            setListings(response.data.listings || []);
          }
        } else if (tab === "reports") {
          const response = await API.get("/admin/reports", {
            params: {
              status: reportStatus || undefined,
              page: 1,
              limit: 50,
            },
          });

          if (active) {
            setReports(response.data.reports || []);
          }
        } else if (tab === "announcements") {
          const response = await API.get("/announcements/admin", {
            params: {
              page: 1,
              limit: 100,
            },
          });

          if (active) {
            setAnnouncements(response.data.announcements || []);
          }
        } else if (tab === "activity") {
          const response = await API.get("/admin/activity", {
            params: {
              page: 1,
              limit: 50,
            },
          });

          if (active) {
            setActions(response.data.actions || []);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load dashboard data."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, tab === "users" || tab === "listings" ? 300 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [tab, userSearch, listingSearch, listingStatus, reportStatus]);

  async function openUser(id) {
    setError("");
    setNotice("");
    setSelectedUser(null);

    try {
      const response = await API.get(`/admin/users/${id}`);
      setSelectedUser(response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load student.");
    }
  }

  async function suspendUser(user) {
    const reason = window.prompt(
      `Enter the reason for suspending ${user.name}:`
    );

    if (reason === null) return;

    if (reason.trim().length < 3) {
      setError("Please enter a reason of at least 3 characters.");
      return;
    }

    try {
      await API.patch(`/admin/users/${user.id}/suspend`, {
        reason: reason.trim(),
      });

      setNotice("Student suspended successfully.");
      setSelectedUser(null);
      await loadUsers();
      await loadOverview();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to suspend student.");
    }
  }

  async function restoreUser(user) {
    if (!window.confirm(`Restore ${user.name}'s account?`)) return;

    try {
      await API.patch(`/admin/users/${user.id}/restore`);
      setNotice("Student account restored successfully.");
      setSelectedUser(null);
      await loadUsers();
      await loadOverview();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to restore student.");
    }
  }

  async function issueWarning(event) {
    event.preventDefault();

    if (!selectedUser) return;

    try {
      await API.post(`/admin/users/${selectedUser.id}/warnings`, {
        message: warningMessage,
        reason: warningReason,
      });

      setWarningMessage("");
      setWarningReason("");
      setNotice("Official warning issued successfully.");
      await openUser(selectedUser.id);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to issue warning.");
    }
  }

  async function moderateListing(listing, status) {
    let reason = "";

    if (status !== "ACTIVE") {
      const enteredReason = window.prompt(
        `Enter the reason for setting this listing to ${status}:`
      );

      if (enteredReason === null) return;
      reason = enteredReason.trim();

      if (reason.length < 3) {
        setError("Please enter a reason of at least 3 characters.");
        return;
      }
    } else {
      if (!window.confirm("Restore this listing?")) return;
    }

    try {
      await API.patch(`/admin/listings/${listing.id}/moderation`, {
        status,
        reason,
      });

      setNotice(`Listing ${status.toLowerCase()} successfully.`);
      await loadListings();
      await loadOverview();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update listing.");
    }
  }

  async function reviewReport(report, status) {
    const resolution = window.prompt(
      `Enter the review notes for this report (${status}):`
    );

    if (resolution === null) return;

    try {
      await API.patch(`/admin/reports/${report.id}`, {
        status,
        resolution: resolution.trim(),
      });

      setNotice("Report reviewed successfully.");
      await loadReports();
      await loadOverview();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to review report.");
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault();

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setError("Please enter both an announcement title and message.");
      return;
    }

    setPublishingAnnouncement(true);
    setError("");
    setNotice("");

    try {
      await API.post("/announcements", {
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        isUrgent: announcementUrgent,
      });

      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementUrgent(false);

      setNotice(
        "Announcement published successfully to all registered accounts."
      );
      await loadAnnouncements();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to publish announcement."
      );
    } finally {
      setPublishingAnnouncement(false);
    }
  }

  async function archiveAnnouncement(announcement) {
    const confirmed = window.confirm(
      `Archive "${announcement.title}"?\n\nStudents will no longer see it in their active announcements, but it will remain in your history.`
    );

    if (!confirmed) return;

    setArchivingId(announcement.id);
    setError("");
    setNotice("");

    try {
      await API.patch(`/announcements/${announcement.id}/archive`);

      setNotice("Announcement archived successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to archive announcement."
      );
    } finally {
      setArchivingId(null);
    }
  }

  const isOwner = user?.role === "OWNER";
  const permissions = user?.permissions || {};
  const visibleTabs = tabs.filter((item) => {
    if (item.ownerOnly) return isOwner;
    if (item.id === "overview") return true;
    if (item.id === "users") return isOwner || permissions.manageUsers;
    if (item.id === "listings") return isOwner || permissions.manageListings;
    if (item.id === "reports") return isOwner || permissions.manageReports;
    if (item.id === "announcements") return isOwner || permissions.manageAnnouncements;
    return false;
  });

  const pageTitle = tabs.find((item) => item.id === tab)?.label;

  return (
    <div className="min-h-screen bg-[#f4faf6] text-gray-800">
      <header className="sticky top-0 z-20 border-b border-green-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xl font-bold text-[#075c3b]">UniMart</p>
            <p className="text-xs font-medium text-gray-500">
              Admin Control Center
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            <ShieldCheck size={17} />
            {isOwner ? "Owner" : "Admin"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-700">
              UniMart Control Center
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[#075c3b]">
              {pageTitle}
            </h1>
          </div>

          <button
            onClick={refreshCurrentTab}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-green-100 bg-white p-2 shadow-sm">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setError("");
                setNotice("");
                setSelectedUser(null);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                tab === id
                  ? "bg-[#075c3b] text-white shadow-sm"
                  : "text-gray-600 hover:bg-green-50 hover:text-green-800"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
            <button
              onClick={() => setError("")}
              className="ml-auto rounded-lg p-1 hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle size={18} />
            {notice}
            <button
              onClick={() => setNotice("")}
              className="ml-auto rounded-lg p-1 hover:bg-green-100"
              aria-label="Dismiss notice"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {loading && (
          <p className="mb-4 text-sm text-green-800">Loading data...</p>
        )}

        {tab === "overview" && (
          <div className="space-y-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Total Students" value={overview?.totalUsers} icon={Users} />
              <StatCard label="Active Students" value={overview?.activeUsers} icon={CheckCircle} />
              <StatCard label="Suspended Students" value={overview?.suspendedUsers} icon={ShieldAlert} />
              <StatCard label="Total Listings" value={overview?.totalListings} icon={Package} />
              <StatCard label="Active Listings" value={overview?.activeListings} icon={Eye} />
              <StatCard label="Hidden Listings" value={overview?.hiddenListings} icon={EyeOff} />
              <StatCard label="Pending Reports" value={overview?.pendingReports} icon={Flag} />
            </div>

            <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-[#075c3b]">
                Recent Admin Actions
              </h2>

              {actions.length === 0 ? (
                <p className="text-sm text-gray-500">No admin activity yet.</p>
              ) : (
                <div className="space-y-4">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                    >
                      <p className="font-semibold text-gray-800">
                        {action.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        By {action.actor?.name || "Unknown"}
                        {action.targetUser ? ` · ${action.targetUser.name}` : ""}
                        {action.targetProduct ? ` · ${action.targetProduct.title}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(action.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadUsers();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search students by name or email..."
                  className="w-full rounded-xl border border-green-100 bg-white py-3 pl-10 pr-4 outline-none focus:border-green-500"
                />
              </div>
              <button className="rounded-xl bg-[#075c3b] px-5 font-semibold text-white hover:bg-green-800">
                Search
              </button>
            </form>

            <div className="overflow-x-auto rounded-2xl border border-green-100 bg-white shadow-sm">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-green-50 text-gray-600">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Listings</th>
                    <th className="p-4">Warnings</th>
                    <th className="p-4">Account</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-100">
                      <td className="p-4">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </td>
                      <td className="p-4">{user._count?.products ?? 0}</td>
                      <td className="p-4">{user._count?.receivedWarnings ?? 0}</td>
                      <td className="p-4">
                        <Status>{user.suspendedAt ? "SUSPENDED" : "ACTIVE"}</Status>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => openUser(user.id)}
                          className="font-semibold text-green-700 hover:underline"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedUser && (
              <section className="space-y-5 rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#075c3b]">
                      {selectedUser.name}
                    </h2>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Joined {formatDate(selectedUser.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-800"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedUser.suspendedAt ? (
                    <button
                      onClick={() => restoreUser(selectedUser)}
                      className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Restore Account
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendUser(selectedUser)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Suspend Account
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 font-bold text-gray-800">
                    Issue Official Warning
                  </h3>
                  <form onSubmit={issueWarning} className="space-y-3">
                    <textarea
                      required
                      minLength={10}
                      maxLength={1000}
                      value={warningMessage}
                      onChange={(event) => setWarningMessage(event.target.value)}
                      placeholder="Write the warning that the student will receive..."
                      className="min-h-24 w-full rounded-xl border border-green-100 p-3 outline-none focus:border-green-500"
                    />
                    <input
                      required
                      minLength={3}
                      maxLength={500}
                      value={warningReason}
                      onChange={(event) => setWarningReason(event.target.value)}
                      placeholder="Internal reason for issuing this warning"
                      className="w-full rounded-xl border border-green-100 p-3 outline-none focus:border-green-500"
                    />
                    <button className="rounded-xl bg-[#075c3b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800">
                      Issue Warning
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="mb-3 font-bold text-gray-800">Warning History</h3>
                  {selectedUser.receivedWarnings?.length ? (
                    <div className="space-y-3">
                      {selectedUser.receivedWarnings.map((warning) => (
                        <div key={warning.id} className="rounded-xl bg-green-50 p-4">
                          <p className="text-sm">{warning.message}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            Issued by {warning.issuedBy?.name || "Owner"} ·{" "}
                            {formatDate(warning.createdAt)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-green-800">
                            {warning.acknowledgedAt
                              ? `Acknowledged ${formatDate(warning.acknowledgedAt)}`
                              : "Not acknowledged"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No warnings issued.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 font-bold text-gray-800">Recent Listings</h3>
                  {selectedUser.products?.length ? (
                    <div className="space-y-2">
                      {selectedUser.products.map((product) => (
                        <div
                          key={product.id}
                          className="flex flex-wrap justify-between gap-2 rounded-xl border border-gray-100 p-3 text-sm"
                        >
                          <span className="font-medium">{product.title}</span>
                          <span className="text-gray-500">
                            ₹{product.price} · {product.moderationStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No listings found.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "listings" && (
          <div className="space-y-5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadListings();
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                value={listingSearch}
                onChange={(event) => setListingSearch(event.target.value)}
                placeholder="Search listing or seller..."
                className="min-w-[200px] flex-1 rounded-xl border border-green-100 bg-white p-3 outline-none focus:border-green-500"
              />
              <select
                value={listingStatus}
                onChange={(event) => setListingStatus(event.target.value)}
                className="rounded-xl border border-green-100 bg-white p-3"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="HIDDEN">Hidden</option>
                <option value="REMOVED">Removed</option>
              </select>
              <button className="rounded-xl bg-[#075c3b] px-5 font-semibold text-white">
                Apply
              </button>
            </form>

            <div className="space-y-3">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <div>
                    <h3 className="font-bold text-gray-800">{listing.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Seller: {listing.seller?.name} · {listing.seller?.email}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-800">
                      ₹{listing.price}
                    </p>
                    <div className="mt-2">
                      <Status>{listing.moderationStatus}</Status>
                    </div>
                    {listing.moderationReason && (
                      <p className="mt-2 text-xs text-gray-500">
                        Reason: {listing.moderationReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {listing.moderationStatus !== "ACTIVE" && (
                      <button
                        onClick={() => moderateListing(listing, "ACTIVE")}
                        className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-800"
                      >
                        <Eye size={14} /> Restore
                      </button>
                    )}
                    {listing.moderationStatus !== "HIDDEN" && (
                      <button
                        onClick={() => moderateListing(listing, "HIDDEN")}
                        className="flex items-center gap-1 rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-800"
                      >
                        <EyeOff size={14} /> Hide
                      </button>
                    )}
                    {listing.moderationStatus !== "REMOVED" && (
                      <button
                        onClick={() => moderateListing(listing, "REMOVED")}
                        className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {listings.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
                  No listings found.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-gray-600">
                Report status
              </label>
              <select
                value={reportStatus}
                onChange={(event) => setReportStatus(event.target.value)}
                className="rounded-xl border border-green-100 bg-white p-3"
              >
                <option value="">All reports</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="ACTION_TAKEN">Action taken</option>
              </select>
              <button
                onClick={loadReports}
                className="rounded-xl bg-[#075c3b] px-5 py-3 text-sm font-semibold text-white"
              >
                Apply
              </button>
            </div>

            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Status>{report.status}</Status>
                    <span className="text-xs text-gray-400">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-gray-800">
                    {report.reason || "No report reason provided"}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-gray-500">
                    <p>Reported by: {report.reporter?.name || "Unknown"}</p>
                    {report.reportedUser && (
                      <p>Reported student: {report.reportedUser.name}</p>
                    )}
                    {report.product && <p>Listing: {report.product.title}</p>}
                  </div>

                  {report.resolution && (
                    <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                      Review notes: {report.resolution}
                    </p>
                  )}

                  {report.status === "PENDING" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => reviewReport(report, "REVIEWED")}
                        className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800"
                      >
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => reviewReport(report, "DISMISSED")}
                        className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => reviewReport(report, "ACTION_TAKEN")}
                        className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-800"
                      >
                        Action Taken
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {reports.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
                  No reports found.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "announcements" && (
          <div className="space-y-7">
            <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-xl bg-green-100 p-3 text-green-800">
                  <Megaphone size={23} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#075c3b]">
                    Publish an announcement
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Send an update to every registered UniMart account,
                    including students who are currently suspended.
                  </p>
                </div>
              </div>

              <form onSubmit={publishAnnouncement} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Announcement title
                  </label>
                  <input
                    required
                    maxLength={120}
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    placeholder="e.g. Important campus marketplace update"
                    className="w-full rounded-xl border border-green-100 bg-white p-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">
                    {announcementTitle.length}/120
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Message
                  </label>
                  <textarea
                    required
                    minLength={1}
                    maxLength={5000}
                    rows={6}
                    value={announcementMessage}
                    onChange={(event) => setAnnouncementMessage(event.target.value)}
                    placeholder="Write the announcement for students..."
                    className="w-full resize-y rounded-xl border border-green-100 bg-white p-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">
                    {announcementMessage.length}/5000
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <input
                    type="checkbox"
                    checked={announcementUrgent}
                    onChange={(event) => setAnnouncementUrgent(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-green-700"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-bold text-yellow-900">
                      <AlertTriangle size={16} />
                      Mark as urgent
                    </span>
                    <span className="mt-1 block text-xs text-yellow-800">
                      Urgent announcements will be highlighted for students.
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    This announcement will be visible to all registered accounts.
                  </p>
                  <button
                    type="submit"
                    disabled={publishingAnnouncement}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#075c3b] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={16} />
                    {publishingAnnouncement ? "Publishing..." : "Publish announcement"}
                  </button>
                </div>
              </form>
            </section>

            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#075c3b]">
                    Announcement history
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    View published and archived announcements.
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">
                  {announcements.length} loaded
                </span>
              </div>

              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      announcement.isActive
                        ? announcement.isUrgent
                          ? "border-yellow-300"
                          : "border-green-100"
                        : "border-gray-200 opacity-75"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {announcement.isUrgent && (
                          <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-900">
                            <AlertTriangle size={13} />
                            Urgent
                          </span>
                        )}
                        <Status>
                          {announcement.isActive ? "ACTIVE" : "ARCHIVED"}
                        </Status>
                      </div>

                      {announcement.isActive && (
                        <button
                          onClick={() => archiveAnnouncement(announcement)}
                          disabled={archivingId === announcement.id}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                        >
                          <Archive size={14} />
                          {archivingId === announcement.id ? "Archiving..." : "Archive"}
                        </button>
                      )}
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-gray-900">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
                      {announcement.message}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                      <span>Published: {formatDate(announcement.publishedAt)}</span>
                      <span className="font-semibold text-green-800">
                        <Eye size={13} className="mr-1 inline" />
                        {announcement.readCount ?? 0} read receipts
                      </span>
                      <span>By {announcement.createdBy?.name || "Owner"}</span>
                    </div>
                  </article>
                ))}

                {!loading && announcements.length === 0 && (
                  <div className="rounded-2xl border border-green-100 bg-white p-10 text-center">
                    <Megaphone size={36} className="mx-auto mb-3 text-green-700" />
                    <h3 className="font-bold text-gray-800">No announcements yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Publish your first announcement using the form above.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === "team" && isOwner && <AdminTeam />}

        {tab === "activity" && isOwner && (
          <div className="overflow-x-auto rounded-2xl border border-green-100 bg-white shadow-sm">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-green-50 text-gray-600">
                <tr>
                  <th className="p-4">Action</th>
                  <th className="p-4">Admin</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action.id} className="border-t border-gray-100">
                    <td className="p-4 font-semibold">
                      {action.action.replaceAll("_", " ")}
                    </td>
                    <td className="p-4">{action.actor?.name || "Unknown"}</td>
                    <td className="p-4">
                      {action.targetUser?.name || action.targetProduct?.title || "—"}
                    </td>
                    <td className="max-w-xs p-4 text-gray-500">
                      {action.reason || "—"}
                    </td>
                    <td className="p-4 text-gray-500">
                      {formatDate(action.createdAt)}
                    </td>
                  </tr>
                ))}
                {actions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No admin actions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
