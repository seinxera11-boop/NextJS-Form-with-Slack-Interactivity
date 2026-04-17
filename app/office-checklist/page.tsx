"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ChecklistTask = {
  id: number;
  label: string;
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

export default function OfficeChecklist() {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");
  const [submittedReason, setSubmittedReason] = useState("");


  const sections = checklist
    ? [...checklist.checklist_sections].sort((a, b) => a.order_index - b.order_index)
    : [];

  const allTasks = sections.flatMap((s) =>
    [...s.checklist_items].sort((a, b) => a.order_index - b.order_index)
  );

  const completedCount = allTasks.filter((t) => checked[t.id]).length;
  const totalCount = allTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleCheckbox = (id: number) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSubmit = async () => {
    if (!submittedBy.trim()) {
      alert("送信前にお名前を入力してください。");
      return;
    }
    setSubmitting(true);
    try {
      const values: Record<number, string> = {};
      allTasks.forEach((t) => { values[t.id] = checked[t.id] ? "true" : "false"; });

      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: checklist?.id,
          submitted_by: submittedBy,
          reason: submittedReason,
          values,
          completedItems: completedCount,
          totalItems: totalCount,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const init: Record<number, boolean> = {};
      allTasks.forEach((t) => { init[t.id] = false; });
      setChecked(init);
      setSubmittedBy("");
      setSubmittedReason("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert("チェックリストを送信しました！");
    } catch (err: any) {
      alert("送信に失敗しました：" + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-base">チェックリストを読み込み中...</p>
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-red-500 text-base">エラー：{error || "チェックリストが見つかりません"}</p>
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
              進捗：{completedCount} / {totalCount} 項目完了
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
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={checked[item.id] ?? false}
                      onCheckedChange={() => handleCheckbox(item.id)}
                    />
                    <label className="text-base">{item.label}</label>
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
                お名前 <span className="text-red-400">*</span>
              </label>
              <Input
                className="text-base"
                value={submittedBy}
                onChange={(e: any) => setSubmittedBy(e.target.value)}
                placeholder="このチェックリストを送信する方のお名前"
              />
            </div>
            <div className="space-y-1">
              <label className="text-base font-medium">理由</label>
              <Textarea
                className="text-base"
                value={submittedReason}
                onChange={(e: any) => setSubmittedReason(e.target.value)}
                placeholder="このチェックリストを送信する理由を入力してください"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full text-base py-6" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "送信中..." : "チェックリストを送信"}
        </Button>
      </div>
    </div>
  );
}