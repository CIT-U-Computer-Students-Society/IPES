import { lazy, Suspense } from "react";
import { RouteLoading } from "./components/RouteLoading";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ThemeProvider } from "./components/theme-provider";

// Pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SelectOrganization = lazy(() => import("./pages/SelectOrganization"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthLayout = lazy(() => import("./components/layout/AuthLayout"));

// Officer pages
const OfficerLayout = lazy(() => import("./components/layout/OfficerLayout"));
const OfficerDashboard = lazy(() => import("./pages/officer/Dashboard"));
const OfficerEvaluations = lazy(() => import("./pages/officer/Evaluations"));
const EvaluationForm = lazy(() => import("./pages/officer/EvaluationForm"));
const OfficerResults = lazy(() => import("./pages/officer/Results"));
const OfficerAccomplishments = lazy(() => import("./pages/officer/Accomplishments"));

// Admin pages
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminOrganization = lazy(() => import("./pages/admin/Organization"));
const AdminFormBuilder = lazy(() => import("./pages/admin/FormBuilder"));
const AdminAssignments = lazy(() => import("./pages/admin/Assignments"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminAccomplishments = lazy(() => import("./pages/admin/AdminAccomplishments"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        <Notifications position="top-right" zIndex={1000} />
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Index />} />

              {/* Auth routes wrapped in AuthLayout */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>

              <Route path="/select-organization" element={<SelectOrganization />} />

              {/* Member routes */}
              <Route path="/member" element={<OfficerLayout />}>
                <Route path="dashboard" element={<OfficerDashboard />} />
                <Route path="evaluations" element={<OfficerEvaluations />} />
                <Route path="evaluations/:id" element={<EvaluationForm />} />
                <Route path="results" element={<OfficerResults />} />
                <Route path="accomplishments" element={<OfficerAccomplishments />} />
              </Route>

              {/* Admin routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="organization" element={<AdminOrganization />} />
                <Route path="forms" element={<AdminFormBuilder />} />
                <Route path="assignments" element={<AdminAssignments />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="accomplishments" element={<AdminAccomplishments />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="audit-log" element={<AdminAuditLog />} />
                <Route path="settings" element={<AdminSettings />} />

                {/* My Space (Member overlay) */}
                <Route path="my-dashboard" element={<OfficerDashboard />} />
                <Route path="my-evaluations" element={<OfficerEvaluations />} />
                <Route path="my-evaluations/:id" element={<EvaluationForm />} />
                <Route path="my-results" element={<OfficerResults />} />
                <Route path="my-accomplishments" element={<OfficerAccomplishments />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </OrganizationProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
