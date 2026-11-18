import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceFocus,
  elapsedSecondsAt,
  FOCUS_DURATION,
  formatTimer,
  normalizeFocusState,
  transitionFocus,
} from "../src/lib/focusTimer.js";

test("saved legacy focus state defaults to Pomodoro mode", () => {
  const focus = normalizeFocusState({ status: "idle", remainingSeconds: 900 });

  assert.equal(focus.mode, "pomodoro");
  assert.equal(focus.remainingSeconds, 900);
  assert.equal(focus.elapsedSeconds, 0);
  assert.equal(normalizeFocusState(null).mode, "stopwatch");
});

test("stopwatch keeps counting beyond a Pomodoro and formats elapsed hours", () => {
  const started = transitionFocus(
    normalizeFocusState({ mode: "stopwatch" }),
    { type: "start" },
    1_000,
  );
  const longSession = advanceFocus(started, 1_000 + 90 * 60 * 1000);

  assert.equal(longSession.status, "focus");
  assert.equal(elapsedSecondsAt(longSession, 1_000 + 90 * 60 * 1000), 90 * 60);
  assert.equal(formatTimer(90 * 60), "01:30:00");
});

test("stopwatch pause and resume preserve elapsed time", () => {
  const started = transitionFocus(
    normalizeFocusState({ mode: "stopwatch" }),
    { type: "start" },
    10_000,
  );
  const paused = transitionFocus(started, { type: "pause" }, 70_000);
  const resumed = transitionFocus(paused, { type: "resume" }, 170_000);

  assert.equal(elapsedSecondsAt(paused, 100_000), 60);
  assert.equal(elapsedSecondsAt(resumed, 171_000), 61);
});

test("reset records a completed stopwatch session and clears elapsed time", () => {
  const started = transitionFocus(
    normalizeFocusState({ mode: "stopwatch" }),
    { type: "start" },
    1_000,
  );
  const reset = transitionFocus(started, { type: "reset" }, 31_000);

  assert.equal(reset.status, "idle");
  assert.equal(reset.elapsedSeconds, 0);
  assert.equal(reset.completedSessions, 1);
});

test("Pomodoro mode still starts with its timed focus and break cycle", () => {
  const started = transitionFocus(normalizeFocusState({ mode: "pomodoro" }), { type: "start" }, 1_000);
  const breakTime = advanceFocus(started, 1_000 + FOCUS_DURATION * 1000);

  assert.equal(started.remainingSeconds, FOCUS_DURATION);
  assert.equal(breakTime.status, "break");
  assert.equal(breakTime.completedSessions, 1);
});
