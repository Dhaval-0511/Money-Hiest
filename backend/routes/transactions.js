// routes/transactions.js
const express = require('express');
const { body, query: queryValidator, param, validationResult } = require('express-validator');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---------- ADD transaction (quick-add FAB uses this) ----------
router.post(
  '/',
  [
    body('categoryId').isUUID(),
    body('amount').isFloat({ gt: 0 }),
    body('paymentMethod').isIn(['Cash', 'Online']),
    body('fundingSource').optional().isIn(['Personal', 'TravelAllowance', 'BillAllowance']),
    body('date').optional().isISO8601(),
    body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { categoryId, amount, paymentMethod, fundingSource = 'Personal', date, note } = req.body;

    try {
      // Ownership: category -> month_budget -> user
      const owned = await query(
        `SELECT c.id FROM categories c JOIN month_budgets mb ON mb.id = c.month_budget_id
          WHERE c.id = $1 AND mb.user_id = $2`,
        [categoryId, req.user.id]
      );
      if (owned.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });

      const result = await query(
        `INSERT INTO transactions (category_id, user_id, amount, payment_method, funding_source, txn_date, note)
         VALUES ($1,$2,$3,$4,$5, COALESCE($6, CURRENT_DATE), $7)
         RETURNING *`,
        [categoryId, req.user.id, amount, paymentMethod, fundingSource, date || null, note || null]
      );
      return res.status(201).json({ transaction: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not save transaction.' });
    }
  }
);

// ---------- LIST / FILTER transactions ----------
router.get(
  '/',
  [
    queryValidator('from').optional().isISO8601(),
    queryValidator('to').optional().isISO8601(),
    queryValidator('headType').optional().isIn(['Expenses', 'Bills', 'Shopping', 'Investments', 'Upskilling', 'Lifestyle']),
    queryValidator('paymentMethod').optional().isIn(['Cash', 'Online']),
    queryValidator('categoryId').optional().isUUID(),
  ],
  async (req, res) => {
    const { from, to, headType, paymentMethod, categoryId } = req.query;
    const conditions = ['t.user_id = $1'];
    const values = [req.user.id];
    let i = 2;

    if (from) { conditions.push(`t.txn_date >= $${i++}`); values.push(from); }
    if (to) { conditions.push(`t.txn_date <= $${i++}`); values.push(to); }
    if (headType) { conditions.push(`c.head_type = $${i++}`); values.push(headType); }
    if (paymentMethod) { conditions.push(`t.payment_method = $${i++}`); values.push(paymentMethod); }
    if (categoryId) { conditions.push(`t.category_id = $${i++}`); values.push(categoryId); }

    try {
      const result = await query(
        `SELECT t.*, c.name AS category_name, c.head_type
           FROM transactions t
           JOIN categories c ON c.id = t.category_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.txn_date DESC, t.created_at DESC
          LIMIT 500`,
        values
      );
      return res.json({ transactions: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not load transactions.' });
    }
  }
);

// ---------- DELETE ----------
router.delete('/:id', [param('id').isUUID()], async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete transaction.' });
  }
});

// ---------- CASH / ONLINE BALANCE SUMMARY ----------
// Balance = money in (allowances/salary treated as "in") minus money out (transactions)
router.get('/balances/:month', [param('month').matches(/^\d{4}-\d{2}$/)], async (req, res) => {
  try {
    const budgetRes = await query(
      `SELECT * FROM month_budgets WHERE user_id = $1 AND month = $2`,
      [req.user.id, `${req.params.month}-01`]
    );
    if (budgetRes.rowCount === 0) return res.status(404).json({ error: 'No budget for this month.' });
    const budget = budgetRes.rows[0];
    const totalIncome = Number(budget.salary) + Number(budget.parental_travel_allowance) +
      Number(budget.parental_bill_allowance) + Number(budget.other_income);

    // Assume all income initially lands as "Online" unless the app is told otherwise;
    // simplification: track total spent per method for the month, income is not
    // split by method in this data model (kept simple/extensible).
    const spendRes = await query(
      `SELECT t.payment_method, COALESCE(SUM(t.amount),0)::float AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
        WHERE c.month_budget_id = $1
        GROUP BY t.payment_method`,
      [budget.id]
    );

    let cashOut = 0, onlineOut = 0;
    for (const row of spendRes.rows) {
      if (row.payment_method === 'Cash') cashOut = row.total;
      if (row.payment_method === 'Online') onlineOut = row.total;
    }

    return res.json({
      totalIncome,
      cashOut,
      onlineOut,
      totalOut: cashOut + onlineOut,
      totalRemaining: totalIncome - (cashOut + onlineOut),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not compute balances.' });
  }
});

module.exports = router;
