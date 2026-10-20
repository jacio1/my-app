"use client";

import { cn } from "@/lib/utils";
import { Home, ListTodo, NotebookPen, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "Главная",
    icon: Home,
  },
  {
    href: "/tasks",
    label: "Задачи",
    icon: ListTodo,
  },
  {
    href: "/diary",
    label: "Дневник",
    icon: NotebookPen,
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: UserCircle,
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="shrink w-full border-t bg-background md:hidden pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4 ">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-white" : "text-muted-foreground",
                )}
              >
                <Icon className="h-8 w-8" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
