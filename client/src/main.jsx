import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Activity,
  Building2,
  ShieldCheck,
  Target,
  TrendingUp,
  BarChart3,
  LineChart,
  Zap,
  BrainCircuit,
  Crown,
  CheckCircle2,
  Star,
  AlertTriangle,
  Gauge,
  ArrowLeft,
  ArrowRight,
  FileText,
  Scale,
  LockKeyhole,
  Home,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import "./styles.css";

/*
  HARD-CODED RENDER BACKEND URL
  This avoids Vercel environment variable problems.
*/
const API = "https://edge-1-6dtw.onrender.com";
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const STORAGE_KEY = "edge-watchlist-v8";
const TERMS_VERSION = "2026-05-30";

function rawScore(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return n <= 10 ? n : n / 10;
}

function score10(v) {
  const n = rawScore(v);
  return n === null ? null : Number(n.toFixed(1));
}

function scoreText(v) {
  const n = score10(v);
  return n === null ? "N/A" : n.toFixed(1);
}

function scoreTone(v) {
  const n = score10(v);
  if (n === null) return "neutral";
  if (n <= 5) return "red";
  if (n <= 7) return "yellow";
  return "green";
}

function gradeFrom10(v) {
  const n = score10(v);
  if (n === null) return "N/A";
  if (n >= 9.3) return "A";
  if (n >= 8.5) return "B+";
  if (n >= 7.5) return "B";
  if (n >= 6.5) return "C+";
  if (n >= 5.5) return "C";
  if (n >= 4.5) return "D";
  return "F";
}

function fmt(v, suffix = "") {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "N/A";
  return `${Number(v).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}${suffix}`;
}

function money(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "N/A";
  return Number(v).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function compactMoney(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "N/A";
  const n = Number(v);

  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}T`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}B`;
  return `$${n.toFixed(0)}M`;
}

function readWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWatchlist(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function categoryLabel(key) {
  return (
    {
      growth: "Growth",
      profitability: "Profitability",
      financialHealth: "Financial Health",
      valuation: "Valuation",
      momentum: "Momentum",
      reversal: "Pullback",
    }[key] || key
  );
}

function getScoreInsight(score) {
  const n = score10(score);

  if (n === null) {
    return {
      label: "Unavailable Evaluation",
      text: "There is not enough reliable company data available to explain this score yet.",
    };
  }

  if (n <= 5) {
    return {
      label: "Red Evaluation",
      text: "Red means the company currently shows a weaker overall business profile. This can point to a business that is struggling to prove durable growth, protect margins, maintain balance-sheet strength, or justify its market value compared with stronger companies. It does not mean the company cannot improve, but it means the available data is not showing a high-quality company profile right now.",
    };
  }

  if (n <= 7) {
    return {
      label: "Yellow Evaluation",
      text: "Yellow means the company has a mixed overall business profile. There may be real strengths in the business, but the full picture is not consistently strong yet. The company may be performing well in some areas while still showing questions around durability, efficiency, stability, valuation, or execution quality.",
    };
  }

  return {
    label: "Green Evaluation",
    text: "Green means the company currently shows a strong overall business profile. The available data points to a higher-quality company with stronger execution, healthier financial performance, better consistency, and a more durable business position compared with weaker-scoring companies. This is a company-quality evaluation, not a buy or sell signal.",
  };
}


function getSafeProfileAccent(user) {
  const fallbackColors = [
    "159,92,255",
    "21,231,255",
    "133,255,71",
    "255,214,107",
    "255,95,115",
  ];

  const seed = String(user?.id || user?.primaryEmailAddress?.emailAddress || "eval");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

function ProfileButton() {
  const { user } = useUser();
  const [accent, setAccent] = useState(() => getSafeProfileAccent(user));

  useEffect(() => {
    let cancelled = false;
    const imageUrl = user?.imageUrl;

    if (!imageUrl) {
      setAccent(getSafeProfileAccent(user));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 36;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas unavailable");

        ctx.drawImage(img, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < pixels.length; i += 16) {
          const alpha = pixels[i + 3];
          if (alpha < 180) continue;

          const pr = pixels[i];
          const pg = pixels[i + 1];
          const pb = pixels[i + 2];
          const brightness = (pr + pg + pb) / 3;

          if (brightness < 24 || brightness > 236) continue;

          r += pr;
          g += pg;
          b += pb;
          count += 1;
        }

        if (!count) throw new Error("No usable avatar color");

        const color = `${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)}`;
        if (!cancelled) setAccent(color);
      } catch {
        if (!cancelled) setAccent(getSafeProfileAccent(user));
      }
    };

    img.onerror = () => {
      if (!cancelled) setAccent(getSafeProfileAccent(user));
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.imageUrl]);

  return (
    <div
      className="topbar-user"
      style={{ "--profile-accent": accent }}
      title="Account settings"
    >
      <UserButton />
    </div>
  );
}

function App() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("landing");
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function analyze(e, overrideSymbol) {
    e?.preventDefault();

    const clean = (overrideSymbol || symbol).trim().toUpperCase();
    if (!clean) return null;

    setSymbol(clean);
    setLoading(true);
    setError("");

    try {
      const url = `${API}/api/analyze/${encodeURIComponent(clean)}`;

      const res = await fetch(url, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Could not analyze ${clean}. Backend returned ${res.status}.`
        );
      }

      setData(json);
      return json;
    } catch (err) {
      setError(
        err.message ||
          "Failed to fetch from Render. Check Render logs and browser console."
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function addTicker(ticker = symbol) {
    const clean = ticker.trim().toUpperCase();
    if (!clean) return;

    const analyzed = data?.symbol === clean ? data : await analyze(null, clean);
    if (!analyzed) return;

    const item = {
      symbol: clean,
      name: analyzed.profile?.name || clean,
      score: score10(analyzed.grades?.edgeScore),
      rawScore: analyzed.grades?.edgeScore ?? null,
      grade: gradeFrom10(analyzed.grades?.edgeScore),
      risk: analyzed.grades?.riskLabel || "N/A",
      price: analyzed.quote?.c ?? null,
      updatedAt: new Date().toISOString(),
    };

    const next = [item, ...watchlist.filter((x) => x.symbol !== clean)].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    setWatchlist(next);
    saveWatchlist(next);
  }

  function removeTicker(ticker) {
    const next = watchlist.filter((x) => x.symbol !== ticker);
    setWatchlist(next);
    saveWatchlist(next);
  }

  async function refreshWatchlist() {
    if (!watchlist.length) return;

    setWatchLoading(true);

    const refreshed = [];

    for (const item of watchlist) {
      try {
        const res = await fetch(`${API}/api/analyze/${encodeURIComponent(item.symbol)}`, {
          method: "GET",
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json) {
          refreshed.push({
            ...item,
            name: json.profile?.name || item.name,
            score: score10(json.grades?.edgeScore),
            rawScore: json.grades?.edgeScore ?? null,
            grade: gradeFrom10(json.grades?.edgeScore),
            risk: json.grades?.riskLabel || item.risk,
            price: json.quote?.c ?? item.price,
            updatedAt: new Date().toISOString(),
          });
        } else {
          refreshed.push(item);
        }
      } catch {
        refreshed.push(item);
      }
    }

    const next = refreshed.sort((a, b) => (b.score || 0) - (a.score || 0));

    setWatchlist(next);
    saveWatchlist(next);
    setWatchLoading(false);
  }

  useEffect(() => {
    const saved = readWatchlist().sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    setWatchlist(saved);
    analyze(null, "AAPL");
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) {
      setTermsAccepted(false);
      return;
    }

    const key = `eval-terms-accepted-${TERMS_VERSION}-${user.id}`;
    setTermsAccepted(localStorage.getItem(key) === "true");
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    if (!isLoaded) return;

    const publicViews = ["landing", "account"];
    if (!isSignedIn && !publicViews.includes(view)) {
      setView("account");
      return;
    }

    if (isSignedIn && !termsAccepted && ![...publicViews, "terms"].includes(view)) {
      setView("terms");
    }
  }, [isLoaded, isSignedIn, termsAccepted, view]);

  function acceptTerms() {
    if (user?.id) {
      const key = `eval-terms-accepted-${TERMS_VERSION}-${user.id}`;
      localStorage.setItem(key, "true");
    }

    setTermsAccepted(true);
    setView("dashboard");
  }

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (view === "landing") {
    return <LandingPage onContinue={() => setView(isSignedIn ? "dashboard" : "account")} />;
  }

  if (view === "account") {
    return (
      <ClerkAccessPage
        onBack={() => setView("landing")}
        onSuccess={() => setView(termsAccepted ? "dashboard" : "terms")}
      />
    );
  }

  if (view === "terms") {
    return (
      <TermsPage
        onAgree={acceptTerms}
        onBack={() => setView("dashboard")}
        requireAgreement={!termsAccepted}
      />
    );
  }

  if (view === "support") {
    return (
      <SupportContactPage
        onBack={() => setView("dashboard")}
        onHome={() => setView("landing")}
        onTerms={() => setView("terms")}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/stock-edge-ai-logo.png" alt="Eval AI logo" />
          <div>
            <h1>Eval</h1>
          </div>
        </div>

        <form onSubmit={analyze} className="searchbar">
          <button
            type="button"
            className="ai-nav-btn"
            onClick={() => setView("assistant")}
            title="Eval AI Assistant"
          >
            <BrainCircuit size={23} />
          </button>

          <SignedIn>
            <ProfileButton />
          </SignedIn>

          <button
            type="button"
            className="plans-nav-btn"
            onClick={() => setView("plans")}
            aria-label="Eval AI Plans"
            title="Eval AI Plans"
          >
            <Crown size={20} />
          </button>

          <div>
            <label>Stock Ticker</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
            />
          </div>

          <button disabled={loading} aria-label="Search stock" title="Search stock">
            {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
          </button>

          <button
            type="button"
            className="ghost-btn"
            onClick={() => addTicker(symbol)}
            aria-label="Add to watchlist"
            title="Add to watchlist"
          >
            <Plus size={18} />
          </button>
        </form>
      </header>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {view === "assistant" ? (
        <AssistantPage
          current={data}
          watchlist={watchlist}
          onBack={() => setView("dashboard")}
        />
      ) : view === "plans" ? (
        <PlansPage onBack={() => setView("dashboard")} />
      ) : (
        <section className="layout">
          <div className="content">
            {data ? (
              <>
                <Report data={data} onAdd={() => addTicker(data.symbol)} />
                <DashboardLinkRow
                  onHome={() => setView("landing")}
                  onTerms={() => setView("terms")}
                  onSupport={() => setView("support")}
                />
              </>
            ) : (
              <EmptyReport />
            )}
          </div>

          <Watchlist
            items={watchlist}
            symbol={symbol}
            onAdd={addTicker}
            onRemove={removeTicker}
            onAnalyze={(ticker) => analyze(null, ticker)}
            onRefresh={refreshWatchlist}
            loading={watchLoading}
          />
        </section>
      )}
    </main>
  );
}


function LandingPage({ onContinue }) {
  const productPoints = [
    {
      icon: <Gauge size={20} />,
      title: "One simple Eval Score",
      text: "Type a ticker and get a clean 0–10 score that summarizes the stock’s overall setup.",
    },
    {
      icon: <BarChart3 size={20} />,
      title: "Breakdowns that make sense",
      text: "See growth, profitability, financial health, valuation, momentum, and pullback in plain English.",
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Risk made easier",
      text: "Eval AI turns volatility, debt, valuation, and business strength into a quick risk read.",
    },
    {
      icon: <BrainCircuit size={20} />,
      title: "Ask questions instantly*",
      text: "Ask the assistant to compare stocks, explain metrics, and translate market data into clear, beginner-friendly answers.",
    },
  ];

  return (
    <main className="landing-page">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <div className="landing-grid-glow" />

      <section className="landing-shell">
        <div className="landing-brand-row">
          <img src="/stock-edge-ai-logo.png" alt="Eval AI logo" />
          <div>
            <h1>Eval</h1>
          </div>
        </div>

        <div className="landing-hero">
          <div className="landing-copy">
            <div className="landing-kicker">
              <Sparkles size={16} /> Built for faster stock decisions
            </div>

            <h2>Turn complicated stock data into one clear answer.</h2>

            <p>
              Eval AI helps users understand stocks without digging through confusing
              spreadsheets, finance terms, or long reports. Enter any ticker to get a
              simple Eval Score, risk rating, company summary, key metrics, watchlist,
              and plain-English explanations designed to be quick, readable, and useful.
            </p>

            <div className="landing-actions">
              <button type="button" className="landing-continue-btn" onClick={onContinue}>
                Continue <ArrowRight size={20} />
              </button>
              <span>Open the dashboard and start analyzing stocks.</span>
            </div>
          </div>

          <div className="landing-score-preview" aria-label="Eval AI preview card">
            <div className="preview-topline">
              <span>Live-style report preview</span>
              <b>NVDA</b>
            </div>

            <div className="preview-score-ring">
              <strong>9.0</strong>
            </div>

            <div className="preview-bars">
              <div><span>Profitability</span><b style={{ width: "92%" }} /></div>
              <div><span>Financial Health</span><b style={{ width: "81%" }} /></div>
              <div><span>Momentum</span><b style={{ width: "74%" }} /></div>
            </div>
          </div>
        </div>

        <div className="landing-points">
          {productPoints.map((point) => (
            <article className="landing-point-card" key={point.title}>
              <div>{point.icon}</div>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>

        <div className="landing-bottom-strip">
          <span>Eval Score</span>
          <span>Risk Rating</span>
          <span>Company Breakdown</span>
          <span>Watchlist</span>
          <span>AI Assistant</span>
        </div>

        <p className="landing-footnote">
          *Eval AI provides educational explanations only and is not financial advice.
        </p>
      </section>
    </main>
  );
}


function ClerkAccessPage({ onBack, onSuccess }) {
  const [mode, setMode] = useState("signIn");

  useEffect(() => {
    function syncModeFromHash() {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("sign-up") || hash.includes("signup")) {
        setMode("signUp");
      } else if (hash.includes("sign-in") || hash.includes("signin")) {
        setMode("signIn");
      }
    }

    syncModeFromHash();
    window.addEventListener("hashchange", syncModeFromHash);
    return () => window.removeEventListener("hashchange", syncModeFromHash);
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    window.location.hash = nextMode === "signUp" ? "sign-up" : "sign-in";
  }

  const clerkAppearance = {
    variables: {
      fontFamily: "Oxanium, sans-serif",
      colorPrimary: "#85d713",
      colorText: "#f8fbff",
      colorTextSecondary: "rgba(248,251,255,.66)",
      colorBackground: "rgba(1,7,16,.88)",
      colorInputBackground: "rgba(0,0,0,.28)",
      colorInputText: "#f8fbff",
      borderRadius: "18px",
    },
    elements: {
      rootBox: "clerk-root-box",
      card: "clerk-card-shell",
      headerTitle: "clerk-title",
      headerSubtitle: "clerk-subtitle",
      socialButtonsBlock: "clerk-social-hidden",
      socialButtonsBlockButton: "clerk-social-btn",
      dividerRow: "clerk-auth-divider-hidden",
      formButtonPrimary: "clerk-primary-btn",
      footerActionLink: "clerk-link",
    },
  };

  return (
    <main className="clerk-access-page">
      <div className="clerk-access-orb clerk-access-orb-one" />
      <div className="clerk-access-orb clerk-access-orb-two" />
      <div className="clerk-access-grid-glow" />

      <section className="clerk-access-shell">
        <div className="clerk-access-head">
          <button type="button" className="back-btn clerk-access-back" onClick={onBack}>
            <ArrowLeft size={18} /> Cover page
          </button>

          <div className="clerk-access-brand">
            <img src="/stock-edge-ai-logo.png" alt="Eval logo" />
            <div>
              <h1>Eval</h1>
              <p>Secure account access</p>
            </div>
          </div>
        </div>

        <div className="clerk-access-layout">
          <aside className="clerk-access-copy">
            <div className="clerk-access-kicker">
              <ShieldCheck size={16} /> Protected by Clerk
            </div>
            <h2>Sign in before entering the dashboard.</h2>
            <p>
              Clerk handles email verification, secure passwords, forgot-password recovery,
              active sessions, and bot sign-up protection from your Clerk dashboard.
            </p>

            <div className="clerk-access-list">
              <span><CheckCircle2 size={16} /> Real sign-up and sign-in</span>
              <span><CheckCircle2 size={16} /> Email verification and password reset</span>
              <span><CheckCircle2 size={16} /> Bot protection enabled through Clerk</span>
            </div>
          </aside>

          <section className="clerk-access-card">
            <SignedOut>
              <div className="clerk-access-topline">
                <span>{mode === "signIn" ? "Welcome back" : "Create your Eval account"}</span>
                <h3>{mode === "signIn" ? "Sign in to continue." : "Sign up to get started."}</h3>
              </div>

              <div className="clerk-access-tabs">
                <button
                  type="button"
                  className={mode === "signIn" ? "active" : ""}
                  onClick={() => switchMode("signIn")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={mode === "signUp" ? "active" : ""}
                  onClick={() => switchMode("signUp")}
                >
                  Sign up
                </button>
              </div>

              <div className="clerk-access-panel">
                {mode === "signIn" ? (
                  <SignIn
                    appearance={clerkAppearance}
                    routing="hash"
                    signUpUrl="#sign-up"
                  />
                ) : (
                  <SignUp
                    appearance={clerkAppearance}
                    routing="hash"
                    signInUrl="#sign-in"
                  />
                )}
              </div>
            </SignedOut>

            <SignedIn>
              <div className="clerk-access-ready">
                <div className="clerk-access-user">
                  <UserButton />
                </div>
                <span>Signed in</span>
                <h3>Your account is ready.</h3>
                <p>Continue to Eval and start analyzing stocks.</p>
                <button type="button" className="auth-submit-btn" onClick={onSuccess}>
                  Continue to dashboard <ArrowRight size={18} />
                </button>
              </div>
            </SignedIn>
          </section>
        </div>
      </section>
    </main>
  );
}


function DashboardLinkRow({ onHome, onTerms, onSupport }) {
  return (
    <nav className="dashboard-link-row" aria-label="Dashboard navigation">
      <button type="button" className="dashboard-link-btn" onClick={onHome}>
        <Home size={16} /> Homepage
      </button>
      <button type="button" className="dashboard-link-btn" onClick={onTerms}>
        <Scale size={16} /> Terms & Conditions
      </button>
      <button type="button" className="dashboard-link-btn highlight" onClick={onSupport}>
        <MessageCircle size={16} /> Support & Contact
      </button>
    </nav>
  );
}

function SupportContactPage({ onBack, onHome, onTerms }) {
  return (
    <main className="support-page">
      <div className="support-orb support-orb-one" />
      <div className="support-orb support-orb-two" />

      <section className="support-shell">
        <div className="support-topbar">
          <button className="back-btn" type="button" onClick={onBack}>
            <ArrowLeft size={18} /> Dashboard
          </button>

          <div className="support-mini-nav">
            <button type="button" onClick={onHome}>
              <Home size={15} /> Homepage
            </button>
            <button type="button" onClick={onTerms}>
              <Scale size={15} /> Terms
            </button>
          </div>
        </div>

        <div className="support-hero">
          <div>
            <div className="support-kicker">
              <MessageCircle size={16} /> Support & Contact
            </div>
            <h1>Need help with Eval?</h1>
            <p>
              Reach out with account questions, login issues, dashboard problems, billing
              questions, feature requests, or general feedback. Emails and direct messages are
              the fastest way to get a response because they are easier to track and answer clearly.
            </p>
          </div>

          <div className="support-contact-card">
            <span>Primary contact</span>
            <h2>Henry Long</h2>
            <a href="mailto:henryl@udel.edu">
              <Mail size={18} /> henryl@udel.edu
            </a>
            <a href="tel:4846024647">
              <Phone size={18} /> 484-602-4647
            </a>
          </div>
        </div>

        <div className="support-grid">
          <article className="support-card">
            <Mail size={22} />
            <h3>Best option: email</h3>
            <p>
              Email is the best way to explain what happened, include screenshots, and get a
              direct answer. Include your account email, ticker if relevant, and a short
              description of the issue.
            </p>
          </article>

          <article className="support-card">
            <MessageCircle size={22} />
            <h3>Direct messages are fastest</h3>
            <p>
              Direct messages are usually the quickest route for simple questions or urgent
              issues. If the problem needs more detail, you may be asked to follow up by email.
            </p>
          </article>

          <article className="support-card">
            <ShieldCheck size={22} />
            <h3>What to include</h3>
            <p>
              Send the email used for your Eval account, what page you were on, what button or
              ticker caused the issue, and any error message you saw. Do not send passwords.
            </p>
          </article>
        </div>

        <div className="support-note">
          Eval is an educational stock-analysis tool. Support can help with product access,
          account issues, and app problems, but cannot provide personalized financial advice.
        </div>
      </section>
    </main>
  );
}

function TermsPage({ onAgree, onBack, requireAgreement = true }) {
  const [checked, setChecked] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const canAgree = checked && confirmName.trim().toUpperCase() === "I AGREE";

  const sections = [
    {
      title: "1. Acceptance of these Terms",
      text: [
        "These Terms and Conditions govern your access to and use of Eval, including the website, dashboard, Eval Score, risk rating, watchlist, AI assistant, company summaries, key metrics, charts, explanations, paid plan pages, and any related content or features. By creating an account, signing in, clicking I Agree, or using Eval, you agree to these Terms.",
        "If you do not agree, do not use Eval. If you use Eval on behalf of a company, club, organization, partnership, or other entity, you represent that you have authority to bind that entity to these Terms."
      ],
    },
    {
      title: "2. Educational information only — no investment advice",
      text: [
        "Eval is an educational stock research and data-organization tool. Eval is not a registered investment adviser, financial adviser, broker-dealer, securities dealer, tax adviser, legal adviser, accountant, investment bank, portfolio manager, fiduciary, or trading platform.",
        "Nothing on Eval is personalized investment advice, financial advice, trading advice, tax advice, legal advice, accounting advice, a recommendation, an offer, a solicitation, or a promise to buy, sell, hold, short, trade, or otherwise transact in any security, ETF, option, cryptocurrency, futures contract, index, fund, financial product, or investment strategy.",
        "Eval does not consider your investment objectives, net worth, risk tolerance, income, debts, taxes, time horizon, portfolio, personal circumstances, or suitability. You are solely responsible for your own investment decisions and should consult a qualified licensed professional before making financial decisions."
      ],
    },
    {
      title: "3. No guarantees, no reliance, and market risk",
      text: [
        "Investing and trading involve risk, including loss of principal. Securities and markets can move quickly and unpredictably. Past performance, historical data, backtests, analyst opinions, valuation models, ratings, grades, metrics, scores, or AI-generated explanations do not guarantee future results.",
        "Eval Scores, risk ratings, grades, company summaries, pullback readings, momentum readings, valuation readings, and AI answers are simplified educational outputs. They may be incomplete, delayed, inaccurate, misinterpreted, unavailable, or inappropriate for your situation. Do not rely on Eval as the only basis for an investment decision.",
        "You agree that your use of Eval is at your own risk and that you are responsible for independently verifying all information before acting on it."
      ],
    },
    {
      title: "4. Data sources, calculations, and third-party information",
      text: [
        "Eval may use market data, company data, financial statements, ratios, profile information, news information, AI responses, and other data from third-party providers, public sources, APIs, company websites, and user inputs. Eval does not guarantee that data is accurate, complete, current, uninterrupted, or error-free.",
        "Financial metrics may be missing, stale, restated, estimated, calculated differently by different providers, or affected by stock splits, corporate actions, accounting methods, API limits, provider outages, caching, formatting issues, or data-entry errors.",
        "Eval may modify, remove, reorder, or change metrics, score weights, formulas, plans, features, explanations, provider integrations, or availability at any time without notice."
      ],
    },
    {
      title: "5. AI assistant and automated explanations",
      text: [
        "Eval may include AI-generated summaries, explanations, comparisons, interpretations, and answers. AI can be wrong, outdated, incomplete, overly confident, or misleading. AI responses are for educational use only and are not professional advice.",
        "You agree not to treat any AI output as a command, recommendation, guarantee, or substitute for your own research or a licensed professional. You should verify AI output with reliable independent sources before using it."
      ],
    },
    {
      title: "6. Accounts, security, and acceptable use",
      text: [
        "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate account information and to keep it updated.",
        "You may not scrape, copy, resell, overload, attack, reverse engineer, bypass authentication, bypass rate limits, interfere with security, use bots, create fake accounts, share accounts to avoid payment, or use Eval for unlawful, abusive, fraudulent, or harmful purposes.",
        "Eval may suspend, restrict, or terminate access at any time if misuse, suspicious activity, payment issues, legal risk, security risk, API abuse, or violation of these Terms is suspected."
      ],
    },
    {
      title: "7. Subscriptions, payments, and plan changes",
      text: [
        "Paid plans, pricing, features, limits, trials, and billing terms may change over time. Unless otherwise stated at checkout, subscription fees are billed in advance and may be recurring. You are responsible for reviewing the price, renewal period, and cancellation terms before purchasing.",
        "Eval may add, remove, or modify features included in free or paid plans. A feature described on a plan page may depend on third-party APIs, market data providers, AI providers, payment providers, or backend availability."
      ],
    },
    {
      title: "8. Intellectual property and license",
      text: [
        "Eval, including its design, interface, branding, scoring structure, explanations, code, layout, text, graphics, and features, is owned by Eval or its licensors and is protected by intellectual-property laws. You receive a limited, revocable, non-exclusive, non-transferable license to use Eval for personal, non-commercial educational research unless a separate written agreement says otherwise.",
        "You may not copy, modify, distribute, sell, sublicense, frame, mirror, or create derivative works from Eval without written permission."
      ],
    },
    {
      title: "9. User content and feedback",
      text: [
        "If you submit questions, ticker lists, feedback, suggestions, messages, or other content, you represent that you have the right to submit it and that it does not violate law or third-party rights. You grant Eval a license to use that content to operate, improve, secure, and support the service.",
        "Do not submit confidential, regulated, illegal, harmful, or sensitive information that you do not want processed by the service."
      ],
    },
    {
      title: "10. Privacy and communications",
      text: [
        "Eval may process account information, usage information, device information, authentication information, and submitted content to operate the service, improve features, prevent abuse, communicate with users, and comply with legal obligations. Third-party services such as authentication, hosting, analytics, payment, email, AI, market-data, and security providers may process information as needed to provide the service.",
        "By using Eval, you consent to receiving service-related emails such as account verification, password reset, security notices, plan notices, legal notices, and important product updates."
      ],
    },
    {
      title: "11. Third-party services and links",
      text: [
        "Eval may link to or integrate with third-party websites, APIs, data providers, payment providers, authentication providers, AI providers, company websites, brokers, or news sources. Eval does not control third-party services and is not responsible for their content, availability, accuracy, policies, fees, outages, or actions.",
        "Your use of third-party services may be governed by their own terms and privacy policies."
      ],
    },
    {
      title: "12. Disclaimers of warranties",
      text: [
        "Eval is provided on an AS IS and AS AVAILABLE basis. To the maximum extent permitted by law, Eval disclaims all warranties, express, implied, statutory, or otherwise, including warranties of accuracy, completeness, timeliness, merchantability, fitness for a particular purpose, title, non-infringement, availability, security, and uninterrupted operation.",
        "Eval does not warrant that the service will be error-free, secure, uninterrupted, profitable, accurate, compatible with your needs, or free from harmful components."
      ],
    },
    {
      title: "13. Limitation of liability",
      text: [
        "To the maximum extent permitted by law, Eval and its owners, operators, affiliates, contractors, providers, and licensors will not be liable for indirect, incidental, consequential, special, exemplary, punitive, lost-profit, lost-revenue, lost-data, trading-loss, investment-loss, business-interruption, reputational, or reliance damages, even if advised of the possibility of such damages.",
        "To the maximum extent permitted by law, Eval’s total liability for any claim arising out of or relating to the service or these Terms will not exceed the greater of the amount you paid to Eval for the service during the three months before the claim arose or one hundred U.S. dollars. Some jurisdictions do not allow certain limitations, so some limitations may not apply to you."
      ],
    },
    {
      title: "14. Indemnification",
      text: [
        "You agree to defend, indemnify, and hold harmless Eval and its owners, operators, affiliates, contractors, providers, and licensors from and against claims, damages, losses, liabilities, costs, and expenses, including reasonable attorneys’ fees, arising out of or related to your use of Eval, your investment decisions, your violation of these Terms, your violation of law, your user content, your misuse of data, or your infringement of rights."
      ],
    },
    {
      title: "15. Arbitration agreement and class-action waiver",
      text: [
        "PLEASE READ THIS SECTION CAREFULLY. To the maximum extent permitted by law, you and Eval agree that any dispute, claim, or controversy arising out of or relating to these Terms, Eval, your account, your subscription, your use of the service, data, scores, AI outputs, or any relationship between you and Eval will be resolved by binding individual arbitration rather than in court, except that either party may bring an individual claim in small-claims court if eligible.",
        "The arbitration will be conducted on an individual basis. You and Eval waive the right to a jury trial and waive the right to participate in a class action, class arbitration, consolidated action, representative action, private attorney general action, or any proceeding brought on behalf of other users or the general public. The arbitrator may award relief only to the individual party seeking relief and only to the extent necessary to resolve that individual party’s claim.",
        "Before starting arbitration, the party seeking relief must send written notice describing the dispute and requested relief. The parties will try in good faith to resolve the dispute informally for at least 30 days. If the dispute is not resolved, either party may start arbitration under the rules of a recognized arbitration provider selected by Eval unless applicable law requires otherwise.",
        "If any part of this arbitration or class-action waiver section is found unenforceable, the unenforceable part will be severed to the extent permitted by law, and the remaining terms will continue in effect. If the class-action waiver is found unenforceable for a claim, that claim must proceed in court and not in arbitration."
      ],
      important: true,
    },
    {
      title: "16. Governing law and venue",
      text: [
        "These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law principles, except to the extent federal law or mandatory local law applies. Subject to the arbitration section, any permitted court proceeding will be brought in state or federal courts located in Delaware, and you consent to personal jurisdiction and venue there."
      ],
    },
    {
      title: "17. Changes to Eval and these Terms",
      text: [
        "Eval may update these Terms from time to time. Material changes may be shown in the app, emailed, or posted on the website. Continued use of Eval after changes become effective means you accept the updated Terms. If you do not agree to the updated Terms, stop using Eval."
      ],
    },
    {
      title: "18. Contact and legal notices",
      text: [
        "Questions, support requests, or legal notices should be sent through the contact method provided by Eval. If no separate contact method is available, use the account email or support channel associated with the service."
      ],
    },
  ];

  return (
    <main className="terms-page">
      <div className="terms-orb terms-orb-one" />
      <div className="terms-orb terms-orb-two" />

      <section className="terms-shell">
        <div className="terms-hero">
          <div>
            <div className="terms-kicker">
              <Scale size={16} /> Required before entering Eval
            </div>
            <h1>Terms and Conditions</h1>
            <p>
              {requireAgreement
                ? "Review and accept these terms before using the dashboard. This page is designed for a stock-analysis education product, with extra focus on market-risk disclaimers, no-advice language, liability limits, and arbitration."
                : "Review the current Eval Terms and Conditions at any time from your dashboard."}
            </p>
          </div>

          <div className="terms-mini-card">
            <FileText size={23} />
            <span>Version</span>
            <strong>{TERMS_VERSION}</strong>
            <small>Educational use only. Not financial advice.</small>
          </div>
        </div>

        <div className="terms-alert">
          <AlertTriangle size={18} />
          <p>
            This template is not legal advice. Have an attorney review it before launch,
            especially the arbitration, privacy, subscription, and liability sections.
          </p>
        </div>

        <div className="terms-body">
          {sections.map((section) => (
            <article className={section.important ? "terms-section important" : "terms-section"} key={section.title}>
              <h2>{section.title}</h2>
              {section.text.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>

        {requireAgreement ? (
          <div className="terms-accept-panel">
            <div>
              <div className="terms-accept-title">
                <LockKeyhole size={17} /> Agreement required
              </div>
              <p>
                Check the box and type <b>I AGREE</b> to unlock the dashboard for this account.
                After this account accepts the current version, this step will not appear again
                unless the terms version changes or the browser data is cleared.
              </p>
            </div>

            <label className="terms-check-row">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>
                I have read and agree to the Eval Terms and Conditions, including the
                no-investment-advice disclaimer, limitation of liability, arbitration agreement,
                and class-action waiver.
              </span>
            </label>

            <input
              className="terms-confirm-input"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type I AGREE"
            />

            <button type="button" className="terms-agree-btn" disabled={!canAgree} onClick={onAgree}>
              Agree and enter dashboard <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="terms-accept-panel terms-read-panel">
            <div>
              <div className="terms-accept-title">
                <CheckCircle2 size={17} /> Terms already accepted
              </div>
              <p>
                This account has already accepted the current terms version. You can review the
                terms here anytime and return to the dashboard when finished.
              </p>
            </div>

            <button type="button" className="terms-agree-btn" onClick={onBack}>
              Back to dashboard <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function Watchlist({
  items,
  symbol,
  onAdd,
  onRemove,
  onAnalyze,
  onRefresh,
  loading,
}) {
  const [manual, setManual] = useState("");

  return (
    <aside className="watch-panel">
      <div className="panel-head">
        <div>
          <h2>
            <Star size={18} /> Watchlist
          </h2>
          <p>Saved in this browser · best score first</p>
        </div>

        <button
          className="icon-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh scores"
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      <form
        className="watch-add"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(manual || symbol);
          setManual("");
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value.toUpperCase())}
          placeholder="Add ticker"
        />
        <button>
          <Plus size={16} />
        </button>
      </form>

      <div className="watch-list">
        {items.length === 0 ? (
          <div className="watch-empty">
            Add stocks here to compare their 0.0–10.0 Eval Scores.
          </div>
        ) : (
          items.map((item) => (
            <div className="watch-row" key={item.symbol}>
              <button className="watch-info" onClick={() => onAnalyze(item.symbol)}>
                <strong>{item.symbol}</strong>
              </button>

              <div
                className={`watch-score-ring ${scoreTone(item.score)}`}
                style={{
                  "--watch-score-angle": `${Number(score10(item.score) || 0) * 36}deg`,
                }}
              >
                <strong>{scoreText(item.score)}</strong>
              </div>

              <button className="delete-btn" onClick={() => onRemove(item.symbol)}>
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}


function PlansPage({ onBack }) {
  const plan = {
    name: "Eval Pro",
    price: "$9.99/mo",
    yearly: "$99.99/yr",
    description:
      "One upgraded plan that combines deeper fundamentals, smarter valuation tools, news sentiment, and expanded AI explanations in one simple package.",
    features: [
      "Expanded Eval Score with more quality fundamentals",
      "EBIT, EBITDA, cash-flow, and balance-sheet metrics",
      "Intrinsic value, WACC, and DCF-style valuation support",
      "Margin of safety and percent difference from intrinsic value",
      "News sentiment score from recent company headlines",
      "AI summaries that explain what the news means",
      "More detailed metric explanations in plain English",
      "Expanded Eval AI Assistant access for stock questions",
    ],
  };

  return (
    <section className="plans-page">
      <div className="plans-shell pro-only-shell">
        <div className="plans-page-head">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={18} /> Dashboard
          </button>

          <div>
            <div className="plans-kicker">
              <Crown size={16} /> Eval Pro
            </div>
            <h2>One plan. Deeper stock research.</h2>
            <p>
              Eval Pro keeps the upgrade simple: stronger scoring, more company
              metrics, valuation tools, news sentiment, and cleaner AI-powered
              explanations for one price.
            </p>
          </div>
        </div>

        <div className="plans-grid pro-only-grid">
          <article className="plan-card pro pro-only-card">
            <div className="plan-glow" />

            <div className="plan-top pro-only-top">
              <div>
                <span>{plan.name}</span>
                <h3>{plan.price}</h3>
                <p>{plan.yearly}</p>
              </div>

              <div className="plan-icon">
                <Crown size={28} />
              </div>
            </div>

            <p className="plan-description">{plan.description}</p>

            <div className="plan-features pro-only-features">
              {plan.features.map((feature) => (
                <div className="plan-feature" key={feature}>
                  <CheckCircle2 size={16} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="plan-select-btn"
              onClick={() => {}}
              title="Eval Pro website coming soon"
            >
              Upgrade to Eval Pro
            </button>
          </article>
        </div>

        <p className="fineprint center">
          Plan button is a placeholder for now. Connect it later to the live Pro
          checkout page when it is ready.
        </p>
      </div>
    </section>
  );
}

function AssistantPage({ current, watchlist, onBack }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask a stock question in 75 characters or less. I’ll answer in simple terms.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function ask(e) {
    e.preventDefault();

    const clean = question.trim().slice(0, 75);
    if (!clean) return;

    const userMessage = { role: "user", content: clean };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/assistant`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          question: clean,
          current,
          watchlist,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Assistant error. Backend returned ${res.status}.`
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json?.answer || "I could not create a response.",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.message ||
            "Could not connect to the Render assistant endpoint.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="assistant-page">
      <div className="assistant-shell">
        <div className="assistant-page-head">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={18} /> Dashboard
          </button>

          <div>
            <div className="assistant-kicker">
              <BrainCircuit size={16} /> Eval AI Assistant
            </div>
            <h2>Ask stock questions in plain English.</h2>
            <p>
              Compare stocks, understand metrics, ask about risk, or get a
              beginner-friendly breakdown before making a decision.
            </p>
          </div>
        </div>

        <div className="chat-panel">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div className={`chat-bubble ${msg.role}`} key={`${msg.role}-${index}`}>
                <span>{msg.role === "user" ? "You" : "Eval AI"}</span>
                <p>{msg.content}</p>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble assistant">
                <span>Eval AI</span>
                <p>Thinking through that question...</p>
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={ask}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 75))}
              maxLength={75}
              placeholder="Ask a stock question. Max 75 characters."
              rows="3"
            />
            <button disabled={loading}>
              {loading ? <RefreshCw className="spin" size={17} /> : <Send size={17} />}
              Ask
            </button>
          </form>
        </div>

        <p className="fineprint center">
          Educational only. Eval AI Assistant helps explain investing ideas, but it
          is not a licensed financial advisor.
        </p>
      </div>
    </section>
  );
}


function Report({ data, onAdd }) {
  const cats = data?.grades?.categories || {};
  const metrics = data?.metrics || {};
  const edge = score10(data.grades?.edgeScore);
  const tone = scoreTone(edge);
  const scoreInsight = getScoreInsight(edge);
  const [openScoreHelp, setOpenScoreHelp] = useState(null);

  const strongest = useMemo(
    () =>
      Object.entries(cats)
        .filter(([, v]) => v != null)
        .sort((a, b) => score10(b[1]) - score10(a[1]))[0],
    [cats]
  );

  const weakest = useMemo(
    () =>
      Object.entries(cats)
        .filter(([, v]) => v != null)
        .sort((a, b) => score10(a[1]) - score10(b[1]))[0],
    [cats]
  );

  const gradeDescriptions = {
    growth: "Shows how fast the company is expanding sales and earnings. Higher means the business is growing stronger over time.",
    profitability: "Shows how efficiently the company turns revenue into profit. Higher means the company keeps more money after costs.",
    financialHealth: "Shows how stable the company looks financially. Higher means debt and balance-sheet risk are easier to handle.",
    valuation: "Shows whether the stock price looks fair compared with company fundamentals. Higher means the stock looks less overpriced.",
    momentum: "Shows recent stock strength and trend direction. Higher means the market has been rewarding the stock lately.",
    reversal: "Shows whether the stock has pulled back enough to create a better entry setup. Higher means the pullback looks more attractive.",
  };

  const categoryMetrics = {
    growth: [
      metricLine("Revenue Growth", metrics.revenueGrowth),
      metricLine("Quarterly Revenue Growth", metrics.revenueGrowthQuarterly),
      metricLine("3-Year Revenue Growth", metrics.revenueGrowth3Y),
      metricLine("5-Year Revenue Growth", metrics.revenueGrowth5Y),
      metricLine("EPS Growth", metrics.epsGrowth),
      metricLine("3-Year EPS Growth", metrics.epsGrowth3Y),
      metricLine("5-Year EPS Growth", metrics.epsGrowth5Y),
    ],
    profitability: [
      metricLine("ROE", metrics.roe),
      metricLine("ROA", metrics.roa),
      metricLine("ROI / ROIC", metrics.roi),
      metricLine("Gross Margin", metrics.grossMargin),
      metricLine("Operating Margin", metrics.operatingMargin),
      metricLine("Pretax Margin", metrics.pretaxMargin),
      metricLine("Net Margin", metrics.netMargin),
    ],
    financialHealth: [
      metricLine("Debt-to-Equity", metrics.debtToEquity),
      metricLine("Long-Term Debt-to-Equity", metrics.longTermDebtToEquity),
      metricLine("Current Ratio", metrics.currentRatio),
      metricLine("Quick Ratio", metrics.quickRatio),
      metricLine("Cash Ratio", metrics.cashRatio),
      metricLine("Asset Turnover", metrics.assetTurnover),
      metricLine("Market Cap Stability", metrics.marketCapM),
    ],
    valuation: [
      metricLine("P/E Ratio", metrics.peRatio),
      metricLine("Forward P/E", metrics.forwardPe),
      metricLine("PEG Ratio", metrics.pegRatio),
      metricLine("Price-to-Sales", metrics.priceToSales),
      metricLine("Price-to-Book", metrics.priceToBook),
      metricLine("Price-to-Cash-Flow", metrics.priceToCashFlow),
      metricLine("Price-to-Free-Cash-Flow", metrics.priceToFreeCashFlow),
      metricLine("Enterprise Value", metrics.enterpriseValue),
      metricLine("Dividend Yield", metrics.dividendYield),
    ],
    momentum: [
      metricLine("Beta", metrics.beta),
      metricLine("Day Change", metrics.dayChangePercent),
      metricLine("4-Week Return", metrics.priceReturn4Week),
      metricLine("13-Week Return", metrics.priceReturn13Week),
      metricLine("26-Week Return", metrics.priceReturn26Week),
      metricLine("52-Week Return", metrics.priceReturn52Week),
      metricLine("Distance From 52-Week Low", metrics.distanceFrom52WeekLow),
    ],
    reversal: [
      metricLine("Pullback From 52-Week High", metrics.pullbackFromHigh),
      metricLine("4-Week Return", metrics.priceReturn4Week),
      metricLine("13-Week Return", metrics.priceReturn13Week),
      metricLine("Distance From 52-Week Low", metrics.distanceFrom52WeekLow),
      metricLine("Day Change", metrics.dayChangePercent),
    ],
  };

  const rows = [
    [
      "P/E Ratio",
      metrics.peRatio,
      "Price compared to earnings. Lower can mean cheaper, but strong growth companies often trade richer.",
    ],
    [
      "Revenue Growth",
      metrics.revenueGrowth,
      "Shows whether the company is increasing sales over time.",
    ],
    [
      "EPS Growth",
      metrics.epsGrowth,
      "Tracks whether earnings per share are improving.",
    ],
    [
      "ROE",
      metrics.roe,
      "Shows how efficiently the company turns shareholder equity into profit.",
    ],
    ["Net Margin", metrics.netMargin, "Shows how much revenue becomes profit after costs."],
    [
      "Operating Margin",
      metrics.operatingMargin,
      "Shows how profitable the core business is before interest and taxes.",
    ],
    [
      "Debt-to-Equity",
      metrics.debtToEquity,
      "Compares company debt with shareholder equity.",
    ],
    [
      "Current Ratio",
      metrics.currentRatio,
      "Measures short-term balance-sheet strength.",
    ],
    [
      "Price-to-Sales",
      metrics.priceToSales,
      "Compares market value with annual sales.",
    ],
    [
      "Enterprise Value",
      metrics.enterpriseValue,
      "Company value estimate calculated as market cap plus total debt minus cash.",
    ],
    [
      "52-Week Return",
      metrics.priceReturn52Week,
      "Shows longer-term price momentum over the last year.",
    ],
    [
      "Beta",
      metrics.beta,
      "Shows how volatile the stock is compared with the overall market.",
    ],
  ];

  return (
    <>
      <section className={`hero-card ${openScoreHelp === "score" ? "score-popup-active" : ""}`}>
        <div className="score-panel">
          <div
            className={`score-ring ${tone}`}
            style={{ "--score-angle": `${(edge || 0) * 36}deg` }}
          >
            <div className="score-core">
              <span>EVAL SCORE</span>
              <strong>{scoreText(edge)}</strong>
            </div>
          </div>

          <div className={`score-insight-wrap ${openScoreHelp === "score" ? "popup-active" : ""}`}>
            <button
              type="button"
              className="score-help-btn score-main-help-btn"
              onClick={() => setOpenScoreHelp(openScoreHelp === "score" ? null : "score")}
              aria-label="Explain Eval Score color"
              title="Explain Eval Score color"
            >
              <span className="info-letter">?</span>
            </button>

            {openScoreHelp === "score" && (
              <div className={`score-popup score-insight-popup ${tone}`}>
                <div className="score-popup-title">{scoreInsight.label}</div>
                <p>{scoreInsight.text}</p>
              </div>
            )}
          </div>
        </div>

        <div className="company-panel">
          <div className="eyebrow">
            <Sparkles size={15} /> Current stock report
          </div>

          <h2>{data.profile?.name || data.symbol}</h2>
          <p className="subline">
            {data.symbol} · {data.profile?.finnhubIndustry || "Public company"}
          </p>

          <div className="hero-actions">
            <button onClick={onAdd} aria-label="Add to watchlist" title="Add to watchlist">
              <Plus size={17} />
            </button>

            {data.profile?.weburl && (
              <a href={data.profile.weburl} target="_blank" rel="noreferrer">
                Company site
              </a>
            )}
          </div>
        </div>

        <div className="snapshot-grid">
          <MiniStat icon={<Activity size={17} />} label="Price" value={money(data.quote?.c)} />
          <MiniStat
            icon={<ShieldCheck size={17} />}
            label="Risk"
            value={data.grades.riskLabel}
            helpTitle="Risk metrics used"
            metricsUsed={[
              "Beta",
              "Debt-to-Equity",
              "Current Ratio",
              "Market Cap Stability",
              "Financial Health Score",
              "Profitability Score",
            ]}
            isOpen={openScoreHelp === "risk"}
            onToggle={() => setOpenScoreHelp(openScoreHelp === "risk" ? null : "risk")}
          />
          <MiniStat
            icon={<Building2 size={17} />}
            label="Market Cap"
            value={compactMoney(data.grades.context?.marketCapM)}
          />
        </div>
      </section>


      <section className="grade-grid">
        <Grade
          id="growth"
          name="Growth"
          value={cats.growth}
          icon={<TrendingUp size={18} />}
          description={gradeDescriptions.growth}
          metricsUsed={categoryMetrics.growth}
          isOpen={openScoreHelp === "growth"}
          onToggle={() =>
            setOpenScoreHelp(openScoreHelp === "growth" ? null : "growth")
          }
        />
        <Grade
          id="profitability"
          name="Profitability"
          value={cats.profitability}
          icon={<BarChart3 size={18} />}
          description={gradeDescriptions.profitability}
          metricsUsed={categoryMetrics.profitability}
          isOpen={openScoreHelp === "profitability"}
          onToggle={() =>
            setOpenScoreHelp(
              openScoreHelp === "profitability" ? null : "profitability"
            )
          }
        />
        <Grade
          id="financialHealth"
          name="Financial Health"
          value={cats.financialHealth}
          icon={<ShieldCheck size={18} />}
          description={gradeDescriptions.financialHealth}
          metricsUsed={categoryMetrics.financialHealth}
          isOpen={openScoreHelp === "financialHealth"}
          onToggle={() =>
            setOpenScoreHelp(
              openScoreHelp === "financialHealth" ? null : "financialHealth"
            )
          }
        />
        <Grade
          id="valuation"
          name="Valuation"
          value={cats.valuation}
          icon={<Target size={18} />}
          description={gradeDescriptions.valuation}
          metricsUsed={categoryMetrics.valuation}
          isOpen={openScoreHelp === "valuation"}
          onToggle={() =>
            setOpenScoreHelp(openScoreHelp === "valuation" ? null : "valuation")
          }
        />
        <Grade
          id="momentum"
          name="Momentum"
          value={cats.momentum}
          icon={<LineChart size={18} />}
          description={gradeDescriptions.momentum}
          metricsUsed={categoryMetrics.momentum}
          isOpen={openScoreHelp === "momentum"}
          onToggle={() =>
            setOpenScoreHelp(openScoreHelp === "momentum" ? null : "momentum")
          }
        />
        <Grade
          id="reversal"
          name="Pullback"
          value={cats.reversal}
          icon={<Zap size={18} />}
          description={gradeDescriptions.reversal}
          metricsUsed={categoryMetrics.reversal}
          isOpen={openScoreHelp === "reversal"}
          onToggle={() =>
            setOpenScoreHelp(openScoreHelp === "reversal" ? null : "reversal")
          }
        />
      </section>

      <section className="metrics-card">
        <div className="section-title">
          <Gauge size={17} /> Key metrics
        </div>

        <div className="metric-grid">
          {rows.map(([label, item, help]) => (
            <Metric key={label} label={label} item={item} help={help} />
          ))}
        </div>
      </section>
    </>
  );
}

function metricLine(label, item) {
  if (!item) return { label, value: "Used when available", source: "Score model" };

  if (typeof item === "object" && "value" in item) {
    return {
      label,
      value: fmt(item.value, item.suffix || ""),
      source: item.source || "Score model",
    };
  }

  return {
    label,
    value: item === null || item === undefined ? "N/A" : String(item),
    source: "Score model",
  };
}

function MiniStat({
  icon,
  label,
  value,
  helpTitle,
  metricsUsed = [],
  isOpen = false,
  onToggle,
}) {
  return (
    <div className={`mini-stat ${isOpen ? "popup-active" : ""}`}>
      <span>
        {icon}
        {label}
      </span>

      <div className="mini-stat-value-row">
        <b>{value}</b>
        {metricsUsed.length > 0 && (
          <button
            type="button"
            className="score-help-btn mini-risk-help-btn"
            onClick={onToggle}
            aria-label={helpTitle || `${label} metrics used`}
            title={helpTitle || `${label} metrics used`}
          >
            <span className="info-letter">?</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="score-popup mini-stat-popup">
          <div className="score-popup-title">{helpTitle || "Metrics used"}</div>
          <ul>
            {metricsUsed.map((metric) => (
              <li key={metric}>
                <span>{metric}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Grade({
  name,
  value,
  icon,
  description,
  metricsUsed = [],
  isOpen = false,
  onToggle,
}) {
  const s = score10(value);
  const tone = scoreTone(s);

  return (
    <div className={`grade-card ${isOpen ? "popup-active" : ""}`}>
      <div className="grade-head">
        <span>{icon}</span>
        <h3>{name}</h3>
      </div>

      <div className="grade-line">
        <span className={tone} style={{ width: `${(s || 0) * 10}%` }} />
      </div>

      <div className="grade-score-row">
        <strong className={tone}>{scoreText(s)}</strong>
        <button
          type="button"
          className="score-help-btn"
          onClick={onToggle}
          aria-label={`${name} metrics used`}
          title={`${name} metrics used`}
        >
          <span className="info-letter">?</span>
        </button>
      </div>

      {isOpen && (
        <div className="score-popup">
          <div className="score-popup-title">Metrics used</div>
          <ul>
            {metricsUsed.map((metric) => (
              <li key={metric.label}>
                <span>{metric.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="grade-description">{description}</p>
    </div>
  );
}

function Metric({ label, item, help }) {
  return (
    <div className="metric-tile">
      <div>
        <h3>{label}</h3>
        <span>{item?.source || "Unavailable"}</span>
      </div>

      <strong>{fmt(item?.value, item?.suffix || "")}</strong>
      <p>{help}</p>

      {item?.formula && <small>{item.formula}</small>}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="loading-card">
        <RefreshCw className="spin" size={22} />
        <span>Loading Eval...</span>
      </div>
    </main>
  );
}

function MissingClerkConfig() {
  return (
    <main className="loading-screen">
      <div className="loading-card missing-clerk-card">
        <AlertTriangle size={24} />
        <h2>Missing Clerk publishable key</h2>
        <p>
          Add VITE_CLERK_PUBLISHABLE_KEY to your Vercel environment variables,
          then redeploy the frontend.
        </p>
      </div>
    </main>
  );
}

function Root() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return <MissingClerkConfig />;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
