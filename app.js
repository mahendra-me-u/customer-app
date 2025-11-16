/* --------------------------------------------------
   STORAGE KEYS
-------------------------------------------------- */
const LS_CUSTOMERS = "cc_customers";
const LS_TRANSACTIONS = "cc_transactions";

/* --------------------------------------------------
   LOAD / SAVE
-------------------------------------------------- */
function loadCustomers() {
  return JSON.parse(localStorage.getItem(LS_CUSTOMERS) || "[]");
}

function saveCustomers(list) {
  localStorage.setItem(LS_CUSTOMERS, JSON.stringify(list));
}

function loadTransactions() {
  return JSON.parse(localStorage.getItem(LS_TRANSACTIONS) || "[]");
}

function saveTransactions(list) {
  localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(list));
}

/* --------------------------------------------------
   GLOBAL STATE
-------------------------------------------------- */
let customers = loadCustomers();
let transactions = loadTransactions();
let selectedCustomerId = null;

/* --------------------------------------------------
   UTILS
-------------------------------------------------- */
function uid() {
  return Date.now() + "_" + Math.random().toString(16).slice(2);
}

function formatMoney(n) {
  return "₹" + Number(n).toFixed(2);
}

function getCustomerBalance(id) {
  let amount = 0;
  transactions.forEach(t => {
    if (t.customerId === id) amount += t.amount;
  });
  return amount;
}

/* --------------------------------------------------
   RENDER MAIN LIST
-------------------------------------------------- */
function renderCustomerList() {
  const search = document.getElementById("search").value.toLowerCase();
  const sortBy = document.getElementById("sortBy").value;

  let list = [...customers];

  // filter
  if (search.trim() !== "") {
    list = list.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.phone.toLowerCase().includes(search)
    );
  }

  // sort
  list.sort((a, b) => {
    const balA = getCustomerBalance(a.id);
    const balB = getCustomerBalance(b.id);

    switch (sortBy) {
      case "balanceDesc": return balB - balA;
      case "balanceAsc": return balA - balB;
      case "nameAsc": return a.name.localeCompare(b.name);
      case "nameDesc": return b.name.localeCompare(a.name);
      default: return b.updatedAt - a.updatedAt;
    }
  });

  const root = document.getElementById("customer-list");
  root.innerHTML = "";

  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="customer-name">${c.name}</div>
      <div class="customer-phone">${c.phone}</div>
      <div class="customer-balance">${formatMoney(getCustomerBalance(c.id))}</div>
    `;
    div.onclick = () => openCustomer(c.id);
    root.appendChild(div);
  });

  updateTotals();
}

/* --------------------------------------------------
   TOTALS
-------------------------------------------------- */
function updateTotals() {
  let give = 0;
  let get = 0;

  customers.forEach(c => {
    const bal = getCustomerBalance(c.id);
    if (bal < 0) give += Math.abs(bal);
    else get += bal;
  });

  document.getElementById("quick-give").innerText = formatMoney(give);
  document.getElementById("quick-get").innerText = formatMoney(get);

  const net = get - give;
  document.getElementById("top-total").innerText = formatMoney(net);
}

/* --------------------------------------------------
   ADD CUSTOMER
-------------------------------------------------- */
function openAddForm() {
  selectedCustomerId = null;

  const right = document.getElementById("right-pane");
  const content = document.getElementById("right-content");
  const def = document.getElementById("right-default");

  def.style.display = "none";
  content.innerHTML = `
    <h3>Add Customer</h3>
    <div class="divider"></div>

    <div class="space-y">
      <input id="add-name" placeholder="Customer name" class="input-field" />
      <input id="add-phone" placeholder="Phone" class="input-field" />

      <button id="save-new" class="btn-success">Save</button>
    </div>
  `;

  document.getElementById("save-new").onclick = () => {
    const name = document.getElementById("add-name").value.trim();
    const phone = document.getElementById("add-phone").value.trim();

    if (!name) return alert("Name is required.");

    const newCustomer = {
      id: uid(),
      name,
      phone,
      updatedAt: Date.now()
    };

    customers.push(newCustomer);
    saveCustomers(customers);

    renderCustomerList();
    openCustomer(newCustomer.id);
  };
}

/* --------------------------------------------------
   OPEN CUSTOMER DETAILS
-------------------------------------------------- */
function openCustomer(id) {
  selectedCustomerId = id;

  const c = customers.find(x => x.id === id);
  const list = transactions.filter(t => t.customerId === id);

  const right = document.getElementById("right-content");
  const def = document.getElementById("right-default");
  def.style.display = "none";

  right.innerHTML = `
    <h3>${c.name}</h3>
    <div class="small-muted">${c.phone}</div>
    <div class="divider"></div>

    <div style="font-weight:700;margin-bottom:10px">Balance: ${formatMoney(getCustomerBalance(id))}</div>

    <button id="add-tx" class="btn primary">Add Transaction</button>
    <button id="delete-customer" class="btn-plain" style="color:#c00">Delete Customer</button>

    <div class="divider" style="margin-top:15px"></div>

    <h4>Transactions</h4>
    <div id="tx-list" class="space-y" style="margin-top:10px"></div>
  `;

  document.getElementById("add-tx").onclick = () => openAddTransaction(id);
  document.getElementById("delete-customer").onclick = () => deleteCustomer(id);

  renderTransactions(id);
}

/* --------------------------------------------------
   RENDER TRANSACTIONS
-------------------------------------------------- */
function renderTransactions(id) {
  const root = document.getElementById("tx-list");
  root.innerHTML = "";

  const list = transactions.filter(t => t.customerId === id);

  if (list.length === 0) {
    root.innerHTML = `<div class="small-muted">No transactions yet.</div>`;
    return;
  }

  list.sort((a, b) => b.time - a.time);

  list.forEach(t => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.padding = "10px";
    div.innerHTML = `
      <div><strong>${t.amount > 0 ? "You Gave" : "You Got"}</strong></div>
      <div>${formatMoney(Math.abs(t.amount))}</div>
      <div class="small-muted">${new Date(t.time).toLocaleString()}</div>
    `;
    root.appendChild(div);
  });
}

/* --------------------------------------------------
   ADD TRANSACTION
-------------------------------------------------- */
function openAddTransaction(customerId) {
  const right = document.getElementById("right-content");
  right.innerHTML = `
    <h3>Add Transaction</h3>
    <div class="divider"></div>

    <div class="space-y">
      <input id="tx-amount" type="number" placeholder="Amount" class="input-field" />

      <select id="tx-type" class="input-field">
        <option value="give">You Gave (negative)</option>
        <option value="get">You Got (positive)</option>
      </select>

      <button id="save-tx" class="btn-success">Save</button>
    </div>
  `;

  document.getElementById("save-tx").onclick = () => {
    let amt = Number(document.getElementById("tx-amount").value);
    const type = document.getElementById("tx-type").value;

    if (!amt) return alert("Amount required.");

    amt = type === "give" ? -Math.abs(amt) : Math.abs(amt);

    transactions.push({
      id: uid(),
      customerId,
      amount: amt,
      time: Date.now()
    });

    saveTransactions(transactions);

    const c = customers.find(x => x.id === customerId);
    c.updatedAt = Date.now();
    saveCustomers(customers);

    renderCustomerList();
    openCustomer(customerId);
  };
}

/* --------------------------------------------------
   DELETE CUSTOMER
-------------------------------------------------- */
function deleteCustomer(id) {
  if (!confirm("Delete this customer and all transactions?")) return;

  customers = customers.filter(c => c.id !== id);
  transactions = transactions.filter(t => t.customerId !== id);

  saveCustomers(customers);
  saveTransactions(transactions);

  selectedCustomerId = null;
  document.getElementById("right-content").innerHTML = "";
  document.getElementById("right-default").style.display = "block";

  renderCustomerList();
}

/* --------------------------------------------------
   BACKUP / IMPORT JSON
-------------------------------------------------- */
document.getElementById("export-json").onclick = () => {
  const data = {
    customers,
    transactions
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "credit_backup.json";
  a.click();
};

document.getElementById("import-json-btn").onclick = () =>
  document.getElementById("import-json-file").click();

document.getElementById("import-json-file").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      customers = data.customers || [];
      transactions = data.transactions || [];

      saveCustomers(customers);
      saveTransactions(transactions);

      renderCustomerList();
      alert("Backup imported successfully.");
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
};

/* --------------------------------------------------
   CSV EXPORT
-------------------------------------------------- */
document.getElementById("export-customers-csv").onclick = () => {
  let csv = "name,phone,balance\n";
  customers.forEach(c => {
    csv += `${c.name},${c.phone},${getCustomerBalance(c.id)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "customers.csv";
  a.click();
};

document.getElementById("export-csv-all").onclick = () => {
  let csv = "customer,phone,amount,time\n";

  transactions.forEach(t => {
    const c = customers.find(x => x.id === t.customerId);
    csv += `${c.name},${c.phone},${t.amount},${new Date(t.time).toISOString()}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "transactions.csv";
  a.click();
};

/* --------------------------------------------------
   CLEAR ALL DATA
-------------------------------------------------- */
document.getElementById("clear-data").onclick = () => {
  if (!confirm("Clear all customers and transactions?")) return;

  customers = [];
  transactions = [];

  saveCustomers(customers);
  saveTransactions(transactions);

  renderCustomerList();
  document.getElementById("right-default").style.display = "block";
  document.getElementById("right-content").innerHTML = "";
};

/* --------------------------------------------------
   EVENTS
-------------------------------------------------- */
document.getElementById("search").oninput = renderCustomerList;
document.getElementById("sortBy").onchange = renderCustomerList;
document.getElementById("open-add").onclick = openAddForm;
document.getElementById("quick-add-customer").onclick = openAddForm;
document.getElementById("quick-export-all").onclick = () =>
  document.getElementById("export-csv-all").click();

/* --------------------------------------------------
   INIT
-------------------------------------------------- */
renderCustomerList();
