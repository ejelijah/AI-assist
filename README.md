
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

The chat searches the web for relevant resources and asks the configured model
to answer using those results. It requires internet access and an API key. The
study planner stores tasks in that browser's local storage; it does not sync
between devices.

## Deploy for a demo

The frontend is deployed to Netlify and the FastAPI backend to Railway. Netlify
builds the static React app; it does not keep the Python API running.

1. Push the repository to GitHub.
2. In Railway, create an empty project and add a service connected to the
   repository. Set the service's **Root Directory** to `/backend`. Railway
   detects the Python requirements there; set its start command to
   `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Add `GROQ_API_KEY` in the Railway service's Variables, then generate a
   public domain for the service.
4. In Netlify, import the same repository. `netlify.toml` configures the
   frontend build. Set the build environment variable `VITE_API_URL` to the
   Railway service URL (for example, `https://your-api.up.railway.app`), then
   deploy.
5. Copy the Netlify production site origin (for example,
   `https://your-site.netlify.app`) into Railway's `FRONTEND_ORIGIN` variable
   and redeploy the API. For multiple trusted origins, separate them with
   commas.
6. Check `https://<your-railway-service>/api/health` returns `{"status":"ok"}`,
   then test chat on the Netlify site.

Never put `GROQ_API_KEY` in a `VITE_` variable, frontend file, or Git commit.
`.env` is ignored by Git; `.env.example` is a tracked template with no secret.

## Project layout

- `backend/`: FastAPI endpoint, web search, and model integration
- `frontend/`: React interface for chat, calendar, and daily planning
- `netlify.toml`: Netlify frontend build configuration

## Important limitations

This is an early prototype, not a substitute for checking course materials or
professional advice. Search results and generated explanations can be
incomplete or incorrect. Avoid entering sensitive personal information.

