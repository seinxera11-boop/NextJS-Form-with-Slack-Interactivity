"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Section = {
  title: string;
  items: string[];
};

const checklist: Section[] = [
  {
    title: "Lights & Electrical",
    items: [
      "Bathroom lights off",
      "Room 1 lights off",
      "Office main lights off",
      "All switches turned off",
      "AC/Fans turned off",
    ],
  },
  {
    title: "Equipment Safety",
    items: [
      "Laptop shut down",
      "Laptop stored in drawer",
      "Chargers unplugged",
      "Monitors turned off",
      "Printer/Scanner turned off",
    ],
  },
  {
    title: "Windows & Ventilation",
    items: [
      "All windows closed",
      "Curtains/blinds adjusted",
      "Balcony doors locked",
    ],
  },
  {
    title: "Bathroom Check",
    items: [
      "Tap water turned off",
      "No leakage present",
      "Lights turned off",
      "Exhaust fan off",
    ],
  },
  {
    title: "Security",
    items: [
      "Main door locked",
      "Internal doors closed",
      "Drawer/locker locked",
      "Keys stored properly",
    ],
  },
];

export default function OfficeChecklist() {
  // Initialize all tasks as unchecked
  const initialChecked: Record<string, boolean> = {};
  checklist.forEach((section) => {
    section.items.forEach((item) => {
      initialChecked[item] = false;
    });
  });

  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);

  const handleChange = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const totalItems = Object.keys(checked).length;
  const completedItems = Object.values(checked).filter(Boolean).length;
  const progress = (completedItems / totalItems) * 100;

  const handleSubmit = async () => {
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: checked, // includes all items (true/false)
          completedItems,
          totalItems,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setChecked(initialChecked);
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert("Checklist saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save checklist");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Office Closing Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm mb-2">
                Progress: {completedItems} / {totalItems}
              </p>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        {checklist.map((section) => (
          <Card key={section.title} className="shadow rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox
                    checked={checked[item]}
                    onCheckedChange={() => handleChange(item)}
                  />
                  <label className="text-sm">{item}</label>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Button className="w-full" onClick={handleSubmit}>
          Submit Checklist
        </Button>
      </div>
    </div>
  );
}