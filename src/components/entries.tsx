"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StorageStatus, useLocalData } from "@/hooks/use-local-data";
import { PageHeader, EmptyState, EditorDialog, DeleteDialog } from "@/components/workspace-ui";
import { DialogFooter } from "@/components/ui/dialog";
import { newRecord, isCalendarDate, type Entry, type Section } from "@/lib/local-data";

export function Entries({ section, startNew }: { section: Exclude<Section, "tasks">; startNew: boolean }) {
  const { snapshot, loaded, commit, error } = useLocalData();
  const [draft, setDraft] = useState<{ id?: string; title: string; text: string; date?: string; completed?: boolean } | null>(startNew ? { title: "", text: "", date: new Date().toLocaleDateString("sv-SE"), completed: false } : null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (startNew) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url);
    }
  }, [startNew]);
  const diary = section === "diary";
  const titles = { notes: "Заметки", diary: "Дневник", plans: "Планы", goals: "Цели" };
  const actions = { notes: "Новая заметка", diary: "Новая запись", plans: "Новый план", goals: "Новая цель" };
  const descriptions = { notes: "Идеи и всё, что важно не забыть.", diary: "Моменты, мысли и впечатления дня.", plans: "План на день или шаги для большого дела.", goals: "То, к чему вы хотите прийти, и как это сделать." };
  const today = () => new Date().toLocaleDateString("sv-SE");
  const createDraft = () => setDraft({ title: "", text: "", date: today(), completed: false });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.text.trim()) return;
    if (section === "plans" && draft.date && !isCalendarDate(draft.date)) return;
    const extra = section === "plans" ? { date: draft.date ?? "" } : section === "goals" ? { completed: draft.completed ?? false } : {};
    const title = draft.title.trim() || "Без названия";
    const text = draft.text.trim();
    if (commit((current) => ({
      ...current,
      [section]: draft.id
        ? current[section].map((entry) => entry.id === draft.id
          ? { ...entry, title, text, ...extra, updatedAt: new Date().toISOString() }
          : entry)
        : [...current[section], { ...newRecord(title), text, ...extra }],
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
      <PageHeader title={titles[section]} description={descriptions[section]} action={snapshot ? actions[section] : undefined} onCreate={createDraft} />
      {!snapshot ? <StorageStatus loaded={loaded} /> : <>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <EditorDialog open={!!draft} title={draft?.id ? "Редактировать запись" : actions[section]} description="Сохраните то, что важно для вас." onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={submit} className="grid gap-5">
            <label className="grid gap-2">Заголовок
              <Input autoFocus maxLength={500} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            {section === "plans" && <label className="grid gap-2">Дата плана<Input type="date" value={draft.date ?? ""} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /><span className="text-xs text-muted-foreground">Для плана задачи дату можно оставить пустой.</span></label>}
            <div className="grid gap-2">
              <label htmlFor="entry-text">{diary ? "Запись" : "Текст заметки"}</label>
              <Textarea id="entry-text" required maxLength={100000} rows={6} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
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
              {"date" in entry && typeof entry.date === "string" && entry.date !== "" && <p className="text-sm text-primary">На {new Date(`${entry.date}T12:00:00`).toLocaleDateString("ru-RU")}</p>}
              {section === "goals" && "completed" in entry && <p className="text-sm text-primary">{entry.completed ? "Цель достигнута" : "В процессе"}</p>}
              <p className="whitespace-pre-wrap">{entry.text}</p>
              <div className="flex flex-wrap gap-2">
                {section === "goals" && "completed" in entry && <Button size="sm" variant="outline" onClick={() => commit((current) => ({ ...current, goals: current.goals.map((goal) => goal.id === entry.id ? { ...goal, completed: !goal.completed, updatedAt: new Date().toISOString() } : goal) }))}>{entry.completed ? "Вернуть в работу" : "Цель достигнута"}</Button>}
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
