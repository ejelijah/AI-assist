import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  Plus,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import CalendarView from "./components/CalendarView.jsx";
import ChatView from "./components/ChatView.jsx";
import DashboardView from "./components/DashboardView.jsx";
import FocusView from "./components/FocusView.jsx";
import PlannerView from "./components/PlannerView.jsx";
import {
  createDemoMeetings,
  createDemoTasks,
  createId,
  dateKey,
  duplicateTask,
  normalizeMeetings,
  normalizeTasks,
  readJson,
  readList,
  STORAGE,
  writeJson,
} from "./lib/studyData.js";

const FOCUS_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "AI assistant", icon: MessageCircle },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "planner", label: "Planner", icon: ListTodo },
  { id: "focus", label: "Focus mode", icon: Timer },
];

function createSession() {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function updateSession(sessions, id, update) {
  return sessions.map((session) => session.id === id ? update(session) : session);
}

function initialFocus() {
  const saved = readJson(STORAGE.focus, null);
  if (!saved || typeof saved !== "object") {
    return {
      status: "idle",
      remainingSeconds: FOCUS_DURATION,
      endsAt: null,
      selectedTaskId: "",
      completedSessions: 0,
    };
  }
  return {
    status: ["idle", "focus", "paused_focus", "break", "paused_break"].includes(saved.status)
      ? saved.status
      : "idle",
    remainingSeconds: Number.isFinite(saved.remainingSeconds) ? saved.remainingSeconds : FOCUS_DURATION,
    endsAt: Number.isFinite(saved.endsAt) ? saved.endsAt : null,
    selectedTaskId: typeof saved.selectedTaskId === "string" ? saved.selectedTaskId : "",
    completedSessions: Number.isFinite(saved.completedSessions) ? saved.completedSessions : 0,
  };
}

function initialDemoList(key, factory, normalizer) {
  const stored = readJson(key, null);
  return stored === null ? factory() : normalizer(Array.isArray(stored) ? stored : []);
}

function updateMessage(sessions, sessionId, messageId, update) {
  return updateSession(sessions, sessionId, (session) => ({
    ...session,
    updatedAt: new Date().toISOString(),
    messages: session.messages.map((message) =>
      message.id === messageId ? update(message) : message,
    ),
  }));
}

function focusContext(tasks, meetings) {
  const today = dateKey(new Date());
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const lastDay = dateKey(horizon);
  return {
    today,
    tasks: tasks.slice(0, 40).map(({ title, description, priority, dueDate, done }) => ({
      title,
      description,
      priority,
      dueDate: dueDate || null,
      done,
    })),
    events: meetings
      .filter((event) => event.date >= today && event.date <= lastDay)
      .slice(0, 40)
      .map(({ title, date, time, duration, location }) => ({
        title,
        date,
        time,
        duration,
        location,
      })),
  };
}

export default function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = readList(STORAGE.chats);
    return saved.length ? saved : [createSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => readList(STORAGE.chats)[0]?.id ?? null);
  const [view, setView] = useState("dashboard");
  const [requestStates, setRequestStates] = useState({});
  const [draftSeed, setDraftSeed] = useState(null);
  const [toast, setToast] = useState("");

  const [demoMode, setDemoMode] = useState(() => readJson(STORAGE.demoEnabled, false) === true);
  const [userTasks, setUserTasks] = useState(() => normalizeTasks(readList(STORAGE.tasks)));
  const [userMeetings, setUserMeetings] = useState(() => normalizeMeetings(readList(STORAGE.meetings)));
  const [demoTasks, setDemoTasks] = useState(() => initialDemoList(
    STORAGE.demoTasks,
    createDemoTasks,
    normalizeTasks,
  ));
  const [demoMeetings, setDemoMeetings] = useState(() => initialDemoList(
    STORAGE.demoMeetings,
    createDemoMeetings,
    normalizeMeetings,
  ));
  const [focus, setFocus] = useState(initialFocus);

  const tasks = demoMode ? demoTasks : userTasks;
  const meetings = demoMode ? demoMeetings : userMeetings;
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const requestState = activeSession ? requestStates[activeSession.id] : null;
  const requestBusy = requestState?.loading === true;

  useEffect(() => writeJson(STORAGE.chats, sessions), [sessions]);
  useEffect(() => writeJson(STORAGE.tasks, userTasks), [userTasks]);
  useEffect(() => writeJson(STORAGE.meetings, userMeetings), [userMeetings]);
  useEffect(() => writeJson(STORAGE.demoTasks, demoTasks), [demoTasks]);
  useEffect(() => writeJson(STORAGE.demoMeetings, demoMeetings), [demoMeetings]);
  useEffect(() => writeJson(STORAGE.demoEnabled, demoMode), [demoMode]);
  useEffect(() => writeJson(STORAGE.focus, focus), [focus]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFocus((current) => {
        if (current.status !== "focus" && current.status !== "break") return current;
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((current.endsAt - now) / 1000));
        if (remaining > 0) {
          return remaining === current.remainingSeconds
            ? current
            : { ...current, remainingSeconds: remaining };
        }
        if (current.status === "focus") {
          const breakEndsAt = current.endsAt + BREAK_DURATION * 1000;
          if (now >= breakEndsAt) {
            return {
              ...current,
              status: "idle",
              remainingSeconds: FOCUS_DURATION,
              endsAt: null,
              completedSessions: current.completedSessions + 1,
            };
          }
          return {
            ...current,
            status: "break",
            remainingSeconds: Math.ceil((breakEndsAt - now) / 1000),
            endsAt: breakEndsAt,
            completedSessions: current.completedSessions + 1,
          };
        }
        return { ...current, status: "idle", remainingSeconds: FOCUS_DURATION, endsAt: null };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions],
  );

  function showToast(message) {
    setToast(message);
  }

  function changeTasks(update) {
    (demoMode ? setDemoTasks : setUserTasks)(update);
  }

  function changeMeetings(update) {
    (demoMode ? setDemoMeetings : setUserMeetings)(update);
  }

  function navigate(nextView, prompt) {
    setView(nextView);
    if (nextView === "chat" && prompt !== undefined) {
      setDraftSeed({ id: createId(), text: prompt });
    }
  }

  function startNewChat() {
    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setView("chat");
  }

  function deleteChat(id) {
    const next = sessions.filter((session) => session.id !== id);
    if (!next.length) next.push(createSession());
    setSessions(next);
    setRequestStates((current) => {
      const result = { ...current };
      delete result[id];
      return result;
    });
    if (activeSessionId === id) setActiveSessionId(next[0].id);
  }

  async function sendQuestion(question, options = {}, retry = false) {
    if (!activeSession || requestStates[activeSession.id]?.loading) return;
    const session = activeSession;
    const requestId = createId();
    const intent = options.intent || "chat";
    const plannerContext = options.plannerContext;
    const previousMessages = retry ? session.messages.slice(0, -1) : session.messages;
    const userMessage = retry ? null : {
      id: createId(),
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
      sources: [],
    };

    if (userMessage) {
      setSessions((current) => updateSession(current, session.id, (item) => ({
        ...item,
        title: item.messages.length === 0
          ? question.slice(0, 48) + (question.length > 48 ? "…" : "")
          : item.title,
        updatedAt: new Date().toISOString(),
        messages: [...item.messages, userMessage],
      })));
    }

    setRequestStates((current) => ({
      ...current,
      [session.id]: { requestId, loading: true, question, options },
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          intent,
          ...(plannerContext ? { plannerContext } : {}),
          history: previousMessages
            .slice(-20)
            .map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
        }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The assistant returned an unreadable response. Please retry.");
      }
      if (!response.ok) throw new Error(data.detail || "The request could not be completed.");

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString(),
        sources: data.sources ?? [],
        taskSuggestions: data.taskSuggestions ?? [],
        scheduleSuggestions: data.scheduleSuggestions ?? [],
        addedTaskSuggestionIds: [],
        addedScheduleSuggestionIds: [],
      };
      setSessions((current) => updateSession(current, session.id, (item) => ({
        ...item,
        updatedAt: new Date().toISOString(),
        messages: [...item.messages, assistantMessage],
      })));
      setRequestStates((current) => {
        if (current[session.id]?.requestId !== requestId) return current;
        const result = { ...current };
        delete result[session.id];
        return result;
      });
    } catch (error) {
      setRequestStates((current) => current[session.id]?.requestId === requestId
        ? {
          ...current,
          [session.id]: {
            requestId,
            loading: false,
            question,
            options,
            canRetry: true,
            error: error instanceof Error ? error.message : "Could not reach the assistant API.",
          },
        }
        : current,
      );
    }
  }

  function planMyDay() {
    const context = focusContext(tasks, meetings);
    const prompt = `Help me plan ${context.today}. Suggest a realistic sequence of study blocks and breaks using my open tasks and existing calendar. Respect my existing events and never invent assignment deadlines. Return proposed calendar blocks for my review.`;
    setView("chat");
    sendQuestion(prompt, { intent: "plan_day", plannerContext: context });
  }

  function addSuggestedTask(suggestion, suggestionId, messageId) {
    if (duplicateTask(tasks, suggestion)) {
      showToast("That task is already in your planner.");
      return;
    }
    changeTasks((current) => duplicateTask(current, suggestion) ? current : [{
      id: createId(),
      title: suggestion.title,
      description: suggestion.description || "",
      priority: ["low", "medium", "high"].includes(suggestion.priority) ? suggestion.priority : "medium",
      dueDate: suggestion.dueDate || "",
      done: false,
      createdAt: new Date().toISOString(),
    }, ...current]);
    setSessions((current) => updateMessage(current, activeSession.id, messageId, (message) => ({
      ...message,
      addedTaskSuggestionIds: [...new Set([...(message.addedTaskSuggestionIds ?? []), suggestionId])],
    })));
    showToast("Added to your planner.");
  }

  function addSuggestedMeeting(suggestion, suggestionId, messageId) {
    const event = {
      ...suggestion,
      location: "",
      notes: "AI-proposed activity. Review and adjust as needed.",
    };
    if (meetings.some((item) => item.date === event.date && item.time === event.time && item.title === event.title)) {
      showToast("That calendar activity is already saved.");
      return;
    }
    if (eventConflicts(meetings, event)) {
      showToast("That time overlaps an existing calendar event.");
      return;
    }
    changeMeetings((current) => eventConflicts(current, event)
      ? current
      : [...current, { ...event, id: createId() }]);
    setSessions((current) => updateMessage(current, activeSession.id, messageId, (message) => ({
      ...message,
      addedScheduleSuggestionIds: [...new Set([...(message.addedScheduleSuggestionIds ?? []), suggestionId])],
    })));
    showToast("Added to your calendar.");
  }

  function updateFocus(action) {
    setFocus((current) => {
      const now = Date.now();
      if (action.type === "select-task") {
        if (current.status === "focus" || current.status === "break") return current;
        return { ...current, selectedTaskId: action.taskId };
      }
      if (action.type === "start") {
        const status = current.status === "paused_break" ? "break" : "focus";
        const seconds = current.remainingSeconds || (status === "break" ? BREAK_DURATION : FOCUS_DURATION);
        return { ...current, status, remainingSeconds: seconds, endsAt: now + seconds * 1000 };
      }
      if (action.type === "pause" && (current.status === "focus" || current.status === "break")) {
        return {
          ...current,
          status: current.status === "focus" ? "paused_focus" : "paused_break",
          remainingSeconds: Math.max(0, Math.ceil((current.endsAt - now) / 1000)),
          endsAt: null,
        };
      }
      if (action.type === "resume" && (current.status === "paused_focus" || current.status === "paused_break")) {
        const status = current.status === "paused_focus" ? "focus" : "break";
        return { ...current, status, endsAt: now + current.remainingSeconds * 1000 };
      }
      if (action.type === "reset") {
        return { ...current, status: "idle", remainingSeconds: FOCUS_DURATION, endsAt: null };
      }
      return current;
    });
  }

  function toggleDemo() {
    setDemoMode((current) => !current);
    setView("dashboard");
    showToast(demoMode ? "Back to your personal workspace." : "Demo data loaded separately from your own.");
  }

  function resetDemo() {
    setDemoTasks(createDemoTasks());
    setDemoMeetings(createDemoMeetings());
    showToast("Sample data restored.");
  }

  const viewLabel = NAV_ITEMS.find((item) => item.id === view)?.label ?? "Dashboard";
  const requestError = requestState && !requestState.loading
    ? { message: requestState.error, canRetry: requestState.canRetry }
    : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("dashboard")}>
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>StudyCompass<small>STUDENT COMPANION</small></span>
        </button>
        <button className="new-chat-button" onClick={startNewChat}><Plus size={16} /> New conversation</button>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation" className="side-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "nav-item active" : "nav-item"}
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === "planner" && tasks.filter((task) => !task.done).length > 0 && <span className="nav-count">{tasks.filter((task) => !task.done).length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-history">
          <div className="history-heading"><p className="sidebar-label">RECENT CHATS</p><span>{sessions.length}</span></div>
          <div className="session-list">
            {sortedSessions.slice(0, 8).map((session) => (
              <div className={session.id === activeSession?.id ? "session-item selected" : "session-item"} key={session.id}>
                <button className="session-select" onClick={() => { setActiveSessionId(session.id); setView("chat"); }}>
                  <span className="session-bullet" />
                  <span>{session.title}</span>
                </button>
                <button aria-label={`Delete ${session.title}`} className="session-delete" onClick={() => deleteChat(session.id)}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <button className={demoMode ? "demo-switch active" : "demo-switch"} onClick={toggleDemo}>
          <span className="demo-switch-icon"><Sparkles size={15} /></span>
          <span><strong>{demoMode ? "Demo mode on" : "Judge demo mode"}</strong><small>{demoMode ? "Separate sample workspace" : "Load sample student data"}</small></span>
          <ChevronRight size={15} />
        </button>
        <div className="sidebar-footer">
          <div className="profile-avatar">S</div>
          <div><strong>{demoMode ? "Demo student" : "My workspace"}</strong><small>Saved in this browser</small></div>
          <span className="local-indicator" title="Saved locally" />
        </div>
      </aside>

      <main className="main-content">
        <header className="main-topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{viewLabel}</strong></div>
          <div className="topbar-actions">
            {demoMode && <span className="demo-mode-chip"><Sparkles size={13} /> DEMO MODE</span>}
            <span className="local-badge"><span /> Saved locally</span>
          </div>
        </header>
        <div className="page-content">
          {view === "dashboard" && (
            <DashboardView
              demoMode={demoMode}
              meetings={meetings}
              onNavigate={navigate}
              onPlanDay={planMyDay}
              onQuickAsk={(question) => { setView("chat"); sendQuestion(question); }}
              onResetDemo={resetDemo}
              onToggleDemo={toggleDemo}
              planLoading={requestBusy && requestState?.options?.intent === "plan_day"}
              tasks={tasks}
            />
          )}
          {view === "chat" && activeSession && (
            <ChatView
              busy={requestBusy}
              draftSeed={draftSeed}
              meetings={meetings}
              onAddMeeting={addSuggestedMeeting}
              onAddTask={addSuggestedTask}
              onRetry={() => sendQuestion(requestState.question, requestState.options, true)}
              onSend={(question) => sendQuestion(question)}
              requestError={requestError}
              session={activeSession}
              tasks={tasks}
            />
          )}
          {view === "calendar" && (
            <CalendarView meetings={meetings} onMeetingsChange={changeMeetings} onNavigatePlanner={() => setView("planner")} tasks={tasks} />
          )}
          {view === "planner" && <PlannerView onFocusTask={(taskId) => { updateFocus({ type: "select-task", taskId }); setView("focus"); }} onTasksChange={changeTasks} tasks={tasks} />}
          {view === "focus" && <FocusView focus={focus} onFocusChange={updateFocus} tasks={tasks} />}
        </div>
      </main>
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}
