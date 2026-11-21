"use client";

import Link from "next/link";
import { Cloud, CloudOff, LoaderCircle } from "lucide-react";
import { useCloud } from "@/components/cloud-provider";

const labels = {
  loading: "Загружаем данные…", local: "Локальный режим", connecting: "Подключаемся к облаку…",
  synced: "Синхронизировано", pending: "Отправляем изменения…", offline: "Нет связи с облаком", error: "Синхронизация остановлена",
};

export function SyncStatus() {
  const { status, user, error } = useCloud();
  const Icon = status === "synced" ? Cloud : ["loading", "connecting", "pending"].includes(status) ? LoaderCircle : CloudOff;
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-xs text-muted-foreground">
    <Link href="/profile" className="flex items-center gap-2 rounded px-1 py-1 hover:text-foreground"><Icon className="size-4" /><span role="status">{labels[status]}</span></Link>
    <Link href="/profile" className="max-w-full truncate hover:text-foreground">{user?.email ?? "Войти для синхронизации"}</Link>
    {error && <p role="alert" className="w-full text-destructive">{error}</p>}
  </div>;
}
