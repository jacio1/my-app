"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2, BookOpen } from "lucide-react";

type DiaryNote = {
  id: string;
  title: string;
  dayDescription: string;
  createdAt: string; 
};

const STORAGE_KEY = "diary-notes";

export default function DiaryPage() {
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNotes(JSON.parse(raw));
    } catch (e) {
      console.error("Не удалось загрузить заметки", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes, loaded]);

  const handleAdd = () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    const newNote: DiaryNote = {
      id: crypto.randomUUID(),
      title: title.trim() || "Без названия",
      dayDescription: trimmed,
      createdAt: new Date().toISOString(),
    };

    setNotes((prev) => [newNote, ...prev]);
    setTitle("");
    setDescription("");
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <BookOpen className="h-6 w-6" />
        <h1 className="text-3xl font-bold tracking-tight">Дневник</h1>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Новая запись</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Заголовок</Label>
            <Input
              id="title"
              placeholder="Например: день изучения React"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Что произошло за день</Label>
            <Textarea
              id="description"
              placeholder="Что изучил, что запомнилось, о чём думал..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={!description.trim()}>
              Сохранить запись
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Записи {notes.length > 0 && `(${notes.length})`}
        </h2>

        {notes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Пока нет записей. 
            </CardContent>
          </Card>
        ) : (
          notes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{note.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(note.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(note.id)}
                  aria-label="Удалить запись"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {note.dayDescription}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}