import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProgram } from "@/hooks/useActiveProgram";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useClientLogger } from "@/hooks/useClientLogger";
import { clientLogger } from "@/utils/clientLogger";
import { Button } from "./ui/button";
import {
  GraduationCap,
  BarChart3,
  Calendar,
  MessageCircle,
  User,
  LogOut,
  Settings,
  Wrench,
  Calculator,
  Coffee,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import paypalLogo from '@/assets/paypal-logo.png';
interface LayoutProps {
  children: ReactNode;
}
export function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, isGuest } = useAuth();
  const location = useLocation();
  const { activeEnrollment } = useActiveProgram();
  const logger = useClientLogger();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [backgroundStyle, setBackgroundStyle] = useState<React.CSSProperties>({});

  // Fetch profile data with React Query - always fresh
  const { data: profileData } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const [programCache, setProgramCache] = useState<{ name: string; code?: string } | null>(() => {
    try {
      const raw = localStorage.getItem("app_program");
      const parsed = raw ? JSON.parse(raw) : null;
      logger.debug('storage', 'Initial program cache loaded', { hasCache: !!parsed, programName: parsed?.name });
      return parsed;
    } catch (e) {
      logger.error('storage', 'Failed to load program cache', { error: e });
      return null;
    }
  });

  // Cache activeEnrollment data and persist to localStorage to avoid flicker
  useEffect(() => {
    if (activeEnrollment?.programs) {
      const programId = activeEnrollment.programs.id;
      const cached = { name: activeEnrollment.programs.name, code: activeEnrollment.programs.code };
      
      // Only update if program ID actually changed
      setProgramCache(prev => {
        if (prev?.code === cached.code) return prev;
        return cached;
      });
      
      try {
        localStorage.setItem("app_program", JSON.stringify(cached));
        logger.debug('storage', 'Updated program cache from activeEnrollment', { 
          programName: cached.name, 
          programCode: cached.code 
        });
      } catch (e) {
        logger.error('storage', 'Failed to save program cache', { error: e });
      }
    }
  }, [activeEnrollment?.programs?.id]);

  // Listen for program updates from ProgramSelection
  useEffect(() => {
    const handleProgramUpdate = () => {
      const cached = localStorage.getItem('app_program');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setProgramCache(parsed);
        } catch (e) {
          console.error('Failed to parse program cache:', e);
        }
      }
    };

    window.addEventListener('program-updated' as any, handleProgramUpdate);
    return () => {
      window.removeEventListener('program-updated' as any, handleProgramUpdate);
    };
  }, []);

  // Listen for background updates
  useEffect(() => {
    const applyBackground = () => {
      const type = localStorage.getItem('app-background-type');
      const color = localStorage.getItem('app-background-color');
      const image = localStorage.getItem('app-background-image');

      const style: React.CSSProperties = {};
      
      if (type === 'image' && image) {
        style.backgroundImage = `url(${image})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
        style.backgroundAttachment = 'fixed';
      } else if (type === 'color' && color) {
        style.backgroundColor = color;
      }

      setBackgroundStyle(style);
    };

    applyBackground();
    window.addEventListener('background-updated', applyBackground);
    return () => {
      window.removeEventListener('background-updated', applyBackground);
    };
  }, []);


  const visibleDisplayName = profileData?.display_name || null;
  const visibleProgram = activeEnrollment?.programs || programCache;

  const getProgramShortLabel = (program: any) => {
    if (!program) return null;
    const name = program.name || "";

    let degreeType = "";
    let programName = name;

    if (/bachelor of science in\s*/i.test(name)) {
      degreeType = "BS";
      programName = name.replace(/^bachelor of science in\s*/i, "").trim();
    } else if (/bachelor of arts in\s*/i.test(name)) {
      degreeType = "AB";
      programName = name.replace(/^bachelor of arts in\s*/i, "").trim();
    } else if (/bachelor of\s*/i.test(name)) {
      degreeType = "B";
      programName = name.replace(/^bachelor of\s*/i, "").trim();
    }

    if (!degreeType || !programName) return null;

    return `${degreeType} ${programName.toUpperCase()}`;
  };
  const programLabel = getProgramShortLabel(visibleProgram);
  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/grades", label: "Grades", icon: Calculator },
    { path: "/tracker", label: "Program Tracker", icon: GraduationCap },
    { path: "/planner", label: "Schedule Builder", icon: Calendar },
    { path: "/chat", label: "Community Chat", icon: MessageCircle },
    { path: "/profile", label: "Profile", icon: User },
    { path: "/settings", label: "Website Settings", icon: Wrench },
  ];
  if (isAdmin) {
    navItems.push({
      path: "/admin",
      label: "Admin",
      icon: Settings,
    });
  }
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-4 pb-4">
          <div className="flex h-16 shrink-0 items-start justify-between pt-4 pb-4 border-b border-border -mx-4 px-4">
            <Link to="/" className="flex items-center">
              <span
                className="text-2xl font-bold text-primary leading-none relative top-[2px]"
                style={{ letterSpacing: "var(--logo-spacing, -0.05em)" }}
              >
                sisia
              </span>
            </Link>
            <div className="flex flex-col gap-0 text-right max-w-[180px] mt-[5px]">
              {(isGuest || visibleDisplayName) && (
                <span className="text-[10px] uppercase text-muted-foreground leading-tight font-medium truncate">
                  {isGuest ? 'GUEST' : visibleDisplayName}
                </span>
              )}
              {programLabel && (
                <span className="text-[10px] uppercase text-muted-foreground leading-tight truncate">
                  {programLabel}
                </span>
              )}
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={cn(
                            "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors",
                            isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0 relative top-[2px]" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              <li className="mt-auto space-y-2">
                <button
                  className="w-full group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (isSigningOut) return;
                    setIsSigningOut(true);
                    try {
                      await signOut();
                    } catch (error) {
                      console.error('Sign out error:', error);
                    } finally {
                      setIsSigningOut(false);
                    }
                  }}
                  disabled={isSigningOut}
                >
                  <LogOut className="h-5 w-5 shrink-0 relative top-[2px]" />
                  {isSigningOut ? 'Signing out...' : (isGuest ? 'Exit Guest Mode' : 'Sign Out')}
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link to="/logs">
                      <FileText className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button className="flex-1 bg-[#FFC439] hover:bg-[#FFB028] text-black font-semibold gap-2" asChild>
                    <a href="https://ko-fi.com/angelonrevelo" target="_blank" rel="noopener noreferrer">
                      <img src={paypalLogo} alt="PayPal" className="h-6" loading="eager" fetchPriority="high" />
                    </a>
                  </Button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex h-16 items-center justify-between pl-4 pr-4">
        <Link to="/" className="flex items-center">
          <span
            className="text-2xl font-bold text-primary leading-none relative -top-[2px]"
            style={{ letterSpacing: "var(--logo-spacing, -0.05em)" }}
          >
            sisia
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className={cn(
              "flex items-center justify-center p-1 transition-colors min-h-[44px] min-w-[44px]",
              location.pathname === "/settings" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            title="Website Settings"
          >
            <Wrench className="h-6 w-6" />
          </Link>
          <Link
            to="/profile"
            className={cn(
              "flex items-center justify-center p-1 transition-colors min-h-[44px] min-w-[44px]",
              location.pathname === "/profile" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            title="Profile"
          >
            <User className="h-6 w-6" />
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center justify-center p-1 transition-colors min-h-[44px] min-w-[44px]",
                location.pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              title="Admin"
            >
              <Settings className="h-6 w-6" />
            </Link>
          )}
        </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-80 min-h-[100dvh]" style={backgroundStyle}>
        <div className="px-6 pt-20 pb-24 lg:pt-20 lg:pb-8">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center justify-center p-3 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-6 w-6" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
