import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createId, dateKey, formatDate, parseDate } from "../lib/studyData.js";

const EMPTY_EVENT = {
  title: "",
  date: dateKey(new Date()),
  time: "09:00",
  duration: "30",
  location: "",
  attendees: "",
  notes: "",
};

function shiftDate(value, days) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function weekStart(value) {
  const date = parseDate(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function MonthGrid({ selectedDate, events, tasks, onSelectDate }) {
  const monthDate = parseDate(selectedDate);
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const today = dateKey(new Date());

  return (
    <div className="month-grid">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="month-weekday" key={day}>{day}</div>)}
      {days.map((date) => {
        const key = dateKey(date);
        const eventCount = events.filter((event) => event.date === key).length;
        const taskCount = tasks.filter((task) => !task.done && task.dueDate === key).length;
        return (
          <button
            aria-pressed={selectedDate === key}
            className={[
              "month-day",
              date.getMonth() === monthDate.getMonth() ? "" : "outside-month",
              today === key ? "today" : "",
              selectedDate === key ? "selected" : "",
            ].filter(Boolean).join(" ")}
            key={key}
            onClick={() => onSelectDate(key)}
          >
            <span>{date.getDate()}</span>
            {(eventCount > 0 || taskCount > 0) && (
              <span className="month-day-markers">
                {eventCount > 0 && <i title={`${eventCount} calendar events`} />}
                {taskCount > 0 && <b title={`${taskCount} task deadlines`} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function CalendarView({ meetings, onMeetingsChange, tasks, onNavigatePlanner }) {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [mode, setMode] = useState("week");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_EVENT);
  const [formError, setFormError] = useState("");

  const weekDates = useMemo(() => {
    const start = weekStart(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return dateKey(date);
    });
  }, [selectedDate]);
  const selectedEvents = meetings
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const selectedTasks = tasks
    .filter((task) => !task.done && task.dueDate === selectedDate)
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 1));
  const title = mode === "month"
    ? parseDate(selectedDate).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : mode === "week"
      ? `${formatDate(weekDates[0], { month: "short", day: "numeric" })} – ${formatDate(weekDates[6], { month: "short", day: "numeric", year: "numeric" })}`
      : formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function movePeriod(direction) {
    if (mode === "day") setSelectedDate((current) => shiftDate(current, direction));
    else if (mode === "week") setSelectedDate((current) => shiftDate(current, direction * 7));
    else {
      const date = parseDate(selectedDate);
      date.setMonth(date.getMonth() + direction);
      setSelectedDate(dateKey(date));
    }
  }

  function openForm(event = null, date = selectedDate) {
    setEditingId(event?.id ?? null);
    setDraft(event ? {
      title: event.title,
      date: event.date,
      time: event.time,
      duration: String(event.duration || 30),
      location: event.location || "",
      attendees: event.attendees || "",
      notes: event.notes || "",
    } : { ...EMPTY_EVENT, date });
    setFormError("");
    setFormOpen(true);
  }

  function saveEvent(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date || !draft.time) {
      setFormError("Add a name, date, and start time.");
      return;
    }
    const next = {
      ...draft,
      id: editingId || createId(),
      title: draft.title.trim(),
      duration: Number(draft.duration),
      location: draft.location.trim(),
      attendees: draft.attendees.trim(),
      notes: draft.notes.trim(),
    };
    onMeetingsChange((current) => editingId
      ? current.map((item) => item.id === editingId ? { ...item, ...next } : item)
      : [...current, next]);
    setSelectedDate(next.date);
    setDraft(EMPTY_EVENT);
    setEditingId(null);
    setFormOpen(false);
  }

  function selectToday() {
    setSelectedDate(dateKey(new Date()));
  }

  function renderDayAgenda(day) {
    const dayEvents = meetings.filter((event) => event.date === day).sort((a, b) => a.time.localeCompare(b.time));
    const dayTasks = tasks.filter((task) => !task.done && task.dueDate === day);
    return (
      <div className="agenda-items">
        {dayEvents.map((event) => (
          <article className="calendar-event" key={event.id}>
            <span className="calendar-event-time">{event.time}<small>{event.duration}m</small></span>
            <span className="event-color-bar" />
            <span className="calendar-event-copy">
              <strong>{event.title}</strong>
              <small>{event.location || (event.duration ? `${event.duration} minute activity` : "Calendar activity")}</small>
              {event.attendees && <small>With {event.attendees}</small>}
              {event.notes && <small>{event.notes}</small>}
            </span>
            <span className="calendar-event-actions">
              <button aria-label={`Edit ${event.title}`} onClick={() => openForm(event)}><Pencil size={14} /></button>
              <button aria-label={`Delete ${event.title}`} onClick={() => onMeetingsChange((current) => current.filter((item) => item.id !== event.id))}><Trash2 size={14} /></button>
            </span>
          </article>
        ))}
        {dayTasks.map((task) => (
          <button className="calendar-task-deadline" key={task.id} onClick={onNavigatePlanner}>
            <span className={`priority-dot priority-${task.priority}`} />
            <span><strong>{task.title}</strong><small>{task.priority} priority · task deadline</small></span>
          </button>
        ))}
        {!dayEvents.length && !dayTasks.length && (
          <div className="calendar-empty-day">
            <CalendarDays size={20} />
            <span>No activities planned for this day.</span>
            <button onClick={() => openForm(null, day)}>Add an activity</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="calendar-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Your calendar</h1>
          <p className="muted">See your activities and deadlines together. Your schedule is yours to review and change.</p>
        </div>
        <button className="primary-button" onClick={() => openForm()}><Plus size={16} /> Add activity</button>
      </div>

      <article className="calendar-shell">
        <div className="calendar-toolbar">
          <div className="calendar-period-controls">
            <div className="period-arrows">
              <button aria-label="Previous period" onClick={() => movePeriod(-1)}><ArrowLeft size={16} /></button>
              <button aria-label="Next period" onClick={() => movePeriod(1)}><ArrowRight size={16} /></button>
            </div>
            <h2>{title}</h2>
            <button className="today-button" onClick={selectToday}>Today</button>
          </div>
          <div className="calendar-view-toggle" role="group" aria-label="Calendar view">
            {["day", "week", "month"].map((item) => (
              <button aria-pressed={mode === item} className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {mode === "month" ? (
          <div className="calendar-month-layout">
            <MonthGrid
              events={meetings}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              tasks={tasks}
            />
            <aside className="selected-day-panel">
              <p className="eyebrow">SELECTED DAY</p>
              <h3>{formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h3>
              {renderDayAgenda(selectedDate)}
              <button className="secondary-button" onClick={() => setMode("day")}>Open day view</button>
            </aside>
          </div>
        ) : mode === "week" ? (
          <div className="week-calendar">
            {weekDates.map((day) => {
              const date = parseDate(day);
              const dayEvents = meetings.filter((event) => event.date === day).sort((a, b) => a.time.localeCompare(b.time));
              const dayTasks = tasks.filter((task) => !task.done && task.dueDate === day);
              return (
                <button
                  aria-pressed={day === selectedDate}
                  className={day === selectedDate ? "week-day selected" : "week-day"}
                  key={day}
                  onClick={() => setSelectedDate(day)}
                >
                  <span>{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <strong>{date.getDate()}</strong>
                  <span className="week-day-dots">
                    {dayEvents.length > 0 && <i />}
                    {dayTasks.length > 0 && <b />}
                  </span>
                  <small>{dayEvents.length + dayTasks.length || "—"} items</small>
                </button>
              );
            })}
          </div>
        ) : null}

        {mode !== "month" && (
          <div className="selected-day-agenda">
            <div className="agenda-heading">
              <div><p className="eyebrow">{mode === "week" ? "DAY AGENDA" : "YOUR DAY"}</p><h3>{formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h3></div>
              <button className="secondary-button" onClick={() => openForm(null, selectedDate)}><Plus size={14} /> Add to this day</button>
            </div>
            {renderDayAgenda(selectedDate)}
          </div>
        )}
      </article>

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section aria-labelledby="event-modal-title" aria-modal="true" className="event-modal" role="dialog">
            <div className="modal-heading">
              <div><p className="eyebrow">{editingId ? "UPDATE YOUR PLAN" : "ADD TO YOUR CALENDAR"}</p><h2 id="event-modal-title">{editingId ? "Edit activity" : "New activity"}</h2></div>
              <button aria-label="Close dialog" className="modal-close" onClick={() => setFormOpen(false)}><X size={17} /></button>
            </div>
            <form className="event-form" onSubmit={saveEvent}>
              <label>Activity name<input autoFocus maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Class, appointment, or study session" required value={draft.title} /></label>
              <div className="task-editor-row">
                <label>Date<input onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required type="date" value={draft.date} /></label>
                <label>Start time<input onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} required type="time" value={draft.time} /></label>
              </div>
              <label>Duration<select onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} value={draft.duration}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
              <label>Location <span className="optional-label">Optional</span><input maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Room or meeting link" value={draft.location} /></label>
              <label>People involved <span className="optional-label">Optional</span><input maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, attendees: event.target.value }))} placeholder="Names or email addresses" value={draft.attendees} /></label>
              <label>Notes <span className="optional-label">Optional</span><textarea maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} value={draft.notes} /></label>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <div className="modal-actions"><button className="secondary-button" onClick={() => setFormOpen(false)} type="button">Cancel</button><button className="primary-button" type="submit">{editingId ? "Save changes" : "Save activity"}</button></div>
              <p className="modal-disclaimer"><MapPin size={12} /> Saved only in this browser; no invitations are sent.</p>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
