const STORAGE_KEY = 'giukakash-data-v1';

const DEFAULT_ACCOUNTS = [
  { name: 'Contanti', color: '#16a34a' },
  { name: 'Crédit Agricole', color: '#2563eb' },
  { name: 'HYPE', color: '#f59e0b' },
  { name: 'Unipol', color: '#9333ea' },
];

const DEFAULT_CATEGORIES = {
  income: ['Stipendio', 'Rimborso', 'Regalo', 'Altro'],
  expense: ['Alimentari', 'Casa', 'Trasporti', 'Ristoranti', 'Shopping', 'Bollette', 'Svago', 'Salute', 'Viaggi', 'Altro'],
};

const DEFAULT_CATEGORY_SET = {
  income: new Set(DEFAULT_CATEGORIES.income),
  expense: new Set(DEFAULT_CATEGORIES.expense),
};

const els = {
  views: document.querySelectorAll('.view'),
  navItems: document.querySelectorAll('.nav-item'),
  totalWealth: document.getElementById('totalWealth'),
  homeAccounts: document.getElementById('homeAccounts'),
  accountList: document.getElementById('accountList'),
  movementList: document.getElementById('movementList'),
  filterAccount: document.getElementById('filterAccount'),
  filterType: document.getElementById('filterType'),
  filterCategory: document.getElementById('filterCategory'),
  filterPeriod: document.getElementById('filterPeriod'),
  filterSearch: document.getElementById('filterSearch'),
  movementDialog: document.getElementById('movementDialog'),
  movementDialogTitle: document.getElementById('movementDialogTitle'),
  movementForm: document.getElementById('movementForm'),
  movementId: document.getElementById('movementId'),
  movementType: document.getElementById('movementType'),
  movementAccount: document.getElementById('movementAccount'),
  movementFromAccount: document.getElementById('movementFromAccount'),
  movementToAccount: document.getElementById('movementToAccount'),
  movementAmount: document.getElementById('movementAmount'),
  movementCategory: document.getElementById('movementCategory'),
  movementDate: document.getElementById('movementDate'),
  movementDescription: document.getElementById('movementDescription'),
  singleAccountFields: document.getElementById('singleAccountFields'),
  transferFields: document.getElementById('transferFields'),
  categoryLabel: document.getElementById('categoryLabel'),
  accountDialog: document.getElementById('accountDialog'),
  accountDialogTitle: document.getElementById('accountDialogTitle'),
  accountForm: document.getElementById('accountForm'),
  accountId: document.getElementById('accountId'),
  accountName: document.getElementById('accountName'),
  accountInitial: document.getElementById('accountInitial'),
  accountColor: document.getElementById('accountColor'),
  tabs: document.querySelectorAll('.tab'),
  chart: document.getElementById('wealthChart'),
  kpiIncome: document.getElementById('kpiIncome'),
  kpiExpense: document.getElementById('kpiExpense'),
  kpiDiff: document.getElementById('kpiDiff'),
  kpiCount: document.getElementById('kpiCount'),
  expenseByCategory: document.getElementById('expenseByCategory'),
  categoriesDialog: document.getElementById('categoriesDialog'),
  categoryTypeSelector: document.getElementById('categoryTypeSelector'),
  newCategoryName: document.getElementById('newCategoryName'),
  categoryList: document.getElementById('categoryList'),
  settingsDialog: document.getElementById('settingsDialog'),
  importInput: document.getElementById('importInput'),
  accountDetailDialog: document.getElementById('accountDetailDialog'),
  accountDetailTitle: document.getElementById('accountDetailTitle'),
  accountDetailBalance: document.getElementById('accountDetailBalance'),
  accountDetailMovements: document.getElementById('accountDetailMovements'),
};

let activeStatsRange = 'month';

let state = loadState();

init();

function init() {
  bindEvents();
  renderAll();
  registerServiceWorker();
}

function bindEvents() {
  els.navItems.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));

  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => document.getElementById(btn.dataset.closeDialog).close());
  });

  document.getElementById('addMovementBtn').addEventListener('click', () => openMovementDialog());
  document.querySelectorAll('[data-quick-type]').forEach((btn) => {
    btn.addEventListener('click', () => openMovementDialog({ type: btn.dataset.quickType }));
  });

  els.movementType.addEventListener('change', syncMovementTypeUI);
  els.movementForm.addEventListener('submit', onSaveMovement);

  ['change', 'input'].forEach((evt) => {
    els.filterAccount.addEventListener(evt, renderMovementsSection);
    els.filterType.addEventListener(evt, renderMovementsSection);
    els.filterCategory.addEventListener(evt, renderMovementsSection);
    els.filterPeriod.addEventListener(evt, renderMovementsSection);
    els.filterSearch.addEventListener(evt, renderMovementsSection);
  });

  document.getElementById('addAccountBtn').addEventListener('click', () => openAccountDialog());
  els.accountForm.addEventListener('submit', onSaveAccount);

  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeStatsRange = tab.dataset.range;
      els.tabs.forEach((t) => t.classList.toggle('active', t === tab));
      renderStatsSection();
    });
  });

  document.getElementById('settingsBtn').addEventListener('click', () => els.settingsDialog.showModal());
  document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
    els.settingsDialog.close();
    renderCategoryList();
    els.categoriesDialog.showModal();
  });
  document.getElementById('addCategoryBtn').addEventListener('click', onAddCategory);
  els.categoryTypeSelector.addEventListener('change', renderCategoryList);

  document.getElementById('exportBtn').addEventListener('click', onExportData);
  els.importInput.addEventListener('change', onImportData);
}

function setView(viewId) {
  els.views.forEach((view) => view.classList.toggle('active', view.id === viewId));
  els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === viewId));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    accounts: DEFAULT_ACCOUNTS.map((a, index) => ({
      id: generateId(),
      name: a.name,
      initialBalanceCents: 0,
      color: a.color,
      order: index,
    })),
    movements: [],
    categories: {
      income: [...DEFAULT_CATEGORIES.income],
      expense: [...DEFAULT_CATEGORIES.expense],
    },
  };
}

function normalizeState(input) {
  const base = createDefaultState();
  const accounts = Array.isArray(input?.accounts) ? input.accounts : base.accounts;
  const movements = Array.isArray(input?.movements) ? input.movements : [];
  const categories = {
    income: sanitizeStringArray(input?.categories?.income, DEFAULT_CATEGORIES.income),
    expense: sanitizeStringArray(input?.categories?.expense, DEFAULT_CATEGORIES.expense),
  };

  return {
    accounts: accounts
      .map((a, idx) => ({
        id: String(a.id || generateId()),
        name: String(a.name || 'Conto').trim().slice(0, 40),
        initialBalanceCents: Number.isInteger(a.initialBalanceCents) ? a.initialBalanceCents : eurosToCents(a.initialBalanceCents || 0),
        color: /^#[0-9a-fA-F]{6}$/.test(a.color || '') ? a.color : pickColor(idx),
        order: Number.isFinite(a.order) ? a.order : idx,
      }))
      .filter((a) => a.name),
    movements: movements
      .map((m) => ({
        id: String(m.id || generateId()),
        type: ['income', 'expense', 'transfer'].includes(m.type) ? m.type : 'expense',
        accountId: m.accountId ? String(m.accountId) : null,
        fromAccountId: m.fromAccountId ? String(m.fromAccountId) : null,
        toAccountId: m.toAccountId ? String(m.toAccountId) : null,
        amountCents: Number.isInteger(m.amountCents) ? m.amountCents : eurosToCents(m.amountCents || 0),
        date: normalizeDate(m.date),
        category: String(m.category || 'Altro').trim().slice(0, 30),
        description: String(m.description || '').trim().slice(0, 80),
        createdAt: Number.isFinite(m.createdAt) ? m.createdAt : Date.now(),
      }))
      .filter((m) => m.amountCents > 0),
    categories,
  };
}

function sanitizeStringArray(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const cleaned = [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  return cleaned.length ? cleaned : [...fallback];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  saveState();
  populateGlobalFilters();
  renderHomeSection();
  renderAccountsSection();
  renderMovementsSection();
  renderStatsSection();
}

function computeBalances() {
  const balances = new Map();
  state.accounts.forEach((acc) => balances.set(acc.id, acc.initialBalanceCents));

  state.movements.forEach((m) => {
    if (m.type === 'income' && balances.has(m.accountId)) {
      balances.set(m.accountId, balances.get(m.accountId) + m.amountCents);
    }
    if (m.type === 'expense' && balances.has(m.accountId)) {
      balances.set(m.accountId, balances.get(m.accountId) - m.amountCents);
    }
    if (m.type === 'transfer') {
      if (balances.has(m.fromAccountId)) balances.set(m.fromAccountId, balances.get(m.fromAccountId) - m.amountCents);
      if (balances.has(m.toAccountId)) balances.set(m.toAccountId, balances.get(m.toAccountId) + m.amountCents);
    }
  });

  let total = 0;
  balances.forEach((value) => {
    total += value;
  });

  return { balances, total };
}

function renderHomeSection() {
  const { balances, total } = computeBalances();
  els.totalWealth.textContent = formatCurrency(total);

  els.homeAccounts.innerHTML = '';
  state.accounts
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((acc) => {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.innerHTML = `
        <div class="row">
          <div><span class="account-dot" style="background:${acc.color}"></span>${escapeHtml(acc.name)}</div>
          <div class="balance">${formatCurrency(balances.get(acc.id) || 0)}</div>
        </div>
      `;
      els.homeAccounts.appendChild(row);
    });
}

function renderAccountsSection() {
  const { balances } = computeBalances();
  els.accountList.innerHTML = '';

  state.accounts
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((acc) => {
      const wrap = document.createElement('div');
      wrap.className = 'list-item';
      wrap.innerHTML = `
        <div class="row">
          <div>
            <div><span class="account-dot" style="background:${acc.color}"></span><strong>${escapeHtml(acc.name)}</strong></div>
            <small>Saldo iniziale: ${formatCurrency(acc.initialBalanceCents)}</small>
          </div>
          <div class="balance">${formatCurrency(balances.get(acc.id) || 0)}</div>
        </div>
        <div class="dialog-actions" style="margin-top:10px">
          <button data-account-action="detail" data-id="${acc.id}">Dettaglio</button>
          <button data-account-action="edit" data-id="${acc.id}">Modifica</button>
          <button class="danger" data-account-action="delete" data-id="${acc.id}">Rimuovi</button>
        </div>
      `;
      els.accountList.appendChild(wrap);
    });

  els.accountList.querySelectorAll('[data-account-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.accountAction;
      if (action === 'edit') openAccountDialog(state.accounts.find((a) => a.id === id));
      if (action === 'delete') onDeleteAccount(id);
      if (action === 'detail') openAccountDetail(id);
    });
  });
}

function renderMovementsSection() {
  const rows = getFilteredMovements();
  els.movementList.innerHTML = '';

  if (!rows.length) {
    els.movementList.innerHTML = '<div class="list-item"><p class="muted">Nessun movimento trovato.</p></div>';
    return;
  }

  rows.forEach((m) => {
    const account = getAccount(m.accountId);
    const from = getAccount(m.fromAccountId);
    const to = getAccount(m.toAccountId);
    const typeLabel = m.type === 'income' ? 'Entrata' : m.type === 'expense' ? 'Uscita' : 'Trasferimento';
    const sign = m.type === 'expense' ? '-' : '+';
    const amountText = m.type === 'transfer' ? formatCurrency(m.amountCents) : `${sign}${formatCurrency(m.amountCents)}`;
    const detail =
      m.type === 'transfer'
        ? `${from ? from.name : 'Conto'} → ${to ? to.name : 'Conto'}`
        : `${account ? account.name : 'Conto'} • ${m.category}`;

    const card = document.createElement('div');
    card.className = 'list-item';
    card.innerHTML = `
      <div class="row">
        <span class="badge ${m.type}">${typeLabel}</span>
        <small>${formatDate(m.date)}</small>
      </div>
      <div class="row" style="margin-top:8px">
        <div>
          <strong>${escapeHtml(detail)}</strong>
          <div><small>${escapeHtml(m.description || '')}</small></div>
        </div>
        <strong>${amountText}</strong>
      </div>
      <div class="dialog-actions" style="margin-top:10px">
        <button data-move-action="edit" data-id="${m.id}">Modifica</button>
        <button class="danger" data-move-action="delete" data-id="${m.id}">Elimina</button>
      </div>
    `;

    els.movementList.appendChild(card);
  });

  els.movementList.querySelectorAll('[data-move-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const movement = state.movements.find((m) => m.id === btn.dataset.id);
      if (!movement) return;
      if (btn.dataset.moveAction === 'edit') openMovementDialog({ movement });
      if (btn.dataset.moveAction === 'delete') onDeleteMovement(movement.id);
    });
  });
}

function populateGlobalFilters() {
  const keepValue = (select, options, fallback = 'all') => {
    const previous = select.value;
    select.innerHTML = options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    select.value = options.some((o) => o.value === previous) ? previous : fallback;
  };

  const accountOptions = [{ value: 'all', label: 'Tutti' }, ...state.accounts.map((a) => ({ value: a.id, label: a.name }))];
  keepValue(els.filterAccount, accountOptions);

  const categoryOptions = [
    { value: 'all', label: 'Tutte' },
    ...new Set([...state.categories.income, ...state.categories.expense]).values(),
  ].map((item) => (typeof item === 'string' ? { value: item, label: item } : item));

  keepValue(els.filterCategory, categoryOptions);

  const movementAccountOptions = state.accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  els.movementAccount.innerHTML = movementAccountOptions;
  els.movementFromAccount.innerHTML = movementAccountOptions;
  els.movementToAccount.innerHTML = movementAccountOptions;
}

function getFilteredMovements() {
  let rows = [...state.movements];

  const account = els.filterAccount.value || 'all';
  const type = els.filterType.value || 'all';
  const category = els.filterCategory.value || 'all';
  const period = els.filterPeriod.value || 'all';
  const search = (els.filterSearch.value || '').trim().toLowerCase();

  if (account !== 'all') {
    rows = rows.filter((m) => m.accountId === account || m.fromAccountId === account || m.toAccountId === account);
  }
  if (type !== 'all') rows = rows.filter((m) => m.type === type);
  if (category !== 'all') rows = rows.filter((m) => m.category === category);

  if (period !== 'all') {
    const days = Number(period);
    const minDate = toISODate(startOfDayDaysAgo(days - 1));
    rows = rows.filter((m) => m.date >= minDate);
  }

  if (search) {
    rows = rows.filter((m) => `${m.category} ${m.description}`.toLowerCase().includes(search));
  }

  rows.sort(sortMovementDesc);
  return rows;
}

function openMovementDialog({ type = 'expense', movement = null } = {}) {
  populateGlobalFilters();

  if (movement) {
    els.movementDialogTitle.textContent = 'Modifica movimento';
    els.movementId.value = movement.id;
    els.movementType.value = movement.type;
    els.movementAmount.value = (movement.amountCents / 100).toFixed(2);
    els.movementDate.value = movement.date;
    els.movementDescription.value = movement.description || '';

    if (movement.type === 'transfer') {
      els.movementFromAccount.value = movement.fromAccountId;
      els.movementToAccount.value = movement.toAccountId;
    } else {
      els.movementAccount.value = movement.accountId;
      populateMovementCategoryOptions(movement.type);
      els.movementCategory.value = movement.category;
    }
  } else {
    els.movementDialogTitle.textContent = 'Nuovo movimento';
    els.movementId.value = '';
    els.movementType.value = type;
    els.movementAmount.value = '';
    els.movementDate.value = toISODate(new Date());
    els.movementDescription.value = '';
    if (state.accounts[0]) {
      els.movementAccount.value = state.accounts[0].id;
      els.movementFromAccount.value = state.accounts[0].id;
      els.movementToAccount.value = state.accounts[Math.min(1, state.accounts.length - 1)]?.id || state.accounts[0].id;
    }
  }

  syncMovementTypeUI();
  if (!movement) populateMovementCategoryOptions(type);
  els.movementDialog.showModal();
}

function syncMovementTypeUI() {
  const type = els.movementType.value;
  const isTransfer = type === 'transfer';
  els.singleAccountFields.classList.toggle('hidden', isTransfer);
  els.transferFields.classList.toggle('hidden', !isTransfer);
  els.categoryLabel.classList.toggle('hidden', isTransfer);
  els.movementCategory.required = !isTransfer;

  if (!isTransfer) populateMovementCategoryOptions(type);
}

function populateMovementCategoryOptions(type) {
  const categories = type === 'income' ? state.categories.income : state.categories.expense;
  els.movementCategory.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function onSaveMovement(event) {
  event.preventDefault();
  if (!state.accounts.length) {
    alert('Aggiungi prima almeno un conto.');
    return;
  }

  const id = els.movementId.value || generateId();
  const type = els.movementType.value;
  const amountCents = eurosToCents(els.movementAmount.value);
  const date = normalizeDate(els.movementDate.value);

  if (!amountCents || amountCents <= 0) return alert('Inserisci un importo valido.');

  const base = {
    id,
    type,
    amountCents,
    date,
    description: String(els.movementDescription.value || '').trim(),
    createdAt: Date.now(),
  };

  let payload;

  if (type === 'transfer') {
    const fromAccountId = els.movementFromAccount.value;
    const toAccountId = els.movementToAccount.value;

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      return alert('Per il trasferimento seleziona due conti diversi.');
    }

    payload = {
      ...base,
      fromAccountId,
      toAccountId,
      accountId: null,
      category: 'Trasferimento',
    };
  } else {
    const accountId = els.movementAccount.value;
    const category = els.movementCategory.value;
    if (!accountId || !category) return alert('Compila i campi obbligatori.');

    payload = {
      ...base,
      accountId,
      category,
      fromAccountId: null,
      toAccountId: null,
    };
  }

  const existingIndex = state.movements.findIndex((m) => m.id === id);
  if (existingIndex >= 0) {
    payload.createdAt = state.movements[existingIndex].createdAt;
    state.movements[existingIndex] = payload;
  } else {
    state.movements.push(payload);
  }

  els.movementDialog.close();
  renderAll();
}

function onDeleteMovement(id) {
  if (!confirm('Eliminare questo movimento?')) return;
  state.movements = state.movements.filter((m) => m.id !== id);
  renderAll();
}

function openAccountDialog(account = null) {
  if (account) {
    els.accountDialogTitle.textContent = 'Modifica conto';
    els.accountId.value = account.id;
    els.accountName.value = account.name;
    els.accountInitial.value = (account.initialBalanceCents / 100).toFixed(2);
    els.accountColor.value = account.color;
  } else {
    els.accountDialogTitle.textContent = 'Nuovo conto';
    els.accountId.value = '';
    els.accountName.value = '';
    els.accountInitial.value = '0.00';
    els.accountColor.value = pickColor(state.accounts.length);
  }

  els.accountDialog.showModal();
}

function onSaveAccount(event) {
  event.preventDefault();

  const id = els.accountId.value || generateId();
  const name = String(els.accountName.value || '').trim();
  const initialBalanceCents = eurosToCents(els.accountInitial.value || 0);
  const color = els.accountColor.value;

  if (!name) return alert('Inserisci un nome conto.');

  const existingIndex = state.accounts.findIndex((a) => a.id === id);
  if (existingIndex >= 0) {
    state.accounts[existingIndex] = { ...state.accounts[existingIndex], name, initialBalanceCents, color };
  } else {
    state.accounts.push({ id, name, initialBalanceCents, color, order: state.accounts.length });
  }

  els.accountDialog.close();
  renderAll();
}

function onDeleteAccount(id) {
  const linked = state.movements.filter((m) => m.accountId === id || m.fromAccountId === id || m.toAccountId === id);

  if (linked.length) {
    const ok = confirm('Questo conto ha movimenti associati. Se lo rimuovi, verranno rimossi anche i movimenti collegati. Continuare?');
    if (!ok) return;
    state.movements = state.movements.filter((m) => !(m.accountId === id || m.fromAccountId === id || m.toAccountId === id));
  } else if (!confirm('Rimuovere questo conto?')) {
    return;
  }

  state.accounts = state.accounts.filter((a) => a.id !== id).map((a, i) => ({ ...a, order: i }));
  renderAll();
}

function openAccountDetail(accountId) {
  const account = getAccount(accountId);
  if (!account) return;

  const { balances } = computeBalances();
  const movements = state.movements
    .filter((m) => m.accountId === accountId || m.fromAccountId === accountId || m.toAccountId === accountId)
    .sort(sortMovementDesc);

  els.accountDetailTitle.textContent = account.name;
  els.accountDetailBalance.textContent = `Saldo attuale: ${formatCurrency(balances.get(accountId) || 0)} • Saldo iniziale: ${formatCurrency(account.initialBalanceCents)}`;

  els.accountDetailMovements.innerHTML = movements.length
    ? movements
        .map((m) => {
          const dir =
            m.type === 'income'
              ? '+'
              : m.type === 'expense'
              ? '-'
              : m.toAccountId === accountId
              ? '←'
              : '→';
          return `<div class="row"><small>${formatDate(m.date)} • ${escapeHtml(m.category)}</small><strong>${dir} ${formatCurrency(m.amountCents)}</strong></div>`;
        })
        .join('')
    : '<p class="muted">Nessun movimento.</p>';

  els.accountDetailDialog.showModal();
}

function renderStatsSection() {
  const days = activeStatsRange === 'week' ? 7 : activeStatsRange === 'year' ? 365 : 30;
  const start = startOfDayDaysAgo(days - 1);
  const startISO = toISODate(start);

  const scoped = state.movements.filter((m) => m.date >= startISO);
  const incomes = scoped.filter((m) => m.type === 'income').reduce((s, m) => s + m.amountCents, 0);
  const expenses = scoped.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amountCents, 0);

  els.kpiIncome.textContent = formatCurrency(incomes);
  els.kpiExpense.textContent = formatCurrency(expenses);
  els.kpiDiff.textContent = formatCurrency(incomes - expenses);
  els.kpiCount.textContent = String(scoped.length);

  renderExpenseByCategory(scoped);
  renderWealthChart(start, days);
}

function renderExpenseByCategory(movements) {
  const map = new Map();
  movements
    .filter((m) => m.type === 'expense')
    .forEach((m) => map.set(m.category, (map.get(m.category) || 0) + m.amountCents));

  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  if (!entries.length) {
    els.expenseByCategory.innerHTML = '<p class="muted">Nessuna uscita nel periodo selezionato.</p>';
    return;
  }

  els.expenseByCategory.innerHTML = entries
    .map(
      ([cat, value]) => `
      <div class="category-bar">
        <small>${escapeHtml(cat)}</small>
        <div class="category-bar-track"><div class="category-bar-fill" style="width:${(value / max) * 100}%"></div></div>
        <small>${formatCurrency(value)}</small>
      </div>
    `,
    )
    .join('');
}

function renderWealthChart(startDate, days) {
  const canvas = els.chart;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.height;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const points = buildBalanceTimeline(startDate, days);
  const totalSeries = points.map((p) => p.total);

  const accountSeries = state.accounts.map((acc) => ({
    id: acc.id,
    color: acc.color,
    values: points.map((p) => p.accounts[acc.id] || 0),
  }));

  const allValues = [...totalSeries, ...accountSeries.flatMap((s) => s.values)];
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 1);
  const padTop = 20;
  const padBottom = 28;
  const padX = 8;

  const toY = (v) => {
    if (max === min) return (height - padBottom + padTop) / 2;
    return padTop + ((max - v) / (max - min)) * (height - padTop - padBottom);
  };

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  const zeroY = toY(0);
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(width, zeroY);
  ctx.stroke();

  accountSeries.forEach((s) => {
    drawSeries(ctx, s.values, s.color, width, toY, 1.2, [4, 3], padX);
  });

  drawSeries(ctx, totalSeries, '#0f172a', width, toY, 2.5, [], padX);

  let legendX = 8;
  const legendY = height - 10;

  const drawLegend = (label, color) => {
    const labelWidth = ctx.measureText(label).width + 22;
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - 8, 12, 3);
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, legendX + 16, legendY - 4);
    legendX += labelWidth;
  };

  drawLegend('Totale', '#0f172a');
  state.accounts.forEach((acc) => drawLegend(acc.name.slice(0, 9), acc.color));
}

function drawSeries(ctx, series, color, width, toY, lineWidth, dash, padX = 0) {
  if (!series.length) return;
  const step = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0;

  ctx.beginPath();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  series.forEach((v, i) => {
    const x = padX + i * step;
    const y = toY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
  ctx.setLineDash([]);
}

function buildBalanceTimeline(startDate, days) {
  const start = startOfDay(startDate);
  const preStartDate = toISODate(start);

  const balances = {};
  state.accounts.forEach((acc) => {
    balances[acc.id] = acc.initialBalanceCents;
  });

  state.movements
    .filter((m) => m.date < preStartDate)
    .sort(sortMovementAsc)
    .forEach((m) => applyMovementToObjectBalances(balances, m));

  const scoped = state.movements.filter((m) => m.date >= preStartDate).sort(sortMovementAsc);
  const grouped = new Map();
  scoped.forEach((m) => {
    if (!grouped.has(m.date)) grouped.set(m.date, []);
    grouped.get(m.date).push(m);
  });

  const points = [];

  for (let i = 0; i < days; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const iso = toISODate(current);
    const dayMoves = grouped.get(iso) || [];
    dayMoves.forEach((m) => applyMovementToObjectBalances(balances, m));

    const snapshot = { ...balances };
    const total = Object.values(snapshot).reduce((sum, v) => sum + v, 0);
    points.push({ date: iso, accounts: snapshot, total });
  }

  return points;
}

function applyMovementToObjectBalances(balances, movement) {
  if (movement.type === 'income' && movement.accountId in balances) balances[movement.accountId] += movement.amountCents;
  if (movement.type === 'expense' && movement.accountId in balances) balances[movement.accountId] -= movement.amountCents;
  if (movement.type === 'transfer') {
    if (movement.fromAccountId in balances) balances[movement.fromAccountId] -= movement.amountCents;
    if (movement.toAccountId in balances) balances[movement.toAccountId] += movement.amountCents;
  }
}

function onAddCategory() {
  const type = els.categoryTypeSelector.value;
  const name = String(els.newCategoryName.value || '').trim();
  if (!name) return;

  if (state.categories[type].some((c) => c.toLowerCase() === name.toLowerCase())) {
    return alert('Categoria già presente.');
  }

  state.categories[type].push(name);
  els.newCategoryName.value = '';
  renderCategoryList();
  renderAll();
}

function renderCategoryList() {
  const type = els.categoryTypeSelector.value;
  const list = state.categories[type];

  els.categoryList.innerHTML = list
    .map((category) => {
      const locked = DEFAULT_CATEGORY_SET[type].has(category);
      return `<div class="row"><span>${escapeHtml(category)}</span>${
        locked ? '<small>base</small>' : `<button data-del-category="${escapeHtml(category)}" type="button" class="danger">Rimuovi</button>`
      }</div>`;
    })
    .join('');

  els.categoryList.querySelectorAll('[data-del-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.delCategory;
      const used = state.movements.some((m) => m.category === name);
      if (used) return alert('Categoria in uso in uno o più movimenti.');
      state.categories[type] = state.categories[type].filter((c) => c !== name);
      renderCategoryList();
      renderAll();
    });
  });
}

function onExportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'giukakash',
    version: 1,
    data: state,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `giukakash-backup-${toISODate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function onImportData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = parsed?.data || parsed;

    if (!incoming?.accounts || !incoming?.movements || !incoming?.categories) {
      throw new Error('Formato backup non valido.');
    }

    if (!confirm('Importando il backup i dati correnti verranno sovrascritti. Continuare?')) {
      event.target.value = '';
      return;
    }

    state = normalizeState(incoming);
    renderAll();
    alert('Backup importato correttamente.');
  } catch (error) {
    alert(error.message || 'Errore durante importazione.');
  } finally {
    event.target.value = '';
  }
}

function getAccount(id) {
  return state.accounts.find((a) => a.id === id) || null;
}

function sortMovementDesc(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function sortMovementAsc(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.createdAt || 0) - (b.createdAt || 0);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDayDaysAgo(days) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - days);
  return d;
}

function normalizeDate(dateLike) {
  if (!dateLike) return toISODate(new Date());
  const d = new Date(dateLike);
  if (Number.isNaN(d.valueOf())) return toISODate(new Date());
  return toISODate(d);
}

function toISODate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateLike) {
  const d = new Date(dateLike);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

function eurosToCents(amount) {
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function generateId() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pickColor(index) {
  const palette = ['#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#06b6d4', '#ef4444', '#14b8a6', '#8b5cf6'];
  return palette[index % palette.length];
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}
