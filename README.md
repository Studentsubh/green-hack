# RepairX — AI E-Waste Repair Assistant

Node + Express backend, vanilla JS frontend, JSON-file history, and Gemini API for diagnosis (text + photo).

## Run locally
1. Install Node 18+.
2. `npm install`
3. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
4. Put `GEMINI_API_KEY=your_key` in `.env` in the project root. Keep `.env` private; it is ignored by Git.
5. Run `npm start`, then open http://localhost:3000

The server sends diagnosis requests to Gemini through the Interactions API. It defaults to `gemini-3.8-flash`; set `GEMINI_MODEL` in `.env` only if you want to use another model available to your account. The key is read only by the server and is never sent to the browser.

## Structure
- `server.js`: API (`POST /api/diagnose`, `GET /api/history`, `DELETE /api/history/:id`)
- `public/`: frontend
- `data/history.json`: created on first diagnosis

## Ideas next
SQLite/MongoDB, a React/Vite frontend, a local e-waste drop-off finder, user accounts.
