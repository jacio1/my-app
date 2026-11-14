"use client";

import type { ReactNode } from "react";
import { Plus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PageHeader({ title, description, action, onCreate }: { title: string; description: string; action?: string; onCreate?: () => void }) {
  return <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Личное пространство</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{action && <Button onClick={onCreate}><Plus className="size-4" />{action}</Button>}</header>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div role="status" className="grid justify-items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center text-sm text-muted-foreground"><Inbox className="size-8 text-primary/70" />{children}</div>;
}

export function EditorDialog({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}

export function DeleteDialog({ title, onClose, onDelete, error }: { title: string | null; onClose: () => void; onDelete: () => void; error?: string }) {
  return <EditorDialog open={title !== null} title="Удалить запись?" description={`«${title ?? ""}» будет удалена. Это действие нельзя отменить.`} onClose={onClose}>{error && <p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="outline" onClick={onClose}>Отмена</Button><Button variant="destructive" onClick={onDelete}>Удалить</Button></DialogFooter></EditorDialog>;
}
