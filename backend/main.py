import asyncio
import json
import os
from pathlib import Path
from typing import Any, Literal

import httpx
from ddgs import DDGS
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Student AI Assistant API")

allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
allowed_origins.extend(
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGIN", "").split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
    intent: Literal["chat", "plan_day"] = "chat"
    planner_context: dict[str, Any] | None = Field(default=None, alias="plannerContext")

    model_config = ConfigDict(populate_by_name=True)

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


class TaskSuggestion(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = Field(default=None, alias="dueDate")

    model_config = ConfigDict(populate_by_name=True)


class ScheduleSuggestion(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    date: str
    time: str
    duration: int = Field(ge=15, le=180)


class ModelAnswer(BaseModel):
    answer: str = Field(min_length=1)
    task_suggestions: list[TaskSuggestion] = Field(default_factory=list, alias="taskSuggestions")
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list, alias="scheduleSuggestions")

    model_config = ConfigDict(populate_by_name=True)


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    task_suggestions: list[TaskSuggestion] = Field(default_factory=list, alias="taskSuggestions")
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list, alias="scheduleSuggestions")

    model_config = ConfigDict(populate_by_name=True)


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
    intent: str = "chat",
    planner_context: dict[str, Any] | None = None,
) -> ModelAnswer:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set GROQ_API_KEY to enable AI answers.",
        )

    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
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
                "You are a supportive assistant for everyday student life. Help with learning, "
                "time management, daily planning, and finding student or campus resources. "
                "Be concise, empathetic, and nonjudgmental. Do not diagnose or treat health "
                "conditions. Cite factual claims with supplied web source numbers like [1]; "
                "never invent sources or citations. Return a JSON object with exactly these "
                "keys: answer, taskSuggestions, scheduleSuggestions. answer is helpful Markdown. "
                "taskSuggestions is an array of actionable tasks with title, description, "
                "priority (low, medium, high), and dueDate (YYYY-MM-DD or null). Only suggest "
                "tasks for planning/prioritizing requests. Never invent deadlines; use a date "
                "only when supplied by the student or planner context, otherwise null. "
                "scheduleSuggestions is an array of proposed calendar blocks with title, "
                "description, date (YYYY-MM-DD), time (24-hour HH:MM), and duration in minutes. "
                "Only return schedule blocks for a day-planning request. Respect existing events "
                "and task deadlines; do not overlap events. Proposed times are for student review, "
                "not existing events. Use empty arrays when there are no suitable actions. "
                "Return no text outside the JSON object. Use conversation history for follow-ups."
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
    if intent == "plan_day" and planner_context is not None:
        messages.insert(
            1,
            {
                "role": "system",
                "content": (
                    "Student's local planning context for "
                    f"{planner_context.get('today', '')}:\n"
                    f"{json.dumps(planner_context, ensure_ascii=False)}"
                ),
            },
        )
    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
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
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an unexpected response.",
        ) from exc

    if not isinstance(content, str) or not content.strip():
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an empty answer.",
        )
    try:
        result = ModelAnswer.model_validate_json(content)
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an unexpected response.",
        ) from exc
    if not result.answer.strip():
        raise HTTPException(
            status_code=502,
            detail="The AI service returned an empty answer.",
        )
    return result.model_copy(update={"answer": result.answer.strip()})


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    sources: list[dict[str, str]] = []
    if request.intent != "plan_day":
        try:
            sources = await asyncio.to_thread(_search_web, request.question)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Web search failed. Check your internet connection and try again.",
            ) from exc

    result = await _generate_answer(
        request.question,
        sources,
        request.history,
        request.intent,
        request.planner_context,
    )
    return ChatResponse(
        answer=result.answer,
        sources=sources,
        task_suggestions=result.task_suggestions,
        schedule_suggestions=(
            result.schedule_suggestions if request.intent == "plan_day" else []
        ),
    )
