"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCloud } from "@/components/cloud-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace-ui";

function Consent() {
  const params = useSearchParams();
  const { user, login } = useCloud();
  const [client, setClient] = useState<{ name: string; scopes: string[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/oauth/authorize?${query}`, { signal: controller.signal }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setClient(body); }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [query]);
  async function allow() {
    if (!user || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/oauth/authorize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(Object.fromEntries(params)) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign(body.redirect);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось подключить помощника."); setBusy(false); }
  }
  return <section className="mx-auto max-w-xl space-y-6"><PageHeader title="Подключить помощника" description="Вы решаете, какие данные будут доступны в чатах." />{error && <p role="alert" className="text-destructive">{error}</p>}{client && <><p>Приложение «{client.name}» запрашивает доступ к вашему дневнику.</p><p className="break-all text-sm text-muted-foreground">Адрес возврата: {params.get("redirect_uri")}</p><ul className="list-disc space-y-2 pl-5">{client.scopes.includes("records:read") && <li>Чтение задач, заметок, дневника, планов и целей.</li>}{client.scopes.includes("records:write") && <li>Создание, изменение и удаление записей по вашим просьбам.</li>}</ul><p className="text-sm text-muted-foreground">Доступ можно отозвать в профиле. Подключайте только доверенный сервис.</p>{user ? <><p className="text-sm">Аккаунт: {user.email}</p><Button disabled={busy} onClick={allow}>{busy ? "Подключаем…" : "Разрешить доступ"}</Button></> : <Button onClick={login}>Войти через Google</Button>}<a href="/profile" className="ml-4 text-sm underline">Отмена</a></>}</section>;
}
export default function AuthorizePage() { return <Suspense fallback={<p role="status">Проверяем подключение…</p>}><Consent /></Suspense>; }
