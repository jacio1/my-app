"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDrive } from "@/hooks/useDrive";
import { driveFileUrl } from "@/lib/drive";
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE, clientIdProblem, truncate } from "@/lib/google-config";
import { cn } from "@/lib/utils";
import type { DriveStatus } from "@/lib/types";

const STATUS_LABEL: Record<DriveStatus, string> = {
  "signed-out": "Не подключено",
  loading: "Подключение…",
  ready: "Синхронизировано",
  saving: "Сохранение…",
  error: "Ошибка синхронизации",
};

const STATUS_COLOR: Record<DriveStatus, string> = {
  "signed-out": "text-muted-foreground",
  loading: "text-amber-400",
  ready: "text-emerald-400",
  saving: "text-amber-400",
  error: "text-destructive",
};

export default function ProfilePage() {
  const { profile, status, error, fileId, lastSyncedAt, sessionActive, connect, syncNow, signOut } =
    useDrive();

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => null,
  );

  const configProblem = clientIdProblem();
  const knownAccount = Boolean(profile?.email);
  const sessionExpired = knownAccount && !sessionActive;
  const busy = status === "loading" || status === "saving";

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <nav className="text-sm text-muted-foreground">
        <Link href="/diary" className="hover:text-foreground">
          ← Дневник
        </Link>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <p className="text-sm text-muted-foreground">
          Данные дневника хранятся в файле <code>diary.json</code> на твоём Google Диске.
        </p>
      </header>

      {configProblem && (
        <section className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-300">Вход пока невозможен: не настроен OAuth</p>
          <p>{configProblem}</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Google Cloud Console → APIs &amp; Services → OAuth consent screen: создай проект и
              заполни экран согласия (тип <strong>External</strong>, режим <strong>Testing</strong>).
            </li>
            <li>Включи <strong>Google Drive API</strong> в библиотеке API.</li>
            <li>
              Credentials → Create credentials → OAuth client ID → тип <strong>Web application</strong>.
            </li>
            <li>
              В «Authorized JavaScript origins» добавь{" "}
              <code>{origin ?? "http://localhost:1001"}</code>.
            </li>
            <li>
              Скопируй Client ID в <code>.env</code> как{" "}
              <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> и перезапусти <code>npm run dev</code>.
            </li>
          </ol>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
        {knownAccount ? (
          <div className="flex items-center gap-3">
            {profile?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- аватар с домена Google, next/image тут избыточен
              <img
                src={profile.picture}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-full border border-border"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid size-12 place-items-center rounded-full border border-border text-lg">
                {(profile?.name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{profile?.name ?? "Google-аккаунт"}</p>
              <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            <span
              className={cn(
                "ml-auto shrink-0 rounded-full border px-3 py-1 text-xs",
                sessionActive
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300",
              )}
            >
              {sessionActive ? "Вы вошли" : "Нужно войти снова"}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">Вы не вошли в Google-аккаунт</p>
            <p className="text-sm text-muted-foreground">
              Нажмите кнопку ниже — откроется окно Google, где нужно разрешить доступ к файлам
              приложения на Диске.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Статус</dt>
          <dd className={cn("text-right", STATUS_COLOR[status])}>{STATUS_LABEL[status]}</dd>

          <dt className="text-muted-foreground">Файл на Диске</dt>
          <dd className="text-right">
            {fileId ? (
              <a
                href={driveFileUrl(fileId)}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4"
              >
                diary.json
              </a>
            ) : (
              "ещё не создан"
            )}
          </dd>

          <dt className="text-muted-foreground">Последняя синхронизация</dt>
          <dd className="text-right">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString("ru-RU") : "—"}
          </dd>
        </dl>

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {sessionActive ? (
            <Button variant="outline" onClick={() => void syncNow()} disabled={busy}>
              Синхронизировать
            </Button>
          ) : (
            <Button onClick={() => void connect()} disabled={busy || Boolean(configProblem)}>
              {status === "loading" ? "Подключение…" : sessionExpired ? "Войти снова" : "Войти через Google"}
            </Button>
          )}

          {knownAccount && (
            <Button variant="destructive" onClick={() => void signOut()} disabled={busy}>
              Выйти
            </Button>
          )}
        </div>

        {sessionExpired && !error && (
          <p className="text-xs text-muted-foreground">
            Аккаунт сохранён на этом устройстве, но доступ к Диску истёк (токен живёт около часа).
          </p>
        )}
      </section>

      <details className="rounded-2xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Диагностика (для отладки)</summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Client ID</dt>
          <dd className="break-all font-mono text-xs">
            {GOOGLE_CLIENT_ID ? truncate(GOOGLE_CLIENT_ID) : "— не задан —"}
          </dd>

          <dt className="text-muted-foreground">Origin страницы</dt>
          <dd className="break-all font-mono text-xs">{origin ?? "—"}</dd>

          <dt className="text-muted-foreground">Scopes</dt>
          <dd className="break-all font-mono text-xs">{GOOGLE_SCOPE}</dd>

          <dt className="text-muted-foreground">fileId</dt>
          <dd className="break-all font-mono text-xs">{fileId ?? "—"}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Origin из этой строки должен быть указан в «Authorized JavaScript origins» OAuth-клиента,
          иначе Google вернёт ошибку <code>invalid_client</code> / <code>origin_mismatch</code>.
        </p>
      </details>
    </div>
  );
}
