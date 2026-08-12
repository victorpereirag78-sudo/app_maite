/**
 * produccion.js — Lotes de producción
 *
 * Es el eslabón que faltaba: hasta acá el inventario solo subía (compras) y
 * las ventas solo sumaban plata. Producir descuenta ingredientes reales y
 * genera stock de producto terminado.
 */

/** Ingredientes que consume una receta por N tandas, con el stock disponible. */
function necesidadesReceta(receta, tandas) {
  const ingredientes = DB.get('ingredientes', []);
  return (receta.ingredientes || []).map(ri => {
    const ing = ingredientes.find(i => i.id === ri.id);
    const necesario = (ri.cantidad || 0) * tandas;
    const disponible = ing?.stock || 0;
    return {
      id: ri.id,
      nombre: ing?.nombre || '(ingrediente borrado)',
      unidad: ing?.unidad || '',
      necesario,
      disponible,
      falta: Math.max(0, necesario - disponible),
      existe: !!ing
    };
  });
}

/** Cuántas tandas completas salen con el stock actual. */
function tandasPosibles(receta) {
  const ingredientes = DB.get('ingredientes', []);
  const items = receta.ingredientes || [];
  if (!items.length) return 0;
  const min = items.reduce((m, ri) => {
    const ing = ingredientes.find(i => i.id === ri.id);
    if (!ing || !ri.cantidad) return m;
    return Math.min(m, Math.floor((ing.stock || 0) / ri.cantidad));
  }, Infinity);
  // Infinity significa que ningún ingrediente de la receta existe todavía
  return Number.isFinite(min) ? min : 0;
}

function initProduccion() {
  const recetas      = DB.get('recetas', []);
  const producciones = DB.get('producciones', []);
  const mes          = Utils.monthKey();

  const prodMes = producciones.filter(p => Utils.monthKey(p.fecha) === mes);
  const unidadesMes = prodMes.reduce((s, p) => s + (p.unidades || 0), 0);
  const costoMes    = prodMes.reduce((s, p) => s + (p.costoTotal || 0), 0);
  const stockTotal  = recetas.reduce((s, r) => s + Stock.disponible(r.id), 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">👩‍🍳 Producción</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="abrirFormProduccion()">+ Registrar producción</button>
        <button class="btn btn-secondary" onclick="abrirFormAjuste()">⚖️ Ajustar stock</button>
      </div>
    </div>
  `;

  if (!recetas.length) {
    html += `<div class="alert alert-info">ℹ️ Primero creá recetas para poder producir.</div>`;
    document.getElementById('moduleContainer').innerHTML = html;
    return;
  }

  html += `
    <div class="stats-grid">
      <div class="stat-card teal">
        <div class="stat-icon">🍫</div>
        <div class="stat-value">${stockTotal}</div>
        <div class="stat-label">Unidades en stock</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-icon">👩‍🍳</div>
        <div class="stat-value">${unidadesMes}</div>
        <div class="stat-label">Producidas este mes</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">💸</div>
        <div class="stat-value">${Utils.formatMoney(costoMes)}</div>
        <div class="stat-label">Costo producido (mes)</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">📦</div>
        <div class="stat-value">${prodMes.length}</div>
        <div class="stat-label">Lotes del mes</div>
      </div>
    </div>
  `;

  // ── Stock de producto terminado
  html += `
    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">🍫 Stock de producto terminado</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Producto</th><th>Disponible</th><th>Comprometido</th><th>Libre</th><th>Alcanza para</th><th></th>
        </tr></thead>
        <tbody>
          ${recetas.map(r => {
            const disp   = Stock.disponible(r.id);
            const comp   = Stock.comprometido(r.id);
            const libre  = disp - comp;
            const tandas = tandasPosibles(r);
            const colorLibre = libre < 0 ? '#ff4466' : libre === 0 ? 'var(--orange)' : 'var(--teal)';
            return `<tr>
              <td><strong>${Utils.escHtml(r.nombre)}</strong></td>
              <td>${disp} un.</td>
              <td>${comp > 0 ? `<span class="badge badge-purple">${comp} en pedidos</span>` : '—'}</td>
              <td style="color:${colorLibre};font-weight:700">${libre} un.</td>
              <td>${tandas > 0
                ? `<span class="badge badge-teal">${tandas} tanda${tandas === 1 ? '' : 's'} más</span>`
                : `<span class="badge badge-red">sin ingredientes</span>`}</td>
              <td><button class="btn btn-sm btn-primary" onclick="abrirFormProduccion('${r.id}')">Producir</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${recetas.some(r => Stock.disponible(r.id) < 0) ? `
        <div class="alert alert-warning" style="margin:1rem 0 0">
          ⚠️ Hay stock en negativo: vendiste más de lo que registraste producir.
          Usá <strong>⚖️ Ajustar stock</strong> para poner el número real de tu mesada.
        </div>` : ''}
    </div>
  `;

  // ── Historial
  const ultimas = producciones.slice(-15).reverse();
  html += `
    <div class="card">
      <div class="card-title">📜 Últimos lotes</div>
      ${ultimas.length === 0
        ? `<div class="empty-state" style="padding:1.5rem"><div class="empty-icon">👩‍🍳</div>
             <p>Todavía no registraste ninguna producción.</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>Fecha</th><th>Producto</th><th>Tandas</th><th>Unidades</th>
              <th>Costo lote</th><th>Costo unit.</th><th></th>
            </tr></thead>
            <tbody>
              ${ultimas.map(p => `<tr>
                <td>${Utils.formatDate(p.fecha)}</td>
                <td><strong>${Utils.escHtml(p.receta)}</strong>${p.nota ? `<br><span style="font-size:0.78rem;color:var(--text-muted)">${Utils.escHtml(p.nota)}</span>` : ''}</td>
                <td>${p.tandas}</td>
                <td>${p.unidades}</td>
                <td>${Utils.formatMoney(p.costoTotal)}</td>
                <td style="color:var(--orange);font-weight:700">${Utils.formatMoney(p.costoUnitario)}</td>
                <td><button class="btn btn-sm btn-danger btn-icon" onclick="anularProduccion('${p.id}')" title="Anular lote">🗑</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function abrirFormProduccion(recetaId = null) {
  const recetas = DB.get('recetas', []);
  if (!recetas.length) { toast('Primero creá una receta', 'warning'); return; }

  Modal.show('👩‍🍳 Registrar producción', `
    <div class="form-group">
      <label>Receta a producir</label>
      <select id="pRecetaId" onchange="calcularNecesidades()">
        ${recetas.map(r => `<option value="${r.id}" ${r.id === recetaId ? 'selected' : ''}>
          ${Utils.escHtml(r.nombre)} (${r.unidades} un. por tanda)
        </option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Cantidad de tandas</label>
        <input type="number" id="pTandas" value="1" min="1" step="1" oninput="calcularNecesidades()" />
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="pFecha" value="${Utils.today()}" />
      </div>
    </div>
    <div class="form-group">
      <label>Nota (opcional)</label>
      <input type="text" id="pNota" placeholder="Ej: tanda para el pedido de Ana" />
    </div>
    <div id="pNecesidades"></div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" id="btnProducir" onclick="guardarProduccion()">Producir</button>`);

  calcularNecesidades();
}

function calcularNecesidades() {
  const recetaId = document.getElementById('pRecetaId')?.value;
  const tandas   = parseInt(document.getElementById('pTandas')?.value) || 0;
  const cont     = document.getElementById('pNecesidades');
  const btn      = document.getElementById('btnProducir');
  if (!cont) return;

  const receta = DB.get('recetas', []).find(r => r.id === recetaId);
  if (!receta || tandas <= 0) { cont.innerHTML = ''; return; }

  if (!(receta.ingredientes || []).length) {
    cont.innerHTML = `<div class="alert alert-warning">⚠️ Esta receta no tiene ingredientes cargados: no se va a descontar nada del inventario.</div>`;
    if (btn) btn.disabled = false;
    return;
  }

  const nec = necesidadesReceta(receta, tandas);
  const faltantes = nec.filter(n => n.falta > 0);
  const costoTotal = calcularCostoReceta(receta, DB.get('ingredientes', [])) * tandas;
  const unidades = (receta.unidades || 0) * tandas;

  cont.innerHTML = `
    <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
      <p style="font-weight:700;margin-bottom:0.6rem">Se va a descontar del inventario</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Ingrediente</th><th>Necesario</th><th>En stock</th><th></th></tr></thead>
        <tbody>
          ${nec.map(n => `<tr>
            <td>${Utils.escHtml(n.nombre)}</td>
            <td>${+n.necesario.toFixed(2)} ${Utils.escHtml(n.unidad)}</td>
            <td>${+n.disponible.toFixed(2)} ${Utils.escHtml(n.unidad)}</td>
            <td>${n.falta > 0
              ? `<span class="badge badge-red">faltan ${+n.falta.toFixed(2)}</span>`
              : `<span class="badge badge-teal">✅</span>`}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>

      <div class="sim-result" style="margin-top:1rem">
        <div class="sim-row"><span>Unidades a producir</span><span>${unidades} un.</span></div>
        <div class="sim-row"><span>Costo del lote</span><span>${Utils.formatMoney(costoTotal)}</span></div>
        <div class="sim-row"><span>Costo por unidad</span><span style="color:var(--pink)">${Utils.formatMoney(unidades > 0 ? costoTotal / unidades : 0)}</span></div>
      </div>

      ${faltantes.length ? `<div class="alert alert-warning" style="margin-top:1rem">
        ⚠️ No te alcanza: falta <strong>${faltantes.map(f => `${+f.falta.toFixed(2)} ${Utils.escHtml(f.unidad)} de ${Utils.escHtml(f.nombre)}`).join(', ')}</strong>.
        Registrá la compra primero o bajá la cantidad de tandas.
      </div>` : ''}
    </div>
  `;

  if (btn) {
    btn.disabled = faltantes.length > 0;
    btn.style.opacity = faltantes.length > 0 ? '0.5' : '1';
    btn.style.cursor  = faltantes.length > 0 ? 'not-allowed' : 'pointer';
  }
}
window.calcularNecesidades = calcularNecesidades;

function guardarProduccion() {
  const recetaId = document.getElementById('pRecetaId').value;
  const tandas   = parseInt(document.getElementById('pTandas').value) || 0;
  const fecha    = document.getElementById('pFecha').value;
  const nota     = document.getElementById('pNota').value.trim();

  const receta = DB.get('recetas', []).find(r => r.id === recetaId);
  if (!receta)      { toast('Receta no encontrada', 'error'); return; }
  if (tandas <= 0)  { toast('Ingresá cuántas tandas hiciste', 'warning'); return; }
  if (!fecha)       { toast('Elegí una fecha', 'warning'); return; }

  const nec = necesidadesReceta(receta, tandas);
  if (nec.some(n => n.falta > 0)) {
    toast('No hay stock suficiente para este lote', 'error');
    return;
  }

  // Descontar ingredientes
  const ingredientes = DB.get('ingredientes', []);
  const consumos = [];
  nec.forEach(n => {
    const idx = ingredientes.findIndex(i => i.id === n.id);
    if (idx >= 0) {
      ingredientes[idx].stock = +((ingredientes[idx].stock || 0) - n.necesario).toFixed(4);
      consumos.push({ id: n.id, nombre: n.nombre, cantidad: n.necesario, unidad: n.unidad });
    }
  });
  DB.set('ingredientes', ingredientes);

  const unidades = (receta.unidades || 0) * tandas;

  // Costo real de ESTE lote con los precios de hoy: queda congelado en el
  // registro, así una compra futura más cara no reescribe la historia.
  const costoTotal = consumos.reduce((s, c) => {
    const ing = ingredientes.find(i => i.id === c.id);
    if (!ing || !(ing.precioUnidad > 0)) return s;
    return s + (c.cantidad / (ing.unidadBase || 1)) * ing.precioUnidad;
  }, 0);

  const producciones = DB.get('producciones', []);
  producciones.push({
    id: Utils.uid(),
    recetaId,
    receta: receta.nombre,
    tandas,
    unidades,
    costoTotal,
    costoUnitario: unidades > 0 ? costoTotal / unidades : 0,
    fecha,
    nota,
    consumos
  });
  DB.set('producciones', producciones);

  Modal.hide();
  toast(`${unidades} unidades producidas ✅ Ingredientes descontados`, 'success');
  initProduccion();
}

function anularProduccion(id) {
  const producciones = DB.get('producciones', []);
  const prod = producciones.find(p => p.id === id);
  if (!prod) return;

  Modal.confirm(
    `¿Anular el lote de ${prod.unidades} unidades de ${prod.receta}? ` +
    `Los ingredientes vuelven al inventario y se descuentan las unidades del stock.`,
    () => {
      const ingredientes = DB.get('ingredientes', []);
      (prod.consumos || []).forEach(c => {
        const idx = ingredientes.findIndex(i => i.id === c.id);
        if (idx >= 0) ingredientes[idx].stock = +((ingredientes[idx].stock || 0) + c.cantidad).toFixed(4);
      });
      DB.set('ingredientes', ingredientes);
      DB.set('producciones', producciones.filter(p => p.id !== id));
      toast('Lote anulado e ingredientes devueltos', 'info');
      initProduccion();
    },
    'Sí, anular'
  );
}

// ── Ajuste manual de stock terminado (recuento real, mermas, regalos)
function abrirFormAjuste() {
  const recetas = DB.get('recetas', []);
  if (!recetas.length) { toast('Primero creá una receta', 'warning'); return; }

  Modal.show('⚖️ Ajustar stock terminado', `
    <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:1rem">
      Para cuadrar con lo que realmente tenés: recuento, mermas, unidades regaladas o probadas.
    </p>
    <div class="form-group">
      <label>Producto</label>
      <select id="ajRecetaId" onchange="mostrarStockActual()">
        ${recetas.map(r => `<option value="${r.id}">${Utils.escHtml(r.nombre)}</option>`).join('')}
      </select>
    </div>
    <div id="ajActual" class="alert alert-info" style="padding:0.6rem 1rem;font-size:0.85rem"></div>
    <div class="form-row">
      <div class="form-group">
        <label>Stock real (unidades que tenés)</label>
        <input type="number" id="ajReal" placeholder="0" min="0" step="1" />
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="ajFecha" value="${Utils.today()}" />
      </div>
    </div>
    <div class="form-group">
      <label>Motivo</label>
      <input type="text" id="ajMotivo" placeholder="Ej: recuento del lunes, 3 se rompieron" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarAjuste()">Ajustar</button>`);

  mostrarStockActual();
}

function mostrarStockActual() {
  const id = document.getElementById('ajRecetaId')?.value;
  const div = document.getElementById('ajActual');
  if (!id || !div) return;
  div.innerHTML = `El sistema tiene registradas <strong>${Stock.disponible(id)} unidades</strong>.`;
}
window.mostrarStockActual = mostrarStockActual;

function guardarAjuste() {
  const recetaId = document.getElementById('ajRecetaId').value;
  const real     = parseInt(document.getElementById('ajReal').value);
  const fecha    = document.getElementById('ajFecha').value;
  const motivo   = document.getElementById('ajMotivo').value.trim();

  if (isNaN(real) || real < 0) { toast('Ingresá cuántas unidades tenés', 'warning'); return; }

  const actual = Stock.disponible(recetaId);
  const delta  = real - actual;
  if (delta === 0) { toast('El stock ya coincide, no hay nada que ajustar', 'info'); Modal.hide(); return; }

  const receta = DB.get('recetas', []).find(r => r.id === recetaId);
  const ajustes = DB.get('ajustesStock', []);
  ajustes.push({
    id: Utils.uid(),
    recetaId,
    receta: receta?.nombre || '',
    unidades: delta,
    motivo: motivo || 'Ajuste manual',
    fecha
  });
  DB.set('ajustesStock', ajustes);

  Modal.hide();
  toast(`Stock ajustado: ${delta > 0 ? '+' : ''}${delta} unidades`, 'success');
  initProduccion();
}

window.abrirFormProduccion = abrirFormProduccion;
window.guardarProduccion   = guardarProduccion;
window.anularProduccion    = anularProduccion;
window.abrirFormAjuste     = abrirFormAjuste;
window.guardarAjuste       = guardarAjuste;
window.tandasPosibles      = tandasPosibles;
window.necesidadesReceta   = necesidadesReceta;

Router.register('produccion', initProduccion);
