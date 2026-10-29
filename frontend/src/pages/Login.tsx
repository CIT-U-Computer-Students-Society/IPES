import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface LoginResponse {
  user: {
    id: number;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  };
  message: string;
}

const Login = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser, isFetching, isError } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Redirect if already logged in - prevents back navigation to login after logging in
  useEffect(() => {
    const user = currentUser;
    if (user && !isFetching && !isError) {
      navigate("/select-organization", { replace: true });
    }
  }, [navigate, currentUser, isFetching, isError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await api.post("/auth/login/", { email, password });
      const data: LoginResponse = await response.json();

      // Refresh the authenticated profile without persisting credentials
      queryClient.clear();
      queryClient.setQueryData(["users", "current"], data.user);
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");

      // Redirect to Organization Selector Hub with replace to prevent back navigation
      navigate("/select-organization", { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      let errorMsg = "";

      if (err instanceof ApiError && err.data && typeof err.data === 'object') {
        const errorData = err.data as { message?: string; errors?: Record<string, string | string[]> };

        // Handle field-specific errors if available
        if (errorData.errors) {
          const newFieldErrors: Record<string, string[]> = {};
          let hasFieldErrors = false;

          Object.entries(errorData.errors).forEach(([field, msgs]) => {
            if (field === 'non_field_errors') {
              // Collect non-field errors to show in the main alert
              const nonFieldMsgs = Array.isArray(msgs) ? msgs.join('; ') : msgs;
              errorMsg = errorMsg ? `${errorMsg}; ${nonFieldMsgs}` : nonFieldMsgs;
            } else {
              // Collect field-specific errors
              newFieldErrors[field] = Array.isArray(msgs) ? msgs : [msgs];
              hasFieldErrors = true;
            }
          });

          if (hasFieldErrors) {
            setFieldErrors(newFieldErrors);
          }
        }

        // Fallback to message if no specific errors parsed or if message is present
        if (!errorMsg && !Object.keys(fieldErrors).length) {
          errorMsg = errorData.message || "Login failed";
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      if (errorMsg) {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 animate-fade-up my-auto transition-colors duration-300">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center gap-2 mb-8 justify-center text-[#293F55] dark:text-blue-100">
        <img src="/ipes-logo-colored.svg" alt="Logo" className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight">IPES Portal</span>
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-bold text-[#293F55] dark:text-white mb-2">Sign In</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Please enter your official credentials to continue.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200 animate-fade-up">
            {error}
          </div>
        )}
        <div className="space-y-2 animate-fade-up delay-100">
          <Label htmlFor="email" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">
            Institutional Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="firstname.lastname@cit.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all ${fieldErrors.email ? "border-red-500 focus-visible:border-red-500" : ""}`}
            required
          />
          {fieldErrors.email && (
            <p className="text-sm text-red-500 mt-1 animate-fade-up">
              {fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="space-y-2 animate-fade-up delay-200">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">Password</Label>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all pr-10 ${fieldErrors.password ? "border-red-500 focus-visible:border-red-500" : ""}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#293F55] dark:hover:text-[#FCBD78] transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-sm text-red-500 mt-1 animate-fade-up">
              {fieldErrors.password[0]}
            </p>
          )}
        </div>

        <div className="pt-2 animate-fade-up delay-300">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-bold bg-[#FCBD78] hover:bg-[#faa94f] text-[#293F55] shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </div>
      </form>

      <div className="mt-4 text-center animate-fade-up delay-300">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <button
            onClick={() => navigate("/register")}
            className="font-semibold text-[#FCBD78] hover:text-[#faa94f] transition-colors"
          >
            Sign Up
          </button>
        </p>
      </div>

    </div>
  );
};

export default Login;
