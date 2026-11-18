import React, { useEffect, useRef, useState } from "react";

const CHAT_STORAGE_KEY = "study-compass-chat-sessions-v1";
const MEETING_STORAGE_KEY = "study-compass-meetings-v1";
const TASK_STORAGE_KEY = "study-compass-tasks";
const SUGGESTIONS = [
  "Help me understand a difficult topic",
  "Help me plan my day around classes and study time",
  "Break a big assignment into manageable steps",
];

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

function readList(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function updateSession(sessions, id, update) {
  return sessions.map((session) =>
    session.id === id ? update(session) : session,
  );
}

function ChatMessage({ message }) {
  const isAssistant = message.role === "assistant";

  return (
    <article className={`message-row ${isAssistant ? "assistant-row" : "user-row"}`}>
      {isAssistant && <div className="assistant-avatar" aria-hidden="true">✳</div>}
      <div className="message-content">
        <p className="message-author">{isAssistant ? "Compass" : "You"}</p>
        <div className={`message-bubble ${isAssistant ? "assistant-bubble" : "user-bubble"}`}>
          <p>{message.content}</p>
        </div>
        {isAssistant && message.sources?.length > 0 && (
          <div className="message-sources">
            <p className="source-heading">Sources</p>
            {message.sources.map((source, index) => (
              <a
                className="source-card"
                href={source.url}
                key={`${source.url}-${index}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="source-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="source-card-copy">
                  <strong>{source.title}</strong>
                  {source.snippet && <small>{source.snippet}</small>}
                  <span>{source.url}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ChatView({
  session,
  busy,
  requestError,
  onSend,
  onRetry,
}) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, busy]);

  function submit(event) {
    event.preventDefault();
    if (draft.trim() && !busy) {
      onSend(draft.trim());
      setDraft("");
    }
  }

  return (
    <section className="chat-workspace">
      <div className="chat-intro">
        <div>
          <p className="eyebrow">YOUR DAILY STUDENT COMPANION</p>
          <h1>{session.messages.length ? session.title : "What can I help you explore?"}</h1>
          <p className="muted">
            Organize your day, stay on top of activities, and find helpful student resources.
          </p>
        </div>
        <div className="search-status"><span /> Web search on</div>
      </div>

      <div aria-live="polite" className="conversation">
        {session.messages.length === 0 ? (
          <div className="welcome-card">
            <div className="welcome-icon" aria-hidden="true">✳</div>
            <p className="welcome-title">A good place to start</p>
            <p className="muted">Plan your day or ask a question. I’ll look for helpful, trustworthy starting points.</p>
            <div className="suggestion-list">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => onSend(suggestion)}>
                  <span>{suggestion}</span><span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          session.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        {busy && (
          <div className="message-row assistant-row">
            <div className="assistant-avatar" aria-hidden="true">✳</div>
            <div className="message-content">
              <p className="message-author">Compass</p>
              <div className="message-bubble assistant-bubble typing-indicator">
                Searching for sources and putting together an answer<span>...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {requestError && (
        <div className="request-error" role="alert">
          <span>{requestError.message}</span>
          {requestError.canRetry && (
            <button onClick={onRetry}>Retry</button>
          )}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-prompt">Message Compass</label>
        <textarea
          id="chat-prompt"
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Message Compass..."
          rows={2}
          value={draft}
        />
        <div className="composer-footer">
          <span>Enter to send · Shift + Enter for a new line</span>
          <button className="send-button" disabled={!draft.trim() || busy} aria-label="Send message">
            <span>Send</span><span aria-hidden="true">↑</span>
          </button>
        </div>
      </form>
      <p className="privacy-note">Your conversations are saved in this browser.</p>
    </section>
  );
}

function CalendarView({ meetings, onMeetingsChange }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(selectedDate);
  const [meetingTime, setMeetingTime] = useState("13:00");
  const [meetingDuration, setMeetingDuration] = useState("30");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [formError, setFormError] = useState("");

  const monthName = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  ).getDay();
  const calendarStart = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1 - firstDay,
  );
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const selectedMeetings = meetings
    .filter((meeting) => meeting.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcomingMeetings = [...meetings]
    .filter((meeting) => meeting.date >= dateKey(new Date()))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 3);

  function moveMonth(offset) {
    setCurrentMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
  }

  function openMeetingForm() {
    setMeetingDate(selectedDate);
    setFormError("");
    setShowMeetingForm(true);
  }

  function createMeeting(event) {
    event.preventDefault();
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) {
      setFormError("Add an activity name, date, and time.");
      return;
    }
    const meeting = {
      id: createId(),
      title: meetingTitle.trim(),
      date: meetingDate,
      time: meetingTime,
      duration: Number(meetingDuration),
      location: meetingLocation.trim(),
      attendees: meetingAttendees.trim(),
      notes: meetingNotes.trim(),
    };
    onMeetingsChange((current) => [...current, meeting]);
    setSelectedDate(meeting.date);
    setCurrentMonth(() => {
      const date = parseDate(meeting.date);
      return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    setMeetingTitle("");
    setMeetingTime("13:00");
    setMeetingLocation("");
    setMeetingAttendees("");
    setMeetingNotes("");
    setShowMeetingForm(false);
  }

  return (
    <section className="calendar-view">
      <div className="page-heading calendar-page-heading">
        <div>
          <p className="eyebrow">MAKE TIME FOR WHAT MATTERS</p>
          <h1>Your calendar</h1>
          <p className="muted">Plan classes, appointments, study sessions, and other activities.</p>
        </div>
        <button className="primary-button" onClick={openMeetingForm}>
          <span aria-hidden="true">＋</span> Add activity
        </button>
      </div>

      <div className="calendar-layout">
        <div className="calendar-card">
          <div className="calendar-toolbar">
            <div>
              <h2>{monthName}</h2>
              <p className="muted">Select a day to see its schedule</p>
            </div>
            <div className="month-controls">
              <button aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
              <button
                className="today-button"
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(dateKey(today));
                }}
              >
                Today
              </button>
              <button aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
            </div>
          </div>
          <div className="calendar-grid" role="grid" aria-label={monthName}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div className="weekday" key={day} role="columnheader">{day}</div>
            ))}
            {calendarDays.map((date) => {
              const key = dateKey(date);
              const count = meetings.filter((meeting) => meeting.date === key).length;
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
              const isToday = key === dateKey(new Date());
              return (
                <button
                  aria-label={`${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}${count ? `, ${count} scheduled activit${count > 1 ? "ies" : "y"}` : ""}`}
                  aria-pressed={key === selectedDate}
                  className={[
                    "calendar-day",
                    isCurrentMonth ? "" : "outside-month",
                    isToday ? "is-today" : "",
                    key === selectedDate ? "selected-day" : "",
                  ].filter(Boolean).join(" ")}
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    if (!isCurrentMonth) {
                      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                    }
                  }}
                  role="gridcell"
                >
                  <span>{date.getDate()}</span>
                  {count > 0 && <span className="meeting-count">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend"><span /> Activity scheduled</div>
        </div>

        <aside className="schedule-card">
          <div className="schedule-date">
            <div>
              <p className="eyebrow">YOUR SCHEDULE</p>
              <h2>{parseDate(selectedDate).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}</h2>
            </div>
            <button aria-label="Add activity on selected day" className="add-icon-button" onClick={openMeetingForm}>＋</button>
          </div>
          {selectedMeetings.length === 0 ? (
            <div className="empty-schedule">
              <span aria-hidden="true">◷</span>
              <p>Nothing planned for this day.</p>
              <button onClick={openMeetingForm}>Add an activity</button>
            </div>
          ) : (
            <div className="meeting-list">
              {selectedMeetings.map((meeting) => (
                <article className="meeting-card" key={meeting.id}>
                  <div className="meeting-time">{meeting.time}<small>{meeting.duration} min</small></div>
                  <div className="meeting-detail">
                    <h3>{meeting.title}</h3>
                    {meeting.location && <p>{meeting.location}</p>}
                    {meeting.attendees && <p>With {meeting.attendees}</p>}
                    {meeting.notes && <p className="meeting-notes">{meeting.notes}</p>}
                  </div>
                  <button
                    aria-label={`Delete ${meeting.title}`}
                    className="delete-meeting"
                    onClick={() => onMeetingsChange((current) =>
                      current.filter((item) => item.id !== meeting.id),
                    )}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="upcoming-section">
            <h3>Coming up</h3>
            {upcomingMeetings.length === 0 ? (
              <p className="muted small">Your upcoming activities will show here.</p>
            ) : (
              upcomingMeetings.map((meeting) => (
                <button
                  className="upcoming-meeting"
                  key={meeting.id}
                  onClick={() => {
                    setSelectedDate(meeting.date);
                    const date = parseDate(meeting.date);
                    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  }}
                >
                  <span className="upcoming-date">
                    {parseDate(meeting.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <span>{meeting.title}<small>{meeting.time}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {showMeetingForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowMeetingForm(false);
          }}
        >
          <section aria-labelledby="meeting-modal-title" aria-modal="true" className="meeting-modal" role="dialog">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ADD TO YOUR CALENDAR</p>
                <h2 id="meeting-modal-title">Add a calendar activity</h2>
              </div>
              <button aria-label="Close dialog" className="modal-close" onClick={() => setShowMeetingForm(false)}>×</button>
            </div>
            <form className="meeting-form" onSubmit={createMeeting}>
              <label>
                Activity name
                <input autoFocus maxLength={100} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="e.g. Biology class or study group" value={meetingTitle} />
              </label>
              <div className="meeting-form-row">
                <label>
                  Date
                  <input onChange={(event) => setMeetingDate(event.target.value)} required type="date" value={meetingDate} />
                </label>
                <label>
                  Start time
                  <input onChange={(event) => setMeetingTime(event.target.value)} required type="time" value={meetingTime} />
                </label>
              </div>
              <label>
                Duration
                <select onChange={(event) => setMeetingDuration(event.target.value)} value={meetingDuration}>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </label>
              <label>
                Location or meeting link <span className="optional-label">Optional</span>
                <input maxLength={160} onChange={(event) => setMeetingLocation(event.target.value)} placeholder="Room, address, or video call link" value={meetingLocation} />
              </label>
              <label>
                People involved <span className="optional-label">Optional</span>
                <input maxLength={200} onChange={(event) => setMeetingAttendees(event.target.value)} placeholder="Names or email addresses" value={meetingAttendees} />
              </label>
              <label>
                Notes <span className="optional-label">Optional</span>
                <textarea maxLength={500} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="Add an agenda or a reminder" rows={3} value={meetingNotes} />
              </label>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowMeetingForm(false)} type="button">Cancel</button>
                <button className="primary-button" type="submit">Save activity</button>
              </div>
              <p className="modal-disclaimer">Saved in this browser only. It won’t send invitations.</p>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function PlannerView() {
  const [tasks, setTasks] = useState(() => readList(TASK_STORAGE_KEY));
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((current) => [
      ...current,
      { id: createId(), title: trimmed, dueDate, done: false },
    ]);
    setTitle("");
    setDueDate("");
  }

  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  return (
    <section className="planner-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMALL STEPS ADD UP</p>
          <h1>Daily planner</h1>
          <p className="muted">Keep track of classes, assignments, errands, and the little things you need to do.</p>
        </div>
      </div>
      <div className="planner-card">
        <form className="task-form" onSubmit={addTask}>
          <label className="sr-only" htmlFor="task-title">Daily activity</label>
          <input id="task-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task, errand, or activity" value={title} />
          <label className="sr-only" htmlFor="task-date">Due date</label>
          <input id="task-date" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
          <button className="primary-button" disabled={!title.trim()}>Add activity</button>
        </form>
        {orderedTasks.length === 0 ? (
          <div className="planner-empty">
            <span aria-hidden="true">✎</span>
            <h2>Your day is open</h2>
            <p className="muted">Add a task or activity to get started.</p>
          </div>
        ) : (
          <ul className="task-list">
            {orderedTasks.map((task) => (
              <li className={task.done ? "task done" : "task"} key={task.id}>
                <label>
                  <input
                    checked={task.done}
                    onChange={() => setTasks((current) => current.map((item) =>
                      item.id === task.id ? { ...item, done: !item.done } : item,
                    ))}
                    type="checkbox"
                  />
                  <span className="task-copy">
                    <span>{task.title}</span>
                    {task.dueDate && <small>{parseDate(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>}
                  </span>
                </label>
                <button
                  aria-label={`Remove ${task.title}`}
                  className="icon-button"
                  onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small planner-privacy">Your tasks are saved in this browser only.</p>
      </div>
    </section>
  );
}

export default function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = readList(CHAT_STORAGE_KEY);
    return saved.length > 0 ? saved : [createSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = readList(CHAT_STORAGE_KEY);
    return saved[0]?.id ?? null;
  });
  const [meetings, setMeetings] = useState(() => readList(MEETING_STORAGE_KEY));
  const [activeView, setActiveView] = useState("chat");
  const [requestStates, setRequestStates] = useState({});
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const requestState = activeSession ? requestStates[activeSession.id] : null;
  const busy = requestState?.loading === true;

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(MEETING_STORAGE_KEY, JSON.stringify(meetings));
  }, [meetings]);

  function startNewChat() {
    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setActiveView("chat");
  }

  function deleteChat(id) {
    const nextSessions = sessions.filter((session) => session.id !== id);
    if (nextSessions.length === 0) nextSessions.push(createSession());
    setSessions(nextSessions);
    setRequestStates((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (activeSessionId === id) setActiveSessionId(nextSessions[0].id);
  }

  async function sendQuestion(question, retry = false) {
    if (!activeSession || requestStates[activeSession.id]?.loading) return;
    const session = activeSession;
    const requestId = createId();
    const previousMessages = retry
      ? session.messages.slice(0, -1)
      : session.messages;
    const userMessage = retry ? null : {
      id: createId(),
      role: "user",
      content: question,
      sources: [],
    };

    if (userMessage) {
      setSessions((current) => updateSession(current, session.id, (item) => ({
        ...item,
        title: item.messages.length === 0
          ? question.slice(0, 44) + (question.length > 44 ? "…" : "")
          : item.title,
        updatedAt: new Date().toISOString(),
        messages: [...item.messages, userMessage],
      })));
    }
    setRequestStates((current) => ({
      ...current,
      [session.id]: { requestId, loading: true, question },
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: previousMessages
            .slice(-20)
            .map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "The request could not be completed.");
      }

      const assistantMessage = {
        id: createId(),
        role: "assistant",
        content: data.answer,
        sources: data.sources ?? [],
      };
      setSessions((current) => updateSession(current, session.id, (item) => ({
        ...item,
        updatedAt: new Date().toISOString(),
        messages: [...item.messages, assistantMessage],
      })));
      setRequestStates((current) => {
        if (current[session.id]?.requestId !== requestId) return current;
        const next = { ...current };
        delete next[session.id];
        return next;
      });
    } catch (error) {
      setRequestStates((current) => current[session.id]?.requestId === requestId
        ? {
          ...current,
          [session.id]: {
            requestId,
            loading: false,
            question,
            canRetry: true,
            error: error.message || "Could not reach the assistant API.",
          },
        }
        : current,
      );
    }
  }

  const requestError = requestState && !requestState.loading
    ? { message: requestState.error, canRetry: requestState.canRetry }
    : null;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a aria-label="StudyCompass home" className="brand" href="#" onClick={() => setActiveView("chat")}>
          <span className="brand-mark">S</span>
          <span>StudyCompass</span>
        </a>
        <button className="new-chat-button" onClick={startNewChat}>
          <span aria-hidden="true">＋</span> New conversation
        </button>

        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Main navigation" className="side-nav">
          <button className={activeView === "chat" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("chat")}>
            <span aria-hidden="true">✳</span> Daily assistant
          </button>
          <button className={activeView === "calendar" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("calendar")}>
            <span aria-hidden="true">▦</span> Calendar
            {meetings.length > 0 && <span className="nav-count">{meetings.length}</span>}
          </button>
          <button className={activeView === "planner" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("planner")}>
            <span aria-hidden="true">✓</span> Daily planner
          </button>
        </nav>

        <div className="sidebar-history">
          <div className="history-heading">
            <p className="sidebar-label">RECENT CHATS</p>
            <span>{sessions.length}</span>
          </div>
          <div className="session-list">
            {[...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((session) => (
              <div className={session.id === activeSession?.id ? "session-item selected" : "session-item"} key={session.id}>
                <button className="session-select" onClick={() => {
                  setActiveSessionId(session.id);
                  setActiveView("chat");
                }}>
                  <span aria-hidden="true">◦</span>
                  <span>{session.title}</span>
                </button>
                <button
                  aria-label={`Delete ${session.title}`}
                  className="session-delete"
                  onClick={() => deleteChat(session.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="profile-avatar" aria-hidden="true">S</div>
          <div><strong>My workspace</strong><small>Student daily life</small></div>
          <span className="local-indicator" title="Saved on this device" />
        </div>
      </aside>

      <main className="main-content">
        <header className="main-topbar">
          <span className="breadcrumb">Workspace <span>/</span> {
            activeView === "chat" ? "Daily assistant" :
              activeView === "calendar" ? "Calendar" :
                "Daily planner"
          }</span>
          <span className="local-badge"><span /> Saved on this device</span>
        </header>
        <div className="page-content">
          {activeView === "chat" && activeSession && (
            <ChatView
              busy={busy && requestState?.sessionId === activeSession.id}
              onRetry={() => sendQuestion(requestState.question, true)}
              onSend={(question) => sendQuestion(question)}
              requestError={requestError}
              session={activeSession}
            />
          )}
          {activeView === "calendar" && (
            <CalendarView
              meetings={meetings}
              onMeetingsChange={setMeetings}
            />
          )}
          {activeView === "planner" && <PlannerView />}
        </div>
      </main>
    </div>
  );
}
