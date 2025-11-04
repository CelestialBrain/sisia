import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { qpiToGWA, gwaToQPI } from "@/utils/qpiCalculations";
import { ArrowRightLeft } from "lucide-react";

export function GWAConverter() {
  const [qpi, setQpi] = useState("");
  const [gwa, setGwa] = useState("");

  const handleQPIChange = (value: string) => {
    setQpi(value);
    const qpiNum = parseFloat(value);
    if (!isNaN(qpiNum) && qpiNum >= 0 && qpiNum <= 4) {
      setGwa(qpiToGWA(qpiNum).toFixed(2));
    } else {
      setGwa("");
    }
  };

  const handleGWAChange = (value: string) => {
    setGwa(value);
    const gwaNum = parseFloat(value);
    if (!isNaN(gwaNum) && gwaNum >= 1 && gwaNum <= 5) {
      setQpi(gwaToQPI(gwaNum).toFixed(2));
    } else {
      setQpi("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>QPI/GWA Converter</CardTitle>
        <CardDescription>
          Convert between Quality Point Index (QPI) and General Weighted Average (GWA)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-[1fr,auto,1fr] items-end">
          <div className="space-y-3">
            <Label htmlFor="qpi">QPI (0.0 - 4.0)</Label>
            <Input
              id="qpi"
              type="number"
              step="0.01"
              min="0"
              max="4"
              value={qpi}
              onChange={(e) => handleQPIChange(e.target.value)}
              placeholder="3.50"
            />
            <p className="text-sm text-muted-foreground">Higher is better</p>
          </div>

          <div className="flex items-center justify-center pb-6">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            <Label htmlFor="gwa">GWA (1.0 - 5.0)</Label>
            <Input
              id="gwa"
              type="number"
              step="0.01"
              min="1"
              max="5"
              value={gwa}
              onChange={(e) => handleGWAChange(e.target.value)}
              placeholder="1.50"
            />
            <p className="text-sm text-muted-foreground">Lower is better</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Formula:</strong> GWA = 5.0 - QPI
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
