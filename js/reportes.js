/**
 * reportes.js — Exportar, respaldar y restaurar datos
 */

function initReportes() {
  const ventas      = DB.get('ventas', []);
  const ingredientes= DB.get('ingredientes', []);
  const recetas     = DB.get('recetas', []);
  const caja        = DB.get('caja', []);

  const totVentas   = ventas.reduce((s, v) => s + (v.total || 0), 0);
  const ingCaja     = caja.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.monto, 0);
  const egCaja      = caja.filter(c => c.tipo === 'egreso').reduce((s, c) => s + c.monto, 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">📄 Reportes</h2>
    </div>

    <div class="stats-grid">
      <div class="stat-card pink">
        <div class="stat-icon">🧾</div>
        <div class="stat-value">${ventas.length}</div>
        <div class="stat-label">Ventas totales</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-icon">💰</div>
        <div class="stat-value">${Utils.formatMoney(totVentas)}</div>
        <div class="stat-label">Facturado total</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">📦</div>
        <div class="stat-value">${ingredientes.length}</div>
        <div class="stat-label">Ingredientes</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${recetas.length}</div>
        <div class="stat-label">Recetas</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">💾 Respaldo de datos</div>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
        Exporta todos tus datos a un archivo JSON para guardar o transferir entre dispositivos.
      </p>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="exportarJSON()">📦 Exportar JSON</button>
        <button class="btn btn-secondary" onclick="importarJSON()">📂 Restaurar respaldo</button>
      </div>
      <input type="file" id="fileInput" accept=".json" style="display:none" onchange="leerArchivoJSON(this)" />
    </div>

    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">📊 Exportar ventas</div>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
        Descarga el listado completo de ventas en formato CSV compatible con Excel.
      </p>
      <button class="btn btn-success" onclick="exportarCSVVentas()">📥 Descargar CSV de ventas</button>
    </div>

    <div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">🧾 Exportar movimientos de caja</div>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
        Descarga todos los movimientos de caja (ingresos y egresos) en CSV.
      </p>
      <button class="btn btn-success" onclick="exportarCSVCaja()">📥 Descargar CSV de caja</button>
    </div>

    <div class="card">
      <div class="card-title">⚠️ Zona de peligro</div>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem">
        Elimina permanentemente todos los datos de la aplicación. Esta acción no se puede deshacer.
      </p>
      <button class="btn btn-danger" onclick="borrarTodo()">🗑 Borrar todos los datos</button>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

// ── Exportar JSON completo
function exportarJSON() {
  const datos = {
    version: '1.0',
    fecha: new Date().toISOString(),
    negocio: DB.get('config', DB.defaults.config).negocio,
    ingredientes: DB.get('ingredientes', []),
    compras:      DB.get('compras', []),
    recetas:      DB.get('recetas', []),
    ventas:       DB.get('ventas', []),
    caja:         DB.get('caja', []),
    metas:        DB.get('metas', []),
    config:       DB.get('config', DB.defaults.config)
  };

  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `alfajores-backup-${Utils.today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Respaldo exportado ✅', 'success');
}

function importarJSON() {
  document.getElementById('fileInput').click();
}

function leerArchivoJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const datos = JSON.parse(e.target.result);
      if (!datos.version) throw new Error('Archivo inválido');

      Modal.confirm(
        `¿Restaurar respaldo de "${Utils.escHtml(datos.negocio || '')}" del ${Utils.formatDate(datos.fecha)}? Esto sobreescribirá tus datos actuales.`,
        () => {
          if (datos.ingredientes) DB.set('ingredientes', datos.ingredientes);
          if (datos.compras)      DB.set('compras', datos.compras);
          if (datos.recetas)      DB.set('recetas', datos.recetas);
          if (datos.ventas)       DB.set('ventas', datos.ventas);
          if (datos.caja)         DB.set('caja', datos.caja);
          if (datos.metas)        DB.set('metas', datos.metas);
          if (datos.config)       DB.set('config', datos.config);
          toast('Datos restaurados correctamente ✅', 'success');
          initReportes();
        }
      );
    } catch {
      toast('Archivo JSON inválido ❌', 'error');
    }
  };
  reader.readAsText(file);
  input.value = ''; // reset
}

// ── Exportar CSV de ventas
function exportarCSVVentas() {
  const ventas = DB.get('ventas', []);
  if (!ventas.length) { toast('Sin ventas para exportar', 'warning'); return; }

  const headers = ['Fecha','Receta','Cantidad','Precio unitario','Total','Cliente','Método de pago','Observaciones'];
  const rows = ventas.map(v => [
    v.fecha,
    v.receta || '',
    v.cantidad,
    v.precioUnit,
    v.total,
    v.cliente || '',
    v.metodo || 'Efectivo',
    v.obs || ''
  ]);

  descargarCSV([headers, ...rows], `ventas-${Utils.today()}.csv`);
  toast('CSV de ventas descargado ✅', 'success');
}

// ── Exportar CSV de caja
function exportarCSVCaja() {
  const caja = DB.get('caja', []);
  if (!caja.length) { toast('Sin movimientos para exportar', 'warning'); return; }

  const headers = ['Fecha','Tipo','Concepto','Monto','Método'];
  const rows = caja.map(c => [
    c.fecha,
    c.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
    c.concepto,
    c.monto,
    c.metodo || ''
  ]);

  descargarCSV([headers, ...rows], `caja-${Utils.today()}.csv`);
  toast('CSV de caja descargado ✅', 'success');
}

function descargarCSV(data, filename) {
  const csv  = data.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Borrar todo
function borrarTodo() {
  Modal.confirm(
    '⚠️ ¿Borrar TODOS los datos? Esto eliminará ingredientes, recetas, ventas y caja. No hay vuelta atrás.',
    () => {
      ['ingredientes','compras','recetas','ventas','caja','metas'].forEach(k => DB.set(k, []));
      DB.set('config', DB.defaults.config);
      toast('Datos eliminados', 'warning');
      initReportes();
    }
  );
}

window.exportarJSON      = exportarJSON;
window.importarJSON      = importarJSON;
window.leerArchivoJSON   = leerArchivoJSON;
window.exportarCSVVentas = exportarCSVVentas;
window.exportarCSVCaja   = exportarCSVCaja;
window.borrarTodo        = borrarTodo;

Router.register('reportes', initReportes);
