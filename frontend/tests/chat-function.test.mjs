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
  process.env.GROQ_API_KEY = "test-key";
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
    groqPayload = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Try the campus tutoring center [1]." } }],
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
