import { useState, useEffect } from "react";
import "./App.css";

const NAV_LINKS = ["Product", "Features", "About", "Pricing"];

const FEATURES = [
  {
    icon: "⬡",
    title: "Scalable Architecture",
    desc: "Built on the MERN stack — MongoDB, Express, React, and Node.js — for a fast, unified JavaScript ecosystem end-to-end.",
  },
  {
    icon: "⬢",
    title: "Real-time Ready",
    desc: "WebSocket support baked in from day one. Your users get live updates without ever refreshing the page.",
  },
  {
    icon: "◈",
    title: "API-first Design",
    desc: "Every feature is exposed through a clean REST API. Integrate with anything, build on top of everything.",
  },
  {
    icon: "◇",
    title: "Auth & Security",
    desc: "JWT authentication, role-based access control, and bcrypt hashing — production-grade security out of the box.",
  },
  {
    icon: "⬟",
    title: "Dev Experience",
    desc: "Hot module replacement, ESLint, and a clean monorepo structure. Your team ships faster from day one.",
  },
  {
    icon: "◆",
    title: "Deploy Anywhere",
    desc: "Docker-ready. Runs on Vercel, Railway, Render, or your own VPS — zero vendor lock-in.",
  },
];

const STATS = [
  { value: "10ms", label: "Avg. API response" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "∞", label: "Scalability" },
  { value: "MIT", label: "Open license" },
];

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="site">
      {/* NAV */}
      <nav className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
        <a href="#" className="nav__logo">
          <span className="nav__logo-mark">◆</span>
          Stackd
        </a>
        <ul className={`nav__links ${menuOpen ? "nav__links--open" : ""}`}>
          {NAV_LINKS.map((l) => (
            <li key={l}>
              <a href="#" className="nav__link" onClick={() => setMenuOpen(false)}>
                {l}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav__actions">
          <a href="#" className="btn btn--ghost">Log in</a>
          <a href="#" className="btn btn--primary">Get started</a>
        </div>
        <button
          className={`nav__burger ${menuOpen ? "nav__burger--open" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero__eyebrow">
          <span className="badge">Now in Beta</span>
          <span className="badge badge--outline">MERN · v1.0</span>
        </div>
        <h1 className="hero__headline">
          Ship faster.<br />
          <em>Break nothing.</em>
        </h1>
        <p className="hero__sub">
          A full-stack MERN boilerplate for modern startups. Everything you need
          to go from idea to production — without the setup tax.
        </p>
        <div className="hero__cta">
          <a href="#" className="btn btn--primary btn--lg">Start building →</a>
          <a href="#" className="btn btn--ghost btn--lg">View on GitHub</a>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="code-block">
            <div className="code-block__bar">
              <span /><span /><span />
              <p>terminal</p>
            </div>
            <pre className="code-block__body">
              <span className="c-dim">$</span> git clone your-project<br />
              <span className="c-dim">$</span> cd frontend <span className="c-dim">&amp;&amp;</span> npm install<br />
              <span className="c-dim">$</span> cd ../backend <span className="c-dim">&amp;&amp;</span> npm install<br />
              <span className="c-dim">$</span> npm run dev<br />
              <br />
              <span className="c-accent">✔</span> Frontend ready on{" "}
              <span className="c-highlight">localhost:5173</span><br />
              <span className="c-accent">✔</span> Backend ready on{" "}
              <span className="c-highlight">localhost:5000</span>
            </pre>
          </div>
          <div className="hero__floater hero__floater--1">MongoDB</div>
          <div className="hero__floater hero__floater--2">Express</div>
          <div className="hero__floater hero__floater--3">React</div>
          <div className="hero__floater hero__floater--4">Node.js</div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats">
        {STATS.map((s) => (
          <div className="stats__item" key={s.label}>
            <span className="stats__value">{s.value}</span>
            <span className="stats__label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="section-header">
          <p className="section-eyebrow">Features</p>
          <h2 className="section-title">Everything wired up.<br />Nothing in the way.</h2>
        </div>
        <div className="features__grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-card__icon">{f.icon}</span>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="cta-band">
        <div className="cta-band__inner">
          <h2 className="cta-band__title">
            Ready to build something real?
          </h2>
          <p className="cta-band__sub">
            Clone the repo, run two commands, and you're live.
          </p>
          <div className="cta-band__actions">
            <a href="#" className="btn btn--dark btn--lg">Get the code →</a>
            <a href="#" className="btn btn--outline btn--lg">Read the docs</a>
          </div>
        </div>
        <div className="cta-band__deco" aria-hidden="true">
          <div className="deco-ring deco-ring--1" />
          <div className="deco-ring deco-ring--2" />
          <div className="deco-ring deco-ring--3" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer__top">
          <div className="footer__brand">
            <a href="#" className="nav__logo">
              <span className="nav__logo-mark">◆</span>Stackd
            </a>
            <p className="footer__tagline">
              Built for developers who value their time.
            </p>
          </div>
          <div className="footer__cols">
            {[
              { heading: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { heading: "Developers", links: ["Docs", "API Reference", "GitHub", "Status"] },
              { heading: "Company", links: ["About", "Blog", "Careers", "Contact"] },
            ].map((col) => (
              <div className="footer__col" key={col.heading}>
                <p className="footer__col-heading">{col.heading}</p>
                {col.links.map((l) => (
                  <a href="#" className="footer__col-link" key={l}>{l}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="footer__bottom">
          <p>© 2025 Stackd. MIT License.</p>
          <p>Made with the MERN stack.</p>
        </div>
      </footer>
    </div>
  );
}