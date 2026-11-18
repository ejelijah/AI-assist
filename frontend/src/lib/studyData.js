export const STORAGE = {
  chats: "study-compass-chat-sessions-v1",
  meetings: "study-compass-meetings-v1",
  tasks: "study-compass-tasks",
  demoEnabled: "study-compass-demo-mode",
  demoMeetings: "study-compass-demo-meetings-v1",
  demoTasks: "study-compass-demo-tasks-v1",
  focus: "study-compass-focus-v1",
};

export function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the current session usable if browser storage is unavailable or full.
  }
}

export function readList(key) {
  const saved = readJson(key, []);
  return Array.isArray(saved) ? saved : [];
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOffset(offset, base = new Date()) {
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  result.setDate(result.getDate() + offset);
  return dateKey(result);
}

export function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function formatDate(value, options = { month: "short", day: "numeric" }) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, options) : "";
}

export function normalizeTasks(items) {
  return items.filter((item) => item && typeof item.title === "string")
    .map((item) => ({
      id: item.id || createId(),
      title: item.title.trim().slice(0, 120),
      description: typeof item.description === "string" ? item.description.slice(0, 500) : "",
      priority: ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium",
      dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
      done: Boolean(item.done),
      createdAt: item.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.title);
}

export function normalizeMeetings(items) {
  return items.filter((item) => item && typeof item.title === "string" && item.date)
    .map((item) => ({
      id: item.id || createId(),
      title: item.title.trim().slice(0, 120),
      date: item.date,
      time: typeof item.time === "string" ? item.time : "09:00",
      duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : 30,
      location: typeof item.location === "string" ? item.location : "",
      attendees: typeof item.attendees === "string" ? item.attendees : "",
      notes: typeof item.notes === "string" ? item.notes : "",
      description: typeof item.description === "string" ? item.description : "",
      sourceTaskId: typeof item.sourceTaskId === "string" ? item.sourceTaskId : "",
    }))
    .filter((item) => item.title);
}

export function createDemoTasks() {
  return [
    {
      id: "demo-task-biology",
      title: "Review cell biology lecture notes",
      description: "Summarize the key concepts from this week’s lecture.",
      priority: "high",
      dueDate: dateOffset(1),
      done: false,
    },
    {
      id: "demo-task-essay",
      title: "Draft introduction for history essay",
      description: "Write a first draft and check the assignment rubric.",
      priority: "medium",
      dueDate: dateOffset(3),
      done: false,
    },
    {
      id: "demo-task-lab",
      title: "Submit chemistry lab reflection",
      description: "Upload the completed reflection to the course portal.",
      priority: "high",
      dueDate: dateOffset(2),
      done: false,
    },
    {
      id: "demo-task-reading",
      title: "Read assigned psychology chapter",
      description: "Chapter 6 reading and notes.",
      priority: "low",
      dueDate: dateOffset(0),
      done: true,
    },
  ];
}

export function createDemoMeetings() {
  return [
    {
      id: "demo-event-lecture",
      title: "Psychology lecture",
      date: dateOffset(0),
      time: "10:00",
      duration: 60,
      location: "Hall B · Room 204",
      notes: "Bring the reading notes.",
    },
    {
      id: "demo-event-study",
      title: "Biology study group",
      date: dateOffset(0),
      time: "14:30",
      duration: 60,
      location: "Library · Level 2",
    },
    {
      id: "demo-event-lab",
      title: "Chemistry lab",
      date: dateOffset(1),
      time: "11:00",
      duration: 90,
      location: "Science Building · Lab 3",
    },
    {
      id: "demo-event-advising",
      title: "Academic advising",
      date: dateOffset(2),
      time: "13:00",
      duration: 30,
      location: "Student Services",
    },
  ];
}

export function duplicateTask(tasks, candidate) {
  const normalize = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return tasks.some((task) =>
    normalize(task.title) === normalize(candidate.title)
    && task.dueDate === (candidate.dueDate || ""),
  );
}

export function eventConflicts(events, candidate, ignoreId = null) {
  const start = candidate.time;
  const startMinutes = Number(start?.slice(0, 2)) * 60 + Number(start?.slice(3, 5));
  const endMinutes = startMinutes + Number(candidate.duration || 30);
  return events.some((event) => {
    if (event.date !== candidate.date || event.id === ignoreId) return false;
    const eventStart = Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3, 5));
    const eventEnd = eventStart + Number(event.duration || 30);
    return startMinutes < eventEnd && eventStart < endMinutes;
  });
}

export function getDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
