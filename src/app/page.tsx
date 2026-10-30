

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {

  const session = await auth()

  if (!session) redirect("/profile");

  return (
      <div>
        <h1>Главная страница</h1>
      </div>
  );
}
