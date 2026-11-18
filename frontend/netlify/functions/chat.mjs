const SYSTEM_PROMPT = [
  "You are a supportive assistant for everyday student life. Help with learning, time management,",
  "daily planning, and finding student or campus resources. Be concise, empathetic, and nonjudgmental.",
  "Do not diagnose or treat health conditions. Use the supplied web results as evidence, cite factual",
  "claims with source numbers like [1], and never invent sources or citations.",
  "Return a JSON object with exactly these keys: answer, taskSuggestions, scheduleSuggestions.",
  "answer is a helpful Markdown string. taskSuggestions is an array of actionable tasks, each with",
  "title, description, priority (low, medium, or high), and dueDate (YYYY-MM-DD or null).",
  "Only include task suggestions when the conversation asks for planning, prioritizing, or actionable",
  "next steps. Never invent deadlines; use a due date only when the student explicitly provided one",
  "or it appears in the supplied planner context. Otherwise use null.",
  "scheduleSuggestions is an array of proposed calendar blocks, each with title, description, date",
  "(YYYY-MM-DD), time (24-hour HH:MM), and duration (minutes). Only return these for a day-planning",
  "request. Respect existing events and task deadlines in the planner context; do not overlap events.",
  "Suggested times are proposals for the student to review, not existing events.",
  "Use empty arrays when there are no suitable actions. Do not add any text outside the JSON object.",
  "Use conversation history to understand follow-up questions.",
].join(" ");

class UpstreamError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function decodeHtml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code) => {
    if (code[0] === "#") {
      const hex = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }

    return {
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
      nbsp: " ",
    }[code.toLowerCase()] ?? entity;
  });
}

function plainText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return result;
}

function parseSearchResults(html) {
  const snippets = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter(([, attrs]) => (attributes(attrs).class ?? "").split(/\s+/).includes("result__snippet"))
    .map(([, , content]) => plainText(content));
  const results = [];

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = attributes(match[1]);
    if (!(attrs.class ?? "").split(/\s+/).includes("result__a")) continue;

    let url;
    try {
      const link = new URL(decodeHtml(attrs.href ?? ""), "https://html.duckduckgo.com");
      url = link.searchParams.get("uddg") || link.href;
      if (!["http:", "https:"].includes(new URL(url).protocol)) continue;
    } catch {
      continue;
    }

    const title = plainText(match[2]);
    if (!title) continue;
    results.push({
      title,
      url,
      snippet: snippets[results.length] ?? "",
    });
    if (results.length === 5) break;
  }

  return results;
}

async function searchWeb(question) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(question)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 StudyCompass/1.0" },
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error("Web search request failed.");
  return parseSearchResults(await response.text());
}

function validateRequest(payload) {
  if (
    typeof payload?.question !== "string"
    || !payload.question.trim()
    || payload.question.length > 1000
  ) {
    return "Question must contain 1 to 1000 characters.";
  }

  const history = payload.history;
  if (!Array.isArray(history) || history.length > 20) {
    return "History must contain no more than 20 messages.";
  }

  for (const message of history) {
    if (
      !["user", "assistant"].includes(message?.role)
      || typeof message.content !== "string"
      || message.content.length < 1
      || message.content.length > 4000
    ) {
      return "History messages must have a user or assistant role and contain 1 to 4000 characters.";
    }
  }

  if (payload.intent !== undefined && !["chat", "plan_day"].includes(payload.intent)) {
    return "Intent must be chat or plan_day.";
  }
  if (payload.plannerContext !== undefined) {
    const context = payload.plannerContext;
    if (
      !context
      || typeof context !== "object"
      || typeof context.today !== "string"
      || !Array.isArray(context.tasks)
      || !Array.isArray(context.events)
      || context.tasks.length > 50
      || context.events.length > 50
    ) {
      return "Planner context must include a date and task and event lists.";
    }
  }

  return null;
}

function cleanTaskSuggestions(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 10).flatMap((item) => {
    if (!item || typeof item.title !== "string" || !item.title.trim()) return [];
    const priority = ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium";
    const dueDate = typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
      ? item.dueDate
      : null;
    return [{
      title: item.title.trim().slice(0, 120),
      description: typeof item.description === "string" ? item.description.slice(0, 500) : "",
      priority,
      dueDate,
    }];
  });
}

function cleanScheduleSuggestions(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 10).flatMap((item) => {
    if (
      !item
      || typeof item.title !== "string"
      || !item.title.trim()
      || typeof item.date !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
      || typeof item.time !== "string"
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)
    ) {
      return [];
    }
    const duration = Number(item.duration);
    if (!Number.isInteger(duration) || duration < 15 || duration > 180) return [];
    return [{
      title: item.title.trim().slice(0, 120),
      description: typeof item.description === "string" ? item.description.slice(0, 500) : "",
      date: item.date,
      time: item.time,
      duration,
    }];
  });
}

async function generateAnswer(question, sources, history, apiKey, intent, plannerContext) {
  const baseUrl = (process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1")
    .replace(/\/+$/, "");
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const sourceText = sources.length
    ? sources.map((source, index) => (
      `[${index + 1}] ${source.title}\nURL: ${source.url}\nExcerpt: ${source.snippet}`
    )).join("\n\n")
    : "No useful web results were found.";
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    {
      role: "user",
      content: `Student question:\n${question}\n\nWeb results:\n${sourceText}`,
    },
  ];
  if (intent === "plan_day" && plannerContext) {
    messages.splice(1, 0, {
      role: "system",
      content: `Student's local planning context for ${plannerContext.today}:\n${JSON.stringify({
        tasks: plannerContext.tasks,
        events: plannerContext.events,
      })}`,
    });
  }
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new UpstreamError("Groq took too long to respond. Please try again.", 504);
    }
    throw new UpstreamError("Could not reach Groq. Check its status and try again.");
  }
  if (!response.ok) {
    console.error("Groq chat completion failed with HTTP", response.status);
    if (response.status === 401 || response.status === 403) {
      throw new UpstreamError("Groq rejected the API key. Check GROQ_API_KEY in Netlify.");
    }
    if (response.status === 404) {
      throw new UpstreamError("Groq could not find the configured model or API endpoint. Check GROQ_MODEL and GROQ_BASE_URL.");
    }
    if (response.status === 429) {
      throw new UpstreamError("Groq rate limit or usage quota reached. Check your Groq account.");
    }
    if (response.status >= 500) {
      throw new UpstreamError("Groq is temporarily unavailable. Please try again.");
    }
    throw new UpstreamError("Groq rejected the request. Check that GROQ_MODEL is valid.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new UpstreamError("Groq returned an unexpected response.");
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new UpstreamError("Groq returned an unexpected response.");
  }
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new UpstreamError("Groq returned an unexpected response.");
  }
  if (typeof result.answer !== "string" || !result.answer.trim()) {
    throw new UpstreamError("Groq returned an unexpected response.");
  }
  return {
    answer: result.answer.trim(),
    taskSuggestions: cleanTaskSuggestions(result.taskSuggestions),
    scheduleSuggestions: intent === "plan_day" ? cleanScheduleSuggestions(result.scheduleSuggestions) : [],
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { detail: "Method not allowed." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { detail: "Request body must be valid JSON." });
  }

  if (payload && payload.history === undefined) payload.history = [];
  const validationError = validateRequest(payload);
  if (validationError) return jsonResponse(422, { detail: validationError });

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(503, { detail: "Set GROQ_API_KEY to enable AI answers." });
  }

  let sources = [];
  if ((payload.intent || "chat") !== "plan_day") {
    try {
      sources = await searchWeb(payload.question.trim());
    } catch {
      return jsonResponse(502, {
        detail: "Web search failed. Check your internet connection and try again.",
      });
    }
  }

  try {
    const result = await generateAnswer(
      payload.question.trim(),
      sources,
      payload.history,
      apiKey,
      payload.intent || "chat",
      payload.plannerContext,
    );
    return jsonResponse(200, { ...result, sources });
  } catch (error) {
    const upstreamError = error instanceof UpstreamError
      ? error
      : new UpstreamError("Groq returned an unexpected response.");
    return jsonResponse(upstreamError.statusCode, { detail: upstreamError.message });
  }
}
