import React, { useEffect, useRef, useState } from "react";

const CHAT_STORAGE_KEY = "study-compass-chat-sessions-v1";
const MEETING_STORAGE_KEY = "study-compass-meetings-v1";
const TASK_STORAGE_KEY = "study-compass-tasks";
const BUDGET_ENTRIES_KEY = "study-compass-budget-entries-v1";
const BUDGET_SETTINGS_KEY = "study-compass-budget-settings-v1";
const EXPENSE_CATEGORIES = [
  "Food & groceries",
  "Housing",
  "Transportation",
  "Books & supplies",
  "Phone & internet",
  "Health & personal care",
  "Entertainment",
  "Other",
];
const INCOME_CATEGORIES = [
  "Part-time job",
  "Scholarship / aid",
  "Family support",
  "Other income",
];
const SUGGESTIONS = [
  "Help me understand a difficult topic",
  "Help me make a manageable plan for a busy week",
  "Find student resources for budgeting and financial aid",
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

function readObject(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : fallback;
  } catch {
    return fallback;
  }
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
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
          <p className="eyebrow">YOUR STUDENT WELLBEING COMPANION</p>
          <h1>{session.messages.length ? session.title : "What can I help you explore?"}</h1>
          <p className="muted">
            Get support for study, time, and student-life questions—with sources when you need them.
          </p>
        </div>
        <div className="search-status"><span /> Web search on</div>
      </div>

      <div aria-live="polite" className="conversation">
        {session.messages.length === 0 ? (
          <div className="welcome-card">
            <div className="welcome-icon" aria-hidden="true">✳</div>
            <p className="welcome-title">A good place to start</p>
            <p className="muted">Ask what’s on your mind. I’ll look for helpful, trustworthy starting points.</p>
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
      setFormError("Add a meeting title, date, and time.");
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
          <p className="muted">Plan a study session or create a meeting. Events are saved on this device.</p>
        </div>
        <button className="primary-button" onClick={openMeetingForm}>
          <span aria-hidden="true">＋</span> Create meeting
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
                  aria-label={`${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}${count ? `, ${count} meeting${count > 1 ? "s" : ""}` : ""}`}
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
          <div className="calendar-legend"><span /> Meeting scheduled</div>
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
            <button aria-label="Create meeting on selected day" className="add-icon-button" onClick={openMeetingForm}>＋</button>
          </div>
          {selectedMeetings.length === 0 ? (
            <div className="empty-schedule">
              <span aria-hidden="true">◷</span>
              <p>No meetings planned for this day.</p>
              <button onClick={openMeetingForm}>Add a meeting</button>
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
              <p className="muted small">Your upcoming meetings will show here.</p>
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
                <h2 id="meeting-modal-title">Create a meeting</h2>
              </div>
              <button aria-label="Close dialog" className="modal-close" onClick={() => setShowMeetingForm(false)}>×</button>
            </div>
            <form className="meeting-form" onSubmit={createMeeting}>
              <label>
                Meeting name
                <input autoFocus maxLength={100} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="e.g. Biology study group" value={meetingTitle} />
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
                People to meet with <span className="optional-label">Optional</span>
                <input maxLength={200} onChange={(event) => setMeetingAttendees(event.target.value)} placeholder="Names or email addresses" value={meetingAttendees} />
              </label>
              <label>
                Notes <span className="optional-label">Optional</span>
                <textarea maxLength={500} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="Add an agenda or a reminder" rows={3} value={meetingNotes} />
              </label>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setShowMeetingForm(false)} type="button">Cancel</button>
                <button className="primary-button" type="submit">Save meeting</button>
              </div>
              <p className="modal-disclaimer">This meeting is saved in this browser only. It won’t send invitations.</p>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function BudgetView() {
  const [entries, setEntries] = useState(() => readList(BUDGET_ENTRIES_KEY));
  const [settings, setSettings] = useState(() => readObject(
    BUDGET_SETTINGS_KEY,
    { currency: "USD", monthlyLimits: {} },
  ));
  const [selectedMonth, setSelectedMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [limitDraft, setLimitDraft] = useState("");
  const [entryType, setEntryType] = useState("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(() => dateKey(new Date()));
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localStorage.setItem(BUDGET_ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(BUDGET_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const currency = settings.currency || "USD";
  const monthlyLimit = Number(settings.monthlyLimits?.[selectedMonth] || 0);
  const monthEntries = entries
    .filter((entry) => entry.date?.slice(0, 7) === selectedMonth)
    .sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`));
  const income = monthEntries
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const spending = monthEntries
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const balance = income - spending;
  const spendingProgress = monthlyLimit > 0
    ? Math.min((spending / monthlyLimit) * 100, 100)
    : 0;
  const spendingByCategory = EXPENSE_CATEGORIES
    .map((name) => ({
      name,
      total: monthEntries
        .filter((entry) => entry.type === "expense" && entry.category === name)
        .reduce((total, entry) => total + Number(entry.amount), 0),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const monthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  function changeMonth(value) {
    if (!value) return;
    setSelectedMonth(value);
    setLimitDraft(settings.monthlyLimits?.[value]?.toString() || "");
    setEntryDate(`${value}-01`);
  }

  function saveMonthlyLimit(event) {
    event.preventDefault();
    const parsed = Number(limitDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError("Enter a monthly spending plan greater than zero.");
      return;
    }
    setSettings((current) => ({
      ...current,
      monthlyLimits: { ...current.monthlyLimits, [selectedMonth]: parsed },
    }));
    setFormError("");
  }

  function addEntry(event) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !entryDate) {
      setFormError("Enter a valid amount and date.");
      return;
    }
    setEntries((current) => [
      ...current,
      {
        id: createId(),
        type: entryType,
        category,
        amount: parsedAmount,
        description: description.trim(),
        date: entryDate,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAmount("");
    setDescription("");
    setFormError("");
  }

  return (
    <section className="budget-view">
      <div className="page-heading budget-heading">
        <div>
          <p className="eyebrow">MONEY IS PART OF WELLBEING</p>
          <h1>Student budget</h1>
          <p className="muted">A private, judgment-free way to plan spending and keep track of what comes in.</p>
        </div>
        <label className="currency-select">
          Currency
          <select
            aria-label="Budget currency"
            onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value }))}
            value={currency}
          >
            {["USD", "CAD", "AUD", "GBP", "EUR", "NGN", "INR"].map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="budget-month-row">
        <label>
          Month
          <input onChange={(event) => changeMonth(event.target.value)} type="month" value={selectedMonth} />
        </label>
        <span className="budget-local-note"><span /> Saved on this device only</span>
      </div>

      <div className="budget-summary">
        <article className="budget-stat">
          <span className="budget-stat-icon income-icon" aria-hidden="true">↓</span>
          <div><p>Money in</p><strong>{formatMoney(income, currency)}</strong><small>Income recorded this month</small></div>
        </article>
        <article className="budget-stat">
          <span className="budget-stat-icon spend-icon" aria-hidden="true">↗</span>
          <div><p>Money out</p><strong>{formatMoney(spending, currency)}</strong><small>Spending recorded this month</small></div>
        </article>
        <article className={`budget-stat ${balance < 0 ? "negative-stat" : ""}`}>
          <span className="budget-stat-icon balance-icon" aria-hidden="true">◉</span>
          <div><p>Left after spending</p><strong>{formatMoney(balance, currency)}</strong><small>Income minus recorded spending</small></div>
        </article>
      </div>

      <div className="budget-main-grid">
        <div className="budget-primary-column">
          <section className="budget-panel spending-plan-panel">
            <div className="budget-panel-heading">
              <div><p className="eyebrow">A GENTLE CHECK-IN</p><h2>Your spending plan</h2></div>
              <span className="budget-panel-mark" aria-hidden="true">◷</span>
            </div>
            {monthlyLimit > 0 ? (
              <>
                <div className="spending-plan-totals">
                  <strong>{formatMoney(spending, currency)} <span>of {formatMoney(monthlyLimit, currency)}</span></strong>
                  <button onClick={() => setLimitDraft(monthlyLimit.toString())}>Edit plan</button>
                </div>
                <div
                  aria-label={`${Math.round(spendingProgress)} percent of monthly spending plan used`}
                  className="progress-track"
                  role="progressbar"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(spendingProgress)}
                >
                  <span className={spending > monthlyLimit ? "over-limit" : ""} style={{ width: `${spendingProgress}%` }} />
                </div>
                <p className={spending > monthlyLimit ? "plan-status over-limit-text" : "plan-status"}>
                  {spending > monthlyLimit
                    ? `${formatMoney(spending - monthlyLimit, currency)} over your plan. Take a moment to review—this is information, not a judgment.`
                    : `${formatMoney(monthlyLimit - spending, currency)} left in your plan for ${monthLabel}.`}
                </p>
              </>
            ) : (
              <p className="plan-status">Choose a monthly spending amount that feels realistic for you. You can change it anytime.</p>
            )}
            <form className="limit-form" onSubmit={saveMonthlyLimit}>
              <label>
                Monthly spending plan
                <span className="money-input">
                  <span>{currency}</span>
                  <input
                    min="0.01"
                    onChange={(event) => setLimitDraft(event.target.value)}
                    placeholder="e.g. 500"
                    step="0.01"
                    type="number"
                    value={limitDraft}
                  />
                </span>
              </label>
              <button className="secondary-button" type="submit">Save plan</button>
            </form>
          </section>

          <section className="budget-panel">
            <div className="budget-panel-heading">
              <div><p className="eyebrow">SPENDING SNAPSHOT</p><h2>Where it’s going</h2></div>
            </div>
            {spendingByCategory.length === 0 ? (
              <p className="budget-empty-copy">Add an expense to see your spending categories here.</p>
            ) : (
              <div className="category-breakdown">
                {spendingByCategory.map((item) => (
                  <div className="category-row" key={item.name}>
                    <div className="category-label"><span>{item.name}</span><strong>{formatMoney(item.total, currency)}</strong></div>
                    <div className="category-track"><span style={{ width: `${(item.total / spending) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="budget-side-column">
          <section className="budget-panel add-entry-panel">
            <div className="budget-panel-heading">
              <div><p className="eyebrow">KEEP IT SIMPLE</p><h2>Add an entry</h2></div>
            </div>
            <form className="budget-entry-form" onSubmit={addEntry}>
              <div className="entry-type-toggle">
                <button
                  className={entryType === "expense" ? "selected" : ""}
                  onClick={() => {
                    setEntryType("expense");
                    setCategory(EXPENSE_CATEGORIES[0]);
                  }}
                  type="button"
                >
                  Expense
                </button>
                <button
                  className={entryType === "income" ? "selected" : ""}
                  onClick={() => {
                    setEntryType("income");
                    setCategory(INCOME_CATEGORIES[0]);
                  }}
                  type="button"
                >
                  Income
                </button>
              </div>
              <label>
                Amount
                <span className="money-input">
                  <span>{currency}</span>
                  <input
                    min="0.01"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    required
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                </span>
              </label>
              <label>
                Category
                <select onChange={(event) => setCategory(event.target.value)} value={category}>
                  {(entryType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                What was it for?
                <input
                  maxLength={100}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional note"
                  value={description}
                />
              </label>
              <label>
                Date
                <input
                  onChange={(event) => setEntryDate(event.target.value)}
                  required
                  type="date"
                  value={entryDate}
                />
              </label>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <button className="primary-button add-entry-button" type="submit">Add {entryType}</button>
            </form>
            <p className="budget-privacy">No bank connection. Your budget stays in this browser and isn’t sent to the AI.</p>
          </section>
        </div>
      </div>

      <section className="budget-panel transactions-panel">
        <div className="budget-panel-heading transaction-heading">
          <div><p className="eyebrow">YOUR ACTIVITY</p><h2>{monthLabel} entries</h2></div>
          <span className="transaction-count">{monthEntries.length} {monthEntries.length === 1 ? "entry" : "entries"}</span>
        </div>
        {monthEntries.length === 0 ? (
          <p className="budget-empty-copy">Nothing recorded yet. Start with one small entry—estimates are okay.</p>
        ) : (
          <div className="transaction-list">
            {monthEntries.map((entry) => (
              <article className="transaction-row" key={entry.id}>
                <span className={`transaction-type-icon ${entry.type}`} aria-hidden="true">
                  {entry.type === "income" ? "↓" : "↗"}
                </span>
                <div className="transaction-description">
                  <strong>{entry.description || entry.category}</strong>
                  <small>{entry.category} · {parseDate(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                </div>
                <strong className={`transaction-amount ${entry.type}`}>
                  {entry.type === "income" ? "+" : "−"}{formatMoney(Number(entry.amount), currency)}
                </strong>
                <button
                  aria-label={`Remove ${entry.description || entry.category} entry`}
                  className="icon-button"
                  onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="budget-disclaimer">A personal planning tool for everyday budgeting—not financial advice. Avoid entering bank details or sensitive information.</p>
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
          <h1>Study planner</h1>
          <p className="muted">Keep your assignments and study goals in one place.</p>
        </div>
      </div>
      <div className="planner-card">
        <form className="task-form" onSubmit={addTask}>
          <label className="sr-only" htmlFor="task-title">Study task</label>
          <input id="task-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Add an assignment or study goal" value={title} />
          <label className="sr-only" htmlFor="task-date">Due date</label>
          <input id="task-date" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
          <button className="primary-button" disabled={!title.trim()}>Add task</button>
        </form>
        {orderedTasks.length === 0 ? (
          <div className="planner-empty">
            <span aria-hidden="true">✎</span>
            <h2>Your plan is clear</h2>
            <p className="muted">Add a task to get started.</p>
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
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
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
            <span aria-hidden="true">✳</span> AI assistant
          </button>
          <button className={activeView === "calendar" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("calendar")}>
            <span aria-hidden="true">▦</span> Calendar
            {meetings.length > 0 && <span className="nav-count">{meetings.length}</span>}
          </button>
          <button className={activeView === "budget" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("budget")}>
            <span aria-hidden="true">$</span> Student budget
          </button>
          <button className={activeView === "planner" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("planner")}>
            <span aria-hidden="true">✓</span> Study planner
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
          <div><strong>My workspace</strong><small>Student wellbeing space</small></div>
          <span className="local-indicator" title="Saved on this device" />
        </div>
      </aside>

      <main className="main-content">
        <header className="main-topbar">
          <span className="breadcrumb">Workspace <span>/</span> {
            activeView === "chat" ? "AI assistant" :
              activeView === "calendar" ? "Calendar" :
                activeView === "budget" ? "Student budget" : "Study planner"
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
          {activeView === "budget" && <BudgetView />}
          {activeView === "planner" && <PlannerView />}
        </div>
      </main>
    </div>
  );
}
