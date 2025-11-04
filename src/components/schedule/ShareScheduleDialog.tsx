import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { encodeScheduleShare } from '@/utils/scheduleCodeGenerator';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { guestStorage } from '@/utils/guestStorage';

interface ShareScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  scheduleName: string;
}

export function ShareScheduleDialog({ open, onOpenChange, scheduleId, scheduleName }: ShareScheduleDialogProps) {
  const { isGuest } = useAuth();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset share code when dialog opens to force regeneration
  useEffect(() => {
    if (open) {
      setShareCode(null);
      setCopied(false);
    }
  }, [open]);

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      let payload;
      
      if (isGuest) {
        // For guests, fetch from guestStorage
        const schedules = guestStorage.getSchedules();
        const schedule = schedules.find(s => s.id === scheduleId);
        
        if (!schedule) {
          throw new Error('Schedule not found in guest storage');
        }
        
        const allPaletteItems = guestStorage.getPaletteItems();
        const paletteItems = allPaletteItems.filter((item: any) => item.schedule_id === scheduleId);
        
        const allBlocks = guestStorage.getScheduleBlocks();
        const blocks = allBlocks.filter((block: any) => block.schedule_id === scheduleId);
        
        payload = {
          v: 2 as const,
          name: scheduleName,
          term: schedule.term_code,
          palette: paletteItems.map(item => ({
            course_code: item.course_code,
            course_title: item.course_title,
            section: item.section || undefined,
            required_count: item.required_count,
            is_manual: item.is_manual,
            color: item.color,
          })),
          blocks: blocks.map(block => ({
            course_code: block.course_code,
            course_title: block.course_title || undefined,
            section: block.section || undefined,
            room: block.room,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            color: block.color,
            font_color: block.font_color || '#000000',
            font_size: block.font_size || 'text-xs',
          })),
        };
      } else {
        // For authenticated users, fetch from Supabase
        const [paletteRes, blocksRes, scheduleRes] = await Promise.all([
          supabase.from('schedule_palette_items').select('*').eq('schedule_id', scheduleId),
          supabase.from('schedule_blocks').select('*').eq('schedule_id', scheduleId),
          supabase.from('user_schedules').select('*').eq('id', scheduleId).single(),
        ]);

        if (paletteRes.error || blocksRes.error || scheduleRes.error) {
          throw new Error('Failed to fetch schedule data');
        }

        // Build offline share payload
        payload = {
          v: 2 as const,
          name: scheduleName,
          term: scheduleRes.data.term_code,
          palette: paletteRes.data.map(item => ({
            course_code: item.course_code,
            course_title: item.course_title,
            section: item.section,
            required_count: item.required_count,
            is_manual: item.is_manual,
            color: item.color,
          })),
          blocks: blocksRes.data.map(block => ({
            course_code: block.course_code,
            course_title: block.course_title,
            section: block.section,
            room: block.room,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            color: block.color,
            font_color: block.font_color || '#000000',
            font_size: block.font_size || 'text-xs',
          })),
        };
      }

      const code = encodeScheduleShare(payload);
      setShareCode(code);
      
      toast({
        title: 'Share code generated',
        description: 'Your schedule is ready to share!',
      });
    } catch (error) {
      console.error('Error generating share code:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate share code',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCode = () => {
    if (shareCode) {
      navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Share code copied to clipboard',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Schedule</DialogTitle>
          <DialogDescription>
            Generate an offline share code for "{scheduleName}"
          </DialogDescription>
        </DialogHeader>

        {!shareCode ? (
          <div className="py-6 text-center">
            <Button onClick={generateCode} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Share Code'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Share Code</Label>
              <div className="space-y-2">
                <Textarea
                  value={shareCode}
                  readOnly
                  className="font-mono text-xs resize-none"
                  rows={6}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={copyCode}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground space-y-1">
              <p>✓ No expiration - share anytime</p>
              <p>✓ Works offline - no backend storage</p>
              <p>✓ Anyone with this code can import your schedule</p>
              <p>✓ They'll get all courses and time blocks</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
