import { randomUUID } from "crypto";
import { storeGet, storeSet } from "./store";

export interface TaskUpdate {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  category: "morning" | "custom";
  isFixed: boolean;
  assignedTo: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string | null;
  date: string;
  updates?: TaskUpdate[];
}

export interface TasksDB {
  date: string;
  tasks: Task[];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export async function getDB(): Promise<TasksDB> {
  const today = getToday();
  let db = await storeGet<TasksDB>("tasks");

  if (!db) {
    db = { date: today, tasks: [] };
  }

  // Backfill fields for tasks created before these fields existed
  for (const t of db.tasks) {
    if (t.assignedTo === undefined) t.assignedTo = null;
    if (!t.updates) t.updates = [];
  }

  // Remove legacy hardcoded EOD tasks
  db.tasks = db.tasks.filter((t) => (t as unknown as { category: string }).category !== "eod");

  if (db.date !== today) {
    // Morning tasks: keep them, just reset done status
    const resetMorning = db.tasks
      .filter((t) => t.category === "morning")
      .map((t) => ({ ...t, done: false, doneBy: null, doneAt: null, date: today }));

    // Custom tasks: carry over only incomplete ones
    const carryCustom = db.tasks
      .filter((t) => t.category === "custom" && !t.done)
      .map((t) => ({ ...t, date: today }));

    db = { date: today, tasks: [...resetMorning, ...carryCustom] };
  }

  await storeSet("tasks", db);
  return db;
}

export async function saveDB(db: TasksDB): Promise<void> {
  await storeSet("tasks", db);
}

export function toggleTask(db: TasksDB, id: string, userName: string): TasksDB {
  const task = db.tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    task.doneBy = task.done ? userName : null;
    task.doneAt = task.done ? new Date().toISOString() : null;
  }
  return db;
}

export function addTask(
  db: TasksDB,
  title: string,
  createdBy: string,
  assignedTo: string | null = null
): TasksDB {
  db.tasks.push({
    id: randomUUID(),
    title,
    category: "custom",
    isFixed: false,
    assignedTo,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy,
    date: db.date,
    updates: [],
  });
  return db;
}

export function addMorningTask(
  db: TasksDB,
  title: string,
  assignedTo: string | null = null
): TasksDB {
  db.tasks.push({
    id: randomUUID(),
    title,
    category: "morning",
    isFixed: false,
    assignedTo,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy: null,
    date: db.date,
    updates: [],
  });
  return db;
}

export function deleteTask(db: TasksDB, id: string): TasksDB {
  db.tasks = db.tasks.filter((t) => t.id !== id);
  return db;
}

export function assignTask(
  db: TasksDB,
  id: string,
  assignedTo: string | null
): TasksDB {
  const task = db.tasks.find((t) => t.id === id);
  if (task) task.assignedTo = assignedTo;
  return db;
}

export function addTaskUpdate(
  db: TasksDB,
  id: string,
  text: string,
  author: string
): TasksDB {
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return db;
  if (!task.updates) task.updates = [];
  task.updates.push({ id: randomUUID(), text, author, createdAt: new Date().toISOString() });
  return db;
}

export function editTaskUpdate(
  db: TasksDB,
  id: string,
  updateId: string,
  text: string
): TasksDB {
  const task = db.tasks.find((t) => t.id === id);
  if (!task?.updates) return db;
  const upd = task.updates.find((u) => u.id === updateId);
  if (upd) upd.text = text;
  return db;
}

export function deleteTaskUpdate(
  db: TasksDB,
  id: string,
  updateId: string
): TasksDB {
  const task = db.tasks.find((t) => t.id === id);
  if (!task?.updates) return db;
  task.updates = task.updates.filter((u) => u.id !== updateId);
  return db;
}
