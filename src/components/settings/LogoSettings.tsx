import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useEffect, useState } from 'react';

export default function LogoSettings() {
  const [letterSpacing, setLetterSpacing] = useState<number>(() => {
    const saved = localStorage.getItem('logo-letter-spacing');
    return saved ? parseFloat(saved) : -0.05;
  });

  useEffect(() => {
    localStorage.setItem('logo-letter-spacing', letterSpacing.toString());
    document.documentElement.style.setProperty('--logo-spacing', `${letterSpacing}em`);
  }, [letterSpacing]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo Appearance</CardTitle>
        <CardDescription>
          Customize the spacing and appearance of the (a) logo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="letter-spacing">Letter Spacing</Label>
            <span className="text-sm text-muted-foreground font-mono">
              {letterSpacing.toFixed(3)}em
            </span>
          </div>
          <Slider
            id="letter-spacing"
            min={-0.2}
            max={0.2}
            step={0.001}
            value={[letterSpacing]}
            onValueChange={(value) => setLetterSpacing(value[0])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tighter</span>
            <span>Normal</span>
            <span>Looser</span>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-8 flex items-center justify-center">
          <span 
            className="text-4xl font-bold text-primary leading-none"
            style={{ letterSpacing: `${letterSpacing}em` }}
          >
            (a)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
