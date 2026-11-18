import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListTodo,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { dateKey, formatDate } from "../lib/studyData.js";

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function QuickAction({ icon: Icon, label, description, tone, onClick, disabled = false }) {
  return (
    <button className={`quick-action ${tone}`} disabled={disabled} onClick={onClick}>
      <span className="quick-action-icon"><Icon size={19} strokeWidth={1.8} /></span>
      <span className="quick-action-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <ArrowRight className="quick-action-arrow" size={16} />
    </button>
  );
}

export default function DashboardView({
  tasks,
  meetings,
  demoMode,
  onToggleDemo,
  onResetDemo,
  onNavigate,
  onPlanDay,
  planLoading,
  onQuickAsk,
}) {
  const [question, setQuestion] = useState("");
  const today = dateKey(new Date());
  const todayEvents = meetings
    .filter((event) => event.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const todayTasks = tasks.filter((task) => task.dueDate === today);
  const upcomingTasks = tasks
    .filter((task) => !task.done && task.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  const completedToday = todayTasks.filter((task) => task.done).length;
  const progress = todayTasks.length
    ? Math.round((completedToday / todayTasks.length) * 100)
    : tasks.length
      ? Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100)
      : 0;
  const activeCount = tasks.filter((task) => !task.done).length;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function submitQuickAsk(event) {
    event.preventDefault();
    if (!question.trim()) return;
    onQuickAsk(question.trim());
    setQuestion("");
  }

  return (
    <section className="dashboard-view">
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow">YOUR STUDENT LIFE, IN ONE PLACE</p>
          <h1>{greetingFor(new Date().getHours())}, you’ve got this.</h1>
          <p className="muted">{dateLabel} <span className="greeting-dot">·</span> Take today one step at a time.</p>
        </div>
        <div className="dashboard-date-badge">
          <CalendarDays size={17} />
          <span>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      </div>

      {demoMode && (
        <div className="demo-banner">
          <span><Sparkles size={16} /> Demo experience is on</span>
          <div>
            <button onClick={onResetDemo}>Reset sample data</button>
            <button onClick={onToggleDemo}>Exit demo</button>
          </div>
        </div>
      )}

      <div className="dashboard-overview-grid">
        <article className="overview-card progress-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">YOUR MOMENTUM</p>
              <h2>Daily progress</h2>
            </div>
            <span className="card-icon lavender"><Target size={18} /></span>
          </div>
          <div className="progress-summary">
            <strong>{progress}%</strong>
            <span>{todayTasks.length ? `${completedToday} of ${todayTasks.length} due today done` : `${activeCount} active ${activeCount === 1 ? "task" : "tasks"}`}</span>
          </div>
          <div className="progress-track" aria-label={`${progress}% task progress`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="card-footnote">Small steps count. Keep your pace steady.</p>
        </article>

        <article className="overview-card summary-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">A QUICK LOOK</p>
              <h2>Today at a glance</h2>
            </div>
            <span className="card-icon peach"><Clock3 size={18} /></span>
          </div>
          <div className="summary-stats">
            <div><strong>{todayEvents.length}</strong><span>calendar {todayEvents.length === 1 ? "event" : "events"}</span></div>
            <div><strong>{todayTasks.length}</strong><span>tasks due today</span></div>
            <div><strong>{activeCount}</strong><span>open activities</span></div>
          </div>
        </article>

        <article className="overview-card assistant-quick-card">
          <div className="quick-assistant-title">
            <span className="assistant-spark"><Sparkles size={17} /></span>
            <div><p className="eyebrow">A LITTLE HELP, RIGHT NOW</p><h2>Ask Compass</h2></div>
          </div>
          <p className="muted">Get a starting point for whatever is on your mind.</p>
          <form className="quick-ask-form" onSubmit={submitQuickAsk}>
            <input
              aria-label="Ask the student assistant"
              maxLength={1000}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What would make today easier?"
              value={question}
            />
            <button aria-label="Send question" disabled={!question.trim()}><ArrowRight size={17} /></button>
          </form>
        </article>
      </div>

      <div className="dashboard-section-heading">
        <div><p className="eyebrow">YOUR TOOLKIT</p><h2>What would you like to do?</h2></div>
      </div>
      <div className="quick-actions-grid">
        <QuickAction
          description="Think it through together"
          icon={Sparkles}
          label="Ask AI"
          onClick={() => onNavigate("chat")}
          tone="tone-purple"
        />
        <QuickAction
          description={planLoading ? "Building your suggestion…" : "Get a realistic starting plan"}
          icon={CalendarDays}
          label={planLoading ? "Planning…" : "Plan my day"}
          onClick={onPlanDay}
          disabled={planLoading}
          tone="tone-blue"
        />
        <QuickAction
          description="Find reliable starting points"
          icon={Search}
          label="Research something"
          onClick={() => onNavigate("chat", "Find reliable resources about: ")}
          tone="tone-orange"
        />
        <QuickAction
          description={`${activeCount} activities still open`}
          icon={ListTodo}
          label="Manage tasks"
          onClick={() => onNavigate("planner")}
          tone="tone-green"
        />
      </div>

      <div className="dashboard-lower-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">COMING UP</p><h2>Today’s schedule</h2></div>
            <button className="text-button" onClick={() => onNavigate("calendar")}>Open calendar <ArrowRight size={14} /></button>
          </div>
          {todayEvents.length ? (
            <div className="dashboard-event-list">
              {todayEvents.slice(0, 4).map((event) => (
                <div className="dashboard-event" key={event.id}>
                  <span className="event-time">{event.time}</span>
                  <span className="event-timeline" />
                  <span className="event-details"><strong>{event.title}</strong><small>{event.location || `${event.duration} minute activity`}</small></span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <CalendarDays size={19} />
              <span>No activities scheduled today.</span>
              <button onClick={() => onNavigate("calendar")}>Add one</button>
            </div>
          )}
        </article>

        <article className="dashboard-panel deadlines-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">STAY ONE STEP AHEAD</p><h2>Upcoming deadlines</h2></div>
            <button className="text-button" onClick={() => onNavigate("planner")}>All tasks <ArrowRight size={14} /></button>
          </div>
          {upcomingTasks.length ? (
            <div className="deadline-list">
              {upcomingTasks.map((task) => (
                <button className="deadline-item" key={task.id} onClick={() => onNavigate("planner")}>
                  <span className={`priority-dot priority-${task.priority}`} />
                  <span className="deadline-copy"><strong>{task.title}</strong><small>{task.priority} priority</small></span>
                  <span className="deadline-date">{formatDate(task.dueDate, { month: "short", day: "numeric" })}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <CheckCircle2 size={19} />
              <span>No upcoming deadlines in your planner.</span>
              <button onClick={() => onNavigate("planner")}>Add a task</button>
            </div>
          )}
        </article>
      </div>

      {!demoMode && (
        <div className="demo-entry">
          <div><BookOpen size={17} /><span><strong>Showing judges around?</strong> Turn on an isolated sample student workspace.</span></div>
          <button onClick={onToggleDemo}>Explore demo data <ArrowRight size={14} /></button>
        </div>
      )}
    </section>
  );
}
