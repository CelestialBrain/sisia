import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface ChatInputProps {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload: (file: File) => Promise<void>;
  onVoiceUpload: (blob: Blob) => Promise<void>;
  onTyping: () => void;
}

export function ChatInput({ 
  disabled, 
  value, 
  onChange, 
  onSend, 
  onFileUpload,
  onVoiceUpload,
  onTyping 
}: ChatInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File too large (max 5MB)');
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not allowed. Only images, PDFs, and text files are supported.');
      return;
    }

    // Store file and show preview
    setPendingFile(file);
    
    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSendFile = async () => {
    if (!pendingFile) return;

    setIsUploading(true);
    try {
      await onFileUpload(pendingFile);
      handleCancelFile();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  };

  const handleSendClick = () => {
    if (value.trim()) {
      onSend();
    }
  };

  if (disabled) {
    return (
      <div className="border-t p-4 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in to join the conversation
        </p>
        <Button asChild size="sm">
          <Link to="/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t py-3 px-4 bg-background mt-auto sticky bottom-0 z-10">
      {pendingFile && (
        <div className="mb-3 p-3 bg-card border rounded-lg max-w-sm">
          <div className="flex items-start gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pendingFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(pendingFile.size / 1024).toFixed(1)} KB
              </p>
              
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  onClick={handleSendFile}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleCancelFile}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
            
            <Button 
              size="icon" 
              variant="ghost"
              onClick={handleCancelFile}
              disabled={isUploading}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex items-end gap-3">
        <Button 
          size="icon" 
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !!pendingFile}
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        <input 
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 min-h-[40px] max-h-32 resize-none pb-0"
          rows={1}
          disabled={!!pendingFile}
        />
        
        <VoiceRecorder onSend={onVoiceUpload} />
        
        <Button 
          size="icon" 
          onClick={handleSendClick} 
          disabled={!value.trim() || isUploading || !!pendingFile}
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
