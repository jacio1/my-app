import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface TasksState {
  items: Task[];
}

const initialState: TasksState = {
  items: [],
};

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    addTask: (state, action: PayloadAction<string>) => {
      state.items.push({
        id: crypto.randomUUID(),
        title: action.payload,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    },
    toggleTask: (state, action: PayloadAction<string>) => {
      const task = state.items.find((task) => task.id === action.payload);
      if (task) task.completed = !task.completed;
    },
    removeTask: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((task) => task.id !== action.payload);
    },
  },
});

export const { addTask, toggleTask, removeTask } = tasksSlice.actions;
export default tasksSlice.reducer;
