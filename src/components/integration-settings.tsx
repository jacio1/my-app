"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useCloud } from "@/components/cloud-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Connection = { id: string; name: string; scopes: string[]; expiresAt: number };
const subscribe = () => () => {};

export function IntegrationSettings() {
  const { user } = useCloud();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("Мой Codex");
  const [readOnly, setReadOnly] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = useSyncExternalStore(subscribe, () => `${window.location.origin}/api/mcp`, () => "/api/mcp");
  const request = useCallback(async (method = "GET", body?: unknown) => {
    if (!user) throw new Error("Сначала войдите в аккаунт.");
    const response = await fetch("/api/connections", { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 204) return {};
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void request().then((result) => { if (active) setConnections(result.connections); }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [user, request]);
  async function create() {
    setBusy(true); setError(""); setMessage(""); setToken("");
    try {
      const result = await request("POST", { name, readOnly });
      setToken(result.token);
      setConnections((await request()).connections);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось создать доступ."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError("");
    try { await request("DELETE", { id }); setConnections((current) => current.filter((item) => item.id !== id)); setToken(""); setMessage("Доступ отозван."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось отозвать доступ."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t pt-6">
    <h2 className="text-xl font-semibold">Помощник в чатах</h2>
    <p className="max-w-prose text-sm text-muted-foreground">После публикации сайта подключите этот адрес как MCP-сервер в Codex или в поддерживающем такие подключения ChatGPT. Подтвердите вход и разрешения. Помощник сможет читать и сохранять записи через ваш аккаунт в каждом чате, где включено подключение.</p>
    <label className="grid gap-2 text-sm">Адрес подключения<Input readOnly value={endpoint} onFocus={(event) => event.target.select()} /></label>
    <p className="text-xs text-muted-foreground">Локальный адрес подходит только для проверки на этом компьютере. Для удалённых чатов нужен опубликованный HTTPS-сайт.</p>
    {user && <>
      {connections.length > 0 && <ul className="divide-y">{connections.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.scopes.includes("records:write") ? "Чтение и изменение" : "Только чтение"} · до {new Date(item.expiresAt).toLocaleDateString("ru-RU")}</p></div><Button variant="outline" disabled={busy} onClick={() => revoke(item.id)}>Отозвать доступ</Button></li>)}</ul>}
      <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Ручное подключение по токену</summary><div className="mt-4 grid gap-4"><p className="text-sm text-muted-foreground">Для клиентов с поддержкой Bearer-токена. Он действует 90 дней и показывается только при создании. Храните его как пароль.</p><label className="grid gap-2 text-sm">Название подключения<Input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} />Только чтение</label><Button disabled={busy || !name.trim()} onClick={create}>Создать токен доступа</Button>{token && <label className="grid gap-2 text-sm">Сохраните токен сейчас<Textarea readOnly value={token} onFocus={(event) => event.target.select()} /><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(token); setMessage("Токен скопирован."); } catch { setMessage("Выделите и скопируйте токен вручную."); } }}>Скопировать токен</Button></label>}</div></details>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
