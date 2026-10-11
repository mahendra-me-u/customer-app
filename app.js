/* ======================================================
   app.js
   Firebase Authentication (Email/Password) + Firestore
   Enhanced with Date Picker for Transactions
   ====================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyD7Puh6XMuuwOPu3U2zOoUWMBwQW04Z2tw",
  authDomain: "credit-app-f2c16.firebaseapp.com",
  projectId: "credit-app-f2c16",
  storageBucket: "credit-app-f2c16.firebasestorage.app",
  messagingSenderId: "1057636057228",
  appId: "1:1057636057228:web:9397f9a16b6d4925633ba9",
  measurementId: "G-QZM0880S42"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let unsubCustomers = null;
let unsubTransactions = null;
const LOCAL_CUSTOMERS = 'cc_customers';
const LOCAL_TRANSACTIONS = 'cc_transactions';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function fmtMoney(n){ return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(n)||0); }
function fmtDate(d){ 
  try { 
    if (d && typeof d === 'object' && d.toDate) d = d.toDate(); 
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
  } catch(e) { 
    return d; 
  } 
}
function escapeHTML(v){return String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function localDateTimeValue(value = new Date()) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
function txTime(t){const d=new Date(t.date || t.createdAt || 0);return Number.isFinite(d.getTime())?d.getTime():0;}
function txDelta(t){return (t.type==='given'?1:-1)*Number(t.amount||0);}
function dayKey(t){const d=new Date(t.date);return Number.isFinite(d.getTime())?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'Unknown date';}
let activeCustomerId=null;
let txSearchText='';
function refreshActiveCustomer(){
 if(!activeCustomerId || !$('#cust-balance-block'))return;
 const c=localCustomers.find(x=>x.id===activeCustomerId);
 if(c)openCustomerUI(c,localCustomers,localTransactions);
 else {activeCustomerId=null;rightContent.innerHTML='';rightDefault.style.display='';}
}
function saveLocal(key, v){ localStorage.setItem(key, JSON.stringify(v)); }
function loadLocal(key, fallback){ try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;} }

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const btnShowLogin = $('#btn-show-login');
const btnLogout = $('#btn-logout');
const customerListEl = $('#customer-list');
const rightDefault = $('#right-default');
const rightContent = $('#right-content');
const searchEl = $('#search');
const sortEl = $('#sortBy');
const topTotalEl = $('#top-total');
const quickGiveEl = $('#quick-give');
const quickGetEl = $('#quick-get');
const customerCountEl = $('#customer-count');
const importJsonFile = $('#import-json-file');
const exportJsonBtn = $('#export-json');
const importJsonBtnEl = $('#import-json-btn');
const importCsvInput = $('#import-csv');
const exportCustomersCsvBtn = $('#export-customers-csv');
const exportAllCsvBtn = $('#export-csv-all');
const quickExportAllBtn = $('#quick-export-all');
const openAddBtn = $('#open-add');
const quickAddCustomerBtn = $('#quick-add-customer');
const quickAddCustomerHeaderBtn = $('#quick-add-customer-header');

let localCustomers = loadLocal(LOCAL_CUSTOMERS, []);
let localTransactions = loadLocal(LOCAL_TRANSACTIONS, []);

btnShowLogin.addEventListener('click', () => showAuthUI());
btnLogout.addEventListener('click', async () => await auth.signOut());
openAddBtn.addEventListener('click', () => showAddCustomerUI());
quickAddCustomerBtn.addEventListener('click', () => showAddCustomerUI());
quickAddCustomerHeaderBtn.addEventListener('click', () => showAddCustomerUI());

function showAuthUI(){
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div class="auth-form">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3><i class="fas fa-lock"></i> Sign In / Sign Up</h3>
        <button id="close-auth" class="btn plain small">Close</button>
      </div>
      <div class="divider"></div>
      <form>
        <label>Email</label>
        <input id="auth-email" type="email" placeholder="you@example.com" required />
        <label style="margin-top:8px">Password</label>
        <input id="auth-pass" type="password" placeholder="password" required minlength="6" />
        <div style="margin-top:16px;display:flex;gap:12px">
          <button type="button" id="auth-signin" class="btn success flex-1">Sign In</button>
          <button type="button" id="auth-signup" class="btn plain flex-1">Sign Up</button>
        </div>
      </form>
      <div class="small-muted" style="margin-top:12px;text-align:center">
        Signing up creates an account (email/password). Data will be synced to your account.
      </div>
    </div>
  `;
  $('#close-auth').addEventListener('click', () => { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#auth-signin').addEventListener('click', handleSignIn);
  $('#auth-signup').addEventListener('click', handleSignUp);
}

async function handleSignUp(){
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  if(!email || !pass){ alert('Enter email and password'); return; }
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await initializeUserInFirestore(cred.user.uid);
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
    alert('Signup successful. Data will sync automatically.');
  }catch(e){
    alert('Sign up error: ' + e.message);
  }
}

async function handleSignIn(){
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  if(!email || !pass){ alert('Enter email and password'); return; }
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  }catch(e){
    alert('Sign in error: ' + e.message);
  }
}

async function initializeUserInFirestore(uid){
  const userDoc = db.collection('users').doc(uid);
  const snap = await userDoc.get();
  if(!snap.exists){
    await userDoc.set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  if(currentUser){
    btnShowLogin.style.display = 'none';
    btnLogout.style.display = '';
    await syncLocalToCloudAndReload();
    subscribeToUserData(currentUser.uid);
  } else {
    btnShowLogin.style.display = '';
    btnLogout.style.display = 'none';
    if(unsubCustomers){ unsubCustomers(); unsubCustomers = null; }
    if(unsubTransactions){ unsubTransactions(); unsubTransactions = null; }
    renderFromLocalCache();
  }
});

function subscribeToUserData(uid){
  if(unsubCustomers){ unsubCustomers(); unsubCustomers=null; }
  if(unsubTransactions){ unsubTransactions(); unsubTransactions=null; }
  const custRef = db.collection('users').doc(uid).collection('customers');
  const txRef = db.collection('users').doc(uid).collection('transactions');
  unsubCustomers = custRef.onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
      arr.push(data);
    });
    localCustomers = arr;
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderCustomers(localCustomers);
    refreshActiveCustomer();
  }, err => console.error('customers snapshot error', err));
  unsubTransactions = txRef.onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
      if (data.date && data.date.toDate) data.date = data.date.toDate().toISOString();
      arr.push(data);
    });
    localTransactions = arr;
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderCustomers(localCustomers);
    refreshActiveCustomer();
  }, err => console.error('transactions snapshot error', err));
}

async function syncLocalToCloudAndReload(){
  if(!currentUser) return;
  const userId = currentUser.uid;
  const cusCol = db.collection('users').doc(userId).collection('customers');
  const txCol = db.collection('users').doc(userId).collection('transactions');
  const [cloudCustSnap, cloudTxSnap] = await Promise.all([cusCol.get(), txCol.get()]);
  const cloudCustIds = new Set(cloudCustSnap.docs.map(d => d.id));
  const cloudTxIds = new Set(cloudTxSnap.docs.map(d => d.id));
  for(const c of localCustomers){
    if(!c.id) c.id = uid();
    if(!cloudCustIds.has(c.id)){
      const createdAt = c.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(c.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
      await cusCol.doc(c.id).set({ ...c, createdAt });
    }
  }
  for(const t of localTransactions){
    if(!t.id) t.id = uid();
    if(!cloudTxIds.has(t.id)){
      const createdAt = t.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(t.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
      await txCol.doc(t.id).set({ ...t, createdAt });
    }
  }
  localCustomers = [];
  localTransactions = [];
  saveLocal(LOCAL_CUSTOMERS, []);
  saveLocal(LOCAL_TRANSACTIONS, []);
}

async function saveCustomerToCloud(customer){
  if(!currentUser) {
    if(!customer.id) customer.id = uid();
    const idx = localCustomers.findIndex(c => c.id === customer.id);
    if(idx === -1) localCustomers.unshift(customer);
    else localCustomers[idx] = customer;
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderFromLocalCache();
    return;
  }
  const docRef = db.collection('users').doc(currentUser.uid).collection('customers').doc(customer.id || uid());
  if(!customer.id) customer.id = docRef.id;
  const createdAt = customer.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(customer.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
  await docRef.set({ ...customer, createdAt }, { merge: true });
}

async function deleteCustomerCloud(customerId){
  if(!currentUser){
    localCustomers = localCustomers.filter(c => c.id !== customerId);
    localTransactions = localTransactions.filter(t => t.customerId !== customerId);
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    return;
  }
  const custDoc = db.collection('users').doc(currentUser.uid).collection('customers').doc(customerId);
  const txCol = db.collection('users').doc(currentUser.uid).collection('transactions');
  await custDoc.delete();
  const txSnap = await txCol.where('customerId', '==', customerId).get();
  const batch = db.batch();
  txSnap.forEach(td => batch.delete(td.ref));
  await batch.commit();
}

async function saveTransactionToCloud(tx){
  if(!currentUser){
    if(!tx.id) tx.id = uid();
    const idx=localTransactions.findIndex(t=>t.id===tx.id);
    if(idx>=0)localTransactions[idx]=tx;else localTransactions.unshift(tx);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    refreshActiveCustomer();
    return;
  }
  const docRef = db.collection('users').doc(currentUser.uid).collection('transactions').doc(tx.id || uid());
  if(!tx.id) tx.id = docRef.id;
  const createdAt = tx.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(tx.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
  await docRef.set({ ...tx, createdAt });
}

async function deleteTransactionCloud(txId){
  if(!currentUser){
    localTransactions = localTransactions.filter(t => t.id !== txId);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    refreshActiveCustomer();
    return;
  }
  await db.collection('users').doc(currentUser.uid).collection('transactions').doc(txId).delete();
}

function computeBalances(customersArr, transactionsArr){
  const balances = {};
  for(const c of customersArr){ balances[c.id] = 0; }
  for(const t of transactionsArr){
    if(!balances[t.customerId]) balances[t.customerId] = 0;
    if(t.type === 'given') balances[t.customerId] += Number(t.amount || 0);
    else balances[t.customerId] -= Number(t.amount || 0);
  }
  return balances;
}

function renderCustomers(customersArr){
  const customersList = customersArr || loadLocal(LOCAL_CUSTOMERS, []);
  const transactionsList = currentUser ? localTransactions : loadLocal(LOCAL_TRANSACTIONS, []);
  const balances = computeBalances(customersList, transactionsList);
  customerListEl.innerHTML = '';
  const q = (searchEl.value || '').toLowerCase();
  let filtered = customersList.filter(c => 
    !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
  );
  const sortBy = sortEl.value || 'recent';
  let displayList = filtered.slice();
  switch(sortBy) {
    case 'recent':
      displayList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'balanceDesc':
      displayList.sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0));
      break;
    case 'balanceAsc':
      displayList.sort((a, b) => (balances[a.id] || 0) - (balances[b.id] || 0));
      break;
    case 'nameAsc':
      displayList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'nameDesc':
      displayList.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;
  }
  customerCountEl.textContent = displayList.length;
  displayList.forEach(c => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const bal = balances[c.id] || 0;
    const tagClass = bal > 0 ? 'get-tag' : bal < 0 ? 'give-tag' : 'settled-tag';
    item.innerHTML = `
      <div class="left">
        <div class="customer-name">${escapeHTML(c.name)}</div>
        <div class="customer-phone">${escapeHTML(c.phone)}</div>
      </div>
      <div class="right">
        <div class="customer-balance">${fmtMoney(Math.abs(bal))}</div>
        <div class="tag ${tagClass}">${bal > 0 ? "You'll Get" : bal < 0 ? "You'll Give" : "Settled"}</div>
      </div>
    `;
    item.addEventListener('click', () => openCustomerUI(c, customersList, transactionsList));
    customerListEl.appendChild(item);
  });
  const totals = { give:0, get:0 };
  Object.values(balances).forEach(v => {
    if(v > 0) totals.get += v;
    else if(v < 0) totals.give += Math.abs(v);
  });
  quickGiveEl.textContent = fmtMoney(totals.give);
  quickGetEl.textContent = fmtMoney(totals.get);
  topTotalEl.textContent = fmtMoney(totals.get - totals.give);
}

function renderFromLocalCache(){
  localCustomers = loadLocal(LOCAL_CUSTOMERS, []);
  localTransactions = loadLocal(LOCAL_TRANSACTIONS, []);
  renderCustomers(localCustomers);
  refreshActiveCustomer();
}

function openCustomerUI(customer, customersArr=localCustomers, transactionsArr=localTransactions){
  activeCustomerId=customer.id;
  rightDefault.style.display='none';
  const all=transactionsArr.filter(t=>t.customerId===customer.id);
  const chronological=all.slice().sort((a,b)=>txTime(a)-txTime(b)||String(a.id).localeCompare(String(b.id)));
  const running=new Map();let balance=0;
  for(const t of chronological){balance+=txDelta(t);running.set(t.id,balance);}
  const byDay=new Map();
  for(const t of chronological){const key=dayKey(t);if(!byDay.has(key))byDay.set(key,{closing:0,given:0,received:0});const d=byDay.get(key);d.closing=running.get(t.id);d[t.type==='given'?'given':'received']+=Number(t.amount||0);}
  const filtered=chronological.filter(t=>(`${t.note||''} ${t.amount} ${dayKey(t)} ${t.type}`).toLowerCase().includes(txSearchText.toLowerCase()));
  const dates=[...new Set(filtered.map(dayKey))].sort().reverse();
  const groups=dates.map(key=>{
    const items=filtered.filter(t=>dayKey(t)===key).reverse();const day=byDay.get(key);
    return `<section class="day-group"><div class="day-heading"><strong>${escapeHTML(key)}</strong><span>Day closing: <b>${fmtMoney(day.closing)}</b></span></div><div class="day-subtotals">Gave ${fmtMoney(day.given)} · Got ${fmtMoney(day.received)}</div>${items.map(t=>`<article class="tx"><div class="tx-main"><div class="amount ${t.type==='given'?'green':'red'}">${t.type==='given'?'+':'−'} ${fmtMoney(t.amount)}</div><div class="note">${escapeHTML(t.note||'No note')}</div><div class="date">${fmtDate(t.date)}</div></div><div class="tx-right"><div class="running-label">CLR Balance</div><div class="running-value">${fmtMoney(running.get(t.id))}</div><div class="tx-actions"><button class="btn plain tiny edit-btn" data-id="${escapeHTML(t.id)}">Edit</button><button class="btn danger tiny delete-btn" data-id="${escapeHTML(t.id)}">Delete</button></div></div></article>`).join('')}</section>`;
  }).join('');
  rightContent.innerHTML=`<div class="customer-header"><div class="flex between"><div><h3><i class="fas fa-user"></i> ${escapeHTML(customer.name)}</h3><div class="muted small">${escapeHTML(customer.phone||'')}</div><div class="address muted">${escapeHTML(customer.address||'')}</div></div><button id="back-btn" class="btn plain small">Back</button></div></div><div id="cust-balance-block" class="balance-block"><div class="balance-display ${balance>0?'get-balance':balance<0?'give-balance':'settled-balance'}">${fmtMoney(Math.abs(balance))}<span class="balance-label">${balance>0?'You’ll Get':balance<0?'You’ll Give':'Settled'}</span></div></div><div class="action-buttons flex wrap gap-8"><button id="btn-give" class="btn success">+ You Gave</button><button id="btn-get" class="btn primary">− You Got</button><button id="btn-edit-cust" class="btn plain">Edit Customer</button><button id="btn-delete-cust" class="btn danger">Delete</button></div><div id="transaction-editor"></div><div class="transactions-section"><div class="history-header"><h3>Transaction History <span class="muted small">(${all.length})</span></h3><input id="tx-search" aria-label="Search transactions" placeholder="Search notes, amount, date…" value="${escapeHTML(txSearchText)}"></div><div id="tx-list" class="tx-scroll">${groups||'<div class="empty">No matching transactions</div>'}</div></div>`;
  $('#back-btn').onclick=()=>{activeCustomerId=null;rightContent.innerHTML='';rightDefault.style.display='';};
  $('#btn-give').onclick=()=>showTxForm(customer,'given');
  $('#btn-get').onclick=()=>showTxForm(customer,'received');
  $('#btn-edit-cust').onclick=()=>showEditCustomerForm(customer);
  $('#btn-delete-cust').onclick=async()=>{if(confirm('Delete customer and all transactions?')){await deleteCustomerCloud(customer.id);refreshActiveCustomer();}};
  $('#tx-search').oninput=e=>{txSearchText=e.target.value;const pos=e.target.selectionStart;openCustomerUI(customer,localCustomers,localTransactions);const input=$('#tx-search');input.focus();input.setSelectionRange(pos,pos);};
  $$('#tx-list .edit-btn').forEach(btn=>btn.onclick=()=>{const tx=all.find(t=>t.id===btn.dataset.id);if(tx)showEditTxForm(tx);});
  $$('#tx-list .delete-btn').forEach(btn=>btn.onclick=async()=>{if(confirm('Delete transaction?'))await deleteTransactionCloud(btn.dataset.id);});
}

function showAddCustomerUI(prefill = {}){
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div class="form-header">
      <div class="flex between">
        <h3><i class="fas fa-user-plus"></i> ${prefill.id ? 'Edit Customer' : 'Add Customer'}</h3>
        <button id="back-btn" class="btn plain small"><i class="fas fa-arrow-left"></i> Back</button>
      </div>
    </div>
    <div class="divider"></div>
    <form class="customer-form">
      <label>Name <span class="required">*</span></label>
      <input id="cust-name" value="${prefill.name || ''}" required />
      <label>Phone</label>
      <input id="cust-phone" value="${prefill.phone || ''}" type="tel" />
      <label>Address</label>
      <textarea id="cust-address" rows="3">${prefill.address || ''}</textarea>
      <div class="form-actions">
        <button type="button" id="cancel-cust" class="btn plain">Cancel</button>
        <button type="submit" id="save-cust" class="btn success">${prefill.id ? 'Update' : 'Save'}</button>
      </div>
    </form>
  `;
  $('#back-btn').addEventListener('click', () => { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#cancel-cust').addEventListener('click', () => { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('.customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#cust-name').value.trim();
    const phone = $('#cust-phone').value.trim();
    const address = $('#cust-address').value.trim();
    if(!name){ alert('Name required'); return; }
    const c = { id: prefill.id || uid(), name, phone, address, createdAt: prefill.createdAt || new Date().toISOString() };
    await saveCustomerToCloud(c);
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  });
}

function showEditCustomerForm(customer){
  showAddCustomerUI(customer);
}

function showTxForm(customer,type,existing=null){
 const host=$('#transaction-editor');if(!host)return;
 const stamp=existing?.date||new Date();
 host.innerHTML=`<div id="tx-form" class="tx-form"><h4>${existing?'Edit':'Add'} ${type==='given'?'You Gave':'You Got'}</h4><form id="tx-form-inner"><label>Amount<input id="tx-amount" type="number" step="0.01" min="0.01" required value="${existing?Number(existing.amount):''}"></label><label>Date and time<input id="tx-date" type="datetime-local" required value="${localDateTimeValue(stamp)}"></label><label>Type<select id="tx-type"><option value="given" ${type==='given'?'selected':''}>You Gave (+)</option><option value="received" ${type==='received'?'selected':''}>You Got (−)</option></select></label><label>Note<input id="tx-note" maxlength="300" placeholder="Optional note" value="${escapeHTML(existing?.note||'')}"></label><div class="form-actions"><button type="button" id="cancel-tx" class="btn plain">Cancel</button><button type="submit" class="btn success">${existing?'Save Changes':'Save Transaction'}</button></div></form></div>`;
 $('#cancel-tx').onclick=()=>host.innerHTML='';
 $('#tx-form-inner').onsubmit=async e=>{e.preventDefault();const amount=Number($('#tx-amount').value),date=new Date($('#tx-date').value);if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(date.getTime()))return alert('Enter a valid amount and date/time.');const btn=$('#tx-form-inner button[type=submit]');btn.disabled=true;const tx={...(existing||{}),id:existing?.id||uid(),customerId:customer.id,amount,type:$('#tx-type').value,note:$('#tx-note').value.trim(),date:date.toISOString(),createdAt:existing?.createdAt||new Date().toISOString()};try{await saveTransactionToCloud(tx);refreshActiveCustomer();}catch(err){btn.disabled=false;alert('Could not save transaction: '+err.message);}};
 $('#tx-amount').focus();
}
function showEditTxForm(tx){const customer=localCustomers.find(c=>c.id===tx.customerId);if(customer)showTxForm(customer,tx.type,tx);}

exportJsonBtn.addEventListener('click', () => {
  const data = { customers: loadLocal(LOCAL_CUSTOMERS, []), transactions: loadLocal(LOCAL_TRANSACTIONS, []) };
  const blob = new Blob([JSON.stringify(data, null,2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'credit-backup.json'; a.click();
});

importJsonBtnEl.addEventListener('click', () => importJsonFile.click());

importJsonFile.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    if(currentUser){
      const uid = currentUser.uid;
      const custCol = db.collection('users').doc(uid).collection('customers');
      const txCol = db.collection('users').doc(uid).collection('transactions');
      for(const c of obj.customers || []){ 
        const createdAt = c.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(c.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
        await custCol.doc(c.id || uid()).set({ ...c, createdAt }, { merge: true }); 
      }
      for(const t of obj.transactions || []){ 
        const createdAt = t.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(t.createdAt)) : firebase.firestore.FieldValue.serverTimestamp();
        await txCol.doc(t.id || uid()).set({ ...t, createdAt }, { merge: true }); 
      }
      alert('Imported to your cloud account.');
    } else {
      localCustomers = obj.customers || [];
      localTransactions = obj.transactions || [];
      saveLocal(LOCAL_CUSTOMERS, localCustomers);
      saveLocal(LOCAL_TRANSACTIONS, localTransactions);
      alert('Imported to local cache.');
      renderFromLocalCache();
    }
  }catch(err){ alert('Invalid JSON'); }
  e.target.value = '';
});

importCsvInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    parseCSVImport(ev.target.result);
    e.target.value = '';
  };
  reader.readAsText(f);
});

exportCustomersCsvBtn.addEventListener('click', () => {
  const custs = loadLocal(LOCAL_CUSTOMERS, []);
  let out = 'id,name,phone,address,createdAt\n';
  for(const c of custs) out += `"${c.id}","${c.name}","${c.phone}","${c.address}","${c.createdAt}"\n`;
  downloadCSV(out, 'customers.csv');
});

exportAllCsvBtn.addEventListener('click', () => {
  const custs = loadLocal(LOCAL_CUSTOMERS, []);
  const txs = loadLocal(LOCAL_TRANSACTIONS, []);
  let out = 'custName,phone,amount,type,note,date\n';
  for(const t of txs){
    const c = custs.find(x=>x.id===t.customerId) || {};
    out += `"${c.name||''}","${c.phone||''}",${t.amount},"${t.type}","${t.note || ''}","${t.date}"\n`;
  }
  downloadCSV(out, 'transactions.csv');
});

quickExportAllBtn.addEventListener('click', () => exportAllCsvBtn.click());

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function parseCSVRow(str) {
  const result = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      result.push(field.replace(/^"|"$/g, ''));
      field = '';
    } else field += char;
  }
  result.push(field.replace(/^"|"$/g, ''));
  return result;
}

function parseCSVImport(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if(lines.length < 1) { alert('Empty CSV'); return; }
  const headers = parseCSVRow(lines[0]);
  const rows = lines.slice(1).map(parseCSVRow);
  const headerLower = headers.map(h => h.toLowerCase());
  let imported = 0;
  if (headerLower.includes('name') && headerLower.includes('phone')) {
    rows.forEach(row => {
      const idIdx = headers.findIndex(h => h.toLowerCase() === 'id');
      const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
      const phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone');
      const addressIdx = headers.findIndex(h => h.toLowerCase() === 'address');
      const createdAtIdx = headers.findIndex(h => h.toLowerCase() === 'createdat');
      const id = idIdx !== -1 ? row[idIdx] : uid();
      const name = (nameIdx !== -1 ? row[nameIdx] : '').trim();
      const phone = (phoneIdx !== -1 ? row[phoneIdx] : '').trim();
      const address = (addressIdx !== -1 ? row[addressIdx] : '').trim();
      const createdAt = createdAtIdx !== -1 ? row[createdAtIdx] : new Date().toISOString();
      if (name && !localCustomers.find(c => c.name.toLowerCase() === name.toLowerCase() && c.phone === phone)) {
        localCustomers.push({ id, name, phone, address, createdAt });
        imported++;
      }
    });
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderFromLocalCache();
    alert(`${imported} customers imported.`);
  } else if (headerLower.includes('custname') && headerLower.includes('amount') && headerLower.includes('type')) {
    rows.forEach(row => {
      const custNameIdx = headers.findIndex(h => h.toLowerCase() === 'custname');
      const phoneIdx = headers.findIndex(h => h.toLowerCase() === 'phone');
      const amountIdx = headers.findIndex(h => h.toLowerCase() === 'amount');
      const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type');
      const noteIdx = headers.findIndex(h => h.toLowerCase() === 'note');
      const dateIdx = headers.findIndex(h => h.toLowerCase() === 'date');
      const custName = (custNameIdx !== -1 ? row[custNameIdx] : '').trim();
      const phone = (phoneIdx !== -1 ? row[phoneIdx] : '').trim();
      const amount = Number(amountIdx !== -1 ? row[amountIdx] : 0);
      const type = (typeIdx !== -1 ? row[typeIdx] : '').trim().toLowerCase();
      const note = (noteIdx !== -1 ? row[noteIdx] : '').trim();
      const date = dateIdx !== -1 ? row[dateIdx] : new Date().toISOString();
      if (amount > 0 && (type === 'given' || type === 'received') && custName) {
        let cust = localCustomers.find(c => c.name.toLowerCase() === custName.toLowerCase() && c.phone === phone);
        if (!cust) {
          cust = { id: uid(), name: custName, phone, address: '', createdAt: new Date().toISOString() };
          localCustomers.push(cust);
        }
        const tx = { id: uid(), customerId: cust.id, amount, type, note, date };
        localTransactions.unshift(tx);
        imported++;
      }
    });
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    alert(`${imported} transactions imported (missing customers created).`);
  } else {
    alert('CSV format not recognized. Use customers (name, phone, address) or transactions (custName, phone, amount, type, note, date).');
  }
}

renderFromLocalCache();
searchEl.addEventListener('input', debounce(() => renderCustomers(localCustomers), 300));
sortEl.addEventListener('change', () => renderCustomers(localCustomers));
window.addEventListener('storage', () => renderFromLocalCache());
