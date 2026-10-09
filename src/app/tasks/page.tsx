"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import clsx from "clsx";
import { ChangeEvent, SubmitEvent, useState } from "react";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const addTask = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        title: title,
        completed: false,
        createdAt: formattedDate,
      },
    ]);
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    addTask();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleDelete = (id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  };

  const handleComplete = (taskId: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    );
  };

  return (
    <div className="container mx-auto pt-16">
      <h1>Страница задач</h1>
      <div className=" m-5 bg-secondary rounded-2xl p-4">
        <form onSubmit={handleSubmit} className="flex gap-4 flex-col">
          <label htmlFor="">Название задачи</label>
          <Input
            value={title}
            onChange={handleChange}
            placeholder="Введите название задачи..."
          />
          <Button type="submit">Добавить задачу</Button>
        </form>
        <div className="mt-8">
          <h1 className="mb-4">Количество задач: {tasks.length}</h1>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={clsx(
                  "flex items-center gap-4 rounded-2xl h-16",
                  task.completed ? "bg-card line-through" : "bg-black",
                )}
              >
                <label
                  className={clsx(
                    "flex items-center gap-4 w-full h-full cursor-pointer px-4",
                  )}
                  onClick={() => handleComplete(task.id)}
                >
                  <Checkbox
                    className="rounded-xl bg-accent"
                    checked={task.completed}
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
