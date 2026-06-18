export type ItemType = "checkbox";

export type ChecklistTask = {
  id?: number;
  label: string;
  order_index: number;
};

export type ChecklistSection = {
  id?: number;
  title: string;
  order_index: number;
  tasks: ChecklistTask[];
  checklist_items?: ChecklistTask[];
};

export type Checklist = {
  id: number;
  title: string;
  created_by: string;
  created_at: string;
  is_large_checklist?: boolean;
  department_id?: number | null;
  checklist_sections?: ChecklistSection[];
  checklist_departments?: { department_id: number }[];
};

export type ResponseItem = {
  id: number;
  checklist_item_id: number;
  value: string;
  checklist_items?: { label: string; type: string };
};

export type ResponseApproval = {
  id: number;
  reason: string;
  approved_by: string;
  approved_at: string;
};

export type Response = {
  id: number;
  checklist_id: number;
  submitted_by: string;
  reason: string | null;
  created_at: string;
  other_user_name: string | null;
  department_name?: string | null;
  checklists?: { title: string };
  departments?: { name: string };
  org_users?: { name: string };
  response_items?: ResponseItem[];
  response_approvals?: ResponseApproval[];
};

export type Department = {
  id: number;
  name: string;
  created_at: string;
  department_slack_configs: DepartmentSlackConfigs | null;
};

export type OrgUser = {
  id: number;
  name: string;
  department_id: number;
  departments?: { name: string };
  created_at: string;
};

export const TYPE_LABELS: Record<ItemType, string> = {
  checkbox: "Checkbox",
};

export const TYPE_COLOR: Record<ItemType, string> = {
  checkbox: "#16a34a",
};

export type DepartmentSlackConfigs = {
  bot_token:    string | null;
  approval_url: string | null;
  security_url: string | null;
  reminder_url: string | null;
}
