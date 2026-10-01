/* ============================================================
   db.js — storage, data model, financial calculations
   Tutti gli importi sono gestiti in centesimi (interi) per
   evitare problemi di arrotondamento.
   ============================================================ */

const DB = (() => {
  const STORAGE_KEY = 'moneyapp:data:v1';

  const ACCOUNT_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

  const ACCOUNT_ICONS = ['◈', '◆', '●', '▲', '■', '★', '◉', '◐'];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function defaultData() {
    const accounts = [
      { id: uid(), name: 'Contanti', color: ACCOUNT_COLORS[0], icon: ACCOUNT_ICONS[0], initialBalance: 0, archived: false },
      { id: uid(), name: 'Crédit Agricole', color: ACCOUNT_COLORS[1], icon: ACCOUNT_ICONS[1], initialBalance: 0, archived: false },
      { id: uid(), name: 'HYPE', color: ACCOUNT_COLORS[2], icon: ACCOUNT_ICONS[2], initialBalance: 0, archived: false },
      { id: uid(), name: 'Unipol', color: ACCOUNT_COLORS[3], icon: ACCOUNT_ICONS[3], initialBalance: 0, archived: false }
    ];
    return {
      version: 1,
      accounts,
      transactions: [],
      categories: {
        income: ['Stipendio', 'Rimborso', 'Regalo', 'Altro'],
        expense: ['Alimentari', 'Casa', 'Trasporti', 'Ristoranti', 'Shopping', 'Bollette', 'Svago', 'Salute', 'Viaggi', 'Altro']
      }
    };
  }

  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        cache = JSON.parse(raw);
        // migrazioni difensive
        if (!cache.categories) cache.categories = defaultData().categories;
        if (!cache.accounts) cache.accounts = [];
        if (!cache.transactions) cache.transactions = [];
      } else {
        cache = defaultData();
        persist();
      }
    } catch (e) {
      console.error('Errore caricamento dati, reinizializzo', e);
      cache = defaultData();
      persist();
    }
    return cache;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }

  function data() {
    return load();
  }

  function save() {
    persist();
  }

  function replaceAll(newData) {
    cache = newData;
    persist();
  }

  function reset() {
    cache = defaultData();
    persist();
  }

  // ---------- Formattazione ----------
  function formatMoney(cents, opts = {}) {
    const value = cents / 100;
    const sign = opts.forceSign && value > 0 ? '+ ' : '';
    return sign + value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseAmountToCents(str) {
    if (typeof str === 'number') return Math.round(str * 100);
    if (!str) return 0;
    const normalized = String(str).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const val = parseFloat(normalized);
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  // ---------- Accounts ----------
  function getAccounts(includeArchived = false) {
    const d = data();
    return d.accounts.filter(a => includeArchived || !a.archived);
  }

  function getAccount(id) {
    return data().accounts.find(a => a.id === id);
  }

  function nextAccountColor() {
    const d = data();
    const used = d.accounts.map(a => a.color);
    const free = ACCOUNT_COLORS.find(c => !used.includes(c));
    return free || ACCOUNT_COLORS[d.accounts.length % ACCOUNT_COLORS.length];
  }

  function addAccount({ name, color, initialBalance }) {
    const d = data();
    const acc = {
      id: uid(),
      name: name.trim(),
      color: color || nextAccountColor(),
      icon: ACCOUNT_ICONS[d.accounts.length % ACCOUNT_ICONS.length],
      initialBalance: initialBalance || 0,
      archived: false
    };
    d.accounts.push(acc);
    save();
    return acc;
  }

  function updateAccount(id, patch) {
    const acc = getAccount(id);
    if (!acc) return;
    Object.assign(acc, patch);
    save();
  }

  function deleteAccount(id) {
    const d = data();
    d.accounts = d.accounts.filter(a => a.id !== id);
    d.transactions = d.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
    save();
  }

  function accountHasTransactions(id) {
    return data().transactions.some(t => t.accountId === id || t.toAccountId === id);
  }

  // ---------- Categories ----------
  function getCategories(type) {
    return data().categories[type] || [];
  }

  function addCategory(type, name) {
    const d = data();
    name = name.trim();
    if (!name) return;
    if (!d.categories[type].includes(name)) {
      d.categories[type].push(name);
      save();
    }
  }

  function deleteCategory(type, name) {
    const d = data();
    d.categories[type] = d.categories[type].filter(c => c !== name);
    save();
  }

  // ---------- Transactions ----------
  function getTransactions() {
    return data().transactions.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  }

  function addTransaction(tx) {
    const d = data();
    const record = {
      id: uid(),
      type: tx.type,
      amount: Math.abs(tx.amount),
      date: tx.date,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId || null,
      category: tx.type === 'transfer' ? null : (tx.category || 'Altro'),
      description: tx.description || '',
      note: tx.note || '',
      createdAt: Date.now()
    };
    d.transactions.push(record);
    save();
    return record;
  }

  function updateTransaction(id, patch) {
    const d = data();
    const tx = d.transactions.find(t => t.id === id);
    if (!tx) return;
    Object.assign(tx, patch, { amount: Math.abs(patch.amount != null ? patch.amount : tx.amount) });
    save();
  }

  function deleteTransaction(id) {
    const d = data();
    d.transactions = d.transactions.filter(t => t.id !== id);
    save();
  }

  function getTransaction(id) {
    return data().transactions.find(t => t.id === id);
  }

  // ---------- Calcoli saldi ----------
  // Effetto (in centesimi, con segno) che una transazione ha su un dato conto.
  function effectOnAccount(tx, accountId) {
    if (tx.type === 'income' && tx.accountId === accountId) return tx.amount;
    if (tx.type === 'expense' && tx.accountId === accountId) return -tx.amount;
    if (tx.type === 'transfer') {
      let e = 0;
      if (tx.accountId === accountId) e -= tx.amount;
      if (tx.toAccountId === accountId) e += tx.amount;
      return e;
    }
    return 0;
  }

  // Saldo di un conto, opzionalmente calcolato "fino a" una data inclusa (YYYY-MM-DD)
  function getAccountBalance(accountId, upToDate = null) {
    const acc = getAccount(accountId);
    if (!acc) return 0;
    let balance = acc.initialBalance;
    for (const tx of data().transactions) {
      if (upToDate && tx.date > upToDate) continue;
      balance += effectOnAccount(tx, accountId);
    }
    return balance;
  }

  function getTotalWealth(upToDate = null) {
    return getAccounts().reduce((sum, a) => sum + getAccountBalance(a.id, upToDate), 0);
  }

  function getTransactionsForAccount(accountId) {
    return getTransactions().filter(t => t.accountId === accountId || t.toAccountId === accountId);
  }

  // ---------- Statistiche periodo ----------
  // Ritorna { income, expense, byCategory: {cat: cents}, transactions: [...] }
  // I trasferimenti sono esclusi da entrate/uscite.
  function getPeriodStats(startDate, endDate) {
    const txs = data().transactions.filter(t => t.date >= startDate && t.date <= endDate);
    let income = 0, expense = 0;
    const byCategory = {};
    for (const t of txs) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') {
        expense += t.amount;
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      }
    }
    return { income, expense, diff: income - expense, byCategory, transactions: txs };
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // lun=0
    d.setDate(d.getDate() - day);
    return d;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  return {
    STORAGE_KEY,
    ACCOUNT_COLORS,
    uid, todayISO,
    data, save, replaceAll, reset,
    formatMoney, parseAmountToCents,
    getAccounts, getAccount, addAccount, updateAccount, deleteAccount, accountHasTransactions, nextAccountColor,
    getCategories, addCategory, deleteCategory,
    getTransactions, addTransaction, updateTransaction, deleteTransaction, getTransaction,
    getAccountBalance, getTotalWealth, getTransactionsForAccount,
    getPeriodStats,
    isoDate, addDays, startOfWeek, startOfMonth, endOfMonth
  };
})();
