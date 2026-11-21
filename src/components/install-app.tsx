"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type InstallNavigator = Navigator & { install?: () => Promise<void> };
const subscribe = () => () => {};

export function InstallApp() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const modernInstall = useSyncExternalStore(subscribe, () => !window.matchMedia("(display-mode: standalone)").matches && typeof (navigator as InstallNavigator).install === "function", () => false);
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const capture = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPrompt; setAvailable(true); };
    const installed = () => { prompt.current = null; setAvailable(false); setFinished(true); setMessage("Приложение установлено."); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installed); };
  }, []);
  async function install() {
    if (busy) return;
    setBusy(true);
    try {
      const browser = navigator as InstallNavigator;
      if (browser.install) {
        await browser.install();
        setMessage("Приложение установлено или открыто.");
        setAvailable(false);
        setFinished(true);
      } else if (prompt.current) {
        const event = prompt.current;
        prompt.current = null;
        setAvailable(false);
        await event.prompt();
        const choice = await event.userChoice;
        setMessage(choice.outcome === "accepted" ? "Установка подтверждена." : "Установка отменена.");
      }
    } catch { setMessage("Установка не завершена. Приложение по-прежнему доступно в браузере."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t pt-6"><h2 className="text-xl font-semibold">На всех устройствах</h2><p className="max-w-prose text-sm text-muted-foreground">Открывайте один и тот же адрес на телефоне, ПК и ноутбуке. Войдите в один Google-аккаунт для синхронизации. Если браузер поддерживает установку, приложение можно добавить на главный экран через его меню.</p>{!finished && (available || modernInstall) && <Button aria-disabled={busy} onClick={install}>{busy ? "Ожидаем подтверждение…" : "Установить приложение"}</Button>}{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
