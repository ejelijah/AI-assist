export const FOCUS_DURATION = 25 * 60;
export const BREAK_DURATION = 5 * 60;

const FOCUS_STATUSES = ["idle", "focus", "paused_focus", "break", "paused_break"];

export function normalizeFocusState(saved) {
  if (!saved || typeof saved !== "object") {
    return {
      mode: "stopwatch",
      status: "idle",
      remainingSeconds: FOCUS_DURATION,
      elapsedSeconds: 0,
      endsAt: null,
      startedAt: null,
      selectedTaskId: "",
      completedSessions: 0,
    };
  }

  return {
    mode: saved.mode === "stopwatch" ? "stopwatch" : "pomodoro",
    status: FOCUS_STATUSES.includes(saved.status) ? saved.status : "idle",
    remainingSeconds: Number.isFinite(saved.remainingSeconds) ? saved.remainingSeconds : FOCUS_DURATION,
    elapsedSeconds: Number.isFinite(saved.elapsedSeconds) ? Math.max(0, saved.elapsedSeconds) : 0,
    endsAt: Number.isFinite(saved.endsAt) ? saved.endsAt : null,
    startedAt: Number.isFinite(saved.startedAt) ? saved.startedAt : null,
    selectedTaskId: typeof saved.selectedTaskId === "string" ? saved.selectedTaskId : "",
    completedSessions: Number.isFinite(saved.completedSessions) ? Math.max(0, saved.completedSessions) : 0,
  };
}

export function elapsedSecondsAt(focus, now = Date.now()) {
  if (focus.mode !== "stopwatch" || focus.status !== "focus" || !Number.isFinite(focus.startedAt)) {
    return focus.elapsedSeconds;
  }
  return focus.elapsedSeconds + Math.max(0, Math.floor((now - focus.startedAt) / 1000));
}

export function advanceFocus(focus, now = Date.now()) {
  if (focus.mode === "stopwatch") {
    if (focus.status !== "focus" || !Number.isFinite(focus.startedAt)) return focus;
    const seconds = Math.max(0, Math.floor((now - focus.startedAt) / 1000));
    if (!seconds) return focus;
    return {
      ...focus,
      elapsedSeconds: focus.elapsedSeconds + seconds,
      startedAt: focus.startedAt + seconds * 1000,
    };
  }

  if (focus.status !== "focus" && focus.status !== "break") return focus;
  const remainingSeconds = Math.max(0, Math.ceil((focus.endsAt - now) / 1000));
  if (remainingSeconds > 0) {
    return remainingSeconds === focus.remainingSeconds ? focus : { ...focus, remainingSeconds };
  }
  if (focus.status === "focus") {
    const breakEndsAt = focus.endsAt + BREAK_DURATION * 1000;
    if (now >= breakEndsAt) {
      return {
        ...focus,
        status: "idle",
        remainingSeconds: FOCUS_DURATION,
        endsAt: null,
        completedSessions: focus.completedSessions + 1,
      };
    }
    return {
      ...focus,
      status: "break",
      remainingSeconds: Math.ceil((breakEndsAt - now) / 1000),
      endsAt: breakEndsAt,
      completedSessions: focus.completedSessions + 1,
    };
  }
  return { ...focus, status: "idle", remainingSeconds: FOCUS_DURATION, endsAt: null };
}

export function transitionFocus(focus, action, now = Date.now()) {
  if (action.type === "select-task") {
    if (focus.status === "focus" || focus.status === "break") return focus;
    return { ...focus, selectedTaskId: action.taskId };
  }
  if (action.type === "set-mode") {
    if (focus.status !== "idle" || !["stopwatch", "pomodoro"].includes(action.mode)) return focus;
    return {
      ...focus,
      mode: action.mode,
      remainingSeconds: FOCUS_DURATION,
      elapsedSeconds: 0,
      endsAt: null,
      startedAt: null,
    };
  }
  if (action.type === "start" && focus.status === "idle") {
    if (focus.mode === "stopwatch") {
      return { ...focus, status: "focus", startedAt: now, endsAt: null };
    }
    return {
      ...focus,
      status: "focus",
      remainingSeconds: focus.remainingSeconds || FOCUS_DURATION,
      endsAt: now + (focus.remainingSeconds || FOCUS_DURATION) * 1000,
    };
  }
  if (action.type === "pause" && (focus.status === "focus" || focus.status === "break")) {
    if (focus.mode === "stopwatch") {
      return {
        ...focus,
        status: "paused_focus",
        elapsedSeconds: elapsedSecondsAt(focus, now),
        startedAt: null,
      };
    }
    return {
      ...focus,
      status: focus.status === "focus" ? "paused_focus" : "paused_break",
      remainingSeconds: Math.max(0, Math.ceil((focus.endsAt - now) / 1000)),
      endsAt: null,
    };
  }
  if (action.type === "resume" && (focus.status === "paused_focus" || focus.status === "paused_break")) {
    if (focus.mode === "stopwatch") {
      return { ...focus, status: "focus", startedAt: now };
    }
    const status = focus.status === "paused_focus" ? "focus" : "break";
    return { ...focus, status, endsAt: now + focus.remainingSeconds * 1000 };
  }
  if (action.type === "reset") {
    const completed = focus.mode === "stopwatch" && elapsedSecondsAt(focus, now) > 0 ? 1 : 0;
    return {
      ...focus,
      status: "idle",
      remainingSeconds: FOCUS_DURATION,
      elapsedSeconds: 0,
      endsAt: null,
      startedAt: null,
      completedSessions: focus.completedSessions + completed,
    };
  }
  return focus;
}

export function formatTimer(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const remainder = (total % 60).toString().padStart(2, "0");
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes}:${remainder}`
    : `${Math.floor(total / 60).toString().padStart(2, "0")}:${remainder}`;
}
