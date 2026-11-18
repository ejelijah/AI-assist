import { Pause, Play, RotateCcw, Sparkles, Target } from "lucide-react";
import { elapsedSecondsAt, formatTimer } from "../lib/focusTimer.js";

export default function FocusView({
  tasks,
  focus,
  onFocusChange,
}) {
  const selectedTask = tasks.find((task) => task.id === focus.selectedTaskId);
  const isRunning = focus.status === "focus" || focus.status === "break";
  const isPaused = focus.status === "paused_focus" || focus.status === "paused_break";
  const isBreak = focus.status === "break" || focus.status === "paused_break";
  const isStopwatch = focus.mode === "stopwatch";
  const elapsedSeconds = elapsedSecondsAt(focus);
  const timerSeconds = isStopwatch ? elapsedSeconds : focus.remainingSeconds;
  const totalSeconds = isBreak || focus.status === "paused_break" ? 5 * 60 : 25 * 60;
  const progress = isStopwatch
    ? (timerSeconds % 60) / 60
    : Math.min(1, Math.max(0, focus.remainingSeconds / totalSeconds));
  const circumference = 2 * Math.PI * 116;
  const label = isBreak ? "BREAK TIME" : isStopwatch ? "STOPWATCH" : "FOCUS SESSION";

  return (
    <section className="focus-view">
      <div className="page-heading">
        <div><p className="eyebrow">ONE THING AT A TIME</p><h1>Focus mode</h1><p className="muted">A little structure can make it easier to get started. Your timer keeps running as you move around StudyCompass.</p></div>
        <div className="focus-sessions-badge"><Target size={17} /><strong>{focus.completedSessions}</strong><span>sessions completed</span></div>
      </div>

      <div className="focus-layout">
        <article className="focus-timer-card">
          <div className="focus-mode-toggle" role="group" aria-label="Focus timer mode">
            <button
              aria-pressed={isStopwatch}
              disabled={isRunning || isPaused}
              onClick={() => onFocusChange({ type: "set-mode", mode: "stopwatch" })}
              type="button"
            >
              Stopwatch
            </button>
            <button
              aria-pressed={!isStopwatch}
              disabled={isRunning || isPaused}
              onClick={() => onFocusChange({ type: "set-mode", mode: "pomodoro" })}
              type="button"
            >
              Pomodoro
            </button>
          </div>
          <div className="timer-ring-wrap">
            <svg className="timer-ring" viewBox="0 0 260 260" aria-hidden="true">
              <circle className="timer-ring-track" cx="130" cy="130" r="116" />
              <circle
                className="timer-ring-progress"
                cx="130"
                cy="130"
                r="116"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <div className="timer-face" aria-live="polite">
              <span className="eyebrow">{label}</span>
              <strong className={isStopwatch ? "stopwatch-time" : undefined}>{formatTimer(timerSeconds)}</strong>
              <small>{isBreak ? "Let your mind reset" : selectedTask?.title || (isStopwatch ? "Open-ended focus" : "Choose one thing to focus on")}</small>
            </div>
          </div>
          <div className="timer-controls">
            {isRunning ? (
              <button className="primary-button" onClick={() => onFocusChange({ type: "pause" })}><Pause size={16} /> Pause</button>
            ) : isPaused ? (
              <button className="primary-button" onClick={() => onFocusChange({ type: "resume" })}><Play size={16} /> Resume</button>
            ) : (
              <button className="primary-button" onClick={() => onFocusChange({ type: "start" })}><Play size={16} /> Start {isBreak ? "break" : "focus"}</button>
            )}
            <button className="secondary-button" onClick={() => onFocusChange({ type: "reset" })}><RotateCcw size={15} /> Reset</button>
          </div>
          {focus.status === "idle" && focus.completedSessions > 0 && <p className="focus-complete-note"><Sparkles size={14} /> Nice work—each focused session counts.</p>}
        </article>

        <aside className="focus-side-panel">
          <div className="panel-heading"><div><p className="eyebrow">MAKE IT COUNT</p><h2>Choose your focus</h2></div></div>
          <p className="muted">Pick an open task to keep it in view while you work.</p>
          <label className="focus-task-select">
            Current task
            <select
              disabled={isRunning}
              onChange={(event) => onFocusChange({ type: "select-task", taskId: event.target.value })}
              value={focus.selectedTaskId || ""}
            >
              <option value="">Focus without a task</option>
              {tasks.filter((task) => !task.done).map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </label>
          <div className="focus-rhythm">
            {isStopwatch ? (
              <>
                <div><span className="rhythm-dot focus-dot" /><span><strong>No time limit</strong><small>Count up while you work</small></span></div>
                <div><span className="rhythm-dot break-dot" /><span><strong>Your pace</strong><small>Pause or reset whenever you need</small></span></div>
              </>
            ) : (
              <>
                <div><span className="rhythm-dot focus-dot" /><span><strong>25 minutes</strong><small>Focused work</small></span></div>
                <div><span className="rhythm-dot break-dot" /><span><strong>5 minutes</strong><small>Short break</small></span></div>
              </>
            )}
          </div>
          <div className="focus-tip"><Sparkles size={16} /><p>Pick one small next step. When the timer ends, your break starts automatically.</p></div>
        </aside>
      </div>
    </section>
  );
}
