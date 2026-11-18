const host = "http://127.0.0.1:9223";
const targets = await fetch(`${host}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1:5174"))
  ?? targets.find((item) => item.type === "page");
if (!target) throw new Error("No isolated Chrome page is available.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function evaluate(expression) {
  const response = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await command("Page.enable");
await command("Runtime.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await command("Page.navigate", { url: "http://127.0.0.1:5174/" });
await wait(1000);

const now = new Date().toISOString();
const seedTasks = [{
  id: "smoke-seed",
  title: "Persistence seed task",
  description: "",
  priority: "medium",
  dueDate: "",
  done: false,
}];
const seedChat = [{
  id: "smoke-chat",
  title: "Action smoke test",
  createdAt: now,
  updatedAt: now,
  messages: [{
    id: "smoke-assistant",
    role: "assistant",
    content: "## A practical next step\nReview the course notes.",
    createdAt: now,
    sources: [{ title: "Study skills", url: "https://example.edu/study", snippet: "A real source card." }],
    taskSuggestions: [{
      title: "AI-generated task",
      description: "Review the lecture notes.",
      priority: "high",
      dueDate: null,
    }],
    scheduleSuggestions: [{
      title: "AI-proposed study block",
      description: "A review session.",
      date: "2026-11-18",
      time: "17:00",
      duration: 45,
    }],
    addedTaskSuggestionIds: [],
    addedScheduleSuggestionIds: [],
  }],
}];
const storageSeed = {
  "study-compass-tasks": seedTasks,
  "study-compass-meetings-v1": [],
  "study-compass-chat-sessions-v1": seedChat,
  "study-compass-demo-mode": false,
};
await evaluate(`(() => {
  const values = ${JSON.stringify(storageSeed)};
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  location.reload();
})()`);
await wait(1000);

const results = {};
results.dashboard = await evaluate("document.body.innerText.includes('What would you like to do?')");
await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('AI assistant')).click()");
await wait(250);
results.markdown = await evaluate("Boolean(document.querySelector('.markdown-content h2'))");
results.sourceCard = await evaluate("Boolean(document.querySelector('.source-card[href=\"https://example.edu/study\"]'))");
await evaluate("[...document.querySelectorAll('.suggestion-add-button')].find((button) => button.innerText.includes('Add to planner')).click()");
await wait(300);
results.aiTaskAdded = await evaluate("document.body.innerText.includes('AI-generated task') && [...document.querySelectorAll('.suggestion-added-button')].some((button) => button.innerText.includes('Added'))");
await evaluate("[...document.querySelectorAll('.suggestion-add-button')].find((button) => button.innerText.includes('Add to calendar')).click()");
await wait(300);
const eventState = await evaluate(`({
  meetings: JSON.parse(localStorage.getItem('study-compass-meetings-v1')),
  button: [...document.querySelectorAll('.action-suggestions button')].map((item) => item.innerText),
  toast: document.querySelector('.toast')?.innerText ?? ''
})`);
results.aiEventAdded = eventState.meetings.some((event) => event.title === "AI-proposed study block");
if (!results.aiEventAdded) results.eventDebug = eventState;

await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('Planner')).click()");
await wait(200);
await evaluate(`(() => {
  const input = document.querySelector('.task-editor input[placeholder^="e.g. Draft"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Created from planner smoke check');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.task-editor').requestSubmit();
})()`);
await wait(350);
results.taskCreated = await evaluate("document.body.innerText.includes('Created from planner smoke check')");
await command("Page.reload");
await wait(900);
await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('Planner')).click()");
await wait(200);
results.taskPersisted = await evaluate("document.body.innerText.includes('Created from planner smoke check')");
await evaluate(`(() => {
  const row = [...document.querySelectorAll('.task')].find((item) => item.innerText.includes('Created from planner smoke check'));
  row.querySelector('.task-check').click();
})()`);
await wait(250);
results.taskCompleted = await evaluate("[...document.querySelectorAll('.task')].some((item) => item.innerText.includes('Created from planner smoke check') && item.classList.contains('done'))");

await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('Calendar')).click()");
await wait(200);
results.calendarWeek = await evaluate("Boolean(document.querySelector('.week-calendar'))");
await evaluate("[...document.querySelectorAll('.calendar-view-toggle button')].find((button) => button.innerText === 'Day').click()");
results.calendarDay = await evaluate("document.body.innerText.includes('YOUR DAY')");
await evaluate("[...document.querySelectorAll('.calendar-view-toggle button')].find((button) => button.innerText === 'Month').click()");
results.calendarMonth = await evaluate("Boolean(document.querySelector('.month-grid'))");

await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('Focus mode')).click()");
await wait(200);
results.focusTimer = await evaluate("document.body.innerText.includes('25:00')");
await evaluate("document.querySelector('.timer-controls .primary-button').click()");
await wait(150);
results.focusRuns = await evaluate("document.body.innerText.includes('Pause')");
await evaluate("[...document.querySelectorAll('.nav-item')].find((item) => item.innerText.includes('Dashboard')).click()");
await wait(200);
await evaluate("document.querySelector('.demo-switch').click()");
await wait(250);
results.demoLabelled = await evaluate("document.body.innerText.includes('Demo experience is on')");
results.personalDataPreserved = await evaluate("JSON.parse(localStorage.getItem('study-compass-tasks')).some((task) => task.title === 'Created from planner smoke check')");

socket.close();
const failed = Object.entries(results).filter(([, passed]) => !passed);
console.log(JSON.stringify(results));
if (failed.length) throw new Error(`Browser smoke checks failed: ${failed.map(([name]) => name).join(", ")}`);
