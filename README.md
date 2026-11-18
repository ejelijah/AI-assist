
# StudyCompass Student Daily Assistant

A student daily-life assistant that answers questions using web search results
and provides links to its sources. It also includes a calendar and a daily
planner whose events and tasks are saved in the browser.

## Requirements

- Python 3.10+
- Node.js 20+
- A [GroqCloud API key](https://console.groq.com/keys)

## Run locally

1. In `backend`, create and activate a virtual environment, then install
   dependencies:

   ```sh
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Set your Groq API key in the backend shell. Keep it private; do not commit it:

   ```sh
   export GROQ_API_KEY="your-key"
   ```

   Optional settings are `GROQ_BASE_URL` and `GROQ_MODEL`. Defaults are shown
   in `.env.example`.

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

