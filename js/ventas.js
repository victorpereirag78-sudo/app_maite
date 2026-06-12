/**
 * ventas.js — Registro y gestión de ventas
 */

function initVentas() {
  const ventas   = DB.get('ventas', []);
  const recetas  = DB.get('recetas', []);
  const hoy      = Utils.today();
  const mes      = Utils.monthKey();

  const ventasHoy = ventas.filter(v => v.fecha === hoy);
  const ventasMes = ventas.filter(v => Utils.monthKey(v.fecha) === mes);
  const totHoy    = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const totMes    = ventasMes.reduce((s, v) => s + (v.total || 0), 0);
  const unHoy     = ventasHoy.reduce((s, v) => s + (v.cantidad || 0), 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">🛒 Ventas</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="abrirFormVenta()">+ Registrar venta</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card pink">
        <div class="stat-icon">💵</div>
        <div class="stat-value">${Utils.formatMoney(totHoy)}</div>
        <div class="stat-label">Vendido hoy</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">🍫</div>
        <div class="stat-value">${unHoy}</div>
        <div class="stat-label">Unidades hoy</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${Utils.formatMoney(totMes)}</div>
        <div class="stat-label">Total del mes</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🧾</div>
        <div class="stat-value">${ventasMes.length}</div>
        <div class="stat-label">Ventas del mes</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="ventasTabs(this,'hoy')">Hoy</button>
      <button class="tab-btn" onclick="ventasTabs(this,'mes')">Este mes</button>
      <button class="tab-btn" onclick="ventasTabs(this,'todo')">Todas</button>
    </div>
  `;

  const renderTabla = (list) => {
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">🛒</div><p>Sin ventas en este período</p></div>`;
    return `<div class="table-wrap"><table>
      <thead><tr>
        <th>Fecha</th><th>Receta</th><th>Cant.</th><th>Precio unit.</th>
        <th>Total</th><th>Cliente</th><th>Pago</th><th></th>
      </tr></thead>
      <tbody>
        ${list.slice().reverse().map(v => `<tr>
          <td>${Utils.formatDate(v.fecha)}</td>
          <td>${Utils.escHtml(v.receta || '—')}</td>
          <td>${v.cantidad}</td>
          <td>${Utils.formatMoney(v.precioUnit)}</td>
          <td style="color:var(--teal);font-weight:700">${Utils.formatMoney(v.total)}</td>
          <td>${Utils.escHtml(v.cliente || '—')}</td>
          <td><span class="badge badge-purple">${Utils.escHtml(v.metodo || 'Efectivo')}</span></td>
          <td>
            <button class="btn btn-sm btn-danger btn-icon" onclick="eliminarVenta('${v.id}')">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  };

  html += `
    <div class="card">
      <div id="vt-hoy"  class="tab-pane active">${renderTabla(ventasHoy)}</div>
      <div id="vt-mes"  class="tab-pane">${renderTabla(ventasMes)}</div>
      <div id="vt-todo" class="tab-pane">${renderTabla(ventas)}</div>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function ventasTabs(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`vt-${id}`)?.classList.add('active');
}
window.ventasTabs = ventasTabs;

function abrirFormVenta() {
  const recetas      = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);

  const recetaOpts = recetas.length
    ? recetas.map(r => {
        const costo = calcularCostoReceta(r, ingredientes);
        const unit  = r.unidades > 0 ? costo / r.unidades : 0;
        return `<option value="${r.id}" data-unit="${unit.toFixed(2)}">${Utils.escHtml(r.nombre)} (${r.unidades} un.)</option>`;
      }).join('')
    : `<option value="">Sin recetas creadas</option>`;

  Modal.show('🛒 Registrar Venta', `
    <div class="form-group">
      <label>Receta / Producto</label>
      <select id="vReceta" onchange="actualizarPrecioSugerido()">
        <option value="">Selecciona receta...</option>
        ${recetaOpts}
        <option value="_libre">Venta libre (sin receta)</option>
      </select>
    </div>
    <div id="precioSugeridoDiv" style="display:none" class="alert alert-info" style="padding:6px 12px;margin-bottom:0.75rem">
      💡 Costo unitario estimado: <strong id="costoUnitLabel"></strong>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cantidad vendida</label>
        <input type="number" id="vCantidad" value="1" min="1" oninput="calcTotalVenta()" />
      </div>
      <div class="form-group">
        <label>Precio por unidad</label>
        <input type="number" id="vPrecioUnit" placeholder="0" min="0" step="0.01" oninput="calcTotalVenta()" />
      </div>
    </div>
    <div class="form-group">
      <label>Total</label>
      <input type="text" id="vTotal" readonly style="background:var(--surface);font-weight:700;color:var(--teal)" placeholder="Se calcula solo" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="vFecha" value="${Utils.today()}" />
      </div>
      <div class="form-group">
        <label>Método de pago</label>
        <select id="vMetodo">
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Débito">Débito</option>
          <option value="Crédito">Crédito</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Cliente (opcional)</label>
      <input type="text" id="vCliente" placeholder="Nombre o apodo del cliente" />
    </div>
    <div class="form-group">
      <label>Observaciones</label>
      <input type="text" id="vObs" placeholder="Ej: entrega a domicilio, evento..." />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarVenta()">Registrar venta</button>`);
}

function actualizarPrecioSugerido() {
  const sel   = document.getElementById('vReceta');
  const opt   = sel.options[sel.selectedIndex];
  const unit  = parseFloat(opt?.dataset?.unit || 0);
  const div   = document.getElementById('precioSugeridoDiv');
  const label = document.getElementById('costoUnitLabel');

  if (unit > 0) {
    div.style.display = 'block';
    label.textContent = Utils.formatMoney(unit) + ` → sugerido +40%: ${Utils.formatMoney(unit * 1.4)}`;
  } else {
    div.style.display = 'none';
  }
}

function calcTotalVenta() {
  const cant  = parseFloat(document.getElementById('vCantidad')?.value) || 0;
  const precio= parseFloat(document.getElementById('vPrecioUnit')?.value) || 0;
  const total = cant * precio;
  const el    = document.getElementById('vTotal');
  if (el) el.value = Utils.formatMoney(total);
}

function guardarVenta() {
  const recetaId  = document.getElementById('vReceta').value;
  const cantidad  = parseInt(document.getElementById('vCantidad').value) || 0;
  const precioUnit= parseFloat(document.getElementById('vPrecioUnit').value) || 0;
  const fecha     = document.getElementById('vFecha').value;
  const metodo    = document.getElementById('vMetodo').value;
  const cliente   = document.getElementById('vCliente').value.trim();
  const obs       = document.getElementById('vObs').value.trim();

  if (!cantidad || precioUnit <= 0 || !fecha) {
    toast('Completá cantidad, precio y fecha', 'warning'); return;
  }

  const total = cantidad * precioUnit;
  let recetaNombre = '';
  if (recetaId && recetaId !== '_libre') {
    const r = DB.get('recetas', []).find(r => r.id === recetaId);
    recetaNombre = r?.nombre || '';
  }

  const ventas = DB.get('ventas', []);
  ventas.push({ id: Utils.uid(), recetaId, receta: recetaNombre, cantidad, precioUnit, total, fecha, metodo, cliente, obs });
  DB.set('ventas', ventas);

  // Auto-registrar en caja
  const caja = DB.get('caja', []);
  caja.push({ id: Utils.uid(), tipo:'ingreso', concepto:`Venta: ${recetaNombre || 'Alfajores'} x${cantidad}`, monto: total, fecha, metodo });
  DB.set('caja', caja);

  Modal.hide();
  toast(`Venta de ${Utils.formatMoney(total)} registrada ✅`, 'success');
  initVentas();
}

function eliminarVenta(id) {
  Modal.confirm('¿Eliminar esta venta?', () => {
    DB.set('ventas', DB.get('ventas', []).filter(v => v.id !== id));
    toast('Venta eliminada', 'info');
    initVentas();
  });
}

window.abrirFormVenta           = abrirFormVenta;
window.guardarVenta             = guardarVenta;
window.eliminarVenta            = eliminarVenta;
window.actualizarPrecioSugerido = actualizarPrecioSugerido;
window.calcTotalVenta           = calcTotalVenta;

Router.register('ventas', initVentas);
