/* =====================================
   STORAGE HELPERS
===================================== */
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* =====================================
   GLOBAL DATA
===================================== */
let customers = load("cc_customers", []);
let transactions = load("cc_transactions", []);

/* =====================================
   DOM ELEMENTS
===================================== */
const customerList = document.getElementById("customer-list");
const rightDefault = document.getElementById("right-default");
const rightContent = document.getElementById("right-content");

const openAddBtn = document.getElementById("open-add");
const quickAddBtn = document.getElementById("quick-add-customer");

const topTotal = document.getElementById("top-total");
const quickGive = document.getElementById("quick-give");
const quickGet = document.getElementById("quick-get");

const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sortBy");

/* =====================================
   CORE FUNCTIONS
===================================== */
function calculateBalance(id) {
  const userTx = transactions.filter(t => t.customerId === id);
  let total = 0;
  userTx.forEach(t => total += Number(t.amount));
  return total; // positive = they owe you, negative = you owe them
}

function renderCustomers() {
  const query = searchInput.value.toLowerCase();

  let list = [...customers];

  // sorting
  const mode = sortSelect.value;
  if (mode === "nameAsc") list.sort((a,b)=>a.name.localeCompare(b.name));
  else if (mode === "nameDesc") list.sort((a,b)=>b.name.localeCompare(a.name));
  else if (mode === "balanceDesc") list.sort((a,b)=>calculateBalance(b.id)-calculateBalance(a.id));
  else if (mode === "balanceAsc") list.sort((a,b)=>calculateBalance(a.id)-calculateBalance(b.id));
  else if (mode === "recent") list.sort((a,b)=>b.updated - a.updated);

  // filter
  list = list.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.phone.includes(query)
  );

  customerList.innerHTML = "";

  list.forEach(c => {
    const bal = calculateBalance(c.id);
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <div class="name">${c.name}</div>
        <div class="phone muted small">${c.phone}</div>
      </div>
      <div class="balance ${bal >= 0 ? "pos" : "neg"}">₹${bal.toFixed(2)}</div>
    `;
    item.onclick = () => openCustomer(c.id);
    customerList.appendChild(item);
  });

  updateTotals();
}

function updateTotals() {
  let give = 0, get = 0;

  customers.forEach(c => {
    const bal = calculateBalance(c.id);
    if (bal > 0) get += bal;
    else give += Math.abs(bal);
  });

  topTotal.textContent = `₹${(get - give).toFixed(2)}`;
  quickGive.textContent = `₹${give.toFixed(2)}`;
  quickGet.textContent = `₹${get.toFixed(2)}`;
}

/* =====================================
   ADD CUSTOMER FORM
===================================== */
function openAddCustomerForm() {
  rightDefault.style.display = "none";
  rightContent.innerHTML = `
    <h2>Add Customer</h2>

    <div class="form">
      <label>Name</label>
      <input id="add-name" placeholder="Customer name">

      <label>Phone</label>
      <input id="add-phone" placeholder="Phone number">

      <button id="save-customer" class="btn primary" style="margin-top:12px">
        Save Customer
      </button>
    </div>
  `;

  document.getElementById("save-customer").onclick = saveCustomer;
}

function saveCustomer() {
  const name = document.getElementById("add-name").value.trim();
  const phone = document.getElementById("add-phone").value.trim();

  if (!name) return alert("Name required");

  const newCustomer = {
    id: Date.now().toString(),
    name,
    phone,
    updated: Date.now(),
  };

  customers.push(newCustomer);
  save("cc_customers", customers);

  renderCustomers();
  showDefaultRightPane();
}

/* =====================================
   OPEN CUSTOMER DETAILS
===================================== */
function openCustomer(id) {
  const customer = customers.find(c => c.id === id);
  const bal = calculateBalance(id);

  rightDefault.style.display = "none";

  rightContent.innerHTML = `
    <h2>${customer.name}</h2>
    <div class="muted">${customer.phone}</div>

    <div class="balance-box">
      <b>Balance:</b> ₹${bal.toFixed(2)}
    </div>

    <div style="margin-top:20px">
      <button id="add-tx" class="btn primary">Add Transaction</button>
    </div>
  `;

  document.getElementById("add-tx").onclick = () => addTransaction(id);
}

function addTransaction(id) {
  const amount = Number(prompt("Enter amount (positive = they give you, negative = you give them):"));
  if (!amount) return;

  transactions.push({
    customerId: id,
    amount,
    time: Date.now()
  });

  save("cc_transactions", transactions);

  const c = customers.find(c => c.id === id);
  c.updated = Date.now();
  save("cc_customers", customers);

  openCustomer(id);
  renderCustomers();
}

/* =====================================
   DEFAULT RIGHT PANEL
===================================== */
function showDefaultRightPane() {
  rightContent.innerHTML = "";
  rightDefault.style.display = "block";
}

/* =====================================
   EVENT LISTENERS
===================================== */
openAddBtn.onclick = openAddCustomerForm;
quickAddBtn.onclick = openAddCustomerForm;

searchInput.oninput = renderCustomers;
sortSelect.onchange = renderCustomers;

/* INITIAL RENDER */
renderCustomers();
showDefaultRightPane();
