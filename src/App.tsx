import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { CloudSession, financeApi } from './cloud';

type Kind = 'expense' | 'income';
type Transaction = { id: string; name: string; category: string; kind: Kind; amount: number; date: string };
type Goal = { id: string; name: string; target: number; saved: number; color: string };
type Reminder = { id: string; title: string; date: string; time: string; done: boolean; notified: boolean };
type AppData = { transactions: Transaction[]; goals: Goal[]; reminders: Reminder[] };

const KEY = 'finora-data-v1';
const EMPTY_DATA: AppData = { transactions: [], goals: [], reminders: [] };
const DEMO_TRANSACTION_IDS = new Set(['t1', 't2', 't3']);
const DEMO_GOAL_IDS = new Set(['g1', 'g2']);
const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const today = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const categories = ['Comida', 'Transporte', 'Hogar', 'Salud', 'Compras', 'Entretenimiento', 'Servicios', 'Otros'];
const initialData: AppData = {
  transactions: [
    { id: 't1', name: 'Súper del barrio', category: 'Comida', kind: 'expense', amount: 685, date: today() },
    { id: 't2', name: 'Pago quincenal', category: 'Ingreso', kind: 'income', amount: 12500, date: today() },
    { id: 't3', name: 'Metro y camión', category: 'Transporte', kind: 'expense', amount: 240, date: today() }
  ],
  goals: [
    { id: 'g1', name: 'Viaje a Oaxaca', target: 18000, saved: 7350, color: 'lime' },
    { id: 'g2', name: 'Fondo de emergencia', target: 30000, saved: 11200, color: 'blue' }
  ],
  reminders: []
};

function readData(key = KEY, fallback: AppData = initialData): AppData {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return { transactions: parsed.transactions ?? [], goals: parsed.goals ?? [], reminders: parsed.reminders ?? [] };
  } catch { return fallback; }
}

function accountDataKey(clerk: CloudSession['clerk']): string {
  const identifier = clerk.user?.id ?? clerk.user?.primaryEmailAddress?.emailAddress ?? clerk.user?.username ?? 'unknown';
  return `${KEY}:account:${encodeURIComponent(identifier)}`;
}

function withoutDemoData(data: AppData): AppData {
  return {
    transactions: data.transactions.filter(item => !DEMO_TRANSACTION_IDS.has(item.id)),
    goals: data.goals.filter(item => !DEMO_GOAL_IDS.has(item.id)),
    reminders: data.reminders
  };
}

function Icon(props: { name: string; size?: number }) {
  const common = { width: props.size ?? 20, height: props.size ?? 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true as const };
  return <svg {...common}>{props.name === 'home' ? <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></> : props.name === 'list' ? <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></> : props.name === 'target' ? <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></> : props.name === 'plus' ? <><path d="M12 5v14M5 12h14"/></> : props.name === 'arrow' ? <><path d="M7 17 17 7M7 7h10v10"/></> : props.name === 'down' ? <><path d="M12 4v15m0 0 6-6m-6 6-6-6"/></> : props.name === 'up' ? <><path d="M12 20V5m0 0 6 6m-6-6-6 6"/></> : props.name === 'wallet' ? <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h2"/></> : props.name === 'close' ? <><path d="m18 6-12 12M6 6l12 12"/></> : props.name === 'trash' ? <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v10m4-7.5c0-1.3-1.7-2.1-3.7-2.1S9 8.2 9 9.4s1 1.8 3 2.3 3 1.1 3 2.4-1.4 2.2-3.4 2.2S8 15.4 8 14"/></>}</svg>;
}

function App(props: { cloud: CloudSession | null; cloudError?: string | null }) {
  const [data, setData] = createSignal<AppData>(EMPTY_DATA);
  const [page, setPage] = createSignal('Inicio');
  const [modal, setModal] = createSignal<'transaction' | 'goal' | 'reminder' | 'account' | null>(null);
  const [kind, setKind] = createSignal<Kind>('expense');
  const [filter, setFilter] = createSignal('Todos');
  const [search, setSearch] = createSignal('');
  const [toast, setToast] = createSignal('');
  const [txName, setTxName] = createSignal('');
  const [txAmount, setTxAmount] = createSignal('');
  const [txCategory, setTxCategory] = createSignal('Comida');
  const [txDate, setTxDate] = createSignal(today());
  const [goalName, setGoalName] = createSignal('');
  const [goalTarget, setGoalTarget] = createSignal('');
  const [goalSaved, setGoalSaved] = createSignal('');
  const [reminderTitle, setReminderTitle] = createSignal('');
  const [reminderDate, setReminderDate] = createSignal(today());
  const [reminderTime, setReminderTime] = createSignal('09:00');
  const [notificationPermission, setNotificationPermission] = createSignal<NotificationPermission | 'unsupported'>('default');
  const [accountEmail, setAccountEmail] = createSignal('');
  const [cloudError, setCloudError] = createSignal(props.cloudError ?? '');
  const [month, setMonth] = createSignal(new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));

  const checkReminders = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    const due = data().reminders.filter(item => !item.done && !item.notified && new Date(`${item.date}T${item.time}:00`).getTime() <= Date.now());
    if (!due.length) return;
    const dueIds = new Set(due.map(item => item.id));
    save({ ...data(), reminders: data().reminders.map(item => dueIds.has(item.id) ? { ...item, notified: true } : item) });
    navigator.serviceWorker.ready.then(async registration => {
      await Promise.all(due.map(item => registration.showNotification('Bolsillo · Recordatorio', { body: item.title, icon: '/icon.svg', badge: '/icon.svg', tag: `bolsillo-${item.id}` })));
    }).catch(() => {
      save({ ...data(), reminders: data().reminders.map(item => dueIds.has(item.id) ? { ...item, notified: false } : item) });
      notify('No se pudo mostrar la notificación. Revisa los permisos del navegador.');
    });
  };
  onMount(() => {
    setData(readData());
    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
    let stopCloudQuery: (() => void) | undefined;
    const syncAccount = () => {
      stopCloudQuery?.();
      stopCloudQuery = undefined;
      const cloud = props.cloud;
      if (!cloud?.clerk.isSignedIn) { setAccountEmail(''); setData(readData()); return; }
      const localAccountKey = accountDataKey(cloud.clerk);
      setAccountEmail(cloud.clerk.user?.primaryEmailAddress?.emailAddress ?? cloud.clerk.user?.username ?? 'Cuenta conectada');
      setData(readData(localAccountKey, EMPTY_DATA));
      cloud.convex.setAuth(async () => cloud.clerk.session?.getToken({ template: 'convex' }) ?? null);
      let receivedFirstResult = false;
      stopCloudQuery = cloud.convex.onUpdate(financeApi.getMyData, {}, remoteData => {
        receivedFirstResult = true;
        if (remoteData) {
          const original = remoteData as AppData;
          const next = withoutDemoData(original);
          setData(next);
          localStorage.setItem(localAccountKey, JSON.stringify(next));
          if (next.transactions.length !== original.transactions.length || next.goals.length !== original.goals.length) {
            void cloud.convex.mutation(financeApi.saveMyData, { data: next }).catch(error => setCloudError(error instanceof Error ? error.message : 'No se pudieron limpiar los datos de ejemplo.'));
          }
        } else {
          const local = readData(localAccountKey, EMPTY_DATA);
          setData(local);
          localStorage.setItem(localAccountKey, JSON.stringify(local));
          void cloud.convex.mutation(financeApi.saveMyData, { data: local }).catch(error => setCloudError(error instanceof Error ? error.message : 'No se pudo sincronizar la cuenta.'));
        }
      }, error => {
        if (!receivedFirstResult) setCloudError(error.message);
      });
      setCloudError('');
    };
    const removeClerkListener = props.cloud?.clerk.addListener(syncAccount);
    syncAccount();
    const timer = window.setInterval(checkReminders, 15000);
    checkReminders();
    onCleanup(() => { window.clearInterval(timer); stopCloudQuery?.(); removeClerkListener?.(); });
  });
  const save = (next: AppData) => {
    setData(next);
    const signedIn = Boolean(props.cloud?.clerk.isSignedIn);
    const storageKey = signedIn && props.cloud ? accountDataKey(props.cloud.clerk) : KEY;
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (signedIn && props.cloud) void props.cloud.convex.mutation(financeApi.saveMyData, { data: next }).catch(error => setCloudError(error instanceof Error ? error.message : 'No se pudo guardar en la nube.'));
  };
  const thisMonth = createMemo(() => data().transactions.filter(t => t.date.slice(0, 7) === today().slice(0, 7)));
  const income = createMemo(() => thisMonth().filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0));
  const expenses = createMemo(() => thisMonth().filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0));
  const balance = createMemo(() => data().transactions.reduce((a, t) => a + (t.kind === 'income' ? t.amount : -t.amount), 0));
  const visibleTransactions = createMemo(() => data().transactions.filter(t => {
    const matchesKind = filter() === 'Todos' || (filter() === 'Gastos' ? t.kind === 'expense' : t.kind === 'income');
    return matchesKind && t.name.toLowerCase().includes(search().toLowerCase());
  }).slice().sort((a, b) => b.date.localeCompare(a.date)));
  const categorySpend = createMemo(() => categories.map(category => ({ category, amount: thisMonth().filter(t => t.kind === 'expense' && t.category === category).reduce((a, t) => a + t.amount, 0) })).filter(item => item.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 4));
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };

  const addTransaction = (event: SubmitEvent) => {
    event.preventDefault();
    const amount = Number(txAmount());
    if (!txName().trim() || amount <= 0) return;
    const transaction: Transaction = { id: crypto.randomUUID(), name: txName().trim(), category: kind() === 'income' ? 'Ingreso' : txCategory(), kind: kind(), amount, date: txDate() };
    save({ ...data(), transactions: [transaction, ...data().transactions] });
    setTxName(''); setTxAmount(''); setTxDate(today()); setModal(null); notify(kind() === 'income' ? 'Ingreso guardado' : 'Gasto guardado');
  };
  const addGoal = (event: SubmitEvent) => {
    event.preventDefault();
    const target = Number(goalTarget()); const saved = Number(goalSaved() || 0);
    if (!goalName().trim() || target <= 0) return;
    const goal: Goal = { id: crypto.randomUUID(), name: goalName().trim(), target, saved, color: data().goals.length % 2 ? 'blue' : 'lime' };
    save({ ...data(), goals: [...data().goals, goal] });
    setGoalName(''); setGoalTarget(''); setGoalSaved(''); setModal(null); notify('Meta creada');
  };
  const addReminder = (event: SubmitEvent) => {
    event.preventDefault();
    if (!reminderTitle().trim()) return;
    const reminder: Reminder = { id: crypto.randomUUID(), title: reminderTitle().trim(), date: reminderDate(), time: reminderTime(), done: false, notified: false };
    save({ ...data(), reminders: [...data().reminders, reminder].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)) });
    setReminderTitle(''); setReminderDate(today()); setReminderTime('09:00'); setModal(null);
    notify(notificationPermission() === 'granted' ? 'Recordatorio programado' : 'Guardado. Activa las notificaciones para recibir el aviso.');
  };
  const requestNotifications = async () => {
    if (!('Notification' in window)) { setNotificationPermission('unsupported'); notify('Este navegador no admite notificaciones web.'); return; }
    if (!window.isSecureContext) { notify('Las notificaciones requieren HTTPS o localhost.'); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    notify(permission === 'granted' ? 'Notificaciones activadas' : 'No se concedió permiso para notificaciones.');
    if (permission === 'granted') checkReminders();
  };
  const toggleReminder = (id: string) => save({ ...data(), reminders: data().reminders.map(item => item.id === id ? { ...item, done: !item.done } : item) });
  const deleteReminder = (id: string) => { save({ ...data(), reminders: data().reminders.filter(item => item.id !== id) }); notify('Recordatorio eliminado'); };
  const deleteTransaction = (id: string) => { save({ ...data(), transactions: data().transactions.filter(t => t.id !== id) }); notify('Movimiento eliminado'); };
  const deleteGoal = (id: string) => { save({ ...data(), goals: data().goals.filter(g => g.id !== id) }); notify('Meta eliminada'); };
  const addSavings = (goal: Goal) => {
    const contribution = Number(window.prompt(`¿Cuánto quieres añadir a “${goal.name}”?`, '500'));
    if (!contribution || contribution <= 0) return;
    save({ ...data(), goals: data().goals.map(g => g.id === goal.id ? { ...g, saved: Math.min(g.target, g.saved + contribution) } : g) }); notify('Ahorro actualizado');
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'bolsillo-respaldo.json'; link.click(); URL.revokeObjectURL(url); notify('Respaldo descargado');
  };
  const exportPdf = () => {
    const report = window.open('', '_blank');
    if (!report) { notify('Permite las ventanas emergentes para crear el PDF.'); return; }
    const htmlEscapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => htmlEscapes[char] ?? char);
    const sorted = data().transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
    const sumIncome = data().transactions.filter(t => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
    const sumExpenses = data().transactions.filter(t => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const transactionRows = sorted.map(t => `<tr><td>${new Date(`${t.date}T12:00:00`).toLocaleDateString('es-MX')}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.category)}</td><td>${t.kind === 'income' ? 'Ingreso' : 'Gasto'}</td><td class="amount">${t.kind === 'income' ? '+' : '−'}${money(t.amount)}</td></tr>`).join('');
    const goalRows = data().goals.map(g => `<tr><td>${escapeHtml(g.name)}</td><td>${money(g.saved)}</td><td>${money(g.target)}</td><td>${Math.round(Math.min(100, g.saved / g.target * 100))}%</td></tr>`).join('');
    const reminderRows = data().reminders.map(r => `<tr><td>${new Date(`${r.date}T12:00:00`).toLocaleDateString('es-MX')}</td><td>${r.time}</td><td>${escapeHtml(r.title)}</td><td>${r.done ? 'Completado' : 'Pendiente'}</td></tr>`).join('');
    report.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Bolsillo · Historial</title><style>
      body{font:12px Arial,sans-serif;color:#26342b;margin:36px}h1{font-size:24px;margin:0 0 5px;color:#214d3b}h2{font-size:15px;margin:28px 0 10px}.muted{color:#78847a;font-size:10px}.summary{display:flex;gap:12px;margin:22px 0}.card{border:1px solid #dfe6dc;border-radius:8px;padding:12px;min-width:130px}.card span,.card strong{display:block}.card span{font-size:10px;color:#78847a;margin-bottom:6px}.card strong{font-size:15px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e5eae3;padding:8px 6px;font-size:10px}th{background:#f1f5ef;color:#47624c}.amount{text-align:right;white-space:nowrap}.empty{padding:18px 0;color:#78847a}@media print{body{margin:18mm}.card, tr{break-inside:avoid}h2{break-after:avoid}thead{display:table-header-group}}@media(max-width:600px){body{margin:18px}.summary{flex-direction:column}}
      </style></head><body><h1>Bolsillo · Historial</h1><p class="muted">Reporte generado el ${new Date().toLocaleString('es-MX')}${accountEmail() ? ` · ${escapeHtml(accountEmail())}` : ''}</p><div class="summary"><div class="card"><span>Ingresos</span><strong>${money(sumIncome)}</strong></div><div class="card"><span>Gastos</span><strong>${money(sumExpenses)}</strong></div><div class="card"><span>Balance</span><strong>${money(sumIncome - sumExpenses)}</strong></div></div><h2>Historial de movimientos</h2>${sorted.length ? `<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Tipo</th><th class="amount">Monto</th></tr></thead><tbody>${transactionRows}</tbody></table>` : '<p class="empty">No hay movimientos registrados.</p>'}<h2>Metas de ahorro</h2>${goalRows ? `<table><thead><tr><th>Meta</th><th>Ahorrado</th><th>Objetivo</th><th>Avance</th></tr></thead><tbody>${goalRows}</tbody></table>` : '<p class="empty">No hay metas registradas.</p>'}<h2>Recordatorios</h2>${reminderRows ? `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Recordatorio</th><th>Estado</th></tr></thead><tbody>${reminderRows}</tbody></table>` : '<p class="empty">No hay recordatorios registrados.</p>'}<p class="muted">Generado por Bolsillo.</p></body></html>`);
    report.document.close();
    window.setTimeout(() => { report.focus(); report.print(); }, 300);
    notify('Elige “Guardar como PDF” en la ventana de impresión.');
  };
  const signOut = async () => { await props.cloud?.clerk.signOut(); setModal(null); notify('Sesión cerrada'); };

  return <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#inicio" onClick={() => setPage('Inicio')}><span class="brand-mark">b</span><span>bolsillo<span class="brand-dot">.</span></span></a>
      <p class="nav-caption">MENÚ</p>
      <nav class="side-nav">
        <For each={[['Inicio', 'home'], ['Movimientos', 'list'], ['Metas de ahorro', 'target']] as const}>{([label, icon]) => <button classList={{ active: page() === label }} onClick={() => setPage(label)}><Icon name={icon}/>{label}</button>}</For>
      </nav>
      <div class="sidebar-bottom"><div class="privacy-note"><span class="privacy-dot"/><div><strong>Tus datos son tuyos</strong><small>{accountEmail() ? 'Sincronizados con tu cuenta' : 'Guardados en este dispositivo'}</small></div></div><button class="export-button" onClick={exportPdf}>Guardar historial en PDF <Icon name="arrow" size={16}/></button><button class="export-button" onClick={exportData}>Descargar respaldo JSON <Icon name="arrow" size={16}/></button><button class="account-side-button" onClick={() => setModal('account')}>{accountEmail() || 'Entrar a cuenta'}</button></div>
    </aside>

    <main class="main-area">
      <header class="topbar"><div class="breadcrumb">Tu espacio <span>/</span> <strong>{page()}</strong></div><div class="topbar-right"><span class="date-pill">{new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span><button class="account-button" onClick={() => setModal('account')}>{accountEmail() || 'Entrar a cuenta'}</button></div></header>
      <div class="content">
        <Show when={page() === 'Inicio'} fallback={<Show when={page() === 'Movimientos'} fallback={<section class="page-section"><div class="section-heading"><div><p class="eyebrow">TU FUTURO, PASO A PASO</p><h1>Metas de ahorro</h1><p class="subheading">Cada pequeño avance cuenta.</p></div><button class="primary-button" onClick={() => setModal('goal')}><Icon name="plus"/> Nueva meta</button></div><div class="goals-grid"><For each={data().goals}>{goal => <article class="goal-card"><div class="goal-top"><span class={`goal-icon ${goal.color}`}><Icon name="target"/></span><button class="icon-button delete-goal" aria-label="Eliminar meta" onClick={() => deleteGoal(goal.id)}><Icon name="trash" size={17}/></button></div><p class="goal-label">META DE AHORRO</p><h2>{goal.name}</h2><div class="goal-figures"><strong>{money(goal.saved)}</strong><span>de {money(goal.target)}</span></div><div class="progress-track"><span class={goal.color} style={{ width: `${Math.min(100, goal.saved / goal.target * 100)}%` }}/></div><div class="goal-footer"><span>{Math.round(Math.min(100, goal.saved / goal.target * 100))}% completado</span><button onClick={() => addSavings(goal)}>Añadir ahorro <Icon name="plus" size={15}/></button></div></article>}</For><Show when={!data().goals.length}><div class="empty-state">Aún no tienes metas. Crea una para empezar a ahorrar con intención.</div></Show></div></section>}>
          <section class="page-section"><div class="section-heading"><div><p class="eyebrow">TU ACTIVIDAD</p><h1>Movimientos</h1><p class="subheading">Consulta y filtra tus ingresos y gastos.</p></div><div class="section-actions"><button class="secondary-button" onClick={exportPdf}>Guardar PDF</button><button class="primary-button" onClick={() => setModal('transaction')}><Icon name="plus"/> Añadir movimiento</button></div></div><div class="toolbar"><label class="search-box"><span>⌕</span><input value={search()} onInput={e => setSearch(e.currentTarget.value)} placeholder="Buscar movimiento"/></label><div class="filter-tabs"><For each={['Todos', 'Gastos', 'Ingresos']}>{item => <button classList={{ selected: filter() === item }} onClick={() => setFilter(item)}>{item}</button>}</For></div></div><TransactionList items={visibleTransactions()} onDelete={deleteTransaction}/></section>
        </Show>}>
          <section class="page-section">
            <div class="welcome-row"><div><p class="eyebrow">{month().toUpperCase()}</p><h1>Hola, ¿cómo van tus finanzas?</h1><p class="subheading">Un paso pequeño hoy hace la diferencia mañana.</p></div><div class="welcome-actions"><button class="secondary-button" onClick={() => setModal('reminder')}><Icon name="target"/> Recordatorio</button><button class="primary-button" onClick={() => setModal('transaction')}><Icon name="plus"/> Nuevo movimiento</button></div></div>
            <div class="summary-grid">
              <article class="balance-card"><div class="card-top"><span>Saldo disponible</span><span class="balance-icon"><Icon name="wallet"/></span></div><div class="balance-number">{money(balance())}</div><div class="balance-footer"><span class="balance-indicator"><span/> Actualizado con tus movimientos</span><span class="balance-month">Este mes</span></div><div class="balance-decoration"/></article>
              <article class="stat-card"><div class="stat-heading"><span>Ingresos</span><span class="stat-icon income"><Icon name="up"/></span></div><strong>{money(income())}</strong><small>Este mes</small><div class="stat-line income-line"/></article>
              <article class="stat-card"><div class="stat-heading"><span>Gastos</span><span class="stat-icon expense"><Icon name="down"/></span></div><strong>{money(expenses())}</strong><small>Este mes</small><div class="stat-line expense-line"/></article>
            </div>
            <section class="reminders-panel">
              <div class="panel-heading"><div><p class="eyebrow">QUE NO SE TE PASE</p><h2>Recordatorios</h2></div><div class="reminder-actions"><button class="text-link" onClick={requestNotifications}>{notificationPermission() === 'granted' ? 'Avisos activados' : 'Activar avisos'}</button><button class="primary-button small-button" onClick={() => setModal('reminder')}><Icon name="plus"/> Nuevo</button></div></div>
              <Show when={notificationPermission() === 'granted'} fallback={<p class="reminder-hint">Activa los avisos para recibir una notificación en este teléfono cuando la app esté abierta.</p>}><p class="reminder-hint enabled">Notificaciones activas en este dispositivo.</p></Show>
              <Show when={data().reminders.length} fallback={<div class="empty-state compact-empty">Aún no tienes recordatorios. Añade pagos, fechas de cobro o aportaciones a tus metas.</div>}>
                <div class="reminder-list"><For each={data().reminders.slice().sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))}>{reminder => <article classList={{ completed: reminder.done }} class="reminder-row"><button class="reminder-check" aria-label={reminder.done ? 'Marcar pendiente' : 'Completar recordatorio'} onClick={() => toggleReminder(reminder.id)}>{reminder.done ? '✓' : ''}</button><div class="reminder-copy"><strong>{reminder.title}</strong><span>{new Date(`${reminder.date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {reminder.time}</span></div><Show when={!reminder.done && !reminder.notified}><span class="reminder-status">Pendiente</span></Show><Show when={reminder.notified && !reminder.done}><span class="reminder-status sent">Avisado</span></Show><button class="icon-button delete-transaction" aria-label="Eliminar recordatorio" onClick={() => deleteReminder(reminder.id)}><Icon name="trash" size={16}/></button></article>}</For></div>
              </Show>
            </section>
            <div class="dashboard-grid">
              <section class="panel transactions-panel"><div class="panel-heading"><div><p class="eyebrow">LO MÁS RECIENTE</p><h2>Movimientos recientes</h2></div><button class="text-link" onClick={() => setPage('Movimientos')}>Ver todos <Icon name="arrow" size={15}/></button></div><TransactionList items={data().transactions.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5)} onDelete={deleteTransaction}/></section>
              <section class="panel category-panel"><div class="panel-heading"><div><p class="eyebrow">ESTE MES</p><h2>En qué se va</h2></div><span class="category-total">{money(expenses())}</span></div><Show when={categorySpend().length} fallback={<div class="mini-empty">Tus gastos por categoría aparecerán aquí.</div>}><div class="category-list"><For each={categorySpend()}>{(item, i) => <div class="category-row"><div class="category-meta"><span class={`category-bullet tone-${i()}`}/><span>{item.category}</span><strong>{money(item.amount)}</strong></div><div class="category-track"><span class={`tone-${i()}`} style={{ width: `${expenses() ? item.amount / expenses() * 100 : 0}%` }}/></div></div>}</For></div></Show><button class="category-link" onClick={() => { setPage('Movimientos'); setFilter('Gastos'); }}>Ver análisis de gastos <Icon name="arrow" size={15}/></button></section>
            </div>
            <section class="goals-preview"><div class="panel-heading"><div><p class="eyebrow">AHORRA A TU RITMO</p><h2>Tus metas</h2></div><button class="text-link" onClick={() => setPage('Metas de ahorro')}>Ver metas <Icon name="arrow" size={15}/></button></div><Show when={data().goals.length} fallback={<button class="create-goal-prompt" onClick={() => setModal('goal')}><span class="prompt-plus"><Icon name="plus"/></span><span><strong>Crea tu primera meta</strong><small>Ponle nombre y define cuánto quieres ahorrar.</small></span><Icon name="arrow" size={17}/></button>}><div class="goal-preview-grid"><For each={data().goals.slice(0, 2)}>{goal => <button class="goal-preview" onClick={() => setPage('Metas de ahorro')}><span class={`goal-preview-icon ${goal.color}`}><Icon name="target" size={17}/></span><span class="goal-preview-copy"><strong>{goal.name}</strong><small>{money(goal.saved)} de {money(goal.target)}</small><span class="progress-track"><i class={goal.color} style={{ width: `${Math.min(100, goal.saved / goal.target * 100)}%` }}/></span></span><span class="goal-percent">{Math.round(Math.min(100, goal.saved / goal.target * 100))}%</span></button>}</For></div></Show></section>

          </section>
        </Show>
      </div>
      <nav class="mobile-nav"><For each={[['Inicio', 'home'], ['Movimientos', 'list'], ['Metas de ahorro', 'target']] as const}>{([label, icon]) => <button classList={{ active: page() === label }} onClick={() => setPage(label)}><Icon name={icon}/><span>{label === 'Metas de ahorro' ? 'Metas' : label}</span></button>}</For></nav>
    </main>

    <Show when={modal() && modal() !== 'account'}><div class="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><section class="modal" role="dialog" aria-modal="true"><div class="modal-heading"><div><p class="eyebrow">{modal() === 'transaction' ? 'REGISTRO RÁPIDO' : modal() === 'goal' ? 'AHORRO CON PROPÓSITO' : 'AVISO EN TU TELÉFONO'}</p><h2>{modal() === 'transaction' ? 'Nuevo movimiento' : modal() === 'goal' ? 'Nueva meta' : 'Nuevo recordatorio'}</h2></div><button class="icon-button" onClick={() => setModal(null)} aria-label="Cerrar"><Icon name="close"/></button></div>
      <Show when={modal() === 'transaction'} fallback={<Show when={modal() === 'goal'} fallback={<form onSubmit={addReminder} class="form-stack"><label>¿Qué quieres recordar?<input required maxlength="70" value={reminderTitle()} onInput={e => setReminderTitle(e.currentTarget.value)} placeholder="Ej. Pagar internet, cobrar, ahorrar"/></label><label>Fecha<input required type="date" min={today()} value={reminderDate()} onInput={e => setReminderDate(e.currentTarget.value)}/></label><label>Hora<input required type="time" value={reminderTime()} onInput={e => setReminderTime(e.currentTarget.value)}/></label><p class="reminder-hint form-hint">El teléfono mostrará el aviso a esta hora mientras Bolsillo esté abierta.</p><div class="modal-actions"><button type="button" class="secondary-button" onClick={() => setModal(null)}>Cancelar</button><button class="primary-button" type="submit">Guardar recordatorio <Icon name="arrow" size={16}/></button></div></form>}><form onSubmit={addGoal} class="form-stack"><label>Nombre de la meta<input required maxlength="40" value={goalName()} onInput={e => setGoalName(e.currentTarget.value)} placeholder="Ej. Viaje, laptop, fondo de emergencia"/></label><label>¿Cuánto quieres juntar?<div class="amount-input"><span>$</span><input required min="1" step="1" type="number" value={goalTarget()} onInput={e => setGoalTarget(e.currentTarget.value)} placeholder="0"/></div></label><label>¿Ya tienes algo ahorrado?<div class="amount-input"><span>$</span><input min="0" step="1" type="number" value={goalSaved()} onInput={e => setGoalSaved(e.currentTarget.value)} placeholder="0"/></div></label><div class="modal-actions"><button type="button" class="secondary-button" onClick={() => setModal(null)}>Cancelar</button><button class="primary-button" type="submit">Crear meta <Icon name="arrow" size={16}/></button></div></form></Show>}>
        <form onSubmit={addTransaction} class="form-stack"><div class="kind-switch"><button type="button" classList={{ chosen: kind() === 'expense' }} onClick={() => { setKind('expense'); setTxCategory('Comida'); }}>Gasto</button><button type="button" classList={{ chosen: kind() === 'income' }} onClick={() => setKind('income')}>Ingreso</button></div><label>Descripción<input required maxlength="50" value={txName()} onInput={e => setTxName(e.currentTarget.value)} placeholder={kind() === 'income' ? 'Ej. Nómina, venta...' : 'Ej. Despensa, transporte...'}/></label><label>Monto<div class="amount-input"><span>$</span><input required min="1" step="1" type="number" value={txAmount()} onInput={e => setTxAmount(e.currentTarget.value)} placeholder="0"/></div></label><Show when={kind() === 'expense'}><label>Categoría<select value={txCategory()} onChange={e => setTxCategory(e.currentTarget.value)}><For each={categories}>{c => <option>{c}</option>}</For></select></label></Show><label>Fecha<input required type="date" value={txDate()} onInput={e => setTxDate(e.currentTarget.value)}/></label><div class="modal-actions"><button type="button" class="secondary-button" onClick={() => setModal(null)}>Cancelar</button><button class="primary-button" type="submit">Guardar movimiento <Icon name="arrow" size={16}/></button></div></form>
      </Show>
    </section></div></Show>
    <Show when={modal() === 'account'}><div class="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><section class="modal account-modal" role="dialog" aria-modal="true"><div class="modal-heading"><div><p class="eyebrow">TU CUENTA</p><h2>{accountEmail() ? 'Cuenta conectada' : 'Inicia sesión o crea tu cuenta'}</h2></div><button class="icon-button" onClick={() => setModal(null)} aria-label="Cerrar"><Icon name="close"/></button></div>
      <Show when={accountEmail()} fallback={<Show when={props.cloud} fallback={<div class="account-setup"><p>{props.cloudError ? 'No se pudo conectar con Clerk o Convex.' : 'El acceso con cuenta aún necesita configurar Clerk y Convex.'}</p><ol><li>Crea las aplicaciones de Clerk y Convex.</li><li>Copia las claves al archivo <code>.env</code>.</li><li>Ejecuta <code>npx convex dev</code> para desplegar el esquema seguro.</li></ol><p>Tus datos locales siguen disponibles mientras configuras la sincronización.</p></div>}><SignInMount clerk={props.cloud!.clerk}/></Show>}>
        <div class="account-connected"><p>Sesión iniciada como <strong>{accountEmail()}</strong>.</p><p>Tus movimientos, metas y recordatorios se sincronizan con tu cuenta.</p><button class="secondary-button" onClick={signOut}>Cerrar sesión</button></div>
      </Show>
      <Show when={cloudError()}><p class="cloud-error">{cloudError()}</p></Show>
    </section></div></Show>
    <Show when={toast()}><div class="toast"><span class="toast-check">✓</span>{toast()}</div></Show>
  </div>;
}

function SignInMount(props: { clerk: CloudSession['clerk'] }) {
  let target!: HTMLDivElement;
  onMount(() => props.clerk.mountSignIn(target));
  onCleanup(() => props.clerk.unmountSignIn(target));
  return <div class="clerk-sign-in" ref={target}/>;
}

function TransactionList(props: { items: Transaction[]; onDelete: (id: string) => void }) {
  return <Show when={props.items.length} fallback={<div class="empty-state">Aún no hay movimientos. Añade un ingreso o gasto para empezar.</div>}><div class="transaction-list"><For each={props.items}>{item => <article class="transaction-row"><div class={`transaction-icon ${item.kind}`}><Icon name={item.kind === 'income' ? 'up' : 'down'} size={18}/></div><div class="transaction-description"><strong>{item.name}</strong><span>{item.category} <i/> {new Date(`${item.date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span></div><strong classList={{ positive: item.kind === 'income' }} class="transaction-amount">{item.kind === 'income' ? '+' : '−'}{money(item.amount)}</strong><button class="icon-button delete-transaction" aria-label={`Eliminar ${item.name}`} onClick={() => props.onDelete(item.id)}><Icon name="trash" size={16}/></button></article>}</For></div></Show>;
}

export default App;
