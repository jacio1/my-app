"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
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
      setFileError("Не удалось прочитать копию. Выберите корректный JSON-файл версии 1.");
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
      <h1 className="text-3xl font-bold">Главная</h1>
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        <div className="flex flex-wrap gap-3">
          <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/tasks">Добавить задачу</Link>
          <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/notes?new=1">Новая заметка</Link>
          <Link className="rounded-lg border px-3 py-2 hover:bg-muted" href="/diary?new=1">Новая запись</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Активные задачи</h2>
            {activeTasks?.length ? <ul className="space-y-2">{activeTasks.map((task) => <li className="break-words" key={task.id}>{task.title}</li>)}</ul> : <p className="text-muted-foreground">Нет активных задач.</p>}
          </section>
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Последние записи</h2>
            {recentEntries?.length ? <ul className="space-y-2">{recentEntries.map((entry) => (
              <li className="break-words" key={`${entry.section}:${entry.id}`}>
                <Link className="underline" href={`/${entry.section}`}>{entry.title}</Link>
                <span className="ml-2 text-sm text-muted-foreground">{entry.section === "notes" ? "Заметка" : "Дневник"}</span>
              </li>
            ))}</ul> : <p className="text-muted-foreground">Пока нет записей.</p>}
          </section>
        </div>
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Резервная копия</h2>
          <p className="text-sm text-muted-foreground">Данные хранятся в этом браузере. JSON-файл содержит все три раздела и подходит для переноса на другое устройство.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>Скачать JSON</Button>
            <Button variant="outline" disabled={reading} onClick={() => fileInput.current?.click()}>Выбрать JSON</Button>
            <Input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Резервная копия JSON" onChange={readFile} />
          </div>
          {fileError && <p role="alert">{fileError}</p>}
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          {pending && (
            <div className="space-y-3 rounded-lg border p-3">
              <p>В копии {pending.tasks.length} задач, {pending.notes.length} заметок и {pending.diary.length} записей дневника. Импорт заменит текущие данные.</p>
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
          )}
        </section>
      </>}
    </section>
  );
}
