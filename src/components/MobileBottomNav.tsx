"use client";

import { cn } from "@/lib/utils";
import { Home, ListTodo } from "lucide-react";
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
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);


          return (
            <li key={item.href}>
              <Link href={item.href} className={cn(
              'flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors border-b-2', isActive ? 'text-sidebar-primary' : 'text-muted-foreground'
              )}>
              <Icon className="h-8 w-8" />
              <span>
                {item.label}
              </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
