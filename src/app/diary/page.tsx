"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDrive } from "@/hooks/useDrive";

export default function DiaryPage() {
  const { data, status, error, updateDays, connect } = useDrive();

  if (!data) return <p className="p-4 text-muted-foreground">Загрузка…</p>;

  const days = data.days;

  const addDay = () =>
    updateDays((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((day) => day.id)) + 1 : 1;
      return [...prev, { id: nextId, title: `День ${nextId}`, description: "" }];
    });

  const updateDescription = (id: number, description: string) =>
    updateDays((prev) => prev.map((day) => (day.id === id ? { ...day, description } : day)));

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <nav className="text-sm text-muted-foreground">
        <Link href="/profile" className="hover:text-foreground">
          Профиль {status === "saving" ? "· сохраняю…" : ""}
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">Дневник</h1>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {days.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {status === "signed-out"
              ? "Чтобы записи сохранялись на Google Диск, войдите через Google."
              : "Записей пока нет — добавьте первый день."}
          </p>
          {status === "signed-out" && (
            <Button onClick={() => void connect()}>Войти через Google</Button>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {days.map((day) => (
            <li key={day.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <h2 className="font-medium">{day.title}</h2>
              <textarea
                value={day.description}
                onChange={(event) => updateDescription(day.id, event.target.value)}
                placeholder="Что произошло сегодня?"
                className="min-h-24 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:border-ring"
              />
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={addDay}>
        Добавить день
      </Button>
    </div>
  );
}
