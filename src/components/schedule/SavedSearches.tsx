import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface SavedSearch {
  id: string;
  name: string;
  filters: {
    instructorQuery?: string;
    roomQuery?: string;
    courseCodeQuery?: string;
    selectedDays?: number[];
    startTimeAfter?: string;
    endTimeBefore?: string;
    excludeConflicting?: boolean;
  };
  createdAt: string;
}

interface SavedSearchesProps {
  currentFilters: SavedSearch['filters'];
  onLoadSearch: (filters: SavedSearch['filters']) => void;
}

const STORAGE_KEY = 'schedule_search_presets';

export function SavedSearches({ currentFilters, onLoadSearch }: SavedSearchesProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [selectedSearchId, setSelectedSearchId] = useState<string>('');

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const saveCurrentSearch = () => {
    if (!searchName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this search preset.',
        variant: 'destructive',
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: searchName.trim(),
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    toast({
      title: 'Search saved',
      description: `"${searchName}" has been saved to your presets.`,
    });

    setShowSaveDialog(false);
    setSearchName('');
  };

  const deleteSearch = (id: string) => {
    const search = savedSearches.find(s => s.id === id);
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    toast({
      title: 'Search deleted',
      description: `"${search?.name}" has been removed from your presets.`,
    });

    if (selectedSearchId === id) {
      setSelectedSearchId('');
    }
  };

  const loadSearch = (id: string) => {
    const search = savedSearches.find(s => s.id === id);
    if (search) {
      onLoadSearch(search.filters);
      setSelectedSearchId(id);
      toast({
        title: 'Search loaded',
        description: `Applied filters from "${search.name}".`,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => setShowSaveDialog(true)}
        disabled={Object.values(currentFilters).every(v => !v || (Array.isArray(v) && v.length === 0))}
      >
        <Save className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Save Search</span>
        <span className="sm:hidden">Save</span>
      </Button>

      {savedSearches.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedSearchId} onValueChange={loadSearch}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Load saved search..." />
            </SelectTrigger>
            <SelectContent>
              {savedSearches.map(search => (
                <SelectItem key={search.id} value={search.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{search.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSearchId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteSearch(selectedSearchId)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search Preset</DialogTitle>
            <DialogDescription>
              Give this search a name so you can quickly apply these filters later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="search-name">Preset Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., MWF Mornings"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentSearch()}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentSearch}>
              <Save className="h-4 w-4 mr-2" />
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
