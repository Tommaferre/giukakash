/* ============================================================
   render.js — generazione HTML delle schermate
   ============================================================ */

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const DAYS_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const CATEGORY_ICONS = {
  'Stipendio': '💰', 'Rimborso': '💵', 'Regalo': '🎁', 'Altro': '📦',
  'Alimentari': '🛒', 'Casa': '🏠', 'Trasporti': '🚗', 'Ristoranti': '🍽️',
  'Shopping': '🛍️', 'Bollette': '💡', 'Svago': '🎉', 'Salute': '⚕️', 'Viaggi': '✈️'
};
function catIcon(name) { return CATEGORY_ICONS[name] || '•'; }

const BRAND_LOGO = '<img src="icons/icon-192.png" width="30" height="30" class="brand-logo" alt="">';

const THEME_LABELS = { light: 'Chiaro', dark: 'Scuro', system: 'Automatico (sistema)' };

function fmtDateHuman(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1].toLowerCase()} ${y}`;
}
function fmtDateInput(iso) { return iso; } // input[type=date] usa già YYYY-MM-DD

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const Render = (() => {

  // ============================================================
  // HOME
  // ============================================================
  function home() {
    const accounts = DB.getAccounts();
    const total = DB.getTotalWealth();
    const now = new Date();
    const monthAgo = DB.isoDate(DB.addDays(now, -30));
    const totalMonthAgo = DB.getTotalWealth(monthAgo);
    const diff = total - totalMonthAgo;
    const diffPct = totalMonthAgo !== 0 ? (diff / Math.abs(totalMonthAgo)) * 100 : 0;

    return `
    <div class="screen">
      <div class="topbar brand-topbar">
        <span class="brand-lockup">${BRAND_LOGO}<span class="brand-name">GiukaKash</span></span>
        <button class="icon-btn" data-nav="settings" aria-label="Impostazioni">${ICON.gear}</button>
      </div>
      <div class="wealth-card">
        <span class="wealth-label">Patrimonio totale</span>
        <div class="wealth-amount">${DB.formatMoney(total)}</div>
        <div class="wealth-delta ${diff >= 0 ? 'positive' : 'negative'}">
          ${diff >= 0 ? ICON.arrowUp : ICON.arrowDown}
          <span>${diff >= 0 ? '+' : ''}${diffPct.toFixed(1)}% rispetto a 30 giorni fa</span>
        </div>
      </div>

      <div class="section-header">
        <h2>I miei conti</h2>
      </div>
      <div class="account-list">
        ${accounts.map(a => accountRow(a)).join('') || emptyState('Nessun conto', 'Aggiungi il tuo primo conto dalla sezione Conti.')}
      </div>

      <div class="section-header"><h2>Azioni rapide</h2></div>
      <div class="quick-actions">
        <button class="qa-btn qa-income" data-open-movement="income">${ICON.plus}<span>Entrata</span></button>
        <button class="qa-btn qa-expense" data-open-movement="expense">${ICON.minus}<span>Uscita</span></button>
        <button class="qa-btn qa-transfer" data-open-movement="transfer">${ICON.transfer}<span>Trasferimento</span></button>
      </div>
    </div>`;
  }

  function accountRow(a) {
    const balance = DB.getAccountBalance(a.id);
    return `
    <button class="account-row" data-nav="account/${a.id}">
      <span class="account-dot" style="background:${a.color}">${a.icon}</span>
      <span class="account-name">${escapeHtml(a.name)}</span>
      <span class="account-balance">${DB.formatMoney(balance)}</span>
      <span class="chevron">${ICON.chevron}</span>
    </button>`;
  }

  function emptyState(title, sub) {
    return `<div class="empty-state"><p class="empty-title">${title}</p><p class="empty-sub">${sub}</p></div>`;
  }

  // ============================================================
  // MOVIMENTI (lista)
  // ============================================================
  function movementsScreen(filters) {
    const accounts = DB.getAccounts(true);
    const txs = filterTransactions(filters);
    const grouped = groupByDate(txs);

    return `
    <div class="screen">
      <div class="topbar">
        <h1>Movimenti</h1>
      </div>
      <div class="search-row">
        <input type="search" id="search-input" placeholder="Cerca movimenti..." value="${escapeHtml(filters.q || '')}">
      </div>
      <div class="filter-row">
        ${filterMenu('type', filters.type, 'Tutti i tipi', [
          ['all', 'Tutti i tipi'], ['income', 'Entrate'], ['expense', 'Uscite'], ['transfer', 'Trasferimenti']
        ])}
        ${filterMenu('account', filters.account, 'Tutti i conti', [
          ['all', 'Tutti i conti'], ...accounts.map(a => [a.id, a.name])
        ])}
        ${filterMenu('category', filters.category, 'Tutte le categorie', [
          ['all', 'Tutte le categorie'], ...[...DB.getCategories('income'), ...DB.getCategories('expense')]
            .filter((v,i,arr)=>arr.indexOf(v)===i).map(c => [c, c])
        ])}
      </div>
      <div class="movements-list">
        ${Object.keys(grouped).length ? Object.entries(grouped).map(([date, list]) => `
          <div class="mv-date-group">
            <div class="mv-date-label">${fmtDateHuman(date)}</div>
            ${list.map(t => movementRow(t)).join('')}
          </div>`).join('') : emptyState('Nessun movimento', 'Prova a modificare i filtri o aggiungi un nuovo movimento.')}
      </div>
    </div>`;
  }

  function filterMenu(name, selected, fallbackLabel, options) {
    const selectedOption = options.find(([value]) => value === selected) || options[0];
    return `<details class="filter-menu">
      <summary title="${escapeHtml(selectedOption[1])}">${escapeHtml(selectedOption[1])}</summary>
      <div class="filter-options">
        ${options.map(([value, label]) => `<button type="button" data-filter-name="${name}" data-filter-value="${escapeHtml(value)}" ${value === selected ? 'class="selected"' : ''}>${escapeHtml(label)}</button>`).join('')}
      </div>
    </details>`;
  }

  function filterTransactions(filters) {
    let txs = DB.getTransactions();
    if (filters.type && filters.type !== 'all') txs = txs.filter(t => t.type === filters.type);
    if (filters.account && filters.account !== 'all') txs = txs.filter(t => t.accountId === filters.account || t.toAccountId === filters.account);
    if (filters.category && filters.category !== 'all') txs = txs.filter(t => t.category === filters.category);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      txs = txs.filter(t => (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
    }
    return txs;
  }

  function groupByDate(txs) {
    const g = {};
    txs.forEach(t => { (g[t.date] = g[t.date] || []).push(t); });
    return g;
  }

  function movementRow(t) {
    const acc = DB.getAccount(t.accountId);
    const toAcc = t.toAccountId ? DB.getAccount(t.toAccountId) : null;
    let icon, label, sub, amountClass, amountText;
    if (t.type === 'income') {
      icon = catIcon(t.category); label = t.description || t.category;
      sub = `${acc ? escapeHtml(acc.name) : '—'} · ${escapeHtml(t.category)}`;
      amountClass = 'positive'; amountText = DB.formatMoney(t.amount, { forceSign: true });
    } else if (t.type === 'expense') {
      icon = catIcon(t.category); label = t.description || t.category;
      sub = `${acc ? escapeHtml(acc.name) : '—'} · ${escapeHtml(t.category)}`;
      amountClass = 'negative'; amountText = '- ' + DB.formatMoney(t.amount);
    } else {
      icon = ICON.transferSmall; label = t.description || 'Trasferimento';
      sub = `${acc ? escapeHtml(acc.name) : '—'} → ${toAcc ? escapeHtml(toAcc.name) : '—'}`;
      amountClass = 'neutral'; amountText = DB.formatMoney(t.amount);
    }
    return `
    <button class="mv-row" data-open-edit="${t.id}">
      <span class="mv-icon ${t.type}">${icon}</span>
      <span class="mv-info">
        <span class="mv-label">${escapeHtml(label)}</span>
        <span class="mv-sub">${sub}</span>
      </span>
      <span class="mv-amount ${amountClass}">${amountText}</span>
    </button>`;
  }

  // ============================================================
  // STATISTICHE
  // ============================================================
  function statsScreen(state) {
    const period = state.period; // 'month' | 'week' | 'year'
    const range = getPeriodRange(period, state.refDate);
    const stats = DB.getPeriodStats(range.start, range.end);
    const accounts = DB.getAccounts();

    return `
    <div class="screen">
      <div class="topbar"><h1>Statistiche</h1></div>
      <div class="tabs">
        <button class="tab ${period==='month'?'active':''}" data-period="month">Mensile</button>
        <button class="tab ${period==='week'?'active':''}" data-period="week">Settimanale</button>
        <button class="tab ${period==='year'?'active':''}" data-period="year">Annuale</button>
      </div>
      <div class="period-nav">
        <button class="icon-btn" data-period-step="-1">${ICON.chevronLeft}</button>
        <span class="period-label">${range.label}</span>
        <button class="icon-btn" data-period-step="1" ${range.isFuture ? 'disabled' : ''}>${ICON.chevronRight}</button>
      </div>

      <div class="stats-summary">
        <div class="stat-box">
          <span class="stat-label">Entrate</span>
          <span class="stat-value positive">${DB.formatMoney(stats.income)}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Uscite</span>
          <span class="stat-value negative">${DB.formatMoney(stats.expense)}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Differenza</span>
          <span class="stat-value ${stats.diff>=0?'positive':'negative'}">${stats.diff>=0?'+ ':''}${DB.formatMoney(stats.diff)}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <h3>Andamento patrimonio</h3>
          <span class="card-title-value">${DB.formatMoney(DB.getTotalWealth(range.end))}</span>
        </div>
        <div id="wealth-chart"></div>
        <div class="chart-legend" id="wealth-legend">
          ${legendChip('total', 'Totale', 'var(--accent)', true)}
          ${accounts.map(a => legendChip(a.id, a.name, a.color, true)).join('')}
        </div>
      </div>

      ${period === 'year' ? `
      <div class="card">
        <h3>Entrate e uscite per mese</h3>
        <div id="bar-chart"></div>
        <div class="chart-legend">
          ${legendChip('inc','Entrate','#22c55e',true,false)}
          ${legendChip('exp','Uscite','#ef4444',true,false)}
        </div>
      </div>` : ''}

      <div class="card">
        <div class="card-title-row">
          <h3>Spese per categoria</h3>
          <span class="card-title-value">${DB.formatMoney(stats.expense)}</span>
        </div>
        ${Object.keys(stats.byCategory).length ? `
        <div class="donut-row">
          <div id="cat-donut"></div>
          <div class="donut-legend">
            ${Object.entries(stats.byCategory).sort((a,b)=>b[1]-a[1]).map(([cat, val], i) => `
              <div class="donut-legend-item">
                <span class="dot" style="background:${categoryColor(cat, i)}"></span>
                <span class="cat-name">${escapeHtml(cat)}</span>
                <span class="cat-value">${DB.formatMoney(val)}</span>
              </div>`).join('')}
          </div>
        </div>` : emptyState('Nessuna spesa', 'Non ci sono uscite in questo periodo.')}
      </div>
    </div>`;
  }

  function legendChip(id, label, color, active, showDot = true) {
    return `<button class="legend-chip ${active?'active':''}" data-toggle-series="${id}">
      ${showDot ? `<span class="dot" style="background:${color}"></span>` : ''}${escapeHtml(label)}</button>`;
  }

  const CAT_PALETTE = ['#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#ef4444','#22c55e','#f97316','#6366f1'];
  function categoryColor(cat, idx) {
    // colore stabile basato sul nome categoria
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
    return CAT_PALETTE[hash % CAT_PALETTE.length];
  }

  function parseDateOnly(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function getPeriodRange(period, refDate) {
    const ref = refDate ? parseDateOnly(refDate) : new Date();
    const today = DB.isoDate(new Date());
    if (period === 'week') {
      const start = DB.startOfWeek(ref);
      const end = DB.addDays(start, 6);
      const isFuture = DB.isoDate(DB.addDays(start, 7)) > today;
      return { start: DB.isoDate(start), end: DB.isoDate(end), label: `Settimana ${start.getDate()} - ${end.getDate()} ${MONTHS_SHORT[end.getMonth()].toLowerCase()} ${end.getFullYear()}`, isFuture, refCenter: ref };
    } else if (period === 'year') {
      const y = ref.getFullYear();
      const start = new Date(y, 0, 1), end = new Date(y, 11, 31);
      const isFuture = y >= new Date().getFullYear();
      return { start: DB.isoDate(start), end: DB.isoDate(end), label: `${y}`, isFuture, refCenter: ref };
    } else {
      const start = DB.startOfMonth(ref), end = DB.endOfMonth(ref);
      const now = new Date();
      const isFuture = (ref.getFullYear() > now.getFullYear()) || (ref.getFullYear() === now.getFullYear() && ref.getMonth() >= now.getMonth());
      return { start: DB.isoDate(start), end: DB.isoDate(end), label: `${MONTHS[ref.getMonth()]} ${ref.getFullYear()}`, isFuture, refCenter: ref };
    }
  }

  function stepPeriod(period, refDate, dir) {
    const ref = parseDateOnly(refDate);
    if (period === 'week') return DB.isoDate(DB.addDays(ref, dir * 7));
    if (period === 'year') return DB.isoDate(new Date(ref.getFullYear() + dir, 0, 1));
    return DB.isoDate(new Date(ref.getFullYear(), ref.getMonth() + dir, 1));
  }

  // costruisce le serie per il grafico andamento patrimonio
  function buildWealthSeries(period, range, visibleIds) {
    const accounts = DB.getAccounts();
    let dates = [];
    let labels = [];
    if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = DB.addDays(new Date(range.start), i);
        dates.push(DB.isoDate(d));
        labels.push(DAYS_SHORT[i]);
      }
    } else if (period === 'year') {
      const y = new Date(range.start).getFullYear();
      for (let m = 0; m < 12; m++) {
        dates.push(DB.isoDate(DB.endOfMonth(new Date(y, m, 1))));
        labels.push(MONTHS_SHORT[m][0]);
      }
    } else {
      const start = new Date(range.start), end = new Date(range.end);
      const days = Math.round((end - start) / 86400000) + 1;
      for (let i = 0; i < days; i++) {
        const d = DB.addDays(start, i);
        dates.push(DB.isoDate(d));
        labels.push(String(d.getDate()));
      }
    }

    const series = [];
    series.push({
      id: 'total', label: 'Totale', color: 'var(--accent-solid)',
      points: dates.map(d => DB.getTotalWealth(d) / 100),
      visible: visibleIds.has('total')
    });
    accounts.forEach(a => {
      series.push({
        id: a.id, label: a.name, color: a.color,
        points: dates.map(d => DB.getAccountBalance(a.id, d) / 100),
        visible: visibleIds.has(a.id)
      });
    });
    return { series, labels };
  }

  // ============================================================
  // CONTI
  // ============================================================
  function accountsScreen() {
    const accounts = DB.getAccounts();
    return `
    <div class="screen">
      <div class="topbar">
        <h1>Conti</h1>
        <button class="icon-btn" data-open-account="new" aria-label="Aggiungi conto">${ICON.plus}</button>
      </div>
      <div class="account-list">
        ${accounts.map(a => accountRow(a)).join('') || emptyState('Nessun conto', 'Aggiungi il tuo primo conto.')}
      </div>
    </div>`;
  }

  function accountDetailScreen(accountId) {
    const acc = DB.getAccount(accountId);
    if (!acc) return `<div class="screen"><div class="topbar"><button class="icon-btn" data-nav="accounts">${ICON.back}</button><h1>Conto non trovato</h1></div></div>`;
    const balance = DB.getAccountBalance(accountId);
    const txs = DB.getTransactionsForAccount(accountId).slice(0, 30);
    return `
    <div class="screen">
      <div class="topbar">
        <button class="icon-btn" data-nav="accounts" aria-label="Indietro">${ICON.back}</button>
        <h1>Dettaglio conto</h1>
        <button class="icon-btn" data-open-account="${acc.id}" aria-label="Modifica">${ICON.edit}</button>
      </div>
      <div class="account-hero" style="background:${acc.color}">
        <span class="account-hero-icon">${acc.icon}</span>
        <span class="account-hero-name">${escapeHtml(acc.name)}</span>
        <span class="account-hero-balance">${DB.formatMoney(balance)}</span>
      </div>
      <div class="quick-actions two">
        <button class="qa-btn qa-income" data-open-movement="income" data-preset-account="${acc.id}">${ICON.plus}<span>Entrata</span></button>
        <button class="qa-btn qa-expense" data-open-movement="expense" data-preset-account="${acc.id}">${ICON.minus}<span>Uscita</span></button>
      </div>
      <div class="section-header">
        <h2>Movimenti recenti</h2>
        <button class="link-btn" data-nav="movements" data-preset-filter-account="${acc.id}">Vedi tutti</button>
      </div>
      <div class="movements-list">
        ${txs.length ? txs.map(t => movementRow(t)).join('') : emptyState('Nessun movimento', 'I movimenti di questo conto appariranno qui.')}
      </div>
    </div>`;
  }

  function accountFormModal(accountId) {
    const isNew = accountId === 'new';
    const acc = isNew ? null : DB.getAccount(accountId);
    const color = acc ? acc.color : DB.nextAccountColor();
    return `
    <div class="modal-header">
      <button class="icon-btn" data-close-modal>${ICON.close}</button>
      <h2>${isNew ? 'Nuovo conto' : 'Modifica conto'}</h2>
      <button class="icon-btn confirm" data-save-account="${isNew ? 'new' : accountId}">${ICON.check}</button>
    </div>
    <div class="modal-body">
      <label class="field">
        <span>Nome conto</span>
        <input type="text" id="acc-name" placeholder="Es. Portafoglio" value="${acc ? escapeHtml(acc.name) : ''}">
      </label>
      <label class="field">
        <span>Colore</span>
        <div class="color-picker" id="acc-color-picker" data-selected="${color}">
          ${DB.ACCOUNT_COLORS.map(c => `<button type="button" class="color-swatch ${c===color?'selected':''}" style="background:${c}" data-color="${c}"></button>`).join('')}
        </div>
      </label>
      <label class="field">
        <span>Saldo iniziale</span>
        <div class="amount-input"><span>€</span><input type="text" inputmode="decimal" id="acc-balance" value="${acc ? (acc.initialBalance/100).toFixed(2).replace('.', ',') : '0,00'}"></div>
      </label>
      ${!isNew ? `<button class="danger-btn" data-delete-account="${accountId}">Elimina conto</button>` : ''}
    </div>`;
  }

  // ============================================================
  // MOVIMENTO (form Entrata/Uscita/Trasferimento)
  // ============================================================
  function movementFormModal({ type, editId, presetAccount }) {
    const editing = DB.getTransaction(editId);
    const t = editing ? editing.type : type;
    const accounts = DB.getAccounts();
    const amount = editing ? (editing.amount / 100).toFixed(2).replace('.', ',') : '';
    const date = editing ? editing.date : DB.todayISO();
    const description = editing ? editing.description : '';
    const note = editing ? editing.note : '';
    const accountId = editing ? editing.accountId : (presetAccount || (accounts[0] && accounts[0].id));
    const toAccountId = editing ? editing.toAccountId : (accounts.find(a => a.id !== accountId) || {}).id;
    const category = editing ? editing.category : null;

    return `
    <div class="modal-header">
      <button class="icon-btn" data-close-modal>${ICON.close}</button>
      <h2>${editing ? 'Modifica movimento' : (t === 'income' ? 'Aggiungi entrata' : t === 'expense' ? 'Aggiungi uscita' : 'Trasferimento tra conti')}</h2>
      <button class="icon-btn confirm" data-save-movement="${editing ? editId : 'new'}">${ICON.check}</button>
    </div>
    <div class="modal-body">
      <div class="type-tabs" id="mv-type-tabs">
        <button type="button" class="type-tab income ${t==='income'?'active':''}" data-mv-type="income">Entrata</button>
        <button type="button" class="type-tab expense ${t==='expense'?'active':''}" data-mv-type="expense">Uscita</button>
        <button type="button" class="type-tab transfer ${t==='transfer'?'active':''}" data-mv-type="transfer">Trasferimento</button>
      </div>

      <label class="field">
        <span>Importo</span>
        <div class="amount-input"><span>€</span><input type="text" inputmode="decimal" id="mv-amount" placeholder="0,00" value="${amount}"></div>
      </label>

      <div id="mv-account-fields">
        ${movementAccountFields(t, accountId, toAccountId, accounts)}
      </div>

      <label class="field">
        <span>Data</span>
        <input type="date" id="mv-date" value="${date}">
      </label>

      <div id="mv-category-field">
        ${t !== 'transfer' ? categoryField(t, category) : ''}
      </div>

      <label class="field">
        <span>Descrizione (opzionale)</span>
        <input type="text" id="mv-description" placeholder="Es. Spesa al supermercato" value="${escapeHtml(description)}">
      </label>
      <label class="field">
        <span>Note (opzionali)</span>
        <textarea id="mv-note" placeholder="Note aggiuntive...">${escapeHtml(note)}</textarea>
      </label>

      ${editing ? `<button class="danger-btn" data-delete-movement="${editId}">Elimina movimento</button>` : ''}
    </div>`;
  }

  function movementAccountFields(type, accountId, toAccountId, accounts) {
    if (type === 'transfer') {
      return `
      <label class="field">
        <span>Da conto</span>
        <select id="mv-account">${accounts.map(a => `<option value="${a.id}" ${a.id===accountId?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select>
      </label>
      <label class="field">
        <span>A conto</span>
        <select id="mv-to-account">${accounts.map(a => `<option value="${a.id}" ${a.id===toAccountId?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select>
      </label>`;
    }
    return `
    <label class="field">
      <span>Conto</span>
      <select id="mv-account">${accounts.map(a => `<option value="${a.id}" ${a.id===accountId?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}</select>
    </label>`;
  }

  function categoryField(type, selected) {
    const cats = DB.getCategories(type);
    const sel = selected || cats[0];
    return `
    <label class="field">
      <span>Categoria</span>
      <select id="mv-category">
        ${cats.map(c => `<option value="${escapeHtml(c)}" ${c===sel?'selected':''}>${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>`;
  }

  // ============================================================
  // IMPOSTAZIONI
  // ============================================================
  function settingsScreen() {
    return `
    <div class="screen">
      <div class="topbar">
        <button class="icon-btn" data-nav="home">${ICON.back}</button>
        <h1>Impostazioni</h1>
      </div>
      <div class="settings-list">
        <div class="settings-group">
          <button class="settings-row" data-nav="categories/expense">
            <span class="settings-row-icon">${ICON.tag}</span>
            <span class="settings-row-text"><span>Categorie</span><small>Gestisci le categorie di entrate e uscite</small></span>
            <span class="chevron">${ICON.chevron}</span>
          </button>
        </div>
        <div class="settings-group">
          <button class="settings-row" data-action="export-data">
            <span class="settings-row-icon">${ICON.download}</span>
            <span class="settings-row-text"><span>Esporta dati</span><small>Scarica un backup JSON</small></span>
            <span class="chevron">${ICON.chevron}</span>
          </button>
          <button class="settings-row" data-action="import-data">
            <span class="settings-row-icon">${ICON.upload}</span>
            <span class="settings-row-text"><span>Importa dati</span><small>Ripristina da un file di backup</small></span>
            <span class="chevron">${ICON.chevron}</span>
          </button>
          <input type="file" id="import-file-input" accept="application/json" hidden>
        </div>
        <div class="settings-group">
          <button class="settings-row" data-open-theme="1">
            <span class="settings-row-icon">${ICON.theme}</span>
            <span class="settings-row-text"><span>Aspetto</span><small>Tema: ${THEME_LABELS[Theme.get()]}</small></span>
            <span class="chevron">${ICON.chevron}</span>
          </button>
        </div>
        <div class="settings-group">
          <button class="settings-row danger" data-action="erase-data">
            <span class="settings-row-icon">${ICON.trash}</span>
            <span class="settings-row-text"><span>Elimina tutti i dati</span><small>Ripristina l'app allo stato iniziale</small></span>
          </button>
        </div>
        <div class="settings-group">
          <div class="settings-row static">
            <span class="settings-row-icon">${ICON.info}</span>
            <span class="settings-row-text"><span>Versione app</span><small>v1.1.0 · Dati salvati solo su questo dispositivo</small></span>
          </div>
        </div>
      </div>
    </div>`;
  }

  function themeModal() {
    const current = Theme.get();
    const options = [
      { value: 'light', label: 'Chiaro', desc: 'Sempre tema chiaro' },
      { value: 'dark', label: 'Scuro', desc: 'Sempre tema scuro' },
      { value: 'system', label: 'Automatico', desc: 'Segue il tema del dispositivo' }
    ];
    return `
    <div class="modal-header">
      <button class="icon-btn" data-close-modal>${ICON.close}</button>
      <h2>Aspetto</h2>
      <span class="icon-btn" style="visibility:hidden">${ICON.close}</span>
    </div>
    <div class="modal-body">
      <div class="theme-option-list">
        ${options.map(o => `
          <button class="theme-option ${o.value===current?'selected':''}" data-set-theme="${o.value}">
            <span class="theme-option-text"><span>${o.label}</span><small>${o.desc}</small></span>
            <span class="theme-check">${o.value===current?ICON.check:''}</span>
          </button>`).join('')}
      </div>
    </div>`;
  }

  function categoriesScreen(type) {
    const cats = DB.getCategories(type);
    return `
    <div class="screen">
      <div class="topbar">
        <button class="icon-btn" data-nav="settings">${ICON.back}</button>
        <h1>Categorie</h1>
      </div>
      <div class="tabs">
        <button class="tab ${type==='income'?'active':''}" data-nav="categories/income">Entrate</button>
        <button class="tab ${type==='expense'?'active':''}" data-nav="categories/expense">Uscite</button>
      </div>
      <div class="category-manage-list">
        ${cats.map(c => `
          <div class="category-manage-row">
            <span class="mv-icon ${type}">${catIcon(c)}</span>
            <span class="cat-name">${escapeHtml(c)}</span>
            <button class="icon-btn small" data-delete-category="${type}::${escapeHtml(c)}">${ICON.trash}</button>
          </div>`).join('')}
      </div>
      <form class="add-category-form" id="add-category-form">
        <input type="text" id="new-category-name" placeholder="Nuova categoria...">
        <button type="submit" class="icon-btn confirm">${ICON.plus}</button>
      </form>
    </div>`;
  }

  return {
    home, movementsScreen, statsScreen, accountsScreen, accountDetailScreen,
    accountFormModal, movementFormModal, settingsScreen, categoriesScreen, themeModal,
    getPeriodRange, stepPeriod, buildWealthSeries, categoryColor, movementAccountFields, categoryField
  };
})();

// ---------------- Icone SVG inline (nessuna dipendenza esterna) ----------------
const ICON = {
  gear: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.4 13a7.4 7.4 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.6a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.4 7.4 0 000 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 001.7 1L11 21h4l.3-2.6a7.6 7.6 0 001.7-1l2.4 1 2-3.4-2-1.6zM13 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  minus: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>',
  transfer: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 7h11l-2.5-2.5L17 3l5 5-5 5-1.5-1.5L18 9H7zm10 10H6l2.5 2.5L7 21l-5-5 5-5 1.5 1.5L6 15h11z"/></svg>',
  transferSmall: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 7h11l-2.5-2.5L17 3l5 5-5 5-1.5-1.5L18 9H7zm10 10H6l2.5 2.5L7 21l-5-5 5-5 1.5 1.5L6 15h11z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15 6l-6 6 6 6 1.4-1.4L11.8 12l4.6-4.6z"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15 6l-6 6 6 6 1.4-1.4L11.8 12l4.6-4.6z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 10.6L6.7 5.3 5.3 6.7l5.3 5.3-5.3 5.3 1.4 1.4 5.3-5.3 5.3 5.3 1.4-1.4-5.3-5.3 5.3-5.3-1.4-1.4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zm17.7-10.2a1 1 0 000-1.42l-2.33-2.33a1 1 0 00-1.42 0l-1.83 1.83 3.75 3.75z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 7h12v2H6zm2 3h2v9H8zm4 0h2v9h-2zm-3-7h6l1 2H6z"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2 12.5V4a1 1 0 011-1h8.5a1 1 0 01.7.3l9 9a1 1 0 010 1.4l-8.5 8.5a1 1 0 01-1.4 0l-9-9a1 1 0 01-.3-.7zM7 8a1.5 1.5 0 100-3A1.5 1.5 0 007 8z"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4L12 13.2V3zM5 19h14v2H5z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 21V10.8l-3.6 3.6L7 13l5-5 5 5-1.4 1.4L12 10.8V21zM5 3h14v2H5z"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 10h2v7h-2zm0-3h2v2h-2zM12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>',
  theme: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 000 20 10 10 0 006.3-2.2c-.3 0-.6.05-1 .05A8 8 0 019 4.6c0-.35.02-.68.05-1A10 10 0 0012 2z"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 5l7 7-1.4 1.4L13 8.8V19h-2V8.8l-4.6 4.6L5 12z"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 19l-7-7 1.4-1.4L11 15.2V5h2v10.2l4.6-4.6L19 12z"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg>',
  list: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4 20V10h3v10zm6.5 0V4h3v16zm6.5 0v-7h3v7z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 6a2 2 0 012-2h13v2H5v1h15v11a2 2 0 01-2 2H5a2 2 0 01-2-2zm14 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>'
};
