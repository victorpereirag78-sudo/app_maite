/**
 * compras.js — Lista de compras calculada desde los pedidos abiertos
 *
 * Cruza tres cosas que la app ya tenía sueltas: qué te encargaron, cuánto
 * producto terminado tenés y cuánto ingrediente te queda. De ahí sale
 * exactamente qué falta comprar.
 */

/**
 * @param {number} dias  Horizonte: solo pedidos que se entregan dentro de N días.
 *                       0 = todos los pedidos abiertos.
 */
function calcularListaCompras(dias = 0) {
  const recetas      = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);
  const hoy          = Utils.today();

  const pedidos = DB.get('pedidos', [])
    .filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado')
    .filter(p => dias === 0 || Utils.diasEntre(hoy, p.fechaEntrega) <= dias);

  // 1) Cuántas unidades de cada producto hacen falta
  const demanda = {};
  pedidos.forEach(p => (p.items || []).forEach(it => {
    if (it.recetaId) demanda[it.recetaId] = (demanda[it.recetaId] || 0) + (it.cantidad || 0);
  }));

  // 2) Descontar lo ya producido y traducir a tandas enteras
  const aProducir = [];
  Object.entries(demanda).forEach(([recetaId, unidades]) => {
    const receta = recetas.find(r => r.id === recetaId);
    if (!receta) return;
    const faltan = Math.max(0, unidades - Stock.disponible(recetaId));
    if (faltan <= 0) return;
    const tandas = Math.ceil(faltan / (receta.unidades || 1));
    aProducir.push({ receta, pedidas: unidades, faltan, tandas });
  });

  // 3) Ingrediente que consumen esas tandas
  const necesidad = {};
  aProducir.forEach(({ receta, tandas }) => {
    (receta.ingredientes || []).forEach(ri => {
      necesidad[ri.id] = (necesidad[ri.id] || 0) + (ri.cantidad || 0) * tandas;
    });
  });

  // 4) Qué comprar: lo que consumen los pedidos, más el mínimo de seguridad,
  //    menos lo que ya está en la despensa.
  const cfg = DB.get('config', DB.defaults.config);
  const items = ingredientes.map(ing => {
    const paraPedidos = necesidad[ing.id] || 0;
    const minimo      = ing.stockMinimo ?? cfg.stockMinimo ?? 0;
    const stock       = ing.stock || 0;
    const comprar     = Math.max(0, paraPedidos + minimo - stock);
    const costo       = ing.precioUnidad > 0
      ? (comprar / (ing.unidadBase || 1)) * ing.precioUnidad
      : 0;
    return {
      id: ing.id, nombre: ing.nombre, unidad: ing.unidad,
      stock, minimo, paraPedidos, comprar, costo,
      motivo: paraPedidos > 0 && stock < paraPedidos ? 'pedidos' : 'mínimo'
    };
  }).filter(i => i.comprar > 0)
    .sort((a, b) => b.costo - a.costo);

  return {
    items,
    aProducir,
    pedidos: pedidos.length,
    costoTotal: items.reduce((s, i) => s + i.costo, 0)
  };
}
window.calcularListaCompras = calcularListaCompras;

let _horizonteCompras = 0;

function initCompras() {
  const recetas = DB.get('recetas', []);
  const lista   = calcularListaCompras(_horizonteCompras);

  let html = `
    <div class="section-header">
      <h2 class="section-title">🛒 Qué comprar</h2>
      <div class="section-actions">
        <select id="horizonteCompras" onchange="cambiarHorizonte(this.value)" style="max-width:220px">
          <option value="0"  ${_horizonteCompras === 0  ? 'selected' : ''}>Todos los pedidos abiertos</option>
          <option value="7"  ${_horizonteCompras === 7  ? 'selected' : ''}>Solo próximos 7 días</option>
          <option value="14" ${_horizonteCompras === 14 ? 'selected' : ''}>Solo próximos 14 días</option>
          <option value="30" ${_horizonteCompras === 30 ? 'selected' : ''}>Solo próximos 30 días</option>
        </select>
      </div>
    </div>
  `;

  if (!recetas.length) {
    html += `<div class="alert alert-info">ℹ️ Cargá recetas e ingredientes para que la app pueda calcular qué te falta.</div>`;
    document.getElementById('moduleContainer').innerHTML = html;
    return;
  }

  html += `
    <div class="stats-grid">
      <div class="stat-card purple">
        <div class="stat-icon">🎁</div>
        <div class="stat-value">${lista.pedidos}</div>
        <div class="stat-label">Pedidos considerados</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">👩‍🍳</div>
        <div class="stat-value">${lista.aProducir.reduce((s, a) => s + a.tandas, 0)}</div>
        <div class="stat-label">Tandas a producir</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-icon">📦</div>
        <div class="stat-value">${lista.items.length}</div>
        <div class="stat-label">Ingredientes a comprar</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">💸</div>
        <div class="stat-value">${Utils.formatMoney(lista.costoTotal)}</div>
        <div class="stat-label">Costo estimado</div>
      </div>
    </div>
  `;

  // ── Qué hay que producir
  if (lista.aProducir.length) {
    html += `
      <div class="card" style="margin-bottom:1.2rem">
        <div class="card-title">👩‍🍳 Para cumplir los pedidos tenés que producir</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Producto</th><th>Pedidas</th><th>En stock</th><th>Faltan</th><th>Tandas</th><th></th></tr></thead>
          <tbody>
            ${lista.aProducir.map(a => `<tr>
              <td><strong>${Utils.escHtml(a.receta.nombre)}</strong></td>
              <td>${a.pedidas} un.</td>
              <td>${Stock.disponible(a.receta.id)} un.</td>
              <td style="color:var(--orange);font-weight:700">${a.faltan} un.</td>
              <td><span class="badge badge-purple">${a.tandas} tanda${a.tandas === 1 ? '' : 's'}</span></td>
              <td><button class="btn btn-sm btn-primary" onclick="abrirFormProduccion('${a.receta.id}')">Producir</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  } else if (lista.pedidos > 0) {
    html += `<div class="alert alert-success">✅ Ya tenés producido todo lo que hace falta para los pedidos abiertos.</div>`;
  }

  // ── La lista
  html += `
    <div class="card">
      <div class="card-title">
        🧾 Lista de compras
        ${lista.items.length ? `<button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="compartirListaCompras()">📤 Compartir</button>` : ''}
      </div>
      ${lista.items.length === 0
        ? `<div class="empty-state" style="padding:2rem"><div class="empty-icon">✅</div>
             <p>No necesitás comprar nada.<br>Tenés stock para los pedidos y por encima del mínimo.</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Ingrediente</th><th>Tenés</th><th>Para pedidos</th><th>Mínimo</th>
              <th>Comprar</th><th>Costo estim.</th><th></th>
            </tr></thead>
            <tbody>
              ${lista.items.map(i => `<tr>
                <td><strong>${Utils.escHtml(i.nombre)}</strong>
                  ${i.motivo === 'pedidos' ? '<span class="badge badge-orange">por pedidos</span>' : ''}</td>
                <td>${+i.stock.toFixed(2)} ${Utils.escHtml(i.unidad)}</td>
                <td>${i.paraPedidos > 0 ? +i.paraPedidos.toFixed(2) + ' ' + Utils.escHtml(i.unidad) : '—'}</td>
                <td>${+i.minimo.toFixed(2)} ${Utils.escHtml(i.unidad)}</td>
                <td style="color:var(--pink);font-weight:800">${+i.comprar.toFixed(2)} ${Utils.escHtml(i.unidad)}</td>
                <td>${i.costo > 0 ? Utils.formatMoney(i.costo) : '<span style="color:var(--text-muted)">sin precio</span>'}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="abrirFormCompra()" title="Registrar la compra">🛍</button></td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="5" style="text-align:right;font-weight:700">TOTAL ESTIMADO</td>
              <td style="font-weight:900;color:var(--teal)">${Utils.formatMoney(lista.costoTotal)}</td><td></td>
            </tr></tfoot>
          </table></div>
          <p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.8rem">
            El costo sale del último precio pagado por cada ingrediente, así que es una estimación.
          </p>`}
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function cambiarHorizonte(v) {
  _horizonteCompras = parseInt(v) || 0;
  initCompras();
}
window.cambiarHorizonte = cambiarHorizonte;

function compartirListaCompras() {
  const lista = calcularListaCompras(_horizonteCompras);
  if (!lista.items.length) { toast('No hay nada para comprar', 'info'); return; }

  const texto = [
    `🛒 Lista de compras — ${Utils.formatDate(Utils.today())}`,
    '',
    ...lista.items.map(i => `• ${i.nombre}: ${+i.comprar.toFixed(2)} ${i.unidad}`),
    '',
    `Costo estimado: ${Utils.formatMoney(lista.costoTotal)}`
  ].join('\n');

  Modal.show('📤 Lista de compras', `
    <div class="form-group">
      <label>Copiala o mandátela por WhatsApp</label>
      <textarea id="shareTexto" rows="12" style="font-family:var(--font-body);resize:vertical">${Utils.escHtml(texto)}</textarea>
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cerrar</button>
      <button class="btn btn-secondary" onclick="copiarResumen()">📋 Copiar</button>
      <button class="btn btn-success" onclick="window.open('https://wa.me/?text='+encodeURIComponent(document.getElementById('shareTexto').value),'_blank','noopener')">💬 WhatsApp</button>`);
}
window.compartirListaCompras = compartirListaCompras;

Router.register('compras', initCompras);
