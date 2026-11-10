"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { newRecord, type Entry } from "@/lib/local-data";

export function Entries({ section, startNew }: { section: "notes" | "diary"; startNew: boolean }) {
  const { snapshot, loaded, commit, error } = useLocalData();
  const [draft, setDraft] = useState<{ id?: string; title: string; text: string } | null>(startNew ? { title: "", text: "" } : null);
  const [query, setQuery] = useState("");
  const diary = section === "diary";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.text.trim()) return;
    const title = draft.title.trim() || "Без названия";
    const text = draft.text.trim();
    if (commit((current) => ({
      ...current,
      [section]: draft.id
        ? current[section].map((entry) => entry.id === draft.id
          ? { ...entry, title, text, updatedAt: new Date().toISOString() }
          : entry)
        : [...current[section], { ...newRecord(title), text }],
    }))) setDraft(null);
  }

  function remove(entry: Entry) {
    if (!window.confirm(`Удалить «${entry.title}»?`)) return;
    if (commit((current) => ({
      ...current, [section]: current[section].filter(({ id }) => id !== entry.id),
    })) && draft?.id === entry.id) setDraft(null);
  }

  const entries = snapshot?.[section]
    .filter(({ title, text }) => diary || `${title}\n${text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => diary
      ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
      : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">{diary ? "Дневник" : "Заметки"}</h1>
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {draft ? (
          <form onSubmit={submit} className="grid gap-3 rounded-lg border p-4">
            <label className="grid gap-2">Заголовок
              <Input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <div className="grid gap-2">
              <label htmlFor="entry-text">{diary ? "Запись" : "Текст заметки"}</label>
              <Textarea id="entry-text" required rows={6} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
            </div>
            {diary && <p className="text-sm text-muted-foreground">Что запомнилось сегодня? Что я почувствовал? Что хочу попробовать завтра?</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.text.trim()}>Сохранить</Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Отмена</Button>
            </div>
          </form>
        ) : <Button onClick={() => setDraft({ title: "", text: "" })}>{diary ? "Новая запись" : "Новая заметка"}</Button>}
        {!diary && <Input type="search" aria-label="Поиск заметок" placeholder="Поиск заметок" value={query} onChange={(event) => setQuery(event.target.value)} />}
        {entries?.length === 0 && <p className="text-muted-foreground">{query.trim() ? "Ничего не найдено." : "Пока здесь пусто."}</p>}
        {entries?.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="space-y-3 break-words">
              <h2 className="text-lg font-semibold">{entry.title}</h2>
              <time dateTime={entry.createdAt} className="text-sm text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString("ru-RU")}
              </time>
              <p className="whitespace-pre-wrap">{entry.text}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!!draft} onClick={() => setDraft(entry)}>Редактировать</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(entry)}>Удалить</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </>}
    </section>
  );
}
