"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addTaskToFirestore,
  toggleTaskInFirestore,
  fetchTasks,
} from "@/store/features/tasks/tasksSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import clsx from "clsx";
import { useState, useEffect } from "react";

export default function TasksPage() {
  const [title, setTitle] = useState("");
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const dispatch = useAppDispatch();

  // Запускаем слушатель Firestore при монтировании
  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    await dispatch(addTaskToFirestore(title));
    setTitle("");
  };

  const handleToggle = async (id: string, completed: boolean) => {
    await dispatch(toggleTaskInFirestore({ id, completed }));
  };

  if (loading) return <div className="container mx-auto pt-16">Загрузка...</div>;

  return (
    <div className="container mx-auto pt-16">
      <h1>Страница задач</h1>
      <div className="m-5 bg-secondary rounded-2xl p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Введите название задачи..."
          autoComplete="off"
        />
        <Button onClick={handleAdd}>Добавить задачу</Button>
        <div className="mt-8">
          <h1 className="mb-4">Количество задач: {tasks.length}</h1>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={clsx(
                  "flex items-center gap-4 rounded-2xl h-16",
                  task.completed ? "bg-card line-through" : "bg-black"
                )}
              >
                <label className="flex items-center gap-4 w-full h-full cursor-pointer px-4">
                  <Checkbox
                    className="rounded-xl bg-accent"
                    checked={task.completed}
                    onCheckedChange={() => handleToggle(task.id, task.completed)}
                  />
                  <h1>{task.title}</h1>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}