import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Phone,
  Mail,
  ShieldAlert,
} from "lucide-react";

type View = "login" | "forgot" | "forgot-success";

type ForgotResult = {
  found: boolean;
  fullName?: string;
  maskedEmail?: string | null;
  maskedPhone?: string | null;
};

export default function Login() {
  const [view, setView] = useState<View>("login");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // Forgot password state
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotResult, setForgotResult] = useState<ForgotResult | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { username, password } },
      { onSuccess: () => setLocation("/dashboard") }
    );
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data: ForgotResult = await res.json();
      setForgotResult(data);
      setView("forgot-success");
    } catch {
      setForgotError("Unable to process request. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgot = () => {
    setForgotUsername("");
    setForgotError("");
    setForgotResult(null);
    setView("login");
  };

  return (
    <div
      className="min-h-screen flex items-stretch"
      style={{ background: "linear-gradient(135deg, #0d2447 0%, #0d3d6e 50%, #0a5c3e 100%)" }}
    >
      {/* Left branding panel — hidden on small screens */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1 px-12 py-16 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute bottom-[-60px] right-[-60px] w-56 h-56 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-[-40px] w-32 h-32 rounded-full bg-green-500/10" />

        <div className="relative z-10 max-w-sm text-center">
          <img
            src="/logo.png"
            alt="Jimma City MIS Logo"
            className="w-56 h-56 object-contain mx-auto mb-8 drop-shadow-2xl"
          />
          <div className="flex items-center gap-2 justify-center mt-4">
            {["Register", "Manage", "Secure", "Serve"].map((w, i) => (
              <span key={w} className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-blue-200/80">
                  {w}
                </span>
                {i < 3 && <span className="text-emerald-400/60 text-xs">|</span>}
              </span>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { value: "Kebele", label: "Coverage" },
              { value: "Digital", label: "Records" },
              { value: "Secure", label: "Access" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <div className="text-white font-bold text-sm">{stat.value}</div>
                <div className="text-blue-200/70 text-[10px] uppercase tracking-wide mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:max-w-md lg:bg-white/5 lg:backdrop-blur-sm">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Card top accent bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #0d2447 0%, #1a5276 50%, #1e8449 100%)" }} />

            <div className="px-8 pt-8 pb-6">
              {/* Mobile logo */}
              <div className="flex flex-col items-center mb-6 lg:hidden">
                <img
                  src="/logo.png"
                  alt="Jimma City MIS"
                  className="w-28 h-28 object-contain mb-3"
                />
              </div>

              {/* ── LOGIN VIEW ── */}
              {view === "login" && (
                <>
                  <div className="mb-6 hidden lg:block">
                    <h2 className="text-2xl font-bold text-[#0d2447]">Welcome back</h2>
                    <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
                  </div>
                  <div className="mb-6 lg:hidden">
                    <h2 className="text-lg font-bold text-[#0d2447] text-center">Sign In</h2>
                  </div>

                  {login.isError && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      Invalid username or password. Please try again.
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-[#0d2447] font-medium text-sm">
                        Username
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter your username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          disabled={login.isPending}
                          className="pl-9 border-gray-200 focus:border-[#1a5276] focus:ring-[#1a5276]/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-[#0d2447] font-medium text-sm">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={login.isPending}
                          className="pl-9 pr-10 border-gray-200 focus:border-[#1a5276] focus:ring-[#1a5276]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setView("forgot")}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-medium transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full mt-1 text-sm font-semibold"
                      style={{ background: "linear-gradient(90deg, #0d2447 0%, #1a5276 100%)" }}
                      disabled={login.isPending || !username || !password}
                    >
                      {login.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Authenticating…
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </>
              )}

              {/* ── FORGOT PASSWORD VIEW ── */}
              {view === "forgot" && (
                <>
                  <button
                    type="button"
                    onClick={resetForgot}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0d2447] mb-5 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </button>

                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-[#0d2447]">Forgot password?</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Enter your username and we'll look up your account details.
                    </p>
                  </div>

                  {forgotError && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      {forgotError}
                    </div>
                  )}

                  <form onSubmit={handleForgot} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-username" className="text-[#0d2447] font-medium text-sm">
                        Username or Email
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="forgot-username"
                          type="text"
                          placeholder="Enter your username or email"
                          value={forgotUsername}
                          onChange={(e) => setForgotUsername(e.target.value)}
                          required
                          disabled={forgotLoading}
                          className="pl-9 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full font-semibold"
                      style={{ background: "linear-gradient(90deg, #1e5631 0%, #27ae60 100%)" }}
                      disabled={forgotLoading || !forgotUsername.trim()}
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Looking up account…
                        </>
                      ) : (
                        "Look Up Account"
                      )}
                    </Button>
                  </form>
                </>
              )}

              {/* ── FORGOT SUCCESS VIEW ── */}
              {view === "forgot-success" && forgotResult && (
                <>
                  {forgotResult.found ? (
                    <div className="text-center space-y-4">
                      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[#0d2447]">Account Found</h2>
                        {forgotResult.fullName && (
                          <p className="text-sm text-gray-600 mt-1">
                            Hello, <span className="font-medium">{forgotResult.fullName}</span>
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-left space-y-3">
                        <p className="text-sm font-semibold text-[#0d2447]">
                          Contact your system administrator to reset your password:
                        </p>

                        {forgotResult.maskedEmail && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                            <span>
                              Registered email:{" "}
                              <span className="font-mono font-medium">{forgotResult.maskedEmail}</span>
                            </span>
                          </div>
                        )}
                        {forgotResult.maskedPhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                            <span>
                              Registered phone:{" "}
                              <span className="font-mono font-medium">{forgotResult.maskedPhone}</span>
                            </span>
                          </div>
                        )}
                        {!forgotResult.maskedEmail && !forgotResult.maskedPhone && (
                          <p className="text-sm text-gray-500">
                            No contact details on file. Please visit your nearest Jimma City administration office.
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-gray-400">
                        An administrator can reset your password in the user management section.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                        <ShieldAlert className="h-7 w-7 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[#0d2447]">Account Not Found</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          No active account matched that username. Please check the spelling or contact your administrator.
                        </p>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-6 border-[#0d2447]/30 text-[#0d2447] hover:bg-[#0d2447]/5"
                    onClick={resetForgot}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-8 py-3 flex items-center justify-center gap-2 border-t border-gray-100"
              style={{ background: "#f8fafc" }}
            >
              <Lock className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">
                Authorized personnel only — Jimma City Administration
              </span>
            </div>
          </div>

          {/* Below card note */}
          <p className="text-center text-[11px] text-white/40 mt-6">
            © {new Date().getFullYear()} Jimma City Administration. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
