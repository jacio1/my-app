"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { PageHeader, EditorDialog } from "@/components/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { parseSnapshot, type Snapshot } from "@/lib/local-data";

export default function Home() {
  const { snapshot, loaded, commit, error } = useLocalData();
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function exportData() {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-diary-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setPending(null);
    setMessage("");
    setFileError("");
    setReading(true);
    try {
      setPending(parseSnapshot(await file.text()));
    } catch {
      setFileError("Не удалось прочитать копию. Выберите корректный JSON-файл версии 1 или 2.");
    } finally {
      setReading(false);
    }
  }

  const activeTasks = snapshot?.tasks.filter((task) => !task.completed).slice(0, 5);
  const recentEntries = snapshot && [
    ...snapshot.notes.map((entry) => ({ ...entry, section: "notes" })),
    ...snapshot.diary.map((entry) => ({ ...entry, section: "diary" })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);

  return (
    <section className="space-y-6">
      <PageHeader title="Всё начинается с мысли" description="Ваши планы, идеи и воспоминания — в одном месте." />
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        <div className="flex flex-wrap gap-3">
          <Link className="rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary hover:bg-muted" href="/tasks?new=1">Добавить задачу</Link>
          <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/notes?new=1">Новая заметка</Link>
          <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/diary?new=1">Новая запись</Link>
          <Link className="rounded-xl border bg-card px-4 py-3 text-sm font-medium" href="/plans?new=1">Новый план</Link>
          <Link className="rounded-xl border bg-card px-4 py-3 text-sm font-medium" href="/goals?new=1">Новая цель</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">{[{ label: "Активных задач", count: snapshot.tasks.filter((task) => !task.completed).length, href: "/tasks" }, { label: "Заметок", count: snapshot.notes.length, href: "/notes" }, { label: "Записей дневника", count: snapshot.diary.length, href: "/diary" }].map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border bg-card p-4 transition-colors hover:border-primary"><p className="text-3xl font-semibold text-primary">{item.count}</p><p className="mt-2 text-xs text-muted-foreground sm:text-sm">{item.label}</p></Link>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Активные задачи</h2>
            {activeTasks?.length ? <ul className="space-y-2">{activeTasks.map((task) => <li className="break-words" key={task.id}>{task.title}</li>)}</ul> : <p className="text-muted-foreground">Нет активных задач.</p>}
          </section>
          <section className="space-y-3 rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Последние записи</h2>
            {recentEntries?.length ? <ul className="space-y-2">{recentEntries.map((entry) => (
              <li className="break-words" key={`${entry.section}:${entry.id}`}>
                <Link className="underline" href={`/${entry.section}`}>{entry.title}</Link>
                <span className="ml-2 text-sm text-muted-foreground">{entry.section === "notes" ? "Заметка" : "Дневник"}</span>
              </li>
            ))}</ul> : <p className="text-muted-foreground">Пока нет записей.</p>}
          </section>
        </div>
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Резервная копия</h2>
          <p className="text-sm text-muted-foreground">Скачайте все разделы одним JSON-файлом. Импорт заменит данные текущего режима: локальные записи или записи аккаунта, если вы вошли.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>Скачать JSON</Button>
            <Button variant="outline" disabled={reading} onClick={() => fileInput.current?.click()}>Выбрать JSON</Button>
            <Input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Резервная копия JSON" onChange={readFile} />
          </div>
          {fileError && <p role="alert">{fileError}</p>}
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <EditorDialog open={!!pending} title="Восстановить резервную копию?" description="Импорт полностью заменит данные текущего режима, включая облако, если вы вошли. Сначала скачайте текущую копию, если хотите её сохранить." onClose={() => setPending(null)}>{pending && (
            <div className="space-y-4">
              {error && <p role="alert" className="text-destructive">{error}</p>}
              <p>В копии {pending.tasks.length} задач, {pending.notes.length} заметок и {pending.diary.length} записей дневника, {pending.plans.length} планов и {pending.goals.length} целей. Импорт заменит текущие данные.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => {
                  if (commit(() => pending)) {
                    setPending(null);
                    setMessage("Резервная копия восстановлена.");
                  }
                }}>Заменить данные</Button>
                <Button variant="outline" onClick={() => setPending(null)}>Отмена</Button>
              </div>
            </div>
          )}</EditorDialog>
        </section>
      </>}
    </section>
  );
}
