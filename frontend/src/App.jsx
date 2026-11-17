import { useEffect, useState } from "react";

const STORAGE_KEY = "study-compass-tasks";

function readTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitQuestion(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "The request could not be completed.");
      }
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || "Could not reach the assistant API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ASK & EXPLORE</p>
          <h2>What are you curious about?</h2>
          <p className="muted">
            Get a clear explanation and links to resources you can check.
          </p>
        </div>
        <span className="round-icon" aria-hidden="true">✳</span>
      </div>

      <form className="question-form" onSubmit={submitQuestion}>
        <label className="sr-only" htmlFor="question">Your question</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about a topic, assignment, or idea..."
          maxLength={1000}
          rows={4}
        />
        <div className="form-footer">
          <span className="muted small">Answers include source links. Verify important details.</span>
          <button className="primary-button" disabled={loading || !question.trim()}>
            {loading ? "Finding resources..." : "Ask assistant"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>

      {error && <p className="error-message" role="alert">{error}</p>}
      {result && (
        <div className="answer">
          <h3>Here’s a starting point</h3>
          <p className="answer-text">{result.answer}</p>
          <h3>Resources</h3>
          {result.sources.length > 0 ? (
            <ul className="source-list">
              {result.sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    <span className="source-number">[{index + 1}]</span>
                    {source.title}
                  </a>
                  {source.snippet && <p>{source.snippet}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No web resources were found for this question.</p>
          )}
        </div>
      )}
    </section>
  );
}

function PlannerPanel() {
  const [tasks, setTasks] = useState(readTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), title: trimmed, dueDate, done: false },
    ]);
    setTitle("");
    setDueDate("");
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function removeTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
  });

  return (
    <section className="panel planner-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">STAY ON TRACK</p>
          <h2>Your study plan</h2>
          <p className="muted">A simple list of what’s coming up.</p>
        </div>
        <span className="round-icon planner-icon" aria-hidden="true">✓</span>
      </div>

      <form className="task-form" onSubmit={addTask}>
        <label className="sr-only" htmlFor="task-title">Study task</label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add an assignment or study goal"
          maxLength={120}
        />
        <label className="sr-only" htmlFor="task-date">Due date</label>
        <input
          id="task-date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <button className="primary-button" disabled={!title.trim()}>Add</button>
      </form>

      {orderedTasks.length === 0 ? (
        <div className="empty-plan">
          <span aria-hidden="true">✎</span>
          <p>Your plan is clear. Add a task to get started.</p>
        </div>
      ) : (
        <ul className="task-list">
          {orderedTasks.map((task) => (
            <li className={task.done ? "task done" : "task"} key={task.id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="task-copy">
                  <span>{task.title}</span>
                  {task.dueDate && (
                    <small>
                      {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </small>
                  )}
                </span>
              </label>
              <button
                className="icon-button"
                onClick={() => removeTask(task.id)}
                aria-label={`Remove ${task.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small privacy-note">Your study plan is saved in this browser only.</p>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("ask");

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="StudyCompass home">
          <span className="brand-mark">S</span>
          <span>StudyCompass</span>
        </a>
        <span className="topbar-note">Your learning, made easier</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A LITTLE HELP GOES A LONG WAY</p>
          <h1>Find your way<br />through what you’re learning.</h1>
          <p className="hero-description">
            Ask a question, explore trustworthy starting points, and keep your
            next study steps in view.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="spark spark-one">✦</span>
          <span className="spark spark-two">✳</span>
          <span className="compass">✳</span>
        </div>
      </section>

      <nav className="tabs" aria-label="Student tools">
        <button
          className={activeTab === "ask" ? "tab active" : "tab"}
          onClick={() => setActiveTab("ask")}
        >
          <span aria-hidden="true">✧</span> Ask & Explore
        </button>
        <button
          className={activeTab === "plan" ? "tab active" : "tab"}
          onClick={() => setActiveTab("plan")}
        >
          <span aria-hidden="true">◷</span> Study Planner
        </button>
      </nav>

      {activeTab === "ask" ? <ChatPanel /> : <PlannerPanel />}

      <footer>
        <span>StudyCompass</span>
        <span>Use sources thoughtfully. Your learning comes first.</span>
      </footer>
    </main>
  );
}
