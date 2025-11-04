import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { guestStorage } from '@/utils/guestStorage';
import { clientLogger } from '@/utils/clientLogger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isGuest: boolean;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    // Check for guest mode but don't early-return
    const guestMode = sessionStorage.getItem('guest_mode');
    if (guestMode === 'true') {
      setIsGuest(true);
      clientLogger.info('auth', 'Guest mode detected on mount', {}, 'guest');
    }

    // Always subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Real user session exists, clear guest mode
        sessionStorage.removeItem('guest_mode');
        setIsGuest(false);
        setUser(session.user);
        checkAdminRole(session.user.id);
        clientLogger.info('auth', 'User session restored', { userId: session.user.id }, 'authenticated', session.user.id);
      } else {
        setUser(null);
        clientLogger.debug('auth', 'No user session found', {}, 'unknown');
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Real user logged in, force clear guest mode
        sessionStorage.removeItem('guest_mode');
        setIsGuest(false);
        setUser(session.user);
        checkAdminRole(session.user.id);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    // Clear guest data on browser close/tab close
    const handleBeforeUnload = () => {
      if (isGuest) {
        guestStorage.clearAll();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isGuest]);

  const checkAdminRole = async (userId: string) => {
    const { data, error } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (!error && data) {
      setIsAdmin(true);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    // Clear guest mode when signing up
    sessionStorage.removeItem('guest_mode');
    setIsGuest(false);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    // Clear guest mode when signing in
    sessionStorage.removeItem('guest_mode');
    setIsGuest(false);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      clientLogger.info('auth', 'Attempting to sign out', { userId: user?.id }, user ? 'authenticated' : 'unknown', user?.id);
      const { error } = await supabase.auth.signOut();
      if (error) {
        clientLogger.error('auth', 'Sign out failed', { error: error.message }, user ? 'authenticated' : 'unknown', user?.id);
        throw error;
      }
      clientLogger.info('auth', 'Sign out successful', {}, 'unknown');
      navigate('/login');
    } catch (error) {
      clientLogger.error('auth', 'Sign out exception', { error }, user ? 'authenticated' : 'unknown', user?.id);
      // Still navigate to login even if there's an error
      navigate('/login');
    }
  };

  const continueAsGuest = () => {
    clientLogger.info('auth', 'Entering guest mode', {}, 'guest');
    // Clear all existing data first for fresh guest state
    guestStorage.clearAll();
    localStorage.removeItem('app_program');
    localStorage.removeItem('schedule_search_presets');
    localStorage.removeItem('theme-preferences');
    localStorage.removeItem('logo-letter-spacing');
    queryClient.clear();
    
    // Now set guest mode
    sessionStorage.setItem('guest_mode', 'true');
    setIsGuest(true);
    setLoading(false);
    clientLogger.info('auth', 'Guest mode activated successfully', {}, 'guest');
  };

  // Override signOut for guest mode
  const handleSignOut = async () => {
    if (isGuest) {
      clientLogger.info('auth', 'Guest sign out initiated', {}, 'guest');
      
      // Clear all guest data and localStorage
      guestStorage.clearAll();
      
      // Clear all localStorage items that might persist guest data
      localStorage.removeItem('app_program');
      localStorage.removeItem('schedule_search_presets');
      localStorage.removeItem('theme-preferences');
      localStorage.removeItem('logo-letter-spacing');
      
      // Clear all sessionStorage (including logs)
      sessionStorage.clear();
      
      // Clear React Query cache
      queryClient.clear();
      
      // Clear the logger's in-memory logs as well
      clientLogger.clearLogs();
      
      setIsGuest(false);
      setUser(null);
      navigate('/login');
    } else {
      clientLogger.info('auth', 'User sign out initiated', { userId: user?.id }, 'authenticated', user?.id);
      // For authenticated users, also clear logs on sign out
      clientLogger.clearLogs();
      await signOut();
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut: handleSignOut,
    isAdmin,
    isGuest,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
