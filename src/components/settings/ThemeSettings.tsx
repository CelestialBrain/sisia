import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useTheme } from '@/hooks/useTheme';
import { Sparkles, RotateCcw } from 'lucide-react';
import { useState } from 'react';

const COLOR_PRESETS = [
  { hue: 228, saturation: 74, lightness: 30 }, // Ateneo Blue
  { hue: 270, saturation: 70, lightness: 55 }, // Purple
  { hue: 330, saturation: 70, lightness: 60 }, // Pink
  { hue: 0, saturation: 70, lightness: 55 }, // Red
  { hue: 25, saturation: 85, lightness: 55 }, // Orange
  { hue: 45, saturation: 90, lightness: 55 }, // Yellow
  { hue: 142, saturation: 70, lightness: 50 }, // Green
  { hue: 174, saturation: 70, lightness: 45 }, // Teal
  { hue: 190, saturation: 70, lightness: 50 }, // Cyan
];

export default function ThemeSettings() {
  const { themeMode, hue, saturation, lightness, setTheme, resetTheme } = useTheme();
  const [customHue, setCustomHue] = useState(hue);
  const [customSat, setCustomSat] = useState(saturation);
  const [customLight, setCustomLight] = useState(lightness);

  const handlePresetClick = (preset: typeof COLOR_PRESETS[0]) => {
    setTheme('preset', preset.hue, preset.saturation, preset.lightness);
    setCustomHue(preset.hue);
    setCustomSat(preset.saturation);
    setCustomLight(preset.lightness);
  };

  const handleRGBToggle = () => {
    if (themeMode === 'rgb') {
      setTheme('preset', customHue, customSat, customLight);
    } else {
      setTheme('rgb', customHue, customSat, customLight);
    }
  };

  const handleCustomChange = () => {
    setTheme('custom', customHue, customSat, customLight);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Color Presets</CardTitle>
          <CardDescription>Choose from our curated color themes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {COLOR_PRESETS.map((preset, index) => (
              <button
                key={index}
                onClick={() => handlePresetClick(preset)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105"
                style={{
                  borderColor: themeMode === 'preset' && hue === preset.hue && saturation === preset.saturation && lightness === preset.lightness
                    ? `hsl(${preset.hue}, ${preset.saturation}%, ${preset.lightness}%)` 
                    : 'hsl(var(--border))',
                }}
              >
                <div
                  className="w-12 h-12 rounded-full"
                  style={{
                    backgroundColor: `hsl(${preset.hue}, ${preset.saturation}%, ${preset.lightness}%)`,
                  }}
                />
              </button>
            ))}
            
            {/* Custom Color Button */}
            <button
              onClick={handleCustomChange}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105"
              style={{
                borderColor: themeMode === 'custom' ? `hsl(${customHue}, ${customSat}%, ${customLight}%)` : 'hsl(var(--border))',
              }}
            >
              <div
                className="w-12 h-12 rounded-full"
                style={{
                  backgroundColor: `hsl(${customHue}, ${customSat}%, ${customLight}%)`,
                }}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            RGB Rainbow Mode
          </CardTitle>
          <CardDescription>Animate through the color spectrum</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRGBToggle}
            variant={themeMode === 'rgb' ? 'default' : 'outline'}
            className="w-full sm:w-auto"
          >
            {themeMode === 'rgb' ? 'Disable' : 'Enable'} RGB Animation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Color</CardTitle>
          <CardDescription>Fine-tune your perfect color</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hue</Label>
                <span className="text-sm text-muted-foreground">{customHue}°</span>
              </div>
              <Slider
                value={[customHue]}
                onValueChange={(v) => setCustomHue(v[0])}
                onValueCommit={handleCustomChange}
                max={360}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Saturation</Label>
                <span className="text-sm text-muted-foreground">{customSat}%</span>
              </div>
              <Slider
                value={[customSat]}
                onValueChange={(v) => setCustomSat(v[0])}
                onValueCommit={handleCustomChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lightness</Label>
                <span className="text-sm text-muted-foreground">{customLight}%</span>
              </div>
              <Slider
                value={[customLight]}
                onValueChange={(v) => setCustomLight(v[0])}
                onValueCommit={handleCustomChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-lg"
                style={{
                  backgroundColor: `hsl(${customHue}, ${customSat}%, ${customLight}%)`,
                }}
              />
              <div>
                <p className="font-medium">Preview</p>
                <p className="text-sm text-muted-foreground">
                  HSL({customHue}, {customSat}%, {customLight}%)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset Theme</CardTitle>
          <CardDescription>Return to the default Ateneo Blue theme</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={resetTheme} variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
