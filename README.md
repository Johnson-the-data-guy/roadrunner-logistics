# Roadrunner Logistics

Flask API + React (Vite) SPA for Roadrunner Logistics: browse a menu, place an order with a delivery location, and watch it move along a tracker paced against a real driving ETA (with a weather-based delay buffer).

## API endpoints

- `GET /health` — returns `{"status": "ok"}`
- `GET /deliveries` — returns a hardcoded list of 3 sample deliveries
- `POST /deliveries` — inserts a new delivery into PostgreSQL, expects JSON body `{"address": "...", "status": "..."}` (`status` defaults to `"pending"`)
- `GET /menu` — returns a hardcoded list of menu items
- `POST /auth/signup` — `{"email", "password", "name"}` → creates a user, returns `{"token", "user"}`
- `POST /auth/login` — `{"email", "password"}` → returns `{"token", "user"}`
- `GET /auth/google/callback` — OAuth redirect target; exchanges the `code` from Google for an id token, upserts the user, then redirects to the frontend with a JWT
- `POST /orders` *(auth required)* — `{"items": [{"item_name", "price", "quantity"}], "address": "..."}` (or `"lat"`/`"lng"` instead of `"address"`) → creates an order + order_items. A delivery location is required: a free-text `address` is geocoded via the Mapbox Geocoding API; if geocoding fails or finds nothing, the order is rejected.
- `GET /orders` *(auth required)* — lists the authenticated user's orders with nested items
- `PATCH /orders/<id>/status` *(auth required)* — `{"status": "..."}` → updates an order's status (used by the frontend tracker)
- `GET /orders/<id>/eta` *(auth required)* — computes ETA from the depot to the order's delivery location via the Mapbox Directions API, then checks weather at the delivery location (OpenWeatherMap). Returns `{"distance_km", "base_eta_minutes", "weather_adjusted_eta_minutes", "delay_risk", "condition"}`. `weather_adjusted_eta_minutes` adds a flat +20% to `base_eta_minutes` when `delay_risk` is true (rain/storm/snow). If the weather lookup fails, the response falls back to base distance/time with `delay_risk: false`; if the Directions API fails, the endpoint returns an error (distance/time can't be computed without it).

Authenticated requests send `Authorization: Bearer <token>`.

## Local dev

### Backend

1. Create a local Postgres database and load the schema (this creates `deliveries`, `users`, `orders` — with a required delivery lat/lng — and `order_items`):

   ```bash
   createdb roadrunner
   psql -d roadrunner -f schema.sql
   ```

2. Install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` (or export the vars directly) and fill in your local Postgres credentials and a JWT secret, then run the app:

   ```bash
   cp .env.example .env
   export $(grep -v '^#' .env | xargs)  # or use a tool like direnv/python-dotenv

   python app.py
   ```

4. Try it out:

   ```bash
   curl localhost:5000/health
   curl localhost:5000/menu
   curl -X POST localhost:5000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email": "a@example.com", "password": "changeme123", "name": "Ada"}'
   ```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL / VITE_GOOGLE_CLIENT_ID if needed
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and calls the Flask API at `VITE_API_URL` (defaults to `http://localhost:5000`).

## Environment variables

Backend (see `.env.example`):

| Variable | Description |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres connection |
| `JWT_SECRET` | Signing secret for session JWTs |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials |
| `GOOGLE_REDIRECT_URI` | Must match the redirect URI configured in Google Cloud Console, e.g. `http://localhost:5000/auth/google/callback` |
| `FRONTEND_URL` | Where the SPA runs; used for CORS and post-login redirects, e.g. `http://localhost:5173` |
| `MAPBOX_API_KEY` | Mapbox access token, used for address geocoding and driving directions/ETA |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key, used for the delay-risk check on `/orders/<id>/eta` |

Frontend (see `frontend/.env.example`):

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Base URL of the Flask API |
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID as the backend |

**Note:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are placeholders in `.env.example`. Google sign-in won't work until you manually create an OAuth 2.0 Client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add `GOOGLE_REDIRECT_URI` as an authorized redirect URI, and drop the real values into your `.env`.

**Note:** `MAPBOX_API_KEY` is also a placeholder. Generate a real access token manually at [mapbox.com](https://www.mapbox.com/) (free tier) — without it, `/orders` (address geocoding) and `/orders/<id>/eta` (directions) will fail. Same for `OPENWEATHER_API_KEY` — generate one manually at [openweathermap.org](https://openweathermap.org/) (free tier); without it, ETA requests still return distance/time but skip the weather delay check.

No auth is required for `/health`, `/deliveries`, and `/menu`. Everything else needs a JWT.
