import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  createDemoMeetings,
  createDemoTasks,
  duplicateTask,
  eventConflicts,
  normalizeTasks,
  readJson,
  writeJson,
} from "../src/lib/studyData.js";

const originalStorage = globalThis.localStorage;

after(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

test("legacy planner tasks are normalized without losing completion or deadline", () => {
  const [task] = normalizeTasks([{
    id: "legacy",
    title: "  Read the assignment  ",
    dueDate: "2026-11-20",
    done: true,
  }]);

  assert.equal(task.title, "Read the assignment");
  assert.equal(task.dueDate, "2026-11-20");
  assert.equal(task.done, true);
  assert.equal(task.priority, "medium");
});

test("task duplicate detection matches normalized titles and deadlines", () => {
  const tasks = [{ title: "Review biology notes", dueDate: "2026-11-20" }];

  assert.equal(duplicateTask(tasks, { title: " review   BIOLOGY notes ", dueDate: "2026-11-20" }), true);
  assert.equal(duplicateTask(tasks, { title: "Review biology notes", dueDate: "2026-11-21" }), false);
});

test("calendar conflict detection rejects overlap but permits adjacent events", () => {
  const events = [{ date: "2026-11-20", time: "10:00", duration: 60 }];

  assert.equal(eventConflicts(events, { date: "2026-11-20", time: "10:30", duration: 30 }), true);
  assert.equal(eventConflicts(events, { date: "2026-11-20", time: "11:00", duration: 30 }), false);
  assert.equal(eventConflicts(events, { date: "2026-11-21", time: "10:30", duration: 30 }), false);
});

test("demo data provides tasks and events without coupling to personal storage", () => {
  const tasks = createDemoTasks();
  const events = createDemoMeetings();
  const store = new Map([["study-compass-tasks", JSON.stringify([{ title: "Personal task" }])]]);
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };

  writeJson("study-compass-demo-tasks-v1", tasks);

  assert.ok(tasks.some((task) => task.done));
  assert.ok(events.length > 0);
  assert.equal(readJson("study-compass-tasks", [])[0].title, "Personal task");
  assert.equal(readJson("study-compass-demo-tasks-v1", []).length, tasks.length);
});
