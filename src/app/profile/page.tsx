"use client";

import { useState } from "react";
import { useCloud } from "@/components/cloud-provider";
import { InstallApp } from "@/components/install-app";
import { IntegrationSettings } from "@/components/integration-settings";
import { PageHeader } from "@/components/workspace-ui";
import { Button } from "@/components/ui/button";
import { cloudConfigured } from "@/lib/firebase-client";

export default function ProfilePage() {
  const { user, login, logout, ready, status, importLocal, recovery } = useCloud();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <section className="space-y-8">
    <PageHeader title="Ваше пространство" description="Один аккаунт для планов, целей и записей на всех устройствах." />
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <h2 className="text-xl font-semibold">{user ? user.displayName ?? "Ваш аккаунт" : "Аккаунт и синхронизация"}</h2>
      {user ? <><p className="break-all text-sm text-muted-foreground">{user.email}</p><p className="max-w-prose text-sm">Изменения передаются между устройствами через ваш аккаунт. Без интернета они сохраняются на этом устройстве и отправляются при восстановлении связи. При одновременном изменении одного поля сохраняется последнее полученное сервером значение.</p><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!ready || busy} onClick={() => { if (importLocal()) setMessage("Локальные записи добавлены в аккаунт. Дождитесь статуса «Синхронизировано»."); }}>Перенести локальные записи</Button><Button variant="ghost" disabled={busy || status === "pending"} onClick={async () => { setBusy(true); await logout(); setMessage(""); setBusy(false); }}>Выйти</Button></div><p className="text-xs text-muted-foreground">Локальные записи переносятся по запросу и остаются в резерве этого браузера. На личном устройстве используется офлайн-кэш; не входите на чужом компьютере.</p></> : <><p className="max-w-prose text-sm text-muted-foreground">Пока записи хранятся только в этом браузере. Войдите через Google, затем перенесите их в аккаунт. На другом устройстве войдите в тот же аккаунт.</p>{!cloudConfigured && <p className="text-sm">Облачное подключение ещё не настроено. Для владельца проекта шаги описаны в README.</p>}<Button disabled={busy || !cloudConfigured} onClick={async () => { setBusy(true); await login(); setBusy(false); }}>{busy ? "Открываем Google…" : "Войти через Google"}</Button></>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {recovery && <div className="space-y-3 border-t pt-4"><p className="text-sm">На этом устройстве есть копия правок, которые сервер отклонил. Скачайте её перед очисткой данных браузера. Она может содержать старые версии других записей.</p><Button variant="outline" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "my-diary-recovery.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Скачать копию отклонённых правок</Button></div>}
    </section>
    <InstallApp />
    <IntegrationSettings key={user?.uid ?? "guest"} />
  </section>;
}
