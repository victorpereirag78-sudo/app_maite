/**
 * costos.js — Costos reales, precios y punto de equilibrio
 *
 * El costo de una receta solo cuenta ingredientes. En un negocio real el gas,
 * la luz, el packaging y tu hora de trabajo también se pagan, y se comen el
 * margen. Acá se reparten esos gastos fijos entre las unidades producidas
 * para llegar al costo que de verdad tenés que cubrir.
 */

/** Total de gastos fijos mensuales activos. */
function totalGastosFijos() {
  return DB.get('gastosFijos', [])
    .filter(g => g.activo !== false)
    .reduce((s, g) => s + (g.monto || 0), 0);
}
window.totalGastosFijos = totalGastosFijos;

/**
 * Cuánto gasto fijo carga cada unidad.
 *
 * Se reparte sobre un PROMEDIO MENSUAL de los últimos 3 meses, no sobre lo
 * que va del mes en curso. Si se usara el mes actual, el día 2 —con una sola
 * tanda hecha— el gasto por unidad se dispararía y todos los productos
 * parecerían dar pérdida. Se promedia solo entre los meses con actividad,
 * para no subestimar la base cuando el negocio recién arranca.
 */
function costoIndirectoUnitario() {
  const fijos = totalGastosFijos();
  if (fijos <= 0) return { fijos, base: 0, unitario: 0, origen: 'sin gastos fijos', meses: 0 };

  const meses = Utils.ultimosMeses(3).map(d => Utils.monthKey(d));
  const producciones = DB.get('producciones', []);
  const ventas = DB.get('ventas', []);

  const porMes = meses.map(m => ({
    prod: producciones.filter(p => Utils.monthKey(p.fecha) === m).reduce((s, p) => s + (p.unidades || 0), 0),
    vend: ventas.filter(v => Utils.monthKey(v.fecha) === m).reduce((s, v) => s + (v.cantidad || 0), 0)
  }));

  const conProd = porMes.filter(m => m.prod > 0);
  const conVend = porMes.filter(m => m.vend > 0);

  let base = 0, origen = 'sin datos';
  if (conProd.length) {
    base = conProd.reduce((s, m) => s + m.prod, 0) / conProd.length;
    origen = `promedio de producción de ${conProd.length} mes${conProd.length === 1 ? '' : 'es'}`;
  } else if (conVend.length) {
    base = conVend.reduce((s, m) => s + m.vend, 0) / conVend.length;
    origen = `promedio de ventas de ${conVend.length} mes${conVend.length === 1 ? '' : 'es'}`;
  }

  return {
    fijos,
    base: Math.round(base),
    unitario: base > 0 ? fijos / base : 0,
    origen,
    meses: conProd.length || conVend.length,
    pocosDatos: (conProd.length || conVend.length) < 2
  };
}
window.costoIndirectoUnitario = costoIndirectoUnitario;

function initCostos() {
  const recetas      = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);
  const gastos       = DB.get('gastosFijos', []);
  const ind          = costoIndirectoUnitario();

  let html = `
    <div class="section-header">
      <h2 class="section-title">💰 Costos & Precios</h2>
      <div class="section-actions">
        <button class="btn btn-secondary" onclick="abrirFormGasto()">+ Gasto fijo</button>
      </div>
    </div>
  `;

  // ── Gastos fijos
  html += `
    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">🏠 Gastos fijos del mes</div>
      <p style="color:var(--text-muted);font-size:0.87rem;margin-bottom:1rem">
        Todo lo que pagás aunque no vendas: gas, luz, packaging, delivery, tu propia hora de trabajo.
        Sin esto, el precio sugerido miente.
      </p>
      ${gastos.length === 0
        ? `<div class="empty-state" style="padding:1.5rem">
             <div class="empty-icon">🧾</div>
             <p>Sin gastos fijos cargados. El costo que ves ahora solo cuenta ingredientes.</p>
             <button class="btn btn-primary" style="margin-top:1rem" onclick="abrirFormGasto()">+ Cargar el primero</button>
           </div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>Concepto</th><th>Monto mensual</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${gastos.map(g => `<tr style="${g.activo === false ? 'opacity:0.5' : ''}">
                <td><strong>${Utils.escHtml(g.nombre)}</strong>
                  ${g.nota ? `<br><span style="font-size:0.78rem;color:var(--text-muted)">${Utils.escHtml(g.nota)}</span>` : ''}</td>
                <td>${Utils.formatMoney(g.monto)}</td>
                <td>${g.activo === false
                  ? '<span class="badge badge-red">Pausado</span>'
                  : '<span class="badge badge-teal">Activo</span>'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary btn-icon" onclick="toggleGasto('${g.id}')" title="Activar / pausar">${g.activo === false ? '▶️' : '⏸'}</button>
                  <button class="btn btn-sm btn-secondary btn-icon" onclick="abrirFormGasto('${g.id}')" title="Editar">✏️</button>
                  <button class="btn btn-sm btn-danger btn-icon" onclick="eliminarGasto('${g.id}')" title="Eliminar">🗑</button>
                </td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr>
              <td style="text-align:right;font-weight:700">TOTAL MENSUAL</td>
              <td style="font-weight:900;color:var(--orange)">${Utils.formatMoney(ind.fijos)}</td>
              <td colspan="2"></td>
            </tr></tfoot>
          </table></div>
          <div class="alert alert-info" style="margin:1rem 0 0">
            💡 Repartido entre ${ind.base || 0} unidades al mes (${ind.origen}), cada alfajor carga
            <strong>${Utils.formatMoney(ind.unitario)}</strong> de gasto fijo.
          </div>
          ${ind.pocosDatos && ind.base > 0 ? `<div class="alert alert-warning" style="margin:0.6rem 0 0">
            ⚠️ Todavía hay poca historia de producción, así que este reparto es provisorio.
            Va a afinarse solo a medida que cargues más meses.
          </div>` : ''}`}
    </div>
  `;

  // ── Costo por receta con indirectos
  if (recetas.length === 0) {
    html += `<div class="alert alert-info">ℹ️ Creá recetas para calcular costos y precios.</div>`;
  } else {
    html += `<div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">📋 Costo real por producto</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Producto</th><th>Ingredientes</th><th>Gasto fijo</th><th>Costo real</th>
          <th>Tu precio</th><th>Margen real</th>
        </tr></thead><tbody>`;

    recetas.forEach(r => {
      const costo    = calcularCostoReceta(r, ingredientes);
      const directo  = r.unidades > 0 ? costo / r.unidades : 0;
      const real     = directo + ind.unitario;
      const precio   = r.precioVenta || 0;
      const margen   = (precio > 0 && real > 0) ? ((precio - real) / real) * 100 : null;
      const gana     = precio - real;

      const colorMargen = margen == null ? 'var(--text-muted)'
                        : margen < 0 ? '#ff4466'
                        : margen < 25 ? 'var(--orange)' : 'var(--teal)';

      html += `<tr>
        <td><strong>${Utils.escHtml(r.nombre)}</strong></td>
        <td>${Utils.formatMoney(directo)}</td>
        <td style="color:var(--text-muted)">+${Utils.formatMoney(ind.unitario)}</td>
        <td style="color:var(--orange);font-weight:700">${Utils.formatMoney(real)}</td>
        <td>${precio > 0 ? Utils.formatMoney(precio) : '<span style="color:var(--text-muted)">sin precio</span>'}</td>
        <td style="color:${colorMargen};font-weight:700">
          ${margen == null ? '—' : Math.round(margen) + '%'}
          ${precio > 0 ? `<br><span style="font-size:0.75rem;font-weight:600">${gana >= 0 ? '+' : ''}${Utils.formatMoney(gana)}/un.</span>` : ''}
        </td>
      </tr>`;
    });
    html += `</tbody></table></div>`;

    // Alarma solo si el precio no cubre ni los ingredientes: ahí sí cada unidad
    // vendida es plata perdida. Que no llegue a cubrir los gastos fijos es otra
    // cosa —se resuelve vendiendo más volumen— y se ve en el punto de equilibrio.
    const enRojo = recetas.filter(r => {
      const c = calcularCostoReceta(r, ingredientes);
      const directo = r.unidades > 0 ? c / r.unidades : 0;
      return r.precioVenta > 0 && r.precioVenta < directo;
    });
    if (enRojo.length) {
      html += `<div class="alert alert-danger" style="margin:1rem 0 0">
        🚨 Estás vendiendo por debajo de lo que te cuestan los ingredientes:
        <strong>${enRojo.map(r => Utils.escHtml(r.nombre)).join(', ')}</strong>.
        Cada unidad que vendés te hace perder plata.
      </div>`;
    }

    const noCubren = recetas.filter(r => {
      const c = calcularCostoReceta(r, ingredientes);
      const directo = r.unidades > 0 ? c / r.unidades : 0;
      return r.precioVenta > directo && r.precioVenta < directo + ind.unitario;
    });
    if (noCubren.length && ind.unitario > 0) {
      html += `<div class="alert alert-warning" style="margin:1rem 0 0">
        ⚠️ <strong>${noCubren.map(r => Utils.escHtml(r.nombre)).join(', ')}</strong> cubre los ingredientes
        pero no el gasto fijo al ritmo actual. No es pérdida por unidad: se arregla vendiendo más volumen
        (mirá el punto de equilibrio) o subiendo un poco el precio.
      </div>`;
    }
    html += `</div>`;
  }

  // ── Punto de equilibrio
  html += renderPuntoEquilibrio(recetas, ingredientes, ind);

  // ── Simulador
  html += `
    <div class="card">
      <div class="card-title">🧮 Simulador de precio</div>
      <div class="form-row">
        <div class="form-group">
          <label>Costo de ingredientes por unidad</label>
          <input type="number" id="simCosto" placeholder="0" min="0" step="0.01" oninput="simularPrecio()" />
        </div>
        <div class="form-group">
          <label>Margen deseado (%)</label>
          <input type="number" id="simMargen" value="40" min="0" max="500" oninput="simularPrecio()" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cantidad a vender</label>
          <input type="number" id="simCantidad" value="100" min="1" oninput="simularPrecio()" />
        </div>
        <div class="form-group">
          <label>Gasto fijo por unidad</label>
          <input type="number" id="simIndirecto" value="${ind.unitario.toFixed(2)}" min="0" step="0.01" oninput="simularPrecio()" />
        </div>
      </div>
      <div id="simResult" style="margin-top:1rem"></div>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
  simularPrecio();
}

/**
 * Punto de equilibrio: cuántas unidades hay que vender para cubrir los gastos
 * fijos, usando el margen de contribución (precio − costo de ingredientes).
 */
function renderPuntoEquilibrio(recetas, ingredientes, ind) {
  if (ind.fijos <= 0) return '';

  const conPrecio = recetas.filter(r => r.precioVenta > 0);
  if (!conPrecio.length) {
    return `<div class="alert alert-info">
      ℹ️ Cargá el precio de venta en tus recetas para calcular el punto de equilibrio.
    </div>`;
  }

  const filas = conPrecio.map(r => {
    const costo   = calcularCostoReceta(r, ingredientes);
    const directo = r.unidades > 0 ? costo / r.unidades : 0;
    const contrib = r.precioVenta - directo;           // margen de contribución
    return {
      nombre: r.nombre,
      precio: r.precioVenta,
      directo,
      contrib,
      unidades: contrib > 0 ? Math.ceil(ind.fijos / contrib) : null
    };
  });

  // Progreso del mes contra el equilibrio
  const mes = Utils.monthKey();
  const ventasMes = DB.get('ventas', []).filter(v => Utils.monthKey(v.fecha) === mes);
  const contribMes = ventasMes.reduce((s, v) =>
    s + ((v.precioUnit - (v.costoUnit || 0)) * (v.cantidad || 0)), 0);
  const pct = Math.min(100, Math.round(contribMes / ind.fijos * 100));
  const cubierto = contribMes >= ind.fijos;

  return `
    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">⚖️ Punto de equilibrio</div>
      <p style="color:var(--text-muted);font-size:0.87rem;margin-bottom:1rem">
        Cuánto tenés que vender para cubrir los ${Utils.formatMoney(ind.fijos)} de gastos fijos del mes.
      </p>

      <div class="meta-header">
        <span>Cubierto este mes</span>
        <span class="meta-pct" style="color:${cubierto ? 'var(--teal)' : 'var(--orange)'}">${pct}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;background:${cubierto ? 'var(--teal)' : 'var(--orange)'}"></div>
      </div>
      <div class="meta-detail">
        ${Utils.formatMoney(contribMes)} de ${Utils.formatMoney(ind.fijos)} —
        ${cubierto
          ? '✅ ya cubriste los gastos, lo que viene es ganancia'
          : `faltan ${Utils.formatMoney(ind.fijos - contribMes)}`}
      </div>

      <div class="table-wrap" style="margin-top:1.2rem"><table>
        <thead><tr><th>Si vendieras solo…</th><th>Precio</th><th>Deja por unidad</th><th>Necesitás vender</th></tr></thead>
        <tbody>
          ${filas.map(f => `<tr>
            <td><strong>${Utils.escHtml(f.nombre)}</strong></td>
            <td>${Utils.formatMoney(f.precio)}</td>
            <td style="color:${f.contrib > 0 ? 'var(--teal)' : '#ff4466'};font-weight:600">${Utils.formatMoney(f.contrib)}</td>
            <td>${f.unidades == null
              ? '<span class="badge badge-red">nunca: el precio no cubre los ingredientes</span>'
              : `<strong style="color:var(--pink);font-size:1.05rem">${f.unidades}</strong> un./mes`}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `;
}

function simularPrecio() {
  const costo     = parseFloat(document.getElementById('simCosto')?.value) || 0;
  const margen    = parseFloat(document.getElementById('simMargen')?.value) || 0;
  const cantidad  = parseInt(document.getElementById('simCantidad')?.value) || 0;
  const indirecto = parseFloat(document.getElementById('simIndirecto')?.value) || 0;

  const costoReal = costo + indirecto;
  const precio    = costoReal * (1 + margen / 100);
  const ganUnit   = precio - costoReal;
  const ganTotal  = ganUnit * cantidad;
  const ingresos  = precio * cantidad;

  const el = document.getElementById('simResult');
  if (!el) return;
  el.innerHTML = `
    <div class="sim-result">
      <h3>Resultado</h3>
      <div class="sim-row"><span>Ingredientes</span><span>${Utils.formatMoney(costo)}</span></div>
      <div class="sim-row"><span>Gasto fijo por unidad</span><span>+${Utils.formatMoney(indirecto)}</span></div>
      <div class="sim-row"><span>Costo real</span><span style="color:var(--orange)">${Utils.formatMoney(costoReal)}</span></div>
      <div class="sim-row"><span>Margen ${margen}%</span><span>+${Utils.formatMoney(ganUnit)}</span></div>
      <div class="sim-row"><span>Precio de venta</span><span style="color:var(--pink)">${Utils.formatMoney(precio)}</span></div>
      <div class="sim-row"><span>Ingresos por ${cantidad} un.</span><span>${Utils.formatMoney(ingresos)}</span></div>
      <div class="sim-row"><span>Ganancia neta</span><span style="color:var(--teal)">${Utils.formatMoney(ganTotal)}</span></div>
    </div>
    ${precio > 0 ? `<p style="color:var(--text-muted);font-size:0.82rem;margin-top:0.6rem">
      Redondeando: cobrar <strong>${Utils.formatMoney(Math.ceil(precio / 50) * 50)}</strong> te deja
      ${Utils.formatMoney((Math.ceil(precio / 50) * 50 - costoReal) * cantidad)} por ${cantidad} unidades.
    </p>` : ''}
  `;
}
window.simularPrecio = simularPrecio;

// ─────────────────────────────────────────
// GASTOS FIJOS
// ─────────────────────────────────────────
function abrirFormGasto(id = null) {
  const g = id ? DB.get('gastosFijos', []).find(g => g.id === id) : null;

  Modal.show(g ? 'Editar gasto fijo' : 'Nuevo gasto fijo', `
    <div class="form-group">
      <label>Concepto *</label>
      <input type="text" id="gasNombre" value="${Utils.escHtml(g?.nombre || '')}" placeholder="Ej: Gas, Packaging, Mi hora de trabajo" list="sugerenciasGasto" />
      <datalist id="sugerenciasGasto">
        <option value="Gas"></option><option value="Luz"></option><option value="Agua"></option>
        <option value="Packaging y cajas"></option><option value="Etiquetas"></option>
        <option value="Delivery / movilidad"></option><option value="Mi trabajo"></option>
        <option value="Internet / teléfono"></option><option value="Alquiler"></option>
      </datalist>
    </div>
    <div class="form-group">
      <label>Monto mensual *</label>
      <input type="number" id="gasMonto" value="${g?.monto || ''}" min="0" step="0.01" placeholder="0" />
    </div>
    <div class="form-group">
      <label>Nota</label>
      <input type="text" id="gasNota" value="${Utils.escHtml(g?.nota || '')}" placeholder="Ej: promedio de los últimos 3 meses" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarGasto('${id || ''}')">Guardar</button>`);
}

function guardarGasto(id) {
  const nombre = document.getElementById('gasNombre').value.trim();
  const monto  = parseFloat(document.getElementById('gasMonto').value) || 0;
  const nota   = document.getElementById('gasNota').value.trim();

  if (!nombre)   { toast('Poné un concepto', 'warning'); return; }
  if (monto <= 0){ toast('Poné el monto mensual', 'warning'); return; }

  const gastos = DB.get('gastosFijos', []);
  if (id) {
    const idx = gastos.findIndex(g => g.id === id);
    if (idx >= 0) gastos[idx] = { ...gastos[idx], nombre, monto, nota };
  } else {
    gastos.push({ id: Utils.uid(), nombre, monto, nota, activo: true, creado: Utils.today() });
  }
  DB.set('gastosFijos', gastos);
  Modal.hide();
  toast(id ? 'Gasto actualizado ✅' : 'Gasto fijo agregado ✅', 'success');
  initCostos();
}

function toggleGasto(id) {
  const gastos = DB.get('gastosFijos', []);
  const idx = gastos.findIndex(g => g.id === id);
  if (idx < 0) return;
  gastos[idx].activo = gastos[idx].activo === false;
  DB.set('gastosFijos', gastos);
  toast(gastos[idx].activo ? 'Gasto activado' : 'Gasto pausado', 'info');
  initCostos();
}

function eliminarGasto(id) {
  const g = DB.get('gastosFijos', []).find(g => g.id === id);
  if (!g) return;
  Modal.confirm(`¿Eliminar el gasto fijo "${g.nombre}"?`, () => {
    DB.set('gastosFijos', DB.get('gastosFijos', []).filter(x => x.id !== id));
    toast('Gasto eliminado', 'info');
    initCostos();
  });
}

window.abrirFormGasto = abrirFormGasto;
window.guardarGasto   = guardarGasto;
window.toggleGasto    = toggleGasto;
window.eliminarGasto  = eliminarGasto;

Router.register('costos', initCostos);
