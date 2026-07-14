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
            document.getElementById('adminPage').style.display = 'flex';
            document.getElementById('adminPage').style.flexDirection = 'column';
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
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[onclick*="${name}"]`).classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
    if (name === 'orders') loadOrders();
    if (name === 'products') loadProducts();
    if (name === 'branches') loadBranches();
    if (name === 'principals') loadPrincipals();
    if (name === 'agents') loadAgents();
    if (name === 'calls') loadCalls();
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
    let html = '<h3 style="margin-bottom:12px">Principals</h3>';
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
            html += `<div class="card" style="text-align:center;padding:12px;cursor:default">
                <div style="font-size:${cols > 4 ? '12px' : '14px'};font-weight:500;margin-bottom:4px">${name}</div>
                <div style="font-size:${cols > 4 ? '13px' : '16px'};color:#1B3A5C;font-weight:700">₱${parseFloat(price).toFixed(2)}</div>
            </div>`;
        });
    }
    html += '</div>';
    document.getElementById('tab-products').innerHTML = html;
}

function setGrid(n) {
    productsGrid = n;
    if (selectedPrincipal) {
        api('list', { sheet: 'Products' }).then(pd => {
            const products = (pd.data || []).filter(p => p.Principal === selectedPrincipal);
            renderProductsGrid(selectedPrincipal, products);
        });
    }
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
            const fcSrc = (fc && (fc.SelfieUrl || fc.SelfieBase64 || ''));
            if (fcSrc) {
                html += `<div style="background:#eee;min-height:100px;border-radius:6px;text-align:center;padding:4px">`;
                html += `<img src="${fcSrc}" style="max-width:100%;height:120px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="showImage(this.src)" onerror="this.parentElement.innerHTML='<span style=color:red>Failed to load</span>'">`;
                html += `</div><small>${fc.CaptureTime || ''}</small>`;
            } else html += '<span class="call-status"><span class="missed">No Selfie</span></span>';
            html += '</div><div class="selfie-col"><strong>Last Call</strong><br>';
            const lcSrc = (lc && (lc.SelfieUrl || lc.SelfieBase64 || ''));
            if (lcSrc) {
                html += `<div style="background:#eee;min-height:100px;border-radius:6px;text-align:center;padding:4px">`;
                html += `<img src="${lcSrc}" style="max-width:100%;height:120px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="showImage(this.src)" onerror="this.parentElement.innerHTML='<span style=color:red>Failed to load</span>'">`;
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

// ===================== INIT =====================
console.log('CSGT SFA Web Admin loaded');
