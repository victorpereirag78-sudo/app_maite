/**
 * recetas.js — Creación y gestión de recetas de alfajores
 */

function initRecetas() {
  const recetas      = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);

  let html = `
    <div class="section-header">
      <h2 class="section-title">📋 Recetas</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="abrirFormReceta()">+ Nueva receta</button>
      </div>
    </div>
  `;

  if (!ingredientes.length) {
    html += `<div class="alert alert-info">ℹ️ Primero crea ingredientes en el módulo de Inventario.</div>`;
  }

  if (recetas.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">📋</div>
      <p>Sin recetas. ¡Crea tu primera receta de alfajores!</p></div>`;
  } else {
    html += recetas.map(r => renderRecetaCard(r, ingredientes)).join('');
  }

  document.getElementById('moduleContainer').innerHTML = html;
}

function renderRecetaCard(receta, ingredientes) {
  const costo = calcularCostoReceta(receta, ingredientes);
  const unit  = receta.unidades > 0 ? costo / receta.unidades : 0;

  return `
    <div class="card" style="margin-bottom:1.2rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h3 style="font-family:var(--font-display);font-weight:800;font-size:1.1rem">${Utils.escHtml(receta.nombre)}</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-top:2px">${Utils.escHtml(receta.descripcion || '')}</p>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-sm btn-secondary" onclick="editarReceta('${receta.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger"    onclick="eliminarReceta('${receta.id}')">🗑 Eliminar</button>
        </div>
      </div>

      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin:0.9rem 0 0.75rem">
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:0.6rem 1rem;text-align:center">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.2rem;color:var(--orange)">${receta.unidades}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Unidades</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:0.6rem 1rem;text-align:center">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.2rem;color:var(--pink)">${Utils.formatMoney(costo)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Costo total</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:0.6rem 1rem;text-align:center">
          <div style="font-family:var(--font-display);font-weight:900;font-size:1.2rem;color:var(--teal)">${Utils.formatMoney(unit)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Costo unitario</div>
        </div>
      </div>

      <div>
        <p style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-bottom:0.4rem">INGREDIENTES</p>
        <div>
          ${(receta.ingredientes || []).map(ri => {
            const ing = ingredientes.find(i => i.id === ri.id);
            return `<span class="ing-tag">
              ${Utils.escHtml(ing?.nombre || ri.id)}: ${ri.cantidad} ${Utils.escHtml(ing?.unidad || '')}
            </span>`;
          }).join('')}
          ${receta.ingredientes?.length === 0 ? '<span style="color:var(--text-muted);font-size:0.85rem">Sin ingredientes</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Estado temporal del formulario de receta
let _recetaIng = [];

function abrirFormReceta(id = null) {
  const recetas      = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);
  const rec = id ? recetas.find(r => r.id === id) : null;

  _recetaIng = rec ? JSON.parse(JSON.stringify(rec.ingredientes || [])) : [];

  Modal.show(rec ? 'Editar Receta' : 'Nueva Receta', `
    <div class="form-group">
      <label>Nombre de la receta</label>
      <input type="text" id="recNombre" value="${Utils.escHtml(rec?.nombre || '')}" placeholder="Ej: Alfajor de maicena" />
    </div>
    <div class="form-group">
      <label>Descripción (opcional)</label>
      <input type="text" id="recDesc" value="${Utils.escHtml(rec?.descripcion || '')}" placeholder="Descripción breve..." />
    </div>
    <div class="form-group">
      <label>Unidades producidas</label>
      <input type="number" id="recUnidades" value="${rec?.unidades || 12}" min="1" />
    </div>

    <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:0.5rem">
      <p style="font-weight:700;margin-bottom:0.75rem">Ingredientes</p>
      <div id="recIngList" style="margin-bottom:0.75rem"></div>

      ${ingredientes.length > 0 ? `
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <select id="selIngId" style="flex:2;min-width:140px">
          ${ingredientes.map(i => `<option value="${i.id}">${Utils.escHtml(i.nombre)} (${i.unidad})</option>`).join('')}
        </select>
        <input type="number" id="selIngCant" placeholder="Cantidad" min="0" step="0.01" style="flex:1;min-width:80px" />
        <button class="btn btn-secondary btn-sm" onclick="agregarIngReceta()">+ Agregar</button>
      </div>` : `<p style="color:var(--text-muted);font-size:0.85rem">Sin ingredientes en inventario</p>`}
    </div>
    <div id="recCostoPreview" style="margin-top:0.75rem;font-size:0.88rem;color:var(--text-muted)"></div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarReceta('${id || ''}')">Guardar</button>`);

  renderIngListModal();
}

function renderIngListModal() {
  const ingredientes = DB.get('ingredientes', []);
  const list = document.getElementById('recIngList');
  if (!list) return;

  if (_recetaIng.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Sin ingredientes agregados</p>';
  } else {
    list.innerHTML = _recetaIng.map((ri, idx) => {
      const ing = ingredientes.find(i => i.id === ri.id);
      return `<span class="ing-tag">
        ${Utils.escHtml(ing?.nombre || ri.id)}: ${ri.cantidad} ${Utils.escHtml(ing?.unidad || '')}
        <span class="ing-tag-remove" onclick="quitarIngReceta(${idx})">✕</span>
      </span>`;
    }).join('');
  }

  // Preview costo
  const ingredientesAll = DB.get('ingredientes', []);
  const unidades = parseInt(document.getElementById('recUnidades')?.value) || 1;
  const costo = _recetaIng.reduce((s, ri) => {
    const ing = ingredientesAll.find(i => i.id === ri.id);
    if (ing && ing.precioUnidad > 0) s += (ri.cantidad / ing.unidadBase) * ing.precioUnidad;
    return s;
  }, 0);
  const preview = document.getElementById('recCostoPreview');
  if (preview && costo > 0) {
    preview.innerHTML = `💰 Costo estimado: <strong>${Utils.formatMoney(costo)}</strong> | Unitario: <strong>${Utils.formatMoney(costo / unidades)}</strong>`;
  }
}

function agregarIngReceta() {
  const id   = document.getElementById('selIngId').value;
  const cant = parseFloat(document.getElementById('selIngCant').value) || 0;
  if (!id || cant <= 0) { toast('Seleccioná ingrediente y cantidad', 'warning'); return; }

  const existe = _recetaIng.findIndex(ri => ri.id === id);
  if (existe >= 0) _recetaIng[existe].cantidad = cant;
  else _recetaIng.push({ id, cantidad: cant });

  document.getElementById('selIngCant').value = '';
  renderIngListModal();
}

function quitarIngReceta(idx) {
  _recetaIng.splice(idx, 1);
  renderIngListModal();
}

function guardarReceta(id) {
  const nombre    = document.getElementById('recNombre').value.trim();
  const descripcion = document.getElementById('recDesc').value.trim();
  const unidades  = parseInt(document.getElementById('recUnidades').value) || 1;
  if (!nombre) { toast('El nombre es obligatorio', 'warning'); return; }

  const recetas = DB.get('recetas', []);
  if (id) {
    const idx = recetas.findIndex(r => r.id === id);
    if (idx >= 0) recetas[idx] = { ...recetas[idx], nombre, descripcion, unidades, ingredientes: _recetaIng };
  } else {
    recetas.push({ id: Utils.uid(), nombre, descripcion, unidades, ingredientes: _recetaIng });
  }
  DB.set('recetas', recetas);
  Modal.hide();
  toast(id ? 'Receta actualizada ✅' : 'Receta creada ✅', 'success');
  initRecetas();
}

function editarReceta(id) { abrirFormReceta(id); }

function eliminarReceta(id) {
  Modal.confirm('¿Eliminar esta receta?', () => {
    DB.set('recetas', DB.get('recetas', []).filter(r => r.id !== id));
    toast('Receta eliminada', 'info');
    initRecetas();
  });
}

window.abrirFormReceta = abrirFormReceta;
window.guardarReceta   = guardarReceta;
window.editarReceta    = editarReceta;
window.eliminarReceta  = eliminarReceta;
window.agregarIngReceta = agregarIngReceta;
window.quitarIngReceta  = quitarIngReceta;

Router.register('recetas', initRecetas);
