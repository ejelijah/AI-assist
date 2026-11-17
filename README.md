
# Student AI Assistant

A student-focused assistant that answers questions using web search results and
provides links to its sources. The first version also includes a lightweight
study planner whose tasks are saved in the browser.

## Requirements

- Python 3.10+
- Node.js 20+
- An API key for an OpenAI-compatible chat-completions service

## Run locally

1. In `backend`, create and activate a virtual environment, then install
   dependencies:

   ```sh
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Set the model API key in your shell. Keep it private; do not commit it:

   ```sh
   export OPENAI_API_KEY="your-key"
   ```

   Optional settings are `OPENAI_BASE_URL` and `OPENAI_MODEL`. Defaults are
   shown in `.env.example`.

3. Start the Python API:

   ```sh
   uvicorn main:app --reload
   ```

4. In a second terminal, start the web app:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

5. Open the local URL printed by Vite (usually `http://localhost:5173`).

The chat searches the web for relevant resources and asks the configured model
to answer using those results. It requires internet access and an API key. The
study planner stores tasks in that browser's local storage; it does not sync
between devices.

## Project layout

- `backend/`: FastAPI endpoint, web search, and model integration
- `frontend/`: React interface for chat and study planning

## Important limitations

This is an early prototype, not a substitute for checking course materials or
professional advice. Search results and generated explanations can be
incomplete or incorrect. Avoid entering sensitive personal information.

