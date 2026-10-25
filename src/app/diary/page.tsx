// app/page.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useDrive } from "@/hooks/useDrive";

type Day = { id: number; title: string; description: string };

export default function DiaryPage() {
  const { data, setData, status, hydrate } = useDrive<Day[]>();

  // Гидратация из localStorage — на случай, если пользователь
  // открыл сразу главную, минуя профиль.
  useEffect(() => { hydrate(); }, []);

  const addDay = () =>
    setData((prev) => {
      const id = prev.length ? Math.max(...prev.map((d) => d.id)) + 1 : 1;
      return [...prev, { id, title: `Day ${id}`, description: "" }];
    });

  const updateDescription = (id: number, description: string) =>
    setData((prev) => prev.map((d) => (d.id === id ? { ...d, description } : d)));

  // Пока данные не подгрузились из кэша/Диска — показываем загрузку
  if (!data) return <p>Загрузка…</p>;

  // Данных нет и пользователь не авторизован — предлагаем зайти в профиль
  if (data.length === 0 && status === "signed-out") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
        <nav style={{ marginBottom: 16 }}><Link href="/profile">Профиль</Link></nav>
        <p>
          Чтобы вести дневник, войдите через Google на странице{" "}
          <Link href="/profile">профиля</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <nav style={{ marginBottom: 16 }}><Link href="/profile">Профиль</Link></nav>

      <ul>
        {data.map((day) => (
          <li key={day.id}>
            <h2>{day.title}</h2>
            <textarea
              value={day.description}
              onChange={(e) => updateDescription(day.id, e.target.value)}
              style={{ width: "100%" }}
            />
          </li>
        ))}
      </ul>
      <button onClick={addDay}>Добавить день</button>
    </div>
  );
}