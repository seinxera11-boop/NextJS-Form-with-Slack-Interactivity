"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
// import { Input } from "@/components/ui/input";
import { Input } from "@/components/ui/input"; // Update this path to the actual location of your Input component

type ItemType = "checkbox" | "text" | "textarea";

type ChecklistItem = {
  id: number;
  label: string;
  type: ItemType;
  required: boolean;
  order_index: number;
};

type Checklist = {
  id: number;
  title: string;
  checklist_items: ChecklistItem[];
};

// Group items by sections of 5 for display (mirrors original UX)
function groupItems(items: ChecklistItem[]): { title: string; items: ChecklistItem[] }[] {
  // Use a single group with the checklist title if items are few
  // Or split into logical groups of ~5
  const groups: { title: string; items: ChecklistItem[] }[] = [];
  const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
  const chunkSize = 5;
  for (let i = 0; i < sorted.length; i += chunkSize) {
    groups.push({
      title: `Section ${Math.floor(i / chunkSize) + 1}`,
      items: sorted.slice(i, i + chunkSize),
    });
  }
  return groups;
}

// Default checklist ID — set to your first checklist or make dynamic
const DEFAULT_CHECKLIST_ID = process.env.NEXT_PUBLIC_PUBLIC_DEFAULT_CHECKLIST_ID || "1";

export default function OfficeChecklist() {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // values: item.id -> string (for text/textarea) or "true"/"false" (for checkbox)
  const [values, setValues] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");

  useEffect(() => {
    fetch(`/api/checklists/${DEFAULT_CHECKLIST_ID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setChecklist(data);
        // Init values
        const init: Record<number, string> = {};
        (data.checklist_items || []).forEach((item: ChecklistItem) => {
          init[item.id] = item.type === "checkbox" ? "false" : "";
        });
        setValues(init);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const items = checklist?.checklist_items || [];
  const checkboxItems = items.filter((i) => i.type === "checkbox");
  const completedCheckboxes = checkboxItems.filter((i) => values[i.id] === "true").length;
  const totalCheckboxes = checkboxItems.length;
  const progress = totalCheckboxes > 0 ? (completedCheckboxes / totalCheckboxes) * 100 : 0;

  const handleCheckbox = (id: number) => {
    setValues((prev) => ({ ...prev, [id]: prev[id] === "true" ? "false" : "true" }));
  };

  const handleText = (id: number, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async () => {
    // Validate required items
    const missing = items.filter((item) => {
      if (!item.required) return false;
      if (item.type === "checkbox") return false; // checkboxes don't need to be checked to submit
      return !values[item.id]?.trim();
    });
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    if (!submittedBy.trim()) {
      alert("Please enter your name before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: checklist?.id,
          submitted_by: submittedBy,
          values, // { [item_id]: value }
          completedItems: completedCheckboxes,
          totalItems: totalCheckboxes,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // Reset
      const init: Record<number, string> = {};
      items.forEach((item) => { init[item.id] = item.type === "checkbox" ? "false" : ""; });
      setValues(init);
      setSubmittedBy("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert("Checklist submitted successfully!");
    } catch (err: any) {
      alert("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading checklist...</p>
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-red-500 text-sm">Error: {error || "Checklist not found"}</p>
      </div>
    );
  }

  const groups = groupItems(items);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">{checklist.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm mb-2">
                Progress: {completedCheckboxes} / {totalCheckboxes} tasks checked
              </p>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>

        {groups.map((group, gi) => (
          <Card key={gi} className="shadow rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.items.map((item) => (
                <div key={item.id}>
                  {item.type === "checkbox" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={values[item.id] === "true"}
                        onCheckedChange={() => handleCheckbox(item.id)}
                      />
                      <label className="text-sm">{item.label}{item.required && <span className="text-red-400 ml-1">*</span>}</label>
                    </div>
                  )}
                  {item.type === "text" && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">{item.label}{item.required && <span className="text-red-400 ml-1">*</span>}</label>
                      <Input
                        value={values[item.id] || ""}
                        onChange={(e:any) => handleText(item.id, e.target.value)}
                        placeholder="Enter answer..."
                      />
                    </div>
                  )}
                  {item.type === "textarea" && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">{item.label}{item.required && <span className="text-red-400 ml-1">*</span>}</label>
                      <Textarea
                        value={values[item.id] || ""}
                        onChange={(e:any) => handleText(item.id, e.target.value)}
                        placeholder="Enter answer..."
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Submitted by field */}
        <Card className="shadow rounded-2xl">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">Your Name <span className="text-red-400">*</span></label>
              <Input
                value={submittedBy}
                onChange={(e:any) => setSubmittedBy(e.target.value)}
                placeholder="Who is submitting this checklist?"
              />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Checklist"}
        </Button>
      </div>
    </div>
  );
}