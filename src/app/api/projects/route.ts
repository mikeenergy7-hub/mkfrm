import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getDB,
  saveDB,
  createProject,
  deleteProject,
  addItem,
  toggleItem,
  updateItemStatus,
  updateItemTitle,
  deleteItem,
  addProblemAction,
  toggleProblemAction,
  updateProblemAction,
  deleteProblemAction,
  addItemUpdate,
  addProblemActionUpdate,
  editItemUpdate,
  editProblemActionUpdate,
  deleteItemUpdate,
  deleteProblemActionUpdate,
} from "@/lib/projects-db";

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

  switch (body.action) {
    // ── Projects ──────────────────────────────────────────────────────────────
    case "create_project":
      db = createProject(db, body.name, body.description ?? "", userName);
      break;
    case "delete_project":
      db = deleteProject(db, body.projectId);
      break;

    // ── Top-level items (tasks / problems) ────────────────────────────────────
    case "add_item":
      db = addItem(db, body.projectId, body.section, body.data, userName);
      break;
    case "toggle_item":
      db = toggleItem(db, body.projectId, body.section, body.itemId, userName);
      break;
    case "update_status":
      db = updateItemStatus(db, body.projectId, body.section, body.itemId, body.status, body.field);
      break;
    case "update_title":
      db = updateItemTitle(db, body.projectId, body.section, body.itemId, body.title ?? "");
      break;
    case "delete_item":
      db = deleteItem(db, body.projectId, body.section, body.itemId);
      break;

    // ── Nested problem actions ────────────────────────────────────────────────
    case "add_problem_action":
      db = addProblemAction(db, body.projectId, body.problemId, body.data, userName);
      break;
    case "toggle_problem_action":
      db = toggleProblemAction(db, body.projectId, body.problemId, body.actionId, userName);
      break;
    case "update_problem_action":
      db = updateProblemAction(db, body.projectId, body.problemId, body.actionId, body.value, body.field);
      break;
    case "delete_problem_action":
      db = deleteProblemAction(db, body.projectId, body.problemId, body.actionId);
      break;

    // ── Update logs ───────────────────────────────────────────────────────────
    case "add_item_update":
      db = addItemUpdate(db, body.projectId, body.section, body.itemId, body.text ?? "", userName);
      break;
    case "add_problem_action_update":
      db = addProblemActionUpdate(db, body.projectId, body.problemId, body.actionId, body.text ?? "", userName);
      break;
    case "edit_item_update":
      db = editItemUpdate(db, body.projectId, body.section, body.itemId, body.updateId, body.text ?? "");
      break;
    case "edit_problem_action_update":
      db = editProblemActionUpdate(db, body.projectId, body.problemId, body.actionId, body.updateId, body.text ?? "");
      break;
    case "delete_item_update":
      db = deleteItemUpdate(db, body.projectId, body.section, body.itemId, body.updateId);
      break;
    case "delete_problem_action_update":
      db = deleteProblemActionUpdate(db, body.projectId, body.problemId, body.actionId, body.updateId);
      break;
  }

  await saveDB(db);
  return NextResponse.json(db);
}
