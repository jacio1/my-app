"use client";

import { useId, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MAX_SUBTASKS, type Subtask, type Task } from "@/lib/local-data";
import { cn } from "@/lib/utils";

type Props = {
  task: Task;
  onComplete: (completed: boolean) => void;
  onSubtasksChange: (change: (items: Subtask[]) => Subtask[]) => boolean;
  onRename: () => void;
  onDelete: () => void;
};

export function TaskCard({ task, onComplete, onSubtasksChange, onRename, onDelete }: Props) {
  const titleId = useId();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const subtasks = task.subtasks ?? [];
  const done = subtasks.filter((item) => item.completed).length;

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || subtasks.length >= MAX_SUBTASKS) return;
    const item = { id: crypto.randomUUID(), title, completed: false };
    if (onSubtasksChange((current) => current.length < MAX_SUBTASKS ? [...current, item] : current)) {
      setDraft("");
      setAdding(false);
    }
  }

  return (
    <Card
      size="sm"
      className={cn("cursor-pointer gap-0 border-l-[3px]", task.completed ? "border-l-muted-foreground/40 bg-muted/30" : "border-l-primary/70")}
      onClick={(event) => {
        if (!(event.target instanceof Element) || event.target.closest("button, input, label, form, a, [role='checkbox']")) return;
        if (window.getSelection()?.type === "Range") return;
        onComplete(!task.completed);
      }}
    >
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            aria-labelledby={titleId}
            checked={task.completed}
            onCheckedChange={onComplete}
            className="size-11 rounded-xl bg-background/60 after:inset-0 [&_svg]:size-5"
          />
          <h2 id={titleId} className={cn("min-w-0 flex-1 px-2 py-2.5 text-base font-semibold [overflow-wrap:anywhere]", task.completed && "text-muted-foreground line-through")}>{task.title}</h2>
          <Button size="icon" variant="ghost" aria-label="Переименовать задачу" onClick={onRename}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label="Удалить задачу" onClick={onDelete}><Trash2 /></Button>
        </div>
        <div className="space-y-2 border-t pt-3">
          {subtasks.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Подзадачи</span><span>{done} из {subtasks.length}</span>
              </div>
              <progress aria-label="Прогресс подзадач" className="block h-1 w-full accent-primary" value={done} max={subtasks.length} />
              <ul className="divide-y divide-border/60">
                {subtasks.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-1">
                    <Checkbox
                      checked={item.completed}
                      aria-label={item.title}
                      className="size-11 rounded-xl after:inset-0"
                      onCheckedChange={(completed) => onSubtasksChange((current) => current.map((subtask) => subtask.id === item.id ? { ...subtask, completed } : subtask))}
                    />
                    <span className={cn("min-w-0 flex-1 text-sm [overflow-wrap:anywhere]", item.completed && "text-muted-foreground line-through")}>{item.title}</span>
                    <Button size="icon" variant="ghost" aria-label={`Удалить подзадачу: ${item.title}`} onClick={() => onSubtasksChange((current) => current.filter((subtask) => subtask.id !== item.id))}><X /></Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {adding ? (
            <form onSubmit={addSubtask} className="flex flex-wrap items-center gap-2">
              <Input autoFocus required maxLength={500} aria-label="Название подзадачи" placeholder="Название подзадачи" className="min-w-40 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <Button type="submit" disabled={!draft.trim()}>Добавить</Button>
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>Отмена</Button>
            </form>
          ) : subtasks.length < MAX_SUBTASKS && (
            <Button size="sm" variant="ghost" className="text-primary" onClick={() => setAdding(true)}><Plus /> Подзадача</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
