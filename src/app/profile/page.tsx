"use client";

import Link from "next/link";
import { useDrive } from "@/hooks/useDrive";

const statusText = {
  "signed-out": "Не подключено",
  loading: "Загрузка…",
  ready: "Синхронизировано",
  saving: "Сохранение…",
  error: "Ошибка синхронизации",
} as const;

export default function ProfilePage() {
  const { status, error, email, connect, signOut } = useDrive<unknown>();

  const signedIn = status !== "signed-out";

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <nav style={{ marginBottom: 16 }}><Link href="/">← Дневник</Link></nav>
      <h1>Профиль</h1>

      <p><strong>Статус:</strong> {statusText[status]}</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {signedIn ? (
        <>
          <p><strong>Email:</strong> {email ?? "…"}</p>
          <button onClick={signOut}>Выйти</button>
        </>
      ) : (
        <>
          <p>Вы не вошли в Google-аккаунт.</p>
          <button onClick={connect}>Войти через Google</button>
        </>
      )}
    </div>
  );
}