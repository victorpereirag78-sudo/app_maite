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

    ${renderAvisoRespaldo()}

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

/**
 * Todo vive en el navegador: si se limpian los datos del sitio o se cambia de
 * teléfono, se pierde todo. Por eso el aviso es visible y no un texto chiquito.
 */
function renderAvisoRespaldo() {
  const ultimo = DB.get('ultimoRespaldo', null);
  if (!ultimo) {
    return `<div class="alert alert-warning">
      ⚠️ <strong>Nunca hiciste un respaldo.</strong> Tus datos viven solo en este dispositivo.
    </div>`;
  }
  const dias = Utils.diasEntre(ultimo, Utils.today());
  if (dias >= 7) {
    return `<div class="alert alert-warning">
      ⚠️ Tu último respaldo fue hace <strong>${dias} días</strong> (${Utils.formatDate(ultimo)}). Conviene exportar uno nuevo.
    </div>`;
  }
  return `<div class="alert alert-success">
    ✅ Último respaldo: <strong>${Utils.formatDate(ultimo)}</strong>${dias === 0 ? ' (hoy)' : ` (hace ${dias} día${dias === 1 ? '' : 's'})`}
  </div>`;
}

// ── Exportar JSON completo
function exportarJSON() {
  const datos = {
    version: '2.0',
    fecha: new Date().toISOString(),
    negocio: DB.get('config', DB.defaults.config).negocio,
    config: DB.get('config', DB.defaults.config)
  };
  // Todas las colecciones, así no hay que tocar el respaldo cada vez que se agrega un módulo
  DB.colecciones.forEach(k => { datos[k] = DB.get(k, []); });

  descargarArchivo(
    new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }),
    `alfajores-backup-${Utils.today()}.json`
  );
  DB.set('ultimoRespaldo', Utils.today());
  toast('Respaldo exportado ✅', 'success');
  initReportes();
}

/**
 * Firefox cancela la descarga si se revoca la URL en el mismo tick,
 * y algunos navegadores exigen que el <a> esté en el DOM.
 */
function descargarArchivo(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
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
      if (!datos || typeof datos !== 'object' || !datos.version) {
        throw new Error('No parece un respaldo de esta app');
      }
      // Validar la forma antes de pisar nada: si el archivo viene roto,
      // antes se sobreescribía igual y no había vuelta atrás.
      const invalidas = DB.colecciones.filter(k => datos[k] !== undefined && !Array.isArray(datos[k]));
      if (invalidas.length) throw new Error('Estructura inválida en: ' + invalidas.join(', '));

      const resumen = DB.colecciones
        .filter(k => Array.isArray(datos[k]) && datos[k].length)
        .map(k => `${datos[k].length} ${k}`)
        .join(', ') || 'sin registros';

      // Nota: el mensaje NO se pre-escapa porque Modal.confirm ya escapa.
      Modal.confirm(
        `¿Restaurar el respaldo de "${datos.negocio || 'sin nombre'}" del ${Utils.formatDate(datos.fecha)}? ` +
        `Contiene: ${resumen}. Esto reemplaza TODOS tus datos actuales.`,
        () => {
          DB.colecciones.forEach(k => { if (Array.isArray(datos[k])) DB.set(k, datos[k]); });
          if (datos.config && typeof datos.config === 'object') DB.set('config', datos.config);
          DB.init();   // completa las colecciones que el respaldo viejo no tenía
          toast('Datos restaurados correctamente ✅', 'success');
          initReportes();
        },
        'Sí, restaurar'
      );
    } catch (err) {
      toast('Archivo inválido ❌ ' + (err.message || ''), 'error', 6000);
    }
  };
  reader.readAsText(file);
  input.value = ''; // reset
}

// ── Exportar CSV de ventas
function exportarCSVVentas() {
  const ventas = DB.get('ventas', []);
  if (!ventas.length) { toast('Sin ventas para exportar', 'warning'); return; }

  const clientes = DB.get('clientes', []);
  const headers = ['Fecha','Producto','Cantidad','Precio unitario','Total','Costo unitario','Ganancia','Cliente','Método de pago','Observaciones'];
  const rows = ventas.map(v => [
    v.fecha,
    v.receta || '',
    v.cantidad,
    v.precioUnit,
    v.total,
    v.costoUnit ?? '',
    v.costoUnit != null ? (v.precioUnit - v.costoUnit) * v.cantidad : '',
    v.clienteId ? (clientes.find(c => c.id === v.clienteId)?.nombre || v.cliente || '') : (v.cliente || ''),
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
  // csvSafe evita que Excel ejecute como f\u00F3rmula un texto que empieza con = + - @
  const csv  = data.map(row => row.map(v => `"${Utils.csvSafe(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  descargarArchivo(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

// ── Borrar todo
function borrarTodo() {
  Modal.confirm(
    '⚠️ ¿Borrar TODOS los datos? Esto elimina ingredientes, recetas, producciones, pedidos, clientes, ventas y caja. No hay vuelta atrás.',
    () => {
      DB.colecciones.forEach(k => DB.set(k, []));
      DB.set('config', DB.defaults.config);
      toast('Datos eliminados', 'warning');
      initReportes();
    },
    'Sí, borrar todo'
  );
}

window.exportarJSON      = exportarJSON;
window.importarJSON      = importarJSON;
window.leerArchivoJSON   = leerArchivoJSON;
window.exportarCSVVentas = exportarCSVVentas;
window.exportarCSVCaja   = exportarCSVCaja;
window.borrarTodo        = borrarTodo;

Router.register('reportes', initReportes);
