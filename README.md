<div align="center">

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    💰  M O N E Y   H E I S T  💰                           ║
║         — The Professor's Personal Finance App —            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

# 💰 Money Heist — Personal Expense Tracker

> *"Every heist needs a perfect plan. Every salary needs a perfect budget."*
> — The Professor (probably, if he tracked rupees instead of robbing banks)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)]()

</div>

---

## 🎭 The Story

In *Money Heist*, the Professor planned every move with mathematical precision — not a single euro wasted, not a single second miscalculated.

Your salary deserves the same level of criminal genius.

**Money Heist** is a personal expense & goals tracker built for Indian students and young professionals who want to take back control of their money — one rupee at a time. No bank robbery required. 😄

---

## 🗺️ The Heist Plan (Features)

```
🏦  THE VAULT (Your Budget)
├── 💼  Monthly salary + allowances planning
├── 📊  Smart split: Expenses / Investments / Upskilling / Lifestyle
├── 🧾  Bills & Shopping buckets
└── 📈  Real-time budget vs. actual tracking

💸  THE CREW (Expense Categories)
├── 🍕  Expenses    → Food, transport, daily needs
├── 🏥  Bills       → Recurring bills (recurring, with due dates!)
├── 🛍️  Shopping    → That impulse buy you know you'll regret
├── 📈  Investments → SIP, stocks, crypto — future you says thanks
├── 📚  Upskilling  → Courses, books, certifications
└── ✨  Lifestyle   → Gym, subscriptions, fun stuff

💳  THE ESCAPE (Transactions)
├── 💵  Cash or Online — track both separately
├── 🏦  Funding source: Personal / Travel Allowance / Bill Allowance
└── 📅  Date-wise transaction history

🎯  THE GETAWAY (Goals)
├── 🎯  Set savings goals (Garba classes? New laptop? Goa trip?)
├── 💰  Track contributions over time
└── ✅  Auto-marks Completed when you hit the target

📊  THE INTEL (Analysis)
├── 📉  Month-over-month spending trends
├── 🥧  Category breakdown charts
└── 🔍  Where did all the money go? (Chart.js powered)
```

---

## 🛡️ Security (Because even the Professor had a safe house)

- 🔐 Passwords hashed with **bcrypt** (12 rounds) — no plain-text, ever
- 🍪 JWT stored in **httpOnly cookies** — script injection can't steal your session
- 🧱 **Helmet.js** security headers on every response
- 🚦 **Rate limiting** globally + stricter on login endpoints
- ✅ Every input validated with **express-validator**
- 🔒 All SQL **parameterized** — zero string-built queries
- 👤 Ownership checks on every read/write — your data stays yours

---

## 🏗️ Architecture (The Blueprint)

```
money-heist/
│
├── 📁 backend/                 → The Professor's HQ (Node.js + Express + PostgreSQL)
│   ├── server.js               → Main entry point
│   ├── db.js                   → PostgreSQL connection pool
│   ├── schema.sql              → Complete DB schema (tables + triggers)
│   ├── .env.example            → Environment template (copy → .env)
│   ├── middleware/
│   │   └── auth.js             → JWT authentication middleware
│   └── routes/
│       ├── auth.js             → Register / Login / Logout
│       ├── budgets.js          → Monthly budget CRUD
│       ├── categories.js       → Budget category management
│       ├── transactions.js     → Transaction logging
│       ├── goals.js            → Savings goals
│       └── analysis.js         → Spending analytics
│
└── 📁 frontend/                → The Heist Crew's Walkie-Talkie (Vanilla HTML/CSS/JS)
    ├── index.html              → Single-page app (everything's here)
    ├── css/
    │   └── style.css           → Custom design system (Fraunces + Jakarta Sans)
    └── js/
        ├── api.js              → API client layer
        ├── app.js              → Main app logic & UI controller
        ├── charts.js           → Chart.js visualizations
        └── demo.js             → Offline demo with sample data
```

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | HTML5 + Vanilla CSS + Vanilla JS |
| UI Components | Bootstrap 5 |
| Charts | Chart.js |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL 15+ |
| Auth | JWT (httpOnly cookie) + bcrypt |
| Security | Helmet, HPP, express-rate-limit, express-validator |

---

## 🚀 Quick Setup (The Heist Begins)

### Prerequisites
- [Node.js](https://nodejs.org) 18+
- [PostgreSQL](https://postgresql.org) 15+
- Git

---

### 1️⃣ Clone the Repo

```bash
git clone https://github.com/Dhaval-0511/Money-Hiest.git
cd Money-Hiest
```

---

### 2️⃣ Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env
```

Open `.env` and fill in your values:
```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=expense_tracker
PGUSER=postgres
PGPASSWORD=your_postgres_password

JWT_SECRET=replace_with_a_long_random_secret_at_least_64_chars
JWT_EXPIRES_IN=7d

PORT=4000
CORS_ORIGIN=http://localhost:5500
```

```bash
# Create the database
createdb -U postgres expense_tracker

# Run the schema (creates all tables + triggers)
psql -U postgres -d expense_tracker -f schema.sql

# Install dependencies
npm install

# Start in development mode (with auto-reload)
npm run dev
```

> ✅ API will be live at **http://localhost:4000**
> ✅ Health check: **http://localhost:4000/api/health**

---

### 3️⃣ Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Option A: Using npx serve (recommended)
npx serve . -l 5500

# Option B: Python (if you have it)
python -m http.server 5500

# Option C: VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

> ✅ App will be live at **http://localhost:5500**

---

### 🎯 No Backend? No Problem!

On the login screen, click **"Explore with sample data"** — the entire app runs with realistic demo data stored in your browser's `localStorage`. No PostgreSQL, no backend, no problem. Try every screen instantly!

---

## 📖 API Reference

```
GET    /api/health                    → Health check

POST   /api/auth/register             → Create account
POST   /api/auth/login                → Login
POST   /api/auth/logout               → Logout

GET    /api/budgets                   → Get all budgets
POST   /api/budgets                   → Create monthly budget
PUT    /api/budgets/:id               → Update budget
GET    /api/budgets/current           → Current month's budget

GET    /api/categories/:budgetId      → Get categories for a budget
POST   /api/categories               → Add category
PUT    /api/categories/:id           → Update category

GET    /api/transactions             → List transactions
POST   /api/transactions             → Add transaction
DELETE /api/transactions/:id        → Delete transaction

GET    /api/goals                    → List goals
POST   /api/goals                    → Create goal
POST   /api/goals/:id/contribute     → Add contribution
DELETE /api/goals/:id                → Delete goal

GET    /api/analysis/summary         → Spending summary
GET    /api/analysis/trends          → Month-over-month trends
```

---

## 🎨 Design Philosophy

> *"Simplicity is the ultimate sophistication"* — but we added a little flair anyway.

The visual identity pairs:
- **Fraunces** — a serif ledger face for headlines (because money is serious)
- **Plus Jakarta Sans** — clean modern UI text
- **IBM Plex Mono** — monospace for every ₹ amount (so numbers line up like a real statement)

The signature element: **receipt-edge** perforated paper on hero cards — a nod to physical cash receipts. Fitting for an app about tracking every rupee.

Color system: Indigo × Teal × Amber — not the usual fintech cream-and-terracotta. Green/Amber/Red used *only* functionally for On-track / Near-limit / Overspent status.

---

## 🧠 Smart Design Decisions

| Feature | Decision |
|---------|----------|
| Cash/Online remaining | Shows spending pressure per payment method against whole budget (data model doesn't track which income arrived as cash vs online — intentionally) |
| Month switching | Auto-carries forward previous month's income & split — so you're not forced to re-onboard every month |
| Triggers in DB | `actual_amount` on categories and `current_amount` on goals are kept in sync by PostgreSQL triggers — no app-level sync bugs |
| Demo mode | Full offline experience with `localStorage` — zero friction to try the app |

---

## 🤝 Contributing

This is a personal project, but if it helps you and you want to improve it:

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/epic-feature`
3. Commit your changes: `git commit -m 'Add some epic feature'`
4. Push to the branch: `git push origin feature/epic-feature`
5. Open a Pull Request

Bug reports and feature suggestions are welcome via [Issues](https://github.com/Dhaval-0511/Money-Hiest/issues)!

---

## 📜 License

MIT License — free to use, modify, and distribute.
See [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ and a lot of ₹ tracking**

*"The best time to start tracking your expenses was yesterday. The second best time is now."*

⭐ If this project helped you, give it a star! It makes The Professor happy.

```
  🔴 BELLA CIAO, UNNECESSARY EXPENSES 🔴
```

</div>
