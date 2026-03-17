"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const P = {
  bg:          "#0d0d0c",
  surface:     "#131312",
  surface2:    "#191918",
  surface3:    "#202020",
  line:        "rgba(255,255,255,0.06)",
  lineStrong:  "rgba(255,255,255,0.11)",
  text:        "#f0ebe0",
  text2:       "#8c8780",
  text3:       "#4a4845",
  amber:       "#d4a843",
  amberDim:    "rgba(212,168,67,0.08)",
  amberLine:   "rgba(212,168,67,0.2)",
  green:       "#3ecf7a",
  greenDim:    "rgba(62,207,122,0.08)",
  red:         "#e86565",
  redDim:      "rgba(232,101,101,0.08)",
  blue:        "#6ba3d4",
  blueDim:     "rgba(107,163,212,0.08)",
  purple:      "#b07fd4",
  purpleDim:   "rgba(176,127,212,0.08)",
};

const TEAM = ["Mehrad", "Trader1", "Trader2", "Analyst", "Joe", "Gestler"];

const SEVERITY = {
  high:   { label: "HIGH",   color: P.red,    dim: P.redDim    },
  medium: { label: "MED",    color: P.amber,  dim: P.amberDim  },
  low:    { label: "LOW",    color: P.blue,   dim: P.blueDim   },
};

const STATUS = {
  pending:     { label: "PENDING",  color: P.text3  },
  in_progress: { label: "IN PROG",  color: P.amber  },
  done:        { label: "DONE",     color: P.green  },
};

// ── Shared input styles ───────────────────────────────────────────────────────
const inputSt = {
  background:  P.surface2,
  border:      `1px solid ${P.lineStrong}`,
  borderRadius: 6,
  padding:     "8px 11px",
  color:       P.text,
  fontSize:    13,
  outline:     "none",
  boxSizing:   "border-box",
  width:       "100%",
};

const selectSt = {
  background:  P.surface2,
  border:      `1px solid ${P.lineStrong}`,
  borderRadius: 6,
  padding:     "8px 10px",
  color:       P.text2,
  fontSize:    12,
  outline:     "none",
  cursor:      "pointer",
  flexShrink:  0,
};

// ── Root component ────────────────────────────────────────────────────────────
export default function TasksManager({ user }) {
  const [projects,     setProjects]     = useState([]);
  const [dailyTasks,   setDailyTasks]   = useState([]);
  const [dailyDate,    setDailyDate]    = useState("");
  const [selectedId,   setSelectedId]   = useState("daily");
  const [loading,      setLoading]      = useState(true);
  const [lastSync,     setLastSync]     = useState(null);
  const [showNewForm,  setShowNewForm]  = useState(false);
  const [newName,      setNewName]      = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [creating,     setCreating]     = useState(false);

  const fetchAll = useCallback(async () => {
    const [projRes, dailyRes] = await Promise.all([fetch("/api/projects"), fetch("/api/tasks")]);
    if (projRes.ok)  { const d = await projRes.json();  setProjects(d.projects); }
    if (dailyRes.ok) { const d = await dailyRes.json(); setDailyTasks(d.tasks); setDailyDate(d.date); }
    setLastSync(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  async function projApiCall(body) {
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const d = await res.json(); setProjects(d.projects); return d; }
  }

  async function dailyApiCall(body) {
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const d = await res.json(); setDailyTasks(d.tasks); setDailyDate(d.date); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const data = await projApiCall({ action: "create_project", name: newName.trim(), description: newDesc.trim() });
    if (data?.projects?.length) setSelectedId(data.projects[data.projects.length - 1].id);
    setNewName(""); setNewDesc(""); setShowNewForm(false); setCreating(false);
  }

  async function handleDeleteProject(id) {
    if (!confirm("Delete this project and all its data?")) return;
    await projApiCall({ action: "delete_project", projectId: id });
    if (selectedId === id) setSelectedId("daily");
  }

  // Progress
  const allDailyItems = [
    ...dailyTasks,
    ...projects.flatMap((p) => [
      ...p.tasks,
      ...p.problems.flatMap((prob) => prob.actions ?? []),
    ]),
  ];
  const dailyDone  = allDailyItems.filter((i) => i.done || i.status === "done").length;
  const dailyTotal = allDailyItems.length;
  const dailyPct   = dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 100) : 0;
  const selected   = projects.find((p) => p.id === selectedId) ?? null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 48px)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: P.text3, textTransform: "uppercase" }}>Loading</div>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 12 }}>
            {[0,1,2].map((i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: P.amber, opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 48px)", background: P.bg }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside style={{
        width: 248,
        flexShrink: 0,
        background: P.bg,
        borderRight: `1px solid ${P.line}`,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>

        {/* Progress panel */}
        <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${P.line}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: P.amber, textTransform: "uppercase", marginBottom: 12 }}>
            Today's Brief
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
            <span style={{ fontSize: 38, fontWeight: 900, color: dailyPct === 100 ? P.green : P.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {dailyDone}
            </span>
            <span style={{ fontSize: 16, color: P.text3, fontWeight: 400 }}>
              /{dailyTotal}
            </span>
          </div>
          <div style={{ fontSize: 10, color: P.text3, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            {dailyPct === 100 && dailyTotal > 0 ? "All Clear ✓" : "Tasks Remaining"}
          </div>
          {/* Progress bar */}
          <div style={{ height: 2, background: P.line, borderRadius: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${dailyPct}%`, background: dailyPct === 100 ? P.green : P.amber, borderRadius: 1, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
          </div>
        </div>

        {/* User + sync row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.line}` }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: P.amberDim, border: `1px solid ${P.amberLine}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: P.amber, flexShrink: 0 }}>
            {user?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: P.text2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</span>
          <button onClick={fetchAll} title="Refresh" style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>↻</button>
          <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 10, letterSpacing: "0.06em", padding: 0 }}>
            OUT
          </button>
        </div>

        {/* Daily entry */}
        <div style={{ padding: "10px 12px 0" }}>
          <button
            onClick={() => setSelectedId("daily")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              background: selectedId === "daily" ? P.amberDim : "transparent",
              borderLeft: `2px solid ${selectedId === "daily" ? P.amber : "transparent"}`,
              border: "none",
              borderLeft: `2px solid ${selectedId === "daily" ? P.amber : "transparent"}`,
              cursor: "pointer",
              textAlign: "left",
              borderRadius: "0 6px 6px 0",
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: 11, color: selectedId === "daily" ? P.amber : P.text3 }}>◈</span>
            <span style={{ fontSize: 12, fontWeight: selectedId === "daily" ? 700 : 500, color: selectedId === "daily" ? P.text : P.text2, letterSpacing: "0.02em" }}>
              Daily Checklist
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: dailyPct === 100 ? P.green : P.text3, fontVariantNumeric: "tabular-nums" }}>
              {dailyDone}/{dailyTotal}
            </span>
          </button>
        </div>

        {/* Divider + Projects label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 8px" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: P.text3, textTransform: "uppercase", whiteSpace: "nowrap" }}>Projects</span>
          <div style={{ flex: 1, height: 1, background: P.line }} />
          <button
            onClick={() => setShowNewForm((v) => !v)}
            title="New project"
            style={{ background: "transparent", border: "none", color: showNewForm ? P.amber : P.text3, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            +
          </button>
        </div>

        {/* New project form */}
        {showNewForm && (
          <form onSubmit={handleCreate} style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name" required autoFocus
              style={{ ...inputSt, fontSize: 12, padding: "7px 10px" }}
            />
            <input
              value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              style={{ ...inputSt, fontSize: 12, padding: "7px 10px" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" disabled={creating || !newName.trim()} style={{
                flex: 1, background: P.amberDim, border: `1px solid ${P.amberLine}`, color: P.amber,
                borderRadius: 6, padding: "7px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: creating || !newName.trim() ? 0.4 : 1,
              }}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ background: "transparent", border: `1px solid ${P.line}`, color: P.text3, borderRadius: 6, padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </form>
        )}

        {/* Project list */}
        <div style={{ flex: 1, padding: "0 12px 20px" }}>
          {projects.length === 0 && !showNewForm && (
            <div style={{ fontSize: 11, color: P.text3, padding: "8px 10px", fontStyle: "italic" }}>No projects yet.</div>
          )}
          {projects.map((p) => {
            const problemActions = p.problems.flatMap((prob) => prob.actions ?? []);
            const openCount  = p.tasks.filter((t) => !t.done).length + p.problems.filter((t) => !t.done).length + problemActions.filter((a) => !a.done).length;
            const totalCount = p.tasks.length + p.problems.length + problemActions.length;
            const isActive   = p.id === selectedId;
            const allDone    = totalCount > 0 && openCount === 0;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  marginBottom: 1,
                  background: isActive ? P.surface2 : "transparent",
                  borderLeft: `2px solid ${isActive ? P.amber : "transparent"}`,
                  borderRadius: "0 6px 6px 0",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? P.text : P.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  {totalCount > 0 && (
                    <div style={{ fontSize: 10, color: allDone ? P.green : P.text3, marginTop: 2 }}>
                      {allDone ? "All done" : `${openCount} open`}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                  style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 14, padding: "2px", flexShrink: 0, lineHeight: 1, opacity: 0.5 }}
                  title="Delete project"
                >×</button>
              </div>
            );
          })}
        </div>

        {/* Bottom sync info */}
        {lastSync && (
          <div style={{ padding: "10px 20px", borderTop: `1px solid ${P.line}`, fontSize: 9, color: P.text3, letterSpacing: "0.06em" }}>
            SYNCED {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: "auto", background: P.bg }}>
        {selectedId === "daily" ? (
          <DailyView
            date={dailyDate}
            morningTasks={dailyTasks.filter((t) => t.category === "morning")}
            adHocTasks={dailyTasks.filter((t) => t.category === "custom")}
            projects={projects}
            onDailyAction={dailyApiCall}
            onProjectAction={projApiCall}
          />
        ) : selected ? (
          <ProjectDetail key={selected.id} project={selected} onAction={projApiCall} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: P.text3, letterSpacing: "0.12em", textTransform: "uppercase" }}>Select a project</div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Daily Checklist view ──────────────────────────────────────────────────────
function DailyView({ date, morningTasks, adHocTasks, projects, onDailyAction, onProjectAction }) {
  const [newTitle,        setNewTitle]        = useState("");
  const [newAssign,       setNewAssign]       = useState("");
  const [adding,          setAdding]          = useState(false);
  const [newMorningTitle, setNewMorningTitle] = useState("");
  const [newMorningAssign,setNewMorningAssign]= useState("");
  const [addingMorning,   setAddingMorning]   = useState(false);

  const allProjectTasks   = projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id })));
  const allProjectActions = projects.flatMap((p) =>
    p.problems.flatMap((prob) =>
      (prob.actions ?? []).map((a) => ({ ...a, projectId: p.id, problemId: prob.id }))
    )
  );
  const allItems = [...morningTasks, ...allProjectTasks, ...allProjectActions, ...adHocTasks];
  const done     = allItems.filter((i) => i.done || i.status === "done").length;
  const total    = allItems.length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = pct === 100 && total > 0;

  const dateLabel = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  async function handleAddMorning(e) {
    e.preventDefault();
    if (!newMorningTitle.trim()) return;
    setAddingMorning(true);
    await onDailyAction({ action: "add_morning", title: newMorningTitle.trim(), assignedTo: newMorningAssign || null });
    setNewMorningTitle(""); setNewMorningAssign(""); setAddingMorning(false);
  }

  async function handleAddAdhoc(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    await onDailyAction({ action: "add", title: newTitle.trim(), assignedTo: newAssign || null });
    setNewTitle(""); setNewAssign(""); setAdding(false);
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 40px 60px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: P.text3, textTransform: "uppercase", marginBottom: 6 }}>
          Daily Checklist
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: P.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {dateLabel}
          </h1>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: complete ? P.green : P.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {pct}
            </span>
            <span style={{ fontSize: 13, color: P.text3 }}>%</span>
            <span style={{ fontSize: 12, color: P.text3, marginLeft: 4 }}>{done}/{total} done</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 2, background: P.line, borderRadius: 1, marginTop: 14, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: complete ? P.green : P.amber, borderRadius: 1, transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
        </div>
      </div>

      {/* ── Morning Checklist ── */}
      <DailyBlock title="Morning Checklist" accent={P.amber} done={morningTasks.filter(t => t.done).length} total={morningTasks.length}>
        {morningTasks.length === 0 && (
          <EmptyNote>No items yet — add your first morning task below.</EmptyNote>
        )}
        {morningTasks.map((t) => (
          <LedgerRow key={t.id} item={t}
            onToggle={() => onDailyAction({ action: "toggle", id: t.id })}
            onAssign={(v) => onDailyAction({ action: "assign", id: t.id, assignedTo: v })}
            onDelete={() => onDailyAction({ action: "delete", id: t.id })}
            onAddUpdate={(text) => onDailyAction({ action: "add_task_update", id: t.id, text })}
            onEditUpdate={(updateId, text) => onDailyAction({ action: "edit_task_update", id: t.id, updateId, text })}
            onDeleteUpdate={(updateId) => onDailyAction({ action: "delete_task_update", id: t.id, updateId })}
          />
        ))}
        <AddRowForm onSubmit={handleAddMorning} adding={addingMorning} accent={P.amber}
          title={newMorningTitle} setTitle={setNewMorningTitle}
          assign={newMorningAssign} setAssign={setNewMorningAssign}
          placeholder="Add morning item…"
        />
      </DailyBlock>

      {/* ── Project Tasks ── */}
      <DailyBlock title="Project Tasks" accent={P.blue} done={allProjectTasks.filter(t => t.done).length} total={allProjectTasks.length} empty="No project tasks yet. Open a project and add tasks.">
        {projects.filter((p) => p.tasks.length > 0).map((p) => (
          <DailyProjectCard key={p.id} name={p.name} accent={P.blue}
            done={p.tasks.filter(t => t.done).length} total={p.tasks.length}>
            {p.tasks.map((t) => (
              <LedgerRow key={t.id} item={t}
                onToggle={() => onProjectAction({ action: "toggle_item", projectId: p.id, section: "tasks", itemId: t.id })}
                onAssign={(v) => onProjectAction({ action: "update_status", projectId: p.id, section: "tasks", itemId: t.id, status: v, field: "assignedTo" })}
                onDelete={() => onProjectAction({ action: "delete_item", projectId: p.id, section: "tasks", itemId: t.id })}
                onAddUpdate={(text) => onProjectAction({ action: "add_item_update", projectId: p.id, section: "tasks", itemId: t.id, text })}
                onEditUpdate={(updateId, text) => onProjectAction({ action: "edit_item_update", projectId: p.id, section: "tasks", itemId: t.id, updateId, text })}
                onDeleteUpdate={(updateId) => onProjectAction({ action: "delete_item_update", projectId: p.id, section: "tasks", itemId: t.id, updateId })}
              />
            ))}
          </DailyProjectCard>
        ))}
      </DailyBlock>

      {/* ── Project Actions ── */}
      <DailyBlock title="Project Actions" accent={P.green} done={allProjectActions.filter(a => a.done).length} total={allProjectActions.length} empty="No problem actions yet. Add problems to projects, then add actions.">
        {projects.filter((p) => p.problems.length > 0).map((p) => (
          <DailyProjectCard key={p.id} name={p.name} accent={P.green}
            done={allProjectActions.filter(a => a.projectId === p.id && a.done).length}
            total={(p.problems.flatMap((prob) => prob.actions ?? [])).length}>
            {p.problems.map((prob) => (
              <DailyProblemCard key={prob.id} problem={prob} projectId={p.id} onAction={onProjectAction} />
            ))}
          </DailyProjectCard>
        ))}
      </DailyBlock>

      {/* ── Ad-hoc Tasks ── */}
      <DailyBlock title="Ad-hoc Tasks" accent={P.purple} done={adHocTasks.filter(t => t.done).length} total={adHocTasks.length}>
        {adHocTasks.length === 0 && (
          <EmptyNote>No ad-hoc tasks yet.</EmptyNote>
        )}
        {adHocTasks.map((t) => (
          <LedgerRow key={t.id} item={t}
            onToggle={() => onDailyAction({ action: "toggle", id: t.id })}
            onAssign={(v) => onDailyAction({ action: "assign", id: t.id, assignedTo: v })}
            onDelete={() => onDailyAction({ action: "delete", id: t.id })}
            onAddUpdate={(text) => onDailyAction({ action: "add_task_update", id: t.id, text })}
            onEditUpdate={(updateId, text) => onDailyAction({ action: "edit_task_update", id: t.id, updateId, text })}
            onDeleteUpdate={(updateId) => onDailyAction({ action: "delete_task_update", id: t.id, updateId })}
          />
        ))}
        <AddRowForm onSubmit={handleAddAdhoc} adding={adding} accent={P.purple}
          title={newTitle} setTitle={setNewTitle}
          assign={newAssign} setAssign={setNewAssign}
          placeholder="Add an ad-hoc task…"
        />
      </DailyBlock>
    </div>
  );
}

// ── Daily block (section wrapper) ─────────────────────────────────────────────
function DailyBlock({ title, accent, done, total, children, empty }) {
  const [collapsed, setCollapsed] = useState(false);
  const allDone = total > 0 && done === total;

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {/* Accent bar */}
        <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: P.text2, letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</span>
        </button>
        <span style={{ fontSize: 11, color: allDone ? P.green : P.text3, fontVariantNumeric: "tabular-nums" }}>
          {allDone ? "✓ All done" : `${done}/${total}`}
        </span>
        <div style={{ flex: 1, height: 1, background: P.line }} />
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        total === 0 && empty
          ? <EmptyNote>{empty}</EmptyNote>
          : <div>{children}</div>
      )}
    </div>
  );
}

// ── Per-project collapsible card in daily view ────────────────────────────────
function DailyProjectCard({ name, accent, done, total, children }) {
  const [open, setOpen] = useState(true);
  const allDone = total > 0 && done === total;

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Project label row */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: P.text2, letterSpacing: "0.08em", textTransform: "uppercase", flex: 1 }}>{name}</span>
        <span style={{ fontSize: 10, color: allDone ? P.green : P.text3, fontVariantNumeric: "tabular-nums" }}>{done}/{total}</span>
        <span style={{ fontSize: 9, color: P.text3 }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ borderLeft: `1px solid ${P.line}`, marginLeft: 3, paddingLeft: 14, paddingBottom: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Problem card with nested actions in daily view ────────────────────────────
function DailyProblemCard({ problem, projectId, onAction }) {
  const [open,        setOpen]        = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newAssign,   setNewAssign]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const actions  = problem.actions ?? [];
  const sev      = SEVERITY[problem.severity ?? "medium"];
  const doneActs = actions.filter((a) => a.done).length;

  async function handleAdd(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    await onAction({ action: "add_problem_action", projectId, problemId: problem.id, data: { title: newTitle.trim(), assignedTo: newAssign || null } });
    setNewTitle("");
    setNewAssign("");
    setSubmitting(false);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Problem header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0 5px" }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: sev.color, opacity: 0.7, flexShrink: 0 }} />
        <span
          onClick={() => setOpen((v) => !v)}
          style={{ fontSize: 12, color: problem.done ? P.text3 : P.text2, textDecoration: problem.done ? "line-through" : "none", flex: 1, cursor: "pointer", fontWeight: 500 }}
        >
          {problem.title}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: sev.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{sev.label}</span>
        <span style={{ fontSize: 10, color: P.text3 }}>{doneActs}/{actions.length}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setShowAdd((v) => !v); setOpen(true); }}
          style={{ background: "transparent", border: `1px solid ${P.green}44`, color: P.green, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
        >
          + ACT
        </button>
      </div>

      {open && (
        <div style={{ paddingLeft: 16 }}>
          {actions.length === 0 && !showAdd && (
            <div style={{ fontSize: 11, color: P.text3, fontStyle: "italic", padding: "2px 0 6px" }}>No actions.</div>
          )}
          {actions.map((a) => (
            <LedgerActionRow key={a.id} item={a}
              onCycleStatus={() => {
                const order = ["pending", "in_progress", "done"];
                const next  = order[(order.indexOf(a.status ?? "pending") + 1) % order.length];
                onAction({ action: "update_problem_action", projectId, problemId: problem.id, actionId: a.id, value: next, field: "status" });
              }}
              onToggle={() => onAction({ action: "toggle_problem_action", projectId, problemId: problem.id, actionId: a.id })}
              onAssign={(v) => onAction({ action: "update_problem_action", projectId, problemId: problem.id, actionId: a.id, value: v, field: "assignedTo" })}
              onDelete={() => onAction({ action: "delete_problem_action", projectId, problemId: problem.id, actionId: a.id })}
              onAddUpdate={(text) => onAction({ action: "add_problem_action_update", projectId, problemId: problem.id, actionId: a.id, text })}
              onEditUpdate={(updateId, text) => onAction({ action: "edit_problem_action_update", projectId, problemId: problem.id, actionId: a.id, updateId, text })}
              onDeleteUpdate={(updateId) => onAction({ action: "delete_problem_action_update", projectId, problemId: problem.id, actionId: a.id, updateId })}
            />
          ))}

          {showAdd && (
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 6, padding: "6px 0 4px", flexWrap: "wrap" }}>
              <input
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New action…" required autoFocus
                style={{ ...inputSt, flex: "1 1 140px", fontSize: 12, padding: "6px 10px" }}
              />
              <select value={newAssign} onChange={(e) => setNewAssign(e.target.value)} style={{ ...selectSt, fontSize: 11, padding: "6px 8px" }}>
                <option value="">Assign to…</option>
                {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="submit" disabled={submitting || !newTitle.trim()} style={{ background: P.greenDim, border: `1px solid ${P.green}44`, color: P.green, borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: submitting || !newTitle.trim() ? 0.4 : 1 }}>
                {submitting ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setNewTitle(""); setNewAssign(""); }} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 15 }}>×</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ledger row (tasks / morning / ad-hoc) ─────────────────────────────────────
function LedgerRow({ item, onToggle, onAssign, onDelete, onAddUpdate, onEditUpdate, onDeleteUpdate }) {
  const doneTime = item.doneAt
    ? new Date(item.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ borderBottom: `1px solid ${P.line}` }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0 5px" }}>
        <button
          onClick={onToggle}
          style={{
            width: 16, height: 16, borderRadius: 4,
            border: `1.5px solid ${item.done ? P.green : P.text3}`,
            background: item.done ? P.green : "transparent",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: P.bg, fontSize: 9, fontWeight: 900, transition: "all 0.15s",
          }}
        >
          {item.done ? "✓" : ""}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: item.done ? P.text3 : P.text, textDecoration: item.done ? "line-through" : "none", lineHeight: 1.4 }}>
            {item.title}
          </span>
          {item.done && item.doneBy && (
            <span style={{ fontSize: 10, color: P.green, marginLeft: 8 }}>{item.doneBy} · {doneTime}</span>
          )}
        </div>

        <select
          value={item.assignedTo ?? ""}
          onChange={(e) => onAssign(e.target.value || null)}
          style={{
            ...selectSt, fontSize: 11, padding: "3px 6px",
            color: item.assignedTo ? P.amber : P.text3,
            background: item.assignedTo ? P.amberDim : "transparent",
            border: `1px solid ${item.assignedTo ? P.amberLine : "transparent"}`,
            borderRadius: 4, maxWidth: 100,
          }}
        >
          <option value="">—</option>
          {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {onDelete && (
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, opacity: 0.5 }}>×</button>
        )}
      </div>

      {/* Update log */}
      {onAddUpdate && (
        <UpdateLog updates={item.updates ?? []} onAdd={onAddUpdate} onEdit={onEditUpdate} onDelete={onDeleteUpdate} accent={P.amber} />
      )}
    </div>
  );
}

// ── Ledger action row (with status cycling) ───────────────────────────────────
function LedgerActionRow({ item, onToggle, onCycleStatus, onAssign, onDelete, onAddUpdate, onEditUpdate, onDeleteUpdate }) {
  const stat   = STATUS[item.status ?? "pending"];
  const isDone = item.status === "done" || item.done;
  const doneTime = item.doneAt
    ? new Date(item.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ borderBottom: `1px solid ${P.line}` }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 5px" }}>
        <button
          onClick={onToggle}
          style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1.5px solid ${isDone ? P.green : P.text3}`,
            background: isDone ? P.green : "transparent",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: P.bg, fontSize: 8, fontWeight: 900,
          }}
        >
          {isDone ? "✓" : ""}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: isDone ? P.text3 : P.text2, textDecoration: isDone ? "line-through" : "none" }}>
            {item.title}
          </span>
          {isDone && item.doneBy && (
            <span style={{ fontSize: 10, color: P.green, marginLeft: 8 }}>{item.doneBy} · {doneTime}</span>
          )}
        </div>

        <button onClick={onCycleStatus} title="Click to cycle status"
          style={{ background: "transparent", border: "none", color: stat.color, cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: 0, textTransform: "uppercase" }}>
          {stat.label}
        </button>

        <select value={item.assignedTo ?? ""} onChange={(e) => onAssign(e.target.value || null)}
          style={{ ...selectSt, fontSize: 11, padding: "3px 6px", color: item.assignedTo ? P.amber : P.text3, background: item.assignedTo ? P.amberDim : "transparent", border: `1px solid ${item.assignedTo ? P.amberLine : "transparent"}`, borderRadius: 4, maxWidth: 100 }}>
          <option value="">—</option>
          {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {onDelete && (
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, opacity: 0.5 }}>×</button>
        )}
      </div>

      {/* Update log */}
      {onAddUpdate && (
        <UpdateLog updates={item.updates ?? []} onAdd={onAddUpdate} onEdit={onEditUpdate} onDelete={onDeleteUpdate} accent={P.green} />
      )}
    </div>
  );
}

// ── Add row form ──────────────────────────────────────────────────────────────
function AddRowForm({ onSubmit, adding, accent, title, setTitle, assign, setAssign, placeholder }) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, paddingTop: 10, alignItems: "center" }}>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${title ? accent + "88" : P.line}`,
          borderRadius: 0,
          padding: "5px 0",
          color: P.text,
          fontSize: 13,
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
      <select
        value={assign} onChange={(e) => setAssign(e.target.value)}
        style={{ ...selectSt, fontSize: 11, padding: "4px 6px", color: assign ? P.amber : P.text3, background: "transparent", border: "none", maxWidth: 90 }}
      >
        <option value="">Who?</option>
        {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <button
        type="submit"
        disabled={adding || !title.trim()}
        style={{
          background: "transparent",
          border: "none",
          color: title.trim() ? accent : P.text3,
          cursor: title.trim() ? "pointer" : "default",
          fontSize: 18,
          padding: 0,
          lineHeight: 1,
          transition: "color 0.15s",
        }}
        title="Add"
      >
        +
      </button>
    </form>
  );
}

// ── Empty note ────────────────────────────────────────────────────────────────
function EmptyNote({ children }) {
  return (
    <div style={{ fontSize: 12, color: P.text3, fontStyle: "italic", padding: "4px 0 8px" }}>{children}</div>
  );
}

// ── Update log (expandable under any row) ────────────────────────────────────
function UpdateLog({ updates = [], onAdd, onEdit, onDelete, accent = P.text3 }) {
  const [open,      setOpen]      = useState(false);
  const [text,      setText]      = useState("");
  const [saving,    setSaving]    = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText,  setEditText]  = useState("");
  const [editSaving,setEditSaving]= useState(false);

  const latest = updates[updates.length - 1];

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function submitAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim());
    setText("");
    setSaving(false);
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditText(u.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(updateId) {
    if (!editText.trim()) return;
    setEditSaving(true);
    await onEdit(updateId, editText.trim());
    setEditingId(null);
    setEditText("");
    setEditSaving(false);
  }

  return (
    <div style={{ paddingBottom: open ? 8 : 0 }}>
      {/* Toggle row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, color: open ? accent : P.text3, flexShrink: 0 }}
        >
          <span style={{ fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, textTransform: "uppercase" }}>
            {open ? "▾" : "▸"} LOG
          </span>
          {updates.length > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, color: P.bg, background: open ? accent : P.text3, borderRadius: 10, padding: "1px 5px", lineHeight: 1.5 }}>
              {updates.length}
            </span>
          )}
        </button>

        {!open && latest && (
          <span style={{ fontSize: 11, color: P.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontStyle: "italic" }}>
            {latest.text}
          </span>
        )}
      </div>

      {/* Expanded log */}
      {open && (
        <div style={{ marginTop: 8, marginLeft: 12, borderLeft: `2px solid ${P.line}`, paddingLeft: 12 }}>
          {updates.length === 0 && (
            <div style={{ fontSize: 11, color: P.text3, fontStyle: "italic", marginBottom: 8 }}>No updates yet.</div>
          )}

          {updates.map((u) => (
            <div key={u.id} style={{ padding: "6px 0", borderBottom: `1px solid ${P.line}` }}>
              {/* Header row: author · time · edit · delete */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent }}>{u.author}</span>
                <span style={{ fontSize: 9, color: P.text3 }}>{fmtTime(u.createdAt)}</span>
                <div style={{ flex: 1 }} />
                {editingId !== u.id && (
                  <>
                    <button
                      onClick={() => startEdit(u)}
                      style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 9, padding: 0, letterSpacing: "0.08em", opacity: 0.6 }}
                      title="Edit this entry"
                    >
                      edit
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(u.id)}
                        style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 12, padding: "0 0 0 4px", lineHeight: 1, opacity: 0.4 }}
                        title="Delete this entry"
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Body: view or inline edit */}
              {editingId === u.id ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(u.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      background: P.surface2,
                      border: `1px solid ${accent}55`,
                      borderRadius: 5,
                      padding: "5px 9px",
                      color: P.text,
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => saveEdit(u.id)}
                    disabled={editSaving || !editText.trim()}
                    style={{ background: accent + "22", border: `1px solid ${accent}44`, color: accent, borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: editSaving || !editText.trim() ? 0.4 : 1 }}
                  >
                    {editSaving ? "…" : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: P.text2, lineHeight: 1.5 }}>{u.text}</div>
              )}
            </div>
          ))}

          {/* Add update form */}
          <form onSubmit={submitAdd} style={{ display: "flex", gap: 6, paddingTop: 8, alignItems: "center" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add update or result…"
              style={{
                flex: 1, background: "transparent", border: "none",
                borderBottom: `1px solid ${text ? accent + "66" : P.line}`,
                borderRadius: 0, padding: "4px 0", color: P.text, fontSize: 12, outline: "none", transition: "border-color 0.2s",
              }}
            />
            <button
              type="submit"
              disabled={saving || !text.trim()}
              style={{ background: "transparent", border: "none", color: text.trim() ? accent : P.text3, cursor: text.trim() ? "pointer" : "default", fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
              title="Save update"
            >
              {saving ? "…" : "+"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Project Detail ────────────────────────────────────────────────────────────
function ProjectDetail({ project, onAction }) {
  const problemActionsTotal = project.problems.flatMap((p) => p.actions ?? []).length;
  const tasksDone    = project.tasks.filter((t) => t.done).length;
  const problemsDone = project.problems.filter((p) => p.done).length;

  return (
    <div style={{ padding: "36px 40px 60px", maxWidth: 860, margin: "0 auto" }}>
      {/* Project header */}
      <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: `1px solid ${P.line}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: P.text3, textTransform: "uppercase", marginBottom: 8 }}>Project</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900, color: P.text, letterSpacing: "-0.02em" }}>{project.name}</h2>
        {project.description && (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: P.text2, lineHeight: 1.6 }}>{project.description}</p>
        )}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Stat label="Tasks" value={`${tasksDone}/${project.tasks.length}`} color={P.blue} />
          <Stat label="Problems" value={`${problemsDone}/${project.problems.length}`} color={P.red} />
          <Stat label="Actions" value={`${project.problems.flatMap(p => (p.actions ?? []).filter(a => a.done)).length}/${problemActionsTotal}`} color={P.green} />
          <div style={{ fontSize: 11, color: P.text3, alignSelf: "flex-end" }}>by {project.createdBy}</div>
        </div>
      </div>

      {/* Tasks */}
      <ProjSection title="Tasks" section="tasks" items={project.tasks} projectId={project.id} onAction={onAction} />

      {/* Problems with nested actions */}
      <ProblemsSection problems={project.problems} projectId={project.id} onAction={onAction} />
    </div>
  );
}

// ── Small stat display ────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: P.text3, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ── Project section (Tasks) ───────────────────────────────────────────────────
function ProjSection({ title, section, items, projectId, onAction }) {
  const [collapsed,    setCollapsed]   = useState(false);
  const [showAdd,      setShowAdd]     = useState(false);
  const [addTitle,     setAddTitle]    = useState("");
  const [addAssign,    setAddAssign]   = useState("");
  const [addSeverity,  setAddSeverity] = useState("medium");
  const [submitting,   setSubmitting]  = useState(false);

  const accent      = section === "tasks" ? P.blue : section === "problems" ? P.red : P.green;
  const resolved    = items.filter((i) => i.done || i.status === "done").length;
  const placeholder = section === "tasks" ? "Describe the task…" : "Describe the action…";

  async function handleAdd(e) {
    e.preventDefault();
    if (!addTitle.trim()) return;
    setSubmitting(true);
    await onAction({
      action: "add_item", projectId, section,
      data: {
        title: addTitle.trim(),
        ...(section === "problems" && { severity: addSeverity }),
        ...((section === "tasks" || section === "actions") && { assignedTo: addAssign || null }),
      },
    });
    setAddTitle(""); setAddAssign(""); setAddSeverity("medium"); setShowAdd(false); setSubmitting(false);
  }

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${P.line}` }}>
        <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: P.text2, letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</span>
        </button>
        <span style={{ fontSize: 11, color: resolved === items.length && items.length > 0 ? P.green : P.text3, fontVariantNumeric: "tabular-nums" }}>
          {resolved}/{items.length}
        </span>
        <div style={{ flex: 1, height: 1, background: P.line }} />
        <button
          onClick={() => { setShowAdd((v) => !v); setCollapsed(false); }}
          style={{ background: "transparent", border: `1px solid ${accent}44`, color: accent, borderRadius: 5, padding: "3px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.06em" }}
        >
          + Add
        </button>
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 10, padding: 0 }}>
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          {showAdd && (
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder={placeholder} required autoFocus style={{ ...inputSt, flex: "1 1 200px" }} />
              {(section === "tasks" || section === "actions") && (
                <select value={addAssign} onChange={(e) => setAddAssign(e.target.value)} style={{ ...selectSt, flex: "0 0 130px" }}>
                  <option value="">Assign to…</option>
                  {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <button type="submit" disabled={submitting || !addTitle.trim()} style={{ background: accent + "18", border: `1px solid ${accent}44`, color: accent, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: submitting || !addTitle.trim() ? 0.4 : 1 }}>
                {submitting ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </form>
          )}

          {items.length === 0 && !showAdd && <EmptyNote>No {title.toLowerCase()} yet.</EmptyNote>}

          <div>
            {items.map((item) => (
              <ProjItemRow key={item.id} item={item} section={section} projectId={projectId} onAction={onAction} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Project item row ──────────────────────────────────────────────────────────
function ProjItemRow({ item, section, projectId, onAction }) {
  const [editing,   setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);

  const isDone      = item.done || item.status === "done";
  const doneTime    = item.doneAt ? new Date(item.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const stat        = section === "tasks" ? STATUS[item.status ?? "pending"] : null;
  const hasAssignee = section === "tasks";

  async function cycleStatus() {
    const order = ["pending", "in_progress", "done"];
    const next  = order[(order.indexOf(item.status ?? "pending") + 1) % order.length];
    await onAction({ action: "update_status", projectId, section, itemId: item.id, status: next });
  }

  async function saveTitle() {
    const t = editTitle.trim();
    if (t && t !== item.title) await onAction({ action: "update_title", projectId, section, itemId: item.id, title: t });
    else setEditTitle(item.title);
    setEditing(false);
  }

  return (
    <div style={{ borderBottom: `1px solid ${P.line}` }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0 5px" }}>
        <button
          onClick={() => onAction({ action: "toggle_item", projectId, section, itemId: item.id })}
          style={{
            width: 16, height: 16, borderRadius: 4,
            border: `1.5px solid ${isDone ? P.green : P.text3}`,
            background: isDone ? P.green : "transparent",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: P.bg, fontSize: 9, fontWeight: 900, transition: "all 0.15s",
          }}
        >
          {isDone ? "✓" : ""}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditTitle(item.title); setEditing(false); } }}
              autoFocus style={{ ...inputSt, fontSize: 13, padding: "3px 8px" }}
            />
          ) : (
            <span onClick={() => { setEditing(true); setEditTitle(item.title); }} title="Click to edit"
              style={{ fontSize: 13, color: isDone ? P.text3 : P.text, textDecoration: isDone ? "line-through" : "none", cursor: "text" }}>
              {item.title}
            </span>
          )}
          {isDone && item.doneBy && (
            <span style={{ fontSize: 10, color: P.green, marginLeft: 8 }}>{item.doneBy} · {doneTime}</span>
          )}
          {!isDone && item.createdBy && !editing && (
            <span style={{ fontSize: 10, color: P.text3, marginLeft: 8 }}>by {item.createdBy}</span>
          )}
        </div>

        {stat && (
          <button onClick={cycleStatus} title="Click to cycle status" style={{ background: "transparent", border: "none", color: stat.color, cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: 0, textTransform: "uppercase" }}>
            {stat.label}
          </button>
        )}

        {hasAssignee && (
          <select value={item.assignedTo ?? ""} onChange={(e) => onAction({ action: "update_status", projectId, section, itemId: item.id, status: e.target.value, field: "assignedTo" })}
            style={{ ...selectSt, fontSize: 11, padding: "3px 6px", color: item.assignedTo ? P.amber : P.text3, background: item.assignedTo ? P.amberDim : "transparent", border: `1px solid ${item.assignedTo ? P.amberLine : "transparent"}`, borderRadius: 4, maxWidth: 100 }}>
            <option value="">—</option>
            {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <button onClick={() => onAction({ action: "delete_item", projectId, section, itemId: item.id })} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, opacity: 0.5 }}>×</button>
      </div>

      {/* Update log */}
      <UpdateLog
        updates={item.updates ?? []}
        onAdd={(text) => onAction({ action: "add_item_update", projectId, section, itemId: item.id, text })}
        onEdit={(updateId, text) => onAction({ action: "edit_item_update", projectId, section, itemId: item.id, updateId, text })}
        onDelete={(updateId) => onAction({ action: "delete_item_update", projectId, section, itemId: item.id, updateId })}
        accent={P.blue}
      />
    </div>
  );
}

// ── Problems section with nested actions ──────────────────────────────────────
function ProblemsSection({ problems, projectId, onAction }) {
  const [collapsed,   setCollapsed]   = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [addTitle,    setAddTitle]    = useState("");
  const [addSev,      setAddSev]      = useState("medium");
  const [submitting,  setSubmitting]  = useState(false);

  const resolved = problems.filter((p) => p.done).length;

  async function handleAdd(e) {
    e.preventDefault();
    if (!addTitle.trim()) return;
    setSubmitting(true);
    await onAction({ action: "add_item", projectId, section: "problems", data: { title: addTitle.trim(), severity: addSev } });
    setAddTitle(""); setAddSev("medium"); setShowAdd(false); setSubmitting(false);
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${P.line}` }}>
        <div style={{ width: 3, height: 14, background: P.red, borderRadius: 2, flexShrink: 0 }} />
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: P.text2, letterSpacing: "0.14em", textTransform: "uppercase" }}>Problems</span>
        </button>
        <span style={{ fontSize: 11, color: resolved === problems.length && problems.length > 0 ? P.green : P.text3, fontVariantNumeric: "tabular-nums" }}>
          {resolved}/{problems.length}
        </span>
        <div style={{ flex: 1, height: 1, background: P.line }} />
        <button onClick={() => { setShowAdd((v) => !v); setCollapsed(false); }} style={{ background: "transparent", border: `1px solid ${P.red}44`, color: P.red, borderRadius: 5, padding: "3px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          + Add
        </button>
        <button onClick={() => setCollapsed((v) => !v)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 10, padding: 0 }}>
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          {showAdd && (
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Describe the problem…" required autoFocus style={{ ...inputSt, flex: "1 1 200px" }} />
              <select value={addSev} onChange={(e) => setAddSev(e.target.value)} style={selectSt}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button type="submit" disabled={submitting || !addTitle.trim()} style={{ background: P.redDim, border: `1px solid ${P.red}44`, color: P.red, borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: submitting || !addTitle.trim() ? 0.4 : 1 }}>
                {submitting ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </form>
          )}

          {problems.length === 0 && !showAdd && <EmptyNote>No problems logged yet.</EmptyNote>}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {problems.map((prob) => (
              <ProblemItemRow key={prob.id} problem={prob} projectId={projectId} onAction={onAction} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Problem item row with nested actions ──────────────────────────────────────
function ProblemItemRow({ problem, projectId, onAction }) {
  const [editing,        setEditing]        = useState(false);
  const [editTitle,      setEditTitle]      = useState(problem.title);
  const [showActions,    setShowActions]    = useState(true);
  const [showAddAction,  setShowAddAction]  = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionAssign,setNewActionAssign]= useState("");
  const [addingAction,   setAddingAction]   = useState(false);

  const sev      = SEVERITY[problem.severity ?? "medium"];
  const actions  = problem.actions ?? [];
  const doneActs = actions.filter((a) => a.done).length;

  async function saveProblemTitle() {
    const t = editTitle.trim();
    if (t && t !== problem.title) await onAction({ action: "update_title", projectId, section: "problems", itemId: problem.id, title: t });
    else setEditTitle(problem.title);
    setEditing(false);
  }

  async function cycleSeverity() {
    const order = ["low", "medium", "high"];
    const next  = order[(order.indexOf(problem.severity ?? "medium") + 1) % order.length];
    await onAction({ action: "update_status", projectId, section: "problems", itemId: problem.id, status: next });
  }

  async function addAction(e) {
    e.preventDefault();
    if (!newActionTitle.trim()) return;
    setAddingAction(true);
    await onAction({ action: "add_problem_action", projectId, problemId: problem.id, data: { title: newActionTitle.trim(), assignedTo: newActionAssign || null } });
    setNewActionTitle(""); setNewActionAssign(""); setShowAddAction(false); setAddingAction(false);
  }

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${problem.done ? P.line : P.lineStrong}` }}>
      {/* Problem header */}
      <div style={{ display: "flex", alignItems: "flex-start", background: problem.done ? P.surface : P.surface2, padding: "12px 14px", gap: 10 }}>
        <button
          onClick={() => onAction({ action: "toggle_item", projectId, section: "problems", itemId: problem.id })}
          style={{
            width: 16, height: 16, borderRadius: 4, marginTop: 2,
            border: `1.5px solid ${problem.done ? P.green : P.red}`,
            background: problem.done ? P.green : "transparent",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: P.bg, fontSize: 9, fontWeight: 900,
          }}
        >
          {problem.done ? "✓" : ""}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={saveProblemTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveProblemTitle(); if (e.key === "Escape") { setEditTitle(problem.title); setEditing(false); } }}
              autoFocus style={{ ...inputSt, fontSize: 13, padding: "2px 8px" }}
            />
          ) : (
            <div onClick={() => { setEditing(true); setEditTitle(problem.title); }} title="Click to edit"
              style={{ fontSize: 13, color: problem.done ? P.text3 : P.text, textDecoration: problem.done ? "line-through" : "none", cursor: "text" }}>
              {problem.title}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={cycleSeverity} title="Click to change severity"
              style={{ background: sev.dim, border: `1px solid ${sev.color}44`, color: sev.color, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>
              {sev.label}
            </button>
            {problem.done && problem.doneBy && (
              <span style={{ fontSize: 10, color: P.green }}>{problem.doneBy} · {new Date(problem.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            {!problem.done && problem.createdBy && (
              <span style={{ fontSize: 10, color: P.text3 }}>by {problem.createdBy}</span>
            )}
            <button onClick={() => setShowActions((v) => !v)}
              style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 10, padding: 0, letterSpacing: "0.06em" }}>
              {showActions ? "▾" : "▸"} Actions {doneActs}/{actions.length}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
          <button onClick={() => { setShowAddAction((v) => !v); setShowActions(true); }}
            style={{ background: "transparent", border: `1px solid ${P.green}44`, color: P.green, borderRadius: 4, padding: "3px 9px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
            + Action
          </button>
          <button onClick={() => onAction({ action: "delete_item", projectId, section: "problems", itemId: problem.id })}
            style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 15, padding: "0 2px", lineHeight: 1, opacity: 0.5 }}>×</button>
        </div>
      </div>

      {/* Nested actions */}
      {showActions && (actions.length > 0 || showAddAction) && (
        <div style={{ background: P.surface, borderTop: `1px solid ${P.line}`, padding: "8px 14px 10px 40px" }}>
          <div>
            {actions.map((a) => (
              <NestedActionRow key={a.id} action={a} projectId={projectId} problemId={problem.id} onAction={onAction} />
            ))}
          </div>

          {showAddAction && (
            <form onSubmit={addAction} style={{ display: "flex", gap: 8, paddingTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder="Describe the action…" required autoFocus style={{ ...inputSt, flex: "1 1 160px", fontSize: 12, padding: "7px 10px" }} />
              <select value={newActionAssign} onChange={(e) => setNewActionAssign(e.target.value)} style={{ ...selectSt, fontSize: 12, flex: "0 0 120px" }}>
                <option value="">Assign to…</option>
                {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="submit" disabled={addingAction || !newActionTitle.trim()} style={{ background: P.greenDim, border: `1px solid ${P.green}44`, color: P.green, borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: addingAction || !newActionTitle.trim() ? 0.4 : 1 }}>
                {addingAction ? "…" : "Add"}
              </button>
              <button type="button" onClick={() => setShowAddAction(false)} style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 15 }}>×</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Nested action row (inside project problem) ────────────────────────────────
function NestedActionRow({ action, projectId, problemId, onAction }) {
  const [editing,   setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(action.title);
  const stat     = STATUS[action.status ?? "pending"];
  const doneTime = action.doneAt ? new Date(action.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  async function saveTitle() {
    const t = editTitle.trim();
    if (t && t !== action.title) await onAction({ action: "update_problem_action", projectId, problemId, actionId: action.id, value: t, field: "title" });
    else setEditTitle(action.title);
    setEditing(false);
  }

  async function cycleStatus() {
    const order = ["pending", "in_progress", "done"];
    const next  = order[(order.indexOf(action.status ?? "pending") + 1) % order.length];
    await onAction({ action: "update_problem_action", projectId, problemId, actionId: action.id, value: next, field: "status" });
  }

  return (
    <div style={{ borderBottom: `1px solid ${P.line}` }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0 4px" }}>
        <button
          onClick={() => onAction({ action: "toggle_problem_action", projectId, problemId, actionId: action.id })}
          style={{
            width: 14, height: 14, borderRadius: 3,
            border: `1.5px solid ${action.done ? P.green : P.text3}`,
            background: action.done ? P.green : "transparent",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: P.bg, fontSize: 8, fontWeight: 900,
          }}
        >
          {action.done ? "✓" : ""}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditTitle(action.title); setEditing(false); } }}
              autoFocus style={{ ...inputSt, fontSize: 12, padding: "2px 7px" }}
            />
          ) : (
            <span onClick={() => { setEditing(true); setEditTitle(action.title); }} title="Click to edit"
              style={{ fontSize: 12, color: action.done ? P.text3 : P.text2, textDecoration: action.done ? "line-through" : "none", cursor: "text" }}>
              {action.title}
            </span>
          )}
          {action.done && action.doneBy && (
            <span style={{ fontSize: 10, color: P.green, marginLeft: 8 }}>{action.doneBy} · {doneTime}</span>
          )}
        </div>

        <button onClick={cycleStatus} title="Click to cycle status"
          style={{ background: "transparent", border: "none", color: stat.color, cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: 0, textTransform: "uppercase" }}>
          {stat.label}
        </button>

        <select value={action.assignedTo ?? ""} onChange={(e) => onAction({ action: "update_problem_action", projectId, problemId, actionId: action.id, value: e.target.value, field: "assignedTo" })}
          style={{ ...selectSt, fontSize: 11, padding: "3px 6px", color: action.assignedTo ? P.amber : P.text3, background: action.assignedTo ? P.amberDim : "transparent", border: `1px solid ${action.assignedTo ? P.amberLine : "transparent"}`, borderRadius: 4, maxWidth: 100 }}>
          <option value="">—</option>
          {TEAM.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <button onClick={() => onAction({ action: "delete_problem_action", projectId, problemId, actionId: action.id })}
          style={{ background: "transparent", border: "none", color: P.text3, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, opacity: 0.5 }}>×</button>
      </div>

      {/* Update log */}
      <UpdateLog
        updates={action.updates ?? []}
        onAdd={(text) => onAction({ action: "add_problem_action_update", projectId, problemId, actionId: action.id, text })}
        onEdit={(updateId, text) => onAction({ action: "edit_problem_action_update", projectId, problemId, actionId: action.id, updateId, text })}
        onDelete={(updateId) => onAction({ action: "delete_problem_action_update", projectId, problemId, actionId: action.id, updateId })}
        accent={P.green}
      />
    </div>
  );
}
