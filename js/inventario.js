/**
 * inventario.js — Gestión de ingredientes, compras y stock
 */

function initInventario() {
  const ingredientes = DB.get('ingredientes', []);
  const cfg          = DB.get('config', DB.defaults.config);
  const stockMin     = cfg.stockMinimo || 200;

  const bajos = ingredientes.filter(i => i.stock <= (i.stockMinimo || stockMin));

  let html = `
    <div class="section-header">
      <h2 class="section-title">📦 Inventario</h2>
      <div class="section-actions">
        <div class="search-box">
          <input type="text" id="searchIng" placeholder="🔍 Buscar..." oninput="filtrarIng()" />
        </div>
        <button class="btn btn-primary" onclick="abrirFormIngrediente()">+ Ingrediente</button>
        <button class="btn btn-secondary" onclick="abrirFormCompra()">🛍 Registrar compra</button>
      </div>
    </div>
  `;

  if (bajos.length > 0) {
    html += `<div class="alert alert-warning">
      ⚠️ Stock bajo: <strong>${bajos.map(i => Utils.escHtml(i.nombre)).join(', ')}</strong>
    </div>`;
  }

  if (ingredientes.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">📦</div><p>Sin ingredientes. ¡Agregá el primero!</p></div>`;
  } else {
    html += `
      <div class="card">
        <div class="table-wrap">
          <table id="tablaIng">
            <thead><tr>
              <th>Ingrediente</th><th>Stock actual</th><th>Unidad</th>
              <th>Precio/unidad</th><th>Stock mínimo</th><th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              ${ingredientes.map(i => renderIngRow(i, stockMin)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Historial compras
  const compras = DB.get('compras', []).slice(-10).reverse();
  if (compras.length > 0) {
    html += `
      <div class="card" style="margin-top:1.2rem">
        <div class="card-title">🛍 Últimas compras</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Ingrediente</th><th>Cantidad</th><th>Costo</th><th></th></tr></thead>
          <tbody>
            ${compras.map(c => `<tr>
              <td>${Utils.formatDate(c.fecha)}</td>
              <td>${Utils.escHtml(c.ingNombre || c.ingId)}</td>
              <td>${c.cantidad} ${Utils.escHtml(c.unidad || '')}</td>
              <td>${Utils.formatMoney(c.costo)}</td>
              <td><button class="btn btn-sm btn-danger btn-icon" onclick="eliminarCompra('${c.id}')" title="Anular compra">🗑</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    `;
  }

  document.getElementById('moduleContainer').innerHTML = html;
}

function renderIngRow(i, stockMin) {
  const min    = i.stockMinimo || stockMin;
  const bajo   = i.stock <= min;
  const estado = bajo
    ? `<span class="badge badge-red">⚠️ Bajo</span>`
    : `<span class="badge badge-teal">✅ OK</span>`;

  return `<tr id="ing-row-${i.id}">
    <td><strong>${Utils.escHtml(i.nombre)}</strong></td>
    <td style="${bajo ? 'color:var(--orange);font-weight:700' : ''}">${i.stock} ${Utils.escHtml(i.unidad)}</td>
    <td>${Utils.escHtml(i.unidad)}</td>
    <td>${Utils.formatMoney(i.precioUnidad)} / ${i.unidadBase || 1} ${Utils.escHtml(i.unidad)}</td>
    <td>${min} ${Utils.escHtml(i.unidad)}</td>
    <td>${estado}</td>
    <td>
      <button class="btn btn-sm btn-secondary btn-icon" onclick="editarIngrediente('${i.id}')" title="Editar">✏️</button>
      <button class="btn btn-sm btn-danger btn-icon"   onclick="eliminarIngrediente('${i.id}')" title="Eliminar">🗑</button>
    </td>
  </tr>`;
}

function filtrarIng() {
  const q = document.getElementById('searchIng').value.toLowerCase();
  document.querySelectorAll('#tablaIng tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
window.filtrarIng = filtrarIng;

function abrirFormIngrediente(id = null) {
  const ingredientes = DB.get('ingredientes', []);
  const ing = id ? ingredientes.find(i => i.id === id) : null;

  Modal.show(ing ? 'Editar Ingrediente' : 'Nuevo Ingrediente', `
    <div class="form-group">
      <label>Nombre del ingrediente</label>
      <input type="text" id="ingNombre" value="${Utils.escHtml(ing?.nombre || '')}" placeholder="Ej: Harina 000" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Unidad de medida</label>
        <select id="ingUnidad">
          ${['gr','kg','ml','lt','unidad','taza','cucharada'].map(u =>
            `<option value="${u}" ${ing?.unidad === u ? 'selected' : ''}>${u}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Stock actual</label>
        <input type="number" id="ingStock" value="${ing?.stock || 0}" min="0" step="0.01" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Precio por cantidad base</label>
        <input type="number" id="ingPrecio" value="${ing?.precioUnidad || 0}" min="0" step="0.01" placeholder="Ej: 1500" />
      </div>
      <div class="form-group">
        <label>Cantidad base (para ese precio)</label>
        <input type="number" id="ingBase" value="${ing?.unidadBase || 1}" min="0.01" step="0.01" placeholder="Ej: 1000 gr" />
      </div>
    </div>
    <div class="form-group">
      <label>Stock mínimo de alerta</label>
      <input type="number" id="ingMin" value="${ing?.stockMinimo || 200}" min="0" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarIngrediente('${id || ''}')">Guardar</button>`);
}

function guardarIngrediente(id) {
  const nombre      = document.getElementById('ingNombre').value.trim();
  const unidad      = document.getElementById('ingUnidad').value;
  const stock       = parseFloat(document.getElementById('ingStock').value) || 0;
  const precioUnidad= parseFloat(document.getElementById('ingPrecio').value) || 0;
  const unidadBase  = parseFloat(document.getElementById('ingBase').value) || 1;
  const stockMinimo = parseFloat(document.getElementById('ingMin').value) || 200;

  if (!nombre) { toast('El nombre es obligatorio', 'warning'); return; }

  const ingredientes = DB.get('ingredientes', []);
  if (id) {
    const idx = ingredientes.findIndex(i => i.id === id);
    if (idx >= 0) ingredientes[idx] = { ...ingredientes[idx], nombre, unidad, stock, precioUnidad, unidadBase, stockMinimo };
  } else {
    ingredientes.push({ id: Utils.uid(), nombre, unidad, stock, precioUnidad, unidadBase, stockMinimo });
  }
  DB.set('ingredientes', ingredientes);
  Modal.hide();
  toast(id ? 'Ingrediente actualizado ✅' : 'Ingrediente agregado ✅', 'success');
  initInventario();
}

function editarIngrediente(id) { abrirFormIngrediente(id); }

function eliminarIngrediente(id) {
  Modal.confirm('¿Eliminar este ingrediente? Se eliminarán sus referencias en recetas.', () => {
    const ingredientes = DB.get('ingredientes', []).filter(i => i.id !== id);
    DB.set('ingredientes', ingredientes);
    // Limpiar de recetas
    const recetas = DB.get('recetas', []).map(r => ({
      ...r,
      ingredientes: (r.ingredientes || []).filter(ri => ri.id !== id)
    }));
    DB.set('recetas', recetas);
    toast('Ingrediente eliminado', 'info');
    initInventario();
  });
}

function abrirFormCompra() {
  const ingredientes = DB.get('ingredientes', []);
  if (!ingredientes.length) { toast('Primero crea ingredientes', 'warning'); return; }

  Modal.show('🛍 Registrar Compra', `
    <div class="form-group">
      <label>Ingrediente</label>
      <select id="cIngId">
        ${ingredientes.map(i => `<option value="${i.id}">${Utils.escHtml(i.nombre)} (stock: ${i.stock} ${Utils.escHtml(i.unidad)})</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cantidad comprada</label>
        <input type="number" id="cCantidad" placeholder="Ej: 2000" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label>Costo total</label>
        <input type="number" id="cCosto" placeholder="Ej: 3000" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label>Fecha de compra</label>
      <input type="date" id="cFecha" value="${Utils.today()}" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarCompra()">Registrar</button>`);
}

function guardarCompra() {
  const ingId    = document.getElementById('cIngId').value;
  const cantidad = parseFloat(document.getElementById('cCantidad').value) || 0;
  const costo    = parseFloat(document.getElementById('cCosto').value) || 0;
  const fecha    = document.getElementById('cFecha').value;
  if (!cantidad) { toast('Ingresá la cantidad', 'warning'); return; }
  if (!fecha)    { toast('Elegí una fecha', 'warning'); return; }

  const ingredientes = DB.get('ingredientes', []);
  const idx = ingredientes.findIndex(i => i.id === ingId);
  if (idx < 0) { toast('Ingrediente no encontrado', 'error'); return; }

  const ing         = ingredientes[idx];
  const stockPrevio = ing.stock || 0;
  const precioPrevio= ing.precioUnidad || 0;
  const base        = ing.unidadBase || 1;

  ingredientes[idx].stock = stockPrevio + cantidad;

  /**
   * Precio promedio ponderado. Antes se pisaba el precio con el de la última
   * compra, así que una compra chica y cara distorsionaba el costo de todo
   * el stock viejo (y con él, el costo de todas las recetas).
   */
  if (costo > 0) {
    const precioNuevo = costo / cantidad * base;
    ingredientes[idx].precioUnidad = (stockPrevio > 0 && precioPrevio > 0)
      ? ((stockPrevio * precioPrevio) + (cantidad * precioNuevo)) / (stockPrevio + cantidad)
      : precioNuevo;
  }
  DB.set('ingredientes', ingredientes);

  const compraId = Utils.uid();
  const compras = DB.get('compras', []);
  compras.push({
    id: compraId, ingId, ingNombre: ing.nombre, cantidad,
    unidad: ing.unidad, costo, fecha,
    precioPrevio, stockPrevio          // para poder revertir si se anula
  });
  DB.set('compras', compras);

  // Egreso en caja, enlazado a la compra para poder anular las dos juntas
  if (costo > 0) {
    CajaDB.add({
      tipo: 'egreso',
      concepto: `Compra: ${ing.nombre}`,
      monto: costo,
      fecha,
      metodo: 'Efectivo',
      origen: 'compra',
      refId: compraId
    });
  }

  Modal.hide();
  toast('Compra registrada y stock actualizado ✅', 'success');
  initInventario();
}

function eliminarCompra(id) {
  const compras = DB.get('compras', []);
  const compra  = compras.find(c => c.id === id);
  if (!compra) return;

  Modal.confirm(
    `¿Anular la compra de ${compra.cantidad} ${compra.unidad || ''} de ${compra.ingNombre}? ` +
    `Se descuenta del stock y se borra el egreso de la caja.`,
    () => {
      const ingredientes = DB.get('ingredientes', []);
      const idx = ingredientes.findIndex(i => i.id === compra.ingId);
      if (idx >= 0) {
        // Nunca dejar stock negativo por una anulación
        ingredientes[idx].stock = Math.max(0, (ingredientes[idx].stock || 0) - compra.cantidad);
        if (compra.precioPrevio != null && compra.precioPrevio > 0) {
          ingredientes[idx].precioUnidad = compra.precioPrevio;
        }
        DB.set('ingredientes', ingredientes);
      }
      DB.set('compras', compras.filter(c => c.id !== id));
      CajaDB.removeByRef(id);
      toast('Compra anulada y stock revertido', 'info');
      initInventario();
    },
    'Sí, anular'
  );
}
window.eliminarCompra = eliminarCompra;

window.abrirFormIngrediente = abrirFormIngrediente;
window.guardarIngrediente   = guardarIngrediente;
window.editarIngrediente    = editarIngrediente;
window.eliminarIngrediente  = eliminarIngrediente;
window.abrirFormCompra      = abrirFormCompra;
window.guardarCompra        = guardarCompra;

Router.register('inventario', initInventario);
