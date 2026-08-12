/**
 * pedidos.js — Encargos con fecha de entrega, estados y abonos
 *
 * Un negocio de alfajores vende por encargo, no por mostrador. Este módulo
 * modela ese flujo: se toma el pedido, se produce, se entrega y recién ahí
 * se convierte en venta.
 */

const ESTADOS_PEDIDO = {
  pendiente:  { label: 'Pendiente',     icon: '📝',   badge: 'badge-orange' },
  produccion: { label: 'En producción', icon: '👩‍🍳', badge: 'badge-purple' },
  listo:      { label: 'Listo',         icon: '📦',   badge: 'badge-pink'   },
  entregado:  { label: 'Entregado',     icon: '✅',   badge: 'badge-teal'   },
  cancelado:  { label: 'Cancelado',     icon: '❌',   badge: 'badge-red'    }
};

function badgeEstadoPedido(estado) {
  const e = ESTADOS_PEDIDO[estado] || ESTADOS_PEDIDO.pendiente;
  return `<span class="badge ${e.badge}">${e.icon} ${e.label}</span>`;
}
window.badgeEstadoPedido = badgeEstadoPedido;

function nombreClientePedido(p) {
  if (p.clienteId) {
    const c = DB.get('clientes', []).find(c => c.id === p.clienteId);
    if (c) return c.nombre;
  }
  return p.cliente || 'Sin cliente';
}

function saldoPedido(p) {
  return Math.max(0, (p.total || 0) - (p.abonado || 0));
}
window.nombreClientePedido = nombreClientePedido;
window.saldoPedido = saldoPedido;

// Estado temporal del formulario
let _pedidoItems = [];

function initPedidos() {
  const pedidos = DB.get('pedidos', []);
  const hoy     = Utils.today();

  const abiertos  = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
  const atrasados = abiertos.filter(p => Utils.diasEntre(hoy, p.fechaEntrega) < 0);
  const paraHoy   = abiertos.filter(p => p.fechaEntrega === hoy);
  const semana    = abiertos.filter(p => {
    const d = Utils.diasEntre(hoy, p.fechaEntrega);
    return d > 0 && d <= 7;
  });
  const porCobrar = pedidos
    .filter(p => p.estado !== 'cancelado')
    .reduce((s, p) => s + saldoPedido(p), 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">🎁 Pedidos</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="abrirFormPedido()">+ Nuevo pedido</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card ${atrasados.length ? 'pink' : 'purple'}">
        <div class="stat-icon">${atrasados.length ? '🚨' : '📋'}</div>
        <div class="stat-value">${atrasados.length || abiertos.length}</div>
        <div class="stat-label">${atrasados.length ? 'Atrasados' : 'Pedidos abiertos'}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${paraHoy.length}</div>
        <div class="stat-label">Entregar hoy</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">🗓</div>
        <div class="stat-value">${semana.length}</div>
        <div class="stat-label">Próximos 7 días</div>
      </div>
      <div class="stat-card ${porCobrar > 0 ? 'orange' : 'teal'}">
        <div class="stat-icon">💰</div>
        <div class="stat-value">${Utils.formatMoney(porCobrar)}</div>
        <div class="stat-label">Por cobrar</div>
      </div>
    </div>
  `;

  if (!pedidos.length) {
    html += `<div class="empty-state"><div class="empty-icon">🎁</div>
      <p>Sin pedidos todavía.<br>Cargá los encargos con su fecha de entrega y no se te pasa ninguno.</p>
      <button class="btn btn-primary" style="margin-top:1rem" onclick="abrirFormPedido()">+ Cargar el primero</button></div>`;
    document.getElementById('moduleContainer').innerHTML = html;
    return;
  }

  html += `
    <div class="tabs">
      <button class="tab-btn active" onclick="pedidosTabs(this,'agenda')">📅 Agenda</button>
      <button class="tab-btn" onclick="pedidosTabs(this,'abiertos')">Abiertos (${abiertos.length})</button>
      <button class="tab-btn" onclick="pedidosTabs(this,'todos')">Todos (${pedidos.length})</button>
    </div>

    <div id="ped-agenda" class="tab-pane active">${renderAgenda(abiertos, hoy)}</div>
    <div id="ped-abiertos" class="tab-pane">${renderListaPedidos(abiertos)}</div>
    <div id="ped-todos" class="tab-pane">${renderListaPedidos(pedidos.slice().reverse())}</div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function pedidosTabs(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ped-' + id)?.classList.add('active');
}
window.pedidosTabs = pedidosTabs;

/** Agenda agrupada: lo primero que necesita ver a la mañana. */
function renderAgenda(abiertos, hoy) {
  if (!abiertos.length) {
    return `<div class="empty-state"><div class="empty-icon">🎉</div><p>No hay pedidos pendientes. ¡Todo entregado!</p></div>`;
  }

  const grupos = { atrasado: [], hoy: [], semana: [], despues: [] };
  abiertos.forEach(p => {
    const d = Utils.diasEntre(hoy, p.fechaEntrega);
    if (d < 0) grupos.atrasado.push(p);
    else if (d === 0) grupos.hoy.push(p);
    else if (d <= 7) grupos.semana.push(p);
    else grupos.despues.push(p);
  });

  const orden = (a, b) => (a.fechaEntrega || '').localeCompare(b.fechaEntrega || '');
  const seccion = (titulo, lista, clase) => lista.length ? `
    <div class="agenda-grupo ${clase}">
      <div class="agenda-titulo">${titulo} <span class="badge badge-purple">${lista.length}</span></div>
      ${lista.sort(orden).map(p => renderPedidoCard(p)).join('')}
    </div>` : '';

  return seccion('🚨 Atrasados', grupos.atrasado, 'atrasado')
       + seccion('📅 Para hoy', grupos.hoy, 'hoy')
       + seccion('🗓 Próximos 7 días', grupos.semana, '')
       + seccion('📆 Más adelante', grupos.despues, '');
}

function renderListaPedidos(lista) {
  if (!lista.length) return `<div class="empty-state"><div class="empty-icon">🎁</div><p>Sin pedidos en esta vista</p></div>`;
  return lista.map(p => renderPedidoCard(p)).join('');
}

function renderPedidoCard(p) {
  const saldo   = saldoPedido(p);
  const cliente = nombreClientePedido(p);
  const dias    = Utils.diasEntre(Utils.today(), p.fechaEntrega);
  const abierto = p.estado !== 'entregado' && p.estado !== 'cancelado';

  let cuando = Utils.formatDate(p.fechaEntrega);
  if (abierto) {
    if (dias < 0) cuando = `<span style="color:#ff4466;font-weight:700">${cuando} · atrasado ${-dias} día${dias === -1 ? '' : 's'}</span>`;
    else if (dias === 0) cuando = `<span style="color:var(--orange);font-weight:700">${cuando} · ¡es hoy!</span>`;
    else if (dias === 1) cuando = `${cuando} · mañana`;
    else cuando = `${cuando} · en ${dias} días`;
  }

  // Aviso de stock: ¿alcanza lo producido para este pedido?
  const faltantes = (p.items || []).filter(it => it.recetaId && Stock.disponible(it.recetaId) < it.cantidad);

  return `
    <div class="card pedido-card ${p.estado}" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h3 style="font-family:var(--font-display);font-weight:800;font-size:1.05rem">
            ${Utils.escHtml(cliente)} ${badgeEstadoPedido(p.estado)}
          </h3>
          <p style="color:var(--text-muted);font-size:0.84rem;margin-top:3px">🚚 Entrega: ${cuando}</p>
          ${p.notas ? `<p style="color:var(--text-muted);font-size:0.82rem;margin-top:3px">📝 ${Utils.escHtml(p.notas)}</p>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.25rem;color:var(--teal)">${Utils.formatMoney(p.total)}</div>
          ${p.abonado > 0 ? `<div style="font-size:0.78rem;color:var(--text-muted)">Abonado ${Utils.formatMoney(p.abonado)}</div>` : ''}
          ${saldo > 0
            ? `<div style="font-size:0.82rem;color:#ff4466;font-weight:700">Saldo ${Utils.formatMoney(saldo)}</div>`
            : `<div style="font-size:0.82rem;color:var(--teal);font-weight:700">✅ Pagado</div>`}
        </div>
      </div>

      <div style="margin:0.8rem 0">
        ${(p.items || []).map(it => `<span class="ing-tag">
          ${Utils.escHtml(it.nombre)} × ${it.cantidad} — ${Utils.formatMoney(it.subtotal)}
        </span>`).join('')}
      </div>

      ${abierto && faltantes.length ? `
        <div class="alert alert-warning" style="margin:0.6rem 0;font-size:0.83rem">
          ⚠️ No tenés stock suficiente de ${faltantes.map(f => Utils.escHtml(f.nombre)).join(', ')}.
          <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="Router.go('produccion')">Ir a producir</button>
        </div>` : ''}

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:0.8rem">
        ${abierto ? `
          ${p.estado === 'pendiente'  ? `<button class="btn btn-sm btn-secondary" onclick="cambiarEstadoPedido('${p.id}','produccion')">👩‍🍳 En producción</button>` : ''}
          ${p.estado === 'produccion' ? `<button class="btn btn-sm btn-secondary" onclick="cambiarEstadoPedido('${p.id}','listo')">📦 Marcar listo</button>` : ''}
          <button class="btn btn-sm btn-success" onclick="abrirEntregaPedido('${p.id}')">✅ Entregar</button>
          ${saldo > 0 ? `<button class="btn btn-sm btn-secondary" onclick="abrirAbonoPedido('${p.id}')">💳 Abono</button>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="abrirFormPedido('${p.id}')">✏️</button>
        ` : ''}
        <button class="btn btn-sm btn-secondary" onclick="compartirPedido('${p.id}')" title="Copiar resumen">📤</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarPedido('${p.id}')" title="Eliminar">🗑</button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────
// FORMULARIO
// ─────────────────────────────────────────
function abrirFormPedido(id = null) {
  const recetas  = DB.get('recetas', []);
  const clientes = DB.get('clientes', []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  const ped      = id ? DB.get('pedidos', []).find(p => p.id === id) : null;

  if (!recetas.length) { toast('Primero creá al menos una receta', 'warning'); return; }

  _pedidoItems = ped ? JSON.parse(JSON.stringify(ped.items || [])) : [];

  // Por defecto, entrega en 3 días
  const enTresDias = Utils.toISODate(new Date(Date.now() + 3 * 86400000));

  Modal.show(ped ? 'Editar pedido' : '🎁 Nuevo pedido', `
    <div class="form-group">
      <label>Cliente</label>
      <select id="pedClienteId" onchange="togglePedidoClienteLibre()">
        <option value="">— Elegir cliente —</option>
        ${clientes.map(c => `<option value="${c.id}" ${ped?.clienteId === c.id ? 'selected' : ''}>${Utils.escHtml(c.nombre)}</option>`).join('')}
        <option value="_libre" ${ped && !ped.clienteId ? 'selected' : ''}>✍️ Escribir un nombre suelto</option>
      </select>
    </div>
    <div class="form-group" id="pedClienteLibreWrap" style="display:${ped && !ped.clienteId ? 'block' : 'none'}">
      <label>Nombre del cliente</label>
      <input type="text" id="pedCliente" value="${Utils.escHtml(ped?.cliente || '')}" placeholder="Nombre o apodo" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Fecha de entrega *</label>
        <input type="date" id="pedFechaEntrega" value="${ped?.fechaEntrega || enTresDias}" />
      </div>
      <div class="form-group">
        <label>Seña / abono inicial</label>
        <input type="number" id="pedAbono" value="${ped?.abonado || ''}" min="0" step="0.01" placeholder="0" />
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
      <p style="font-weight:700;margin-bottom:0.75rem">Productos del pedido</p>
      <div id="pedItemsList" style="margin-bottom:0.75rem"></div>

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:2;min-width:130px">
          <label style="font-size:0.78rem">Producto</label>
          <select id="pedSelReceta" onchange="autoPrecioItem()">
            ${recetas.map(r => `<option value="${r.id}" data-precio="${r.precioVenta || 0}">${Utils.escHtml(r.nombre)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:70px">
          <label style="font-size:0.78rem">Cant.</label>
          <input type="number" id="pedSelCant" value="12" min="1" step="1" />
        </div>
        <div style="flex:1;min-width:80px">
          <label style="font-size:0.78rem">Precio un.</label>
          <input type="number" id="pedSelPrecio" min="0" step="0.01" placeholder="0" />
        </div>
        <button class="btn btn-secondary btn-sm" onclick="agregarItemPedido()">+ Agregar</button>
      </div>
    </div>

    <div class="form-group" style="margin-top:1rem">
      <label>Notas del pedido</label>
      <input type="text" id="pedNotas" value="${Utils.escHtml(ped?.notas || '')}" placeholder="Ej: sin nuez, entregar en el trabajo" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarPedido('${id || ''}')">Guardar pedido</button>`);

  autoPrecioItem();
  renderItemsPedido();
}

function togglePedidoClienteLibre() {
  const sel = document.getElementById('pedClienteId');
  const wrap = document.getElementById('pedClienteLibreWrap');
  if (wrap) wrap.style.display = sel.value === '_libre' ? 'block' : 'none';
}
window.togglePedidoClienteLibre = togglePedidoClienteLibre;

function autoPrecioItem() {
  const sel = document.getElementById('pedSelReceta');
  const opt = sel?.options[sel.selectedIndex];
  const precio = parseFloat(opt?.dataset?.precio || 0);
  const input = document.getElementById('pedSelPrecio');
  if (input) input.value = precio > 0 ? precio : '';
}
window.autoPrecioItem = autoPrecioItem;

function agregarItemPedido() {
  const recetaId = document.getElementById('pedSelReceta').value;
  const cantidad = parseInt(document.getElementById('pedSelCant').value) || 0;
  const precio   = parseFloat(document.getElementById('pedSelPrecio').value) || 0;

  if (!recetaId || cantidad <= 0) { toast('Elegí producto y cantidad', 'warning'); return; }
  if (precio <= 0) { toast('Poné el precio por unidad', 'warning'); return; }

  const receta = DB.get('recetas', []).find(r => r.id === recetaId);
  const existente = _pedidoItems.findIndex(it => it.recetaId === recetaId && it.precioUnit === precio);
  if (existente >= 0) {
    _pedidoItems[existente].cantidad += cantidad;
    _pedidoItems[existente].subtotal = _pedidoItems[existente].cantidad * precio;
  } else {
    _pedidoItems.push({
      recetaId,
      nombre: receta?.nombre || 'Producto',
      cantidad,
      precioUnit: precio,
      subtotal: cantidad * precio
    });
  }
  renderItemsPedido();
}
window.agregarItemPedido = agregarItemPedido;

function quitarItemPedido(idx) {
  _pedidoItems.splice(idx, 1);
  renderItemsPedido();
}
window.quitarItemPedido = quitarItemPedido;

function renderItemsPedido() {
  const cont = document.getElementById('pedItemsList');
  if (!cont) return;

  if (!_pedidoItems.length) {
    cont.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem">Sin productos agregados todavía</p>`;
    return;
  }

  const total = _pedidoItems.reduce((s, it) => s + it.subtotal, 0);
  cont.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>
        ${_pedidoItems.map((it, i) => {
          const disp = it.recetaId ? Stock.disponible(it.recetaId) : null;
          return `<tr>
            <td>${Utils.escHtml(it.nombre)}
              ${disp != null && disp < it.cantidad ? `<br><span class="badge badge-red">stock: ${disp}</span>` : ''}</td>
            <td>${it.cantidad}</td>
            <td>${Utils.formatMoney(it.precioUnit)}</td>
            <td style="font-weight:700">${Utils.formatMoney(it.subtotal)}</td>
            <td><button class="btn btn-sm btn-danger btn-icon" onclick="quitarItemPedido(${i})">✕</button></td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="3" style="text-align:right;font-weight:700">TOTAL</td>
        <td style="font-weight:900;color:var(--teal)">${Utils.formatMoney(total)}</td><td></td>
      </tr></tfoot>
    </table></div>
  `;
}

function guardarPedido(id) {
  const selCliente = document.getElementById('pedClienteId').value;
  const fechaEntrega = document.getElementById('pedFechaEntrega').value;
  const abonado = parseFloat(document.getElementById('pedAbono').value) || 0;
  const notas   = document.getElementById('pedNotas').value.trim();

  if (!_pedidoItems.length) { toast('Agregá al menos un producto', 'warning'); return; }
  if (!fechaEntrega) { toast('Poné la fecha de entrega', 'warning'); return; }

  const clienteId = (selCliente && selCliente !== '_libre') ? selCliente : null;
  const cliente = selCliente === '_libre'
    ? (document.getElementById('pedCliente')?.value.trim() || '')
    : '';
  if (!clienteId && !cliente) { toast('Elegí un cliente o escribí un nombre', 'warning'); return; }

  const total = _pedidoItems.reduce((s, it) => s + it.subtotal, 0);
  if (abonado > total) { toast('El abono no puede ser mayor al total', 'warning'); return; }

  const pedidos = DB.get('pedidos', []);

  if (id) {
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx < 0) return;
    const abonoPrevio = pedidos[idx].abonado || 0;
    pedidos[idx] = {
      ...pedidos[idx],
      clienteId, cliente, fechaEntrega, notas,
      items: _pedidoItems, total, abonado
    };
    DB.set('pedidos', pedidos);

    // Reflejar el cambio de abono en la caja
    if (abonado !== abonoPrevio) {
      CajaDB.removeByRef(id);
      if (abonado > 0) registrarAbonoEnCaja(pedidos[idx], abonado, 'Abono');
    }
    toast('Pedido actualizado ✅', 'success');
  } else {
    const nuevo = {
      id: Utils.uid(),
      clienteId, cliente,
      items: _pedidoItems,
      total,
      abonado,
      fechaPedido: Utils.today(),
      fechaEntrega,
      estado: 'pendiente',
      notas,
      metodo: 'Efectivo',
      ventaIds: []
    };
    pedidos.push(nuevo);
    DB.set('pedidos', pedidos);
    if (abonado > 0) registrarAbonoEnCaja(nuevo, abonado, 'Seña');
    toast('Pedido creado ✅', 'success');
  }

  Modal.hide();
  initPedidos();
}
window.guardarPedido = guardarPedido;

/**
 * La seña entra a la caja cuando se recibe, no cuando se entrega el pedido.
 * Por eso las ventas de un pedido NO generan su propio ingreso: si no,
 * la seña se contaría dos veces.
 */
function registrarAbonoEnCaja(pedido, monto, concepto) {
  CajaDB.add({
    tipo: 'ingreso',
    concepto: `${concepto} pedido: ${nombreClientePedido(pedido)}`,
    monto,
    fecha: Utils.today(),
    metodo: pedido.metodo || 'Efectivo',
    origen: 'abono',
    refId: pedido.id
  });
}

// ─────────────────────────────────────────
// ESTADOS / ABONOS / ENTREGA
// ─────────────────────────────────────────
function cambiarEstadoPedido(id, estado) {
  const pedidos = DB.get('pedidos', []);
  const idx = pedidos.findIndex(p => p.id === id);
  if (idx < 0) return;
  pedidos[idx].estado = estado;
  DB.set('pedidos', pedidos);
  toast(`Pedido: ${ESTADOS_PEDIDO[estado]?.label || estado}`, 'info');
  initPedidos();
}
window.cambiarEstadoPedido = cambiarEstadoPedido;

function abrirAbonoPedido(id) {
  const p = DB.get('pedidos', []).find(p => p.id === id);
  if (!p) return;
  const saldo = saldoPedido(p);

  Modal.show('💳 Registrar abono', `
    <div class="sim-result" style="margin-top:0;margin-bottom:1rem">
      <div class="sim-row"><span>Total del pedido</span><span>${Utils.formatMoney(p.total)}</span></div>
      <div class="sim-row"><span>Ya abonado</span><span>${Utils.formatMoney(p.abonado || 0)}</span></div>
      <div class="sim-row"><span>Saldo</span><span style="color:#ff4466">${Utils.formatMoney(saldo)}</span></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Monto del abono</label>
        <input type="number" id="abMonto" value="${saldo}" min="0" max="${saldo}" step="0.01" />
      </div>
      <div class="form-group">
        <label>Método</label>
        <select id="abMetodo">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Débito">Débito</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-success" onclick="guardarAbono('${id}')">Registrar abono</button>`);
}
window.abrirAbonoPedido = abrirAbonoPedido;

function guardarAbono(id) {
  const monto = parseFloat(document.getElementById('abMonto').value) || 0;
  const metodo = document.getElementById('abMetodo').value;
  const pedidos = DB.get('pedidos', []);
  const idx = pedidos.findIndex(p => p.id === id);
  if (idx < 0) return;

  const saldo = saldoPedido(pedidos[idx]);
  if (monto <= 0)     { toast('Ingresá un monto', 'warning'); return; }
  if (monto > saldo)  { toast(`El abono no puede superar el saldo (${Utils.formatMoney(saldo)})`, 'warning'); return; }

  pedidos[idx].abonado = (pedidos[idx].abonado || 0) + monto;
  pedidos[idx].metodo = metodo;
  DB.set('pedidos', pedidos);
  registrarAbonoEnCaja(pedidos[idx], monto, 'Abono');

  Modal.hide();
  toast(`Abono de ${Utils.formatMoney(monto)} registrado ✅`, 'success');
  initPedidos();
}
window.guardarAbono = guardarAbono;

function abrirEntregaPedido(id) {
  const p = DB.get('pedidos', []).find(p => p.id === id);
  if (!p) return;
  const saldo = saldoPedido(p);

  const faltantes = (p.items || [])
    .map(it => ({ ...it, disp: it.recetaId ? Stock.disponible(it.recetaId) : Infinity }))
    .filter(it => it.disp < it.cantidad);

  Modal.show('✅ Entregar pedido', `
    <p style="margin-bottom:1rem">Entregando el pedido de <strong>${Utils.escHtml(nombreClientePedido(p))}</strong>.</p>

    <div class="sim-result" style="margin-top:0;margin-bottom:1rem">
      <div class="sim-row"><span>Total</span><span>${Utils.formatMoney(p.total)}</span></div>
      <div class="sim-row"><span>Ya abonado</span><span>${Utils.formatMoney(p.abonado || 0)}</span></div>
      <div class="sim-row"><span>Cobra ahora</span><span style="color:var(--teal)">${Utils.formatMoney(saldo)}</span></div>
    </div>

    ${faltantes.length ? `<div class="alert alert-warning">
      ⚠️ El stock no alcanza: ${faltantes.map(f => `${Utils.escHtml(f.nombre)} (tenés ${f.disp}, necesitás ${f.cantidad})`).join(', ')}.
      Podés entregar igual, pero el stock queda en negativo.
    </div>` : ''}

    <div class="form-row">
      <div class="form-group">
        <label>Fecha de entrega real</label>
        <input type="date" id="entFecha" value="${Utils.today()}" />
      </div>
      <div class="form-group">
        <label>Método de cobro</label>
        <select id="entMetodo">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Débito">Débito</option>
          <option value="Crédito">Crédito</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
    ${saldo > 0 ? `
    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
      <input type="checkbox" id="entCobrado" checked style="width:auto" />
      <span>Cobré el saldo de ${Utils.formatMoney(saldo)} al entregar</span>
    </label>` : ''}
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-success" onclick="confirmarEntrega('${id}')">✅ Confirmar entrega</button>`);
}
window.abrirEntregaPedido = abrirEntregaPedido;

function confirmarEntrega(id) {
  const pedidos = DB.get('pedidos', []);
  const idx = pedidos.findIndex(p => p.id === id);
  if (idx < 0) return;
  const p = pedidos[idx];

  const fecha  = document.getElementById('entFecha').value || Utils.today();
  const metodo = document.getElementById('entMetodo').value;
  const cobrado = document.getElementById('entCobrado')?.checked ?? true;
  const saldo = saldoPedido(p);

  // Una venta por producto: descuenta stock y alimenta las estadísticas.
  // conCaja:false porque la plata del pedido se registra acá abajo, una sola vez.
  const ventaIds = [];
  (p.items || []).forEach(it => {
    const venta = registrarVenta({
      recetaId: it.recetaId,
      cantidad: it.cantidad,
      precioUnit: it.precioUnit,
      fecha,
      metodo,
      clienteId: p.clienteId,
      cliente: p.cliente,
      obs: `Pedido entregado${p.notas ? ' — ' + p.notas : ''}`
    }, { conCaja: false, pedidoId: p.id, silencioso: true });
    ventaIds.push(venta.id);
  });

  if (saldo > 0 && cobrado) {
    CajaDB.add({
      tipo: 'ingreso',
      concepto: `Saldo pedido: ${nombreClientePedido(p)}`,
      monto: saldo,
      fecha,
      metodo,
      origen: 'pedido',
      refId: p.id
    });
    p.abonado = p.total;
  }

  p.estado = 'entregado';
  p.fechaEntregaReal = fecha;
  p.metodo = metodo;
  p.ventaIds = ventaIds;
  pedidos[idx] = p;
  DB.set('pedidos', pedidos);

  Modal.hide();
  toast(`Pedido entregado ✅ ${saldo > 0 && cobrado ? 'Cobraste ' + Utils.formatMoney(saldo) : ''}`, 'success');
  initPedidos();
}
window.confirmarEntrega = confirmarEntrega;

function eliminarPedido(id) {
  const pedidos = DB.get('pedidos', []);
  const p = pedidos.find(p => p.id === id);
  if (!p) return;

  const detalles = [];
  if (p.ventaIds?.length) detalles.push(`se borran sus ${p.ventaIds.length} venta(s)`);
  if (CajaDB.byRef(id).length) detalles.push('se borran sus movimientos de caja');

  Modal.confirm(
    `¿Eliminar el pedido de ${nombreClientePedido(p)} por ${Utils.formatMoney(p.total)}?` +
    (detalles.length ? ' También ' + detalles.join(' y ') + '.' : ''),
    () => {
      // Borrar en cascada: ventas generadas + movimientos de caja
      if (p.ventaIds?.length) {
        DB.set('ventas', DB.get('ventas', []).filter(v => !p.ventaIds.includes(v.id)));
      }
      CajaDB.removeByRef(id);
      DB.set('pedidos', pedidos.filter(x => x.id !== id));
      toast('Pedido eliminado', 'info');
      initPedidos();
    }
  );
}
window.eliminarPedido = eliminarPedido;

/** Resumen en texto para pegar en WhatsApp. */
function compartirPedido(id) {
  const p = DB.get('pedidos', []).find(p => p.id === id);
  if (!p) return;

  const negocio = DB.get('config', DB.defaults.config).negocio;
  const lineas = [
    `*${negocio}*`,
    `Pedido de ${nombreClientePedido(p)}`,
    `Entrega: ${Utils.formatDate(p.fechaEntrega)}`,
    '',
    ...(p.items || []).map(it => `• ${it.nombre} x${it.cantidad} — ${Utils.formatMoney(it.subtotal)}`),
    '',
    `TOTAL: ${Utils.formatMoney(p.total)}`
  ];
  if (p.abonado > 0) {
    lineas.push(`Abonado: ${Utils.formatMoney(p.abonado)}`);
    lineas.push(`Saldo: ${Utils.formatMoney(saldoPedido(p))}`);
  }
  if (p.notas) lineas.push('', `Nota: ${p.notas}`);
  const texto = lineas.join('\n');

  const cli = p.clienteId ? DB.get('clientes', []).find(c => c.id === p.clienteId) : null;
  const num = cli?.telefono ? cli.telefono.replace(/[^\d]/g, '') : '';

  Modal.show('📤 Compartir pedido', `
    <div class="form-group">
      <label>Resumen</label>
      <textarea id="shareTexto" rows="12" style="font-family:var(--font-body);resize:vertical">${Utils.escHtml(texto)}</textarea>
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cerrar</button>
      <button class="btn btn-secondary" onclick="copiarResumen()">📋 Copiar</button>
      ${num ? `<button class="btn btn-success" onclick="window.open('https://wa.me/${num}?text='+encodeURIComponent(document.getElementById('shareTexto').value),'_blank','noopener')">💬 WhatsApp</button>` : ''}`);
}
window.compartirPedido = compartirPedido;

function copiarResumen() {
  const ta = document.getElementById('shareTexto');
  if (!ta) return;
  ta.select();
  navigator.clipboard?.writeText(ta.value)
    .then(() => toast('Resumen copiado 📋', 'success'))
    .catch(() => toast('Copialo a mano desde el cuadro', 'info'));
}
window.copiarResumen = copiarResumen;

window.abrirFormPedido = abrirFormPedido;

Router.register('pedidos', initPedidos);
