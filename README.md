
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
   in `.env.example`. The example file is a template and is not loaded
   automatically; the backend reads these values from its environment.

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

The frontend is deployed to Netlify and the FastAPI backend to Render. Netlify
builds the static React app; it does not keep the Python API running.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from the repository. Render reads
   `render.yaml` and creates the API service. Set `GROQ_API_KEY` in the
   service's environment settings using a newly created Groq key.
3. In Netlify, import the same repository. `netlify.toml` configures the
   frontend build. Set the build environment variable `VITE_API_URL` to the
   Render service URL (for example, `https://studycompass-api.onrender.com`),
   then deploy.
4. Copy the Netlify production site origin (for example,
   `https://your-site.netlify.app`) into Render's `FRONTEND_ORIGIN` setting and
   redeploy the API. For multiple trusted origins, separate them with commas.
5. Check `https://<your-render-service>/api/health` returns `{"status":"ok"}`,
   then test chat on the Netlify site.

Never put `GROQ_API_KEY` in a `VITE_` variable, frontend file, or Git commit.
`.env` is ignored by Git; `.env.example` is a tracked template with no secret.

## Project layout

- `backend/`: FastAPI endpoint, web search, and model integration
- `frontend/`: React interface for chat, calendar, and daily planning
- `render.yaml`: Render API service configuration
- `netlify.toml`: Netlify frontend build configuration

## Important limitations

This is an early prototype, not a substitute for checking course materials or
professional advice. Search results and generated explanations can be
incomplete or incorrect. Avoid entering sensitive personal information.

