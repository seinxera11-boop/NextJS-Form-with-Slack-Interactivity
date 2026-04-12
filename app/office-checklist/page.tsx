"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type ItemType = "checkbox" | "text" | "textarea";

type ChecklistTask = {
  id: number;
  label: string;
  type: ItemType;
  required: boolean;
  order_index: number;
};

type ChecklistSection = {
  id: number;
  title: string;
  order_index: number;
  checklist_items: ChecklistTask[];
};

type Checklist = {
  id: number;
  title: string;
  checklist_sections: ChecklistSection[];
};

const DEFAULT_CHECKLIST_ID = process.env.NEXT_PUBLIC_PUBLIC_DEFAULT_CHECKLIST_ID;

export default function OfficeChecklist() {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");
  const [submittedReason, setSubmittedReason] = useState("");

  useEffect(() => {
    fetch(`/api/checklists/${DEFAULT_CHECKLIST_ID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setChecklist(data);
        const init: Record<number, string> = {};
        (data.checklist_sections || []).forEach((sec: ChecklistSection) => {
          (sec.checklist_items || []).forEach((item: ChecklistTask) => {
            init[item.id] = item.type === "checkbox" ? "false" : "";
          });
        });
        setValues(init);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];

  const allTasks = sections.flatMap((s) =>
    [...s.checklist_items].sort((a, b) => a.order_index - b.order_index)
  );
  const checkboxTasks = allTasks.filter((t) => t.type === "checkbox");
  const completedCheckboxes = checkboxTasks.filter((t) => values[t.id] === "true").length;
  const totalCheckboxes = checkboxTasks.length;
  const progress = totalCheckboxes > 0 ? (completedCheckboxes / totalCheckboxes) * 100 : 0;

  const handleCheckbox = (id: number) =>
    setValues((prev) => ({ ...prev, [id]: prev[id] === "true" ? "false" : "true" }));

  const handleText = (id: number, val: string) =>
    setValues((prev) => ({ ...prev, [id]: val }));

  const handleSubmit = async () => {
    const missing = allTasks.filter(
      (item) => item.required && item.type !== "checkbox" && !values[item.id]?.trim()
    );
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
          reason: submittedReason,
          values,
          completedItems: completedCheckboxes,
          totalItems: totalCheckboxes,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const init: Record<number, string> = {};
      allTasks.forEach((item) => {
        init[item.id] = item.type === "checkbox" ? "false" : "";
      });
      setValues(init);
      setSubmittedBy("");
      setSubmittedReason("");
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
        <p className="text-gray-500 text-base">Loading checklist...</p>
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-red-500 text-base">Error: {error || "Checklist not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header card */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-3xl">{checklist.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base mb-2">
              Progress: {completedCheckboxes} / {totalCheckboxes} tasks checked
            </p>
            <Progress value={progress} />
          </CardContent>
        </Card>

        {/* One card per section */}
        {sections.map((sec) => {
          const tasks = [...sec.checklist_items].sort((a, b) => a.order_index - b.order_index);
          return (
            <Card key={sec.id} className="shadow rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl">{sec.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.map((item) => (
                  <div key={item.id}>
                    {item.type === "checkbox" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={values[item.id] === "true"}
                          onCheckedChange={() => handleCheckbox(item.id)}
                        />
                        <label className="text-base">
                          {item.label}
                          {item.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                      </div>
                    )}
                    {item.type === "text" && (
                      <div className="space-y-1">
                        <label className="text-base font-medium">
                          {item.label}
                          {item.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <Input
                          className="text-base"
                          value={values[item.id] || ""}
                          onChange={(e: any) => handleText(item.id, e.target.value)}
                          placeholder="Enter answer..."
                        />
                      </div>
                    )}
                    {item.type === "textarea" && (
                      <div className="space-y-1">
                        <label className="text-base font-medium">
                          {item.label}
                          {item.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <Textarea
                          className="text-base"
                          value={values[item.id] || ""}
                          onChange={(e: any) => handleText(item.id, e.target.value)}
                          placeholder="Enter answer..."
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Submitter info */}
        <Card className="shadow rounded-2xl">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <label className="text-base font-medium">
                Your Name <span className="text-red-400">*</span>
              </label>
              <Input
                className="text-base"
                value={submittedBy}
                onChange={(e: any) => setSubmittedBy(e.target.value)}
                placeholder="Who is submitting this checklist?"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-medium">Reason</label>
              <Textarea
                className="text-base"
                value={submittedReason}
                onChange={(e: any) => setSubmittedReason(e.target.value)}
                placeholder="Why are you submitting this checklist?"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full text-base py-6" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Checklist"}
        </Button>
      </div>
    </div>
  );
}