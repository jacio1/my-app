"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { PageHeader, EmptyState, EditorDialog, DeleteDialog } from "@/components/workspace-ui";
import { DialogFooter } from "@/components/ui/dialog";
import { newRecord, type Task } from "@/lib/local-data";

const filters = [
  { value: "active", label: "Активные" },
  { value: "completed", label: "Выполненные" },
  { value: "all", label: "Все" },
] as const;

export default function TasksPage() {
  return <Suspense fallback={<StorageStatus loaded={false} />}><Tasks /></Suspense>;
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

  function updateTask(id: string, patch: Partial<Pick<Task, "title" | "completed">>) {
    return commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id
        ? { ...task, ...patch, updatedAt: new Date().toISOString() }
        : task),
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const saved = editing
      ? updateTask(editing, { title: trimmed })
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

  const tasks = snapshot?.tasks.filter((task) => (filter === "all" || task.completed === (filter === "completed")) && task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

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
            <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4">
              <label className="flex min-w-0 flex-1 items-center gap-3 break-words">
                <input className="size-5 shrink-0 accent-primary" type="checkbox" checked={task.completed} onChange={() => updateTask(task.id, { completed: !task.completed })} />
                <span className={task.completed ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
              </label>
              <Button size="sm" variant="outline" onClick={() => { setEditing(task.id); setTitle(task.title); setOpen(true); }}>Переименовать</Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(task)}>Удалить</Button>
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}
