const PROXY = window.location.origin + '/api/';
const API_KEY = 'asdsaAscvlllwiFFa';

let adminSession = JSON.parse(localStorage.getItem('adminSession') || '{}');

function qs(url) { return fetch(url).then(r => r.json()); }
function api(action, extra = {}) {
    const params = new URLSearchParams({ key: API_KEY, action, ...extra });
    return qs(`${PROXY}?${params}`);
}

// ===================== REGISTER ADMIN =====================
function showRegister() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('registerPage').style.display = 'flex';
}

function backToLogin() {
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
}

function registerAdmin() {
    const adminId = document.getElementById('regAdminId').value.trim();
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirm').value.trim();
    const err = document.getElementById('regError');

    if (!adminId || !name || !username || !password) {
        err.textContent = 'Please fill in all fields'; return;
    }
    if (password !== confirm) { err.textContent = 'Passwords do not match'; return; }
    err.textContent = '';

    api('create', { sheet: 'Admins', AdminID: adminId, Name: name, Username: username, Password: password }).then(r => {
        if (r.success) {
            alert('Admin registered successfully! You can now log in.');
            backToLogin();
        } else {
            err.textContent = r.error || 'Registration failed';
        }
    }).catch(() => err.textContent = 'Connection error');
}

// ===================== LOGIN =====================
function initMobileNav() {
    const nav = document.getElementById('mobileNav');
    const tabs = [
        { name: 'orders', label: '📦 Orders' },
        { name: 'products', label: '📋 Products' },
        { name: 'extruck', label: '🚛 Extruck' },
        { name: 'customers', label: '👥 Customers' },
        { name: 'branches', label: '🏢 Branches' },
        { name: 'principals', label: '🏭 Principals' },
        { name: 'agents', label: '👤 Agents' },
        { name: 'series', label: '🔢 Series' },
        { name: 'calls', label: '📸 Calls' },
    ];
    nav.innerHTML = tabs.map((t, i) => `<button class="${i === 0 ? 'active' : ''}" onclick="switchTab('${t.name}')">${t.label}</button>`).join('');
}

function adminLogin() {
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value.trim();
    const err = document.getElementById('loginError');
    if (!username || !password) { err.textContent = 'Please enter admin credentials'; return; }
    err.textContent = '';

    api('list', { sheet: 'Admins' }).then(resp => {
        const admins = resp.data || [];
        const match = admins.find(a => a.Username === username && a.Password === password);
        if (match) {
            const remember = document.getElementById('rememberAdmin').checked;
            if (remember) localStorage.setItem('adminSession', JSON.stringify({ username, password }));
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPage').style.display = 'block';
            initMobileNav();
            loadOrders();
        } else {
            err.textContent = 'Invalid credentials';
        }
    }).catch(() => err.textContent = 'Connection error');
}

function logout() {
    if (confirm('Log out?')) {
        localStorage.removeItem('adminSession');
        location.reload();
    }
}

// Auto-login
if (adminSession.username) {
    document.getElementById('adminUser').value = adminSession.username;
    document.getElementById('adminPass').value = adminSession.password || '';
    document.getElementById('rememberAdmin').checked = true;
}

// ===================== TABS =====================
function switchTab(name) {
    // Sidebar buttons
    document.querySelectorAll('#sidebar button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#sidebar button').forEach(b => {
        if (b.textContent.includes(name === 'extruck' ? 'Extruck' : name.charAt(0).toUpperCase() + name.slice(1))) {
            b.classList.add('active');
        }
    });
    // Mobile nav
    document.querySelectorAll('#mobileNav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#mobileNav button').forEach(b => {
        if (b.textContent.includes(name === 'extruck' ? 'Extruck' : name.charAt(0).toUpperCase() + name.slice(1))) {
            b.classList.add('active');
        }
    });
    // Content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    // Close mobile sidebar
    closeMobileMenu();
    // Load data
    if (name === 'orders') loadOrders();
    if (name === 'products') loadProducts();
    if (name === 'customers') loadCustomers();
    if (name === 'extruck') loadExtruck();
    if (name === 'branches') loadBranches();
    if (name === 'principals') loadPrincipals();
    if (name === 'agents') loadAgents();
    if (name === 'series') loadSeries();
    if (name === 'calls') loadCalls();
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('mobileOverlay');
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}
function closeMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    sidebar.classList.remove('open');
    document.getElementById('mobileOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

// ===================== MODAL =====================
function showModal(html) { document.getElementById('modalContent').innerHTML = html; document.getElementById('modalOverlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

// ===================== ORDERS =====================
let ordersCache = [], agentsCache = [], branchesCache = [];

async function loadOrders() {
    const el = document.getElementById('tab-orders');
    el.innerHTML = '<div class="spinner">Loading orders...</div>';
    try {
        const [o, a, b] = await Promise.all([api('list', { sheet: 'Orders' }), api('list', { sheet: 'Agents' }), api('list', { sheet: 'Branches' })]);
        ordersCache = o.data || []; agentsCache = a.data || []; branchesCache = b.data || [];
        renderOrders();
    } catch { el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed to load orders</div>'; }
}

function renderOrders() {
    const branchFilter = document.getElementById('orderBranch')?.value || '';
    const dateFilter = document.getElementById('orderDate')?.value || '';
    const agentMap = {};
    agentsCache.forEach(a => agentMap[a.AgentID] = a.Branch || '');
    const branchAgentIds = branchFilter ? new Set(agentsCache.filter(a => (a.Branch || '').toLowerCase() === branchFilter.toLowerCase()).map(a => a.AgentID)) : null;

    let filtered = ordersCache.filter(o => {
        if (branchAgentIds && !branchAgentIds.has(o.AgentID)) return false;
        if (dateFilter && o.OrderDate !== dateFilter) return false;
        return true;
    });

    const total = filtered.reduce((s, o) => s + (parseFloat(o.Total) || 0), 0);
    const pending = filtered.filter(o => (o.Status || '').toLowerCase() === 'pending').length;
    const sent = filtered.filter(o => (o.Status || '').toLowerCase() === 'sent').length;

    let html = `
        <div class="filters">
            <select id="orderBranch" onchange="renderOrders()">
                <option value="">All Branches</option>
                ${branchesCache.map(b => `<option value="${b.BranchName || b.Name}" ${b.BranchName === branchFilter ? 'selected' : ''}>${b.BranchName || b.Name}</option>`).join('')}
            </select>
            <input type="date" id="orderDate" value="${dateFilter}" onchange="renderOrders()">
            <button class="btn btn-sm btn-primary" onclick="document.getElementById('orderDate').value='';renderOrders()">Clear Date</button>
        </div>
        <div class="summary">
            <div class="summary-card"><div class="num">${filtered.length}</div><div class="label">Total Orders</div></div>
            <div class="summary-card" style="border-top:3px solid #1B3A5C"><div class="num">₱${total.toFixed(2)}</div><div class="label">Total Amount</div></div>
            <div class="summary-card" style="border-top:3px solid #F39C12"><div class="num">${pending}</div><div class="label">Pending</div></div>
            <div class="summary-card" style="border-top:3px solid #2ECC71"><div class="num">${sent}</div><div class="label">Sent</div></div>
        </div>`;

    if (!filtered.length) {
        html += '<div class="card" style="text-align:center;color:#888;padding:40px">No orders match the filters.</div>';
    } else {
        html += '<table><tr><th>OrderID</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr>';
        filtered.forEach(o => {
            html += `<tr onclick="showOrderDetail('${o.OrderID}')" style="cursor:pointer">
                <td>${o.OrderID}</td><td>${o.CustomerName || 'N/A'}</td>
                <td>₱${(parseFloat(o.Total) || 0).toFixed(2)}</td>
                <td><span class="badge ${(o.Status||'').toLowerCase()==='sent'?'badge-active':'badge-inactive'}">${o.Status || 'Pending'}</span></td>
                <td>${o.OrderDate || '—'}</td>
            </tr>`;
        });
        html += '</table>';
    }
    document.getElementById('tab-orders').innerHTML = html;
}

function showOrderDetail(orderId) {
    const o = ordersCache.find(x => x.OrderID === orderId);
    if (!o) return;
    let items = [];
    try { items = JSON.parse(o.ItemsJson || '[]'); } catch {}
    let html = `<h3>Order #${o.OrderID}</h3><div style="font-size:14px">`;
    html += `<p><strong>Customer:</strong> ${o.CustomerName || 'N/A'}</p>`;
    html += `<p><strong>Customer ID:</strong> ${o.CustomerID || 'N/A'}</p>`;
    html += `<p><strong>Agent ID:</strong> ${o.AgentID || 'N/A'}</p>`;
    html += `<p><strong>Date:</strong> ${o.OrderDate || 'N/A'}</p>`;
    html += `<p><strong>Principal:</strong> ${o.Principal || 'N/A'}</p>`;
    html += `<p><strong>Discount:</strong> ${o.Discount || '0'}%</p>`;
    html += `<p><strong>Status:</strong> ${o.Status || 'Pending'}</p>`;
    html += `<p><strong>Total:</strong> ₱${(parseFloat(o.Total) || 0).toFixed(2)}</p>`;
    if (items.length) {
        html += '<hr><p><strong>Items:</strong></p><table><tr><th>ProductID</th><th>Name</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>';
        items.forEach(i => {
            html += `<tr><td>${i.productId}</td><td>${i.productName}</td><td>${i.qty}</td><td>₱${(i.price||0).toFixed(2)}</td><td>₱${(i.subtotal||0).toFixed(2)}</td></tr>`;
        });
        html += '</table>';
    }
    if (o.ProofImage) {
        html += '<hr><p><strong>Proof of Payment:</strong></p>';
        html += `<img src="${o.ProofImage}" style="max-width:100%;max-height:300px;border-radius:6px">`;
    }
    const truckId = o.TruckID || '';
    if (truckId && (o.Status || '').toLowerCase() !== 'sent') {
        html += `<hr><button class="btn btn-success" onclick="processTruckOrder('${o.OrderID}','${truckId}','${(o.ItemsJson||'').replace(/'/g, "\\'")}')">✅ Process & Deduct Inventory</button>`;
    }
    html += '</div>';
    showModal(html);
}

// ===================== PRODUCTS =====================
let selectedPrincipal = null;
let productsGrid = 3;

function loadProducts() {
    const el = document.getElementById('tab-products');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    Promise.all([api('list', { sheet: 'Principals' }), api('list', { sheet: 'Products' })]).then(([pr, pd]) => {
        const principals = pr.data || [];
        const products = pd.data || [];
        selectedPrincipal = null;
        renderPrincipalsList(principals, products);
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed to load</div>');
}

function renderPrincipalsList(principals, products) {
    let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<h3>Principals</h3>';
    html += '<button class="btn btn-primary" onclick="showImportDialog()">Import from Excel</button>';
    html += '</div>';
    if (!principals.length) {
        html += '<div class="card" style="text-align:center;color:#888;padding:40px">No principals found.</div>';
        document.getElementById('tab-products').innerHTML = html;
        return;
    }
    principals.forEach(p => {
        const name = p.Name || '—';
        const count = products.filter(pr => pr.Principal === name).length;
        html += `<div class="card" style="cursor:pointer" onclick="showProducts('${name.replace(/'/g, "\\'")}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <h3>${name}</h3>
                <span style="background:#1B3A5C;color:white;padding:4px 12px;border-radius:12px;font-size:13px">${count} products</span>
            </div>
        </div>`;
    });
    document.getElementById('tab-products').innerHTML = html;
}

function showProducts(principalName) {
    selectedPrincipal = principalName;
    Promise.all([api('list', { sheet: 'Principals' }), api('list', { sheet: 'Products' })]).then(([pr, pd]) => {
        const products = (pd.data || []).filter(p => p.Principal === principalName);
        renderProductsGrid(principalName, products);
    });
}

function renderProductsGrid(principalName, products) {
    const cols = productsGrid;
    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px">
                <button onclick="loadProducts()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#1B3A5C">←</button>
                <h3>${principalName}</h3>
            </div>
            <div style="display:flex;gap:4px">
                ${[2,3,4,5,6].map(n => `<button class="btn btn-sm ${cols === n ? 'btn-primary' : ''}" onclick="setGrid(${n})">${n}x${n}</button>`).join('')}
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px">`;
    
    if (!products.length) {
        html = `<div style="text-align:center;color:#888;padding:40px">No products under ${principalName}.</div>`;
    } else {
        products.forEach(p => {
            const name = p.Name || '—';
            const price = p.Price || '0';
            const prodId = p.ProductID || '';
            const pName = p.Principal || '';
            const safeName = name.replace(/'/g, "\\'");
            html += `<div class="card" style="text-align:center;padding:12px;position:relative">
                <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px">
                    <button class="btn btn-sm btn-primary" onclick="editProduct('${safeName}','${prodId}','${price}','${pName.replace(/'/g, "\\'")}')" style="font-size:10px;padding:2px 6px">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${prodId}')" style="font-size:10px;padding:2px 6px">Del</button>
                </div>
                <div style="font-size:${cols > 4 ? '12px' : '14px'};font-weight:500;margin-bottom:4px;padding-top:8px">${name}</div>
                <div style="font-size:${cols > 4 ? '13px' : '16px'};color:#1B3A5C;font-weight:700">₱${parseFloat(price).toFixed(2)}</div>
            </div>`;
        });
    }
    html += '</div>';
    document.getElementById('tab-products').innerHTML = html;
}

function editProduct(name, prodId, price, principal) {
    showModal(`
        <h3>Edit Product</h3>
        <input type="text" id="editProdName" value="${name}" placeholder="Name">
        <input type="text" id="editProdId" value="${prodId}" placeholder="ProductID">
        <input type="text" id="editProdPrice" value="${price}" placeholder="Price">
        <input type="text" id="editProdPrincipal" value="${principal}" placeholder="Principal">
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveProduct('${prodId}')">Save</button>
        </div>
    `);
}

function saveProduct(oldProdId) {
    const name = document.getElementById('editProdName').value.trim();
    const prodId = document.getElementById('editProdId').value.trim();
    const price = document.getElementById('editProdPrice').value.trim();
    const principal = document.getElementById('editProdPrincipal').value.trim();
    if (!name || !prodId || !price || !principal) { alert('All fields required'); return; }
    
    api('delete', { sheet: 'Products', idColumn: 'ProductID', idValue: oldProdId }).then(() => {
        setTimeout(() => {
            api('create', { sheet: 'Products', ProductID: prodId, Name: name, Price: price, Principal: principal }).then(r => {
                if (r.success) { closeModal(); showProducts(principal); }
                else alert(r.error || 'Failed');
            });
        }, 1500);
    });
}

function deleteProduct(prodId) {
    if (!confirm('Delete this product?')) return;
    api('delete', { sheet: 'Products', idColumn: 'ProductID', idValue: prodId }).then(r => {
        if (r.success) { if (selectedPrincipal) showProducts(selectedPrincipal); else loadProducts(); }
        else alert('Delete failed');
    });
}

function showImportDialog() {
    showModal(`
        <h3>Import Products from Excel</h3>
        <p style="font-size:13px;color:#666;margin-bottom:12px">Upload an .xlsx file with columns: <strong>Name</strong>, <strong>Price</strong>, <strong>Principal</strong>, <strong>ProductID</strong> (all required)</p>
        <p style="font-size:13px;margin-bottom:12px"><a href="/api/product-template.xlsx" style="color:#1B3A5C;font-weight:600">📥 Download Template (.xlsx)</a></p>
        <input type="file" id="excelFile" accept=".xlsx" style="margin-bottom:12px">
        <div id="importProgress" style="font-size:13px;color:#888"></div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="importExcel()">Import</button>
        </div>
    `);
}

let importTaskId = null;
let importPoll = null;

function importExcel() {
    const fileInput = document.getElementById('excelFile');
    if (!fileInput.files.length) { alert('Select a file'); return; }
    const progress = document.getElementById('importProgress');
    progress.innerHTML = 'Uploading...';
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    
    fetch('/api/import-start', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(resp => {
            if (!resp.success) {
                if (resp.duplicate) {
                    progress.innerHTML = `<span style="color:#E84C4C">❌ ${resp.error.replace(/\n/g, '<br>')}</span>`;
                } else {
                    progress.innerHTML = '<span style="color:#E84C4C">' + (resp.error || 'Failed') + '</span>';
                }
                return;
            }
            importTaskId = resp.task_id;
            progress.innerHTML = `0 / ${resp.total} products <button class="btn btn-sm btn-danger" onclick="cancelImport()" style="margin-left:8px">Cancel</button>`;
            
            importPoll = setInterval(() => {
                fetch('/api/import-status/' + importTaskId)
                    .then(r => r.json())
                    .then(s => {
                        if (!s.success) { clearInterval(importPoll); return; }
                        progress.innerHTML = `${s.imported} / ${s.total} products <button class="btn btn-sm btn-danger" onclick="cancelImport()" style="margin-left:8px">Cancel</button>`;
                        if (s.done) {
                            clearInterval(importPoll);
                            progress.innerHTML = `<span style="color:#2ECC71">✅ Imported ${s.imported} / ${s.total} products${s.errors && s.errors.length ? '<br>⚠️ Errors: ' + s.errors.join('<br>') : ''}</span>`;
                            setTimeout(() => { closeModal(); loadProducts(); }, 1500);
                        }
                    });
            }, 800);
        })
        .catch(() => progress.innerHTML = '<span style="color:#E84C4C">Upload failed</span>');
}

function cancelImport() {
    if (importTaskId) {
        fetch('/api/import-cancel/' + importTaskId);
        clearInterval(importPoll);
        document.getElementById('importProgress').innerHTML = '<span style="color:#F39C12">⏹️ Cancelling...</span>';
    }
}

window.addEventListener('beforeunload', function() {
    if (importTaskId) {
        navigator.sendBeacon('/api/import-cancel/' + importTaskId);
        clearInterval(importPoll);
    }
});

function setGrid(n) {
    productsGrid = n;
    if (selectedPrincipal) {
        api('list', { sheet: 'Products' }).then(pd => {
            const products = (pd.data || []).filter(p => p.Principal === selectedPrincipal);
            renderProductsGrid(selectedPrincipal, products);
        });
    }
}

// ===================== CUSTOMERS =====================
let customersBranchFilter = '';

function loadCustomers() {
    const el = document.getElementById('tab-customers');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    Promise.all([api('list', { sheet: 'Customers' }), api('list', { sheet: 'Agents' }), api('list', { sheet: 'Branches' })]).then(([cr, ar, br]) => {
        const customers = cr.data || [];
        const agents = ar.data || [];
        const branches = br.data || [];
        
        // Build agent-to-branch map
        const agentBranchMap = {};
        agents.forEach(a => { const aid = a.AgentID || ''; if (aid) agentBranchMap[aid] = (a.Branch || '').toLowerCase(); });
        
        // Filter customers by branch
        const filtered = customers.filter(c => {
            if (!customersBranchFilter) return true;
            const agentBranch = agentBranchMap[c.AgentID || ''] || '';
            return agentBranch === customersBranchFilter.toLowerCase();
        });
        
        let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3>Customers</h3>
            <button class="btn btn-primary" onclick="showCustomerImport()">Import from Excel</button>
        </div>`;
        
        html += `<div class="filters" style="margin-bottom:12px">
            <select id="customerBranchFilter" onchange="customersBranchFilter=this.value;loadCustomers()" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px">
                <option value="">All Branches</option>
                ${branches.map(b => `<option value="${b.BranchName || b.Name || ''}" ${(b.BranchName||b.Name) === customersBranchFilter ? 'selected' : ''}>${b.BranchName || b.Name}</option>`).join('')}
            </select>
            <span style="font-size:13px;color:#888">${filtered.length} customer(s)</span>
        </div>`;
        
        if (!filtered.length) {
            html += '<div class="card" style="text-align:center;color:#888;padding:40px">No customers found.</div>';
        } else {
            html += '<table><tr><th>CustomerID</th><th>Name</th><th>Address</th><th>Phone</th><th>AgentID</th><th>Actions</th></tr>';
            filtered.forEach(c => {
                const agentId = c.AgentID || '';
                const safeName = (c.Name || c.CustomerName || '').replace(/'/g, "\\'");
                html += `<tr>
                    <td>${c.CustomerID || ''}</td><td>${c.Name || c.CustomerName || ''}</td>
                    <td>${c.Address || ''}</td><td>${c.Phone || ''}</td>
                    <td>${agentId}</td>
                    <td><button class="btn btn-sm btn-primary" onclick="showRetag('${c.CustomerID || ''}','${safeName}','${agentId.replace(/'/g, "\\'")}')">Re-tag</button></td>
                </tr>`;
            });
            html += '</table>';
        }
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function showRetag(customerId, name, currentAgentId) {
    // Fetch agents for dropdown
    api('list', { sheet: 'Agents' }).then(r => {
        const agents = r.data || [];
        let options = '<option value="">Select Agent</option>';
        agents.forEach(a => {
            const aid = a.AgentID || '';
            const aname = a.Name || '';
            const sel = aid === currentAgentId ? 'selected' : '';
            options += `<option value="${aid}" ${sel}>${aname} (${aid})</option>`;
        });
        showModal(`
            <h3>Re-tag Customer</h3>
            <p style="margin-bottom:8px"><strong>Customer:</strong> ${name} (${customerId})</p>
            <p style="margin-bottom:8px"><strong>Current Agent:</strong> ${currentAgentId}</p>
            <select id="newAgentId" style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-top:8px">${options}</select>
            <div class="modal-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveRetag('${customerId}','${name.replace(/'/g, "\\'")}')">Save</button>
            </div>
        `);
    });
}

function saveRetag(customerId, name) {
    const newAgentId = document.getElementById('newAgentId').value.trim();
    if (!newAgentId) { alert('Enter an Agent ID'); return; }
    api('delete', { sheet: 'Customers', idColumn: 'CustomerID', idValue: customerId }).then(() => {
        setTimeout(() => {
            api('create', { sheet: 'Customers', CustomerID: customerId, Name: name, AgentID: newAgentId }).then(r => {
                if (r.success) { closeModal(); loadCustomers(); }
                else alert(r.error || 'Failed');
            });
        }, 1500);
    });
}

function showCustomerImport() {
    showModal(`
        <h3>Import Customers from Excel</h3>
        <p style="font-size:13px;color:#666;margin-bottom:12px">Upload an .xlsx file with columns: <strong>CustomerID</strong>, <strong>Name</strong>, <strong>Address</strong>, <strong>Phone</strong>, <strong>AgentID</strong> (all required)</p>
        <p style="font-size:13px;margin-bottom:12px"><a href="/api/customer-template.xlsx" style="color:#1B3A5C;font-weight:600">📥 Download Template (.xlsx)</a></p>
        <input type="file" id="customerExcelFile" accept=".xlsx" style="margin-bottom:12px">
        <div id="customerImportProgress" style="font-size:13px;color:#888"></div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="importCustomers()">Import</button>
        </div>
    `);
}

let customerImportTaskId = null;
let customerImportPoll = null;

function importCustomers() {
    const fileInput = document.getElementById('customerExcelFile');
    if (!fileInput.files.length) { alert('Select a file'); return; }
    const progress = document.getElementById('customerImportProgress');
    progress.innerHTML = 'Uploading...';
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    
    fetch('/api/import-customers-start', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(resp => {
            if (!resp.success) {
                if (resp.duplicate) {
                    progress.innerHTML = `<span style="color:#E84C4C">❌ ${resp.error.replace(/\n/g, '<br>')}</span>`;
                } else {
                    progress.innerHTML = '<span style="color:#E84C4C">' + (resp.error || 'Failed') + '</span>';
                }
                return;
            }
            customerImportTaskId = resp.task_id;
            progress.innerHTML = `0 / ${resp.total} customers <button class="btn btn-sm btn-danger" onclick="cancelCustomerImport()" style="margin-left:8px">Cancel</button>`;
            
            customerImportPoll = setInterval(() => {
                fetch('/api/import-status/' + customerImportTaskId)
                    .then(r => r.json())
                    .then(s => {
                        progress.innerHTML = `${s.imported} / ${s.total} customers <button class="btn btn-sm btn-danger" onclick="cancelCustomerImport()" style="margin-left:8px">Cancel</button>`;
                        if (s.done) {
                            clearInterval(customerImportPoll);
                            progress.innerHTML = `<span style="color:#2ECC71">✅ Imported ${s.imported} / ${s.total} customers${s.errors && s.errors.length ? '<br>⚠️ Errors: ' + s.errors.join('<br>') : ''}</span>`;
                            setTimeout(() => { closeModal(); loadCustomers(); }, 1500);
                        }
                    });
            }, 800);
        })
        .catch(() => progress.innerHTML = '<span style="color:#E84C4C">Upload failed</span>');
}

function cancelCustomerImport() {
    if (customerImportTaskId) {
        fetch('/api/import-cancel/' + customerImportTaskId);
        clearInterval(customerImportPoll);
        document.getElementById('customerImportProgress').innerHTML = '<span style="color:#F39C12">⏹️ Cancelling...</span>';
    }
}

// ===================== EXTRUCK =====================
let extruckBranchFilter = '';

function loadExtruck() {
    const el = document.getElementById('tab-extruck');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    Promise.all([
        api('list', { sheet: 'Extrucks' }),
        api('list', { sheet: 'TruckInventory' }),
        api('list', { sheet: 'TruckInventoryCounts' }),
        api('list', { sheet: 'SalesReturns' }),
        api('list', { sheet: 'TruckGPS' }),
        api('list', { sheet: 'Branches' }),
    ]).then(([tr, inv, cnt, ret, gps, br]) => {
        const trucks = tr.data || [];
        const inventory = inv.data || [];
        const counts = cnt.data || [];
        const returns = ret.data || [];
        const gpsData = gps.data || [];
        const branches = br.data || [];
        
        // Filter by branch
        const filteredTrucks = extruckBranchFilter ? trucks.filter(t => (t.Branch || '').toLowerCase() === extruckBranchFilter.toLowerCase()) : trucks;
        
        let html = '<h3 style="margin-bottom:12px">Extruck Management</h3>';
        
        // Branch filter dropdown
        html += `<div class="filters" style="margin-bottom:12px">
            <select id="extruckBranchSelect" onchange="extruckBranchFilter=this.value;loadExtruck()" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px">
                <option value="">All Branches</option>
                ${branches.map(b => `<option value="${b.BranchName || b.Name || ''}" ${(b.BranchName||b.Name) === extruckBranchFilter ? 'selected' : ''}>${b.BranchName || b.Name}</option>`).join('')}
            </select>
            <span style="font-size:13px;color:#888">${filteredTrucks.length} truck(s)</span>
        </div>`;
        
        // Summary cards
        html += '<div class="summary">';
        html += `<div class="summary-card"><div class="num">${filteredTrucks.length}</div><div class="label">Trucks</div></div>`;
        html += `<div class="summary-card"><div class="num">${returns.filter(r => r.Status === 'Pending').length}</div><div class="label">Pending Returns</div></div>`;
        html += `<div class="summary-card"><div class="num">${gpsData.length}</div><div class="label">GPS Pings</div></div>`;
        html += '</div>';
        
        // Truck list
        html += '<table><tr><th>TruckID</th><th>Name</th><th>AgentID</th><th>Branch</th><th>Status</th><th>Actions</th></tr>';
        filteredTrucks.forEach(t => {
            const tid = t.TruckID || '';
            const agentInv = inventory.filter(i => i.TruckID === tid);
            const totalInv = agentInv.reduce((s, i) => s + (parseInt(i.Quantity) || 0), 0);
            html += `<tr>
                <td>${tid}</td><td>${t.TruckName || ''}</td><td>${t.AgentID || ''}</td>
                <td>${t.Branch || ''}</td>
                <td><span class="badge ${(t.Status||'Active') === 'Active' ? 'badge-active' : 'badge-inactive'}">${t.Status || 'Active'}</span></td>
                <td class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="showTruckDetail('${tid}')">Detail</button>
                    <button class="btn btn-sm btn-primary" onclick="showInventoryCount('${tid}')">📋 Count</button>
                    <button class="btn btn-sm btn-primary" onclick="showInventoryHistory('${tid}')">📊 History</button>
                    <button class="btn btn-sm btn-success" onclick="showAssignTruck()">+ Assign</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        
        // Sales Returns
        if (returns.length) {
            html += '<h4 style="margin-top:20px;margin-bottom:8px">Sales Returns</h4>';
            html += '<table><tr><th>Date</th><th>Truck</th><th>OrderID</th><th>Product</th><th>Qty</th><th>Reason</th><th>Status</th></tr>';
            returns.slice(-10).reverse().forEach(r => {
                html += `<tr><td>${r.Date || ''}</td><td>${r.TruckID || ''}</td><td>${r.OrderID || ''}</td>
                    <td>${r.ProductName || ''}</td><td>${r.Quantity || ''}</td><td>${r.Reason || ''}</td>
                    <td><span class="badge ${r.Status === 'Approved' ? 'badge-active' : 'badge-inactive'}">${r.Status || 'Pending'}</span></td></tr>`;
            });
            html += '</table>';
        }
        
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function showTruckDetail(truckId) {
    Promise.all([api('list', { sheet: 'TruckInventory' }), api('list', { sheet: 'TruckInventoryCounts' }), api('list', { sheet: 'SalesReturns' }), api('list', { sheet: 'Products' })]).then(([inv, cnt, ret, pr]) => {
        const truckInv = (inv.data || []).filter(i => i.TruckID === truckId);
        const truckCnt = (cnt.data || []).filter(c => c.TruckID === truckId);
        const truckRet = (ret.data || []).filter(r => r.TruckID === truckId);
        const products = pr.data || [];
        
        // Get principals for inventory products
        const prodMap = {};
        products.forEach(p => { prodMap[p.Name] = p.Principal || ''; });
        
        let html = `<h3>Truck: ${truckId}</h3>
        <div style="margin-bottom:10px;display:flex;gap:8px">
            <button class="btn btn-sm btn-success" onclick="showSpotCount('${truckId}')">📋 Spot Count</button>
            <button class="btn btn-sm btn-primary" onclick="showLoadUnload('${truckId}')">📦 Load/Unload</button>
            <button class="btn btn-sm btn-primary" onclick="showCountHistory('${truckId}')">📊 Count History</button>
        </div>`;
        
        html += '<p><strong>Current Inventory</strong></p><table><tr><th>Product</th><th>Principal</th><th>Qty</th></tr>';
        if (!truckInv.length) html += '<tr><td colspan="3">No inventory</td></tr>';
        else truckInv.forEach(i => html += `<tr><td>${i.ProductName || ''}</td><td>${prodMap[i.ProductName] || '-'}</td><td>${i.Quantity || '0'}</td></tr>`);
        html += '</table>';
        
        if (truckRet.length) {
            html += '<p style="margin-top:12px"><strong>Returns</strong></p><table><tr><th>Date</th><th>Order</th><th>Reason</th><th>Status</th></tr>';
            truckRet.slice(-5).reverse().forEach(r => html += `<tr><td>${r.Date || ''}</td><td>${r.OrderID || ''}</td><td>${r.Reason || ''}</td><td>${r.Status || ''}</td></tr>`);
            html += '</table>';
        }
        
        showModal(html + '<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>');
    });
}

function showInventoryHistory(truckId) {
    api('list', { sheet: 'TruckInventoryCounts' }).then(cnt => {
        const counts = (cnt.data || []).filter(c => c.TruckID === truckId);
        if (!counts.length) { alert('No count history'); return; }
        
        // Group by full datetime (batch)
        const batches = {};
        counts.forEach(c => {
            const batchKey = c.Date || 'Unknown';
            if (!batches[batchKey]) batches[batchKey] = [];
            batches[batchKey].push(c);
        });
        
        let html = `<h3 style="margin-bottom:12px">📊 Inventory Count History - ${truckId}</h3>
        <table><tr><th>Batch</th><th>Items</th><th>Actions</th></tr>`;
        
        const keys = Object.keys(batches).sort().reverse();
        keys.forEach(batchKey => {
            const items = batches[batchKey];
            const escapedKey = batchKey.replace(/'/g, "\\'");
            html += `<tr>
                <td>${batchKey}</td>
                <td>${items.length} item(s)</td>
                <td class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="viewInventoryCount('${truckId}','${escapedKey}')">View</button>
                    <button class="btn btn-sm btn-primary" onclick="editInventoryCount('${truckId}','${escapedKey}')">Edit</button>
                    <button class="btn btn-sm btn-success" onclick="postInventoryCount('${truckId}','${escapedKey}')">Post Count</button>
                </td>
            </tr>`;
        });
        
        html += '</table><div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>';
        showModal(html);
    });
}

function viewInventoryCount(truckId, batchKey) {
    Promise.all([api('list', { sheet: 'TruckInventoryCounts' }), api('list', { sheet: 'TruckInventory' }), api('list', { sheet: 'Products' })]).then(([cnt, inv, pr]) => {
        const countItems = (cnt.data || []).filter(c => c.TruckID === truckId && c.Date === batchKey);
        const currentInv = (inv.data || []).filter(i => i.TruckID === truckId);
        const priceMap = {};
        const prodIdMap = {};
        (pr.data || []).forEach(p => { priceMap[p.Name] = parseFloat(p.Price) || 0; prodIdMap[p.Name] = p.ProductID || ''; });
        
        if (!countItems.length) return;
        
        let html = `<h3 style="margin-bottom:12px">📋 Count Detail - ${truckId} (${batchKey})</h3>
        <table><tr><th>ProductID</th><th>ProductName</th><th>System Inv</th><th>Counted</th><th>Variance Qty</th><th>Variance Amount</th></tr>`;
        
        let totalAmount = 0;
        countItems.forEach(item => {
            const pn = item.ProductName || '';
            const pid = prodIdMap[pn] || '';
            const counted = parseInt(item.QuantityCounted || '0');
            const currInv = currentInv.find(i => (i.ProductName || '').toLowerCase() === pn.toLowerCase());
            const sysInv = parseInt(currInv?.Quantity || '0');
            const qtyVar = counted - sysInv;
            const price = priceMap[pn] || 0;
            const amtVar = qtyVar * price;
            totalAmount += amtVar;
            
            const qClass = qtyVar > 0 ? 'color:#2ecc71' : qtyVar < 0 ? 'color:#e74c3c' : 'color:#888';
            const aClass = amtVar > 0 ? 'color:#2ecc71' : amtVar < 0 ? 'color:#e74c3c' : 'color:#888';
            html += `<tr>
                <td>${pid}</td><td>${pn}</td><td>${sysInv}</td><td>${counted}</td>
                <td style="${qClass};font-weight:bold">${qtyVar > 0 ? '+' : ''}${qtyVar}</td>
                <td style="${aClass};font-weight:bold">${amtVar >= 0 ? '+' : ''}₱${amtVar.toFixed(2)}</td>
            </tr>`;
        });
        
        const tClass = totalAmount > 0 ? 'color:#2ecc71' : totalAmount < 0 ? 'color:#e74c3c' : 'color:#888';
        html += `</table>
        <div style="margin-top:12px;padding:10px;background:rgba(0,0,0,.2);border-radius:6px;text-align:center">
            <strong>Total Variance Amount: </strong>
            <span style="font-size:20px;font-weight:bold;${tClass}">
                ${totalAmount >= 0 ? '+' : ''}₱${totalAmount.toFixed(2)}
            </span>
        </div>
        <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>`;
        
        showModal(html);
    });
}

function editInventoryCount(truckId, batchKey) {
    api('list', { sheet: 'TruckInventoryCounts' }).then(cnt => {
        const items = (cnt.data || []).filter(c => c.TruckID === truckId && c.Date === batchKey);
        if (!items.length) return;
        
        let html = `<h3 style="margin-bottom:12px">Edit Count - ${truckId} (${batchKey})</h3>
        <div style="max-height:60vh;overflow-y:auto">
        <table><tr><th>Product</th><th>Previous Count</th><th>New Count</th></tr>`;
        
        items.forEach(item => {
            const pn = item.ProductName || '';
            const prevQty = item.QuantityCounted || '0';
            html += `<tr>
                <td>${pn}</td>
                <td>${prevQty}</td>
                <td><input type="number" id="sc_${pn.replace(/\s/g,'_')}" value="${prevQty}" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:13px"></td>
            </tr>`;
        });
        
        html += `</table></div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveEditedCount('${truckId}','${batchKey.replace(/'/g, "\\'")}')">💾 Save</button>
        </div>`;
        
        showModal(html);
    });
}

function saveEditedCount(truckId, batchKey) {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const inputs = document.querySelectorAll('[id^="sc_"]');
    let count = 0;
    
    inputs.forEach(input => {
        const pn = input.id.replace('sc_', '').replace(/_/g, ' ');
        const qty = input.value.trim();
        if (qty) {
            api('create', { sheet: 'TruckInventoryCounts', TruckID: truckId, Date: date, ProductName: pn, QuantityCounted: qty });
            count++;
        }
    });
    
    if (count > 0) {
        alert(`✅ ${count} items saved as new batch`);
        closeModal();
    }
}

function postInventoryCount(truckId, batchKey) {
    if (!confirm(`Post count for ${truckId}? This will overwrite current inventory.`)) return;
    
    api('list', { sheet: 'TruckInventoryCounts' }).then(cnt => {
        const items = (cnt.data || []).filter(c => c.TruckID === truckId && c.Date === batchKey);
        if (!items.length) { alert('No data'); return; }
        
        // Delete all existing inventory for this truck
        api('list', { sheet: 'TruckInventory' }).then(inv => {
            const existing = (inv.data || []).filter(i => i.TruckID === truckId);
            let toProcess = existing.length + items.length;
            
            existing.forEach(item => {
                api('delete', { sheet: 'TruckInventory', idColumn: 'ProductName', idValue: item.ProductName || '' });
            });
            
            // Wait a moment then create new inventory from count
            setTimeout(() => {
                items.forEach(item => {
                    api('create', { sheet: 'TruckInventory', TruckID: truckId, ProductName: item.ProductName || '', Quantity: item.QuantityCounted || '0' });
                });
                alert(`✅ Inventory posted for ${truckId}`);
                closeModal();
            }, 2000);
        });
    });
}

function showInventoryCount(truckId) {
    Promise.all([api('list', { sheet: 'TruckInventory' }), api('list', { sheet: 'Products' })]).then(([inv, pr]) => {
        const items = (inv.data || []).filter(i => i.TruckID === truckId);
        const prodMap = {};
        (pr.data || []).forEach(p => { prodMap[p.Name] = p.ProductID || ''; });
        
        let html = `<h3>Inventory Count - ${truckId}</h3>
        <div style="max-height:60vh;overflow-y:auto">
        <table><tr><th>ProductID</th><th>ProductName</th><th>Inventory</th><th>Count</th></tr>`;
        
        items.forEach(item => {
            const pn = item.ProductName || '';
            const pid = prodMap[pn] || '';
            const invQty = item.Quantity || '0';
            html += `<tr>
                <td>${pid}</td>
                <td>${pn}</td>
                <td>${invQty}</td>
                <td><input type="number" id="sc_${pn.replace(/\s/g,'_')}" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:13px"></td>
            </tr>`;
        });
        
        html += `</table></div>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="finishInventoryCount('${truckId}')">💾 Save as Draft</button>
        </div>`;
        
        showModal(html);
    });
}

function finishInventoryCount(truckId) {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    // Fetch product prices for monetary variance
    api('list', { sheet: 'Products' }).then(pr => {
        const priceMap = {};
        (pr.data || []).forEach(p => { priceMap[p.Name] = parseFloat(p.Price) || 0; });
        
        const inputs = document.querySelectorAll('[id^="sc_"]');
        let results = [];
        let totalAmountVariance = 0;
        
        const rows = document.querySelectorAll('#modalContent table tr');
        let rowIdx = 0;
        inputs.forEach(input => {
            const pn = input.id.replace('sc_', '').replace(/_/g, ' ');
            const qty = input.value.trim();
            const row = rows[rowIdx + 1];
            const cells = row ? row.querySelectorAll('td') : [];
            const pid = cells ? (cells[0]?.textContent || '') : '';
            const inv = cells ? (cells[2]?.textContent || '0') : '0';
            const invNum = parseInt(inv) || 0;
            const countNum = parseInt(qty) || 0;
            const qtyVariance = countNum - invNum;
            const price = priceMap[pn] || 0;
            const amountVariance = qtyVariance * price;
            totalAmountVariance += amountVariance;
            
            results.push({ pid, pn, inv, qty: qty || '0', qtyVariance, price, amountVariance });
            
            if (qty) {
                api('create', { sheet: 'TruckInventoryCounts', TruckID: truckId, Date: date, ProductName: pn, QuantityCounted: qty });
            }
            rowIdx++;
        });
        
        let html = `<h3 style="margin-bottom:12px">📊 Count Summary - ${truckId}</h3>
        <table><tr><th>ProductID</th><th>ProductName</th><th>Inventory</th><th>Count</th><th>Variance Qty</th><th>Variance Amount</th></tr>`;
        
        results.forEach(r => {
            const qClass = r.qtyVariance > 0 ? 'color:#2ecc71' : r.qtyVariance < 0 ? 'color:#e74c3c' : 'color:#888';
            const aClass = r.amountVariance > 0 ? 'color:#2ecc71' : r.amountVariance < 0 ? 'color:#e74c3c' : 'color:#888';
            html += `<tr>
                <td>${r.pid}</td><td>${r.pn}</td><td>${r.inv}</td><td>${r.qty}</td>
                <td style="${qClass};font-weight:bold">${r.qtyVariance > 0 ? '+' : ''}${r.qtyVariance}</td>
                <td style="${aClass};font-weight:bold">${r.amountVariance >= 0 ? '+' : ''}₱${r.amountVariance.toFixed(2)}</td>
            </tr>`;
        });
        
        const totalClass = totalAmountVariance > 0 ? 'color:#2ecc71' : totalAmountVariance < 0 ? 'color:#e74c3c' : 'color:#888';
        html += `</table>
        <div style="margin-top:12px;padding:10px;background:rgba(0,0,0,.2);border-radius:6px;text-align:center">
            <strong>Total Variance Amount: </strong>
            <span style="font-size:22px;font-weight:bold;${totalClass}">
                ${totalAmountVariance >= 0 ? '+' : ''}₱${totalAmountVariance.toFixed(2)}
            </span>
        </div>
        <div class="modal-actions">
            <button class="btn btn-success" onclick="document.getElementById('tab-extruck').innerHTML='<div class=spinner>Loading...</div>';loadExtruck();closeModal()">Done</button>
        </div>`;
        
        closeModal();
        document.getElementById('tab-extruck').innerHTML = '<div class="spinner">Loading...</div>';
        // Small delay to let the page reset, then show the summary as page content
        setTimeout(() => {
            document.getElementById('tab-extruck').innerHTML = html;
        }, 100);
    });
}

function finishSpotCount(truckId) {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const inputs = document.querySelectorAll('[id^="sc_"]');
    let count = 0;
    
    inputs.forEach(input => {
        const pn = input.id.replace('sc_', '').replace(/_/g, ' ');
        const qty = input.value.trim();
        if (qty) {
            api('create', { sheet: 'TruckInventoryCounts', TruckID: truckId, Date: date, ProductName: pn, QuantityCounted: qty });
            count++;
        }
    });
    
    if (count > 0) {
        alert(`✅ ${count} items counted`);
        closeModal();
    } else {
        alert('No counts entered');
    }
}

function showLoadUnload(truckId) {
    showModal(`
        <h3>Load/Unload - ${truckId}</h3>
        <select id="luType" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #ddd;border-radius:4px">
            <option value="+">Load (add stock)</option>
            <option value="-">Unload (remove stock)</option>
        </select>
        <input type="text" id="luProduct" placeholder="Product Name" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #ddd;border-radius:4px">
        <input type="number" id="luQty" placeholder="Quantity" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #ddd;border-radius:4px">
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="doLoadUnload('${truckId}')">Save</button>
        </div>
    `);
}

function doLoadUnload(truckId) {
    const type = document.getElementById('luType').value;
    const pn = document.getElementById('luProduct').value.trim();
    const qty = document.getElementById('luQty').value.trim();
    if (!pn || !qty) { alert('Fill all fields'); return; }
    api('create', { sheet: 'TruckInventory', TruckID: truckId, ProductName: pn, Quantity: type + qty }).then(r => {
        if (r.success) { alert('Done'); closeModal(); }
        else alert(r.error || 'Failed');
    });
}

function showCountHistory(truckId) {
    api('list', { sheet: 'TruckInventoryCounts' }).then(r => {
        const counts = (r.data || []).filter(c => c.TruckID === truckId);
        if (!counts.length) { alert('No count history'); closeModal(); return; }
        const grouped = {};
        counts.forEach(c => {
            const d = c.Date || 'Unknown';
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(c);
        });
        let html = `<h3>Count History - ${truckId}</h3>`;
        Object.keys(grouped).sort().reverse().slice(0, 10).forEach(date => {
            html += `<div style="margin:6px 0;padding:8px;background:rgba(0,0,0,.2);border-radius:5px">
                <strong>${date}</strong> (${grouped[date].length} items)
                <button class="btn btn-sm btn-primary" style="margin-left:8px" onclick="showCountDetail('${truckId}','${date}')">View</button>
                <button class="btn btn-sm" style="margin-left:4px" onclick="recountFromHistory('${truckId}','${date}')">Recount</button>
            </div>`;
        });
        html += '<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>';
        showModal(html);
    });
}

function showCountDetail(truckId, date) {
    api('list', { sheet: 'TruckInventoryCounts' }).then(r => {
        const items = (r.data || []).filter(c => c.TruckID === truckId && c.Date === date);
        let html = `<h3>Count Detail - ${date}</h3><table><tr><th>Product</th><th>Counted</th></tr>`;
        items.forEach(i => html += `<tr><td>${i.ProductName || ''}</td><td>${i.QuantityCounted || ''}</td></tr>`);
        html += '</table><div class="modal-actions"><button class="btn btn-primary" onclick="showCountHistory(\''+truckId+'\')">Back</button><button class="btn" onclick="closeModal()">Close</button></div>';
        showModal(html);
    });
}

function recountFromHistory(truckId, date) {
    if (!confirm(`Open spot count for ${truckId}?`)) return;
    showSpotCount(truckId);
}

function showAssignTruck() {
    Promise.all([api('list', { sheet: 'Branches' }), api('list', { sheet: 'Agents' })]).then(([br, ag]) => {
        showModal(`
            <h3>Assign Truck to Agent</h3>
            <input type="text" id="truckId" placeholder="Truck ID">
            <input type="text" id="truckName" placeholder="Truck Name">
            <select id="truckBranch"><option value="">Select Branch</option>
                ${(br.data||[]).map(b => `<option value="${b.BranchName||b.Name}">${b.BranchName||b.Name}</option>`).join('')}
            </select>
            <select id="truckAgent"><option value="">Select Agent</option>
                ${(ag.data||[]).map(a => `<option value="${a.AgentID}">${a.Name} (${a.AgentID})</option>`).join('')}
            </select>
            <div class="modal-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-success" onclick="assignTruck()">Assign</button>
            </div>
        `);
    });
}

function assignTruck() {
    const tid = document.getElementById('truckId').value.trim();
    const tn = document.getElementById('truckName').value.trim();
    const tb = document.getElementById('truckBranch').value;
    const ta = document.getElementById('truckAgent').value;
    if (!tid || !tn || !tb || !ta) { alert('All fields required'); return; }
    api('create', { sheet: 'Extrucks', TruckID: tid, TruckName: tn, AgentID: ta, Branch: tb, Status: 'Active' }).then(r => {
        if (r.success) { closeModal(); loadExtruck(); }
        else alert(r.error || 'Failed');
    });
}

// ===================== SERIES =====================
function loadSeries() {
    const el = document.getElementById('tab-series');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    api('list', { sheet: 'Series' }).then(r => {
        const data = r.data || [];
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3>Order Number Series</h3>
                <button class="btn btn-success" onclick="showAddSeries()">+ Add Series</button>
            </div>
            <div class="summary">
                <div class="summary-card"><div class="num">${data.length}</div><div class="label">Series</div></div>
            </div>`;
        if (!data.length) {
            html += '<div class="card" style="text-align:center;color:#888;padding:40px">No series configured. Add one to start generating order numbers.</div>';
        } else {
            html += '<table><tr><th>Series Name</th><th>Prefix</th><th>Current Number</th><th>Next Number</th><th>Actions</th></tr>';
            data.forEach(s => {
                const sid = s.SeriesID || '';
                const name = s.SeriesName || '';
                const prefix = s.Prefix || '';
                const curr = s.CurrentNumber || '0';
                const next = parseInt(curr) + 1;
                html += `<tr>
                    <td>${name}</td>
                    <td>${prefix}</td>
                    <td>${curr}</td>
                    <td><strong>${prefix}${next}</strong></td>
                    <td class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="editSeries('${sid}')">Edit</button>
                        <button class="btn btn-sm btn-success" onclick="resetSeries('${sid}')">Reset</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSeries('${sid}')">Delete</button>
                    </td>
                </tr>`;
            });
            html += '</table>';
        }
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function showAddSeries() {
    showModal(`
        <h3>Add Series</h3>
        <input type="text" id="seriesName" placeholder="Series Name (e.g. Default)">
        <input type="text" id="seriesPrefix" placeholder="Prefix (e.g. ORD-)">
        <input type="number" id="seriesStart" placeholder="Starting Number (e.g. 1)" value="1">
        <p style="font-size:12px;color:#888;margin-bottom:8px">Example output: <span id="seriesPreview">ORD-1</span></p>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-success" onclick="saveSeries()">Save</button>
        </div>
    `);
    setTimeout(() => {
        ['seriesName','seriesPrefix','seriesStart'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = updateSeriesPreview;
        });
        updateSeriesPreview();
    }, 100);
}

function updateSeriesPreview() {
    const prefix = document.getElementById('seriesPrefix')?.value || '';
    const start = document.getElementById('seriesStart')?.value || '1';
    document.getElementById('seriesPreview').textContent = prefix + start;
}

function saveSeries() {
    const name = document.getElementById('seriesName').value.trim();
    const prefix = document.getElementById('seriesPrefix').value.trim();
    const start = document.getElementById('seriesStart').value.trim();
    if (!name || !prefix || !start) { alert('All fields required'); return; }
    const sid = 'SERIES_' + Date.now();
    api('create', { sheet: 'Series', SeriesID: sid, SeriesName: name, Prefix: prefix, CurrentNumber: start }).then(r => {
        if (r.success) { closeModal(); loadSeries(); }
        else alert(r.error || 'Failed');
    });
}

function editSeries(sid) {
    api('list', { sheet: 'Series' }).then(r => {
        const s = (r.data || []).find(x => x.SeriesID === sid);
        if (!s) return;
        showModal(`
            <h3>Edit Series</h3>
            <input type="text" id="seriesName" value="${s.SeriesName || ''}" placeholder="Series Name">
            <input type="text" id="seriesPrefix" value="${s.Prefix || ''}" placeholder="Prefix">
            <input type="number" id="seriesStart" value="${s.CurrentNumber || '1'}" placeholder="Current Number">
            <p style="font-size:12px;color:#888;margin-bottom:8px">Next output: <span id="seriesPreview">${s.Prefix || ''}${(parseInt(s.CurrentNumber || '1') + 1)}</span></p>
            <div class="modal-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="updateSeries('${sid}')">Update</button>
            </div>
        `);
        setTimeout(() => {
            ['seriesName','seriesPrefix','seriesStart'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.oninput = () => {
                    const p = document.getElementById('seriesPrefix')?.value || '';
                    const n = document.getElementById('seriesStart')?.value || '1';
                    document.getElementById('seriesPreview').textContent = p + (parseInt(n) + 1);
                };
            });
        }, 100);
    });
}

function updateSeries(sid) {
    const name = document.getElementById('seriesName').value.trim();
    const prefix = document.getElementById('seriesPrefix').value.trim();
    const curr = document.getElementById('seriesStart').value.trim();
    if (!name || !prefix || !curr) { alert('All fields required'); return; }
    api('delete', { sheet: 'Series', idColumn: 'SeriesID', idValue: sid }).then(() => {
        setTimeout(() => {
            api('create', { sheet: 'Series', SeriesID: sid, SeriesName: name, Prefix: prefix, CurrentNumber: curr }).then(r => {
                if (r.success) { closeModal(); loadSeries(); }
                else alert(r.error || 'Failed');
            });
        }, 1000);
    });
}

function resetSeries(sid) {
    if (!confirm('Reset this series to 1?')) return;
    api('delete', { sheet: 'Series', idColumn: 'SeriesID', idValue: sid }).then(() => {
        setTimeout(() => {
            api('list', { sheet: 'Series' }).then(r => {
                const s = (r.data || []).find(x => x.SeriesID === sid);
                const prefix = s ? s.Prefix || '' : '';
                api('create', { sheet: 'Series', SeriesID: sid, SeriesName: s ? s.SeriesName || '' : '', Prefix: prefix, CurrentNumber: '1' }).then(r2 => {
                    if (r2.success) loadSeries();
                });
            });
        }, 1000);
    });
}

function deleteSeries(sid) {
    if (!confirm('Delete this series?')) return;
    api('delete', { sheet: 'Series', idColumn: 'SeriesID', idValue: sid }).then(r => {
        if (r.success) loadSeries();
        else alert('Delete failed');
    });
}

// ===================== BRANCHES =====================
function loadBranches() {
    const el = document.getElementById('tab-branches');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    api('list', { sheet: 'Branches' }).then(r => {
        const data = r.data || [];
        let html = `<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="showAddBranch()">+ Add Branch</button></div>`;
        if (!data.length) html += '<div class="card" style="text-align:center;color:#888;padding:40px">No branches yet.</div>';
        else {
            html += '<table><tr><th>Branch Name</th></tr>';
            data.forEach(b => html += `<tr><td>${b.BranchName || b.Name || '—'}</td></tr>`);
            html += '</table>';
        }
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function showAddBranch() {
    showModal(`
        <h3>Add Branch</h3>
        <input type="text" id="branchName" placeholder="Branch Name">
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="addBranch()">Save</button>
        </div>
    `);
    setTimeout(() => document.getElementById('branchName')?.focus(), 100);
}

function addBranch() {
    const name = document.getElementById('branchName').value.trim();
    if (!name) return alert('Enter a branch name');
    api('create', { sheet: 'Branches', BranchName: name }).then(r => {
        if (r.success) { closeModal(); loadBranches(); }
        else alert(r.error || 'Failed');
    });
}

// ===================== PRINCIPALS =====================
function loadPrincipals() {
    const el = document.getElementById('tab-principals');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    Promise.all([api('list', { sheet: 'Principals' }), api('list', { sheet: 'BranchPrincipals' })]).then(([pr, bp]) => {
        const principals = pr.data || [];
        const branchPrincipals = bp.data || [];
        let html = `<div style="margin-bottom:16px;display:flex;gap:8px">
            <button class="btn btn-primary" onclick="showAddPrincipal()">+ Add Principal</button>
            <button class="btn btn-success" onclick="showAssignPrincipal()">Assign to Branch</button>
        </div>`;
        if (!principals.length) html += '<div class="card" style="text-align:center;color:#888;padding:40px">No principals yet.</div>';
        else {
            html += '<table><tr><th>Principal Name</th><th>Assigned Branches</th></tr>';
            principals.forEach(p => {
                const name = p.Name || '—';
                const branches = branchPrincipals.filter(b => b.PrincipalName === name).map(b => b.BranchName).join(', ') || 'None';
                html += `<tr><td>${name}</td><td>${branches}</td></tr>`;
            });
            html += '</table>';
        }
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function showAddPrincipal() {
    showModal(`
        <h3>Add Principal</h3>
        <input type="text" id="principalName" placeholder="Principal Name">
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="addPrincipal()">Save</button>
        </div>
    `);
}

function addPrincipal() {
    const name = document.getElementById('principalName').value.trim();
    if (!name) return alert('Enter a principal name');
    api('create', { sheet: 'Principals', Name: name }).then(r => {
        if (r.success) { closeModal(); loadPrincipals(); }
        else alert(r.error || 'Failed');
    });
}

function showAssignPrincipal() {
    Promise.all([api('list', { sheet: 'Branches' }), api('list', { sheet: 'Principals' })]).then(([br, pr]) => {
        const branches = br.data || [];
        const principals = pr.data || [];
        showModal(`
            <h3>Assign Principal to Branch</h3>
            <select id="assignBranch"><option value="">Select Branch</option>
                ${branches.map(b => `<option value="${b.BranchName || b.Name}">${b.BranchName || b.Name}</option>`).join('')}
            </select>
            <select id="assignPrincipal"><option value="">Select Principal</option>
                ${principals.map(p => `<option value="${p.Name}">${p.Name}</option>`).join('')}
            </select>
            <div class="modal-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-success" onclick="assignPrincipal()">Assign</button>
            </div>
        `);
    });
}

function assignPrincipal() {
    const branch = document.getElementById('assignBranch').value;
    const principal = document.getElementById('assignPrincipal').value;
    if (!branch || !principal) return alert('Select both branch and principal');
    api('create', { sheet: 'BranchPrincipals', BranchName: branch, PrincipalName: principal }).then(r => {
        if (r.success) { closeModal(); loadPrincipals(); }
        else alert(r.error || 'Failed');
    });
}

// ===================== AGENTS =====================
function loadAgents() {
    const el = document.getElementById('tab-agents');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    api('list', { sheet: 'Agents' }).then(r => {
        const data = r.data || [];
        let html = '<table><tr><th>AgentID</th><th>Name</th><th>Branch</th><th>Username</th><th>Status</th><th>Actions</th></tr>';
        data.forEach(a => {
            const active = (a.Active || '').toLowerCase() === 'true';
            html += `<tr>
                <td>${a.AgentID || ''}</td><td>${a.Name || ''}</td><td>${a.Branch || ''}</td><td>${a.Username || ''}</td>
                <td><span class="badge ${active ? 'badge-active' : 'badge-inactive'}">${active ? 'Active' : 'Inactive'}</span></td>
                <td class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="editAgent('${a.AgentID}')">Edit</button>
                    <button class="btn btn-sm ${active ? 'btn-danger' : 'btn-success'}" onclick="toggleAgentStatus('${a.AgentID}','${active ? 'FALSE' : 'TRUE'}')">${active ? 'Set Inactive' : 'Set Active'}</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAgent('${a.AgentID}')">Delete</button>
                </td>
            </tr>`;
        });
        html += '</table>';
        el.innerHTML = html;
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function editAgent(id) {
    const a = (agentsCache.length ? agentsCache : []).find(x => x.AgentID === id);
    if (!a) { alert('Agent data not loaded'); return; }
    showModal(`
        <h3>Edit Agent</h3>
        <input type="text" id="editName" value="${a.Name || ''}" placeholder="Name">
        <input type="text" id="editBranch" value="${a.Branch || ''}" placeholder="Branch">
        <input type="text" id="editUsername" value="${a.Username || ''}" placeholder="Username">
        <input type="text" id="editPassword" value="${a.Password || ''}" placeholder="Password">
        <input type="text" id="editPhone" value="${a.Phone || ''}" placeholder="Phone">
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveAgent('${id}')">Save</button>
        </div>
    `);
}

function saveAgent(id) {
    const name = document.getElementById('editName').value.trim();
    const branch = document.getElementById('editBranch').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const password = document.getElementById('editPassword').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    if (!name) return alert('Name is required');
    
    api('delete', { sheet: 'Agents', idColumn: 'AgentID', idValue: id }).then(() => {
        setTimeout(() => {
            const opts = { key: API_KEY, action: 'create', sheet: 'Agents', AgentID: id, Name: name, Branch: branch, Username: username, Password: password, Phone: phone, Active: 'TRUE' };
            const params = new URLSearchParams(opts);
            qs(`${PROXY}?${params}`).then(r => {
                if (r.success) { closeModal(); loadAgents(); }
                else alert(r.error || 'Failed');
            });
        }, 1500);
    });
}

function toggleAgentStatus(id, newStatus) {
    const a = (agentsCache.length ? agentsCache : []).find(x => x.AgentID === id);
    if (!a) return;
    api('delete', { sheet: 'Agents', idColumn: 'AgentID', idValue: id }).then(() => {
        setTimeout(() => {
            const opts = { key: API_KEY, action: 'create', sheet: 'Agents', AgentID: id, Name: a.Name || '', Branch: a.Branch || '', Username: a.Username || '', Password: a.Password || '', Phone: a.Phone || '', Active: newStatus };
            const params = new URLSearchParams(opts);
            qs(`${PROXY}?${params}`).then(r => { if (r.success) loadAgents(); });
        }, 1500);
    });
}

function deleteAgent(id) {
    if (!confirm('Delete this agent?')) return;
    api('delete', { sheet: 'Agents', idColumn: 'AgentID', idValue: id }).then(r => {
        if (r.success) loadAgents();
        else alert('Delete failed');
    });
}

// ===================== CALLS =====================
function loadCalls() {
    const el = document.getElementById('tab-calls');
    el.innerHTML = '<div class="spinner">Loading...</div>';
    Promise.all([api('list', { sheet: 'Branches' }), api('list', { sheet: 'Agents' }), api('list', { sheet: 'FirstLastCalls' })]).then(([br, ag, ca]) => {
        const branches = br.data || []; const agents = ag.data || []; const calls = ca.data || [];
        const today = new Date().toISOString().split('T')[0];
        let html = `
            <div class="filters">
                <select id="callsBranch" onchange="renderCalls()">
                    <option value="">Select Branch</option>
                    ${branches.map(b => `<option value="${b.BranchName || b.Name}">${b.BranchName || b.Name}</option>`).join('')}
                </select>
                <input type="date" id="callsDate" value="${today}" onchange="renderCalls()">
                <label><input type="checkbox" id="callsDetailed" onchange="renderCalls()"> Detailed View</label>
            </div>
            <div id="callsReport"></div>
        `;
        el.innerHTML = html;
        window._callsAgents = agents;
        window._callsData = calls;
        renderCalls();
    }).catch(() => el.innerHTML = '<div class="spinner" style="color:#E84C4C">Failed</div>');
}

function renderCalls() {
    console.log('renderCalls called');
    const branch = document.getElementById('callsBranch').value;
    const date = document.getElementById('callsDate').value;
    const detailed = document.getElementById('callsDetailed').checked;
    const agents = window._callsAgents || [];
    const calls = window._callsData || [];
    const el = document.getElementById('callsReport');

    if (!branch) { el.innerHTML = '<div class="card" style="text-align:center;color:#888;padding:40px">Select a branch to view.</div>'; return; }

    const branchAgents = agents.filter(a => (a.Branch || '').toLowerCase() === branch.toLowerCase());
    if (!branchAgents.length) { el.innerHTML = '<div class="card" style="text-align:center;color:#888;padding:40px">No agents in this branch.</div>'; return; }

    let html = '';
    branchAgents.forEach(a => {
        const dayCalls = calls.filter(c => (c.AgentID || '').toLowerCase() === (a.AgentID || '').toLowerCase() && c.Date === date);
        const fc = dayCalls.find(c => c.CallType === 'FirstCall');
        const lc = dayCalls.find(c => c.CallType === 'LastCall');
        console.log(`Agent ${a.Name}: fc=`,fc,'lc=',lc);

        html += `<div class="card agent-report">
            <div class="report-header">${a.Name || a.AgentID}</div>`;

            if (detailed) {
            html += '<div class="selfie-grid">';
            html += '<div class="selfie-col"><strong>First Call</strong><br>';
            const fcUrl = (fc && fc.SelfieUrl) || '';
            const fcB64 = (fc && fc.SelfieBase64) || '';
            const fcSrc = fcUrl || fcB64 || '';
            if (fcSrc) {
                html += `<div style="background:#eee;min-height:100px;border-radius:6px;text-align:center;padding:4px">`;
                html += `<img src="${fcUrl || fcB64}" style="max-width:100%;height:120px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="showImage(this.src)" onerror="this.parentElement.innerHTML='<span style=color:red>Image unavailable</span>'">`;
                html += `</div><small>${fc.CaptureTime || ''}</small>`;
            } else html += '<span class="call-status"><span class="missed">No Selfie</span></span>';
            html += '</div><div class="selfie-col"><strong>Last Call</strong><br>';
            const lcUrl = (lc && lc.SelfieUrl) || '';
            const lcB64 = (lc && lc.SelfieBase64) || '';
            const lcSrc = lcUrl || lcB64 || '';
            if (lcSrc) {
                html += `<div style="background:#eee;min-height:100px;border-radius:6px;text-align:center;padding:4px">`;
                html += `<img src="${lcUrl || lcB64}" style="max-width:100%;height:120px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="showImage(this.src)" onerror="this.parentElement.innerHTML='<span style=color:red>Image unavailable</span>'">`;
                html += `</div><small>${lc.CaptureTime || ''}</small>`;
            } else html += '<span class="call-status"><span class="missed">No Selfie</span></span>';
            html += '</div></div>';
        } else {
            html += '<div class="call-status">';
            html += `<span>First Call: ${fc ? `<span class="done">Done (${fc.CaptureTime || ''})</span>` : `<span class="missed">No Selfie</span>`}</span>`;
            html += `<span>Last Call: ${lc ? `<span class="done">Done (${lc.CaptureTime || ''})</span>` : `<span class="missed">No Selfie</span>`}</span>`;
            html += '</div>';
        }
        html += '</div>';
    });
    el.innerHTML = html;
}

function showImage(src) {
    showModal(`<img src="${src.replace(/'/g, "\\'")}" class="enlarged-img" onerror="this.parentElement.innerHTML='<p style=color:red>Failed to load image</p>'"><div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>`);
}

function cleanupOld() {
    if (!confirm('Delete selfies older than 30 days?')) return;
    fetch('/api/cleanup').then(r => r.json()).then(resp => {
        alert(resp.success ? `Deleted ${resp.deleted} old selfies` : `Error: ${resp.error}`);
    }).catch(() => alert('Cleanup failed'));
}

function processTruckOrder(orderId, truckId, itemsJson) {
    if (!confirm(`Process order ${orderId} and deduct truck inventory?`)) return;
    fetch('/api/process-order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({orderId, truckId, itemsJson})
    }).then(r => r.json()).then(resp => {
        if (resp.success) { alert(resp.message); closeModal(); loadOrders(); }
        else alert('Error: ' + (resp.error || 'Failed'));
    }).catch(() => alert('Failed to process'));
}

// ===================== INIT =====================
console.log('CSGT SFA Web Admin loaded');
