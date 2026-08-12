/**
 * clientes.js — Ficha de clientes con historial
 *
 * Antes el cliente era texto libre dentro de cada venta, así que no había forma
 * de responder "¿cuánto me compró Ana este año?" ni "¿quién me debe plata?".
 */

/** Métricas de un cliente calculadas desde ventas y pedidos. */
function statsCliente(id) {
  const ventas  = DB.get('ventas', []).filter(v => v.clienteId === id);
  const pedidos = DB.get('pedidos', []).filter(p => p.clienteId === id);

  const totalComprado = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const unidades      = ventas.reduce((s, v) => s + (v.cantidad || 0), 0);
  const fechas        = ventas.map(v => v.fecha).sort();
  const deuda         = pedidos
    .filter(p => p.estado !== 'cancelado')
    .reduce((s, p) => s + Math.max(0, (p.total || 0) - (p.abonado || 0)), 0);

  return {
    ventas: ventas.length,
    pedidos: pedidos.length,
    pedidosAbiertos: pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length,
    totalComprado,
    unidades,
    ticketPromedio: ventas.length ? totalComprado / ventas.length : 0,
    ultimaCompra: fechas.length ? fechas[fechas.length - 1] : null,
    deuda
  };
}
window.statsCliente = statsCliente;

function initClientes() {
  const clientes = DB.get('clientes', [])
    .slice()
    .sort((a, b) => statsCliente(b.id).totalComprado - statsCliente(a.id).totalComprado);

  const totalFacturado = clientes.reduce((s, c) => s + statsCliente(c.id).totalComprado, 0);
  const deudaTotal     = clientes.reduce((s, c) => s + statsCliente(c.id).deuda, 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">👥 Clientes</h2>
      <div class="section-actions">
        <div class="search-box">
          <input type="text" id="searchCli" placeholder="🔍 Buscar..." oninput="filtrarClientes()" />
        </div>
        <button class="btn btn-primary" onclick="abrirFormCliente()">+ Nuevo cliente</button>
      </div>
    </div>
  `;

  if (!clientes.length) {
    html += `<div class="empty-state"><div class="empty-icon">👥</div>
      <p>Todavía no cargaste clientes.<br>Cargá los que te compran seguido para ver su historial y lo que te deben.</p>
      <button class="btn btn-primary" style="margin-top:1rem" onclick="abrirFormCliente()">+ Agregar el primero</button></div>`;
    document.getElementById('moduleContainer').innerHTML = html;
    return;
  }

  html += `
    <div class="stats-grid">
      <div class="stat-card purple">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${clientes.length}</div>
        <div class="stat-label">Clientes</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">💰</div>
        <div class="stat-value">${Utils.formatMoney(totalFacturado)}</div>
        <div class="stat-label">Facturado a clientes</div>
      </div>
      <div class="stat-card ${deudaTotal > 0 ? 'orange' : 'teal'}">
        <div class="stat-icon">${deudaTotal > 0 ? '⏳' : '✅'}</div>
        <div class="stat-value">${Utils.formatMoney(deudaTotal)}</div>
        <div class="stat-label">Te deben</div>
      </div>
    </div>

    <div id="listaClientes">
      ${clientes.map(c => renderClienteCard(c)).join('')}
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function renderClienteCard(c) {
  const s = statsCliente(c.id);
  return `
    <div class="card cliente-card" data-nombre="${Utils.escHtml((c.nombre + ' ' + (c.telefono || '')).toLowerCase())}" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem">
        <div style="display:flex;gap:0.8rem;align-items:center">
          <div class="avatar">${Utils.escHtml((c.nombre || '?').trim().charAt(0).toUpperCase())}</div>
          <div>
            <h3 style="font-family:var(--font-display);font-weight:800;font-size:1.05rem">${Utils.escHtml(c.nombre)}</h3>
            <p style="color:var(--text-muted);font-size:0.82rem">
              ${c.telefono ? '📱 ' + Utils.escHtml(c.telefono) : 'Sin teléfono'}
              ${s.ultimaCompra ? ' · última compra ' + Utils.formatDate(s.ultimaCompra) : ''}
            </p>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${c.telefono ? `<button class="btn btn-sm btn-success" onclick="whatsappCliente('${c.id}')" title="Abrir WhatsApp">💬</button>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="verFichaCliente('${c.id}')">📄 Ficha</button>
          <button class="btn btn-sm btn-secondary" onclick="abrirFormCliente('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarCliente('${c.id}')">🗑</button>
        </div>
      </div>

      <div class="receta-stats" style="margin-top:0.9rem">
        <div class="receta-stat">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.1rem;color:var(--teal)">${Utils.formatMoney(s.totalComprado)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Total comprado</div>
        </div>
        <div class="receta-stat">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.1rem">${s.ventas}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Compras</div>
        </div>
        <div class="receta-stat">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.1rem;color:var(--orange)">${Utils.formatMoney(s.ticketPromedio)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Ticket promedio</div>
        </div>
        ${s.pedidosAbiertos > 0 ? `
        <div class="receta-stat">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.1rem;color:var(--purple)">${s.pedidosAbiertos}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Pedidos abiertos</div>
        </div>` : ''}
        ${s.deuda > 0 ? `
        <div class="receta-stat" style="border:1px solid #ff4466">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.1rem;color:#ff4466">${Utils.formatMoney(s.deuda)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">Te debe</div>
        </div>` : ''}
      </div>
    </div>
  `;
}

function filtrarClientes() {
  const q = document.getElementById('searchCli').value.toLowerCase();
  document.querySelectorAll('.cliente-card').forEach(el => {
    el.style.display = (el.dataset.nombre || '').includes(q) ? '' : 'none';
  });
}
window.filtrarClientes = filtrarClientes;

function abrirFormCliente(id = null) {
  const cli = id ? DB.get('clientes', []).find(c => c.id === id) : null;

  Modal.show(cli ? 'Editar cliente' : 'Nuevo cliente', `
    <div class="form-group">
      <label>Nombre *</label>
      <input type="text" id="cliNombre" value="${Utils.escHtml(cli?.nombre || '')}" placeholder="Ej: Ana Pérez" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Teléfono / WhatsApp</label>
        <input type="tel" id="cliTel" value="${Utils.escHtml(cli?.telefono || '')}" placeholder="+56 9 1234 5678" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="cliEmail" value="${Utils.escHtml(cli?.email || '')}" placeholder="opcional" />
      </div>
    </div>
    <div class="form-group">
      <label>Dirección de entrega</label>
      <input type="text" id="cliDir" value="${Utils.escHtml(cli?.direccion || '')}" placeholder="opcional" />
    </div>
    <div class="form-group">
      <label>Notas</label>
      <input type="text" id="cliNotas" value="${Utils.escHtml(cli?.notas || '')}" placeholder="Ej: prefiere sin nuez, paga por transferencia" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarCliente('${id || ''}')">Guardar</button>`);
}

function guardarCliente(id) {
  const nombre    = document.getElementById('cliNombre').value.trim();
  const telefono  = document.getElementById('cliTel').value.trim();
  const email     = document.getElementById('cliEmail').value.trim();
  const direccion = document.getElementById('cliDir').value.trim();
  const notas     = document.getElementById('cliNotas').value.trim();

  if (!nombre) { toast('El nombre es obligatorio', 'warning'); return; }

  const clientes = DB.get('clientes', []);
  const repetido = clientes.find(c => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase());
  if (repetido) { toast('Ya existe un cliente con ese nombre', 'warning'); return; }

  if (id) {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx >= 0) clientes[idx] = { ...clientes[idx], nombre, telefono, email, direccion, notas };
  } else {
    clientes.push({ id: Utils.uid(), nombre, telefono, email, direccion, notas, creado: Utils.today() });
  }
  DB.set('clientes', clientes);
  Modal.hide();
  toast(id ? 'Cliente actualizado ✅' : 'Cliente agregado ✅', 'success');
  initClientes();
}

function eliminarCliente(id) {
  const s = statsCliente(id);
  const cli = DB.get('clientes', []).find(c => c.id === id);
  if (!cli) return;

  const aviso = s.ventas || s.pedidos
    ? ` Tiene ${s.ventas} venta(s) y ${s.pedidos} pedido(s): el historial se conserva, pero quedan sin cliente asociado.`
    : '';

  Modal.confirm(`¿Eliminar a ${cli.nombre}?${aviso}`, () => {
    DB.set('clientes', DB.get('clientes', []).filter(c => c.id !== id));
    // Guardar el nombre en las ventas para no perder el dato histórico
    const ventas = DB.get('ventas', []).map(v =>
      v.clienteId === id ? { ...v, clienteId: null, cliente: v.cliente || cli.nombre } : v);
    DB.set('ventas', ventas);
    const pedidos = DB.get('pedidos', []).map(p =>
      p.clienteId === id ? { ...p, clienteId: null, cliente: p.cliente || cli.nombre } : p);
    DB.set('pedidos', pedidos);
    toast('Cliente eliminado', 'info');
    initClientes();
  });
}

function verFichaCliente(id) {
  const cli = DB.get('clientes', []).find(c => c.id === id);
  if (!cli) return;
  const s = statsCliente(id);
  const ventas  = DB.get('ventas', []).filter(v => v.clienteId === id).slice().reverse();
  const pedidos = DB.get('pedidos', []).filter(p => p.clienteId === id).slice().reverse();

  // Producto favorito
  const porProducto = {};
  ventas.forEach(v => { porProducto[v.receta || '—'] = (porProducto[v.receta || '—'] || 0) + (v.cantidad || 0); });
  const favorito = Object.entries(porProducto).sort((a, b) => b[1] - a[1])[0];

  Modal.show(`📄 ${cli.nombre}`, `
    <div style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.88rem;margin-bottom:1rem">
      ${cli.telefono  ? `<div>📱 ${Utils.escHtml(cli.telefono)}</div>` : ''}
      ${cli.email     ? `<div>✉️ ${Utils.escHtml(cli.email)}</div>` : ''}
      ${cli.direccion ? `<div>📍 ${Utils.escHtml(cli.direccion)}</div>` : ''}
      ${cli.notas     ? `<div style="color:var(--text-muted)">📝 ${Utils.escHtml(cli.notas)}</div>` : ''}
      ${cli.creado    ? `<div style="color:var(--text-muted)">Cliente desde ${Utils.formatDate(cli.creado)}</div>` : ''}
    </div>

    <div class="sim-result" style="margin-top:0">
      <div class="sim-row"><span>Total comprado</span><span style="color:var(--teal)">${Utils.formatMoney(s.totalComprado)}</span></div>
      <div class="sim-row"><span>Compras / unidades</span><span>${s.ventas} · ${s.unidades} un.</span></div>
      <div class="sim-row"><span>Ticket promedio</span><span>${Utils.formatMoney(s.ticketPromedio)}</span></div>
      ${favorito ? `<div class="sim-row"><span>Producto favorito</span><span>${Utils.escHtml(favorito[0])} (${favorito[1]} un.)</span></div>` : ''}
      ${s.deuda > 0 ? `<div class="sim-row"><span>Saldo pendiente</span><span style="color:#ff4466">${Utils.formatMoney(s.deuda)}</span></div>` : ''}
    </div>

    ${pedidos.length ? `
      <p style="font-weight:700;margin:1.2rem 0 0.5rem">🎁 Pedidos</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Entrega</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>${pedidos.slice(0, 8).map(p => `<tr>
          <td>${Utils.formatDate(p.fechaEntrega)}</td>
          <td>${Utils.formatMoney(p.total)}</td>
          <td>${badgeEstadoPedido(p.estado)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : ''}

    ${ventas.length ? `
      <p style="font-weight:700;margin:1.2rem 0 0.5rem">🛒 Últimas compras</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Total</th></tr></thead>
        <tbody>${ventas.slice(0, 10).map(v => `<tr>
          <td>${Utils.formatDate(v.fecha)}</td>
          <td>${Utils.escHtml(v.receta || '—')}</td>
          <td>${v.cantidad}</td>
          <td style="color:var(--teal);font-weight:600">${Utils.formatMoney(v.total)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
    : `<div class="empty-state" style="padding:1.5rem"><p>Todavía no te compró nada.</p></div>`}
  `, `${cli.telefono ? `<button class="btn btn-success" onclick="whatsappCliente('${cli.id}')">💬 WhatsApp</button>` : ''}
      <button class="btn btn-secondary" onclick="Modal.hide()">Cerrar</button>`);
}

/** Abre WhatsApp con el número del cliente. No envía nada solo: abre el chat. */
function whatsappCliente(id) {
  const cli = DB.get('clientes', []).find(c => c.id === id);
  if (!cli?.telefono) { toast('Ese cliente no tiene teléfono cargado', 'warning'); return; }
  const num = cli.telefono.replace(/[^\d]/g, '');
  if (!num) { toast('El teléfono no tiene un formato válido', 'warning'); return; }
  window.open(`https://wa.me/${num}`, '_blank', 'noopener');
}

window.abrirFormCliente = abrirFormCliente;
window.guardarCliente   = guardarCliente;
window.eliminarCliente  = eliminarCliente;
window.verFichaCliente  = verFichaCliente;
window.whatsappCliente  = whatsappCliente;

Router.register('clientes', initClientes);
