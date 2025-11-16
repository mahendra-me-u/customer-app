/* =========================
   Credit Manager — Vanilla JS
   ========================= */

// ---- Storage keys ----
const KEY_CUSTOMERS = 'cc_customers';
const KEY_TRANSACTIONS = 'cc_transactions';

// ---- App state ----
let customers = [];     // array of {id,name,phone,address,createdAt}
let transactions = [];  // array of {id,customerId,amount,type,note,date}
let selectedCustomerId = null;

// ---- DOM references ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const customerListEl = $('#customer-list');
const searchEl = $('#search');
const sortEl = $('#sortBy');
const topTotalEl = $('#top-total');
const quickGiveEl = $('#quick-give');
const quickGetEl = $('#quick-get');
const rightContent = $('#right-content');
const rightDefault = $('#right-default');

// ---- Utilities ----
function uid(){ // simple unique id
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2,8);
  return `${a}-${b}`;
}
function load(){
  try {
    customers = JSON.parse(localStorage.getItem(KEY_CUSTOMERS) || '[]');
    transactions = JSON.parse(localStorage.getItem(KEY_TRANSACTIONS) || '[]');
  } catch(e){
    console.error('load error', e);
    customers = []; transactions = [];
  }
}
function save(){
  localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(customers));
  localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(transactions));
  renderAll();
}
function clearAll(confirmNeeded = true){
  if(confirmNeeded){
    if(!confirm('This will permanently delete ALL saved customers & transactions. Proceed?')) return;
  }
  customers = []; transactions = []; selectedCustomerId = null;
  save();
}
function fmtCurrency(n){
  const num = Number(n) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
}
function fmtDate(iso){
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  } catch(e){
    return iso;
  }
}
function customerBalance(customerId){
  return transactions
    .filter(t => t.customerId === customerId)
    .reduce((acc, t) => {
      const amt = Number(t.amount) || 0;
      return acc + (t.type === 'given' ? amt : -amt);
    }, 0);
}
function totals(){
  const totalGive = customers.reduce((acc,c) => {
    const b = customerBalance(c.id); return acc + (b > 0 ? b : 0);
  }, 0);
  const totalGet = customers.reduce((acc,c) => {
    const b = customerBalance(c.id); return acc + (b < 0 ? Math.abs(b) : 0);
  }, 0);
  const net = totalGive - totalGet;
  return { totalGive, totalGet, net };
}

// ---- Render list ----
function renderCustomerList(){
  const q = (searchEl.value || '').trim().toLowerCase();
  let list = customers.slice();

  if(q) {
    list = list.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q));
  }

  const sortBy = sortEl ? sortEl.value : 'recent';
  if(sortBy === 'recent') list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if(sortBy === 'balanceDesc') list.sort((a,b) => customerBalance(b.id) - customerBalance(a.id));
  else if(sortBy === 'balanceAsc') list.sort((a,b) => customerBalance(a.id) - customerBalance(b.id));
  else if(sortBy === 'nameAsc') list.sort((a,b) => a.name.localeCompare(b.name));
  else if(sortBy === 'nameDesc') list.sort((a,b) => b.name.localeCompare(a.name));

  customerListEl.innerHTML = '';
  if(list.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = q ? 'No customers found' : 'No customers added yet';
    customerListEl.appendChild(empty);
    return;
  }

  for(const c of list){
    const bal = customerBalance(c.id);
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.id = c.id;
    item.innerHTML = `
      <div class="item-left">
        <div class="avatar">${(c.name||'').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase()}</div>
        <div>
          <div class="item-title">${escapeHtml(c.name)}</div>
          <div class="item-sub">${escapeHtml(c.phone || '')}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="amount ${bal>0?'green':bal<0?'red':''}">${fmtCurrency(Math.abs(bal))}</div>
        <div class="tag">${bal>0? "You'll give" : bal<0? "You'll get" : "Settled"}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      openCustomerDetail(c.id);
    });
    customerListEl.appendChild(item);
  }
}

// ---- Render right pane (detail / add / edit) ----
function openCustomerDetail(id){
  selectedCustomerId = id;
  rightDefault.style.display = 'none';
  renderCustomerDetail();
}
function renderCustomerDetail(){
  const c = customers.find(x => x.id === selectedCustomerId);
  if(!c){
    rightContent.innerHTML = '<div class="muted">Customer not found</div>';
    return;
  }
  const custTx = transactions.filter(t => t.customerId === c.id).sort((a,b) => new Date(b.date) - new Date(a.date));
  const bal = customerBalance(c.id);

  rightContent.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font-weight:800;font-size:18px">${escapeHtml(c.name)}</div>
          <div class="muted small">${escapeHtml(c.phone || '')}</div>
          ${c.address ? `<div class="muted small" style="margin-top:6px">${escapeHtml(c.address)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="small-muted">Current Balance</div>
          <div style="font-weight:800;font-size:18px" class="${bal>0?'amount green':bal<0?'amount red':''}">${fmtCurrency(Math.abs(bal))}</div>
          <div class="small-muted">${bal>0? "You'll give" : bal<0? "You'll get" : "Settled"}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="divider"></div>

      <div style="display:flex;gap:8px;margin-top:10px">
        <button id="btn-add-give" class="btn-success" style="flex:1">You Gave</button>
        <button id="btn-add-recv" class="btn-plain" style="flex:1;background:#f8fafc">You Got</button>
      </div>

      <div id="tx-form-area" style="margin-top:12px"></div>

      <div style="margin-top:12px" class="muted small">Transactions (${custTx.length})</div>
      <div style="margin-top:10px" id="tx-list"></div>

      <div style="margin-top:12px;display:flex;gap:8px">
        <button id="btn-edit-customer" class="btn-plain">Edit Customer</button>
        <button id="btn-export-csv" class="btn-plain">Export CSV</button>
        <button id="btn-delete-customer" class="btn-danger">Delete Customer</button>
      </div>
    </div>
  `;

  const txListEl = $('#tx-list');
  if(custTx.length === 0){
    txListEl.innerHTML = `<div class="empty">No transactions yet</div>`;
  } else {
    txListEl.innerHTML = custTx.map(t => `
      <div class="tx" data-id="${t.id}">
        <div>
          <div class="${t.type==='given'?'amount green':'amount red'}">${t.type==='given'?'+':'-'} ${fmtCurrency(t.amount)}</div>
          <div class="note">${escapeHtml(t.note || '')}</div>
        </div>
        <div style="text-align:right">
          <div class="meta">${fmtDate(t.date)}</div>
          <div style="margin-top:6px">
            <button class="btn-plain tx-edit" data-id="${t.id}">Edit</button>
            <button class="btn-plain tx-delete" data-id="${t.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
    $$('.tx-edit').forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const txid = b.dataset.id;
      showEditTxForm(txid);
    }));
    $$('.tx-delete').forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const txid = b.dataset.id;
      deleteTransaction(txid);
    }));
  }

  $('#btn-add-give').addEventListener('click', () => showAddTxForm('given'));
  $('#btn-add-recv').addEventListener('click', () => showAddTxForm('received'));
  $('#btn-edit-customer').addEventListener('click', () => showEditCustomerForm(c.id));
  $('#btn-delete-customer').addEventListener('click', () => deleteCustomer(c.id));
  $('#btn-export-csv').addEventListener('click', () => exportCustomerCSV(c.id));
}

// ---- Forms: add/edit customer ----
function showAddCustomerForm(prefill = {}) {
  rightDefault.style.display = 'none';
  rightContent.innerHTML = `
    <div>
      <div style="font-weight:700">Add Customer</div>
      <form id="form-add-cust" style="margin-top:10px">
        <div class="space-y">
          <div>
            <label>Name *</label>
            <input id="cust-name" type="text" value="${escapeHtml(prefill.name||'')}" required />
          </div>
          <div>
            <label>Phone *</label>
            <input id="cust-phone" type="tel" value="${escapeHtml(prefill.phone||'')}" required />
          </div>
          <div>
            <label>Address (optional)</label>
            <textarea id="cust-address" rows="3">${escapeHtml(prefill.address||'')}</textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-success" type="submit">Save</button>
            <button type="button" id="cancel-add" class="btn-plain">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  `;
  $('#cancel-add').addEventListener('click', () => {
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  });
  $('#form-add-cust').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cust-name').value.trim();
    const phone = $('#cust-phone').value.trim();
    const address = $('#cust-address').value.trim();
    if(!name || !phone){ alert('Name and phone are required'); return; }
    const newCust = { id: uid(), name, phone, address, createdAt: new Date().toISOString() };
    customers.unshift(newCust);
    save();
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  });
}

function showEditCustomerForm(id){
  const c = customers.find(x => x.id === id);
  if(!c) return;
  rightContent.innerHTML = `
    <div>
      <div style="font-weight:700">Edit Customer</div>
      <form id="form-edit-cust" style="margin-top:10px">
        <div class="space-y">
          <div>
            <label>Name *</label>
            <input id="edit-name" type="text" value="${escapeHtml(c.name)}" required />
          </div>
          <div>
            <label>Phone *</label>
            <input id="edit-phone" type="tel" value="${escapeHtml(c.phone)}" required />
          </div>
          <div>
            <label>Address (optional)</label>
            <textarea id="edit-address" rows="3">${escapeHtml(c.address||'')}</textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-success" type="submit">Update</button>
            <button id="cancel-edit" type="button" class="btn-plain">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  `;
  $('#cancel-edit').addEventListener('click', () => renderCustomerDetail());
  $('#form-edit-cust').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#edit-name').value.trim();
    const phone = $('#edit-phone').value.trim();
    const address = $('#edit-address').value.trim();
    if(!name || !phone){ alert('Name and phone are required'); return; }
    Object.assign(c, { name, phone, address });
    save();
    renderCustomerDetail();
  });
}

// ---- Transaction forms ----
function showAddTxForm(defaultType = 'given'){
  const c = customers.find(x => x.id === selectedCustomerId);
  if(!c) return;
  $('#tx-form-area').innerHTML = `
    <form id="tx-form" style="margin-top:10px">
      <div class="space-y">
        <div>
          <label>Amount *</label>
          <input id="tx-amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div>
          <label>Note</label>
          <input id="tx-note" type="text" />
        </div>
        <div>
          <label>Type</label>
          <select id="tx-type">
            <option value="given">You Gave (customer owes)</option>
            <option value="received">You Got (customer paid)</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-success" type="submit">Save Transaction</button>
          <button id="tx-cancel" type="button" class="btn-plain">Cancel</button>
        </div>
      </div>
    </form>
  `;
  $('#tx-type').value = defaultType;
  $('#tx-cancel').addEventListener('click', () => { $('#tx-form-area').innerHTML = ''; });
  $('#tx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amt = Number($('#tx-amount').value);
    if(!amt || amt <= 0){ alert('Enter valid amount'); return; }
    const tx = { id: uid(), customerId: c.id, amount: Math.round(amt*100)/100, type: $('#tx-type').value, note: $('#tx-note').value.trim(), date: new Date().toISOString() };
    transactions.unshift(tx);
    save();
    $('#tx-form-area').innerHTML = '';
    renderCustomerDetail();
    renderCustomerList();
  });
}

function showEditTxForm(txid){
  const tx = transactions.find(t => t.id === txid);
  if(!tx){ alert('Transaction not found'); return; }
  $('#tx-form-area').innerHTML = `
    <form id="tx-edit-form" style="margin-top:10px">
      <div class="space-y">
        <div>
          <label>Amount *</label>
          <input id="edit-amt" type="number" step="0.01" value="${tx.amount}" required />
        </div>
        <div>
          <label>Note</label>
          <input id="edit-note" type="text" value="${escapeHtml(tx.note||'')}" />
        </div>
        <div>
          <label>Type</label>
          <select id="edit-type">
            <option value="given">You Gave (customer owes)</option>
            <option value="received">You Got (customer paid)</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-success" type="submit">Update</button>
          <button id="cancel-edit-tx" type="button" class="btn-plain">Cancel</button>
        </div>
      </div>
    </form>
  `;
  $('#edit-type').value = tx.type;
  $('#cancel-edit-tx').addEventListener('click', () => { $('#tx-form-area').innerHTML = ''; });
  $('#tx-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amt = Number($('#edit-amt').value);
    if(!amt || amt <= 0){ alert('Enter valid amount'); return; }
    tx.amount = Math.round(amt*100)/100;
    tx.note = $('#edit-note').value.trim();
    tx.type = $('#edit-type').value;
    save();
    $('#tx-form-area').innerHTML = '';
    renderCustomerDetail();
    renderCustomerList();
  });
}

function deleteTransaction(txid){
  if(!confirm('Delete this transaction? This cannot be undone.')) return;
  const idx = transactions.findIndex(t => t.id === txid);
  if(idx === -1) return;
  transactions.splice(idx,1);
  save();
  renderCustomerDetail();
  renderCustomerList();
}

// ---- Customer delete ----
function deleteCustomer(id){
  if(!confirm('Delete this customer and ALL their transactions? This cannot be undone.')) return;
  customers = customers.filter(c => c.id !== id);
  transactions = transactions.filter(t => t.customerId !== id);
  selectedCustomerId = null;
  save();
}

// ---- Export / Import CSV & JSON ----
function exportAllCSV(){
  let out = 'customers_id,name,phone,address,createdAt\n';
  for(const c of customers){
    out += `${csvSafe(c.id)},${csvSafe(c.name)},${csvSafe(c.phone)},${csvSafe(c.address)},${csvSafe(c.createdAt)}\n`;
  }
  out += `\ntransactions_id,id,customerId,amount,type,note,date\n`;
  for(const t of transactions){
    out += `${csvSafe(t.id)},${csvSafe(t.id)},${csvSafe(t.customerId)},${t.amount},${t.type},${csvSafe(t.note)},${csvSafe(t.date)}\n`;
  }
  downloadBlob(out, 'credit-manager-all.csv', 'text/csv');
}

function exportCustomerCSV(customerId){
  const c = customers.find(x => x.id === customerId);
  if(!c) return;
  let out = 'id,customerId,amount,type,note,date\n';
  for(const t of transactions.filter(x => x.customerId === customerId).sort((a,b)=> new Date(b.date)-new Date(a.date))){
    out += `${csvSafe(t.id)},${csvSafe(t.customerId)},${t.amount},${t.type},${csvSafe(t.note)},${csvSafe(t.date)}\n`;
  }
  downloadBlob(out, `transactions-${sanitizeFilename(c.name||'customer')}.csv`, 'text/csv');
}

function exportCustomersCSV(){
  let out = 'id,name,phone,address,createdAt\n';
  for(const c of customers) out += `${csvSafe(c.id)},${csvSafe(c.name)},${csvSafe(c.phone)},${csvSafe(c.address)},${csvSafe(c.createdAt)}\n`;
  downloadBlob(out, 'customers.csv', 'text/csv');
}

function csvSafe(v){
  if(v === null || v === undefined) return '';
  const s = String(v);
  if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

function downloadBlob(text, filename, type = 'text/plain'){
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

function handleImportCSV(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseCSVImport(text);
  };
  reader.readAsText(file, 'utf-8');
}
function parseCSVImport(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(lines.length === 0){ alert('No data found'); return; }
  const header = lines[0].toLowerCase();
  if(header.includes('name') && header.includes('phone')) {
    for(let i=1;i<lines.length;i++){
      const cols = parseCSVLine(lines[i]);
      if(cols.length >= 2){
        const id = cols[0] || uid();
        const name = cols[1] || '';
        const phone = cols[2] || '';
        const address = cols[3] || '';
        const createdAt = cols[4] || new Date().toISOString();
        if(!customers.some(c => c.name === name && c.phone === phone)){
          customers.push({ id, name, phone, address, createdAt });
        }
      }
    }
    save();
    alert('Customers imported (duplicates skipped).');
  } else if(header.includes('customerid') || header.includes('amount')) {
    for(let i=1;i<lines.length;i++){
      const cols = parseCSVLine(lines[i]);
      if(cols.length >= 4){
        const id = cols[0] || uid();
        const customerId = cols[1];
        const amount = Number(cols[2]) || 0;
        const type = (cols[3] || 'given');
        const note = cols[4] || '';
        const date = cols[5] || new Date().toISOString();
        if(customers.some(c => c.id === customerId)){
          transactions.push({ id, customerId, amount: Math.round(amount*100)/100, type, note, date });
        }
      }
    }
    save();
    alert('Transactions imported (only for matching customer IDs).');
  } else {
    alert('CSV format not recognized. Provide customers CSV or transactions CSV with headers.');
  }
}
function parseCSVLine(line){
  const res = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"' && !inQuotes){ inQuotes = true; continue; }
    if(ch === '"' && inQuotes){
      if(line[i+1] === '"'){ cur += '"'; i++; continue; }
      inQuotes = false; continue;
    }
    if(ch === ',' && !inQuotes){ res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res.map(s => s.trim());
}

function exportJSONBackup(){
  const blob = JSON.stringify({ customers, transactions }, null, 2);
  downloadBlob(blob, 'credit-manager-backup.json', 'application/json');
}
function handleImportJSON(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);
      if(obj.customers && obj.transactions){
        if(confirm('This will merge backup data into current data (duplicates allowed). Continue?')){
          customers = customers.concat(obj.customers || []);
          transactions = transactions.concat(obj.transactions || []);
          save();
          alert('Backup merged.');
        }
      } else {
        alert('JSON format not recognized. Expecting { customers: [...], transactions: [...] }');
      }
    } catch(err){
      alert('Invalid JSON file.');
    }
  };
  r.readAsText(file, 'utf-8');
}

// ---- helpers ----
function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}
function sanitizeFilename(s){ return (s||'file').replace(/[^a-z0-9_\-\.]/gi,'_').slice(0,200); }

// ---- UI events & initial wiring ----
function renderAll(){
  renderCustomerList();
  renderTotals();
  if(selectedCustomerId && customers.some(c => c.id === selectedCustomerId)){
    renderCustomerDetail();
  } else {
    selectedCustomerId = null;
    rightContent.innerHTML = '';
    rightDefault.style.display = '';
  }
}
function renderTotals(){
  const { totalGive, totalGet, net } = totals();
  topTotalEl.textContent = fmtCurrency(net);
  quickGiveEl.textContent = fmtCurrency(totalGive);
  quickGetEl.textContent = fmtCurrency(totalGet);
}

$('#open-add').addEventListener('click', () => showAddCustomerForm());
$('#quick-add-customer').addEventListener('click', () => showAddCustomerForm());
$('#quick-export-all').addEventListener('click', () => exportAllCSV());
$('#export-csv-all').addEventListener('click', () => exportAllCSV());
$('#export-customers-csv').addEventListener('click', () => exportCustomersCSV());
$('#clear-data').addEventListener('click', () => clearAll(true));
$('#export-json').addEventListener('click', () => exportJSONBackup());
$('#import-json-btn').addEventListener('click', () => $('#import-json-file').click());
$('#import-json-file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(f) handleImportJSON(f);
  e.target.value = '';
});
$('#import-csv').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(f) handleImportCSV(f);
  e.target.value = '';
});

searchEl.addEventListener('input', () => renderCustomerList());
sortEl.addEventListener('change', () => renderCustomerList());

load();
renderAll();

document.addEventListener('dblclick', (ev) => {
  const parent = ev.target.closest('.item');
  if(parent){
    const id = parent.dataset.id;
    if(id && confirm('Export transactions for this customer as CSV?')) exportCustomerCSV(id);
  }
});

window.addEventListener('storage', () => {
  load();
  renderAll();
});

window.CC = { customers, transactions, save, load, exportAllCSV, exportCustomerCSV, clearAll };

---
