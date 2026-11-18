import assert from "node:assert/strict";
import { after, test } from "node:test";
import { handler } from "../netlify/functions/chat.mjs";
import { handler as healthHandler } from "../netlify/functions/health.mjs";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.GROQ_API_KEY;

after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalApiKey;
});

function request(body, httpMethod = "POST") {
  return { httpMethod, body: JSON.stringify(body) };
}

test("health function returns a successful status", async () => {
  const response = await healthHandler({ httpMethod: "GET" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
});

test("chat function rejects unsupported history roles", async () => {
  const response = await handler(request({
    question: "Can you help?",
    history: [{ role: "system", content: "Unexpected role" }],
  }));

  assert.equal(response.statusCode, 422);
});

test("chat function returns a helpful error when the key is missing", async () => {
  delete process.env.GROQ_API_KEY;
  const response = await handler(request({ question: "Help me plan my day" }));

  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).detail, "Set GROQ_API_KEY to enable AI answers.");
});

test("chat function includes web sources and conversation history", async () => {
  process.env.GROQ_API_KEY = " test-key\n";
  let groqPayload;
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith("https://html.duckduckgo.com/")) {
      return new Response(
        '<a class="result__a" href="https://example.edu/study">Campus study resources</a>'
        + '<a class="result__snippet">Find tutoring &amp; study groups.</a>',
        { status: 200 },
      );
    }

    assert.equal(options.headers.Authorization, "Bearer test-key");
    assert.equal(String(input), "https://api.groq.com/openai/v1/chat/completions");
    groqPayload = JSON.parse(options.body);
    assert.equal(groqPayload.model, "openai/gpt-oss-20b");
    assert.deepEqual(groqPayload.response_format, { type: "json_object" });
    return new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              answer: "Try the campus tutoring center [1].",
              taskSuggestions: [{
                title: "Review campus tutoring options",
                description: "Compare the available subjects and hours.",
                priority: "medium",
                dueDate: null,
              }],
              scheduleSuggestions: [],
            }),
          },
        }],
      }),
      { status: 200 },
    );
  };

  const response = await handler(request({
    question: "Where can I get study help?",
    history: [{ role: "user", content: "I am a student." }],
  }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.answer, "Try the campus tutoring center [1].");
  assert.equal(body.taskSuggestions[0].title, "Review campus tutoring options");
  assert.deepEqual(body.sources, [{
    title: "Campus study resources",
    url: "https://example.edu/study",
    snippet: "Find tutoring & study groups.",
  }]);
  assert.deepEqual(groqPayload.messages[1], {
    role: "user",
    content: "I am a student.",
  });
});

test("chat function explains when Groq rejects the API key", async () => {
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    if (String(input).startsWith("https://html.duckduckgo.com/")) {
      return new Response("", { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
      status: 401,
    });
  };

  const response = await handler(request({ question: "Help me plan my day" }));

  assert.equal(response.statusCode, 502);
  assert.equal(
    JSON.parse(response.body).detail,
    "Groq rejected the API key. Check GROQ_API_KEY in Netlify.",
  );
});

test("day planning uses local calendar context and returns proposed blocks", async () => {
  process.env.GROQ_API_KEY = "test-key";
  let calledGroq = false;
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://api.groq.com/openai/v1/chat/completions");
    calledGroq = true;
    const body = JSON.parse(options.body);
    assert.equal(body.messages[1].role, "system");
    assert.match(body.messages[1].content, /Biology lecture/);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: "Here is a proposed plan.",
            taskSuggestions: [],
            scheduleSuggestions: [{
              title: "Review biology notes",
              description: "Focus on the lecture topics.",
              date: "2026-11-18",
              time: "15:00",
              duration: 45,
            }],
          }),
        },
      }],
    }), { status: 200 });
  };

  const response = await handler(request({
    question: "Plan my day",
    intent: "plan_day",
    plannerContext: {
      today: "2026-11-18",
      tasks: [{ title: "Review biology notes", priority: "high", dueDate: "2026-11-19", done: false }],
      events: [{ title: "Biology lecture", date: "2026-11-18", time: "10:00", duration: 60 }],
    },
    history: [],
  }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(calledGroq, true);
  assert.equal(body.scheduleSuggestions[0].time, "15:00");
  assert.deepEqual(body.sources, []);
});
