import asyncio
import os
from typing import Any, Literal

import httpx
from ddgs import DDGS
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

app = FastAPI(title="Student AI Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Question must not be blank.")
        return value


class Source(BaseModel):
    title: str
    url: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]


def _search_web(question: str) -> list[dict[str, str]]:
    results = DDGS().text(question, max_results=5)
    sources: list[dict[str, str]] = []
    for result in results:
        url = result.get("href") or result.get("url")
        if not url:
            continue
        sources.append(
            {
                "title": result.get("title") or url,
                "url": url,
                "snippet": result.get("body") or "",
            }
        )
    return sources


async def _generate_answer(
    question: str,
    sources: list[dict[str, str]],
    history: list[ChatMessage],
) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set OPENAI_API_KEY to enable AI answers.",
        )

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    source_text = "\n\n".join(
        f"[{index}] {source['title']}\nURL: {source['url']}\n"
        f"Excerpt: {source['snippet']}"
        for index, source in enumerate(sources, start=1)
    )
    if not source_text:
        source_text = "No useful web results were found."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful study assistant. Explain concepts clearly "
                "and concisely. Use the supplied web results as evidence, "
                "cite claims with source numbers like [1], and say when the "
                "sources do not establish an answer. Do not invent citations. "
                "Use the conversation history to understand follow-up questions."
            ),
        },
        *[
            {"role": message.role, "content": message.content}
            for message in history
        ],
        {
            "role": "user",
            "content": f"Student question:\n{question}\n\nWeb results:\n{source_text}",
        },
    ]
    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0.2,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="The configured AI service could not complete the request.",
        ) from exc
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an unexpected response.",
        ) from exc

    try:
        answer = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an unexpected response.",
        ) from exc

    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an empty answer.",
        )
    return answer.strip()


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        sources = await asyncio.to_thread(_search_web, request.question)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Web search failed. Check your internet connection and try again.",
        ) from exc

    answer = await _generate_answer(request.question, sources, request.history)
    return ChatResponse(answer=answer, sources=sources)
