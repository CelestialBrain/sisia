import { Users } from "lucide-react";

interface OnlineUsersIndicatorProps {
  count: number;
}

export function OnlineUsersIndicator({ count }: OnlineUsersIndicatorProps) {
  return (
    <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-center gap-2 text-sm">
      <Users className="h-4 w-4 text-green-500" />
      <span className="text-muted-foreground">
        {count} {count === 1 ? 'user' : 'users'} online
      </span>
    </div>
  );
}
