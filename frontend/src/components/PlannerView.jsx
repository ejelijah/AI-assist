import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatDate } from "../lib/studyData.js";

const EMPTY_DRAFT = { title: "", description: "", priority: "medium", dueDate: "" };

export default function PlannerView({ tasks, onTasksChange, onFocusTask }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) =>
      filter === "all" || (filter === "open" ? !task.done : task.done),
    );
    return [...filtered].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (a.dueDate !== b.dueDate) return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      return ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 1)
        - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 1);
    });
  }, [tasks, filter]);
  const remaining = tasks.filter((task) => !task.done).length;

  function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    if (editingId) {
      onTasksChange((current) => current.map((task) =>
        task.id === editingId ? { ...task, ...draft, title } : task,
      ));
      setEditingId(null);
    } else {
      onTasksChange((current) => [{
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        ...draft,
        title,
        done: false,
        createdAt: new Date().toISOString(),
      }, ...current]);
    }
    setDraft(EMPTY_DRAFT);
  }

  function startEditing(task) {
    setDraft({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: task.dueDate || "",
    });
    setEditingId(task.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  return (
    <section className="planner-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMALL STEPS ADD UP</p>
          <h1>Your planner</h1>
          <p className="muted">Keep your assignments and everyday activities moving, one step at a time.</p>
        </div>
        <div className="planner-header-stat"><strong>{remaining}</strong><span>open {remaining === 1 ? "task" : "tasks"}</span></div>
      </div>

      <div className="planner-layout">
        <article className="planner-card task-editor-card">
          <div className="panel-heading">
            <div><p className="eyebrow">{editingId ? "UPDATE YOUR PLAN" : "MAKE A LITTLE PROGRESS"}</p><h2>{editingId ? "Edit activity" : "Add a task"}</h2></div>
            <span className="card-icon lavender"><Plus size={18} /></span>
          </div>
          <form className="task-editor" onSubmit={submit}>
            <label>
              Task or activity
              <input
                autoFocus={Boolean(editingId)}
                maxLength={120}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Draft the introduction to my essay"
                required
                value={draft.title}
              />
            </label>
            <label>
              Notes <span className="optional-label">Optional</span>
              <textarea
                maxLength={500}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="What’s the next small step?"
                rows={3}
                value={draft.description}
              />
            </label>
            <div className="task-editor-row">
              <label>
                Priority
                <select onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} value={draft.priority}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Deadline <span className="optional-label">Optional</span>
                <input onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={draft.dueDate} />
              </label>
            </div>
            <div className="task-editor-actions">
              {editingId && <button className="secondary-button" onClick={cancelEdit} type="button">Cancel</button>}
              <button className="primary-button" disabled={!draft.title.trim()} type="submit">
                {editingId ? <><Check size={15} /> Save changes</> : <><Plus size={15} /> Add to planner</>}
              </button>
            </div>
          </form>
        </article>

        <article className="planner-card task-list-card">
          <div className="panel-heading">
            <div><p className="eyebrow">YOUR NEXT STEPS</p><h2>Tasks and activities</h2></div>
            <span className="task-count-badge">{tasks.length}</span>
          </div>
          <div className="task-filters" role="group" aria-label="Filter tasks">
            {[
              ["all", "All", tasks.length],
              ["open", "To do", tasks.filter((task) => !task.done).length],
              ["done", "Completed", tasks.filter((task) => task.done).length],
            ].map(([value, label, count]) => (
              <button
                aria-pressed={filter === value}
                className={filter === value ? "task-filter active" : "task-filter"}
                key={value}
                onClick={() => setFilter(value)}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>

          {visibleTasks.length === 0 ? (
            <div className="planner-empty">
              <Circle size={23} />
              <h3>{filter === "done" ? "Nothing completed yet" : filter === "open" ? "You’re all caught up" : "Your day is open"}</h3>
              <p>{filter === "all" ? "Add a task or turn an AI suggestion into a next step." : "Your list will update as you make progress."}</p>
            </div>
          ) : (
            <ul className="task-list">
              {visibleTasks.map((task) => (
                <li className={task.done ? "task done" : "task"} key={task.id}>
                  <button
                    aria-label={task.done ? `Mark ${task.title} as not done` : `Complete ${task.title}`}
                    aria-pressed={task.done}
                    className={task.done ? "task-check completed" : "task-check"}
                    onClick={() => onTasksChange((current) => current.map((item) =>
                      item.id === task.id ? { ...item, done: !item.done } : item,
                    ))}
                  >
                    {task.done && <Check size={13} />}
                  </button>
                  <div className="task-copy">
                    <div className="task-title-row"><strong>{task.title}</strong><span className={`priority-pill priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span></div>
                    {task.description && <p>{task.description}</p>}
                    <div className="task-meta">
                      {task.dueDate && <span><CalendarDays size={13} /> {formatDate(task.dueDate, { month: "short", day: "numeric", year: "numeric" })}</span>}
                      {!task.done && <button className="start-focus-link" onClick={() => onFocusTask(task.id)}><Clock3 size={13} /> Focus on this</button>}
                    </div>
                  </div>
                  <div className="task-row-actions">
                    <button aria-label={`Edit ${task.title}`} className="icon-button" onClick={() => startEditing(task)}><Pencil size={15} /></button>
                    <button aria-label={`Delete ${task.title}`} className="icon-button danger-hover" onClick={() => onTasksChange((current) => current.filter((item) => item.id !== task.id))}><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small planner-privacy">Your planner is saved in this browser.</p>
        </article>
      </div>
    </section>
  );
}
