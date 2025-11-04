import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { RefreshProvider } from "./contexts/RefreshContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { AdminRoute } from "./components/admin/AdminRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Grades from "./pages/Grades";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ProgramTracker from "./pages/ProgramTracker";
import Chat from "./pages/Chat";
import ScheduleBuilder from "./pages/ScheduleBuilder";
import Logs from "./pages/Logs";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // No cache by default - always fetch fresh data
      gcTime: 30 * 60 * 1000, // 30 minutes in memory
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnReconnect: true,
      refetchOnMount: true, // Always refetch on mount for fresh data
      retry: 1, // Retry failed queries once
    },
  },
});

// Routes component - must be inside AuthProvider
function AppRoutes() {
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading, isGuest } = useAuth();
    
    if (loading) {
      return <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
    }
    
    return (user || isGuest) ? <Layout>{children}</Layout> : <Navigate to="/login" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
      <Route path="/tracker" element={<ProtectedRoute><ProgramTracker /></ProtectedRoute>} />
      <Route path="/planner" element={<ProtectedRoute><ScheduleBuilder /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <RefreshProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <ThemeProvider>
              <AppRoutes />
            </ThemeProvider>
          </AuthProvider>
        </TooltipProvider>
      </RefreshProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
