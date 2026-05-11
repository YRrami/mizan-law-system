
"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import LoadingCard from "@/components/ui/LoadingCard";
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveText from "@/components/ui/ResponsiveText";
import SelectField from "@/components/ui/SelectField";
import TextareaField from "@/components/ui/TextareaField";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { supabase } from "@/lib/supabase";
import { formatDate, taskPriorityLabels, taskStatusLabels } from "@/lib/labels";
import type { TaskPriority, TaskStatus } from "@/lib/types";

type ProfileLite = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "user";
};

type ClientLite = {
  id: string;
  name: string;
  phone: string | null;
};

type CaseLite = {
  id: string;
  client_id: string | null;
  title: string;
  case_number: string | null;
  case_year: string | null;
  clients?: ClientLite | null;
};

type TaskRow = {
  id: string;
  user_id: string;
  assigned_by: string;
  assigned_to: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  client_id: string | null;
  case_id: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: ClientLite | null;
  cases?: CaseLite | null;
};

type TaskFormState = {
  assigned_to: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  client_id: string;
  case_id: string;
  completion_notes: string;
};

const emptyTaskForm: TaskFormState = {
  assigned_to: "",
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  due_date: "",
  client_id: "",
  case_id: "",
  completion_notes: "",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function taskStatusTone(status: TaskStatus): "blue" | "amber" | "teal" | "rose" | "zinc" {
  const tones: Record<TaskStatus, "blue" | "amber" | "teal" | "rose" | "zinc"> = {
    todo: "blue",
    in_progress: "amber",
    done: "teal",
    cancelled: "zinc",
  };

  return tones[status];
}

function taskPriorityTone(priority: TaskPriority): "zinc" | "blue" | "amber" | "rose" {
  const tones: Record<TaskPriority, "zinc" | "blue" | "amber" | "rose"> = {
    low: "zinc",
    medium: "blue",
    high: "amber",
    urgent: "rose",
  };

  return tones[priority];
}

function dueLabel(task: Pick<TaskRow, "due_date" | "status">): { label: string; tone: "teal" | "amber" | "rose" | "zinc" } {
  if (task.status === "done") return { label: "تمت", tone: "teal" };
  if (task.status === "cancelled") return { label: "ملغاة", tone: "zinc" };
  if (!task.due_date) return { label: "بدون موعد", tone: "zinc" };
  if (task.due_date < todayISO()) return { label: "متأخرة", tone: "rose" };
  if (task.due_date === todayISO()) return { label: "اليوم", tone: "amber" };
  return { label: "قادمة", tone: "teal" };
}

function prettyCaseLabel(item: CaseLite): string {
  const numberPart = item.case_number ? ` — رقم ${item.case_number}` : "";
  const yearPart = item.case_year ? `/${item.case_year}` : "";
  const clientPart = item.clients?.name ? ` — ${item.clients.name}` : "";
  return `${item.title}${numberPart}${yearPart}${clientPart}`;
}

function profileLabel(profile?: ProfileLite | null): string {
  if (!profile) return "غير محدد";
  return profile.full_name || profile.email || profile.user_id;
}

export default function TasksPage() {
  const router = useRouter();
  const { isAdmin, loadingRole, profile } = useCurrentRole();

  const [userId, setUserId] = useState("");
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [form, setForm] = useState<TaskFormState>(emptyTaskForm);
  const [editForm, setEditForm] = useState<TaskFormState>(emptyTaskForm);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "overdue" | "upcoming" | "no_due">("all");
  const [sortBy, setSortBy] = useState<"due" | "newest" | "priority" | "status">("due");

  useEffect(() => {
    if (loadingRole) return;

    async function init() {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserId(data.user.id);
      await fetchAll();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadingRole, isAdmin]);

  function showSuccessMessage(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function fetchAll() {
    setRefreshing(true);
    setError("");

    const tasksResult = await supabase
      .from("tasks")
      .select("*,clients(id,name,phone),cases(id,client_id,title,case_number,case_year,clients(id,name,phone))")
      .order("created_at", { ascending: false });

    const clientsResult = await supabase
      .from("clients")
      .select("id,name,phone")
      .order("created_at", { ascending: false });

    const casesResult = await supabase
      .from("cases")
      .select("id,client_id,title,case_number,case_year,clients(id,name,phone)")
      .order("created_at", { ascending: false });

    const profilesResult = isAdmin
      ? await supabase
          .from("profiles")
          .select("user_id,email,full_name,role")
          .order("email", { ascending: true })
      : await supabase
          .from("profiles")
          .select("user_id,email,full_name,role")
          .eq("user_id", profile?.user_id || "");

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setRefreshing(false);
      return;
    }

    if (clientsResult.error) {
      setError(clientsResult.error.message);
      setRefreshing(false);
      return;
    }

    if (casesResult.error) {
      setError(casesResult.error.message);
      setRefreshing(false);
      return;
    }

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setRefreshing(false);
      return;
    }

    const fetchedTasks = ((tasksResult.data || []) as unknown) as TaskRow[];

    setTasks(fetchedTasks);
    setClients(((clientsResult.data || []) as unknown) as ClientLite[]);
    setCases(((casesResult.data || []) as unknown) as CaseLite[]);
    setProfiles(((profilesResult.data || []) as unknown) as ProfileLite[]);
    setSelectedTaskId((current) => current || fetchedTasks[0]?.id || "");
    setRefreshing(false);
  }

  const profileById = useMemo(() => {
    const map = new Map<string, ProfileLite>();
    profiles.forEach((item) => map.set(item.user_id, item));
    return map;
  }, [profiles]);

  const clientOptions = useMemo(() => {
    return [
      { value: "", label: "بدون موكل" },
      ...clients.map((client) => ({
        value: client.id,
        label: `${client.name}${client.phone ? ` — ${client.phone}` : ""}`,
      })),
    ];
  }, [clients]);

  const activeClientId = editingTaskId ? editForm.client_id : form.client_id;

  const caseOptions = useMemo(() => {
    const filtered = activeClientId ? cases.filter((item) => item.client_id === activeClientId) : cases;

    return [
      { value: "", label: "بدون قضية" },
      ...filtered.map((item) => ({
        value: item.id,
        label: prettyCaseLabel(item),
      })),
    ];
  }, [cases, activeClientId]);

  const assigneeOptions = useMemo(() => {
    return [
      { value: "all", label: "كل المكلفين" },
      ...profiles.map((item) => ({
        value: item.user_id,
        label: profileLabel(item),
      })),
    ];
  }, [profiles]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = tasks.filter((task) => {
      const due = dueLabel(task);
      const assignee = profileById.get(task.assigned_to);
      const assigner = profileById.get(task.assigned_by);

      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === "all" || task.assigned_to === assigneeFilter;
      const matchesDue =
        dueFilter === "all" ||
        (dueFilter === "today" && task.due_date === todayISO() && task.status !== "done" && task.status !== "cancelled") ||
        (dueFilter === "overdue" && due.label === "متأخرة") ||
        (dueFilter === "upcoming" && due.label === "قادمة") ||
        (dueFilter === "no_due" && !task.due_date);

      const searchable = [
        task.title,
        task.description,
        task.completion_notes,
        task.status,
        task.priority,
        task.clients?.name,
        task.cases?.title,
        assignee?.email,
        assignee?.full_name,
        assigner?.email,
        assigner?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesPriority && matchesAssignee && matchesDue && (!q || searchable.includes(q));
    });

    if (sortBy === "newest") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (sortBy === "status") {
      result = [...result].sort((a, b) => a.status.localeCompare(b.status));
    }

    if (sortBy === "priority") {
      const rank: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      result = [...result].sort((a, b) => rank[b.priority] - rank[a.priority]);
    }

    if (sortBy === "due") {
      result = [...result].sort((a, b) => {
        const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
    }

    return result;
  }, [tasks, search, statusFilter, priorityFilter, assigneeFilter, dueFilter, sortBy, profileById]);

  const selectedTask = tasks.find((item) => item.id === selectedTaskId) || filteredTasks[0] || null;

  const stats = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
    const overdue = active.filter((task) => task.due_date && task.due_date < todayISO());
    const today = active.filter((task) => task.due_date === todayISO());
    const done = tasks.filter((task) => task.status === "done");

    return {
      total: tasks.length,
      active: active.length,
      overdue: overdue.length,
      today: today.length,
      done: done.length,
    };
  }, [tasks]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setDueFilter("all");
    setSortBy("due");
  }

  function handleCaseChange(value: string, mode: "create" | "edit") {
    const selectedCase = cases.find((item) => item.id === value);

    if (mode === "create") {
      setForm((prev) => ({
        ...prev,
        case_id: value,
        client_id: selectedCase?.client_id || prev.client_id,
      }));
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      case_id: value,
      client_id: selectedCase?.client_id || prev.client_id,
    }));
  }


  async function handleAddTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!isAdmin) {
      setError("إضافة المهام متاحة للمدير فقط.");
      return;
    }

    if (!userId) return;

    const assignee = profiles.find((item) => item.user_id === form.assigned_to) || null;

    if (!assignee) {
      setError("اختر المستخدم المكلف من القائمة.");
      return;
    }

    if (!form.title.trim()) {
      setError("عنوان المهمة مطلوب.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        assigned_by: userId,
        assigned_to: assignee.user_id,
        title: form.title.trim(),
        description: nullIfEmpty(form.description),
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
        case_id: form.case_id || null,
        completion_notes: nullIfEmpty(form.completion_notes),
      })
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      setError(error?.message || "فشل حفظ المهمة.");
      return;
    }

    const created = data as TaskRow;
    setForm(emptyTaskForm);
    setSelectedTaskId(created.id);
    setShowCreate(false);
    showSuccessMessage("تم إنشاء المهمة وتكليف المستخدم.");
    await fetchAll();
  }

  function startEditTask(task: TaskRow) {
    setEditingTaskId(task.id);
    setEditForm({
      assigned_to: task.assigned_to || "",
      title: task.title || "",
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      client_id: task.client_id || "",
      case_id: task.case_id || "",
      completion_notes: task.completion_notes || "",
    });
  }

  async function handleUpdateTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!editingTaskId || !selectedTask) return;

    if (!editForm.title.trim()) {
      setError("عنوان المهمة مطلوب.");
      return;
    }

    setSavingEdit(true);

    let assigneeId = selectedTask.assigned_to;

    if (isAdmin) {
      if (!editForm.assigned_to) {
        setSavingEdit(false);
        setError("اختر المستخدم المكلف من القائمة.");
        return;
      }

      const assignee = profiles.find((item) => item.user_id === editForm.assigned_to) || null;

      if (!assignee) {
        setSavingEdit(false);
        setError("المستخدم المختار غير موجود في قائمة المستخدمين.");
        return;
      }

      assigneeId = assignee.user_id;
    }

    const adminPatch = {
      assigned_to: assigneeId,
      title: editForm.title.trim(),
      description: nullIfEmpty(editForm.description),
      status: editForm.status,
      priority: editForm.priority,
      due_date: editForm.due_date || null,
      client_id: editForm.client_id || null,
      case_id: editForm.case_id || null,
      completion_notes: nullIfEmpty(editForm.completion_notes),
    };

    const userPatch = {
      status: editForm.status,
      completion_notes: nullIfEmpty(editForm.completion_notes),
    };

    const { error } = await supabase
      .from("tasks")
      .update(isAdmin ? adminPatch : userPatch)
      .eq("id", editingTaskId);

    setSavingEdit(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingTaskId("");
    showSuccessMessage("تم تحديث المهمة.");
    await fetchAll();
  }

  async function quickUpdateStatus(task: TaskRow, status: TaskStatus) {
    setSavingStatus(true);
    setError("");

    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", task.id);

    setSavingStatus(false);

    if (error) {
      setError(error.message);
      return;
    }

    showSuccessMessage("تم تحديث حالة المهمة.");
    await fetchAll();
  }

  async function deleteTask(task: TaskRow) {
    if (!isAdmin) return;

    const ok = confirm("هل تريد حذف هذه المهمة؟");
    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (selectedTaskId === task.id) {
      setSelectedTaskId("");
    }

    showSuccessMessage("تم حذف المهمة.");
    await fetchAll();
  }

  if (loading || loadingRole) {
    return <LoadingCard text="جاري تحميل المهام..." />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Tasks Workspace"
          title="إدارة المهام"
          tone="teal"
          description={
            isAdmin
              ? "كل المهام في المكتب: اختار مستخدم من القائمة، كلفه بمهمة، تابع التنفيذ، وعدل أو احذف."
              : "هنا تظهر المهام المكلف بها حسابك فقط، ويمكنك تحديث حالة التنفيذ."
          }
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowCreate((value) => !value)}
                  className="h-10 rounded-[18px] bg-slate-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-950"
                >
                  {showCreate ? "إغلاق الإضافة" : "تكليف مهمة"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={fetchAll}
                disabled={refreshing}
                className="h-10 rounded-[18px] border border-black/10 bg-white/80 px-4 text-xs font-black text-black shadow-sm transition hover:bg-white disabled:opacity-60"
              >
                {refreshing ? "تحديث..." : "تحديث"}
              </button>
            </div>
          }
        />

        {error ? <Alert tone="red" title="حدث خطأ" text={error} /> : null}
        {success ? <Alert tone="green" title="تم بنجاح" text={success} /> : null}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <SummaryCard label="الإجمالي" value={stats.total} hint="كل المهام المتاحة لك" tone="blue" />
          <SummaryCard label="نشطة" value={stats.active} hint="مطلوبة أو قيد التنفيذ" tone="teal" />
          <SummaryCard label="اليوم" value={stats.today} hint="موعدها اليوم" tone="amber" />
          <SummaryCard label="متأخرة" value={stats.overdue} hint="فات موعدها" tone="rose" />
          <SummaryCard label="تمت" value={stats.done} hint="مغلقة" tone="zinc" />
        </section>

        {isAdmin && showCreate ? (
          <form
            onSubmit={handleAddTask}
            className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] backdrop-blur-3xl lg:p-5"
          >
            <CompactTitle
              title="تكليف مهمة جديدة"
              description="اختار المستخدم من قائمة الحسابات المسجلة، ثم اربط المهمة بموكل أو قضية إن وجد."
            />

            <TaskForm
              form={form}
              setForm={setForm}
              isAdmin={isAdmin}
              profiles={profiles}
              clientOptions={clientOptions}
              caseOptions={caseOptions}
              onCaseChange={(value) => handleCaseChange(value, "create")}
              saving={saving}
              submitLabel={saving ? "جاري الحفظ..." : "تكليف المهمة"}
            />
          </form>
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
          <section className="min-w-0 space-y-4">
            <FiltersPanel
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              dueFilter={dueFilter}
              setDueFilter={setDueFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              assigneeOptions={assigneeOptions}
              showAssigneeFilter={isAdmin}
              onReset={resetFilters}
            />

            <TasksList
              tasks={filteredTasks}
              selectedTaskId={selectedTask?.id || ""}
              profileById={profileById}
              onSelect={(id) => {
                setSelectedTaskId(id);
                setEditingTaskId("");
              }}
            />
          </section>

          <TaskDetailsPanel
            task={selectedTask}
            isAdmin={isAdmin}
            profileById={profileById}
            editingTaskId={editingTaskId}
            editForm={editForm}
            setEditForm={setEditForm}
            profiles={profiles}
            clientOptions={clientOptions}
            caseOptions={caseOptions}
            onCaseChange={(value) => handleCaseChange(value, "edit")}
            savingEdit={savingEdit}
            savingStatus={savingStatus}
            deleting={deleting}
            startEditTask={startEditTask}
            cancelEdit={() => setEditingTaskId("")}
            handleUpdateTask={handleUpdateTask}
            quickUpdateStatus={quickUpdateStatus}
            deleteTask={deleteTask}
          />
        </section>
      </div>
    </AppShell>
  );
}

function FiltersPanel({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  assigneeFilter,
  setAssigneeFilter,
  dueFilter,
  setDueFilter,
  sortBy,
  setSortBy,
  assigneeOptions,
  showAssigneeFilter,
  onReset,
}: {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: "all" | TaskStatus;
  setStatusFilter: (value: "all" | TaskStatus) => void;
  priorityFilter: "all" | TaskPriority;
  setPriorityFilter: (value: "all" | TaskPriority) => void;
  assigneeFilter: string;
  setAssigneeFilter: (value: string) => void;
  dueFilter: "all" | "today" | "overdue" | "upcoming" | "no_due";
  setDueFilter: (value: "all" | "today" | "overdue" | "upcoming" | "no_due") => void;
  sortBy: "due" | "newest" | "priority" | "status";
  setSortBy: (value: "due" | "newest" | "priority" | "status") => void;
  assigneeOptions: { value: string; label: string }[];
  showAssigneeFilter: boolean;
  onReset: () => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-black">بحث وفلترة</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl bg-zinc-100 px-3 py-2 text-[11px] font-black text-black transition hover:bg-zinc-200"
        >
          تصفير
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالعنوان، الوصف، المكلف، الموكل، القضية..."
          className="h-10 w-full min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-bold text-black outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-slate-400/10"
        />

        <div className="grid grid-cols-2 gap-2">
          <CompactSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "all" | TaskStatus)}
          >
            <option value="all">كل الحالات</option>
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </CompactSelect>

          <CompactSelect
            value={priorityFilter}
            onChange={(value) => setPriorityFilter(value as "all" | TaskPriority)}
          >
            <option value="all">كل الأولويات</option>
            {Object.entries(taskPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </CompactSelect>

          <CompactSelect
            value={dueFilter}
            onChange={(value) => setDueFilter(value as "all" | "today" | "overdue" | "upcoming" | "no_due")}
          >
            <option value="all">كل المواعيد</option>
            <option value="today">اليوم</option>
            <option value="overdue">متأخرة</option>
            <option value="upcoming">قادمة</option>
            <option value="no_due">بدون موعد</option>
          </CompactSelect>

          <CompactSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as "due" | "newest" | "priority" | "status")}
          >
            <option value="due">أقرب موعد</option>
            <option value="priority">الأولوية</option>
            <option value="newest">الأحدث</option>
            <option value="status">الحالة</option>
          </CompactSelect>

          {showAssigneeFilter ? (
            <div className="col-span-2">
              <CompactSelect value={assigneeFilter} onChange={setAssigneeFilter}>
                {assigneeOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </CompactSelect>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TasksList({
  tasks,
  selectedTaskId,
  profileById,
  onSelect,
}: {
  tasks: TaskRow[];
  selectedTaskId: string;
  profileById: Map<string, ProfileLite>;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-black">قائمة المهام</h2>
          <p className="text-xs font-bold text-zinc-500">{tasks.length} نتيجة</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="لا توجد مهام"
          description="لا توجد مهام مطابقة للبحث أو لم يتم تكليفك بمهام بعد."
        />
      ) : (
        <div className="max-h-[780px] space-y-2 overflow-y-auto pr-1">
          {tasks.map((task) => {
            const selected = selectedTaskId === task.id;
            const due = dueLabel(task);
            const assignee = profileById.get(task.assigned_to);

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task.id)}
                className={`w-full min-w-0 rounded-[22px] border p-3 text-right shadow-sm transition ${
                  selected
                    ? "border-slate-300 bg-slate-100/90 ring-4 ring-slate-400/10"
                    : "border-black/5 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-black">{task.title}</h3>
                    <p className="mt-1 truncate text-xs font-bold text-zinc-600">
                      {profileLabel(assignee)}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
                      {task.cases?.title || task.clients?.name || "غير مرتبطة بملف"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={taskStatusTone(task.status)}>{taskStatusLabels[task.status]}</Badge>
                    <Badge tone={due.tone}>{due.label}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Mini label="الأولوية" value={taskPriorityLabels[task.priority]} />
                  <Mini label="الموعد" value={formatDate(task.due_date)} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskForm({
  form,
  setForm,
  isAdmin,
  profiles,
  clientOptions,
  caseOptions,
  onCaseChange,
  saving,
  submitLabel,
}: {
  form: TaskFormState;
  setForm: Dispatch<SetStateAction<TaskFormState>>;
  isAdmin: boolean;
  profiles: ProfileLite[];
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="بيانات التكليف">
        {isAdmin ? (
          <div>
            <SelectField
              label="المستخدم المكلف"
              value={form.assigned_to}
              onChange={(value: string) =>
                setForm((prev) => ({ ...prev, assigned_to: value }))
              }
              options={[
                { value: "", label: "اختر المستخدم المكلف" },
                ...profiles
                  .filter((item) => item.role === "user")
                  .map((item) => ({
                    value: item.user_id,
                    label: `${item.full_name || item.email || item.user_id}${
                      item.email ? ` — ${item.email}` : ""
                    }`,
                  })),
              ]}
              required
            />
            {profiles.filter((item) => item.role === "user").length === 0 ? (
              <p className="mt-2 rounded-2xl bg-slate-100 px-3 py-2 text-[11px] font-black leading-5 text-slate-800">
                لا يوجد Regular Users حاليًا. أنشئ حساب مستخدم عادي أو حوّل أحد الحسابات من صفحة صلاحيات المستخدمين.
              </p>
            ) : (
              <p className="mt-2 text-[11px] font-bold text-zinc-500">
                تظهر هنا الحسابات المسجلة كـ Regular User فقط.
              </p>
            )}
          </div>
        ) : null}

        <Field
          label="عنوان المهمة"
          value={form.title}
          onChange={(value: string) => setForm((prev) => ({ ...prev, title: value }))}
          required
        />

        <SelectField
          label="الحالة"
          value={form.status}
          onChange={(value: string) => setForm((prev) => ({ ...prev, status: value as TaskStatus }))}
          options={Object.entries(taskStatusLabels).map(([value, label]) => ({ value, label }))}
        />

        <SelectField
          label="الأولوية"
          value={form.priority}
          onChange={(value: string) => setForm((prev) => ({ ...prev, priority: value as TaskPriority }))}
          options={Object.entries(taskPriorityLabels).map(([value, label]) => ({ value, label }))}
        />

        <Field
          label="موعد التسليم"
          value={form.due_date}
          onChange={(value: string) => setForm((prev) => ({ ...prev, due_date: value }))}
          type="date"
        />

        {isAdmin ? (
          <>
            <SelectField
              label="ربط بموكل"
              value={form.client_id}
              onChange={(value: string) => setForm((prev) => ({ ...prev, client_id: value, case_id: "" }))}
              options={clientOptions}
            />

            <SelectField
              label="ربط بقضية"
              value={form.case_id}
              onChange={onCaseChange}
              options={caseOptions}
            />
          </>
        ) : null}
      </FormSection>

      {isAdmin ? (
        <TextareaField
          label="وصف المهمة"
          value={form.description}
          onChange={(value: string) => setForm((prev) => ({ ...prev, description: value }))}
          placeholder="اشرح المطلوب بوضوح..."
        />
      ) : null}

      <TextareaField
        label="ملاحظات التنفيذ"
        value={form.completion_notes}
        onChange={(value: string) => setForm((prev) => ({ ...prev, completion_notes: value }))}
        placeholder="يستخدمها المكلف لكتابة ما تم تنفيذه أو أي عائق..."
      />

      <button
        disabled={saving}
        className="h-11 w-full rounded-[18px] bg-slate-900 text-sm font-black text-white shadow-lg transition hover:bg-slate-950 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function TaskDetailsPanel({
  task,
  isAdmin,
  profileById,
  editingTaskId,
  editForm,
  setEditForm,
  profiles,
  clientOptions,
  caseOptions,
  onCaseChange,
  savingEdit,
  savingStatus,
  deleting,
  startEditTask,
  cancelEdit,
  handleUpdateTask,
  quickUpdateStatus,
  deleteTask,
}: {
  task: TaskRow | null;
  isAdmin: boolean;
  profileById: Map<string, ProfileLite>;
  editingTaskId: string;
  editForm: TaskFormState;
  setEditForm: Dispatch<SetStateAction<TaskFormState>>;
  profiles: ProfileLite[];
  clientOptions: { value: string; label: string }[];
  caseOptions: { value: string; label: string }[];
  onCaseChange: (value: string) => void;
  savingEdit: boolean;
  savingStatus: boolean;
  deleting: boolean;
  startEditTask: (task: TaskRow) => void;
  cancelEdit: () => void;
  handleUpdateTask: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  quickUpdateStatus: (task: TaskRow, status: TaskStatus) => Promise<void>;
  deleteTask: (task: TaskRow) => Promise<void>;
}) {
  if (!task) {
    return (
      <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <EmptyState title="اختر مهمة" description="اختر مهمة من القائمة لعرض التفاصيل." />
      </div>
    );
  }

  const isEditing = editingTaskId === task.id;
  const assignee = profileById.get(task.assigned_to);
  const assigner = profileById.get(task.assigned_by);
  const due = dueLabel(task);

  return (
    <section className="min-w-0 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)] backdrop-blur-3xl lg:p-5 xl:sticky xl:top-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white">
            ملف المهمة
          </p>
          <h2 className="break-words text-xl font-black text-black lg:text-2xl">{task.title}</h2>
          <p className="mt-1 break-words text-xs font-bold text-zinc-600">
            المكلف: {profileLabel(assignee)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SmallButton tone="blue" onClick={() => quickUpdateStatus(task, "in_progress")}>
            {savingStatus ? "..." : "قيد التنفيذ"}
          </SmallButton>

          <SmallButton tone="teal" onClick={() => quickUpdateStatus(task, "done")}>
            {savingStatus ? "..." : "تمت"}
          </SmallButton>

          <SmallButton tone="amber" onClick={() => startEditTask(task)}>
            {isAdmin ? "تعديل" : "تحديث ملاحظات"}
          </SmallButton>

          {isEditing ? (
            <SmallButton tone="zinc" onClick={cancelEdit}>إلغاء</SmallButton>
          ) : null}

          {isAdmin ? (
            <SmallButton tone="rose" onClick={() => deleteTask(task)}>
              {deleting ? "حذف..." : "حذف"}
            </SmallButton>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdateTask}>
          <TaskForm
            form={editForm}
            setForm={setEditForm}
            isAdmin={isAdmin}
            profiles={profiles}
            clientOptions={clientOptions}
            caseOptions={caseOptions}
            onCaseChange={onCaseChange}
            saving={savingEdit}
            submitLabel={savingEdit ? "جاري الحفظ..." : "حفظ التحديث"}
          />
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Info label="الحالة"><Badge tone={taskStatusTone(task.status)}>{taskStatusLabels[task.status]}</Badge></Info>
            <Info label="الأولوية"><Badge tone={taskPriorityTone(task.priority)}>{taskPriorityLabels[task.priority]}</Badge></Info>
            <Info label="الموعد"><Badge tone={due.tone}>{due.label}</Badge></Info>
            <Info label="تاريخ التسليم"><ResponsiveText>{formatDate(task.due_date)}</ResponsiveText></Info>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="المكلف"><ResponsiveText>{profileLabel(assignee)}</ResponsiveText></Info>
            <Info label="كلفها"><ResponsiveText>{profileLabel(assigner)}</ResponsiveText></Info>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="الموكل">
              {task.client_id ? (
                <Link href={`/clients/${task.client_id}`} className="font-black text-slate-700 hover:underline">
                  {task.clients?.name || "فتح ملف الموكل"}
                </Link>
              ) : <ResponsiveText>غير مرتبطة بموكل</ResponsiveText>}
            </Info>

            <Info label="القضية"><ResponsiveText>{task.cases?.title || "غير مرتبطة بقضية"}</ResponsiveText></Info>
          </div>

          <Info label="الوصف"><ResponsiveText>{task.description}</ResponsiveText></Info>
          <Info label="ملاحظات التنفيذ"><ResponsiveText>{task.completion_notes}</ResponsiveText></Info>

          {task.completed_at ? (
            <Info label="تاريخ الإتمام"><ResponsiveText>{formatDate(task.completed_at)}</ResponsiveText></Info>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CompactTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="break-words text-lg font-black text-black">{title}</h2>
      <p className="mt-1 text-xs font-semibold leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white/55 p-3">
      <h3 className="mb-3 text-sm font-black text-black">{title}</h3>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: "teal" | "blue" | "rose" | "amber" | "zinc" }) {
  const tones = {
    teal: "bg-slate-100 text-slate-800",
    blue: "bg-slate-100 text-slate-800",
    rose: "bg-rose-50 text-rose-800",
    amber: "bg-slate-100 text-slate-800",
    zinc: "bg-zinc-100 text-zinc-800",
  };

  return (
    <div className="min-w-0 rounded-[24px] border border-white/70 bg-white/70 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.05)] backdrop-blur-3xl">
      <p className={`mb-3 inline-flex max-w-full rounded-full px-3 py-1 text-[11px] font-black ${tones[tone]}`}>
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <h3 className="min-w-0 break-words text-2xl font-black text-black lg:text-3xl">{value}</h3>
      <p className="mt-1 text-[11px] font-bold leading-5 text-zinc-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-100/80 px-2.5 py-2">
      <p className="text-[9px] font-black text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-[11px] font-black text-black">{value}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white/80 p-3 shadow-sm">
      <p className="text-[11px] font-black text-zinc-500">{label}</p>
      <div className="mt-1.5 min-w-0 text-xs font-black text-black">{children}</div>
    </div>
  );
}

function SmallButton({ children, tone, onClick }: { children: ReactNode; tone: "amber" | "rose" | "zinc" | "teal" | "blue"; onClick: () => void }) {
  const tones = {
    amber: "bg-slate-100 text-slate-800 hover:bg-amber-200",
    rose: "bg-red-50 text-red-700 hover:bg-red-100",
    zinc: "bg-zinc-100 text-black hover:bg-zinc-200",
    teal: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    blue: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  };

  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-3 py-2 text-[11px] font-black transition disabled:opacity-60 ${tones[tone]}`}>
      {children}
    </button>
  );
}

function CompactSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-[16px] border border-black/10 bg-white/85 px-3 text-xs font-black text-black outline-none"
    >
      {children}
    </select>
  );
}

function Alert({ title, text, tone }: { title: string; text: string; tone: "red" | "green" }) {
  const tones = {
    red: "border-red-200 bg-red-50/80 text-red-700",
    green: "border-slate-200 bg-slate-100/80 text-slate-800",
  };

  return (
    <div className={`rounded-[22px] border p-4 text-sm font-bold leading-7 backdrop-blur-xl ${tones[tone]}`}>
      <p className="font-black">{title}:</p>
      <p className="mt-1 break-words">{text}</p>
    </div>
  );
}
