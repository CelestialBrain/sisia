import { Badge } from "@/components/ui/badge";

interface QPIBadgeProps {
  qpi: number;
}

export function QPIBadge({ qpi }: QPIBadgeProps) {
  const getQPIVariant = (qpi: number): "default" | "secondary" | "destructive" | "outline" => {
    if (qpi >= 3.5) return "default"; // Green/success color
    if (qpi >= 3.0) return "secondary"; // Blue/info color  
    if (qpi >= 2.5) return "outline"; // Warning color
    return "destructive"; // Red color
  };
  
  return (
    <Badge variant={getQPIVariant(qpi)} className="text-[10px] px-1 py-0">
      {qpi.toFixed(2)} QPI
    </Badge>
  );
}
