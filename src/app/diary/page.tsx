"use client";

import { useDriveData } from "@/hooks/useDriveData";

type Day = { id: number; title: string; description: string };

const initial: Day[] = [
  { id: 1, title: "Day 1", description: "Description for Day 1" },
  { id: 2, title: "Day 2", description: "Description for Day 2" },
];

const statusText = {
  "signed-out": "Не подключено к Google Диску",
  loading: "Загрузка…",
  ready: "Синхронизировано",
  saving: "Сохранение…",
  error: "Ошибка синхронизации",
} as const;

export default function App() {
  const { data, setData, status, error, connect, signOut } =
    useDriveData<Day[]>("days-cache", initial);

  const addDay = () =>
    setData((prev) => {
      const id = prev.length ? Math.max(...prev.map((d) => d.id)) + 1 : 1;
      return [...prev, { id, title: `Day ${id}`, description: "" }];
    });

  const updateDescription = (id: number, description: string) =>
    setData((prev) =>
      prev.map((d) => (d.id === id ? { ...d, description } : d))
    );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <p>
        {statusText[status]}{" "}
        {status === "signed-out" ? (
          <button onClick={connect}>Войти через Google</button>
        ) : (
          <button onClick={signOut}>Выйти</button>
        )}
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

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

      <button onClick={addDay}>Добавить день</button>{" "}
      <button onClick={exportJson}>Экспорт JSON</button>
    </div>
  );
}