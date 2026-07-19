# Expense Tracker — Backend (Node/Express + PostgreSQL)

## 1. Create the database
```bash
createdb expense_tracker
# or in psql:
psql -U postgres -c "CREATE DATABASE expense_tracker;"
psql -U postgres -c "CREATE USER expense_tracker_app WITH PASSWORD 'change_this_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE expense_tracker TO expense_tracker_app;"
```

## 2. Load the schema
```bash
psql -U expense_tracker_app -d expense_tracker -f schema.sql
```

## 3. Configure environment
```bash
cp .env.example .env
# then edit .env: set PGPASSWORD and a long random JWT_SECRET
# generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 4. Install & run
```bash
npm install
npm run dev      # nodemon, for local development
# or
npm start        # production
```

Server starts on `http://localhost:4000` by default. Check `GET /api/health`.

## Security notes
- Passwords hashed with **bcrypt** (12 salt rounds).
- Auth via **JWT** stored in an **httpOnly, sameSite=lax** cookie (not accessible to JS — mitigates XSS token theft).
- **helmet** sets secure HTTP headers; **hpp** blocks parameter-pollution attacks.
- Every route validated with **express-validator**; all SQL uses parameterized queries (`$1, $2...`) — no string concatenation, so no SQL injection surface.
- Rate limiting: global (200 req / 15 min) + strict limiter on `/api/auth/login` (10 attempts / 15 min).
- Every resource (category, transaction, goal) is ownership-checked against `req.user.id` before read/write — one user can never see another's data.
- Set `NODE_ENV=production` and serve behind HTTPS in production (secure cookie flag activates automatically).

## API summary
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Log in (rate-limited) |
| POST | /api/auth/logout | Clear session |
| GET  | /api/auth/me | Current user |
| POST | /api/budgets | Onboarding: create/update a month's budget + seed default categories |
| GET  | /api/budgets | List all months |
| GET  | /api/budgets/:month | Get one month + its categories (YYYY-MM) |
| POST | /api/categories | Add a custom category |
| PATCH | /api/categories/:id | Rename / re-plan / hide a category |
| POST | /api/transactions | Log a transaction (quick-add) |
| GET | /api/transactions | List/filter transactions |
| DELETE | /api/transactions/:id | Delete a transaction |
| GET | /api/transactions/balances/:month | Cash/Online/Total remaining |
| GET | /api/goals | List goals |
| POST | /api/goals | Create goal |
| PATCH | /api/goals/:id | Edit goal |
| POST | /api/goals/:id/add-money | Contribute to a goal |
| DELETE | /api/goals/:id | Delete goal |
| GET | /api/analysis/:month | All chart data + auto-generated insight messages |
