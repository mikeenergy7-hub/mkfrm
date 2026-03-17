import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getDB, saveDB, toggleTask, addTask, addMorningTask, deleteTask, assignTask, addTaskUpdate, editTaskUpdate, deleteTaskUpdate } from "@/lib/tasks-db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getDB());
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  let db = await getDB();
  const userName = session.user?.name ?? "Unknown";

  if (body.action === "toggle") {
    db = toggleTask(db, body.id, userName);
  } else if (body.action === "add" && body.title?.trim()) {
    db = addTask(db, body.title.trim(), userName, body.assignedTo ?? null);
  } else if (body.action === "add_morning" && body.title?.trim()) {
    db = addMorningTask(db, body.title.trim(), body.assignedTo ?? null);
  } else if (body.action === "delete") {
    db = deleteTask(db, body.id);
  } else if (body.action === "assign") {
    db = assignTask(db, body.id, body.assignedTo ?? null);
  } else if (body.action === "add_task_update" && body.text?.trim()) {
    db = addTaskUpdate(db, body.id, body.text.trim(), userName);
  } else if (body.action === "edit_task_update" && body.text?.trim()) {
    db = editTaskUpdate(db, body.id, body.updateId, body.text.trim());
  } else if (body.action === "delete_task_update") {
    db = deleteTaskUpdate(db, body.id, body.updateId);
  }

  await saveDB(db);
  return NextResponse.json(db);
}
