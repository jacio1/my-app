import {
  Sidebar,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <Link href="/">
        <SidebarMenuButton>Главная</SidebarMenuButton>
      </Link>
      <Link href="/tasks">
        <SidebarMenuButton>Страница задач</SidebarMenuButton>
      </Link>
    </Sidebar>
  );
}
