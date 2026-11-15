"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, ListTodo, NotebookPen, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/tasks", label: "Задачи", icon: ListTodo },
  { href: "/notes", label: "Заметки", icon: NotebookPen },
  { href: "/diary", label: "Дневник", icon: BookOpen },
  { href: "/profile", label: "Профиль", icon: UserCircle },
];

export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы" className={mobile
      ? "shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      : "hidden w-60 shrink-0 border-r bg-sidebar p-5 md:flex md:flex-col"}>
      {!mobile && <div className="px-2 pb-8 pt-3"><p className="text-xl font-semibold tracking-tight">Мой дневник<span className="text-primary">.</span></p><p className="mt-1 text-xs text-muted-foreground">Меньше суеты. Больше ясности.</p></div>}
      <ul className={mobile ? "grid grid-cols-4" : "space-y-1"}>
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} aria-current={pathname === href ? "page" : undefined} className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-3 font-medium hover:bg-muted",
              mobile && "flex-col text-xs",
              pathname === href ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      {!mobile && <p className="mt-auto px-2 pt-8 text-xs leading-relaxed text-muted-foreground">Ваше личное пространство.<br />Данные сохраняются в этом браузере.</p>}
    </nav>
  );
}
