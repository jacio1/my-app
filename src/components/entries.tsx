"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { PageHeader, EmptyState, EditorDialog, DeleteDialog } from "@/components/workspace-ui";
import { DialogFooter } from "@/components/ui/dialog";
import { newRecord, type Entry } from "@/lib/local-data";

export function Entries({ section, startNew }: { section: "notes" | "diary"; startNew: boolean }) {
  const { snapshot, loaded, commit, error } = useLocalData();
  const [draft, setDraft] = useState<{ id?: string; title: string; text: string } | null>(startNew ? { title: "", text: "" } : null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
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

    if (commit((current) => ({
      ...current, [section]: current[section].filter(({ id }) => id !== entry.id),
    }))) { setDeleting(null); if (draft?.id === entry.id) setDraft(null); }
  }

  const entries = snapshot?.[section]
    .filter(({ title, text }) => `${title}\n${text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => diary
      ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
      : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return (
    <section className="space-y-5">
      <PageHeader title={diary ? "Дневник" : "Заметки"} description={diary ? "Сохраняйте моменты, мысли и впечатления дня." : "Место для идей и всего, что важно не забыть."} action={snapshot ? (diary ? "Новая запись" : "Новая заметка") : undefined} onCreate={() => setDraft({ title: "", text: "" })} />
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <EditorDialog open={!!draft} title={draft?.id ? "Редактировать запись" : diary ? "Новая запись" : "Новая заметка"} description="Сохраните то, что важно для вас." onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={submit} className="grid gap-5">
            <label className="grid gap-2">Заголовок
              <Input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <div className="grid gap-2">
              <label htmlFor="entry-text">{diary ? "Запись" : "Текст заметки"}</label>
              <Textarea id="entry-text" required rows={6} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
            </div>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            {diary && <p className="text-sm text-muted-foreground">Что запомнилось сегодня? Что я почувствовал? Что хочу попробовать завтра?</p>}
            <DialogFooter>
              <Button type="submit" disabled={!draft.text.trim()}>Сохранить</Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Отмена</Button>
            </DialogFooter>
          </form>
        )}
        </EditorDialog>
        <DeleteDialog title={deleting?.title ?? null} error={error} onClose={() => setDeleting(null)} onDelete={() => { if (deleting) remove(deleting); }} />
        <div className="flex items-center gap-4"><Input type="search" aria-label="Поиск записей" placeholder="Поиск по заголовку и тексту…" value={query} onChange={(event) => setQuery(event.target.value)} /><span className="shrink-0 text-sm text-muted-foreground">Найдено: {entries?.length}</span></div>
        {entries?.length === 0 && <EmptyState>{query.trim() ? "Ничего не найдено. Попробуйте другой запрос." : "Здесь появятся ваши записи. Создайте первую."}</EmptyState>}
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
                <Button size="sm" variant="ghost" onClick={() => setDeleting(entry)}>Удалить</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </>}
    </section>
  );
}
