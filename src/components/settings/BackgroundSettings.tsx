import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Image, Palette, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function BackgroundSettings() {
  const [backgroundType, setBackgroundType] = useState<'color' | 'image'>('color');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    const storedType = localStorage.getItem('app-background-type') as 'color' | 'image' | null;
    const storedColor = localStorage.getItem('app-background-color');
    const storedImage = localStorage.getItem('app-background-image');

    if (storedType) setBackgroundType(storedType);
    if (storedColor) setBackgroundColor(storedColor);
    if (storedImage) setBackgroundImage(storedImage);
  }, []);

  const applyBackground = () => {
    localStorage.setItem('app-background-type', backgroundType);
    localStorage.setItem('app-background-color', backgroundColor);
    if (backgroundImage) {
      localStorage.setItem('app-background-image', backgroundImage);
    }
    window.dispatchEvent(new Event('background-updated'));
  };

  useEffect(() => {
    applyBackground();
  }, [backgroundType, backgroundColor, backgroundImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setBackgroundImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearBackground = () => {
    setBackgroundType('color');
    setBackgroundColor('#ffffff');
    setBackgroundImage(null);
    localStorage.removeItem('app-background-type');
    localStorage.removeItem('app-background-color');
    localStorage.removeItem('app-background-image');
    window.dispatchEvent(new Event('background-updated'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Background Appearance
        </CardTitle>
        <CardDescription>
          Customize the background of your workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button
            variant={backgroundType === 'color' ? 'default' : 'outline'}
            onClick={() => setBackgroundType('color')}
            className="flex-1"
          >
            <Palette className="h-4 w-4 mr-2" />
            Color
          </Button>
          <Button
            variant={backgroundType === 'image' ? 'default' : 'outline'}
            onClick={() => setBackgroundType('image')}
            className="flex-1"
          >
            <Image className="h-4 w-4 mr-2" />
            Image
          </Button>
        </div>

        {backgroundType === 'color' && (
          <div className="space-y-2">
            <Label htmlFor="bg-color">Background Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="bg-color"
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                type="text"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1"
                placeholder="#ffffff"
              />
            </div>
          </div>
        )}

        {backgroundType === 'image' && (
          <div className="space-y-2">
            <Label htmlFor="bg-image">Background Image</Label>
            <Input
              id="bg-image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="cursor-pointer"
            />
            {backgroundImage && (
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={backgroundImage}
                  alt="Background preview"
                  className="w-full h-32 object-cover"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => setBackgroundImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <Button variant="outline" onClick={clearBackground} className="w-full">
          Reset to Default
        </Button>
      </CardContent>
    </Card>
  );
}
