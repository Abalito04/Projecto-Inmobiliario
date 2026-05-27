const $ = id => document.getElementById(id);
let movEditId = null, devEditId = null, sitEditId = null, unitEditId = null;
let allMovimientos = [], allDevengados = [], allSituaciones = [], allUnidades = [];

const incomeTypes = ["Alquiler", "Expensas", "Luz", "Gas", "Agua", "Tasas Municipales", "Intereses", "Cochera"];
const expenseTypes = ["Comisión", "Gastos", "Mantenimiento"];
const allConcepts = [...incomeTypes, ...expenseTypes];

function money(v){ return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(v || 0); }
function showError(id,msg){ $(id).style.display='block'; $(id).textContent=msg; }
function hideError(id){ $(id).style.display='none'; $(id).textContent=''; }

async function apiFetch(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('API Error');
    if (method === 'DELETE') return null;
    return await response.json();
}

async function loadData() {
    try {
        allUnidades = await apiFetch('/api/unidades');
        allMovimientos = await apiFetch('/api/movimientos');
        allDevengados = await apiFetch('/api/devengados');
        allSituaciones = await apiFetch('/api/situacion');
        renderAll();
    } catch (e) {
        console.error("Error loading data", e);
    }
}

function fillAllSelects(){
    const unitSelects = ['movUnidad','devUnidad','ccUnidad','sitUnidad','infUnidades'];
    unitSelects.forEach(id => {
        const sel = $(id);
        if (!sel) return;
        sel.innerHTML = allUnidades.map(u => `<option value="${u.nombre}">${u.nombre}</option>`).join('');
    });
    fillConcepts();
}

function fillConcepts(){
    const movTipo = $('movTipo').value;
    const list = movTipo === 'Ingreso' ? incomeTypes : expenseTypes;
    $('movConcepto').innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
    $('infConceptos').innerHTML = allConcepts.map(c => `<option value="${c}">${c}</option>`).join('');
}

function openTab(name){
    const map = {
        mov: 'movView',
        dist: 'distView',
        inf: 'infView',
        dev: 'devView',
        cuenta: 'cuentaView',
        situacion: 'situacionView',
        unidades: 'unidadesView'
    };
    Object.values(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeView = document.getElementById(map[name]);
    if (activeView) activeView.classList.remove('hidden');
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    window.scrollTo(0, 0);
}

// UNIDADES
function addOwnerRow(name = '', percentage = '') {
    const row = document.createElement('div');
    row.className = 'owner-row';
    let displayPct = percentage;
    if (percentage !== '' && percentage <= 1 && percentage > 0) {
        displayPct = (percentage * 100).toFixed(2);
    }
    row.innerHTML = `
        <input type="text" placeholder="Nombre Propietario" value="${name}" class="owner-name">
        <input type="number" step="0.01" placeholder="Porcentaje (0-100)" value="${displayPct}" class="owner-pct">
        <button class="btn btn-danger mini" type="button" onclick="this.parentElement.remove()">✕</button>
    `;
    $('ownerRows').appendChild(row);
}

function resetUnitForm() {
    unitEditId = null;
    $('unitTitle').textContent = 'Nueva Unidad';
    $('unitSaveBtn').textContent = 'Guardar Unidad';
    $('unitCancelBtn').classList.add('hidden');
    $('unitNombre').value = '';
    $('unitDescripcion').value = '';
    $('unitNomenclatura').value = '';
    $('unitSuministroGas').value = '';
    $('unitSuministroLuz').value = '';
    $('unitSuministroAgua').value = '';
    $('unitTipo').value = 'Vivienda';
    $('unitContribInmob').value = '';
    $('unitContribComercio').value = '';
    toggleComercioFields();
    $('ownerRows').innerHTML = '';
    hideError('unitError');
}

function toggleComercioFields() {
    const isComercio = $('unitTipo').value === 'Comercio';
    $('unitComercioWrap').classList.toggle('hidden', !isComercio);
    if (!isComercio) {
        $('unitContribInmob').value = '';
        $('unitContribComercio').value = '';
    }
}

async function saveUnit() {
    hideError('unitError');
    const nombre = $('unitNombre').value.trim();
    const descripcion = $('unitDescripcion').value.trim();
    const tipo = $('unitTipo').value;
    const unitData = {
        id: unitEditId,
        nombre,
        descripcion,
        nomenclatura_catastral: $('unitNomenclatura').value.trim(),
        suministro_gas: $('unitSuministroGas').value.trim(),
        suministro_luz: $('unitSuministroLuz').value.trim(),
        suministro_agua: $('unitSuministroAgua').value.trim(),
        tipo,
        contribucion_inmobiliaria: tipo === 'Comercio' ? $('unitContribInmob').value.trim() : '',
        contribucion_comercio: tipo === 'Comercio' ? $('unitContribComercio').value.trim() : '',
        propietarios: {}
    };
    const ownerRows = document.querySelectorAll('.owner-row');
    const propietarios = {};
    let totalPct = 0;
    if (!nombre) return showError('unitError', 'El nombre es obligatorio.');
    for (const row of ownerRows) {
        const pName = row.querySelector('.owner-name').value.trim();
        const pPct = parseFloat(row.querySelector('.owner-pct').value);
        if (pName && !isNaN(pPct)) {
            propietarios[pName] = pPct / 100;
            totalPct += pPct;
        }
    }
    if (Object.keys(propietarios).length === 0) return showError('unitError', 'Añadí al menos un propietario.');
    if (Math.abs(totalPct - 100) > 0.1) {
        if (!confirm(`La suma de porcentajes es ${totalPct.toFixed(2)}%, no es exactamente 100%. ¿Deseas continuar?`)) return;
    }
    try {
        unitData.propietarios = propietarios;
        await apiFetch('/api/unidades', 'POST', unitData);
        resetUnitForm();
        await loadData();
    } catch (e) {
        showError('unitError', 'Error al guardar la unidad.');
    }
}

function renderUnits() {
    if (!allUnidades.length) { $('unitsTable').innerHTML = '<div class="empty">No hay unidades registradas.</div>'; return; }
    let html = '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Datos</th><th>Servicios / contribuciones</th><th>Propietarios</th><th>Acciones</th></tr></thead><tbody>';
    allUnidades.forEach(u => {
        const ownersText = Object.entries(u.propietarios).map(([n, p]) => `${n} (${(p * 100).toFixed(1)}%)`).join(', ');
        const contribucionesText = u.tipo === 'Comercio'
            ? `<div><strong>Contribución inmobiliaria:</strong> ${u.contribucion_inmobiliaria || '-'}</div><div><strong>Contribución comercio:</strong> ${u.contribucion_comercio || '-'}</div>`
            : '';
        html += `<tr>
            <td><strong>${u.nombre}</strong></td>
            <td><div class="unit-details">
                <div>${u.descripcion || '-'}</div>
                <div><strong>Nomenclatura:</strong> ${u.nomenclatura_catastral || '-'}</div>
                <div><strong>Tipo:</strong> ${u.tipo || 'Vivienda'}</div>
            </div></td>
            <td><div class="unit-details">
                <div><strong>Suministro de gas:</strong> ${u.suministro_gas || '-'}</div>
                <div><strong>Suministro de luz:</strong> ${u.suministro_luz || '-'}</div>
                <div><strong>Suministro de agua:</strong> ${u.suministro_agua || '-'}</div>
                ${contribucionesText}
            </div></td>
            <td>${ownersText}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-secondary mini" onclick="editUnit(${u.id})">Editar</button>
                    <button class="btn btn-danger mini" onclick="deleteUnit(${u.id})">Eliminar</button>
                </div>
            </td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    $('unitsTable').innerHTML = html;
}

function editUnit(id) {
    const u = allUnidades.find(x => x.id === id);
    if (!u) return;
    unitEditId = id;
    $('unitTitle').textContent = 'Editar Unidad';
    $('unitSaveBtn').textContent = 'Guardar Cambios';
    $('unitCancelBtn').classList.remove('hidden');
    $('unitNombre').value = u.nombre;
    $('unitDescripcion').value = u.descripcion || '';
    $('unitNomenclatura').value = u.nomenclatura_catastral || '';
    $('unitSuministroGas').value = u.suministro_gas || '';
    $('unitSuministroLuz').value = u.suministro_luz || '';
    $('unitSuministroAgua').value = u.suministro_agua || '';
    $('unitTipo').value = u.tipo || 'Vivienda';
    $('unitContribInmob').value = u.contribucion_inmobiliaria || '';
    $('unitContribComercio').value = u.contribucion_comercio || '';
    toggleComercioFields();
    $('ownerRows').innerHTML = '';
    Object.entries(u.propietarios).forEach(([n, p]) => addOwnerRow(n, p));
    openTab('unidades');
}

async function deleteUnit(id) {
    if (!confirm('¿Seguro? Se eliminarán también todos los movimientos y devengados asociados a esta unidad.')) return;
    try {
        await apiFetch(`/api/unidades/${id}`, 'DELETE');
        await loadData();
    } catch (e) {
        alert('Error al eliminar unidad');
    }
}

// MOVIMIENTOS
function resetMovForm(){
    movEditId = null; $('movTitle').textContent = 'Nuevo movimiento'; $('movSaveBtn').textContent = 'Guardar movimiento'; $('movCancelBtn').classList.add('hidden');
    hideError('movError'); $('movFecha').value = new Date().toISOString().split('T')[0]; $('movPeriodo').value = ''; $('movTipo').value = 'Ingreso'; fillConcepts(); $('movForma').value = 'Efectivo'; $('movImporte').value = ''; $('movObs').value = '';
}

async function saveMov(){
    hideError('movError');
    const data = { id: movEditId, fecha: $('movFecha').value, unidad: $('movUnidad').value, periodo: $('movPeriodo').value, tipo: $('movTipo').value, subtipo: $('movConcepto').value, forma: $('movForma').value, monto: Number($('movImporte').value), obs: $('movObs').value.trim() };
    if(!data.fecha || !data.periodo || !data.monto || data.monto <= 0){ showError('movError','Completá fecha, período e importe mayor a 0.'); return; }
    try { await apiFetch('/api/movimientos', 'POST', data); resetMovForm(); await loadData(); } catch (e) { showError('movError', 'Error al guardar el movimiento.'); }
}

function editMov(id){
    const item = allMovimientos.find(x => x.id == id); if(!item) return;
    movEditId = id; $('movTitle').textContent = 'Editar movimiento'; $('movSaveBtn').textContent = 'Guardar cambios'; $('movCancelBtn').classList.remove('hidden');
    $('movFecha').value = item.fecha; $('movUnidad').value = item.unidad; $('movPeriodo').value = item.periodo; $('movTipo').value = item.tipo; fillConcepts(); $('movConcepto').value = item.concepto; $('movForma').value = item.forma_pago || 'Efectivo'; $('movImporte').value = Math.abs(item.monto); $('movObs').value = item.observacion || ''; openTab('mov');
}

async function deleteMov(id){
    if(!confirm(`¿Eliminar este movimiento?`)) return;
    try { await apiFetch(`/api/movimientos/${id}`, 'DELETE'); await loadData(); } catch (e) { alert("Error al eliminar"); }
}

function renderMov(){
    if(!allMovimientos.length){ $('movTable').innerHTML = '<div class="empty">Todavía no cargaste movimientos.</div>'; return; }
    const grouped = {};
    allMovimientos.forEach(m => { if(!grouped[m.unidad]) grouped[m.unidad] = []; grouped[m.unidad].push(m); });
    let ingTotal = 0, egrTotal = 0;
    allMovimientos.forEach(r => { if(r.monto >= 0) ingTotal += r.monto; else egrTotal += Math.abs(r.monto); });
    let html = '<div class="note" style="margin-bottom: 12px;">Hacé click en una unidad para ver sus movimientos.</div>';
    Object.keys(grouped).sort().forEach(unidad => {
        const rows = grouped[unidad], unitId = `mov-${unidad.replace(/\s+/g, '')}`;
        html += `<div class="person-card" id="${unitId}"><div class="person-head" onclick="toggleCard('${unitId}')"><h3 style="margin:0">${unidad}</h3><div style="font-size: 12px; color: var(--text-muted);">${rows.length} movimientos</div></div><div class="person-body"><div class="table-wrap compact-table"><table><thead><tr><th>Fecha</th><th>Período</th><th>Concepto</th><th>Monto</th><th>Acciones</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.fecha}</td><td>${r.periodo}</td><td><span class="tag ${r.tipo==='Ingreso'?'income':'expense'}">${r.concepto}</span></td><td class="${r.monto>=0?'ok':'bad'}"><strong>${money(r.monto)}</strong></td><td><div class="actions"><button class="btn btn-secondary mini" onclick="editMov('${r.id}')">✏️</button><button class="btn btn-danger mini" onclick="deleteMov('${r.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div></div></div>`;
    });
    $('movTable').innerHTML = html; $('sumIngresos').textContent = money(ingTotal); $('sumEgresos').textContent = money(egrTotal); $('sumSaldo').textContent = money(ingTotal - egrTotal); $('sumSaldo').className = 'value ' + ((ingTotal - egrTotal) >= 0 ? 'ok' : 'bad');
}

// DISTRIBUCION
function renderDist(){
    const grouped = {};
    allMovimientos.forEach(m => {
        const unit = allUnidades.find(u => u.nombre === m.unidad);
        const owners = unit ? unit.propietarios : {};
        Object.entries(owners).forEach(([persona,p]) => { if(!grouped[persona]) grouped[persona] = []; grouped[persona].push({...m, porcentaje:p, importeAsignado:m.monto*p}); });
    });
    if(!Object.keys(grouped).length){ $('distContainer').innerHTML = '<div class="empty">Todavía no hay distribución generada.</div>'; return; }
    let html = '<div class="note" style="margin-bottom: 12px;">Hacé click en el nombre de un propietario para ver el detalle.</div>';
    Object.keys(grouped).sort().forEach(persona => {
        const rows = grouped[persona], total = rows.reduce((a,r) => a + r.importeAsignado, 0);
        html += `<div class="person-card" id="card-${persona.replace(/\s+/g, '')}"><div class="person-head" onclick="toggleCard('card-${persona.replace(/\s+/g, '')}')"><h3 style="margin:0">${persona}</h3><div class="person-total ${total>=0?'ok':'bad'}">${money(total)}</div></div><div class="person-body"><div class="table-wrap compact-table"><table><thead><tr><th>Unidad</th><th>Concepto</th><th>Fecha</th><th>Original</th><th>%</th><th>Neto</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.unidad}</td><td>${r.concepto}</td><td>${r.fecha}</td><td>${money(r.monto)}</td><td>${(r.porcentaje*100).toFixed(1)}%</td><td class="${r.importeAsignado>=0?'ok':'bad'}"><strong>${money(r.importeAsignado)}</strong></td></tr>`).join('')}</tbody></table></div></div></div>`;
    });
    $('distContainer').innerHTML = html;
}

function toggleCard(id) { const el = document.getElementById(id); if (el) el.classList.toggle('open'); }
window.toggleCard = toggleCard;

// DEVENGADOS
function resetDevForm(){
    devEditId = null; $('devTitle').textContent = 'Nuevo devengado'; $('devSaveBtn').textContent = 'Guardar devengado'; $('devCancelBtn').classList.add('hidden');
    hideError('devError'); $('devPeriodo').value = ''; $('devEstado').value = 'Alquilado'; $('devImporte').value = ''; $('devObs').value = '';
}
async function saveDev(){
    const data = { id: devEditId, unidad: $('devUnidad').value, periodo: $('devPeriodo').value, estado: $('devEstado').value, importe: Number($('devImporte').value || 0), obs: $('devObs').value.trim() };
    if(!data.periodo){ showError('devError', 'Completá el período.'); return; }
    try { await apiFetch('/api/devengados', 'POST', data); resetDevForm(); await loadData(); } catch (e) { showError('devError', 'Error al guardar devengado.'); }
}
function editDev(id){
    const item = allDevengados.find(x => x.id == id); if(!item) return;
    devEditId = id; $('devTitle').textContent = 'Editar devengado'; $('devSaveBtn').textContent = 'Guardar cambios'; $('devCancelBtn').classList.remove('hidden');
    $('devUnidad').value = item.unidad; $('devPeriodo').value = item.periodo; $('devEstado').value = item.estado; $('devImporte').value = item.monto; $('devObs').value = item.observacion || ''; openTab('dev');
}
async function deleteDev(id){
    if(!confirm(`¿Eliminar devengado?`)) return;
    try { await apiFetch(`/api/devengados/${id}`, 'DELETE'); await loadData(); } catch (e) { alert("Error al eliminar"); }
}
function renderDev(){
    if(!allDevengados.length){ $('devTable').innerHTML = '<div class="empty">Todavía no cargaste devengados.</div>'; return; }
    let html = '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Período</th><th>Estado</th><th>Monto</th><th>Acciones</th></tr></thead><tbody>' +
        allDevengados.map(r => `<tr><td>${r.unidad}</td><td>${r.periodo}</td><td><span class="status-chip">${r.estado}</span></td><td class="ok"><strong>${money(r.monto)}</strong></td><td><div class="actions"><button class="btn btn-secondary mini" onclick="editDev('${r.id}')">✏️</button><button class="btn btn-danger mini" onclick="deleteDev('${r.id}')">✕</button></div></td></tr>`).join('') + '</tbody></table></div>';
    $('devTable').innerHTML = html;
}

// CUENTA CORRIENTE
function renderResumenCuenta(){
    const totalDev = allDevengados.filter(d => d.estado === 'Alquilado').reduce((a,b)=>a + b.monto, 0);
    const totalCob = allMovimientos.filter(m => m.tipo === 'Ingreso' && m.concepto.toLowerCase() === 'alquiler').reduce((a,b)=>a + b.monto, 0);
    const saldo = totalDev - totalCob;
    $('resumenGeneral').innerHTML = `<div class="mobile-cards"><div class="mobile-card"><div class="title">Total devengado</div><div class="amount bad">${money(totalDev)}</div></div><div class="mobile-card"><div class="title">Total cobrado</div><div class="amount ok">${money(totalCob)}</div></div><div class="mobile-card"><div class="title">Saldo pendiente</div><div class="amount ${saldo >= 0 ? 'bad' : 'ok'}">${money(saldo)}</div></div></div>`;
}
function renderDeudaUnidad(){
    const unidades = {};
    allDevengados.filter(d => d.estado === 'Alquilado').forEach(d => { if(!unidades[d.unidad]) unidades[d.unidad] = {dev:0, cob:0}; unidades[d.unidad].dev += d.monto; });
    allMovimientos.filter(m => m.tipo === 'Ingreso' && m.concepto.toLowerCase() === 'alquiler').forEach(m => { if(!unidades[m.unidad]) unidades[m.unidad] = {dev:0, cob:0}; unidades[m.unidad].cob += m.monto; });
    const arr = Object.entries(unidades).map(([u,v]) => ({unidad:u, dev:v.dev, cob:v.cob, saldo:v.dev - v.cob})).sort((a,b) => b.saldo - a.saldo);
    if(!arr.length){ $('deudaUnidad').innerHTML = '<div class="empty">No hay datos de alquiler.</div>'; return; }
    $('deudaUnidad').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Devengado</th><th>Cobrado</th><th>Saldo</th></tr></thead><tbody>' + arr.map(r => `<tr><td>${r.unidad}</td><td class="bad">${money(r.dev)}</td><td class="ok">${money(r.cob)}</td><td><strong class="${r.saldo > 0 ? 'bad' : 'ok'}">${money(r.saldo)}</strong></td></tr>`).join('') + '</tbody></table></div>';
}
function renderCuenta(){
    const unidad = $('ccUnidad').value;
    const rows = [];
    allDevengados.filter(d => d.unidad === unidad && d.estado === 'Alquilado').forEach(d => rows.push({fecha: d.periodo + '-01', periodo: d.periodo, concepto: 'Devengado', debe: d.monto, haber: 0}));
    allMovimientos.filter(m => m.unidad === unidad && m.tipo === 'Ingreso' && m.concepto.toLowerCase() === 'alquiler').forEach(m => rows.push({fecha: m.fecha, periodo: m.periodo, concepto: 'Cobro', debe: 0, haber: m.monto}));
    rows.sort((a,b) => a.fecha.localeCompare(b.fecha));
    if(!rows.length){ $('ccTable').innerHTML = '<div class="empty">Sin movimientos de alquiler.</div>'; return; }
    let saldo = 0;
    $('ccTable').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Período</th><th>Concepto</th><th>Debe</th><th>Haber</th><th>Saldo</th></tr></thead><tbody>' + rows.map(r => { saldo += r.debe - r.haber; return `<tr><td>${r.fecha}</td><td>${r.periodo}</td><td>${r.concepto}</td><td class="bad">${r.debe ? money(r.debe) : ''}</td><td class="ok">${r.haber ? money(r.haber) : ''}</td><td><strong class="${saldo > 0 ? 'bad' : 'ok'}">${money(saldo)}</strong></td></tr>` }).join('') + '</tbody></table></div>';
}

// SITUACION
function resetSitForm(){
    sitEditId = null;
    $('sitTitle').textContent = 'Editar situación';
    $('sitSaveBtn').textContent = 'Guardar cambios';
    $('sitCancelBtn').classList.add('hidden');
    hideError('sitError');
    $('sitEstado').value = 'Activa';
    $('sitInicio').value = '';
    $('sitDuracion').value = '';
    $('sitActualizacion').value = '';
    $('sitImporte').value = '';
    $('sitInquilinoNombre').value = '';
    $('sitInquilinoDni').value = '';
    $('sitGarante1Nombre').value = '';
    $('sitGarante1Dni').value = '';
    $('sitGarante2Nombre').value = '';
    $('sitGarante2Dni').value = '';
    $('sitObs').value = '';
}

function renderSit(){
    if(!allSituaciones.length){ $('sitTable').innerHTML = '<div class="empty">Todavía no cargaste situaciones.</div>'; return; }
    const selP = $('genPeriodo').value;
    let targetDate = selP ? new Date(selP.split('-')[0], selP.split('-')[1]-1, 1) : new Date();
    const htmlRows = allSituaciones.map(s => {
        let alertHtml = '';
        if (s.estado === 'Activa' && s.inicio_contrato && s.actualizacion_meses) {
            const [sy, sm] = s.inicio_contrato.split('-').map(Number);
            const tm = (targetDate.getFullYear() - sy) * 12 + (targetDate.getMonth() + 1 - sm);
            if (tm > 0 && (tm + 1) % s.actualizacion_meses === 0) alertHtml = '<br><span class="alert-badge">AVISO: ACTUALIZAR PRÓXIMO MES</span>';
            else if (tm > 0 && tm % s.actualizacion_meses === 0) alertHtml = '<br><span class="alert-badge" style="background:var(--red);color:white;">ALERTA: ACTUALIZAR AHORA</span>';
        }
        const garantes = [
            s.garante1_nombre ? `${s.garante1_nombre}${s.garante1_dni ? ' - DNI ' + s.garante1_dni : ''}` : '',
            s.garante2_nombre ? `${s.garante2_nombre}${s.garante2_dni ? ' - DNI ' + s.garante2_dni : ''}` : ''
        ].filter(Boolean).join('<br>') || '-';
        const inquilino = s.inquilino_nombre ? `${s.inquilino_nombre}${s.inquilino_dni ? '<br>DNI ' + s.inquilino_dni : ''}` : '-';
        return `<tr><td><strong>${s.unidad}</strong>${alertHtml}</td><td><span class="status-chip">${s.estado}</span></td><td>${inquilino}</td><td>${garantes}</td><td class="${alertHtml ? 'warning' : ''}"><strong>${money(s.importe_vigente)}</strong></td><td><button class="btn btn-secondary mini" onclick="editSit('${s.unidad}')">Editar</button></td></tr>`;
    }).join('');
    $('sitTable').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Estado</th><th>Inquilino</th><th>Garantes</th><th>Vigente</th><th>Acciones</th></tr></thead><tbody>' + htmlRows + '</tbody></table></div>';
}

async function saveSit(){
    const data = {
        unidad: $('sitUnidad').value,
        estado: $('sitEstado').value,
        inicio: $('sitInicio').value,
        duracion: $('sitDuracion').value,
        actualizacion: $('sitActualizacion').value,
        importe: $('sitImporte').value,
        inquilino_nombre: $('sitInquilinoNombre').value.trim(),
        inquilino_dni: $('sitInquilinoDni').value.trim(),
        garante1_nombre: $('sitGarante1Nombre').value.trim(),
        garante1_dni: $('sitGarante1Dni').value.trim(),
        garante2_nombre: $('sitGarante2Nombre').value.trim(),
        garante2_dni: $('sitGarante2Dni').value.trim(),
        obs: $('sitObs').value.trim()
    };
    try { await apiFetch('/api/situacion', 'POST', data); resetSitForm(); await loadData(); } catch (e) { showError('sitError', 'Error al guardar situación.'); }
}

function editSit(un) {
    const item = allSituaciones.find(x => x.unidad === un);
    if(!item) { $('sitUnidad').value = un; resetSitForm(); return; }
    $('sitTitle').textContent = 'Editar situación'; $('sitSaveBtn').textContent = 'Guardar cambios'; $('sitCancelBtn').classList.remove('hidden');
    $('sitUnidad').value = item.unidad; $('sitEstado').value = item.estado; $('sitInicio').value = item.inicio_contrato || ''; $('sitDuracion').value = item.duracion_meses || ''; $('sitActualizacion').value = item.actualizacion_meses || ''; $('sitImporte').value = item.importe_vigente || ''; $('sitInquilinoNombre').value = item.inquilino_nombre || ''; $('sitInquilinoDni').value = item.inquilino_dni || ''; $('sitGarante1Nombre').value = item.garante1_nombre || ''; $('sitGarante1Dni').value = item.garante1_dni || ''; $('sitGarante2Nombre').value = item.garante2_nombre || ''; $('sitGarante2Dni').value = item.garante2_dni || ''; $('sitObs').value = item.observacion || '';
}

async function generarDevengadoDesdeSituacion(){
    const p = $('genPeriodo').value; if(!p) return alert("Seleccioná un período");
    try { const res = await apiFetch('/api/generar_devengados', 'POST', {periodo:p}); alert(`Se generaron ${res.count} devengados.`); await loadData(); } catch (e) { alert("Error al generar devengados"); }
}

// INFORMES
function applyFilters(){
    const d = $('infDesde').value, h = $('infHasta').value, t = $('infTipo').value;
    const us = Array.from($('infUnidades').selectedOptions).map(o => o.value);
    const cs = Array.from($('infConceptos').selectedOptions).map(o => o.value);
    let filtered = allMovimientos.filter(m => {
        if(d && m.fecha < d) return false; if(h && m.fecha > h) return false; if(t && m.tipo !== t) return false;
        if(us.length && !us.includes(m.unidad)) return false; if(cs.length && !cs.includes(m.concepto)) return false;
        return true;
    });
    renderReport(filtered);
}

function renderReport(fm){
    const el = $('infTable');
    if (fm.length === allMovimientos.length) {
        const ud = {}; allUnidades.forEach(u => { ud[u.nombre] = { dev: 0, cob: 0 }; });
        allDevengados.forEach(d => { if(ud[d.unidad] && d.estado === 'Alquilado') ud[d.unidad].dev += d.monto; });
        allMovimientos.forEach(m => { if(ud[m.unidad] && m.tipo === 'Ingreso' && m.concepto.toLowerCase() === 'alquiler') ud[m.unidad].cob += m.monto; });
        const arr = Object.entries(ud).map(([u,v]) => ({ unidad: u, dev: v.dev, cob: v.cob, deuda: v.dev - v.cob })).sort((a,b) => b.deuda - a.deuda);
        el.innerHTML = `<h3 style="margin-bottom:15px; color:var(--text-muted); font-size:16px;">📊 Resumen General de Deudas (Alquiler)</h3><div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Devengado</th><th>Cobrado</th><th>Estado</th></tr></thead><tbody>${arr.map(r => `<tr><td><strong>${r.unidad}</strong></td><td>${money(r.dev)}</td><td>${money(r.cob)}</td><td class="${r.deuda > 0 ? 'bad' : 'ok'}"><strong>${r.deuda > 0 ? 'DEBE ' + money(r.deuda) : (r.deuda < 0 ? 'A FAVOR ' + money(Math.abs(r.deuda)) : 'AL DÍA')}</strong></td></tr>`).join('')}</tbody></table></div>`;
    } else {
        if(!fm.length) { el.innerHTML = '<div class="empty">Sin resultados.</div>'; return; }
        let rt = 0;
        el.innerHTML = `<h3 style="margin-bottom:15px; color:var(--text-muted); font-size:16px;">🔍 Resultados</h3><div class="table-wrap compact-table"><table><thead><tr><th>Fecha</th><th>Unidad</th><th>Concepto</th><th>Monto</th><th>Acumulado</th></tr></thead><tbody>${fm.map(r => { rt += r.monto; return `<tr><td>${r.fecha}</td><td><strong>${r.unidad}</strong></td><td>${r.concepto}</td><td class="${r.monto>=0?'ok':'bad'}">${money(r.monto)}</td><td><strong>${money(rt)}</strong></td></tr>`; }).join('')}</tbody></table></div>`;
    }
}

function renderAll(){ fillAllSelects(); renderMov(); renderDist(); renderDev(); renderResumenCuenta(); renderDeudaUnidad(); renderCuenta(); renderSit(); renderUnits(); renderReport(allMovimientos); }

// Event Listeners
$('movTipo').addEventListener('change', fillConcepts);
$('movSaveBtn').addEventListener('click', saveMov);
$('movCancelBtn').addEventListener('click', resetMovForm);
$('devSaveBtn').addEventListener('click', saveDev);
$('devCancelBtn').addEventListener('click', resetDevForm);
$('infApplyBtn').addEventListener('click', applyFilters);
$('infClearBtn').addEventListener('click', () => { $('infDesde').value = ''; $('infHasta').value = ''; $('infTipo').value = ''; $('infUnidades').selectedIndex = -1; $('infConceptos').selectedIndex = -1; renderReport(allMovimientos); });
$('ccUnidad').addEventListener('change', renderCuenta);
$('sitSaveBtn').addEventListener('click', saveSit);
$('sitCancelBtn').addEventListener('click', () => { sitEditId = null; resetSitForm(); });
$('genDevBtn').addEventListener('click', generarDevengadoDesdeSituacion);
$('genPeriodo').addEventListener('change', renderSit);
$('unitSaveBtn').addEventListener('click', saveUnit);
$('unitCancelBtn').addEventListener('click', resetUnitForm);
$('addOwnerBtn').addEventListener('click', () => addOwnerRow());
$('unitTipo').addEventListener('change', toggleComercioFields);
$('themeToggle').addEventListener('click', () => { const isL = document.body.classList.toggle('light-mode'); localStorage.setItem('theme', isL ? 'light' : 'dark'); });
document.querySelectorAll('.tab-btn').forEach(btn => { btn.addEventListener('click', () => openTab(btn.dataset.tab)); });

window.editMov = editMov; window.deleteMov = deleteMov; window.editDev = editDev; window.deleteDev = deleteDev; 
window.editSit = editSit; window.editUnit = editUnit; window.deleteUnit = deleteUnit;

document.addEventListener('DOMContentLoaded', () => { if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode'); loadData(); });
