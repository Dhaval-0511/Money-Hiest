// routes/goals.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---------- LIST goals ----------
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT *, ROUND((current_amount / NULLIF(target_amount,0)) * 100, 1) AS progress_pct
         FROM goals WHERE user_id = $1 ORDER BY (status = 'Active') DESC, created_at DESC`,
      [req.user.id]
    );
    return res.json({ goals: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load goals.' });
  }
});

// ---------- CREATE goal ----------
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 120 }),
    body('targetAmount').isFloat({ gt: 0 }),
    body('deadline').optional({ nullable: true }).isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, targetAmount, deadline } = req.body;
    try {
      const result = await query(
        `INSERT INTO goals (user_id, name, target_amount, deadline) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user.id, name, targetAmount, deadline || null]
      );
      return res.status(201).json({ goal: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not create goal.' });
    }
  }
);

// ---------- UPDATE goal (edit target/deadline/status) ----------
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('targetAmount').optional().isFloat({ gt: 0 }),
    body('deadline').optional({ nullable: true }).isISO8601(),
    body('status').optional().isIn(['Active', 'Completed']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, col] of [['name', 'name'], ['targetAmount', 'target_amount'], ['deadline', 'deadline'], ['status', 'status']]) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.params.id, req.user.id);

    try {
      const result = await query(
        `UPDATE goals SET ${fields.join(', ')}, updated_at = now()
          WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
        values
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Goal not found.' });
      return res.json({ goal: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not update goal.' });
    }
  }
);

// ---------- ADD MONEY to goal ----------
router.post(
  '/:id/add-money',
  [
    param('id').isUUID(),
    body('amount').isFloat({ gt: 0 }),
    body('paymentMethod').isIn(['Cash', 'Online']),
    body('date').optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    try {
      const owned = await query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (owned.rowCount === 0) return res.status(404).json({ error: 'Goal not found.' });

      const { amount, paymentMethod, date } = req.body;
      await query(
        `INSERT INTO goal_contributions (goal_id, user_id, amount, payment_method, contributed_on)
         VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE))`,
        [req.params.id, req.user.id, amount, paymentMethod, date || null]
      );

      const goal = await query('SELECT * FROM goals WHERE id = $1', [req.params.id]);
      return res.json({ goal: goal.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not add money to goal.' });
    }
  }
);

// ---------- DELETE goal ----------
router.delete('/:id', [param('id').isUUID()], async (req, res) => {
  try {
    const result = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Goal not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not delete goal.' });
  }
});

module.exports = router;
