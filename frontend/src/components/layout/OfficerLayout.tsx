import { RouteLoading } from "@/components/RouteLoading";
import { Suspense, useState } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useCurrentUser, useLogout } from "@/hooks/useUsers";
import { useOrganizationState } from "@/contexts/OrganizationContext";
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  Loader2,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

import { ProfileEditorDialog } from "@/components/ProfileEditorDialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  { name: "Dashboard", href: "/member/dashboard", icon: LayoutDashboard },
  { name: "My Evaluations", href: "/member/evaluations", icon: ClipboardList },
  { name: "My Results", href: "/member/results", icon: BarChart3 },
  { name: "Accomplishments", href: "/member/accomplishments", icon: Trophy },
];

const OfficerLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: user, isLoading, isError } = useCurrentUser();
  const { activeOrganizationId } = useOrganizationState();
  const { logout } = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Validate User Context
  if (isError || !user || !activeOrganizationId) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Find their membership in the currently active organization
  const activeMembership = user.memberships?.find(
    (m) => m.organization_id === activeOrganizationId
  );

  // Deny access if they don't have membership permissions within THIS specific org
  if (!activeMembership || !['Member', 'Admin'].includes(activeMembership.role)) {
    return <Navigate to="/select-organization" replace />;
  }

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-40",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <Link to="/member/dashboard" className="flex items-center gap-2.5">
              <img src="/ipes-logo-colored.svg" alt="IPES Logo" className="w-7 h-7 object-contain shrink-0" />
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="text-[#293F55] dark:text-white font-bold text-xl tracking-tight">IPES</span>
                  <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded font-medium shrink-0">Member</span>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={activeMembership.organization_name}>
                  {activeMembership.organization_name}
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom Actions */}
            <div className="pt-4 mt-4 border-t border-border space-y-1">
              <a
                href="https://cit-u-computer-students-society.github.io/IPES/officer/getting-started/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                User Guide
              </a>
              <Link
                to="/select-organization"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-5 h-5 rotate-180" />
                Switch Organization
              </Link>
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <ProfileEditorDialog>
              <div className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                <Avatar className="!w-9 !h-9 shrink-0">
                  <AvatarImage src={user.display_picture || undefined} alt={`${fullName}'s profile picture`} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{activeMembership.unit_name} • {activeMembership.position_name}</p>
                </div>
              </div>
            </ProfileEditorDialog>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground mt-2" onClick={(e) => { e.preventDefault(); logout(); }}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Suspense fallback={<RouteLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default OfficerLayout;
