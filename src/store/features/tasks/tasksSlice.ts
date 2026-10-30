import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { db } from "@/lib/firebase"; // путь к твоему firebase.ts
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface TasksState {
  items: Task[];
  loading: boolean;
  error: string | null;
}

const initialState: TasksState = {
  items: [],
  loading: false,
  error: null,
};

// Загрузка задач в реальном времени через onSnapshot
export const fetchTasks = createAsyncThunk(
  "tasks/fetchTasks",
  async (_, { dispatch }) => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    // onSnapshot возвращает функцию отписки, но для простоты мы просто слушаем
    // В компоненте нужно будет отписываться, но для примера оставим так
    onSnapshot(q, (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      dispatch(setTasks(tasks));
    });
  }
);

// Добавление задачи в Firestore
export const addTaskToFirestore = createAsyncThunk(
  "tasks/addTaskToFirestore",
  async (title: string) => {
    const docRef = await addDoc(collection(db, "tasks"), {
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, title, completed: false, createdAt: new Date().toISOString() };
  }
);

// Переключение статуса в Firestore
export const toggleTaskInFirestore = createAsyncThunk(
  "tasks/toggleTaskInFirestore",
  async ({ id, completed }: { id: string; completed: boolean }) => {
    const taskRef = doc(db, "tasks", id);
    await updateDoc(taskRef, { completed: !completed });
    return { id, completed: !completed };
  }
);

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.items = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTasks.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Ошибка загрузки";
      })
      .addCase(addTaskToFirestore.fulfilled, (state, action) => {
        // onSnapshot сам обновит список, но можно и здесь добавить для мгновенного отклика
        // state.items.unshift(action.payload);
      })
      .addCase(toggleTaskInFirestore.fulfilled, (state, action) => {
        const task = state.items.find((t) => t.id === action.payload.id);
        if (task) task.completed = action.payload.completed;
      });
  },
});

export const { setTasks } = tasksSlice.actions;
export default tasksSlice.reducer;