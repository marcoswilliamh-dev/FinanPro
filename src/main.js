import { createClient } from '@supabase/supabase-js';
import './style.css';

const SUPABASE_URL = 'https://jbycxsqgyzdksxsbitfu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cqX_1h-ZSA76KT0iQ_SoQw_QT6IuL4_';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  session: null, profile: null, accounts: [], categories: [], transactions: [], goals: [],
  page: 'home', type: 'expense', filter: 'all', loading: true, streak: 7,
};
const app = document.querySelector('#app');
window.state = state;

const money = n => `S/ ${Number(n || 0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-PE',{day:'2-digit',month:'short'}) : '';
const $ = id => document.getElementById(id);

function toast(msg, good=true){
  const t = document.createElement('div'); t.className = `toast ${good?'good':'bad'}`; t.textContent = msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2300);
}

function calc(){
  const inc = state.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+Number(t.amount),0);
  const exp = state.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+Number(t.amount),0);
  const transfers = state.transactions.filter(t=>t.type==='transfer').reduce((a,t)=>a+Number(t.amount),0);
  const balances = state.accounts.reduce((a,x)=>a+Number(x.current_balance||0),0);
  return {inc,exp,transfers,net:inc-exp,balance:balances};
}
function levelData(){
  const score = Math.max(0, Math.round(calc().net/10) + state.transactions.length*10 + state.goals.reduce((a,g)=>a+Math.round(Number(g.saved_amount||0)/100),0));
  const level = Math.min(50, Math.max(1, Math.floor(score/500)+1));
  const base = (level-1)*500, xp=score-base, pct=Math.min(100,Math.round(xp/500*100));
  return {level,xp,pct,score};
}

async function init(){
  app.innerHTML = `<div class="splash"><img src="/icon.png"><b>Moni <i>V2</i></b><span>Tu dinero, tus decisiones.</span></div>`;
  const {data,error}=await supabase.auth.getSession();
  if(error){showAuth(error.message);return;}
  state.session=data.session;
  if(!state.session){showAuth();return;}
  await loadData();
}
function showAuth(err=''){
  app.innerHTML = `<div class="auth-page"><div class="auth-art"><img src="/icon.png"><h1>Moni <mark>V2</mark></h1><p>No solo controles tu dinero.<br><b>Sube de nivel con él.</b></p></div><div class="auth-card"><h2>Tu aventura financiera empieza ahora</h2>${err?`<div class="error">${esc(err)}</div>`:''}<button class="primary big" id="enterBtn">👤 Entrar a Moni</button><button class="outline big" id="demoBtn">✨ Ver cómo funciona</button><small>🔒 Cuenta anónima del dispositivo · tus datos quedan asociados a esta instalación.</small></div></div>`;
  $('enterBtn').onclick=async()=>{ const {data,error}=await supabase.auth.signInAnonymously(); if(error){showAuth(error.message);return;} state.session=data.session; await loadData(); };
  $('demoBtn').onclick=()=>toast('El modo demo se habilita después de tu primera sincronización.');
}

async function loadData(){
  state.loading=true; renderShell();
  const uid=state.session.user.id;
  const [a,c,t,g,p]=await Promise.all([
    supabase.from('accounts').select('*').eq('user_id',uid).eq('is_active',true).order('created_at'),
    supabase.from('categories').select('*').or(`user_id.eq.${uid},is_system.eq.true`).order('name'),
    supabase.from('transactions').select('*').eq('user_id',uid).is('deleted_at',null).order('transaction_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('goals').select('*').eq('user_id',uid).order('created_at'),
    supabase.from('profiles').select('*').eq('id',uid).maybeSingle()
  ]);
  state.accounts=a.data||[]; state.categories=c.data||[]; state.transactions=t.data||[]; state.goals=g.data||[]; state.profile=p.data||null;
  if(!state.accounts.length){
    const r=await supabase.from('accounts').insert({user_id:uid,name:'Efectivo',type:'cash',currency:'PEN',current_balance:0}).select().single(); if(r.data)state.accounts=[r.data];
  }
  if(!state.goals.length){
    const r=await supabase.from('goals').insert({user_id:uid,name:'Suzuki Jimny',target_amount:45000,saved_amount:0,icon:'🚙'}).select().single(); if(r.data)state.goals=[r.data];
  }
  if(!state.categories.length){
    const cats=['Alimentación','Transporte','Hogar','Compras','Salud','Educación','Entretenimiento','Otros'].map(name=>({user_id:uid,name,kind:'expense',icon:'•',is_system:false}));
    const r=await supabase.from('categories').insert(cats).select(); if(r.data)state.categories=r.data;
  }
  state.loading=false; renderShell();
}

function renderShell(){
  if(!state.session){return;}
  app.innerHTML = `<div class="app-shell">
    <header class="topbar"><button class="brand" onclick="window.fpNav('home')"><span>Moni</span> <b>V2</b></button><div class="top-actions"><button onclick="window.fpNav('more')">⚙️</button><div class="avatar">M</div></div></header>
    <main id="screen"></main>
    <nav class="bottom-nav">
      ${navBtn('home','⌂','Inicio')}${navBtn('moves','↕','Movimientos')}
      <button class="nav-plus" onclick="window.fpOpenMove()">+</button>
      ${navBtn('plan','♧','Planificar')}${navBtn('more','☰','Más')}
    </nav>
  </div><div id="modal-root"></div>`;
  renderPage();
}
function navBtn(id,icon,label){return `<button class="nav-item ${state.page===id?'active':''}" onclick="window.fpNav('${id}')"><span>${icon}</span>${label}</button>`}

window.fpNav = id => {state.page=id; renderShell();};
window.fpOpenMove = ()=>openMoveModal();
window.fpOpenGoal = ()=>openGoalModal();
window.fpOpenAccount = ()=>openAccountModal();
window.fpDeleteMove = async id=>{if(!confirm('¿Eliminar este movimiento?'))return;const r=await supabase.from('transactions').update({deleted_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.session.user.id);if(r.error)return toast(r.error.message,false);await loadData();toast('Movimiento eliminado');};
window.fpContribute = async id=>{const g=state.goals.find(x=>x.id===id);const amount=Number(prompt(`Ahorro para ${g.name}\nMonto en S/`));if(!amount||amount<=0)return;const r=await supabase.from('goal_contributions').insert({goal_id:id,user_id:state.session.user.id,amount,contribution_date:today()});if(r.error)return toast(r.error.message,false);await loadData();toast(`🏆 +25 XP · ${money(amount)} a tu meta`);};
window.fpLogout = async()=>{await supabase.auth.signOut();location.reload();};

function renderPage(){
  const s=calc(), l=levelData();
  if(state.page==='home')$('screen').innerHTML=homeHTML(s,l);
  if(state.page==='moves')$('screen').innerHTML=movesHTML();
  if(state.page==='goals')$('screen').innerHTML=goalsHTML();
  if(state.page==='plan')$('screen').innerHTML=planHTML(s,l);
  if(state.page==='more')$('screen').innerHTML=moreHTML();
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>window.fpNav(b.dataset.go));
}

function homeHTML(s,l){
  const g=state.goals[0], gp=g?Math.min(100,Number(g.saved_amount)/Number(g.target_amount)*100):0;
  const recent=state.transactions.slice(0,4);
  const monthExp=s.exp, prev=monthExp*1.08;
  return `<div class="page-head"><div><div class="hello">Hola, Marcos 👋</div><small>Aquí está tu resumen financiero</small></div><button class="round">🔔</button></div>
  <section class="hero-yellow"><div class="hero-top"><div><span class="mini">NIVEL ${l.level} · CONSTRUCTOR FINANCIERO</span><h1>Tu aventura<br>financiera</h1></div><div class="mascot">👑</div></div><div class="xp-label"><b>⭐ XP ${l.xp.toLocaleString('es-PE')} / 500</b><b>${l.pct}%</b></div><div class="xp-track"><i style="width:${l.pct}%"></i></div></section>
  <section class="dark-card"><div class="section-line"><div><span class="mini">PATRIMONIO TOTAL</span><strong class="big-money">${money(s.balance)}</strong></div><span class="eye">◉</span></div><div class="stats3"><div><small>Disponible</small><b>${money(s.balance)}</b></div><div><small>Por recibir</small><b>${money(0)}</b></div><div><small>Por pagar</small><b class="red">${money(0)}</b></div></div></section>
  <div class="quick-grid"><button onclick="window.fpNav('more')"><span>💳</span>Cuentas</button><button onclick="window.fpNav('goals')"><span>🎯</span>Metas</button><button onclick="window.fpNav('more')"><span>▣</span>Tarjetas</button><button onclick="window.fpNav('more')"><span>•••</span>Más</button></div>
  <section class="mission-card"><div class="section-line"><h2>🎯 Misión del día</h2><span class="reward">+80 XP</span></div><p>Registra 3 movimientos y ahorra S/20. <b>¡Tú puedes!</b></p><div class="mission-row"><span>○ Registrar movimientos</span><b>${Math.min(3,state.transactions.length)}/3</b></div><div class="mission-row"><span>○ Ahorrar S/20</span><b>0%</b></div><button class="yellow-btn" onclick="window.fpOpenMove()">Ver misión →</button></section>
  ${s.exp>s.inc && s.exp>0 ? `<section class="alert-card"><b>⚠️ Atención</b><span>Tus gastos superan tus ingresos. Tu siguiente misión es recuperar el equilibrio.</span><button onclick="window.fpNav('plan')">Analizar</button></section>` : `<section class="success-card"><b>🔥 Racha de ${state.streak} días</b><span>Tu disciplina está creciendo. Mantén el hábito.</span><button onclick="window.fpNav('plan')">Ver logros</button></section>`}
  <section class="goal-preview"><div class="section-line"><h2>🚙 Suzuki Jimny</h2><b>${gp.toFixed(0)}%</b></div><div class="goal-amount"><b>${money(g?.saved_amount)}</b><span>/ ${money(g?.target_amount)}</span></div><div class="progress"><i style="width:${gp}%"></i></div><small>Te faltan ${money(Math.max(0,Number(g?.target_amount||0)-Number(g?.saved_amount||0)))}</small><button class="outline" onclick="window.fpNav('plan')">Ver misión completa</button></section>
  <section class="dark-card"><div class="section-line"><h2>Últimos movimientos</h2><button class="link" onclick="window.fpNav('moves')">Ver todos</button></div>${recent.length?recent.map(moveRow).join(''):'<div class="empty">Aún no hay movimientos.<br>Pulsa + para comenzar.</div>'}</section>`;
}
function moveRow(t){const income=t.type==='income';return `<div class="move-row"><div class="move-icon ${income?'in':'out'}">${income?'↗':'↘'}</div><div class="move-main"><b>${esc(t.merchant||'Movimiento')}</b><small>${esc(categoryName(t.category_id))} · ${fmtDate(t.transaction_date)}</small></div><strong class="${income?'green':'red'}">${income?'+':'-'}${money(t.amount)}</strong></div>`}
function categoryName(id){return state.categories.find(c=>c.id===id)?.name||'Sin categoría'}

function movesHTML(){
  const list=state.transactions.filter(t=>state.filter==='all'||(state.filter==='income'&&t.type==='income')||(state.filter==='expense'&&t.type==='expense'));
  return `<div class="page-title-row"><div><h1>Movimientos</h1><small>Tu historial financiero</small></div><button class="icon-btn" onclick="window.fpOpenMove()">＋</button></div><div class="tabs">${['all','income','expense'].map((f,i)=>`<button class="${state.filter===f?'sel':''}" onclick="state.filter='${f}';renderShell()">${['Todos','Ingresos','Gastos'][i]}</button>`).join('')}</div><section class="dark-card list-card">${list.length?list.map(t=>`${moveRow(t)}<button class="delete-move" onclick="window.fpDeleteMove('${t.id}')">Eliminar</button>`).join(''):'<div class="empty">No hay movimientos en este filtro.</div>'}</section>`;
}

function goalsHTML(){
  return `<div class="page-title-row"><div><h1>Metas</h1><small>Convierte sueños en misiones</small></div><button class="icon-btn" onclick="window.fpOpenGoal()">＋</button></div>${state.goals.map(g=>{const p=Math.min(100,Number(g.saved_amount||0)/Math.max(1,Number(g.target_amount||0))*100);return `<section class="goal-preview"><div class="section-line"><h2>${esc(g.icon||'🎯')} ${esc(g.name)}</h2><b>${p.toFixed(0)}%</b></div><div class="goal-amount"><b>${money(g.saved_amount)}</b><span>/ ${money(g.target_amount)}</span></div><div class="progress"><i style="width:${p}%"></i></div><small>Faltan ${money(Math.max(0,Number(g.target_amount)-Number(g.saved_amount)))}</small><button class="yellow-btn" onclick="window.fpContribute('${g.id}')">💰 Agregar ahorro +25 XP</button></section>`}).join('')||'<div class="empty">Crea tu primera meta.</div>'}`;
}

function planHTML(s,l){
  const g=state.goals[0],gp=g?Math.min(100,Number(g.saved_amount)/Number(g.target_amount)*100):0;
  const cats={};state.transactions.filter(t=>t.type==='expense').forEach(t=>cats[categoryName(t.category_id)]=(cats[categoryName(t.category_id)]||0)+Number(t.amount));
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5); const max=catRows[0]?.[1]||1;
  return `<div class="page-title-row"><div><h1>Planificar</h1><small>Convierte tus decisiones en progreso</small></div></div>
  <div class="subnav"><button class="sel">Resumen</button><button onclick="showStats()">Estadísticas</button><button onclick="showChallenges()">Desafíos</button></div>
  <section class="dark-card"><div class="section-line"><h2>🗺️ Mapa de niveles</h2><span class="badge-yellow">Nivel ${l.level}</span></div><div class="level-map">${[['🌱','Aprendiz','Conocer tu dinero',true],['🪙','Ahorrador','Primeros S/500',l.score>500],['🛡️','Protegido','Fondo de emergencia',l.score>1500],['⚔️','Guerrero','Dominar las deudas',l.score>3000],['🏗️','Constructor','Aumentar patrimonio',l.score>5000],['👑','Maestro','Libertad financiera',l.level>=10]].map(x=>`<div class="level-node ${x[3]?'done':''}"><span>${x[0]}</span><div><b>${x[1]}</b><small>${x[2]}</small></div>${x[3]?'✓':'🔒'}</div>`).join('')}</div></section>
  <section class="dark-card"><div class="section-line"><h2>🚙 Misión Suzuki Jimny</h2><b>${gp.toFixed(0)}%</b></div><div class="goal-amount"><b>${money(g?.saved_amount)}</b><span>/ ${money(g?.target_amount)}</span></div><div class="progress"><i style="width:${gp}%"></i></div><p class="muted">Cada ahorro te acerca al siguiente checkpoint.</p><button class="yellow-btn" onclick="window.fpContribute('${g?.id}')">💰 Agregar ahorro +25 XP</button></section>
  <section class="dark-card"><div class="section-line"><h2>📊 Gastos por categoría</h2><span class="badge">Este periodo</span></div>${catRows.length?catRows.map(([n,v])=>`<div class="bar-row"><div><span>${esc(n)}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join(''):'<div class="empty">Registra gastos para descubrir tus patrones.</div>'}</section>
  <section class="yellow-callout"><b>🧠 Consejo de Moni</b><p>No se trata de gastar menos por gastar menos. Se trata de conseguir que cada sol tenga un propósito.</p></section>`;
}
window.showStats=()=>toast('📊 Estadísticas detalladas: pronto tendrás gráficos por mes y categoría.');
window.showChallenges=()=>toast('🎯 Completa las misiones desde Inicio para ganar XP.');

function moreHTML(){
  return `<div class="page-title-row"><div><h1>Más</h1><small>Tu centro de control</small></div></div>
  <section class="profile-card"><div class="profile-avatar">M</div><div><b>Marcos</b><small>Constructor financiero · Nivel ${levelData().level}</small></div><span>›</span></section>
  <section class="menu-card"><button onclick="window.fpOpenAccount()"><span>💳</span><div><b>Cuentas y tarjetas</b><small>${state.accounts.length} cuenta(s) conectada(s)</small></div><i>›</i></button><button onclick="window.fpNav('plan')"><span>🎯</span><div><b>Metas</b><small>${state.goals.length} misión(es)</small></div><i>›</i></button><button onclick="window.fpNav('plan')"><span>🏆</span><div><b>Desafíos y logros</b><small>Sube de nivel</small></div><i>›</i></button><button><span>🔔</span><div><b>Notificaciones</b><small>Alertas financieras</small></div><i>›</i></button><button><span>🔐</span><div><b>Seguridad</b><small>Cuenta anónima del dispositivo</small></div><i>›</i></button></section>
  <section class="dark-card"><div class="section-line"><h2>☁️ Supabase</h2><span class="connected">● Conectado</span></div><p class="muted">Tus cuentas, movimientos y metas están sincronizados en la nube.</p></section>
  <button class="logout" onclick="window.fpLogout()">Cerrar sesión</button>
  <small class="version">Moni · Game Finance · v3.1.0</small>`;
}

function openMoveModal(){
  const cats=state.categories.filter(c=>c.kind==='expense'||c.kind==='both'||state.type==='income');
  const root=$('modal-root');
  root.innerHTML=`<div class="modal-bg"><div class="sheet"><div class="sheet-head"><h2>Registrar movimiento</h2><button onclick="closeModal()">✕</button></div><div class="type-grid"><button id="incomeType" onclick="setMoveType('income')">🟢<b>Ingreso</b><small>Dinero que recibes</small></button><button id="expenseType" class="active" onclick="setMoveType('expense')">🔴<b>Gasto</b><small>Dinero que gastas</small></button></div><label>Monto <input id="mAmount" type="number" step="0.01" placeholder="0.00"></label><label>Descripción <input id="mMerchant" placeholder="Ej. Almuerzo"></label><label>Cuenta <select id="mAccount">${state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label><label>Categoría <select id="mCategory">${cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Fecha <input id="mDate" type="date" value="${today()}"></label><button class="primary big" onclick="saveMove()">Guardar movimiento + XP</button></div></div>`;
}
window.setMoveType=t=>{state.type=t;$('incomeType').classList.toggle('active',t==='income');$('expenseType').classList.toggle('active',t==='expense');const cats=state.categories.filter(c=>c.kind==='expense'||c.kind==='both'||t==='income');$('mCategory').innerHTML=cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');};
window.closeModal=()=>{const r=$('modal-root');if(r)r.innerHTML='';};
window.saveMove=async()=>{const amount=Number($('mAmount').value);if(!amount||amount<=0)return toast('Ingresa un monto válido',false);const r=await supabase.from('transactions').insert({user_id:state.session.user.id,account_id:$('mAccount').value||null,category_id:$('mCategory').value||null,type:state.type,amount,currency:'PEN',transaction_date:$('mDate').value||today(),merchant:$('mMerchant').value||null});if(r.error)return toast(r.error.message,false);closeModal();await loadData();toast(state.type==='income'?'🟢 Ingreso guardado · +10 XP':'🔴 Gasto guardado · +5 XP');};

function openGoalModal(){
 const root=$('modal-root');root.innerHTML=`<div class="modal-bg"><div class="sheet"><div class="sheet-head"><h2>Nueva meta</h2><button onclick="closeModal()">✕</button></div><label>Nombre <input id="gName" placeholder="Ej. Fondo de emergencia"></label><label>Objetivo (S/) <input id="gTarget" type="number" placeholder="10000"></label><button class="primary big" onclick="saveGoal()">Crear misión</button></div></div>`;
}
window.saveGoal=async()=>{const name=$('gName').value.trim(),target=Number($('gTarget').value);if(!name||!target)return toast('Completa nombre y objetivo',false);const r=await supabase.from('goals').insert({user_id:state.session.user.id,name,target_amount:target,saved_amount:0,icon:'🎯'});if(r.error)return toast(r.error.message,false);closeModal();await loadData();toast('🎯 Nueva misión creada');};
function openAccountModal(){
 const root=$('modal-root');root.innerHTML=`<div class="modal-bg"><div class="sheet"><div class="sheet-head"><h2>Nueva cuenta</h2><button onclick="closeModal()">✕</button></div><label>Nombre <input id="aName" placeholder="BCP, Yape, Efectivo..."></label><label>Tipo <select id="aType"><option value="bank">Banco</option><option value="cash">Efectivo</option><option value="wallet">Billetera digital</option><option value="card">Tarjeta</option></select></label><label>Saldo inicial (S/) <input id="aBalance" type="number" step="0.01" value="0"></label><button class="primary big" onclick="saveAccount()">Crear cuenta</button><div class="account-list">${state.accounts.map(a=>`<div><span>${a.type==='cash'?'💵':'🏦'} ${esc(a.name)}</span><b>${money(a.current_balance)}</b></div>`).join('')}</div></div></div>`;
}
window.saveAccount=async()=>{const name=$('aName').value.trim(),type=$('aType').value,balance=Number($('aBalance').value||0);if(!name)return toast('Ponle un nombre',false);const r=await supabase.from('accounts').insert({user_id:state.session.user.id,name,type,currency:'PEN',current_balance:balance});if(r.error)return toast(r.error.message,false);closeModal();await loadData();toast('💳 Cuenta creada');};

init();
