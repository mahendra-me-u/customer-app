/* ======================================================
   app.firebase.js
   Firebase Authentication (Email/Password) + Firestore
   ====================================================== */

/* ------------- CONFIG (REPLACE this) ---------------
   Get this from Firebase Console -> Project settings -> Your apps (Web)
   Example structure:
   const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "...",
     appId: "1:...:web:..."
   };
----------------------------------------------------- */
const firebaseConfig = {
  // <-- PASTE YOUR FIREBASE CONFIG HERE
    apiKey: "AIzaSyD7Puh6XMuuwOPu3U2zOoUWMBwQW04Z2tw",
  authDomain: "credit-app-f2c16.firebaseapp.com",
  projectId: "credit-app-f2c16",
  storageBucket: "credit-app-f2c16.firebasestorage.app",
  messagingSenderId: "1057636057228",
  appId: "1:1057636057228:web:9397f9a16b6d4925633ba9",
  measurementId: "G-QZM0880S42"
};

/* ------------------ Initialize Firebase ------------- */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ------------------ Local state & helpers ------------ */
let currentUser = null; // firebase user
let unsubCustomers = null;
let unsubTransactions = null;

const LOCAL_CUSTOMERS = 'cc_customers';
const LOCAL_TRANSACTIONS = 'cc_transactions';

/* ------------- Utility helpers ---------------------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function fmtMoney(n){ return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(n)||0); }
function fmtDate(iso){ try{return new Date(iso).toLocaleString();}catch(e){return iso;} }
function saveLocal(key, v){ localStorage.setItem(key, JSON.stringify(v)); }
function loadLocal(key, fallback){ try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;} }

/* ------------- DOM refs ------------------------------ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* auth elements */
const btnShowLogin = $('#btn-show-login');
const btnLogout = $('#btn-logout');
const authArea = $('#auth-area');

/* data UI */
const customerListEl = $('#customer-list');
const rightDefault = $('#right-default');
const rightContent = $('#right-content');
const searchEl = $('#search');
const sortEl = $('#sortBy');

const topTotalEl = $('#top-total');
const quickGiveEl = $('#quick-give');
const quickGetEl = $('#quick-get');

/* import/export elements */
const importJsonFile = $('#import-json-file');
const exportJsonBtn = $('#export-json');
const importCsvInput = $('#import-csv');
const exportCustomersCsvBtn = $('#export-customers-csv');
const exportAllCsvBtn = $('#export-csv-all');
const clearDataBtn = $('#clear-data');

/* quick add/open */
$('#open-add').addEventListener('click', ()=> showAddCustomerUI());
$('#quick-add-customer').addEventListener('click', ()=> showAddCustomerUI());

/* ------------- Local cache (used when logged out) ---- */
let localCustomers = loadLocal(LOCAL_CUSTOMERS, []);
let localTransactions = loadLocal(LOCAL_TRANSACTIONS, []);

/* ------------- AUTH UI: show login modal (simple) ---- */
btnShowLogin.addEventListener('click', () => showAuthUI());

btnLogout.addEventListener('click', async () => {
  await auth.signOut();
});

/* Show a simple auth UI inside right pane */
function showAuthUI(){
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>Sign In / Sign Up</h3>
        <button id="close-auth" class="btn-plain small">Close</button>
      </div>

      <div style="margin-top:10px">
        <label>Email</label>
        <input id="auth-email" type="email" placeholder="you@example.com" />

        <label style="margin-top:8px">Password</label>
        <input id="auth-pass" type="password" placeholder="password" />

        <div style="margin-top:10px;display:flex;gap:8px">
          <button id="auth-signin" class="btn-success">Sign in</button>
          <button id="auth-signup" class="btn-plain">Sign up</button>
        </div>

        <div class="small-muted" style="margin-top:10px">
          Signing up creates an account (email/password). Data will be synced to your account.
        </div>
      </div>
    </div>
  `;
  $('#close-auth').addEventListener('click', ()=> { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#auth-signin').addEventListener('click', handleSignIn);
  $('#auth-signup').addEventListener('click', handleSignUp);
}

/* ------------- Auth actions -------------------------- */
async function handleSignUp(){
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  if(!email || !pass){ alert('Enter email and password'); return; }
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    currentUser = cred.user;
    // after signup, create initial empty collections for user (optional)
    await initializeUserInFirestore(currentUser.uid);
    // merge local to cloud:
    await syncLocalToCloudAndReload();
    alert('Signup successful. Data merged.');
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  }catch(e){
    alert('Sign up error: '+ e.message);
  }
}

async function handleSignIn(){
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  if(!email || !pass){ alert('Enter email and password'); return; }
  try{
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    currentUser = cred.user;
    // merge local to cloud:
    await syncLocalToCloudAndReload();
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  }catch(e){
    alert('Sign in error: '+ e.message);
  }
}

/* called once after signup to optionally create user doc */
async function initializeUserInFirestore(uid){
  const userDoc = db.collection('users').doc(uid);
  const snap = await userDoc.get();
  if(!snap.exists){
    await userDoc.set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
}

/* ------------- SYNC logic --------------------------- */

/*
  Data model in Firestore:
  - users/{uid}/customers/{custId}  -> fields: id,name,phone,address,createdAt
  - users/{uid}/transactions/{txId} -> fields: id,customerId,amount,type,note,date
*/

/* On auth state change: subscribe/unsubscribe */
auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  if(currentUser){
    // UI: show logout
    btnShowLogin.style.display = 'none';
    btnLogout.style.display = '';
    // subscribe to user collections
    subscribeToUserData(currentUser.uid);
    // merge local cache into cloud
    // (we already did merge at sign-in; keep idempotent)
  } else {
    // not logged in
    btnShowLogin.style.display = '';
    btnLogout.style.display = 'none';
    // unsubscribe realtime listeners
    if(unsubCustomers){ unsubCustomers(); unsubCustomers = null; }
    if(unsubTransactions){ unsubTransactions(); unsubTransactions = null; }
    // load local cache to UI
    renderFromLocalCache();
  }
});

/* subscribe to Firestore collections and setup realtime listeners */
function subscribeToUserData(uid){
  // unsubscribe previous
  if(unsubCustomers){ unsubCustomers(); unsubCustomers=null; }
  if(unsubTransactions){ unsubTransactions(); unsubTransactions=null; }

  const custRef = db.collection('users').doc(uid).collection('customers');
  const txRef = db.collection('users').doc(uid).collection('transactions');

  unsubCustomers = custRef.onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => arr.push(doc.data()));
    localCustomers = arr; // keep a local mirror
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderCustomers(localCustomers);
  }, err => {
    console.error('customers snapshot error', err);
  });

  unsubTransactions = txRef.onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => arr.push(doc.data()));
    localTransactions = arr;
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderCustomers(localCustomers); // transactions affect balances
  }, err => {
    console.error('transactions snapshot error', err);
  });
}

/* Merge local data (from anonymous use) to cloud on sign-in/signup.
   This function will push any local items that don't exist in cloud.
*/
async function syncLocalToCloudAndReload(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const cusCol = db.collection('users').doc(uid).collection('customers');
  const txCol = db.collection('users').doc(uid).collection('transactions');

  // fetch cloud current ids
  const [cloudCustSnap, cloudTxSnap] = await Promise.all([cusCol.get(), txCol.get()]);
  const cloudCustIds = new Set(cloudCustSnap.docs.map(d => d.id));
  const cloudTxIds = new Set(cloudTxSnap.docs.map(d => d.id));

  // push localCustomers not in cloud
  for(const c of localCustomers){
    if(!c.id) c.id = uid() + '_' + uid();
    if(!cloudCustIds.has(c.id)){
      await cusCol.doc(c.id).set(c);
    }
  }
  // push localTransactions not in cloud
  for(const t of localTransactions){
    if(!t.id) t.id = uid() + '_' + (t.customerId || '') + '_' + Date.now();
    if(!cloudTxIds.has(t.id)){
      await txCol.doc(t.id).set(t);
    }
  }

  // clear local cache (we'll rely on cloud as source of truth)
  localCustomers = [];
  localTransactions = [];
  saveLocal(LOCAL_CUSTOMERS, []);
  saveLocal(LOCAL_TRANSACTIONS, []);
}

/* ------------- CRUD: customers & transactions (cloud-first) ------------- */

/* create or update customer */
async function saveCustomerToCloud(customer){
  if(!currentUser) {
    // local-only
    if(!customer.id) customer.id = uid();
    // upsert local
    const idx = localCustomers.findIndex(c => c.id === customer.id);
    if(idx === -1) localCustomers.unshift(customer);
    else localCustomers[idx] = customer;
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderFromLocalCache();
    return;
  }
  // cloud
  const docRef = db.collection('users').doc(currentUser.uid).collection('customers').doc(customer.id || uid());
  if(!customer.id) customer.id = docRef.id;
  await docRef.set(Object.assign({}, customer, { createdAt: customer.createdAt || firebase.firestore.FieldValue.serverTimestamp() }), { merge: true });
}

/* delete customer and their transactions */
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
  // delete customer doc
  await custDoc.delete();
  // delete transactions for this customer
  const txSnap = await txCol.where('customerId', '==', customerId).get();
  const batch = db.batch();
  txSnap.forEach(td => batch.delete(td.ref));
  await batch.commit();
}

/* create transaction */
async function saveTransactionToCloud(tx){
  if(!currentUser){
    if(!tx.id) tx.id = uid();
    localTransactions.unshift(tx);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    return;
  }
  const docRef = db.collection('users').doc(currentUser.uid).collection('transactions').doc(tx.id || uid());
  if(!tx.id) tx.id = docRef.id;
  await docRef.set(Object.assign({}, tx, { createdAt: tx.createdAt || firebase.firestore.FieldValue.serverTimestamp() }));
}

/* delete transaction */
async function deleteTransactionCloud(txId){
  if(!currentUser){
    localTransactions = localTransactions.filter(t => t.id !== txId);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
    return;
  }
  await db.collection('users').doc(currentUser.uid).collection('transactions').doc(txId).delete();
}

/* ------------- RENDER helpers ------------------------- */

function computeBalances(customersArr, transactionsArr){
  const balances = {};
  for(const c of customersArr){ balances[c.id] = 0; }
  for(const t of transactionsArr){
    if(!balances.hasOwnProperty(t.customerId)) balances[t.customerId] = 0;
    // tx.type expected 'given' or 'received'
    if(t.type === 'given') balances[t.customerId] += Number(t.amount || 0);
    else balances[t.customerId] -= Number(t.amount || 0);
  }
  return balances;
}

function renderCustomers(customersArr){
  const customersList = customersArr || loadLocal(LOCAL_CUSTOMERS, []);
  const transactionsList = (currentUser ? localTransactions : loadLocal(LOCAL_TRANSACTIONS, [])) || [];
  const balances = computeBalances(customersList, transactionsList);

  // render list
  customerListEl.innerHTML = '';
  const q = (searchEl.value || '').toLowerCase();

  const filtered = (customersList || []).filter(c => {
    return !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const bal = balances[c.id] || 0;
    item.innerHTML = `
      <div style="flex:1">
        <div class="customer-name">${c.name || ''}</div>
        <div class="customer-phone">${c.phone || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="customer-balance">${fmtMoney(Math.abs(bal))}</div>
        <div class="tag">${bal>0? "You'll give": bal<0? "You'll get": "Settled"}</div>
      </div>
    `;
    item.addEventListener('click', ()=> openCustomerUI(c, customersList, transactionsList));
    customerListEl.appendChild(item);
  });

  // totals
  const totals = { give:0, get:0 };
  for(const cid in balances){
    const v = balances[cid];
    if(v>0) totals.get += v; else totals.give += Math.abs(v);
  }
  quickGiveEl.textContent = fmtMoney(totals.give);
  quickGetEl.textContent = fmtMoney(totals.get);
  topTotalEl.textContent = fmtMoney(totals.get - totals.give);
}

/* When not logged in, render from local cache */
function renderFromLocalCache(){
  renderCustomers(localCustomers);
}

/* ------------- UI: customer detail view --------------- */
function openCustomerUI(customer, customersArr, transactionsArr){
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h3>${customer.name}</h3>
        <div class="muted small">${customer.phone || ''}</div>
      </div>
      <div>
        <button id="back-btn" class="btn-plain small">← Back</button>
      </div>
    </div>

    <div class="divider"></div>

    <div id="cust-balance-block" style="margin-top:8px">
      <!-- balance filled by script -->
    </div>

    <div style="margin-top:12px;display:flex;gap:8px">
      <button id="btn-give" class="btn-success">You Gave</button>
      <button id="btn-get" class="btn-plain">You Got</button>
      <button id="btn-edit-cust" class="btn-plain">Edit</button>
      <button id="btn-delete-cust" class="btn-danger">Delete</button>
    </div>

    <div class="divider" style="margin-top:12px"></div>

    <div id="tx-list" class="space-y"></div>
  `;

  $('#back-btn').addEventListener('click', ()=> { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#btn-give').addEventListener('click', ()=> showTxForm(customer, 'given'));
  $('#btn-get').addEventListener('click', ()=> showTxForm(customer, 'received'));
  $('#btn-edit-cust').addEventListener('click', ()=> showEditCustomerForm(customer));
  $('#btn-delete-cust').addEventListener('click', async ()=> {
    if(!confirm('Delete customer and their transactions?')) return;
    await deleteCustomerCloud(customer.id);
  });

  // render balance and transactions
  const custTx = (currentUser ? localTransactions : localTransactions).filter(t => t.customerId === customer.id).sort((a,b)=> new Date(b.date) - new Date(a.date));
  const bal = computeBalances([customer], custTx)[customer.id] || 0;
  $('#cust-balance-block').innerHTML = `<div style="font-weight:700">Balance: ${fmtMoney(Math.abs(bal))} (${bal>0? "You'll give": bal<0? "You'll get": "Settled"})</div>`;

  const txListEl = $('#tx-list');
  txListEl.innerHTML = '';
  if(custTx.length === 0){
    txListEl.innerHTML = `<div class="empty">No transactions yet</div>`;
  } else {
    for(const t of custTx){
      const el = document.createElement('div');
      el.className = 'tx';
      el.innerHTML = `
        <div>
          <div class="${t.type==='given'?'amount green':'amount red'}">${t.type==='given'?'+':'-'} ${fmtMoney(t.amount)}</div>
          <div class="note">${t.note || ''}</div>
        </div>
        <div style="text-align:right">
          <div class="date">${fmtDate(t.date)}</div>
          <div style="margin-top:6px">
            <button class="btn-plain tx-edit" data-id="${t.id}">Edit</button>
            <button class="btn-plain tx-delete" data-id="${t.id}">Delete</button>
          </div>
        </div>
      `;
      txListEl.appendChild(el);
      // attach edit/delete handlers
      el.querySelector('.tx-delete').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if(!confirm('Delete transaction?')) return;
        await deleteTransactionCloud(t.id);
      });
      el.querySelector('.tx-edit').addEventListener('click', (ev) => {
        ev.stopPropagation();
        showEditTxForm(t);
      });
    }
  }
}

/* ------------- UI: add/edit forms ------------------- */
function showAddCustomerUI(prefill = {}){
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3>${prefill.id ? 'Edit Customer' : 'Add Customer'}</h3>
      <button id="back-btn" class="btn-plain small">← Back</button>
    </div>
    <div class="divider"></div>

    <div style="margin-top:8px">
      <label>Name</label>
      <input id="cust-name" value="${prefill.name || ''}" />
      <label style="margin-top:8px">Phone</label>
      <input id="cust-phone" value="${prefill.phone || ''}" />
      <label style="margin-top:8px">Address</label>
      <textarea id="cust-address">${prefill.address || ''}</textarea>

      <div style="margin-top:10px">
        <button id="save-cust" class="btn-success">${prefill.id ? 'Update' : 'Save'}</button>
        <button id="cancel-cust" class="btn-plain">Cancel</button>
      </div>
    </div>
  `;
  $('#back-btn').addEventListener('click', ()=> { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#cancel-cust').addEventListener('click', ()=> { rightContent.innerHTML=''; rightDefault.style.display=''; });
  $('#save-cust').addEventListener('click', async ()=>{
    const name = $('#cust-name').value.trim();
    const phone = $('#cust-phone').value.trim();
    const address = $('#cust-address').value.trim();
    if(!name){ alert('Name required'); return; }
    const c = { id: prefill.id || uid(), name, phone, address, createdAt: new Date().toISOString() };
    await saveCustomerToCloud(c);
  });
}

function showEditCustomerForm(customer){
  showAddCustomerUI(customer);
}

function showTxForm(customer, type){
  rightContent.innerHTML += `
    <div style="margin-top:12px" id="tx-form">
      <label>Amount</label>
      <input id="tx-amount" type="number" step="0.01" />
      <label>Note</label>
      <input id="tx-note" />
      <div style="margin-top:8px">
        <button id="save-tx" class="btn-success">Save</button>
        <button id="cancel-tx" class="btn-plain">Cancel</button>
      </div>
    </div>
  `;
  $('#cancel-tx').addEventListener('click', ()=> { const f = $('#tx-form'); if(f) f.remove(); });
  $('#save-tx').addEventListener('click', async ()=>{
    const amt = Number($('#tx-amount').value);
    const note = $('#tx-note').value.trim();
    if(!amt || amt <= 0){ alert('Enter valid amount'); return; }
    const tx = { id: uid(), customerId: customer.id, amount: amt, type: type, note, date: new Date().toISOString() };
    await saveTransactionToCloud(tx);
    const form = $('#tx-form'); if(form) form.remove();
  });
}

function showEditTxForm(tx){
  // simple prompt-based edit
  const newNote = prompt('Edit note', tx.note || '');
  if(newNote === null) return;
  const newAmt = prompt('Edit amount', tx.amount);
  if(newAmt === null) return;
  tx.note = newNote;
  tx.amount = Number(newAmt) || tx.amount;
  saveTransactionToCloud(tx);
}

/* ------------- Import/Export JSON & CSV --------------- */
exportJsonBtn.addEventListener('click', ()=>{
  const data = { customers: loadLocal(LOCAL_CUSTOMERS, []), transactions: loadLocal(LOCAL_TRANSACTIONS, []) };
  const blob = new Blob([JSON.stringify(data, null,2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'backup.json'; a.click();
});

importJsonFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    // if logged in push to cloud, else store locally
    if(currentUser){
      // merge into cloud
      const uid = currentUser.uid;
      const custCol = db.collection('users').doc(uid).collection('customers');
      const txCol = db.collection('users').doc(uid).collection('transactions');
      for(const c of obj.customers || []){ await custCol.doc(c.id || uid()).set(c); }
      for(const t of obj.transactions || []){ await txCol.doc(t.id || uid()).set(t); }
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

importCsvInput.addEventListener('change', (e)=> {
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev)=> {
    parseCSVImport(ev.target.result);
    e.target.value = '';
  };
  reader.readAsText(f);
});

exportCustomersCsvBtn.addEventListener('click', ()=>{
  const custs = loadLocal(LOCAL_CUSTOMERS, []);
  let out = 'id,name,phone,address,createdAt\n';
  for(const c of custs) out += `${c.id},"${c.name}","${c.phone}","${c.address}",${c.createdAt}\n`;
  const blob = new Blob([out], { type:'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'customers.csv'; a.click();
});

exportAllCsvBtn.addEventListener('click', ()=>{
  const custs = loadLocal(LOCAL_CUSTOMERS, []);
  const txs = loadLocal(LOCAL_TRANSACTIONS, []);
  let out = 'custName,phone,amount,type,note,date\n';
  for(const t of txs){
    const c = custs.find(x=>x.id===t.customerId) || {};
    out += `"${c.name||''}","${c.phone||''}",${t.amount},"${t.type}","${t.note}",${t.date}\n`;
  }
  const blob = new Blob([out], { type:'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transactions.csv'; a.click();
});

clearDataBtn.addEventListener('click', ()=>{
  if(!confirm('Clear local cache?')) return;
  localCustomers = []; localTransactions = [];
  saveLocal(LOCAL_CUSTOMERS, []); saveLocal(LOCAL_TRANSACTIONS, []);
  renderFromLocalCache();
});

/* very simple CSV parser, used for imports */
function parseCSVImport(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  if(lines.length<1) { alert('Empty CSV'); return; }
  const cols = lines[0].split(',').map(c=>c.trim().toLowerCase());
  // naive: if header includes name and phone => customers
  if(cols.includes('name') && cols.includes('phone')){
    const rows = lines.slice(1).map(l => l.split(','));
    for(const r of rows){
      const [id,name,phone,address,createdAt] = r;
      localCustomers.push({ id: id||uid(), name: (name||'').replace(/^"|"$/g,''), phone: (phone||''), address:(address||''), createdAt:createdAt||new Date().toISOString() });
    }
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    alert('Imported customers into local cache.');
    renderFromLocalCache();
    return;
  }
  alert('CSV format not recognized.');
}

/* ------------- local rendering on load ------------- */
function renderFromLocalCache(){
  // read local storage then render
  localCustomers = loadLocal(LOCAL_CUSTOMERS, localCustomers);
  localTransactions = loadLocal(LOCAL_TRANSACTIONS, localTransactions);
  renderCustomers(localCustomers);
}

/* ------------- simple wrappers for cloud/local saves ----- */
async function saveCustomerToCloud(c){
  await saveCustomerToCloudInternal(c);
}
async function saveCustomerToCloudInternal(customer){
  if(!customer.id) customer.id = uid();
  if(currentUser){
    const ref = db.collection('users').doc(currentUser.uid).collection('customers').doc(customer.id);
    await ref.set(Object.assign({}, customer, { createdAt: customer.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(customer.createdAt)) : firebase.firestore.FieldValue.serverTimestamp() }), { merge: true });
  } else {
    // local
    const idx = localCustomers.findIndex(x=>x.id === customer.id);
    if(idx === -1) localCustomers.unshift(customer); else localCustomers[idx] = customer;
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    renderFromLocalCache();
  }
}

async function saveTransactionToCloud(tx){
  if(!tx.id) tx.id = uid();
  if(currentUser){
    const ref = db.collection('users').doc(currentUser.uid).collection('transactions').doc(tx.id);
    await ref.set(Object.assign({}, tx, { createdAt: tx.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(tx.createdAt)) : firebase.firestore.FieldValue.serverTimestamp() }));
  } else {
    localTransactions.unshift(tx);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
  }
}

/* delete helpers */
async function deleteCustomerCloud(id){
  if(currentUser){
    // delete customer doc
    const custRef = db.collection('users').doc(currentUser.uid).collection('customers').doc(id);
    await custRef.delete();
    // delete transactions batch
    const txCol = db.collection('users').doc(currentUser.uid).collection('transactions');
    const snap = await txCol.where('customerId','==',id).get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    localCustomers = localCustomers.filter(c=>c.id !== id);
    localTransactions = localTransactions.filter(t=>t.customerId !== id);
    saveLocal(LOCAL_CUSTOMERS, localCustomers);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
  }
}

async function deleteTransactionCloud(txId){
  if(currentUser){
    await db.collection('users').doc(currentUser.uid).collection('transactions').doc(txId).delete();
  } else {
    localTransactions = localTransactions.filter(t=>t.id !== txId);
    saveLocal(LOCAL_TRANSACTIONS, localTransactions);
    renderFromLocalCache();
  }
}

/* ------------- init ------------- */
renderFromLocalCache();

/* Attach search/sort events */
searchEl.addEventListener('input', ()=> renderFromLocalCache());
sortEl.addEventListener('change', ()=> renderFromLocalCache());

/* listen for storage updates from other tabs */
window.addEventListener('storage', ()=> renderFromLocalCache());
