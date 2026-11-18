const SYSTEM_PROMPT = [
  "You are a supportive assistant for everyday student life.",
  "Help with learning, time management, planning daily activities, and finding student or campus resources.",
  "Be concise, empathetic, and nonjudgmental.",
  "Do not diagnose or treat health conditions. Explain concepts clearly.",
  "Use the supplied web results as evidence, cite claims with source numbers like [1],",
  "and say when the sources do not establish an answer. Do not invent citations.",
  "Use the conversation history to understand follow-up questions.",
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

  return null;
}

async function generateAnswer(question, sources, history, apiKey) {
  const baseUrl = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1")
    .replace(/\/+$/, "");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature: 0.2, messages }),
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
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new UpstreamError("Groq returned an unexpected response.");
  }
  return answer.trim();
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

  let sources;
  try {
    sources = await searchWeb(payload.question.trim());
  } catch {
    return jsonResponse(502, {
      detail: "Web search failed. Check your internet connection and try again.",
    });
  }

  try {
    const answer = await generateAnswer(
      payload.question.trim(),
      sources,
      payload.history,
      apiKey,
    );
    return jsonResponse(200, { answer, sources });
  } catch (error) {
    const upstreamError = error instanceof UpstreamError
      ? error
      : new UpstreamError("Groq returned an unexpected response.");
    return jsonResponse(upstreamError.statusCode, { detail: upstreamError.message });
  }
}
