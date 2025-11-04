import { createContext, useContext, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import Dexie from 'dexie';

interface RefreshContextType {
  refreshData: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refreshData = async () => {
    try {
      // Clear IndexedDB persistent cache
      try {
        const db = new Dexie('QueryCache');
        await db.delete();
        console.log('IndexedDB cache cleared');
      } catch (dbError) {
        console.warn('Failed to clear IndexedDB cache:', dbError);
      }
      
      // Invalidate only user-specific and data queries (not UI state)
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          const userDataKeys = [
            'user-courses',
            'leaderboard',
            'user-schedules',
            'profiles',
            'profile',
            'curriculum-courses',
            'requirement-groups',
            'requirement-rules',
            'program-enrollments',
            'admin-stats'
          ];
          return typeof key === 'string' && userDataKeys.includes(key);
        }
      });
      
      toast({
        title: "Data refreshed",
        description: "User data refreshed from server",
      });
    } catch (error) {
      console.error('Refresh error:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <RefreshContext.Provider value={{ refreshData }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within RefreshProvider');
  }
  return context;
}
