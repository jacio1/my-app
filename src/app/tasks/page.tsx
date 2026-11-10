"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { newRecord, type Task } from "@/lib/local-data";

const filters = [
  { value: "active", label: "Активные" },
  { value: "completed", label: "Выполненные" },
  { value: "all", label: "Все" },
] as const;

export default function TasksPage() {
  const { snapshot, loaded, commit, error } = useLocalData();
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
      setTitle("");
      setEditing(null);
    }
  }

  const tasks = snapshot?.tasks.filter((task) => filter === "all" || task.completed === (filter === "completed"));

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Задачи</h1>
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-40 flex-1 gap-2">
            {editing ? "Переименовать задачу" : "Новая задача"}
            <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <Button type="submit" disabled={!title.trim()}>{editing ? "Сохранить" : "Добавить"}</Button>
          {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setTitle(""); }}>Отмена</Button>}
        </form>
        <div role="group" aria-label="Фильтр задач" className="flex flex-wrap gap-2">
          {filters.map(({ value, label }) => (
            <Button key={value} variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>
          ))}
        </div>
        {tasks?.length === 0 && <p className="text-muted-foreground">В этом списке пока нет задач.</p>}
        <ul className="space-y-2">
          {tasks?.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <label className="flex min-w-0 flex-1 items-center gap-3 break-all">
                <input type="checkbox" checked={task.completed} onChange={() => updateTask(task.id, { completed: !task.completed })} />
                <span className={task.completed ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
              </label>
              <Button size="sm" variant="outline" disabled={!!editing || !!title} onClick={() => { setEditing(task.id); setTitle(task.title); }}>Переименовать</Button>
              <Button size="sm" variant="ghost" disabled={editing === task.id} onClick={() => {
                if (window.confirm(`Удалить «${task.title}»?`)) {
                  commit((current) => ({ ...current, tasks: current.tasks.filter(({ id }) => id !== task.id) }));
                }
              }}>Удалить</Button>
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}
