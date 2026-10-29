import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

interface RegisterResponse {
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

const Register = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: currentUser, isFetching, isError } = useCurrentUser();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    // Redirect if already logged in - prevents back navigation to register after logging in
    useEffect(() => {
        const user = currentUser;
        if (user && !isFetching && !isError) {
            navigate("/select-organization", { replace: true });
        }
    }, [navigate, currentUser, isFetching, isError]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setFieldErrors({});

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const response = await api.post("/auth/register/", {
                first_name: firstName,
                last_name: lastName,
                email,
                password
            });
            const data: RegisterResponse = await response.json();

            // Refresh the profile without persisting credentials
            queryClient.clear();
            queryClient.setQueryData(["users", "current"], data.user);
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");

            // Redirect to Organization Selector Hub with replace to prevent back navigation
            navigate("/select-organization", { replace: true });
        } catch (err: unknown) {
            console.error('Registration error:', err);
            let errorMsg = "";

            if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'ApiError' && 'data' in err) {
                const errorData = (err as { data: Record<string, unknown> }).data;

                if (errorData.errors && typeof errorData.errors === 'object') {
                    const newFieldErrors: Record<string, string[]> = {};
                    let hasFieldErrors = false;

                    Object.entries(errorData.errors as Record<string, unknown>).forEach(([field, msgs]) => {
                        if (field === 'non_field_errors') {
                            const nonFieldMsgs = Array.isArray(msgs) ? msgs.join('; ') : String(msgs);
                            errorMsg = errorMsg ? `${errorMsg}; ${nonFieldMsgs}` : nonFieldMsgs;
                        } else {
                            newFieldErrors[field] = Array.isArray(msgs) ? msgs.map(String) : [String(msgs)];
                            hasFieldErrors = true;
                        }
                    });

                    if (hasFieldErrors) {
                        setFieldErrors(newFieldErrors);
                    }
                }

                if (!errorMsg && !Object.keys(fieldErrors).length) {
                    errorMsg = (errorData.message as string) || "Registration failed";
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

            <div className="mb-4">
                <h2 className="text-3xl font-bold text-[#293F55] dark:text-white mb-2">Create an Account</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Sign up to access the performance evaluation system.</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3">
                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200 animate-fade-up">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 animate-fade-up delay-100">
                    <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">
                            First Name
                        </Label>
                        <Input
                            id="firstName"
                            placeholder="John"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all ${fieldErrors.first_name ? "border-red-500 focus-visible:border-red-500" : ""}`}
                        />
                        {fieldErrors.first_name && (
                            <p className="text-sm text-red-500 mt-1">{fieldErrors.first_name[0]}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">
                            Last Name
                        </Label>
                        <Input
                            id="lastName"
                            placeholder="Doe"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all ${fieldErrors.last_name ? "border-red-500 focus-visible:border-red-500" : ""}`}
                        />
                        {fieldErrors.last_name && (
                            <p className="text-sm text-red-500 mt-1">{fieldErrors.last_name[0]}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2 animate-fade-up delay-100">
                    <Label htmlFor="email" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">
                        Institutional Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        placeholder="firstname.lastname@cit.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all ${fieldErrors.email ? "border-red-500 focus-visible:border-red-500" : ""}`}
                    />
                    {fieldErrors.email && (
                        <p className="text-sm text-red-500 mt-1 animate-fade-up">
                            {fieldErrors.email[0]}
                        </p>
                    )}
                </div>

                <div className="space-y-2 animate-fade-up delay-200">
                    <Label htmlFor="password" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all pr-10 ${fieldErrors.password ? "border-red-500 focus-visible:border-red-500" : ""}`}
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

                <div className="space-y-2 animate-fade-up delay-200">
                    <Label htmlFor="confirmPassword" className="text-[#293F55] dark:text-slate-300 font-semibold text-sm">Confirm Password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#293F55] dark:text-white focus-visible:ring-[#293F55] dark:focus-visible:ring-[#FCBD78] focus-visible:ring-offset-0 focus-visible:border-[#293F55] transition-all pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#293F55] dark:hover:text-[#FCBD78] transition-colors"
                        >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="pt-2 animate-fade-up delay-300">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 text-base font-bold bg-[#FCBD78] hover:bg-[#faa94f] text-[#293F55] shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating account..." : "Sign Up"}
                    </Button>
                </div>
            </form>

            <div className="mt-4 text-center animate-fade-up delay-300">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <button
                        onClick={() => navigate("/login")}
                        className="font-semibold text-[#FCBD78] hover:text-[#faa94f] transition-colors"
                    >
                        Sign In
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Register;
