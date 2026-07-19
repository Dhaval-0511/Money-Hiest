// routes/analysis.js
const express = require('express');
const { param, validationResult } = require('express-validator');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const SAVINGS_HEADS = new Set(['Investments']); // heads where Actual < Planned means "behind", not "overspending"

function statusFor(head, planned, actual) {
  if (planned <= 0) return 'No Plan Set';
  const ratio = actual / planned;
  if (SAVINGS_HEADS.has(head)) {
    return actual >= planned ? 'On Track' : 'Behind Goal';
  }
  if (ratio <= 1) return 'On Track';
  return 'Overspending';
}

function colorFor(head, planned, actual) {
  if (planned <= 0) return 'gray';
  const ratio = actual / planned;
  if (ratio <= 0.9) return 'green';
  if (ratio <= 1.1) return 'yellow';
  return 'red';
}

router.get('/:month', [param('month').matches(/^\d{4}-\d{2}$/)], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid month format.' });

  try {
    const budgetRes = await query(
      `SELECT * FROM month_budgets WHERE user_id = $1 AND month = $2`,
      [req.user.id, `${req.params.month}-01`]
    );
    if (budgetRes.rowCount === 0) return res.status(404).json({ error: 'No budget for this month.' });
    const budget = budgetRes.rows[0];

    const totalIncome = Number(budget.salary) + Number(budget.parental_travel_allowance) +
      Number(budget.parental_bill_allowance) + Number(budget.other_income);

    // Per-head planned vs actual
    const headRes = await query(
      `SELECT head_type,
              COALESCE(SUM(planned_amount),0)::float AS planned,
              COALESCE(SUM(actual_amount),0)::float AS actual
         FROM categories WHERE month_budget_id = $1 AND is_hidden = false
        GROUP BY head_type`,
      [budget.id]
    );

    // Overlay top-level planned amounts computed at budget creation (Expenses/Investments/Upskilling/Lifestyle),
    // and derived planned for Bills/Shopping
    const topLevelPlanned = {
      Expenses: totalIncome * (budget.pct_expenses / 100),
      Investments: totalIncome * (budget.pct_investments / 100),
      Upskilling: totalIncome * (budget.pct_upskilling / 100),
      Lifestyle: totalIncome * (budget.pct_lifestyle / 100),
      Bills: Number(budget.planned_bills),
      Shopping: Number(budget.planned_shopping),
    };

    const heads = ['Expenses', 'Bills', 'Shopping', 'Investments', 'Upskilling', 'Lifestyle'].map((h) => {
      const row = headRes.rows.find((r) => r.head_type === h);
      const actual = row ? row.actual : 0;
      const planned = topLevelPlanned[h] || 0;
      return {
        head: h,
        planned: +planned.toFixed(2),
        actual: +actual.toFixed(2),
        status: statusFor(h, planned, actual),
        color: colorFor(h, planned, actual),
      };
    });

    // Category breakdown per head (for mini pie/bar charts)
    const catRes = await query(
      `SELECT head_type, name, planned_amount::float AS planned, actual_amount::float AS actual
         FROM categories WHERE month_budget_id = $1 AND is_hidden = false ORDER BY head_type, name`,
      [budget.id]
    );

    // Cash vs Online split
    const payRes = await query(
      `SELECT t.payment_method, COALESCE(SUM(t.amount),0)::float AS total
         FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE c.month_budget_id = $1 GROUP BY t.payment_method`,
      [budget.id]
    );
    const cashOnline = { Cash: 0, Online: 0 };
    payRes.rows.forEach((r) => { cashOnline[r.payment_method] = r.total; });

    // Goals overview
    const goalsRes = await query(
      `SELECT *, ROUND((current_amount / NULLIF(target_amount,0)) * 100, 1) AS progress_pct
         FROM goals WHERE user_id = $1 ORDER BY (status='Active') DESC, created_at DESC`,
      [req.user.id]
    );

    // Auto-generated insight messages
    const messages = [];
    const overspending = heads.filter((h) => h.status === 'Overspending');
    const behind = heads.filter((h) => h.status === 'Behind Goal');

    if (overspending.length === 0 && behind.length === 0) {
      messages.push('You are on track with your budget this month.');
    }
    if (overspending.length > 0) {
      messages.push(`You are overspending in ${overspending.length} categor${overspending.length > 1 ? 'ies' : 'y'}: ${overspending.map((h) => h.head).join(', ')}. Review these areas.`);
    }
    if (behind.length > 0) {
      behind.forEach((h) => {
        const gap = (h.planned - h.actual).toFixed(0);
        messages.push(`You are behind your ${h.head.toLowerCase()} goal by ₹${gap}. Try to add more to ${h.head}.`);
      });
    }
    goalsRes.rows.forEach((g) => {
      if (g.status === 'Active') {
        const gap = Number(g.target_amount) - Number(g.current_amount);
        if (gap > 0) {
          messages.push(`You are behind your goal '${g.name}' by ₹${gap.toFixed(0)}. Consider adding ₹${Math.min(gap, 500).toFixed(0)} more this month.`);
        }
      }
    });

    return res.json({
      totalIncome,
      heads,
      categories: catRes.rows,
      cashOnline,
      goals: goalsRes.rows,
      messages,
      overshootingCount: overspending.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not compute analysis.' });
  }
});

module.exports = router;
