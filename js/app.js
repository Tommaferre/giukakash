/* ============================================================
   app.js — router, gestione eventi, orchestrazione UI
   ============================================================ */

/* ---------------- Tema (chiaro / scuro / automatico) ---------------- */
const Theme = (() => {
  const KEY = 'moneyapp:theme';

  function get() {
    try {
      const v = localStorage.getItem(KEY);
      return (v === 'light' || v === 'dark') ? v : 'system';
    } catch (e) { return 'system'; }
  }

  function apply(value) {
    if (value === 'light' || value === 'dark') {
      document.documentElement.setAttribute('data-theme', value);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function set(value) {
    try {
      if (value === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch (e) {}
    apply(value);
  }

  function init() { apply(get()); }

  return { get, set, init };
})();

(() => {
  const appEl = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const navEl = document.getElementById('bottom-nav');

  const state = {
    movementFilters: { type: 'all', account: 'all', category: 'all', q: '' },
    statsPeriod: 'month',
    statsRefDate: DB.todayISO(),
    visibleSeries: null // Set, inizializzato al primo render statistiche
  };

  // ---------------- ROUTER ----------------
  function currentRoute() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const [path, ...rest] = hash.split('/');
    return { path, param: rest.join('/') };
  }

  function navigate(path) {
    location.hash = '#/' + path;
  }

  function renderRoute() {
    const { path, param } = currentRoute();
    closeModal();
    let html = '';
    let topLevel = path;

    switch (path) {
      case 'home':
        html = Render.home();
        break;
      case 'movements':
        html = Render.movementsScreen(state.movementFilters);
        break;
      case 'stats':
        html = Render.statsScreen({ period: state.statsPeriod, refDate: state.statsRefDate });
        break;
      case 'accounts':
        html = Render.accountsScreen();
        break;
      case 'account':
        html = Render.accountDetailScreen(param);
        topLevel = 'accounts';
        break;
      case 'settings':
        html = Render.settingsScreen();
        topLevel = 'settings';
        break;
      case 'categories':
        html = Render.categoriesScreen(param || 'expense');
        topLevel = 'settings';
        break;
      default:
        html = Render.home();
        topLevel = 'home';
    }

    appEl.innerHTML = html;
    updateNavHighlight(topLevel);
    window.scrollTo(0, 0);
    postRenderHooks(path, param);
  }

  function updateNavHighlight(topLevel) {
    navEl.querySelectorAll('[data-navitem]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.navitem === topLevel);
    });
    navEl.style.display = ['home', 'movements', 'stats', 'accounts'].includes(topLevel) ? 'flex' : 'none';
  }

  function postRenderHooks(path, param) {
    if (path === 'stats') {
      if (!state.visibleSeries) {
        state.visibleSeries = new Set(['total', ...DB.getAccounts().map(a => a.id)]);
      }
      drawStatsCharts();
    }
  }

  // ---------------- GRAFICI STATISTICHE ----------------
  function drawStatsCharts() {
    const range = Render.getPeriodRange(state.statsPeriod, state.statsRefDate);
    const { series, labels } = Render.buildWealthSeries(state.statsPeriod, range, state.visibleSeries);
    const wealthContainer = document.getElementById('wealth-chart');
    if (wealthContainer) Charts.lineChart(wealthContainer, series, labels, { maxLabels: state.statsPeriod === 'year' ? 6 : 5 });

    if (state.statsPeriod === 'year') {
      const y = new Date(range.start).getFullYear();
      const incomeVals = [], expenseVals = [];
      for (let m = 0; m < 12; m++) {
        const s = DB.isoDate(new Date(y, m, 1)), e = DB.isoDate(new Date(y, m + 1, 0));
        const stats = DB.getPeriodStats(s, e);
        incomeVals.push(stats.income / 100);
        expenseVals.push(stats.expense / 100);
      }
      const barContainer = document.getElementById('bar-chart');
      if (barContainer) {
        Charts.barChart(barContainer, MONTHS_SHORT.map(m => m[0]), [
          { label: 'Entrate', color: '#22c55e', values: incomeVals },
          { label: 'Uscite', color: '#ef4444', values: expenseVals }
        ]);
      }
    }

    const stats = DB.getPeriodStats(range.start, range.end);
    const donutContainer = document.getElementById('cat-donut');
    if (donutContainer) {
      const items = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])
        .map(([cat, val], i) => ({ label: cat, value: val, color: Render.categoryColor(cat, i) }));
      Charts.donutChart(donutContainer, items);
    }
  }

  // ---------------- MODALI ----------------
  function openModal(html, extraClass) {
    modalRoot.innerHTML = `<div class="modal-overlay"><div class="modal-sheet ${extraClass || ''}">${html}</div></div>`;
    modalRoot.classList.add('open');
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    modalRoot.classList.remove('open');
    modalRoot.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function openMovementModal(type, editId, presetAccount) {
    openModal(Render.movementFormModal({ type, editId, presetAccount }));
  }
  function openAccountModal(accountId) {
    openModal(Render.accountFormModal(accountId));
  }

  // ---------------- SALVATAGGIO FORM MOVIMENTO ----------------
  function currentMovementType() {
    const active = modalRoot.querySelector('.type-tab.active');
    return active ? active.dataset.mvType : 'income';
  }

  function switchMovementType(newType) {
    modalRoot.querySelectorAll('.type-tab').forEach(b => b.classList.toggle('active', b.dataset.mvType === newType));
    const accounts = DB.getAccounts();
    const accField = document.getElementById('mv-account-fields');
    const currentAccountId = document.getElementById('mv-account') ? document.getElementById('mv-account').value : accounts[0].id;
    const toAccountId = (accounts.find(a => a.id !== currentAccountId) || accounts[0]).id;
    accField.innerHTML = Render.movementAccountFields(newType, currentAccountId, toAccountId, accounts);
    const catField = document.getElementById('mv-category-field');
    catField.innerHTML = newType !== 'transfer' ? Render.categoryField(newType, null) : '';
    const header = modalRoot.querySelector('.modal-header h2');
    if (header) header.textContent = newType === 'income' ? 'Aggiungi entrata' : newType === 'expense' ? 'Aggiungi uscita' : 'Trasferimento tra conti';
  }

  function saveMovementFromForm(idOrNew) {
    const type = currentMovementType();
    const amountRaw = document.getElementById('mv-amount').value;
    const amount = DB.parseAmountToCents(amountRaw);
    if (!amount || amount <= 0) { flashInvalid('mv-amount'); return; }

    const accountId = document.getElementById('mv-account').value;
    const date = document.getElementById('mv-date').value || DB.todayISO();
    const description = document.getElementById('mv-description').value.trim();
    const note = document.getElementById('mv-note').value.trim();

    let payload = { type, amount, date, accountId, description, note };

    if (type === 'transfer') {
      const toAccountId = document.getElementById('mv-to-account').value;
      if (toAccountId === accountId) { flashInvalid('mv-to-account'); return; }
      payload.toAccountId = toAccountId;
      payload.category = null;
    } else {
      const catEl = document.getElementById('mv-category');
      payload.category = catEl ? catEl.value : 'Altro';
    }

    if (idOrNew === 'new') {
      DB.addTransaction(payload);
    } else {
      DB.updateTransaction(idOrNew, payload);
    }
    closeModal();
    renderRoute();
  }

  function flashInvalid(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('invalid');
    el.focus();
    setTimeout(() => el.classList.remove('invalid'), 900);
  }

  // ---------------- SALVATAGGIO FORM CONTO ----------------
  function saveAccountFromForm(idOrNew) {
    const name = document.getElementById('acc-name').value.trim();
    if (!name) { flashInvalid('acc-name'); return; }
    const color = modalRoot.querySelector('#acc-color-picker').dataset.selected;
    const balanceRaw = document.getElementById('acc-balance').value;
    const initialBalance = DB.parseAmountToCents(balanceRaw);

    if (idOrNew === 'new') {
      DB.addAccount({ name, color, initialBalance });
    } else {
      DB.updateAccount(idOrNew, { name, color, initialBalance });
    }
    closeModal();
    renderRoute();
  }

  function deleteAccountConfirmed(id) {
    const hasTx = DB.accountHasTransactions(id);
    const msg = hasTx
      ? 'Questo conto ha movimenti associati che verranno eliminati insieme al conto. Continuare?'
      : 'Eliminare questo conto?';
    if (confirm(msg)) {
      DB.deleteAccount(id);
      closeModal();
      navigate('accounts');
    }
  }

  // ---------------- EXPORT / IMPORT ----------------
  function exportData() {
    const json = JSON.stringify(DB.data(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `moneyapp-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) {
          alert('File di backup non valido.');
          return;
        }
        if (confirm('Importando questo file, tutti i dati attuali verranno sovrascritti. Continuare?')) {
          DB.replaceAll(parsed);
          state.visibleSeries = null;
          navigate('home');
          renderRoute();
        }
      } catch (e) {
        alert('Impossibile leggere il file: formato non valido.');
      }
    };
    reader.readAsText(file);
  }

  // ---------------- EVENT DELEGATION ----------------
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) { navigate(navBtn.dataset.nav); return; }

    const navItem = e.target.closest('[data-navitem]');
    if (navItem) { navigate(navItem.dataset.navitem); return; }

    const openMv = e.target.closest('[data-open-movement]');
    if (openMv) {
      const preset = openMv.dataset.presetAccount || null;
      openMovementModal(openMv.dataset.openMovement, null, preset);
      return;
    }

    const openEdit = e.target.closest('[data-open-edit]');
    if (openEdit) { openMovementModal(null, openEdit.dataset.openEdit, null); return; }

    const openAcc = e.target.closest('[data-open-account]');
    if (openAcc) { openAccountModal(openAcc.dataset.openAccount); return; }

    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) { closeModal(); return; }

    const overlay = e.target.classList && e.target.classList.contains('modal-overlay');
    if (overlay) { closeModal(); return; }

    const mvType = e.target.closest('[data-mv-type]');
    if (mvType) { switchMovementType(mvType.dataset.mvType); return; }

    const saveMv = e.target.closest('[data-save-movement]');
    if (saveMv) { saveMovementFromForm(saveMv.dataset.saveMovement); return; }

    const delMv = e.target.closest('[data-delete-movement]');
    if (delMv) {
      if (confirm('Eliminare questo movimento? Il saldo dei conti verrà ricalcolato automaticamente.')) {
        DB.deleteTransaction(delMv.dataset.deleteMovement);
        closeModal();
        renderRoute();
      }
      return;
    }

    const colorSwatch = e.target.closest('[data-color]');
    if (colorSwatch) {
      const picker = colorSwatch.closest('.color-picker');
      picker.dataset.selected = colorSwatch.dataset.color;
      picker.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s === colorSwatch));
      return;
    }

    const saveAcc = e.target.closest('[data-save-account]');
    if (saveAcc) { saveAccountFromForm(saveAcc.dataset.saveAccount); return; }

    const delAcc = e.target.closest('[data-delete-account]');
    if (delAcc) { deleteAccountConfirmed(delAcc.dataset.deleteAccount); return; }

    const filterOption = e.target.closest('[data-filter-name]');
    if (filterOption) {
      state.movementFilters[filterOption.dataset.filterName] = filterOption.dataset.filterValue;
      renderRoute();
      return;
    }

    const periodTab = e.target.closest('[data-period]');
    if (periodTab) {
      state.statsPeriod = periodTab.dataset.period;
      state.statsRefDate = DB.todayISO();
      renderRoute();
      return;
    }

    const periodStep = e.target.closest('[data-period-step]');
    if (periodStep) {
      state.statsRefDate = Render.stepPeriod(state.statsPeriod, state.statsRefDate, parseInt(periodStep.dataset.periodStep, 10));
      renderRoute();
      return;
    }

    const legendChip = e.target.closest('[data-toggle-series]');
    if (legendChip) {
      const id = legendChip.dataset.toggleSeries;
      if (id === 'inc' || id === 'exp') return; // legenda statica per bar chart
      if (state.visibleSeries.has(id)) state.visibleSeries.delete(id); else state.visibleSeries.add(id);
      legendChip.classList.toggle('active');
      drawStatsCharts();
      return;
    }

    const delCat = e.target.closest('[data-delete-category]');
    if (delCat) {
      const [type, name] = delCat.dataset.deleteCategory.split('::');
      if (confirm(`Eliminare la categoria "${name}"?`)) {
        DB.deleteCategory(type, name);
        renderRoute();
      }
      return;
    }

    const action = e.target.closest('[data-action]');
    if (action) {
      handleAction(action.dataset.action);
      return;
    }

    const openTheme = e.target.closest('[data-open-theme]');
    if (openTheme) { openModal(Render.themeModal()); return; }

    const setTheme = e.target.closest('[data-set-theme]');
    if (setTheme) {
      Theme.set(setTheme.dataset.setTheme);
      closeModal();
      if (currentRoute().path === 'settings') renderRoute();
      return;
    }
  });

  function handleAction(action) {
    if (action === 'export-data') exportData();
    else if (action === 'import-data') document.getElementById('import-file-input').click();
    else if (action === 'erase-data') {
      if (confirm('Eliminare definitivamente tutti i dati? Questa azione non può essere annullata.')) {
        DB.reset();
        state.visibleSeries = null;
        navigate('home');
        renderRoute();
      }
    }
  }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'import-file-input' && e.target.files[0]) {
      importDataFromFile(e.target.files[0]);
      e.target.value = '';
    }
    if (e.target.id === 'f-type' || e.target.id === 'f-account' || e.target.id === 'f-category') {
      state.movementFilters.type = document.getElementById('f-type').value;
      state.movementFilters.account = document.getElementById('f-account').value;
      state.movementFilters.category = document.getElementById('f-category').value;
      renderRoute();
    }
  });

  let searchDebounce;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
      clearTimeout(searchDebounce);
      const val = e.target.value;
      searchDebounce = setTimeout(() => {
        state.movementFilters.q = val;
        renderRoute();
        setTimeout(() => {
          const input = document.getElementById('search-input');
          if (input) { input.focus(); input.setSelectionRange(val.length, val.length); }
        }, 0);
      }, 250);
    }
    if (e.target.id === 'mv-amount' || e.target.id === 'acc-balance') {
      e.target.classList.remove('invalid');
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'add-category-form') {
      e.preventDefault();
      const input = document.getElementById('new-category-name');
      const name = input.value.trim();
      if (!name) return;
      const { param } = currentRoute();
      const type = param || 'expense';
      DB.addCategory(type, name);
      input.value = '';
      renderRoute();
    }
  });

  // gestione preset filtro conto quando si arriva da "Vedi tutti" nel dettaglio conto
  document.addEventListener('click', (e) => {
    const presetLink = e.target.closest('[data-preset-filter-account]');
    if (presetLink) {
      state.movementFilters = { type: 'all', account: presetLink.dataset.presetFilterAccount, category: 'all', q: '' };
    }
  }, true);

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('resize', () => {
    if (currentRoute().path === 'stats') drawStatsCharts();
  });

  // ---------------- INIT ----------------
  function init() {
    Theme.init();
    renderRoute();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW non registrato', err));
      });
    }
  }

  init();
})();
