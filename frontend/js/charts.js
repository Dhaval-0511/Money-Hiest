/* ==========================================================================
   charts.js — Chart.js instances for the Monthly Analysis view.
   Colors are read from CSS variables so charts stay in sync with light/dark
   theme without any extra logic.
   ========================================================================== */

const ChartsModule = (() => {
  let allocationChart, cashOnlineChart, plannedActualChart, billsChart;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return {
      indigo: cssVar('--indigo'),
      teal: cssVar('--teal'),
      amber: cssVar('--amber'),
      coral: cssVar('--coral'),
      muted: cssVar('--muted'),
      ink: cssVar('--ink'),
      border: cssVar('--border'),
    };
  }

  const HEAD_COLORS = () => {
    const p = palette();
    return {
      Expenses: p.indigo,
      Bills: p.amber,
      Shopping: '#C084FC',
      Investments: p.teal,
      Upskilling: '#4FA8E8',
      Lifestyle: p.coral,
    };
  };

  function baseOptions(extra = {}) {
    const p = palette();
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: p.ink, font: { family: "'Plus Jakarta Sans'" } } },
          tooltip: { titleFont: { family: "'Plus Jakarta Sans'" }, bodyFont: { family: "'Plus Jakarta Sans'" } },
        },
      },
      extra
    );
  }

  function renderAllocation(canvasId, heads) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const colors = HEAD_COLORS();
    const labels = heads.map((h) => h.head);
    const data = heads.map((h) => h.planned);

    if (allocationChart) allocationChart.destroy();
    allocationChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: labels.map((l) => colors[l] || '#999'), borderWidth: 0 }],
      },
      options: baseOptions({
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: palette().ink, boxWidth: 10, padding: 14 } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.label}: ₹${Number(c.raw).toLocaleString('en-IN')}`,
            },
          },
        },
      }),
    });
  }

  function renderCashOnline(canvasId, cashOnline) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const p = palette();
    if (cashOnlineChart) cashOnlineChart.destroy();
    cashOnlineChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Cash', 'Online'],
        datasets: [{ data: [cashOnline.Cash || 0, cashOnline.Online || 0], backgroundColor: [p.amber, p.teal], borderWidth: 0 }],
      },
      options: baseOptions({
        plugins: {
          legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 10, padding: 14 } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ₹${Number(c.raw).toLocaleString('en-IN')}` } },
        },
      }),
    });
  }

  function renderPlannedActual(canvasId, heads) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const p = palette();
    if (plannedActualChart) plannedActualChart.destroy();
    plannedActualChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: heads.map((h) => h.head),
        datasets: [
          { label: 'Planned', data: heads.map((h) => h.planned), backgroundColor: 'rgba(91,79,233,0.35)', borderRadius: 6 },
          { label: 'Actual', data: heads.map((h) => h.actual), backgroundColor: p.indigo, borderRadius: 6 },
        ],
      },
      options: baseOptions({
        scales: {
          x: { ticks: { color: p.muted }, grid: { display: false } },
          y: { ticks: { color: p.muted }, grid: { color: p.border } },
        },
        plugins: { legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 10, padding: 14 } } },
      }),
    });
  }

  function renderBills(canvasId, billCategories) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const p = palette();
    if (billsChart) billsChart.destroy();
    billsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: billCategories.map((c) => c.name),
        datasets: [
          { label: 'Planned', data: billCategories.map((c) => c.planned), backgroundColor: 'rgba(242,169,59,0.35)', borderRadius: 6 },
          { label: 'Actual', data: billCategories.map((c) => c.actual), backgroundColor: p.amber, borderRadius: 6 },
        ],
      },
      options: baseOptions({
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: p.muted }, grid: { color: p.border } },
          y: { ticks: { color: p.muted }, grid: { display: false } },
        },
        plugins: { legend: { position: 'bottom', labels: { color: p.ink, boxWidth: 10, padding: 14 } } },
      }),
    });
  }

  function destroyAll() {
    [allocationChart, cashOnlineChart, plannedActualChart, billsChart].forEach((c) => c && c.destroy());
  }

  return { renderAllocation, renderCashOnline, renderPlannedActual, renderBills, destroyAll, HEAD_COLORS };
})();

window.ChartsModule = ChartsModule;
