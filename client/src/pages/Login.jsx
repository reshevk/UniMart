
import { useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Mail,
  Lock,
  ShoppingBag,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import API from "../api";

function Login({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  function showMessage(text, type = "error") {
    setMessage(text);
    setMessageType(type);
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await API.post("/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      await onLogin(response.data.token);

      const destination =
        location.state?.from?.pathname || "/account";

      navigate(destination, { replace: true });
    } catch (error) {
      showMessage(
        error.response?.data?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestResetOtp(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await API.post("/auth/forgot-password", {
        email: formData.email,
      });

      showMessage(
        response.data.message,
        "success"
      );

      setMode("reset");
    } catch (error) {
      showMessage(
        error.response?.data?.message ||
          "Unable to process your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setMessage("");

    if (newPassword.length < 8 || newPassword.length > 128) {
      showMessage("Password must be between 8 and 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/auth/reset-password", {
        email: formData.email,
        otp,
        newPassword,
      });

      showMessage(response.data.message, "success");

      setFormData((previous) => ({
        ...previous,
        password: "",
      }));
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch (error) {
      showMessage(
        error.response?.data?.message ||
          "Password reset failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function goToLogin() {
    setMode("login");
    setMessage("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4faf6] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white bg-white/75 p-8 shadow-xl backdrop-blur-xl">

        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="rounded-xl bg-green-700 p-2 text-white">
            <ShoppingBag size={22} />
          </div>

          <span className="text-2xl font-bold">
            Uni<span className="text-green-700">Mart</span>
          </span>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#075c3b]">
            {mode === "login"
              ? "Welcome Back"
              : mode === "forgot"
                ? "Forgot Password?"
                : "Reset Password"}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {mode === "login"
              ? "Login to your student marketplace account"
              : mode === "forgot"
                ? "We'll send a verification code to your college email"
                : "Enter the code sent to your email and choose a new password"}
          </p>
        </div>

        {message && (
          <div
            className={`mb-5 rounded-xl p-3 text-center text-sm font-medium ${
              messageType === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {mode === "login" && (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  College Email
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                  <Mail size={18} className="text-gray-400" />

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@sst.scaler.com"
                    className="w-full py-3 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Password
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                  <Lock size={18} className="text-gray-400" />

                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full py-3 outline-none"
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setMode("forgot");
                  }}
                  className="mt-3 block ml-auto text-sm font-semibold text-green-700 hover:text-green-900"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#16865a]"
              >
                Create Account
              </Link>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <form onSubmit={requestResetOtp} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                College Email
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Mail size={18} className="text-gray-400" />

                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                  placeholder="you@sst.scaler.com"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {loading ? "Sending code..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={resetPassword} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Verification Code
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <KeyRound size={18} className="text-gray-400" />

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter 6-digit code"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                New Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Lock size={18} className="text-gray-400" />

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Confirm New Password
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Lock size={18} className="text-gray-400" />

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter password again"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {mode !== "login" && (
          <button
            type="button"
            onClick={goToLogin}
            className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-green-700"
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>
        )}

        <Link
          to="/"
          className="mt-5 block text-center text-sm text-gray-500 hover:text-green-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default Login;
