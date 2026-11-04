import { useCallback, useEffect, useState } from "react";
import { UserPlus, Save, Trash2, RefreshCw, ShieldCheck } from "lucide-react";
import API from "../api";

const permissions = [
  { key: "canManageUsers", label: "Manage students" },
  { key: "canManageListings", label: "Manage listings" },
  { key: "canManageReports", label: "Manage reports" },
  { key: "canManageAnnouncements", label: "Manage announcements" },
];

const emptyPermissions = {
  canManageUsers: false,
  canManageListings: false,
  canManageReports: false,
  canManageAnnouncements: false,
};

function PermissionCheckboxes({ value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {permissions.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                [key]: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-green-700"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function AdminTeam() {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [newPermissions, setNewPermissions] = useState({ ...emptyPermissions });
  const [editingId, setEditingId] = useState(null);
  const [editPermissions, setEditPermissions] = useState({ ...emptyPermissions });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/admin/team");
      setMembers(
        response.data.members ||
        response.data.teamMembers ||
        response.data.team ||
        response.data.admins ||
        []
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load admin team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTeam();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTeam]);

  async function addMember(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await API.post("/admin/team", {
        email: email.trim().toLowerCase(),
        ...newPermissions,
      });

      setEmail("");
      setNewPermissions({ ...emptyPermissions });
      setNotice("Admin team member added successfully.");
      await loadTeam();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add team member.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(member) {
    setEditingId(member.id);
    setEditPermissions({
      canManageUsers: Boolean(member.canManageUsers),
      canManageListings: Boolean(member.canManageListings),
      canManageReports: Boolean(member.canManageReports),
      canManageAnnouncements: Boolean(member.canManageAnnouncements),
    });
    setError("");
    setNotice("");
  }

  async function savePermissions(id) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await API.patch(`/admin/team/${id}`, editPermissions);
      setEditingId(null);
      setNotice("Team member permissions updated.");
      await loadTeam();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member) {
    const person = member.user || member;
    const name = person.name || person.email || "this member";

    if (!window.confirm(`Remove ${name} from the admin team? Their account will return to student access.`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await API.delete(`/admin/team/${member.id}`);
      setNotice(`${name} was removed from the admin team.`);
      await loadTeam();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove team member.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-green-50 p-3 text-green-800">
            <UserPlus size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#075c3b]">Add team member</h2>
            <p className="text-sm text-gray-500">
              Add an existing registered student and assign permissions.
            </p>
          </div>
        </div>

        <form onSubmit={addMember} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              College email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@sst.scaler.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">
              Assign permissions
            </p>
            <PermissionCheckboxes
              value={newPermissions}
              onChange={setNewPermissions}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !email.trim()}
            className="flex items-center gap-2 rounded-xl bg-[#075c3b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-50"
          >
            <UserPlus size={16} />
            Add to admin team
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#075c3b]">Current team</h2>
            <p className="text-sm text-gray-500">
              Review and manage your admin team members.
            </p>
          </div>
          <button
            onClick={loadTeam}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-green-200 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading team...</p>
        ) : members.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-8 text-center text-sm text-gray-600">
            No additional admin team members yet.
          </p>
        ) : (
          <div className="space-y-4">
            {members.map((member) => {
              const person = member.user || member;
              const isEditing = editingId === member.id;

              return (
                <article
                  key={member.id}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {person.name || "Unnamed student"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {person.email || "No email available"}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                        <ShieldCheck size={13} />
                        Admin
                      </span>
                    </div>

                    {!isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(member)}
                          className="rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50"
                        >
                          Edit permissions
                        </button>
                        <button
                          onClick={() => removeMember(member)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                          aria-label="Remove team member"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
                      <PermissionCheckboxes
                        value={editPermissions}
                        onChange={setEditPermissions}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => savePermissions(member.id)}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-[#075c3b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          <Save size={15} />
                          Save permissions
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {permissions.map(({ key, label }) => (
                        <span
                          key={key}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            member[key]
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {label}: {member[key] ? "Yes" : "No"}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(error || notice) && (
        <div
          className={`rounded-xl p-4 text-sm ${
            error
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error || notice}
        </div>
      )}
    </div>
  );
}

export default AdminTeam;
