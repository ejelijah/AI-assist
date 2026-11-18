
# StudyCompass — Student Companion

StudyCompass is a student-focused companion for finding useful resources,
organizing daily activities, and staying focused. The MVP combines an AI
assistant with web research, a shared dashboard, a local planner and calendar,
focus sessions, and an isolated judge demo workspace.

## Requirements

- Python 3.10+
- Node.js 20+
- A [GroqCloud API key](https://console.groq.com/keys)
- npm

## Run locally

1. In `backend`, create and activate a virtual environment, then install
   dependencies:

   ```sh
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Copy the root `.env.example` to `.env`, then add your Groq API key to `.env`.
   The backend loads that ignored local file automatically. Keep the key
   private; do not commit it:

   ```sh
   cp .env.example .env
   ```

   Optional settings are `GROQ_BASE_URL` and `GROQ_MODEL`. Defaults are shown
   in `.env.example`. It is only a template; the local backend loads values
   from the root `.env` file.

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

The assistant uses Groq for responses and DuckDuckGo for live web search.
Suggested tasks and schedule blocks are shown for review; they are only saved
after the student selects an add action. Planner, calendar, chat, demo, and
focus-session data are stored in the browser and do not sync between devices.

## Deploy the whole app to Netlify

Netlify hosts the React frontend and the chat/health API as serverless
functions. No separate backend host is needed.

1. Push the repository to GitHub and import it into Netlify. `netlify.toml`
   sets the base directory to `frontend`, the build command to `npm run build`,
   the publish directory to `dist`, and the functions directory.
2. In the Netlify site's environment variables, add `GROQ_API_KEY` as a secret.
   `GROQ_BASE_URL` and `GROQ_MODEL` are optional; the defaults are shown in
   `.env.example`.
3. Deploy the site. Check `https://<your-site>.netlify.app/api/health` returns
   `{"status":"ok"}`, then test chat, task suggestions, and day planning.

The browser calls `/api/chat` on the same Netlify site; do not set a
`VITE_API_URL` or expose `GROQ_API_KEY` through a `VITE_` variable. Netlify
Functions have execution and usage limits, so this serverless setup is suited
to the MVP/demo workload rather than sustained high traffic.

Never put `GROQ_API_KEY` in a `VITE_` variable, frontend file, or Git commit.
`.env` is ignored by Git; `.env.example` is a tracked template with no secret.

## Project layout

- `backend/`: FastAPI endpoint, web search, and model integration
- `frontend/src/components/`: dashboard, assistant, calendar, planner, and focus views
- `frontend/src/lib/studyData.js`: shared storage, task, and demo-data helpers
- `frontend/netlify/functions/`: Netlify chat/search and health API
- `netlify.toml`: Netlify build, function, and API route configuration

## Important limitations

This is an MVP, not a substitute for checking course materials or professional
advice. Search results and generated explanations can be incomplete or
incorrect. Review AI-proposed tasks and calendar blocks before saving them.
Demo data is isolated from personal task and calendar storage. Avoid entering
sensitive personal information.

