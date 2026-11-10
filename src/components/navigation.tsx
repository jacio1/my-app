"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, ListTodo, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/tasks", label: "Задачи", icon: ListTodo },
  { href: "/notes", label: "Заметки", icon: NotebookPen },
  { href: "/diary", label: "Дневник", icon: BookOpen },
];

export function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы" className={mobile
      ? "shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      : "hidden w-48 shrink-0 border-r bg-sidebar p-3 md:block"}>
      <ul className={mobile ? "grid grid-cols-4" : "space-y-1"}>
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} aria-current={pathname === href ? "page" : undefined} className={cn(
              "flex items-center gap-2 rounded-md px-2 py-3 font-medium hover:bg-muted",
              mobile && "flex-col text-xs",
              pathname === href ? "bg-muted text-foreground" : "text-muted-foreground",
            )}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
