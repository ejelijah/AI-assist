import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Clock3,
  ExternalLink,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import MarkdownContent from "./MarkdownContent.jsx";
import { duplicateTask, formatDate, getDomain, eventConflicts } from "../lib/studyData.js";

const SUGGESTIONS = [
  "Help me organize my day.",
  "Explain a difficult academic concept.",
  "Find resources for my assignment.",
  "Help me prioritize my deadlines.",
  "Create a study plan for my exams.",
  "Research a topic for me.",
];

function SourceCards({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="message-sources">
      <p className="source-heading">Sources from web search</p>
      <div className="source-grid">
        {sources.map((source, index) => (
          <a
            className="source-card"
            href={source.url}
            key={`${source.url}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="source-card-top"><span>0{index + 1}</span><ExternalLink size={14} /></span>
            <strong>{source.title}</strong>
            {source.snippet && <small>{source.snippet}</small>}
            <span className="source-domain">{getDomain(source.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function TaskSuggestions({ message, tasks, onAddTask }) {
  if (!message.taskSuggestions?.length) return null;
  const addedIds = message.addedTaskSuggestionIds ?? [];

  return (
    <section className="action-suggestions" aria-label="Suggested planner tasks">
      <div className="suggestion-section-heading">
        <span><Check size={15} /> Suggested next steps</span>
        <small>Review each one before adding it</small>
      </div>
      <div className="suggested-task-list">
        {message.taskSuggestions.map((task, index) => {
          const suggestionId = task.id || `${message.id}-task-${index}`;
          const added = addedIds.includes(suggestionId);
          const duplicate = duplicateTask(tasks, task);
          return (
            <article className="suggested-task" key={suggestionId}>
              <div className="suggestion-task-copy">
                <div className="suggestion-task-title">
                  <strong>{task.title}</strong>
                  <span className={`priority-pill priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span>
                </div>
                {task.description && <p>{task.description}</p>}
                <small>{task.dueDate ? `Due ${formatDate(task.dueDate, { month: "short", day: "numeric", year: "numeric" })}` : "No deadline provided"}</small>
              </div>
              <button
                className={added || duplicate ? "suggestion-added-button" : "suggestion-add-button"}
                disabled={added || duplicate}
                onClick={() => onAddTask(task, suggestionId, message.id)}
              >
                {added || duplicate ? <><Check size={14} /> {added ? "Added" : "Already planned"}</> : <><Plus size={14} /> Add to planner</>}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ScheduleSuggestions({ message, meetings, onAddMeeting }) {
  if (!message.scheduleSuggestions?.length) return null;
  const addedIds = message.addedScheduleSuggestionIds ?? [];

  return (
    <section className="action-suggestions" aria-label="Suggested calendar schedule">
      <div className="suggestion-section-heading">
        <span><Clock3 size={15} /> Proposed schedule</span>
        <small>Review before adding; existing events are left untouched</small>
      </div>
      <div className="suggested-task-list">
        {message.scheduleSuggestions.map((event, index) => {
          const suggestionId = event.id || `${message.id}-event-${index}`;
          const added = addedIds.includes(suggestionId);
          const conflict = eventConflicts(meetings, event);
          return (
            <article className="suggested-task" key={suggestionId}>
              <div className="suggestion-task-copy">
                <div className="suggestion-task-title"><strong>{event.title}</strong><span className="schedule-time">{event.time}</span></div>
                <p>{formatDate(event.date, { weekday: "short", month: "short", day: "numeric" })} · {event.duration} min</p>
                {event.description && <small>{event.description}</small>}
                {conflict && <small className="conflict-label">This overlaps an existing calendar event.</small>}
              </div>
              <button
                className={added || conflict ? "suggestion-added-button" : "suggestion-add-button"}
                disabled={added || conflict}
                onClick={() => onAddMeeting(event, suggestionId, message.id)}
              >
                {added ? <><Check size={14} /> Added</> : conflict ? "Time conflict" : <><Plus size={14} /> Add to calendar</>}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChatMessage({ message, tasks, meetings, onAddTask, onAddMeeting }) {
  const assistant = message.role === "assistant";
  return (
    <article className={`message-row ${assistant ? "assistant-row" : "user-row"}`}>
      {assistant && <div className="assistant-avatar"><Sparkles size={16} /></div>}
      <div className="message-content">
        <p className="message-author">{assistant ? "Compass" : "You"} <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span></p>
        <div className={`message-bubble ${assistant ? "assistant-bubble" : "user-bubble"}`}>
          {assistant ? <MarkdownContent>{message.content}</MarkdownContent> : <p>{message.content}</p>}
        </div>
        {assistant && (
          <>
            <SourceCards sources={message.sources} />
            <TaskSuggestions message={message} tasks={tasks} onAddTask={onAddTask} />
            <ScheduleSuggestions message={message} meetings={meetings} onAddMeeting={onAddMeeting} />
          </>
        )}
      </div>
    </article>
  );
}

export default function ChatView({
  session,
  busy,
  requestError,
  draftSeed,
  tasks,
  meetings,
  onSend,
  onRetry,
  onAddTask,
  onAddMeeting,
}) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, busy]);

  useEffect(() => {
    if (!draftSeed) return;
    setDraft(draftSeed.text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [draftSeed?.id]);

  function submit(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    onSend(question);
    setDraft("");
  }

  return (
    <section className="chat-workspace">
      <div className="chat-intro">
        <div>
          <p className="eyebrow">YOUR STUDENT COMPANION</p>
          <h1>{session.messages.length ? session.title : "What’s on your mind today?"}</h1>
          <p className="muted">Ask a question, explore a topic, or turn a good idea into a next step.</p>
        </div>
        <div className="search-status"><span /> Web research enabled</div>
      </div>

      <div aria-live="polite" className="conversation">
        {session.messages.length === 0 ? (
          <div className="welcome-card">
            <div className="welcome-icon"><Sparkles size={22} /></div>
            <p className="welcome-title">A thoughtful place to start</p>
            <p className="muted">Compass can find real web resources and help you make a plan. Review any suggested actions before saving.</p>
            <div className="suggestion-list">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => onSend(suggestion)}>
                  <span>{suggestion}</span><ArrowUp aria-hidden="true" size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          session.messages.map((message) => (
            <ChatMessage
              key={message.id}
              meetings={meetings}
              message={message}
              onAddMeeting={onAddMeeting}
              onAddTask={onAddTask}
              tasks={tasks}
            />
          ))
        )}
        {busy && (
          <div className="message-row assistant-row">
            <div className="assistant-avatar"><Sparkles size={16} /></div>
            <div className="message-content">
              <p className="message-author">Compass</p>
              <div className="message-bubble assistant-bubble typing-indicator">
                <span className="typing-dots"><i /><i /><i /></span>
                <span>Searching and thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {requestError && (
        <div className="request-error" role="alert">
          <span>{requestError.message}</span>
          {requestError.canRetry && <button onClick={onRetry}>Retry</button>}
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
          placeholder="Ask Compass anything about your student day…"
          ref={inputRef}
          rows={2}
          value={draft}
        />
        <div className="composer-footer">
          <span>Enter to send · Shift + Enter for a new line</span>
          <button className="send-button" disabled={!draft.trim() || busy} aria-label="Send message">
            <span>Send</span><Send aria-hidden="true" size={14} />
          </button>
        </div>
      </form>
      <p className="privacy-note">Chats, planner, and calendar stay in this browser. Questions and search context are sent to the AI service.</p>
    </section>
  );
}
