/* =========================
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
