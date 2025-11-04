import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface Component {
  id: string;
  name: string;
  weight: number;
  score: number;
}

export function GradeCalculator() {
  const [components, setComponents] = useState<Component[]>([
    { id: "1", name: "Midterm", weight: 30, score: 0 },
    { id: "2", name: "Finals", weight: 40, score: 0 },
    { id: "3", name: "Quizzes", weight: 30, score: 0 },
  ]);
  const [targetGrade, setTargetGrade] = useState("");
  const [result, setResult] = useState<number | null>(null);

  const addComponent = () => {
    setComponents([
      ...components,
      { id: Date.now().toString(), name: "Component", weight: 10, score: 0 },
    ]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter((c) => c.id !== id));
  };

  const updateComponent = (
    id: string,
    field: "name" | "weight" | "score",
    value: any
  ) => {
    setComponents(
      components.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const calculateCurrentGrade = () => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    components.forEach((comp) => {
      totalWeightedScore += (comp.score / 100) * comp.weight;
      totalWeight += comp.weight;
    });

    return totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
  };

  const calculateNeededScore = () => {
    const target = parseFloat(targetGrade);
    if (isNaN(target)) return;

    const currentGrade = calculateCurrentGrade();
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    
    if (totalWeight >= 100) {
      setResult(null);
      return;
    }

    const remainingWeight = 100 - totalWeight;
    const currentWeighted = (currentGrade / 100) * totalWeight;
    const targetWeighted = target;
    const neededWeighted = targetWeighted - currentWeighted;
    const neededScore = (neededWeighted / remainingWeight) * 100;

    setResult(Math.min(100, Math.max(0, neededScore)));
  };

  const currentGrade = calculateCurrentGrade();
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade Calculator</CardTitle>
        <CardDescription>
          Calculate what score you need on remaining requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
            <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Course Components</Label>
            <Button onClick={addComponent} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </div>

          {components.map((comp) => (
            <div key={comp.id} className="flex gap-3 items-end">
              <div className="flex-1 space-y-3">
                <Label>Name</Label>
                <Input
                  value={comp.name}
                  onChange={(e) => updateComponent(comp.id, "name", e.target.value)}
                />
              </div>
              <div className="w-24 space-y-3">
                <Label>Weight %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={comp.weight}
                  onChange={(e) =>
                    updateComponent(comp.id, "weight", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="w-24 space-y-3">
                <Label>Score %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={comp.score}
                  onChange={(e) =>
                    updateComponent(comp.id, "score", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <Button
                onClick={() => removeComponent(comp.id)}
                size="icon"
                variant="ghost"
                disabled={components.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="text-sm text-muted-foreground">
            Total weight: {totalWeight}%
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="target">Target Final Grade (%)</Label>
          <Input
            id="target"
            type="number"
            min="0"
            max="100"
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            placeholder="85"
          />
        </div>

        <Button onClick={calculateNeededScore} className="w-full">
          Calculate Required Score
        </Button>

        <div className="grid gap-3 md:grid-cols-2 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Current Grade</p>
            <p className="text-3xl font-bold">{currentGrade.toFixed(1)}%</p>
          </div>
          {result !== null && (
            <div>
              <p className="text-sm text-muted-foreground">Needed on Remaining</p>
              <p className="text-3xl font-bold">
                {result.toFixed(1)}%
              </p>
              {result > 100 && (
                <p className="text-sm text-destructive mt-1">
                  Target may not be achievable
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
