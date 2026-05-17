import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, ShieldAlert, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("Invalid or missing reset link. Please request a new one.");
    } else {
      setToken(t);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Accent bar */}
          <div className="h-2" style={{ background: "linear-gradient(90deg, #0d2447 0%, #1a5276 50%, #27ae60 100%)" }} />

          <div className="px-10 pt-8 pb-6">
            {success ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-black">Password Updated</h2>
                  <p className="text-base text-black font-medium mt-2">
                    Your password has been successfully reset. You can now sign in with your new password.
                  </p>
                </div>
                <Button
                  className="w-full h-12 text-base font-bold mt-2"
                  style={{ background: "linear-gradient(90deg, #0d2447 0%, #1a5276 100%)" }}
                  onClick={() => navigate("/login")}
                >
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-3xl font-extrabold text-black">Set New Password</h2>
                  <p className="text-base text-black font-medium mt-1">
                    Choose a strong password for your account.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {!token ? null : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-black font-semibold text-base">
                        New Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="pl-10 pr-10 h-12 text-base text-black placeholder:text-gray-400 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-black font-semibold text-base">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <Input
                          id="confirm-password"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat your new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="pl-10 pr-10 h-12 text-base text-black placeholder:text-gray-400 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full mt-2 h-12 text-base font-bold"
                      style={{ background: "linear-gradient(90deg, #0d2447 0%, #1a5276 100%)" }}
                      disabled={loading || !newPassword || !confirmPassword}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating password…
                        </>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                  </form>
                )}

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="flex items-center gap-1.5 text-sm text-black font-semibold hover:underline mx-auto"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </button>
                </div>
              </>
            )}
          </div>

          <div
            className="px-8 py-4 flex items-center justify-center gap-2 border-t border-gray-200"
            style={{ background: "#f0f4f8" }}
          >
            <Lock className="h-4 w-4 text-black" />
            <span className="text-sm text-black font-semibold">
              Authorized personnel only — Jimma City Administration
            </span>
          </div>
        </div>

        <p className="text-center text-sm text-black font-medium mt-6">
          © {new Date().getFullYear()} Jimma City Administration. All rights reserved.
        </p>
      </div>
    </div>
  );
}
