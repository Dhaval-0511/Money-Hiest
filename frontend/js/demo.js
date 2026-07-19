/* ==========================================================================
   demo.js — "Explore with sample data" mode.
   Mirrors the exact method signatures of Api (see api.js) but stores
   everything in localStorage on this device, no network calls at all.
   This lets a visitor try the full app before connecting a real backend.
   ========================================================================== */

const DemoStore = (() => {
  const LS_KEY = 'pp_demo_state_v1';
  const uid = () => 'd_' + Math.random().toString(36).slice(2, 11);

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
  const BILL_NAMES = new Set(DEFAULT_CATEGORIES.Bills);

  function blank() {
    return { user: null, budgets: {}, categories: [], transactions: [], goals: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : blank();
    } catch (_) {
      return blank();
    }
  }
  function save(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function computePlanned(totalIncome, pct) {
    return {
      Expenses: +(totalIncome * (pct.expenses / 100)).toFixed(2),
      Investments: +(totalIncome * (pct.investments / 100)).toFixed(2),
      Upskilling: +(totalIncome * (pct.upskilling / 100)).toFixed(2),
      Lifestyle: +(totalIncome * (pct.lifestyle / 100)).toFixed(2),
    };
  }

  function totalIncomeOf(b) {
    return Number(b.salary) + Number(b.parental_travel_allowance) + Number(b.parental_bill_allowance) + Number(b.other_income);
  }

  function recalcCategoryActual(state, categoryId) {
    const sum = state.transactions.filter((t) => t.category_id === categoryId).reduce((a, t) => a + Number(t.amount), 0);
    const cat = state.categories.find((c) => c.id === categoryId);
    if (cat) cat.actual_amount = +sum.toFixed(2);
  }

  function recalcGoal(state, goalId) {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.current_amount = +(goal._contributions || []).reduce((a, c) => a + c.amount, 0).toFixed(2);
    if (goal.current_amount >= goal.target_amount) goal.status = 'Completed';
  }

  // ---------- seed with the sample data described in the brief ----------
  function seedSampleData() {
    const state = blank();
    state.user = { id: 'demo-user', name: 'Demo User', email: 'you@paisaplan.app', defaultCurrency: 'INR' };

    const month = new Date().toISOString().slice(0, 7);
    const pct = TEMPLATES.Option2;
    const salary = 0, travel = 3000, billAllow = 2000, other = 12000;
    const totalIncome = salary + travel + billAllow + other;
    const planned = computePlanned(totalIncome, pct);
    const plannedBills = billAllow;
    const plannedShopping = +(planned.Lifestyle * 0.3).toFixed(2);

    const budgetId = uid();
    state.budgets[month] = {
      id: budgetId, month, salary, parental_travel_allowance: travel, parental_bill_allowance: billAllow, other_income: other,
      template_type: 'Option2', pct_expenses: pct.expenses, pct_investments: pct.investments,
      pct_upskilling: pct.upskilling, pct_lifestyle: pct.lifestyle,
      planned_bills: plannedBills, planned_shopping: plannedShopping,
    };

    for (const [head, names] of Object.entries(DEFAULT_CATEGORIES)) {
      names.forEach((name) => {
        state.categories.push({
          id: uid(), month_budget_id: budgetId, head_type: head, name,
          planned_amount: 0, actual_amount: 0, is_recurring_bill: BILL_NAMES.has(name),
          due_date: null, is_custom: false, is_hidden: false, notes: '',
        });
      });
    }

    const catByName = (name) => state.categories.find((c) => c.name === name);
    const addTxn = (name, amount, method, note, daysAgo = 2) => {
      const cat = catByName(name);
      const d = new Date(); d.setDate(d.getDate() - daysAgo);
      const t = {
        id: uid(), category_id: cat.id, user_id: 'demo-user', amount, payment_method: method,
        funding_source: 'Personal', txn_date: d.toISOString().slice(0, 10), note: note || '',
        category_name: cat.name, head_type: cat.head_type,
      };
      state.transactions.push(t);
    };

    addTxn('Food', 180, 'Cash', 'Tiffin service', 1);
    addTxn('Food', 90, 'Cash', 'Chai & snacks', 3);
    addTxn('Groceries', 650, 'Online', 'Weekly groceries', 4);
    addTxn('Transportation', 300, 'Online', 'Auto + metro card', 5);
    addTxn('Electricity bill', 900, 'Online', '', 6);
    addTxn('Gas bill', 450, 'Cash', '', 10);
    addTxn('Jio Fiber recharge', 999, 'Online', '', 2);
    addTxn('Mobile/Phone recharge', 299, 'Online', '', 8);
    addTxn('Clothes', 1200, 'Online', 'Festive kurta', 7);
    addTxn('Dining Out', 550, 'Cash', 'Weekend dinner', 3);
    addTxn('Mutual Funds', 2000, 'Online', 'Monthly SIP', 5);
    addTxn('Gym Membership', 800, 'Cash', '', 12);

    state.categories.forEach((c) => recalcCategoryActual(state, c.id));

    state.goals = [
      { id: uid(), user_id: 'demo-user', name: 'Garba Classes', target_amount: 3000, current_amount: 0, deadline: null, status: 'Active', _contributions: [{ amount: 1200 }] },
      { id: uid(), user_id: 'demo-user', name: 'Gym Membership', target_amount: 2000, current_amount: 0, deadline: null, status: 'Active', _contributions: [{ amount: 800 }] },
      { id: uid(), user_id: 'demo-user', name: 'Clothing Fund', target_amount: 5000, current_amount: 0, deadline: null, status: 'Active', _contributions: [{ amount: 1500 }] },
    ];
    state.goals.forEach((g) => recalcGoal(state, g.id));

    save(state);
    return state;
  }

  function ensureSeeded() {
    let state = load();
    if (!state.user) state = seedSampleData();
    return state;
  }

  async function tick(fn) {
    // small delay so UI transitions feel consistent with the network-backed mode
    return new Promise((resolve) => setTimeout(() => resolve(fn()), 120));
  }

  return {
    reset: () => save(blank()),
    start: () => ensureSeeded(),

    me: () => tick(() => {
      const s = load();
      if (!s.user) throw new ApiError('Not authenticated.', 401);
      return { user: s.user };
    }),

    createBudget: (payload) => tick(() => {
      const s = load();
      const { month, salary = 0, parentalTravelAllowance = 0, parentalBillAllowance = 0, otherIncome = 0, templateType, customPct } = payload;
      const totalIncome = Number(salary) + Number(parentalTravelAllowance) + Number(parentalBillAllowance) + Number(otherIncome);
      if (totalIncome <= 0) throw new ApiError('At least one income/allowance must be greater than 0.', 400);

      let pct;
      if (templateType === 'Custom') {
        const sum = Number(customPct.expenses) + Number(customPct.investments) + Number(customPct.upskilling) + Number(customPct.lifestyle);
        if (Math.round(sum) !== 100) throw new ApiError(`Custom percentages must total 100% (currently ${sum}%).`, 400);
        pct = customPct;
      } else {
        pct = TEMPLATES[templateType];
      }

      const planned = computePlanned(totalIncome, pct);
      const budgetId = uid();
      s.budgets[month] = {
        id: budgetId, month, salary, parental_travel_allowance: parentalTravelAllowance,
        parental_bill_allowance: parentalBillAllowance, other_income: otherIncome,
        template_type: templateType, pct_expenses: pct.expenses, pct_investments: pct.investments,
        pct_upskilling: pct.upskilling, pct_lifestyle: pct.lifestyle,
        planned_bills: Number(parentalBillAllowance) || 0, planned_shopping: +(planned.Lifestyle * 0.3).toFixed(2),
      };

      if (!s.categories.some((c) => c.month_budget_id === budgetId)) {
        for (const [head, names] of Object.entries(DEFAULT_CATEGORIES)) {
          names.forEach((name) => {
            s.categories.push({
              id: uid(), month_budget_id: budgetId, head_type: head, name,
              planned_amount: 0, actual_amount: 0, is_recurring_bill: BILL_NAMES.has(name),
              due_date: null, is_custom: false, is_hidden: false, notes: '',
            });
          });
        }
      }
      save(s);
      return { budget: s.budgets[month] };
    }),

    listBudgets: () => tick(() => ({ budgets: Object.values(load().budgets) })),

    getBudget: (month) => tick(() => {
      const s = load();
      const budget = s.budgets[month];
      if (!budget) throw new ApiError('No budget found for this month.', 404);
      const categories = s.categories.filter((c) => c.month_budget_id === budget.id && !c.is_hidden);
      return { budget, categories };
    }),

    createCategory: (payload) => tick(() => {
      const s = load();
      const cat = {
        id: uid(), month_budget_id: payload.monthBudgetId, head_type: payload.headType, name: payload.name,
        planned_amount: payload.plannedAmount || 0, actual_amount: 0, is_recurring_bill: false,
        due_date: null, is_custom: true, is_hidden: false, notes: '',
      };
      s.categories.push(cat);
      save(s);
      return { category: cat };
    }),

    updateCategory: (id, payload) => tick(() => {
      const s = load();
      const cat = s.categories.find((c) => c.id === id);
      if (!cat) throw new ApiError('Category not found.', 404);
      const map = { name: 'name', plannedAmount: 'planned_amount', isHidden: 'is_hidden', dueDate: 'due_date', notes: 'notes' };
      Object.entries(map).forEach(([k, col]) => { if (payload[k] !== undefined) cat[col] = payload[k]; });
      save(s);
      return { category: cat };
    }),

    createTransaction: (payload) => tick(() => {
      const s = load();
      const cat = s.categories.find((c) => c.id === payload.categoryId);
      if (!cat) throw new ApiError('Category not found.', 404);
      const t = {
        id: uid(), category_id: cat.id, user_id: 'demo-user', amount: Number(payload.amount),
        payment_method: payload.paymentMethod, funding_source: payload.fundingSource || 'Personal',
        txn_date: payload.date || new Date().toISOString().slice(0, 10), note: payload.note || '',
        category_name: cat.name, head_type: cat.head_type,
      };
      s.transactions.push(t);
      recalcCategoryActual(s, cat.id);
      save(s);
      return { transaction: t };
    }),

    listTransactions: (filters = {}) => tick(() => {
      const s = load();
      let list = [...s.transactions];
      if (filters.from) list = list.filter((t) => t.txn_date >= filters.from);
      if (filters.to) list = list.filter((t) => t.txn_date <= filters.to);
      if (filters.headType) list = list.filter((t) => t.head_type === filters.headType);
      if (filters.paymentMethod) list = list.filter((t) => t.payment_method === filters.paymentMethod);
      if (filters.categoryId) list = list.filter((t) => t.category_id === filters.categoryId);
      list.sort((a, b) => (a.txn_date < b.txn_date ? 1 : -1));
      return { transactions: list };
    }),

    deleteTransaction: (id) => tick(() => {
      const s = load();
      const t = s.transactions.find((x) => x.id === id);
      if (!t) throw new ApiError('Transaction not found.', 404);
      s.transactions = s.transactions.filter((x) => x.id !== id);
      recalcCategoryActual(s, t.category_id);
      save(s);
      return { ok: true };
    }),

    balances: (month) => tick(() => {
      const s = load();
      const budget = s.budgets[month];
      if (!budget) throw new ApiError('No budget for this month.', 404);
      const totalIncome = totalIncomeOf(budget);
      const catIds = new Set(s.categories.filter((c) => c.month_budget_id === budget.id).map((c) => c.id));
      let cashOut = 0, onlineOut = 0;
      s.transactions.filter((t) => catIds.has(t.category_id)).forEach((t) => {
        if (t.payment_method === 'Cash') cashOut += Number(t.amount); else onlineOut += Number(t.amount);
      });
      return { totalIncome, cashOut, onlineOut, totalOut: cashOut + onlineOut, totalRemaining: totalIncome - cashOut - onlineOut };
    }),

    listGoals: () => tick(() => {
      const s = load();
      const goals = s.goals.map((g) => ({ ...g, progress_pct: g.target_amount ? Math.round((g.current_amount / g.target_amount) * 1000) / 10 : 0 }));
      goals.sort((a, b) => (a.status === 'Active' ? -1 : 1) - (b.status === 'Active' ? -1 : 1));
      return { goals };
    }),

    createGoal: (payload) => tick(() => {
      const s = load();
      const goal = {
        id: uid(), user_id: 'demo-user', name: payload.name, target_amount: Number(payload.targetAmount),
        current_amount: 0, deadline: payload.deadline || null, status: 'Active', _contributions: [],
      };
      s.goals.push(goal);
      save(s);
      return { goal };
    }),

    updateGoal: (id, payload) => tick(() => {
      const s = load();
      const goal = s.goals.find((g) => g.id === id);
      if (!goal) throw new ApiError('Goal not found.', 404);
      const map = { name: 'name', targetAmount: 'target_amount', deadline: 'deadline', status: 'status' };
      Object.entries(map).forEach(([k, col]) => { if (payload[k] !== undefined) goal[col] = payload[k]; });
      save(s);
      return { goal };
    }),

    addMoneyToGoal: (id, payload) => tick(() => {
      const s = load();
      const goal = s.goals.find((g) => g.id === id);
      if (!goal) throw new ApiError('Goal not found.', 404);
      goal._contributions = goal._contributions || [];
      goal._contributions.push({ amount: Number(payload.amount), payment_method: payload.paymentMethod });
      recalcGoal(s, id);
      save(s);
      return { goal };
    }),

    deleteGoal: (id) => tick(() => {
      const s = load();
      s.goals = s.goals.filter((g) => g.id !== id);
      save(s);
      return { ok: true };
    }),

    analysis: (month) => tick(() => {
      const s = load();
      const budget = s.budgets[month];
      if (!budget) throw new ApiError('No budget for this month.', 404);
      const totalIncome = totalIncomeOf(budget);
      const topLevelPlanned = {
        Expenses: totalIncome * (budget.pct_expenses / 100),
        Investments: totalIncome * (budget.pct_investments / 100),
        Upskilling: totalIncome * (budget.pct_upskilling / 100),
        Lifestyle: totalIncome * (budget.pct_lifestyle / 100),
        Bills: Number(budget.planned_bills),
        Shopping: Number(budget.planned_shopping),
      };
      const cats = s.categories.filter((c) => c.month_budget_id === budget.id && !c.is_hidden);
      const heads = ['Expenses', 'Bills', 'Shopping', 'Investments', 'Upskilling', 'Lifestyle'].map((h) => {
        const actual = cats.filter((c) => c.head_type === h).reduce((a, c) => a + Number(c.actual_amount), 0);
        const planned = topLevelPlanned[h] || 0;
        let status, color;
        if (planned <= 0) { status = 'No Plan Set'; color = 'gray'; }
        else if (h === 'Investments') { status = actual >= planned ? 'On Track' : 'Behind Goal'; color = actual >= planned ? 'green' : 'yellow'; }
        else {
          const ratio = actual / planned;
          status = ratio <= 1 ? 'On Track' : 'Overspending';
          color = ratio <= 0.9 ? 'green' : ratio <= 1.1 ? 'yellow' : 'red';
        }
        return { head: h, planned: +planned.toFixed(2), actual: +actual.toFixed(2), status, color };
      });

      const catIds = new Set(cats.map((c) => c.id));
      let cashOut = 0, onlineOut = 0;
      s.transactions.filter((t) => catIds.has(t.category_id)).forEach((t) => {
        if (t.payment_method === 'Cash') cashOut += Number(t.amount); else onlineOut += Number(t.amount);
      });

      const goals = s.goals.map((g) => ({ ...g, progress_pct: g.target_amount ? Math.round((g.current_amount / g.target_amount) * 1000) / 10 : 0 }));

      const messages = [];
      const overspending = heads.filter((h) => h.status === 'Overspending');
      const behind = heads.filter((h) => h.status === 'Behind Goal');
      if (overspending.length === 0 && behind.length === 0) messages.push('You are on track with your budget this month.');
      if (overspending.length > 0) messages.push(`You are overspending in ${overspending.length} categor${overspending.length > 1 ? 'ies' : 'y'}: ${overspending.map((h) => h.head).join(', ')}. Review these areas.`);
      behind.forEach((h) => messages.push(`You are behind your ${h.head.toLowerCase()} goal by ₹${(h.planned - h.actual).toFixed(0)}. Try to add more to ${h.head}.`));
      goals.forEach((g) => {
        if (g.status === 'Active') {
          const gap = g.target_amount - g.current_amount;
          if (gap > 0) messages.push(`You are behind your goal '${g.name}' by ₹${gap.toFixed(0)}. Consider adding ₹${Math.min(gap, 500).toFixed(0)} more this month.`);
        }
      });

      return {
        totalIncome, heads, categories: cats.map((c) => ({ head_type: c.head_type, name: c.name, planned: c.planned_amount, actual: c.actual_amount })),
        cashOnline: { Cash: cashOut, Online: onlineOut }, goals, messages, overshootingCount: overspending.length,
      };
    }),
  };
})();

window.DemoStore = DemoStore;
