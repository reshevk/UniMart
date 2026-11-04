import { useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Mail, Lock, ShoppingBag } from "lucide-react";
import API from "../api";

function Login({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setMessageType("");
    setLoading(true);

    try {
      const response = await API.post("/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      await onLogin(response.data.token);

      setMessage("Login successful!");
      setMessageType("success");

      const destination =
        location.state?.from?.pathname || "/account";

      navigate(destination, { replace: true });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Login failed. Please try again."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
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
            Welcome Back
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Login to your student marketplace account
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