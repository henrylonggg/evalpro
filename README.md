# Edge Pro v9

A polished stock analysis web app using Finnhub for market data, SEC EDGAR as a fallback for calculated metrics, and a real AI assistant powered through the backend.

## Features

- Finnhub-powered stock analysis
- SEC EDGAR fallback calculations for missing fundamentals
- Edge Score displayed from 0.0 to 10.0
- Score ring colors:
  - Red: under 5.5
  - Yellow: 5.5 to 7.4
  - Green: 7.5 and above
- Clean right-side watchlist
- Browser-saved watchlist using localStorage
- Watchlist auto-sorts best score to worst
- Real AI assistant for stock questions, metrics, investing concepts, and stock comparisons

## Setup

```bash
npm install
npm run install-all
```

Create `server/.env` from `server/.env.example`:

```bash
FINNHUB_API_KEY=your_finnhub_key
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
PORT=5050
CLIENT_ORIGIN=http://localhost:5173
SEC_USER_AGENT=EdgeStockApp/9.0 your-email@example.com
```

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Publishing

- Put `FINNHUB_API_KEY` and `OPENAI_API_KEY` only on Render, never in the client.
- Put `VITE_API_URL=https://your-render-backend.onrender.com` on Vercel.
- Set `CLIENT_ORIGIN=https://your-vercel-site.vercel.app` on Render.
