import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, ShieldCheck } from "lucide-react";
import API from "../api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
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

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      setStep(2);
      setMessage(response.data.message);
      setMessageType("success");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!/^\d{6}$/.test(otp)) {
      setMessage("Enter the 6-digit verification code");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/auth/verify-email", {
        email: formData.email,
        otp,
      });

      localStorage.setItem("unimart_token", response.data.token);
      localStorage.setItem(
        "unimart_user",
        JSON.stringify(response.data.user)
      );

      setMessage(response.data.message);
      setMessageType("success");

      navigate("/");
      window.location.reload();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Verification failed. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setMessage("");
    setMessageType("");
    setLoading(true);

    try {
      const response = await API.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      setMessage(response.data.message);
      setMessageType("success");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to resend code. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4faf6] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f7ef] text-[#16865a]">
            {step === 1 ? (
              <User size={27} />
            ) : (
              <ShieldCheck size={27} />
            )}
          </div>

          <h1 className="text-3xl font-bold text-[#075c3b]">
            {step === 1 ? "Create Account" : "Verify Your Email"}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {step === 1
              ? "Join your college marketplace"
              : `We sent a 6-digit code to ${formData.email}`}
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

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Full Name
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <User size={18} className="text-gray-400" />
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

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
                  placeholder="Minimum 8 characters"
                  className="w-full py-3 outline-none"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Confirm Password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <Lock size={18} className="text-gray-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className="w-full py-3 outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Sending code..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                6-Digit Verification Code
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4">
                <ShieldCheck size={18} className="text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter OTP"
                  className="w-full py-3 text-center text-xl tracking-[0.5em] outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#16865a] to-[#075c3b] py-3 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="w-full text-sm font-semibold text-[#16865a] disabled:opacity-60"
            >
              Resend verification code
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp("");
                setMessage("");
              }}
              className="w-full text-sm text-gray-500"
            >
              Back to registration
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#16865a]">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;