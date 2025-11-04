import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRADE_OPTIONS, getQPIValue, calculateQPI } from "@/utils/qpiCalculations";
import { Plus, Trash2 } from "lucide-react";

interface WhatIfCourse {
  id: string;
  units: number;
  grade: string;
}

export function WhatIfCalculator() {
  const [currentQPI, setCurrentQPI] = useState("");
  const [currentUnits, setCurrentUnits] = useState("");
  const [courses, setCourses] = useState<WhatIfCourse[]>([
    { id: "1", units: 3, grade: "A" },
  ]);
  const [result, setResult] = useState<{ semesterQPI: number; newCumulativeQPI: number } | null>(null);

  const addCourse = () => {
    setCourses([...courses, { id: Date.now().toString(), units: 3, grade: "A" }]);
  };

  const removeCourse = (id: string) => {
    setCourses(courses.filter((c) => c.id !== id));
  };

  const updateCourse = (id: string, field: "units" | "grade", value: any) => {
    setCourses(
      courses.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const calculate = () => {
    const currentQPINum = parseFloat(currentQPI);
    const currentUnitsNum = parseFloat(currentUnits);

    if (isNaN(currentQPINum) || isNaN(currentUnitsNum) || currentUnitsNum < 0) {
      return;
    }

    // Calculate semester QPI
    let semesterQualityPoints = 0;
    let semesterUnits = 0;

    courses.forEach((course) => {
      const qpiValue = getQPIValue(course.grade);
      if (qpiValue !== null) {
        semesterQualityPoints += course.units * qpiValue;
        semesterUnits += course.units;
      }
    });

    const semesterQPI = semesterUnits > 0 ? semesterQualityPoints / semesterUnits : 0;

    // Calculate new cumulative QPI
    const currentQualityPoints = currentQPINum * currentUnitsNum;
    const totalQualityPoints = currentQualityPoints + semesterQualityPoints;
    const totalUnits = currentUnitsNum + semesterUnits;
    const newCumulativeQPI = totalUnits > 0 ? totalQualityPoints / totalUnits : 0;

    setResult({ semesterQPI, newCumulativeQPI });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>What-If Calculator</CardTitle>
        <CardDescription>
          Plan your grades and see how they affect your QPI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current-qpi">Current Cumulative QPI</Label>
            <Input
              id="current-qpi"
              type="number"
              step="0.01"
              min="0"
              max="4"
              value={currentQPI}
              onChange={(e) => setCurrentQPI(e.target.value)}
              placeholder="3.50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-units">Current Total Units</Label>
            <Input
              id="current-units"
              type="number"
              step="1"
              min="0"
              value={currentUnits}
              onChange={(e) => setCurrentUnits(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>

            <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Planned Courses</Label>
            <Button onClick={addCourse} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Course
            </Button>
          </div>

          {courses.map((course) => (
            <div key={course.id} className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>Units</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={course.units}
                  onChange={(e) =>
                    updateCourse(course.id, "units", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Expected Grade</Label>
                <Select
                  value={course.grade}
                  onValueChange={(value) => updateCourse(course.id, "grade", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => removeCourse(course.id)}
                size="icon"
                variant="ghost"
                disabled={courses.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={calculate} className="w-full">
          Calculate
        </Button>

        {result && (
          <div className="grid gap-3 md:grid-cols-2 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Semester QPI</p>
              <p className="text-3xl font-bold">{result.semesterQPI.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">New Cumulative QPI</p>
              <p className="text-3xl font-bold">{result.newCumulativeQPI.toFixed(2)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
