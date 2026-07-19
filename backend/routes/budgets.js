// routes/budgets.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query, getClient } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const TEMPLATES = {
  Option1: { expenses: 75, investments: 15, upskilling: 5, lifestyle: 5 },
  Option2: { expenses: 65, investments: 20, upskilling: 5, lifestyle: 10 },
  Option3: { expenses: 60, investments: 20, upskilling: 5, lifestyle: 15 },
  Option4: { expenses: 50, investments: 35, upskilling: 5, lifestyle: 10 },
};

const DEFAULT_CATEGORIES = {
  Expenses: ['Food', 'Groceries', 'Transportation', 'Healthcare', 'Miscellaneous'],
  Bills: ['Electricity bill', 'Gas bill', 'Jio Fiber recharge', 'Mobile/Phone recharge', 'Newspaper bill', 'Other utility bills'],
  Shopping: ['Clothes', 'Personal care', 'Electronics / Gadgets', 'Gifts', 'Other shopping'],
  Lifestyle: ['Dining Out', 'Movies', 'Entertainment', 'Subscriptions (OTT, apps)', 'Hobbies', 'Travel Fund'],
  Investments: ['Emergency Fund', 'Mutual Funds', 'SIP', 'Stocks', 'PPF', 'FD', 'NPS', 'Insurance'],
  Upskilling: ['Books', 'Online Courses', 'Coaching / Mentorship', 'Gym Membership', 'Workshops / Seminars', 'Certifications'],
};

const BILL_NAMES = new Set(['Electricity bill', 'Gas bill', 'Jio Fiber recharge', 'Mobile/Phone recharge', 'Newspaper bill', 'Other utility bills']);

function firstOfMonth(monthStr) {
  // monthStr expected as 'YYYY-MM'
  return `${monthStr}-01`;
}

function computePlanned(totalIncome, pct) {
  return {
    plannedExpenses: +(totalIncome * (pct.expenses / 100)).toFixed(2),
    plannedInvestments: +(totalIncome * (pct.investments / 100)).toFixed(2),
    plannedUpskilling: +(totalIncome * (pct.upskilling / 100)).toFixed(2),
    plannedLifestyle: +(totalIncome * (pct.lifestyle / 100)).toFixed(2),
  };
}

// ---------- CREATE (onboarding) ----------
router.post(
  '/',
  [
    body('month').matches(/^\d{4}-\d{2}$/).withMessage('month must be YYYY-MM'),
    body('salary').optional().isFloat({ min: 0 }),
    body('parentalTravelAllowance').optional().isFloat({ min: 0 }),
    body('parentalBillAllowance').optional().isFloat({ min: 0 }),
    body('otherIncome').optional().isFloat({ min: 0 }),
    body('templateType').isIn(['Option1', 'Option2', 'Option3', 'Option4', 'Custom']),
    body('customPct').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const {
      month, salary = 0, parentalTravelAllowance = 0, parentalBillAllowance = 0,
      otherIncome = 0, templateType, customPct,
    } = req.body;

    const totalIncome = Number(salary) + Number(parentalTravelAllowance) + Number(parentalBillAllowance) + Number(otherIncome);
    if (totalIncome <= 0) {
      return res.status(400).json({ error: 'At least one income/allowance must be greater than 0.' });
    }

    let pct;
    if (templateType === 'Custom') {
      if (!customPct) return res.status(400).json({ error: 'customPct is required for Custom template.' });
      const { expenses, investments, upskilling, lifestyle } = customPct;
      const sum = Number(expenses) + Number(investments) + Number(upskilling) + Number(lifestyle);
      if (Math.round(sum) !== 100) {
        return res.status(400).json({ error: `Custom percentages must total 100% (currently ${sum}%).` });
      }
      pct = { expenses: Number(expenses), investments: Number(investments), upskilling: Number(upskilling), lifestyle: Number(lifestyle) };
    } else {
      pct = TEMPLATES[templateType];
    }

    const planned = computePlanned(totalIncome, pct);
    const plannedBills = Number(parentalBillAllowance) || 0;
    const plannedShopping = +(planned.plannedLifestyle * 0.3).toFixed(2); // shopping carved from lifestyle by default

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const budgetResult = await client.query(
        `INSERT INTO month_budgets
          (user_id, month, salary, parental_travel_allowance, parental_bill_allowance, other_income,
           template_type, pct_expenses, pct_investments, pct_upskilling, pct_lifestyle,
           planned_bills, planned_shopping)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id, month) DO UPDATE SET
           salary = EXCLUDED.salary,
           parental_travel_allowance = EXCLUDED.parental_travel_allowance,
           parental_bill_allowance = EXCLUDED.parental_bill_allowance,
           other_income = EXCLUDED.other_income,
           template_type = EXCLUDED.template_type,
           pct_expenses = EXCLUDED.pct_expenses,
           pct_investments = EXCLUDED.pct_investments,
           pct_upskilling = EXCLUDED.pct_upskilling,
           pct_lifestyle = EXCLUDED.pct_lifestyle,
           planned_bills = EXCLUDED.planned_bills,
           planned_shopping = EXCLUDED.planned_shopping,
           updated_at = now()
         RETURNING *`,
        [req.user.id, firstOfMonth(month), salary, parentalTravelAllowance, parentalBillAllowance, otherIncome,
         templateType, pct.expenses, pct.investments, pct.upskilling, pct.lifestyle, plannedBills, plannedShopping]
      );

      const budget = budgetResult.rows[0];

      // Seed default categories only if none exist yet for this budget
      const existingCats = await client.query('SELECT COUNT(*)::int AS c FROM categories WHERE month_budget_id = $1', [budget.id]);
      if (existingCats.rows[0].c === 0) {
        for (const [head, names] of Object.entries(DEFAULT_CATEGORIES)) {
          for (const name of names) {
            const isBill = BILL_NAMES.has(name);
            await client.query(
              `INSERT INTO categories (month_budget_id, head_type, name, is_recurring_bill, is_custom)
               VALUES ($1,$2,$3,$4,false)`,
              [budget.id, head, name, isBill]
            );
          }
        }
      }

      await client.query('COMMIT');
      return res.status(201).json({ budget });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create budget error', err);
      return res.status(500).json({ error: 'Could not save budget.' });
    } finally {
      client.release();
    }
  }
);

// ---------- LIST all months for user ----------
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, month, salary, parental_travel_allowance, parental_bill_allowance, other_income,
              template_type, pct_expenses, pct_investments, pct_upskilling, pct_lifestyle,
              planned_bills, planned_shopping
       FROM month_budgets WHERE user_id = $1 ORDER BY month DESC`,
      [req.user.id]
    );
    return res.json({ budgets: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load budgets.' });
  }
});

// ---------- GET single month (with categories) ----------
router.get('/:month', [param('month').matches(/^\d{4}-\d{2}$/)], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid month format.' });

  try {
    const budgetResult = await query(
      `SELECT * FROM month_budgets WHERE user_id = $1 AND month = $2`,
      [req.user.id, firstOfMonth(req.params.month)]
    );
    if (budgetResult.rowCount === 0) return res.status(404).json({ error: 'No budget found for this month.' });

    const budget = budgetResult.rows[0];
    const catResult = await query(
      `SELECT * FROM categories WHERE month_budget_id = $1 AND is_hidden = false ORDER BY head_type, name`,
      [budget.id]
    );

    return res.json({ budget, categories: catResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load budget.' });
  }
});

module.exports = router;
