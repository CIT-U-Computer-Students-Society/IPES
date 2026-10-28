import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ThemeProvider } from "./components/theme-provider";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SelectOrganization from "./pages/SelectOrganization";
import NotFound from "./pages/NotFound";
import AuthLayout from "./components/layout/AuthLayout";

// Officer pages
import OfficerLayout from "./components/layout/OfficerLayout";
import OfficerDashboard from "./pages/officer/Dashboard";
import OfficerEvaluations from "./pages/officer/Evaluations";
import EvaluationForm from "./pages/officer/EvaluationForm";
import OfficerResults from "./pages/officer/Results";
import OfficerAccomplishments from "./pages/officer/Accomplishments";

// Admin pages
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrganization from "./pages/admin/Organization";
import AdminFormBuilder from "./pages/admin/FormBuilder";
import AdminAssignments from "./pages/admin/Assignments";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminAccomplishments from "./pages/admin/AdminAccomplishments";
import AdminUsers from "./pages/admin/Users";
import AdminAuditLog from "./pages/admin/AuditLog";
import AdminSettings from "./pages/admin/Settings";



const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
        <OrganizationProvider>
          <Notifications position="top-right" zIndex={1000} />
          <BrowserRouter>
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
        </BrowserRouter>
      </OrganizationProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
