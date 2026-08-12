/**
 * ventas.js — Registro y gestión de ventas
 */

function initVentas() {
  const ventas   = DB.get('ventas', []);
  const hoy      = Utils.today();
  const mes      = Utils.monthKey();

  const ventasHoy = ventas.filter(v => v.fecha === hoy);
  const ventasMes = ventas.filter(v => Utils.monthKey(v.fecha) === mes);
  const totHoy    = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const totMes    = ventasMes.reduce((s, v) => s + (v.total || 0), 0);
  const unHoy     = ventasHoy.reduce((s, v) => s + (v.cantidad || 0), 0);
  const gananciaMes = ventasMes.reduce((s, v) => s + gananciaVenta(v), 0);

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
        <div class="stat-icon">📊</div>
        <div class="stat-value">${Utils.formatMoney(gananciaMes)}</div>
        <div class="stat-label">Ganancia del mes</div>
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
        <th>Fecha</th><th>Producto</th><th>Cant.</th><th>Precio unit.</th>
        <th>Total</th><th>Ganancia</th><th>Cliente</th><th>Pago</th><th></th>
      </tr></thead>
      <tbody>
        ${list.slice().reverse().map(v => {
          const gan = gananciaVenta(v);
          const colorGan = gan > 0 ? 'var(--teal)' : gan < 0 ? '#ff4466' : 'var(--text-muted)';
          return `<tr>
            <td>${Utils.formatDate(v.fecha)}</td>
            <td>${Utils.escHtml(v.receta || '—')}${v.pedidoId ? ' <span class="badge badge-purple">🎁 pedido</span>' : ''}</td>
            <td>${v.cantidad}</td>
            <td>${Utils.formatMoney(v.precioUnit)}</td>
            <td style="color:var(--teal);font-weight:700">${Utils.formatMoney(v.total)}</td>
            <td style="color:${colorGan};font-weight:600">${v.costoUnit != null ? Utils.formatMoney(gan) : '—'}</td>
            <td>${Utils.escHtml(nombreClienteVenta(v))}</td>
            <td><span class="badge badge-purple">${Utils.escHtml(v.metodo || 'Efectivo')}</span></td>
            <td>
              <button class="btn btn-sm btn-danger btn-icon" onclick="eliminarVenta('${v.id}')" title="Eliminar">🗑</button>
            </td>
          </tr>`;
        }).join('')}
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

/** Ganancia real: usa el costo congelado al momento de la venta, no el costo de hoy. */
function gananciaVenta(v) {
  if (v.costoUnit == null) return 0;
  return (v.precioUnit - v.costoUnit) * (v.cantidad || 0);
}
window.gananciaVenta = gananciaVenta;

function nombreClienteVenta(v) {
  if (v.clienteId) {
    const c = DB.get('clientes', []).find(c => c.id === v.clienteId);
    if (c) return c.nombre;
  }
  return v.cliente || '—';
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
  const clientes     = DB.get('clientes', []);

  const recetaOpts = recetas.map(r => {
    const costo = calcularCostoReceta(r, ingredientes);
    const unit  = r.unidades > 0 ? costo / r.unidades : 0;
    const disp  = Stock.disponible(r.id);
    return `<option value="${r.id}" data-unit="${unit.toFixed(2)}" data-precio="${r.precioVenta || ''}" data-stock="${disp}">
      ${Utils.escHtml(r.nombre)} — stock: ${disp}
    </option>`;
  }).join('');

  const clienteOpts = clientes
    .slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(c => `<option value="${c.id}">${Utils.escHtml(c.nombre)}</option>`).join('');

  Modal.show('🛒 Registrar Venta', `
    <div class="form-group">
      <label>Producto / Receta</label>
      <select id="vReceta" onchange="actualizarPrecioSugerido()">
        <option value="">Selecciona producto...</option>
        ${recetaOpts}
        <option value="_libre">Venta libre (sin receta)</option>
      </select>
    </div>
    <div id="precioSugeridoDiv" class="alert alert-info" style="display:none;padding:0.6rem 1rem;font-size:0.85rem"></div>

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
      <label>Cliente</label>
      <select id="vClienteId" onchange="toggleClienteLibre()">
        <option value="">— Sin cliente / ocasional —</option>
        ${clienteOpts}
        <option value="_libre">✍️ Escribir un nombre suelto</option>
      </select>
    </div>
    <div class="form-group" id="vClienteLibreWrap" style="display:none">
      <label>Nombre del cliente</label>
      <input type="text" id="vCliente" placeholder="Nombre o apodo" />
    </div>
    <div class="form-group">
      <label>Observaciones</label>
      <input type="text" id="vObs" placeholder="Ej: entrega a domicilio, evento..." />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarVenta()">Registrar venta</button>`);
}

function toggleClienteLibre() {
  const sel = document.getElementById('vClienteId');
  const wrap = document.getElementById('vClienteLibreWrap');
  if (wrap) wrap.style.display = sel.value === '_libre' ? 'block' : 'none';
}
window.toggleClienteLibre = toggleClienteLibre;

function actualizarPrecioSugerido() {
  const sel   = document.getElementById('vReceta');
  const opt   = sel.options[sel.selectedIndex];
  const unit  = parseFloat(opt?.dataset?.unit || 0);
  const stock = parseInt(opt?.dataset?.stock ?? '');
  const precio= parseFloat(opt?.dataset?.precio || 0);
  const div   = document.getElementById('precioSugeridoDiv');

  // Autocompletar el precio guardado en la receta
  const inputPrecio = document.getElementById('vPrecioUnit');
  if (precio > 0 && inputPrecio && !inputPrecio.value) {
    inputPrecio.value = precio;
    calcTotalVenta();
  }

  if (unit > 0 || !isNaN(stock)) {
    const partes = [];
    if (unit > 0) partes.push(`💡 Costo unitario: <strong>${Utils.formatMoney(unit)}</strong> · sugerido +40%: <strong>${Utils.formatMoney(unit * 1.4)}</strong>`);
    if (!isNaN(stock)) {
      partes.push(stock > 0
        ? `📦 Stock disponible: <strong>${stock} unidades</strong>`
        : `⚠️ <strong>Sin stock producido.</strong> Registrá una producción en el módulo Producción.`);
    }
    div.style.display = 'block';
    div.innerHTML = partes.join('<br>');
  } else {
    div.style.display = 'none';
  }
}

function calcTotalVenta() {
  const cant  = parseFloat(document.getElementById('vCantidad')?.value) || 0;
  const precio= parseFloat(document.getElementById('vPrecioUnit')?.value) || 0;
  const el    = document.getElementById('vTotal');
  if (el) el.value = Utils.formatMoney(cant * precio);
}

function guardarVenta() {
  const recetaId  = document.getElementById('vReceta').value;
  const cantidad  = parseInt(document.getElementById('vCantidad').value) || 0;
  const precioUnit= parseFloat(document.getElementById('vPrecioUnit').value) || 0;
  const fecha     = document.getElementById('vFecha').value;
  const metodo    = document.getElementById('vMetodo').value;
  const selCliente= document.getElementById('vClienteId').value;
  const obs       = document.getElementById('vObs').value.trim();

  if (!recetaId) { toast('Elegí un producto (o "Venta libre")', 'warning'); return; }
  if (!cantidad || precioUnit <= 0 || !fecha) {
    toast('Completá cantidad, precio y fecha', 'warning'); return;
  }

  const clienteId = (selCliente && selCliente !== '_libre') ? selCliente : null;
  const cliente   = selCliente === '_libre'
    ? (document.getElementById('vCliente')?.value.trim() || '')
    : '';

  const datos = { recetaId, cantidad, precioUnit, fecha, metodo, clienteId, cliente, obs };

  // Si hay receta, avisar cuando no alcanza el stock producido
  if (recetaId !== '_libre') {
    const disp = Stock.disponible(recetaId);
    if (cantidad > disp) {
      Modal.confirm(
        `Solo tenés ${disp} unidad(es) producidas y estás vendiendo ${cantidad}. ` +
        `Podés registrar igual la venta, pero el stock va a quedar en negativo hasta que cargues la producción.`,
        () => registrarVenta(datos),
        'Registrar igual'
      );
      return;
    }
  }
  registrarVenta(datos);
}

/**
 * Crea la venta y su ingreso en caja, enlazados por refId.
 * conCaja=false lo usan los pedidos, que llevan su propia contabilidad
 * (abonos + saldo) y si no se contaría la plata dos veces.
 */
function registrarVenta(datos, { conCaja = true, pedidoId = null, silencioso = false } = {}) {
  const recetas = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);

  let recetaNombre = datos.recetaNombre || '';
  let costoUnit = datos.costoUnit ?? null;

  if (datos.recetaId && datos.recetaId !== '_libre') {
    const r = recetas.find(r => r.id === datos.recetaId);
    if (r) {
      recetaNombre = r.nombre;
      if (costoUnit == null) {
        // Costo congelado al momento de la venta: si mañana sube la harina,
        // la ganancia histórica no cambia.
        const costo = calcularCostoReceta(r, ingredientes);
        costoUnit = r.unidades > 0 ? costo / r.unidades : 0;
      }
    }
  }

  const total = datos.cantidad * datos.precioUnit;
  const venta = {
    id: Utils.uid(),
    recetaId: datos.recetaId === '_libre' ? null : datos.recetaId,
    receta: recetaNombre || 'Venta libre',
    cantidad: datos.cantidad,
    precioUnit: datos.precioUnit,
    costoUnit,
    total,
    fecha: datos.fecha,
    metodo: datos.metodo,
    clienteId: datos.clienteId || null,
    cliente: datos.cliente || '',
    obs: datos.obs || '',
    pedidoId
  };

  const ventas = DB.get('ventas', []);
  ventas.push(venta);
  DB.set('ventas', ventas);

  if (conCaja) {
    CajaDB.add({
      tipo: 'ingreso',
      concepto: `Venta: ${venta.receta} x${venta.cantidad}`,
      monto: total,
      fecha: venta.fecha,
      metodo: venta.metodo,
      origen: 'venta',
      refId: venta.id
    });
  }

  if (!silencioso) {
    Modal.hide();
    toast(`Venta de ${Utils.formatMoney(total)} registrada ✅`, 'success');
    initVentas();
  }
  return venta;
}
window.registrarVenta = registrarVenta;

function eliminarVenta(id) {
  const venta = DB.get('ventas', []).find(v => v.id === id);
  if (!venta) return;

  if (venta.pedidoId) {
    toast('Esta venta vino de un pedido. Gestionala desde el módulo Pedidos.', 'warning', 6000);
    return;
  }

  Modal.confirm(
    `¿Eliminar la venta de ${Utils.formatMoney(venta.total)}? También se borra su ingreso en Caja y las unidades vuelven al stock.`,
    () => {
      DB.set('ventas', DB.get('ventas', []).filter(v => v.id !== id));
      const borrados = CajaDB.removeByRef(id);
      toast(borrados ? 'Venta y movimiento de caja eliminados' : 'Venta eliminada', 'info');
      initVentas();
    }
  );
}

window.abrirFormVenta           = abrirFormVenta;
window.guardarVenta             = guardarVenta;
window.eliminarVenta            = eliminarVenta;
window.actualizarPrecioSugerido = actualizarPrecioSugerido;
window.calcTotalVenta           = calcTotalVenta;

Router.register('ventas', initVentas);
