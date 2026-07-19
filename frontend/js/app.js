/* ==========================================================================
   app.js — Paisa Plan front-end orchestration.
   Works identically against the real API (js/api.js) or the local demo
   engine (js/demo.js) — everything goes through the `backend` object below,
   which exposes the same async methods either way.
   ========================================================================== */

(() => {
  'use strict';

  // ---------------------------------------------------------------- state
  let backend = null;
  let isDemo = false;
  let currentUser = null;
  let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  let currentBudget = null;
  let currentCategories = [];
  let currentGoals = [];
  let currentAnalysis = null;
  let selectedTemplate = 'Option1';
  let historyDrillCategoryId = '';

  const HEAD_META = {
    Expenses: { icon: 'bi-house-door-fill', color: 'var(--indigo)' },
    Bills: { icon: 'bi-receipt-cutoff', color: 'var(--amber)' },
    Shopping: { icon: 'bi-bag-heart-fill', color: '#C084FC' },
    Investments: { icon: 'bi-graph-up-arrow', color: 'var(--teal)' },
    Upskilling: { icon: 'bi-mortarboard-fill', color: '#4FA8E8' },
    Lifestyle: { icon: 'bi-emoji-sunglasses-fill', color: 'var(--coral)' },
  };
  const HEADS = ['Expenses', 'Bills', 'Shopping', 'Investments', 'Upskilling', 'Lifestyle'];
  const TEMPLATES = [
    { key: 'Option1', name: 'Steady Saver', pct: { expenses: 75, investments: 15, upskilling: 5, lifestyle: 5 } },
    { key: 'Option2', name: 'Balanced', pct: { expenses: 65, investments: 20, upskilling: 5, lifestyle: 10 } },
    { key: 'Option3', name: 'Growth Focused', pct: { expenses: 60, investments: 20, upskilling: 5, lifestyle: 15 } },
    { key: 'Option4', name: 'Aggressive Investor', pct: { expenses: 50, investments: 35, upskilling: 5, lifestyle: 10 } },
  ];

  // ---------------------------------------------------------------- utils
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

  function toast(msg) {
    $('#appToastBody').textContent = msg;
    new bootstrap.Toast($('#appToast'), { delay: 2600 }).show();
  }

  function showError(elId, msg) {
    const el = $(elId);
    el.textContent = msg;
    el.classList.remove('d-none');
  }
  function hideError(elId) {
    $(elId).classList.add('d-none');
  }

  function monthLabel(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  function shiftMonth(monthStr, delta) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function monthBounds(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const from = `${monthStr}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  }

  // ---------------------------------------------------------------- theme
  function initTheme() {
    const saved = localStorage.getItem('pp_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }
  function updateThemeIcon(theme) {
    const icon = $('#themeToggleBtn i');
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pp_theme', next);
    updateThemeIcon(next);
    if ($('#view-analysis') && !$('#view-analysis').classList.contains('d-none')) renderAnalysisView();
  }

  // ---------------------------------------------------------------- auth
  function showAuthScreen() {
    $('#authScreen').classList.remove('d-none');
    $('#onboardingScreen').classList.add('d-none');
    $('#appMain').classList.add('d-none');
    $('#fabAddBtn').classList.add('d-none');
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    hideError('#authError');
    const mode = $('#authPills .nav-link.active').dataset.auth;
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    const name = $('#authDisplayName').value.trim();

    try {
      backend = window.Api;
      isDemo = false;
      let res;
      if (mode === 'register') {
        res = await backend.register(email, password, name);
      } else {
        res = await backend.login(email, password);
      }
      currentUser = res.user;
      $('#userEmailLabel').textContent = currentUser.email;
      await afterAuth();
    } catch (err) {
      showError('#authError', err.message || 'Something went wrong.');
    }
  }

  async function startDemoMode() {
    backend = window.DemoStore;
    isDemo = true;
    const res = await backend.me().catch(async () => {
      backend.start();
      return backend.me();
    });
    currentUser = res.user;
    $('#userEmailLabel').textContent = `${currentUser.name} (sample data)`;
    await afterAuth();
  }

  async function afterAuth() {
    try {
      const res = await backend.getBudget(currentMonth);
      currentBudget = res.budget;
      currentCategories = res.categories;
      await enterApp();
    } catch (err) {
      if (err.status === 404) {
        showOnboarding();
      } else {
        toast(err.message || 'Could not load your budget.');
      }
    }
  }

  function logout() {
    if (!isDemo) backend.logout().catch(() => {});
    currentUser = null; currentBudget = null; currentCategories = []; currentGoals = []; currentAnalysis = null;
    $('#authForm').reset();
    showAuthScreen();
  }

  // ---------------------------------------------------------------- onboarding
  function showOnboarding() {
    $('#authScreen').classList.add('d-none');
    $('#appMain').classList.add('d-none');
    $('#fabAddBtn').classList.add('d-none');
    $('#onboardingScreen').classList.remove('d-none');
    $('#onboardStep1').classList.remove('d-none');
    $('#onboardStep2').classList.add('d-none');
    renderTemplateGrid();
    updateIncomePreview();
  }

  function updateIncomePreview() {
    const total = ['#inSalary', '#inTravel', '#inBillAllowance', '#inOther']
      .reduce((sum, id) => sum + (Number($(id).value) || 0), 0);
    $('#totalIncomePreview').textContent = inr(total);
    return total;
  }

  function renderTemplateGrid() {
    const grid = $('#templateGrid');
    grid.innerHTML = TEMPLATES.map((t) => `
      <div class="col-6 col-lg-3">
        <div class="template-option ${selectedTemplate === t.key ? 'selected' : ''}" data-template="${t.key}">
          <div class="t-name">${t.name}</div>
          <div class="t-row"><span>Expenses</span><b>${t.pct.expenses}%</b></div>
          <div class="t-row"><span>Investments</span><b>${t.pct.investments}%</b></div>
          <div class="t-row"><span>Upskilling</span><b>${t.pct.upskilling}%</b></div>
          <div class="t-row"><span>Lifestyle</span><b>${t.pct.lifestyle}%</b></div>
        </div>
      </div>`).join('') + `
      <div class="col-6 col-lg-3">
        <div class="template-option ${selectedTemplate === 'Custom' ? 'selected' : ''}" data-template="Custom">
          <div class="t-name">Custom split</div>
          <div class="t-row"><span>Define your own</span><b><i class="bi bi-sliders"></i></b></div>
        </div>
      </div>`;

    $$('.template-option').forEach((el) => el.addEventListener('click', () => {
      selectedTemplate = el.dataset.template;
      renderTemplateGrid();
      $('#customTemplateCard').classList.toggle('d-none', selectedTemplate !== 'Custom');
    }));
    $('#customTemplateCard').classList.toggle('d-none', selectedTemplate !== 'Custom');
  }

  function customPctTotal() {
    return $$('.custom-pct').reduce((s, i) => s + (Number(i.value) || 0), 0);
  }
  function updateCustomPctTotal() {
    const total = customPctTotal();
    const el = $('#customPctTotal');
    el.textContent = `Total: ${total}%`;
    el.style.color = total === 100 ? 'var(--teal)' : 'var(--coral)';
  }

  async function finishOnboarding() {
    const totalIncome = updateIncomePreview();
    if (totalIncome <= 0) { showError('#step1Error', 'Enter at least one amount greater than ₹0.'); return; }

    let customPct;
    if (selectedTemplate === 'Custom') {
      if (customPctTotal() !== 100) { toast('Custom percentages must total 100%.'); return; }
      customPct = {};
      $$('.custom-pct').forEach((i) => { customPct[i.dataset.key] = Number(i.value); });
    }

    const payload = {
      month: currentMonth,
      salary: Number($('#inSalary').value) || 0,
      parentalTravelAllowance: Number($('#inTravel').value) || 0,
      parentalBillAllowance: Number($('#inBillAllowance').value) || 0,
      otherIncome: Number($('#inOther').value) || 0,
      templateType: selectedTemplate,
      customPct,
    };

    try {
      await backend.createBudget(payload);
      const res = await backend.getBudget(currentMonth);
      currentBudget = res.budget; currentCategories = res.categories;
      await enterApp();
      toast('Your budget is ready!');
    } catch (err) {
      toast(err.message || 'Could not save your budget.');
    }
  }

  // ---------------------------------------------------------------- app shell
  async function enterApp() {
    $('#authScreen').classList.add('d-none');
    $('#onboardingScreen').classList.add('d-none');
    $('#appMain').classList.remove('d-none');
    $('#fabAddBtn').classList.remove('d-none');
    $('#currentMonthLabel').textContent = monthLabel(currentMonth);
    await loadGoals();
    await loadAnalysis();
    populateCategorySelects();
    switchView('dashboard');
  }

  function switchView(view) {
    $$('.app-tabs .nav-link').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.app-view').forEach((v) => v.classList.add('d-none'));
    $(`#view-${view}`).classList.remove('d-none');
    if (view === 'dashboard') renderDashboard();
    if (view === 'goals') renderGoalsView();
    if (view === 'analysis') renderAnalysisView();
    if (view === 'history') { historyDrillCategoryId = ''; renderHistoryView(); }
  }

  async function reloadMonthData() {
    try {
      const res = await backend.getBudget(currentMonth);
      currentBudget = res.budget; currentCategories = res.categories;
    } catch (err) {
      if (err.status === 404 && currentBudgetTemplateAvailable()) {
        // Carry forward last month's income & template automatically
        await backend.createBudget({
          month: currentMonth,
          salary: Number(currentBudget.salary) || 0,
          parentalTravelAllowance: Number(currentBudget.parental_travel_allowance) || 0,
          parentalBillAllowance: Number(currentBudget.parental_bill_allowance) || 0,
          otherIncome: Number(currentBudget.other_income) || 0,
          templateType: currentBudget.template_type,
          customPct: currentBudget.template_type === 'Custom' ? {
            expenses: currentBudget.pct_expenses, investments: currentBudget.pct_investments,
            upskilling: currentBudget.pct_upskilling, lifestyle: currentBudget.pct_lifestyle,
          } : undefined,
        });
        const res2 = await backend.getBudget(currentMonth);
        currentBudget = res2.budget; currentCategories = res2.categories;
        toast(`Carried forward your budget setup to ${monthLabel(currentMonth)}.`);
      } else {
        currentBudget = null; currentCategories = [];
        showOnboarding();
        return false;
      }
    }
    return true;
  }
  function currentBudgetTemplateAvailable() { return !!currentBudget; }

  async function goToMonth(delta) {
    currentMonth = shiftMonth(currentMonth, delta);
    $('#currentMonthLabel').textContent = monthLabel(currentMonth);
    const ok = await reloadMonthData();
    if (!ok) return;
    await loadAnalysis();
    populateCategorySelects();
    const activeView = $('.app-tabs .nav-link.active').dataset.view;
    switchView(activeView);
  }

  async function loadGoals() {
    const res = await backend.listGoals();
    currentGoals = res.goals;
  }
  async function loadAnalysis() {
    try {
      currentAnalysis = await backend.analysis(currentMonth);
    } catch (_) {
      currentAnalysis = null;
    }
  }

  function populateCategorySelects() {
    const grouped = HEADS.map((h) => {
      const cats = currentCategories.filter((c) => c.head_type === h);
      if (!cats.length) return '';
      return `<optgroup label="${h}">${cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`;
    }).join('');
    ['#quickCategory', '#modalCategory'].forEach((sel) => { $(sel).innerHTML = grouped; });
  }

  // ---------------------------------------------------------------- dashboard
  function renderDashboard() {
    if (!currentAnalysis) return;
    const { totalIncome, heads } = currentAnalysis;
    const plannedTotal = heads.reduce((s, h) => s + h.planned, 0);
    const actualTotal = heads.reduce((s, h) => s + h.actual, 0);

    $('#heroTotalIncome').textContent = inr(totalIncome);
    $('#heroPlanned').textContent = inr(plannedTotal);
    $('#heroActual').textContent = inr(actualTotal);
    $('#heroInsightText').textContent = currentAnalysis.messages[0] || 'You are on track with your budget this month.';

    const cashOut = currentAnalysis.cashOnline.Cash || 0;
    const onlineOut = currentAnalysis.cashOnline.Online || 0;
    $('#cashRemaining').textContent = inr(totalIncome - cashOut);
    $('#onlineRemaining').textContent = inr(totalIncome - onlineOut);
    $('#totalRemaining').textContent = inr(totalIncome - cashOut - onlineOut);

    $('#headCardsGrid').innerHTML = heads.map((h) => {
      const meta = HEAD_META[h.head];
      const pct = h.planned > 0 ? Math.min(150, Math.round((h.actual / h.planned) * 100)) : 0;
      const barClass = h.color === 'green' ? 'bar-green' : h.color === 'yellow' ? 'bar-yellow' : h.color === 'red' ? 'bar-red' : 'bar-gray';
      const statusClass = `status-${h.color}`;
      return `
      <div class="col-6 col-lg-4">
        <div class="head-card" data-head="${h.head}">
          <div class="head-card-top">
            <div class="head-icon" style="background:${meta.color}"><i class="bi ${meta.icon}"></i></div>
            <div>
              <div class="h-name">${h.head}</div>
              <div class="h-amounts">Planned ${inr(h.planned)} · Actual ${inr(h.actual)}</div>
            </div>
          </div>
          <div class="progress premium-progress" style="height:9px;">
            <div class="progress-bar ${barClass}" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <span class="status-pill ${statusClass}">${h.status}</span>
        </div>
      </div>`;
    }).join('');

    $$('.head-card').forEach((el) => el.addEventListener('click', () => openHeadDetail(el.dataset.head)));
  }

  // ---------------------------------------------------------------- head detail
  function openHeadDetail(head) {
    const meta = HEAD_META[head];
    const headData = currentAnalysis.heads.find((h) => h.head === head);
    $('#headDetailIcon').innerHTML = `<i class="bi ${meta.icon}"></i>`;
    $('#headDetailIcon').style.background = meta.color;
    $('#headDetailTitle').textContent = head;
    $('#headDetailSubtext').textContent = `This month you can spend up to ${inr(headData.planned)} on ${head}.`;
    const pct = headData.planned > 0 ? Math.min(100, Math.round((headData.actual / headData.planned) * 100)) : 0;
    const barClass = headData.color === 'green' ? 'bar-green' : headData.color === 'yellow' ? 'bar-yellow' : headData.color === 'red' ? 'bar-red' : 'bar-gray';
    const bar = $('#headDetailProgressBar');
    bar.className = `progress-bar ${barClass}`;
    bar.style.width = `${pct}%`;

    const cats = currentCategories.filter((c) => c.head_type === head);
    $('#headDetailCategoryList').innerHTML = cats.map((c) => {
      const catPct = c.planned_amount > 0 ? Math.min(100, Math.round((c.actual_amount / c.planned_amount) * 100)) : 0;
      const due = c.due_date ? `<span class="cat-due"><i class="bi bi-calendar-event me-1"></i>Due ${new Date(c.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>` : '';
      return `
      <div class="list-group-item">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="cat-name">${c.name} ${c.is_recurring_bill ? '<i class="bi bi-arrow-repeat text-muted" title="Recurring"></i>' : ''}</div>
            <div class="text-muted small">${c.planned_amount > 0 ? `Planned ${inr(c.planned_amount)} · ` : ''}Actual ${inr(c.actual_amount)}</div>
            ${due}
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-view-txn="${c.id}"><i class="bi bi-list-ul"></i></button>
            <button class="btn btn-sm btn-primary-brand" data-quick-cat="${c.id}"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
        ${c.planned_amount > 0 ? `<div class="cat-progress-wrap"><div class="progress premium-progress" style="height:6px;"><div class="progress-bar bar-${catPct > 100 ? 'red' : 'green'}" style="width:${Math.min(catPct, 100)}%"></div></div></div>` : ''}
      </div>`;
    }).join('') || '<p class="text-muted">No categories yet.</p>';

    $$('[data-quick-cat]').forEach((b) => b.addEventListener('click', () => openQuickAddModal(b.dataset.quickCat)));
    $$('[data-view-txn]').forEach((b) => b.addEventListener('click', () => {
      historyDrillCategoryId = b.dataset.viewTxn;
      switchView('history');
      $$('.app-tabs .nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === 'history'));
    }));

    $$('.app-view').forEach((v) => v.classList.add('d-none'));
    $('#view-headDetail').classList.remove('d-none');
  }

  function openQuickAddModal(categoryId) {
    $('#modalAmount').value = '';
    $('#modalNote').value = '';
    $('#modalDate').value = new Date().toISOString().slice(0, 10);
    $('#modalPayCash').checked = true;
    if (categoryId) $('#modalCategory').value = categoryId;
    new bootstrap.Modal($('#quickAddModal')).show();
  }

  async function submitQuickAddModal() {
    const amount = Number($('#modalAmount').value);
    if (!amount || amount <= 0) { toast('Enter a valid amount.'); return; }
    try {
      await backend.createTransaction({
        categoryId: $('#modalCategory').value,
        amount,
        paymentMethod: $('#modalPayOnline').checked ? 'Online' : 'Cash',
        date: $('#modalDate').value,
        note: $('#modalNote').value,
      });
      bootstrap.Modal.getInstance($('#quickAddModal')).hide();
      toast('Expense logged.');
      await refreshAfterTransaction();
    } catch (err) {
      toast(err.message || 'Could not save expense.');
    }
  }

  async function submitQuickDailyLog() {
    const amount = Number($('#quickAmount').value);
    if (!amount || amount <= 0) { toast('Enter a valid amount.'); return; }
    const categoryId = $('#quickCategory').value;
    if (!categoryId) { toast('Choose a category.'); return; }
    try {
      await backend.createTransaction({
        categoryId, amount,
        paymentMethod: $('#quickPayOnline').checked ? 'Online' : 'Cash',
        date: new Date().toISOString().slice(0, 10),
      });
      $('#quickAmount').value = '';
      toast('Logged.');
      await refreshAfterTransaction();
    } catch (err) {
      toast(err.message || 'Could not log expense.');
    }
  }

  async function refreshAfterTransaction() {
    const res = await backend.getBudget(currentMonth);
    currentCategories = res.categories;
    await loadAnalysis();
    const headVisible = !$('#view-headDetail').classList.contains('d-none');
    const headTitle = headVisible ? $('#headDetailTitle').textContent : null;
    renderDashboard();
    if (headVisible) openHeadDetail(headTitle);
    if (!$('#view-analysis').classList.contains('d-none')) renderAnalysisView();
    if (!$('#view-history').classList.contains('d-none')) renderHistoryView();
  }

  async function addCustomCategory() {
    const name = $('#customCategoryName').value.trim();
    if (!name) { toast('Enter a category name.'); return; }
    const head = $('#headDetailTitle').textContent;
    try {
      await backend.createCategory({
        monthBudgetId: currentBudget.id, headType: head, name,
        plannedAmount: Number($('#customCategoryPlanned').value) || 0,
      });
      bootstrap.Modal.getInstance($('#customCategoryModal')).hide();
      $('#customCategoryName').value = ''; $('#customCategoryPlanned').value = '';
      const res = await backend.getBudget(currentMonth);
      currentCategories = res.categories;
      populateCategorySelects();
      openHeadDetail(head);
      toast('Category added.');
    } catch (err) {
      toast(err.message || 'Could not add category.');
    }
  }

  // ---------------------------------------------------------------- goals
  function renderGoalsView() {
    const totalSaved = currentGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const activeCount = currentGoals.filter((g) => g.status === 'Active').length;
    $('#goalsTotalSaved').textContent = inr(totalSaved);
    $('#goalsActiveCount').textContent = activeCount;

    $('#goalsGrid').innerHTML = currentGoals.map((g) => {
      const pct = Math.min(100, g.progress_pct || 0);
      const completed = g.status === 'Completed';
      const deadline = g.deadline ? `<div class="goal-deadline"><i class="bi bi-calendar-check me-1"></i>By ${new Date(g.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>` : '';
      return `
      <div class="col-md-6 col-lg-4">
        <div class="goal-card ${completed ? 'completed' : ''}">
          <div class="d-flex justify-content-between align-items-start">
            <div class="goal-name">${g.name}</div>
            <span class="goal-badge ${completed ? 'status-green' : 'status-yellow'}">${completed ? 'Completed' : 'Active'}</span>
          </div>
          <div class="goal-amounts">${inr(g.current_amount)} of ${inr(g.target_amount)} · ${pct}%</div>
          <div class="progress premium-progress mb-2" style="height:9px;">
            <div class="progress-bar ${completed ? 'bar-green' : 'bar-yellow'}" style="width:${pct}%"></div>
          </div>
          ${deadline}
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-sm btn-primary-brand flex-grow-1" data-add-money="${g.id}" data-name="${g.name}" ${completed ? 'disabled' : ''}><i class="bi bi-plus-lg me-1"></i>Add money</button>
            <button class="btn btn-sm btn-outline-secondary" data-delete-goal="${g.id}"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`;
    }).join('') || '<p class="text-muted">No goals yet — create one to start saving.</p>';

    $$('[data-add-money]').forEach((b) => b.addEventListener('click', () => {
      $('#addMoneyModal').dataset.goalId = b.dataset.addMoney;
      $('#addMoneyGoalName').textContent = b.dataset.name;
      $('#addMoneyAmount').value = '';
      new bootstrap.Modal($('#addMoneyModal')).show();
    }));
    $$('[data-delete-goal]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this goal?')) return;
      await backend.deleteGoal(b.dataset.deleteGoal);
      await loadGoals();
      renderGoalsView();
      toast('Goal deleted.');
    }));
  }

  async function submitNewGoal() {
    const name = $('#goalName').value.trim();
    const target = Number($('#goalTarget').value);
    if (!name || !target || target <= 0) { toast('Enter a goal name and target amount.'); return; }
    try {
      await backend.createGoal({ name, targetAmount: target, deadline: $('#goalDeadline').value || undefined });
      bootstrap.Modal.getInstance($('#goalModal')).hide();
      $('#goalName').value = ''; $('#goalTarget').value = ''; $('#goalDeadline').value = '';
      await loadGoals();
      renderGoalsView();
      toast('Goal created.');
    } catch (err) {
      toast(err.message || 'Could not create goal.');
    }
  }

  async function submitAddMoney() {
    const goalId = $('#addMoneyModal').dataset.goalId;
    const amount = Number($('#addMoneyAmount').value);
    if (!amount || amount <= 0) { toast('Enter a valid amount.'); return; }
    try {
      await backend.addMoneyToGoal(goalId, { amount, paymentMethod: $('#addMoneyPayOnline').checked ? 'Online' : 'Cash' });
      bootstrap.Modal.getInstance($('#addMoneyModal')).hide();
      await loadGoals();
      renderGoalsView();
      toast('Money added to goal.');
    } catch (err) {
      toast(err.message || 'Could not add money.');
    }
  }

  // ---------------------------------------------------------------- analysis
  function renderAnalysisView() {
    if (!currentAnalysis) return;
    const a = currentAnalysis;
    const plannedTotal = a.heads.reduce((s, h) => s + h.planned, 0);
    const actualTotal = a.heads.reduce((s, h) => s + h.actual, 0);
    const savedTotal = a.heads.find((h) => h.head === 'Investments') || { planned: 0, actual: 0 };

    $('#summaryCardsRow').innerHTML = `
      <div class="col-6 col-lg-3"><div class="summary-card"><span>Planned vs Actual spending</span><strong>${inr(actualTotal)} / ${inr(plannedTotal)}</strong></div></div>
      <div class="col-6 col-lg-3"><div class="summary-card"><span>Investing progress</span><strong>${inr(savedTotal.actual)} / ${inr(savedTotal.planned)}</strong></div></div>
      <div class="col-6 col-lg-3"><div class="summary-card"><span>Left to spend/invest</span><strong>${inr(plannedTotal - actualTotal)}</strong></div></div>
      <div class="col-6 col-lg-3"><div class="summary-card"><span>Categories overshooting</span><strong>${a.overshootingCount}</strong></div></div>
    `;

    ChartsModule.renderAllocation('allocationChart', a.heads);
    ChartsModule.renderCashOnline('cashOnlineChart', a.cashOnline);
    ChartsModule.renderPlannedActual('plannedActualChart', a.heads);
    const billCats = a.categories.filter((c) => c.head_type === 'Bills');
    ChartsModule.renderBills('billsChart', billCats);

    $('#insightList').innerHTML = a.messages.map((m) => `<li>${m}</li>`).join('') || '<li>No insights yet — log a few transactions first.</li>';
  }

  // ---------------------------------------------------------------- history
  async function renderHistoryView() {
    const { from, to } = monthBounds(currentMonth);
    const filters = {
      from: $('#filterFrom').value || from,
      to: $('#filterTo').value || to,
      headType: $('#filterHead').value || undefined,
      paymentMethod: $('#filterPayment').value || undefined,
      categoryId: historyDrillCategoryId || undefined,
    };
    if (!$('#filterFrom').value) $('#filterFrom').value = from;
    if (!$('#filterTo').value) $('#filterTo').value = to;

    const res = await backend.listTransactions(filters);
    $('#historyTableBody').innerHTML = res.transactions.map((t) => `
      <tr>
        <td>${new Date(t.txn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
        <td>${t.category_name}</td>
        <td>${t.head_type}</td>
        <td><span class="pay-badge ${t.payment_method === 'Cash' ? 'pay-cash' : 'pay-online'}">${t.payment_method}</span></td>
        <td class="text-muted">${t.note || '—'}</td>
        <td class="text-end">${inr(t.amount)}</td>
        <td><button class="btn btn-sm btn-outline-secondary" data-delete-txn="${t.id}"><i class="bi bi-trash"></i></button></td>
      </tr>`).join('') || `<tr><td colspan="7" class="text-center text-muted py-4">No transactions in this range.</td></tr>`;

    $$('[data-delete-txn]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this transaction?')) return;
      await backend.deleteTransaction(b.dataset.deleteTxn);
      toast('Transaction deleted.');
      await refreshAfterTransaction();
    }));
  }

  function exportCsv() {
    backend.listTransactions({}).then((res) => {
      const rows = [['Date', 'Category', 'Head', 'Payment Method', 'Funding Source', 'Amount', 'Note']];
      res.transactions.forEach((t) => rows.push([t.txn_date, t.category_name, t.head_type, t.payment_method, t.funding_source || '', t.amount, (t.note || '').replace(/,/g, ';')]));
      const csv = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `paisa-plan-transactions-${currentMonth}.csv`;
      a.click();
      toast('CSV exported.');
    });
  }

  // ---------------------------------------------------------------- wire up
  function bindEvents() {
    $('#themeToggleBtn').addEventListener('click', toggleTheme);
    $('#authForm').addEventListener('submit', handleAuthSubmit);
    $('#demoModeBtn').addEventListener('click', startDemoMode);
    $$('#authPills .nav-link').forEach((b) => b.addEventListener('click', () => {
      $$('#authPills .nav-link').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const isRegister = b.dataset.auth === 'register';
      $('#displayNameField').classList.toggle('d-none', !isRegister);
      $('#authSubmitBtn').textContent = isRegister ? 'Create account' : 'Log in';
      hideError('#authError');
    }));
    $('#logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
    $('#exportCsvBtn').addEventListener('click', (e) => { e.preventDefault(); exportCsv(); });

    ['#inSalary', '#inTravel', '#inBillAllowance', '#inOther'].forEach((id) => $(id).addEventListener('input', updateIncomePreview));
    $('#toStep2Btn').addEventListener('click', () => {
      if (updateIncomePreview() <= 0) { showError('#step1Error', 'Enter at least one amount greater than ₹0.'); return; }
      hideError('#step1Error');
      $('#onboardStep1').classList.add('d-none');
      $('#onboardStep2').classList.remove('d-none');
    });
    $('#backToStep1Btn').addEventListener('click', () => {
      $('#onboardStep2').classList.add('d-none');
      $('#onboardStep1').classList.remove('d-none');
    });
    $$('.custom-pct').forEach((i) => i.addEventListener('input', updateCustomPctTotal));
    $('#finishOnboardingBtn').addEventListener('click', finishOnboarding);

    $$('#mainTabs .nav-link').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('#prevMonthBtn').addEventListener('click', () => goToMonth(-1));
    $('#nextMonthBtn').addEventListener('click', () => goToMonth(1));
    $('#backToDashboardBtn').addEventListener('click', () => switchView('dashboard'));

    $('#fabAddBtn').addEventListener('click', () => openQuickAddModal());
    $('#modalSubmitBtn').addEventListener('click', submitQuickAddModal);
    $('#quickAddSubmitBtn').addEventListener('click', submitQuickDailyLog);
    $('#addCustomCategoryBtn').addEventListener('click', () => new bootstrap.Modal($('#customCategoryModal')).show());
    $('#customCategorySubmitBtn').addEventListener('click', addCustomCategory);

    $('#newGoalBtn').addEventListener('click', () => new bootstrap.Modal($('#goalModal')).show());
    $('#goalSubmitBtn').addEventListener('click', submitNewGoal);
    $('#addMoneySubmitBtn').addEventListener('click', submitAddMoney);

    ['#filterFrom', '#filterTo', '#filterHead', '#filterPayment'].forEach((id) => $(id).addEventListener('change', () => { historyDrillCategoryId = ''; renderHistoryView(); }));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    bindEvents();
    showAuthScreen();

    // Silent session check — if a valid auth cookie already exists, skip the login screen
    try {
      backend = window.Api; isDemo = false;
      const res = await backend.me();
      currentUser = res.user;
      $('#userEmailLabel').textContent = currentUser.email;
      await afterAuth();
    } catch (_) {
      // not logged in — auth screen stays visible
    }
  });
})();
