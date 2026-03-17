import { randomUUID } from "crypto";
import { storeGet, storeSet } from "./store";

export interface ItemUpdate {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface ProblemAction {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  assignedTo: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
  updates?: ItemUpdate[];
}

export interface ProjectItem {
  id: string;
  title: string;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  severity?: "high" | "medium" | "low";
  status?: "pending" | "in_progress" | "done";
  assignedTo?: string | null;
  actions?: ProblemAction[];   // nested actions — only used on problem items
  createdBy: string;
  createdAt: string;
  updates?: ItemUpdate[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  tasks: ProjectItem[];
  problems: ProjectItem[];
  actions: ProjectItem[];      // kept for data compatibility, no longer shown in UI
  createdBy: string;
  createdAt: string;
}

export interface ProjectsDB {
  projects: Project[];
}

type Section = "tasks" | "problems" | "actions";

function now() {
  return new Date().toISOString();
}

export async function getDB(): Promise<ProjectsDB> {
  let db = await storeGet<ProjectsDB>("projects");

  if (!db) {
    db = { projects: [] };
    await storeSet("projects", db);
    return db;
  }

  // Backfill: ensure all items have required arrays
  for (const p of db.projects) {
    for (const task of p.tasks)    { if (!task.updates)   task.updates = []; }
    for (const prob of p.problems) {
      if (!prob.actions) prob.actions = [];
      if (!prob.updates) prob.updates = [];
      for (const act of prob.actions) { if (!act.updates) act.updates = []; }
    }
  }
  return db;
}

export async function saveDB(db: ProjectsDB): Promise<void> {
  await storeSet("projects", db);
}

export function createProject(
  db: ProjectsDB,
  name: string,
  description: string,
  createdBy: string
): ProjectsDB {
  db.projects.push({
    id: randomUUID(),
    name,
    description,
    tasks: [],
    problems: [],
    actions: [],
    createdBy,
    createdAt: now(),
  });
  return db;
}

export function deleteProject(db: ProjectsDB, id: string): ProjectsDB {
  db.projects = db.projects.filter((p) => p.id !== id);
  return db;
}

// ── Top-level items (tasks / problems) ───────────────────────────────────────

export function addItem(
  db: ProjectsDB,
  projectId: string,
  section: Section,
  data: { title: string; severity?: string; assignedTo?: string | null },
  createdBy: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;

  const item: ProjectItem = {
    id: randomUUID(),
    title: data.title,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy,
    createdAt: now(),
  };

  if (section === "tasks") {
    item.status = "pending";
    item.assignedTo = data.assignedTo ?? null;
  }
  if (section === "problems") {
    item.severity = (data.severity as ProjectItem["severity"]) ?? "medium";
    item.actions = [];
  }

  project[section].push(item);
  return db;
}

export function toggleItem(
  db: ProjectsDB,
  projectId: string,
  section: Section,
  itemId: string,
  userName: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (!item) return db;

  item.done = !item.done;
  item.doneBy = item.done ? userName : null;
  item.doneAt = item.done ? now() : null;
  if (section === "tasks") {
    item.status = item.done ? "done" : "pending";
  }
  return db;
}

export function updateItemStatus(
  db: ProjectsDB,
  projectId: string,
  section: Section,
  itemId: string,
  value: string,
  field?: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (!item) return db;

  if (field === "assignedTo") {
    item.assignedTo = value || null;
  } else if (section === "tasks") {
    item.status = value as ProjectItem["status"];
    item.done = value === "done";
  } else if (section === "problems") {
    item.severity = value as ProjectItem["severity"];
  }
  return db;
}

export function updateItemTitle(
  db: ProjectsDB,
  projectId: string,
  section: Section,
  itemId: string,
  title: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (item) item.title = title;
  return db;
}

export function deleteItem(
  db: ProjectsDB,
  projectId: string,
  section: Section,
  itemId: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  project[section] = project[section].filter((i) => i.id !== itemId);
  return db;
}

// ── Nested problem actions ────────────────────────────────────────────────────

function findProblem(db: ProjectsDB, projectId: string, problemId: string) {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const problem = project.problems.find((p) => p.id === problemId);
  if (!problem) return null;
  if (!problem.actions) problem.actions = [];
  return problem;
}

export function addProblemAction(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  data: { title: string; assignedTo?: string | null },
  createdBy: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;

  problem.actions!.push({
    id: randomUUID(),
    title: data.title,
    status: "pending",
    assignedTo: data.assignedTo ?? null,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy,
    createdAt: now(),
  });
  return db;
}

export function toggleProblemAction(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string,
  userName: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  const action = problem.actions!.find((a) => a.id === actionId);
  if (!action) return db;

  action.done = !action.done;
  action.doneBy = action.done ? userName : null;
  action.doneAt = action.done ? now() : null;
  action.status = action.done ? "done" : "pending";
  return db;
}

export function updateProblemAction(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string,
  value: string,
  field: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  const action = problem.actions!.find((a) => a.id === actionId);
  if (!action) return db;

  if (field === "assignedTo") {
    action.assignedTo = value || null;
  } else if (field === "status") {
    action.status = value as ProblemAction["status"];
    action.done = value === "done";
  } else if (field === "title") {
    action.title = value;
  }
  return db;
}

export function deleteProblemAction(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  problem.actions = problem.actions!.filter((a) => a.id !== actionId);
  return db;
}

// ── Update logs ───────────────────────────────────────────────────────────────

export function addItemUpdate(
  db: ProjectsDB,
  projectId: string,
  section: "tasks" | "problems" | "actions",
  itemId: string,
  text: string,
  author: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (!item) return db;
  if (!item.updates) item.updates = [];
  item.updates.push({ id: randomUUID(), text, author, createdAt: now() });
  return db;
}

export function addProblemActionUpdate(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string,
  text: string,
  author: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  const action = problem.actions!.find((a) => a.id === actionId);
  if (!action) return db;
  if (!action.updates) action.updates = [];
  action.updates.push({ id: randomUUID(), text, author, createdAt: now() });
  return db;
}

export function editItemUpdate(
  db: ProjectsDB,
  projectId: string,
  section: "tasks" | "problems" | "actions",
  itemId: string,
  updateId: string,
  text: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (!item?.updates) return db;
  const upd = item.updates.find((u) => u.id === updateId);
  if (upd) upd.text = text;
  return db;
}

export function editProblemActionUpdate(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string,
  updateId: string,
  text: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  const action = problem.actions!.find((a) => a.id === actionId);
  if (!action?.updates) return db;
  const upd = action.updates.find((u) => u.id === updateId);
  if (upd) upd.text = text;
  return db;
}

export function deleteItemUpdate(
  db: ProjectsDB,
  projectId: string,
  section: "tasks" | "problems" | "actions",
  itemId: string,
  updateId: string
): ProjectsDB {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return db;
  const item = project[section].find((i) => i.id === itemId);
  if (!item?.updates) return db;
  item.updates = item.updates.filter((u) => u.id !== updateId);
  return db;
}

export function deleteProblemActionUpdate(
  db: ProjectsDB,
  projectId: string,
  problemId: string,
  actionId: string,
  updateId: string
): ProjectsDB {
  const problem = findProblem(db, projectId, problemId);
  if (!problem) return db;
  const action = problem.actions!.find((a) => a.id === actionId);
  if (!action?.updates) return db;
  action.updates = action.updates.filter((u) => u.id !== updateId);
  return db;
}
