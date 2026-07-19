// routes/categories.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const HEAD_TYPES = ['Expenses', 'Bills', 'Shopping', 'Investments', 'Upskilling', 'Lifestyle'];

// Verify a category belongs to the requesting user (via its month_budget)
async function assertOwnedCategory(categoryId, userId) {
  const r = await query(
    `SELECT c.* FROM categories c
       JOIN month_budgets mb ON mb.id = c.month_budget_id
      WHERE c.id = $1 AND mb.user_id = $2`,
    [categoryId, userId]
  );
  return r.rows[0] || null;
}

// ---------- ADD custom category ----------
router.post(
  '/',
  [
    body('monthBudgetId').isUUID(),
    body('headType').isIn(HEAD_TYPES),
    body('name').trim().isLength({ min: 1, max: 120 }),
    body('plannedAmount').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { monthBudgetId, headType, name, plannedAmount = 0 } = req.body;

    try {
      // ownership check on the parent budget
      const owner = await query('SELECT id FROM month_budgets WHERE id = $1 AND user_id = $2', [monthBudgetId, req.user.id]);
      if (owner.rowCount === 0) return res.status(404).json({ error: 'Budget not found.' });

      const result = await query(
        `INSERT INTO categories (month_budget_id, head_type, name, planned_amount, is_custom)
         VALUES ($1,$2,$3,$4, true) RETURNING *`,
        [monthBudgetId, headType, name, plannedAmount]
      );
      return res.status(201).json({ category: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not create category.' });
    }
  }
);

// ---------- UPDATE (rename / re-plan / hide) ----------
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('plannedAmount').optional().isFloat({ min: 0 }),
    body('isHidden').optional().isBoolean(),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('notes').optional({ nullable: true }).isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const owned = await assertOwnedCategory(req.params.id, req.user.id);
    if (!owned) return res.status(404).json({ error: 'Category not found.' });

    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, col] of [
      ['name', 'name'], ['plannedAmount', 'planned_amount'], ['isHidden', 'is_hidden'],
      ['dueDate', 'due_date'], ['notes', 'notes'],
    ]) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(req.params.id);
    try {
      const result = await query(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
      return res.json({ category: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not update category.' });
    }
  }
);

module.exports = router;
