/**
 * app.js — Alfajores Manager
 * Core: navegación, almacenamiento, UI helpers, PWA
 */

'use strict';

// ─────────────────────────────────────────
// STORAGE — wrapper sobre localStorage
// ─────────────────────────────────────────
const DB = {
  _key: k => `alfmgr_${k}`,

  get(k, def = null) {
    try {
      const v = localStorage.getItem(this._key(k));
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },

  set(k, v) {
    try { localStorage.setItem(this._key(k), JSON.stringify(v)); return true; }
    catch { return false; }
  },

  remove(k) { localStorage.removeItem(this._key(k)); },

  // Datos iniciales
  defaults: {
    ingredientes: [],
    compras: [],
    recetas: [],
    ventas: [],
    caja: [],
    metas: [],
    config: {
      moneda: '$',
      negocio: 'Alfajores Maite ❤️',
      stockMinimo: 200
    }
  },

  init() {
    Object.entries(this.defaults).forEach(([k, v]) => {
      if (this.get(k) === null) this.set(k, v);
    });
  }
};

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────
const Utils = {
  formatMoney(n) {
    const cfg = DB.get('config', DB.defaults.config);
    return `${cfg.moneda}${(+n || 0).toLocaleString('es-CL')}`;
  },

  formatDate(d) {
    return new Date(d).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  monthKey(d) {
    const dt = d ? new Date(d) : new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  },

  escHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  },

  getMonthName(key) {
    const [y, m] = key.split('-');
    return new Date(+y, +m-1, 1).toLocaleDateString('es-CL', { month:'long', year:'numeric' });
  }
};

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'💬' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]||'💬'}</span><span>${Utils.escHtml(msg)}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => {
    t.classList.add('fade-out');
    setTimeout(() => t.remove(), 350);
  }, duration);
}

// ─────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────
const Modal = {
  show(title, bodyHtml, footerHtml = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    document.getElementById('modalBackdrop').classList.add('show');
  },
  hide() {
    document.getElementById('modalBackdrop').classList.remove('show');
  },
  confirm(msg, onConfirm) {
    this.show(
      '¿Confirmar acción?',
      `<p style="font-size:1rem">${Utils.escHtml(msg)}</p>`,
      `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
       <button class="btn btn-danger" id="confirmOk">Sí, confirmar</button>`
    );
    document.getElementById('confirmOk').onclick = () => { Modal.hide(); onConfirm(); };
  }
};

// ─────────────────────────────────────────
// ROUTER / NAVEGACIÓN
// ─────────────────────────────────────────
const Router = {
  current: 'dashboard',
  modules: {},

  register(name, initFn) {
    this.modules[name] = initFn;
  },

  go(name) {
    this.current = name;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.module === name);
    });
    const titles = {
      dashboard: '🏠 Inicio',
      inventario: '📦 Inventario',
      recetas: '📋 Recetas',
      costos: '💰 Costos',
      ventas: '🛒 Ventas',
      caja: '💵 Caja',
      estadisticas: '📈 Estadísticas',
      metas: '🎯 Metas',
      reportes: '📄 Reportes'
    };
    document.getElementById('pageTitle').textContent = titles[name] || name;
    const fn = this.modules[name];
    if (fn) {
      document.getElementById('moduleContainer').innerHTML = '<div class="fade-in">';
      fn();
    } else {
      document.getElementById('moduleContainer').innerHTML =
        `<div class="empty-state"><div class="empty-icon">🚧</div><p>Módulo en construcción</p></div>`;
    }
    // Cerrar sidebar en mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  }
};

// ─────────────────────────────────────────
// TEMA
// ─────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('alfmgr_theme') || 'dark';
  applyTheme(saved);
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('alfmgr_theme', t);
  document.getElementById('themeIcon').textContent  = t === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeLabel').textContent = t === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ─────────────────────────────────────────
// MÓDULO COSTOS (simple, sin JS separado)
// ─────────────────────────────────────────
function initCostos() {
  const recetas = DB.get('recetas', []);
  const ingredientes = DB.get('ingredientes', []);

  let html = `
    <div class="section-header">
      <h2 class="section-title">💰 Costos & Precios</h2>
    </div>
  `;

  if (recetas.length === 0) {
    html += `<div class="alert alert-info">ℹ️ Primero crea recetas para calcular costos.</div>`;
  } else {
    html += `<div class="card" style="margin-bottom:1.2rem">
      <div class="card-title">📋 Costo por receta</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Receta</th><th>Unidades</th><th>Costo total</th><th>Costo unit.</th><th>Precio sugerido (+40%)</th>
        </tr></thead><tbody>`;
    recetas.forEach(r => {
      const costo = calcularCostoReceta(r, ingredientes);
      const unit  = r.unidades > 0 ? costo / r.unidades : 0;
      const sug   = unit * 1.4;
      html += `<tr>
        <td><strong>${Utils.escHtml(r.nombre)}</strong></td>
        <td>${r.unidades}</td>
        <td>${Utils.formatMoney(costo)}</td>
        <td style="color:var(--orange);font-weight:700">${Utils.formatMoney(unit)}</td>
        <td style="color:var(--teal);font-weight:700">${Utils.formatMoney(sug)}</td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
  }

  // Simulador
  html += `
    <div class="card">
      <div class="card-title">🧮 Simulador de precio de venta</div>
      <div class="form-row">
        <div class="form-group">
          <label>Costo unitario</label>
          <input type="number" id="simCosto" placeholder="0" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label>Margen de ganancia (%)</label>
          <input type="number" id="simMargen" value="40" min="0" max="500" />
        </div>
      </div>
      <div class="form-group">
        <label>Cantidad a vender</label>
        <input type="number" id="simCantidad" value="100" min="1" />
      </div>
      <button class="btn btn-primary" onclick="simularPrecio()">Calcular</button>
      <div id="simResult" style="margin-top:1rem"></div>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function calcularCostoReceta(receta, ingredientes) {
  let total = 0;
  (receta.ingredientes || []).forEach(ri => {
    const ing = ingredientes.find(i => i.id === ri.id);
    if (ing && ing.precioUnidad > 0) {
      total += (ri.cantidad / ing.unidadBase) * ing.precioUnidad;
    }
  });
  return total;
}
window.calcularCostoReceta = calcularCostoReceta;

function simularPrecio() {
  const costo    = parseFloat(document.getElementById('simCosto').value) || 0;
  const margen   = parseFloat(document.getElementById('simMargen').value) || 40;
  const cantidad = parseInt(document.getElementById('simCantidad').value) || 100;
  const precio   = costo * (1 + margen / 100);
  const ganTotal = (precio - costo) * cantidad;
  const ingresos = precio * cantidad;

  document.getElementById('simResult').innerHTML = `
    <div class="sim-result">
      <h3>Resultado del simulador</h3>
      <div class="sim-row"><span>Costo unitario</span><span>${Utils.formatMoney(costo)}</span></div>
      <div class="sim-row"><span>Margen ${margen}%</span><span>+${Utils.formatMoney(precio - costo)}</span></div>
      <div class="sim-row"><span>Precio de venta</span><span style="color:var(--pink)">${Utils.formatMoney(precio)}</span></div>
      <div class="sim-row"><span>Ingresos totales (${cantidad} un.)</span><span>${Utils.formatMoney(ingresos)}</span></div>
      <div class="sim-row"><span>Ganancia neta</span><span style="color:var(--teal)">${Utils.formatMoney(ganTotal)}</span></div>
    </div>
  `;
}
window.simularPrecio = simularPrecio;

// ─────────────────────────────────────────
// MÓDULO METAS
// ─────────────────────────────────────────
function initMetas() {
  const metas = DB.get('metas', []);
  const ventas = DB.get('ventas', []);
  const caja   = DB.get('caja', []);
  const mes    = Utils.monthKey();

  // Calcular progreso real
  const ventasMes  = ventas.filter(v => Utils.monthKey(v.fecha) === mes)
                           .reduce((s, v) => s + (v.total || 0), 0);
  const ingresosMes = caja.filter(c => c.tipo === 'ingreso' && Utils.monthKey(c.fecha) === mes)
                          .reduce((s, c) => s + (c.monto || 0), 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">🎯 Metas del mes</h2>
      <div class="section-actions">
        <button class="btn btn-primary" onclick="abrirFormMeta()">+ Nueva meta</button>
      </div>
    </div>
  `;

  if (metas.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">🎯</div><p>Sin metas definidas. ¡Define tus objetivos!</p></div>`;
  } else {
    metas.forEach(m => {
      const actual = m.tipo === 'ventas' ? ventasMes : ingresosMes;
      const pct    = Math.min(100, m.objetivo > 0 ? Math.round(actual / m.objetivo * 100) : 0);
      const color  = pct >= 100 ? 'var(--teal)' : pct >= 60 ? 'var(--yellow)' : 'var(--pink)';

      html += `
        <div class="meta-card">
          <div class="meta-header">
            <span class="meta-name">${Utils.escHtml(m.nombre)}</span>
            <span class="meta-pct" style="color:${color}">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="meta-detail">
            ${Utils.formatMoney(actual)} de ${Utils.formatMoney(m.objetivo)} — ${m.tipo === 'ventas' ? 'Ventas' : 'Ingresos'}
            <button class="btn btn-sm btn-danger" style="float:right;margin-top:4px"
              onclick="eliminarMeta('${m.id}')">🗑</button>
          </div>
        </div>
      `;
    });
  }

  document.getElementById('moduleContainer').innerHTML = html;
}

function abrirFormMeta() {
  Modal.show('Nueva meta', `
    <div class="form-group">
      <label>Nombre de la meta</label>
      <input type="text" id="metaNombre" placeholder="Ej: Meta de ventas junio" />
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="metaTipo">
        <option value="ventas">Ventas en dinero</option>
        <option value="ingresos">Ingresos totales</option>
      </select>
    </div>
    <div class="form-group">
      <label>Objetivo (monto)</label>
      <input type="number" id="metaObjetivo" placeholder="0" min="0" />
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarMeta()">Guardar</button>`);
}

function guardarMeta() {
  const nombre   = document.getElementById('metaNombre').value.trim();
  const tipo     = document.getElementById('metaTipo').value;
  const objetivo = parseFloat(document.getElementById('metaObjetivo').value) || 0;
  if (!nombre || objetivo <= 0) { toast('Completa todos los campos', 'warning'); return; }
  const metas = DB.get('metas', []);
  metas.push({ id: Utils.uid(), nombre, tipo, objetivo, creada: Utils.today() });
  DB.set('metas', metas);
  Modal.hide();
  toast('Meta guardada ✅', 'success');
  initMetas();
}

function eliminarMeta(id) {
  Modal.confirm('¿Eliminar esta meta?', () => {
    DB.set('metas', DB.get('metas', []).filter(m => m.id !== id));
    toast('Meta eliminada', 'info');
    initMetas();
  });
}

window.abrirFormMeta  = abrirFormMeta;
window.guardarMeta    = guardarMeta;
window.eliminarMeta   = eliminarMeta;

// ─────────────────────────────────────────
// MÓDULO CAJA
// ─────────────────────────────────────────
function initCaja() {
  const caja  = DB.get('caja', []);
  const hoy   = Utils.today();
  const mes   = Utils.monthKey();

  const cajaMes = caja.filter(c => Utils.monthKey(c.fecha) === mes);
  const ingMes  = cajaMes.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.monto, 0);
  const egMes   = cajaMes.filter(c => c.tipo === 'egreso').reduce((s, c) => s + c.monto, 0);
  const balMes  = ingMes - egMes;

  const cajaHoy = caja.filter(c => c.fecha === hoy);
  const ingHoy  = cajaHoy.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.monto, 0);
  const egHoy   = cajaHoy.filter(c => c.tipo === 'egreso').reduce((s, c) => s + c.monto, 0);

  let html = `
    <div class="section-header">
      <h2 class="section-title">💵 Caja</h2>
      <div class="section-actions">
        <button class="btn btn-success" onclick="abrirFormCaja('ingreso')">+ Ingreso</button>
        <button class="btn btn-danger"  onclick="abrirFormCaja('egreso')">– Egreso</button>
      </div>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
      <div class="stat-card teal">
        <div class="stat-icon">💚</div>
        <div class="stat-value">${Utils.formatMoney(ingMes)}</div>
        <div class="stat-label">Ingresos del mes</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-icon">🔴</div>
        <div class="stat-value">${Utils.formatMoney(egMes)}</div>
        <div class="stat-label">Egresos del mes</div>
      </div>
      <div class="stat-card ${balMes >= 0 ? 'teal' : 'pink'}">
        <div class="stat-icon">${balMes >= 0 ? '✅' : '⚠️'}</div>
        <div class="stat-value">${Utils.formatMoney(balMes)}</div>
        <div class="stat-label">Balance mensual</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${Utils.formatMoney(ingHoy - egHoy)}</div>
        <div class="stat-label">Balance hoy</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="cajaTabs(this,'hoy')">Hoy</button>
      <button class="tab-btn" onclick="cajaTabs(this,'mes')">Este mes</button>
      <button class="tab-btn" onclick="cajaTabs(this,'todo')">Todo</button>
    </div>
  `;

  const renderItems = (list) => {
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">💰</div><p>Sin movimientos</p></div>`;
    return list.slice().reverse().map(c => `
      <div class="caja-item">
        <div>
          <div class="caja-concepto">${Utils.escHtml(c.concepto)}</div>
          <div class="caja-fecha">${Utils.formatDate(c.fecha)} · ${Utils.escHtml(c.metodo || '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="caja-monto ${c.tipo}">${c.tipo === 'ingreso' ? '+' : '-'}${Utils.formatMoney(c.monto)}</span>
          <button class="btn btn-sm btn-danger btn-icon" onclick="eliminarCaja('${c.id}')">🗑</button>
        </div>
      </div>`).join('');
  };

  html += `
    <div class="card">
      <div id="tab-hoy" class="tab-pane active">${renderItems(cajaHoy)}</div>
      <div id="tab-mes" class="tab-pane">${renderItems(cajaMes)}</div>
      <div id="tab-todo" class="tab-pane">${renderItems(caja)}</div>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function cajaTabs(btn, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+id)?.classList.add('active');
}
window.cajaTabs = cajaTabs;

function abrirFormCaja(tipo) {
  Modal.show(tipo === 'ingreso' ? '➕ Registrar Ingreso' : '➖ Registrar Gasto', `
    <div class="form-group">
      <label>Concepto</label>
      <input type="text" id="cajaCon" placeholder="Ej: Venta alfajores, Compra harina..." />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Monto</label>
        <input type="number" id="cajaMonto" placeholder="0" min="0" />
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="cajaFecha" value="${Utils.today()}" />
      </div>
    </div>
    <div class="form-group">
      <label>Método de pago</label>
      <select id="cajaMetodo">
        <option value="Efectivo">Efectivo</option>
        <option value="Transferencia">Transferencia</option>
        <option value="Débito">Débito</option>
        <option value="Otro">Otro</option>
      </select>
    </div>
  `, `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
      <button class="btn ${tipo === 'ingreso' ? 'btn-success' : 'btn-danger'}" onclick="guardarCaja('${tipo}')">Registrar</button>`);
}

function guardarCaja(tipo) {
  const concepto = document.getElementById('cajaCon').value.trim();
  const monto    = parseFloat(document.getElementById('cajaMonto').value) || 0;
  const fecha    = document.getElementById('cajaFecha').value;
  const metodo   = document.getElementById('cajaMetodo').value;
  if (!concepto || monto <= 0) { toast('Completa todos los campos', 'warning'); return; }
  const caja = DB.get('caja', []);
  caja.push({ id: Utils.uid(), tipo, concepto, monto, fecha, metodo });
  DB.set('caja', caja);
  Modal.hide();
  toast(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado ✅`, 'success');
  initCaja();
}

function eliminarCaja(id) {
  Modal.confirm('¿Eliminar este movimiento?', () => {
    DB.set('caja', DB.get('caja', []).filter(c => c.id !== id));
    toast('Movimiento eliminado', 'info');
    initCaja();
  });
}

window.abrirFormCaja  = abrirFormCaja;
window.guardarCaja    = guardarCaja;
window.eliminarCaja   = eliminarCaja;

// ─────────────────────────────────────────
// INIT APP
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  initTheme();

  // Fecha en topbar
  document.getElementById('dateBadge').textContent =
    new Date().toLocaleDateString('es-CL', { weekday:'short', day:'numeric', month:'short' });

  // Sidebar
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  const menuBtn  = document.getElementById('menuBtn');
  const sidebarClose = document.getElementById('sidebarClose');

  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });
  sidebarClose.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });

  // Navegación
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      Router.go(el.dataset.module);
    });
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', Modal.hide.bind(Modal));
  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modalBackdrop')) Modal.hide();
  });

  // Tema
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Registrar módulos
  Router.register('costos', initCostos);
  Router.register('metas', initMetas);
  Router.register('caja', initCaja);

  // Arrancar en dashboard
  Router.go('dashboard');

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('SW registrado'))
      .catch(err => console.warn('SW error:', err));
  }

  // PWA Install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn').style.display = 'inline-flex';
  });
  document.getElementById('installBtn').addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        document.getElementById('installBtn').style.display = 'none';
      });
    }
  });
});

// Exportar para otros módulos
window.DB     = DB;
window.Utils  = Utils;
window.toast  = toast;
window.Modal  = Modal;
window.Router = Router;
