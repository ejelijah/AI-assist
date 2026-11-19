# StudyCompass

StudyCompass is a student companion built to bring AI assistance, research, planning, and focus tools together in one application.

## Technology

- **React and Vite** power the interactive frontend.
- **JavaScript and CSS** implement application behavior and responsive styling.
- **Netlify Functions** provide the server-side API for AI and search requests.
- **Groq** generates AI responses and structured task or schedule suggestions.
- **DuckDuckGo** provides web search results for research questions.
- **Browser local storage** saves planner tasks, calendar events, chat sessions, focus progress, and demo data.
- **FastAPI and Python** provide a companion backend implementation.
- **Lucide React** supplies interface icons, and **React Markdown** renders formatted AI responses.

## Architecture

The React frontend sends AI and search requests to the server-side API, which connects to Groq and DuckDuckGo. Student planning and conversation data is persisted in the browser.
