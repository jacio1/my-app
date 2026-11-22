"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { PageHeader, EmptyState, EditorDialog, DeleteDialog } from "@/components/workspace-ui";
import { DialogFooter } from "@/components/ui/dialog";
import { TaskCard } from "@/components/task-card";
import { newRecord, type Task } from "@/lib/local-data";

const filters = [
  { value: "active", label: "Активные" },
  { value: "completed", label: "Выполненные" },
  { value: "all", label: "Все" },
] as const;

export default function TasksPage() {
  return <Suspense fallback={<StorageStatus loaded={false} />}><TaskVisit /></Suspense>;
}

function TaskVisit() {
  const pathname = usePathname();
  return pathname === "/tasks" ? <Tasks /> : null;
}

function Tasks() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("new") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url);
    }
  }, [params]);
  const { snapshot, loaded, commit, error } = useLocalData();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("active");

  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(() => new Set());

  function updateTask(id: string, change: (task: Task) => Partial<Pick<Task, "title" | "completed" | "subtasks">>) {
    return commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id
        ? { ...task, ...change(task), updatedAt: new Date().toISOString() }
        : task),
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const saved = editing
      ? updateTask(editing, () => ({ title: trimmed }))
      : commit((current) => ({
        ...current, tasks: [{ ...newRecord(trimmed), completed: false }, ...current.tasks],
      }));
    if (saved) {
      if (!editing && filter === "completed") setFilter("active");
      setOpen(false);
      setTitle("");
      setEditing(null);
    }
  }

  const tasks = snapshot?.tasks.filter((task) => (filter === "all" || task.completed === (filter === "completed") || (filter === "active" && recentlyCompleted.has(task.id))) && task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <section className="space-y-5">
      <PageHeader title="Задачи" description="Освободите голову и сосредоточьтесь на следующем шаге." action={snapshot ? "Новая задача" : undefined} onCreate={() => { setTitle(""); setEditing(null); setOpen(true); }} />
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <EditorDialog open={open} title={editing ? "Редактировать задачу" : "Новая задача"} description="Один небольшой шаг к вашим целям." onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="grid gap-5">
          <label className="grid min-w-40 flex-1 gap-2">
            {editing ? "Переименовать задачу" : "Новая задача"}
            <Input autoFocus required maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <DialogFooter><Button type="submit" disabled={!title.trim()}>{editing ? "Сохранить" : "Добавить"}</Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button></DialogFooter>
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </form>
        </EditorDialog>
        <DeleteDialog title={deleting?.title ?? null} error={error} onClose={() => setDeleting(null)} onDelete={() => { if (deleting && commit((current) => ({ ...current, tasks: current.tasks.filter(({ id }) => id !== deleting.id) }))) setDeleting(null); }} />
        <Input type="search" aria-label="Поиск задач" placeholder="Найти задачу…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div role="group" aria-label="Фильтр задач" className="flex flex-wrap gap-2">
          {filters.map(({ value, label }) => (
            <Button key={value} variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} · {snapshot.tasks.filter((task) => value === "all" || task.completed === (value === "completed")).length}</Button>
          ))}
        </div>
        {tasks?.length === 0 && <EmptyState>{query.trim() ? "Ничего не найдено. Попробуйте другой запрос." : "В этом списке пока нет задач. Можно выдохнуть или наметить новый шаг."}</EmptyState>}
        <ul className="space-y-2">
          {tasks?.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onComplete={(completed) => {
                  if (!updateTask(task.id, () => ({ completed }))) return;
                  setRecentlyCompleted((previous) => {
                    const next = new Set(previous);
                    if (completed) next.add(task.id);
                    else next.delete(task.id);
                    return next;
                  });
                }}
                onSubtasksChange={(change) => updateTask(task.id, (current) => ({
                  subtasks: change(current.subtasks ?? []),
                }))}
                onRename={() => { setEditing(task.id); setTitle(task.title); setOpen(true); }}
                onDelete={() => setDeleting(task)}
              />
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}
