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
    catch (e) {
      console.error('DB.set falló:', k, e);
      // Antes fallaba en silencio: el toast decía "guardado ✅" y el dato se perdía.
      if (typeof toast === 'function') {
        toast('No se pudo guardar: el almacenamiento está lleno. Exportá un respaldo desde Reportes.', 'error', 9000);
      }
      return false;
    }
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
    producciones: [],
    ajustesStock: [],
    clientes: [],
    pedidos: [],
    gastosFijos: [],
    config: {
      moneda: '$',
      negocio: 'Alfajores Maite ❤️',
      stockMinimo: 200
    }
  },

  // Colecciones que se respaldan / restauran / borran en bloque
  colecciones: ['ingredientes','compras','recetas','ventas','caja','metas','producciones','ajustesStock','clientes','pedidos','gastosFijos'],

  init() {
    Object.entries(this.defaults).forEach(([k, v]) => {
      if (this.get(k) === null) this.set(k, v);
    });
  }
};

// ─────────────────────────────────────────
// RESPALDO AUTOMÁTICO
// ─────────────────────────────────────────
/**
 * Todo vive en el navegador. Si se limpian los datos del sitio o el teléfono
 * se rompe, no hay de dónde recuperar. Esto guarda una copia interna cada
 * pocos días, aparte de los datos en uso, para poder volver atrás.
 *
 * No reemplaza al respaldo exportado (si se borra el sitio, se va también),
 * pero cubre el caso más común: haber borrado o pisado algo sin querer.
 */
const Respaldo = {
  DIAS_COPIA: 2,        // cada cuánto se guarda la copia interna
  DIAS_AVISO: 7,        // cada cuánto se recuerda exportar el archivo
  MAX_COPIAS: 2,

  snapshot() {
    const datos = { version: '2.0', fecha: new Date().toISOString(), auto: true };
    DB.colecciones.forEach(k => { datos[k] = DB.get(k, []); });
    datos.config = DB.get('config', DB.defaults.config);
    return datos;
  },

  registros() {
    return DB.get('copiasAuto', []) || [];
  },

  /** Cantidad total de registros, para no guardar copias de una app vacía. */
  _tamano(snap) {
    return DB.colecciones.reduce((s, k) => s + (snap[k]?.length || 0), 0);
  },

  crear(forzado = false) {
    const snap = this.snapshot();
    if (this._tamano(snap) === 0) return false;   // nada que respaldar

    const copias = this.registros();
    const ultima = copias[copias.length - 1];
    if (!forzado && ultima && Utils.diasEntre(ultima.dia, Utils.today()) < this.DIAS_COPIA) {
      return false;
    }

    copias.push({ id: Utils.uid(), dia: Utils.today(), ts: snap.fecha, registros: this._tamano(snap), datos: snap });
    // Solo las últimas: dos copias completas ya ocupan bastante espacio
    while (copias.length > this.MAX_COPIAS) copias.shift();

    if (!DB.set('copiasAuto', copias)) {
      // Si no entra, mejor quedarse con una sola que perder los datos vivos
      DB.set('copiasAuto', copias.slice(-1));
    }
    return true;
  },

  restaurar(id) {
    const copia = this.registros().find(c => c.id === id);
    if (!copia) return false;
    DB.colecciones.forEach(k => { if (Array.isArray(copia.datos[k])) DB.set(k, copia.datos[k]); });
    if (copia.datos.config) DB.set('config', copia.datos.config);
    DB.init();
    return true;
  },

  /** Días desde el último respaldo exportado a archivo. */
  diasSinExportar() {
    const ultimo = DB.get('ultimoRespaldo', null);
    if (!ultimo) return Infinity;
    return Utils.diasEntre(ultimo, Utils.today());
  },

  /** Corre al abrir la app: guarda copia y avisa si hace mucho no exporta. */
  alIniciar() {
    try { this.crear(); } catch (e) { console.warn('Respaldo automático:', e); }

    const dias = this.diasSinExportar();
    const totalRegistros = this._tamano(this.snapshot());
    if (totalRegistros > 0 && dias >= this.DIAS_AVISO) {
      setTimeout(() => {
        toast(
          dias === Infinity
            ? 'Nunca exportaste un respaldo. Andá a Reportes y descargá una copia.'
            : `Hace ${dias} días que no exportás un respaldo. Conviene bajar una copia.`,
          'warning', 9000
        );
      }, 2500);
    }
  }
};
window.Respaldo = Respaldo;

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────
const Utils = {
  formatMoney(n) {
    const cfg = DB.get('config', DB.defaults.config);
    return `${cfg.moneda}${(+n || 0).toLocaleString('es-CL')}`;
  },

  /**
   * Convierte una fecha a Date en horario LOCAL.
   * new Date('2026-08-10') se interpreta como medianoche UTC, y en Chile (UTC-4)
   * eso retrocede al día 9. Por eso las fechas 'YYYY-MM-DD' se parsean a mano.
   */
  parseDate(d) {
    if (d instanceof Date) return d;
    if (typeof d === 'string') {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    return new Date(d);
  },

  /** Fecha → 'YYYY-MM-DD' usando el día LOCAL, no el UTC. */
  toISODate(d) {
    const dt = d ? this.parseDate(d) : new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  },

  formatDate(d) {
    if (!d) return '—';
    const dt = this.parseDate(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  /**
   * Día de hoy en horario local. Antes usaba toISOString() (UTC), así que
   * después de las ~20:00 en Chile las ventas se guardaban con la fecha de mañana.
   */
  today() {
    return this.toISODate(new Date());
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  monthKey(d) {
    const dt = d ? this.parseDate(d) : new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  },

  /**
   * Devuelve los últimos n meses, del más viejo al más nuevo.
   * Se ancla al día 1 porque d.setMonth(d.getMonth()-i) sobre un día 29/30/31
   * desborda al mes siguiente y se saltea meses enteros.
   */
  ultimosMeses(n) {
    const hoy = new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      out.push(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1));
    }
    return out;
  },

  /** Días entre dos fechas (b - a), en días completos locales. */
  diasEntre(a, b) {
    const d1 = this.parseDate(a), d2 = this.parseDate(b);
    return Math.round((new Date(d2.getFullYear(), d2.getMonth(), d2.getDate())
                     - new Date(d1.getFullYear(), d1.getMonth(), d1.getDate())) / 86400000);
  },

  /**
   * Escapa para HTML y para atributos. Escapa también comillas: sin eso,
   * un nombre con " rompía los value="..." y truncaba el dato al editar.
   * Usa ?? para no convertir el 0 en cadena vacía.
   */
  escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  getMonthName(key) {
    const [y, m] = key.split('-');
    return new Date(+y, +m-1, 1).toLocaleDateString('es-CL', { month:'long', year:'numeric' });
  },

  /** Evita que Excel interprete como fórmula un texto que empieza con = + - @ */
  csvSafe(v) {
    const s = String(v ?? '');
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
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
    // Foco en el primer campo para poder escribir sin tocar la pantalla
    setTimeout(() => {
      const first = document.querySelector('#modalBody input:not([readonly]), #modalBody select, #modalBody textarea');
      if (first) first.focus();
    }, 60);
  },
  hide() {
    document.getElementById('modalBackdrop').classList.remove('show');
  },
  isOpen() {
    return document.getElementById('modalBackdrop').classList.contains('show');
  },
  confirm(msg, onConfirm, textoOk = 'Sí, confirmar') {
    this.show(
      '¿Confirmar acción?',
      `<p style="font-size:1rem;line-height:1.5">${Utils.escHtml(msg)}</p>`,
      `<button class="btn btn-secondary" onclick="Modal.hide()">Cancelar</button>
       <button class="btn btn-danger" id="confirmOk">${Utils.escHtml(textoOk)}</button>`
    );
    document.getElementById('confirmOk').onclick = () => { Modal.hide(); onConfirm(); };
  }
};

// ─────────────────────────────────────────
// CAJA — movimientos con trazabilidad
// ─────────────────────────────────────────
/**
 * Los movimientos que genera el sistema (una venta, una compra, un abono)
 * guardan origen + refId. Sin esa referencia, borrar una venta dejaba su
 * ingreso en la caja para siempre y el balance quedaba inflado.
 */
const CajaDB = {
  add({ tipo, concepto, monto, fecha, metodo = 'Efectivo', origen = 'manual', refId = null }) {
    const caja = DB.get('caja', []);
    const mov = { id: Utils.uid(), tipo, concepto, monto: +monto || 0, fecha, metodo, origen, refId };
    caja.push(mov);
    DB.set('caja', caja);
    return mov;
  },

  /** Borra todos los movimientos generados por un registro. Devuelve cuántos borró. */
  removeByRef(refId) {
    if (!refId) return 0;
    const caja = DB.get('caja', []);
    const quedan = caja.filter(c => c.refId !== refId);
    const borrados = caja.length - quedan.length;
    if (borrados) DB.set('caja', quedan);
    return borrados;
  },

  /** Movimientos de un registro concreto (para mostrar el detalle). */
  byRef(refId) {
    return DB.get('caja', []).filter(c => c.refId === refId);
  }
};

// ─────────────────────────────────────────
// STOCK DE PRODUCTO TERMINADO
// ─────────────────────────────────────────
/**
 * No se guarda un contador (se desincroniza). Se calcula:
 *   producido + ajustes manuales − vendido
 * Así siempre cuadra con el historial y es auditable.
 */
const Stock = {
  producido(recetaId) {
    return DB.get('producciones', [])
      .filter(p => p.recetaId === recetaId)
      .reduce((s, p) => s + (p.unidades || 0), 0);
  },

  ajustado(recetaId) {
    return DB.get('ajustesStock', [])
      .filter(a => a.recetaId === recetaId)
      .reduce((s, a) => s + (a.unidades || 0), 0);
  },

  vendido(recetaId) {
    return DB.get('ventas', [])
      .filter(v => v.recetaId === recetaId)
      .reduce((s, v) => s + (v.cantidad || 0), 0);
  },

  disponible(recetaId) {
    return this.producido(recetaId) + this.ajustado(recetaId) - this.vendido(recetaId);
  },

  /** Unidades ya comprometidas en pedidos que todavía no se entregaron. */
  comprometido(recetaId) {
    return DB.get('pedidos', [])
      .filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado')
      .reduce((s, p) => s + (p.items || [])
        .filter(it => it.recetaId === recetaId)
        .reduce((s2, it) => s2 + (it.cantidad || 0), 0), 0);
  },

  libre(recetaId) {
    return this.disponible(recetaId) - this.comprometido(recetaId);
  },

  resumen() {
    return DB.get('recetas', []).map(r => ({
      id: r.id,
      nombre: r.nombre,
      disponible: this.disponible(r.id),
      comprometido: this.comprometido(r.id),
      libre: this.libre(r.id)
    }));
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

  titles: {
    dashboard: '🏠 Inicio',
    inventario: '📦 Inventario',
    compras: '🛒 Qué comprar',
    recetas: '📋 Recetas',
    produccion: '👩‍🍳 Producción',
    costos: '💰 Costos',
    pedidos: '🎁 Pedidos',
    clientes: '👥 Clientes',
    ventas: '🛒 Ventas',
    caja: '💵 Caja',
    estadisticas: '📈 Estadísticas',
    metas: '🎯 Metas',
    reportes: '📄 Reportes'
  },

  go(name) {
    if (!this.titles[name]) name = 'dashboard';
    this.current = name;

    // La URL refleja el módulo: el botón "atrás" del celular vuelve a la
    // pantalla anterior en vez de cerrar la app.
    if (location.hash.slice(1) !== name) location.hash = name;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.module === name);
    });
    document.getElementById('pageTitle').textContent = this.titles[name] || name;

    const cont = document.getElementById('moduleContainer');
    const fn = this.modules[name];
    if (fn) {
      fn();
      // El módulo acaba de escribir su HTML: recién ahora se puede animar.
      // Antes se escribía '<div class="fade-in">' ANTES de llamar a fn(), que lo pisaba.
      cont.classList.remove('fade-in');
      void cont.offsetWidth;          // reinicia la animación
      cont.classList.add('fade-in');
    } else {
      cont.innerHTML =
        `<div class="empty-state"><div class="empty-icon">🚧</div><p>Módulo en construcción</p></div>`;
    }

    // Cerrar sidebar en mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'instant' });
    actualizarBadges();
  },

  /** Re-dibuja el módulo actual sin tocar la navegación. */
  refresh() {
    const fn = this.modules[this.current];
    if (fn) fn();
  }
};

/** Contadores del menú lateral: pedidos abiertos e ingredientes a comprar. */
function actualizarBadges() {
  const ped = document.getElementById('badgePedidos');
  if (ped) {
    const abiertos = DB.get('pedidos', [])
      .filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length;
    ped.textContent = abiertos;
    ped.hidden = abiertos === 0;
  }

  const com = document.getElementById('badgeCompras');
  if (com && typeof calcularListaCompras === 'function') {
    const n = calcularListaCompras(0).items.length;
    com.textContent = n;
    com.hidden = n === 0;
  }
}
window.actualizarBadges = actualizarBadges;

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
// COSTOS — base compartida por varios módulos
// ─────────────────────────────────────────
/** Costo de ingredientes de una tanda. Es el costo DIRECTO, sin gastos fijos. */
function calcularCostoReceta(receta, ingredientes) {
  let total = 0;
  (receta.ingredientes || []).forEach(ri => {
    const ing = ingredientes.find(i => i.id === ri.id);
    if (ing && ing.precioUnidad > 0) {
      total += (ri.cantidad / (ing.unidadBase || 1)) * ing.precioUnidad;
    }
  });
  return total;
}
window.calcularCostoReceta = calcularCostoReceta;

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

  const etiquetaOrigen = {
    venta:   '<span class="badge badge-teal" title="Generado por una venta">🛒 venta</span>',
    compra:  '<span class="badge badge-orange" title="Generado por una compra">🛍 compra</span>',
    pedido:  '<span class="badge badge-purple" title="Generado por un pedido">🎁 pedido</span>',
    abono:   '<span class="badge badge-purple" title="Seña o abono de un pedido">💳 abono</span>'
  };

  const renderItems = (list) => {
    if (!list.length) return `<div class="empty-state"><div class="empty-icon">💰</div><p>Sin movimientos</p></div>`;
    return list.slice().reverse().map(c => `
      <div class="caja-item">
        <div>
          <div class="caja-concepto">${Utils.escHtml(c.concepto)} ${etiquetaOrigen[c.origen] || ''}</div>
          <div class="caja-fecha">${Utils.formatDate(c.fecha)} · ${Utils.escHtml(c.metodo || '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="caja-monto ${c.tipo}">${c.tipo === 'ingreso' ? '+' : '-'}${Utils.formatMoney(c.monto)}</span>
          <button class="btn btn-sm btn-danger btn-icon" onclick="eliminarCaja('${c.id}')" title="Eliminar">🗑</button>
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
  if (!fecha) { toast('Elegí una fecha', 'warning'); return; }
  CajaDB.add({ tipo, concepto, monto, fecha, metodo, origen: 'manual' });
  Modal.hide();
  toast(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado ✅`, 'success');
  initCaja();
}

function eliminarCaja(id) {
  const mov = DB.get('caja', []).find(c => c.id === id);
  if (!mov) return;

  // Los movimientos automáticos se borran desde su origen, si no quedan descuadrados
  const origenes = {
    venta:  'Este ingreso lo generó una venta. Borralo desde Ventas para que se borren los dos juntos.',
    compra: 'Este egreso lo generó una compra. Borralo desde Inventario para que además se revierta el stock.',
    pedido: 'Este movimiento lo generó un pedido. Manejalo desde Pedidos.',
    abono:  'Este movimiento es el abono de un pedido. Manejalo desde Pedidos.'
  };
  if (origenes[mov.origen]) {
    toast(origenes[mov.origen], 'warning', 6000);
    return;
  }

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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (Modal.isOpen()) Modal.hide();
      else if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      }
    }
  });

  // Tema
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Registrar módulos
  Router.register('metas', initMetas);
  Router.register('caja', initCaja);

  // Volver / avanzar con el historial del navegador
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1) || 'dashboard';
    if (name !== Router.current) Router.go(name);
  });

  // Arrancar en el módulo de la URL (o en el dashboard)
  Router.go(location.hash.slice(1) || 'dashboard');

  // Copia interna automática + aviso si hace mucho no exporta
  Respaldo.alIniciar();

  // Service Worker — ruta relativa para que también funcione en subcarpetas
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js', { scope: './' })
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
window.DB      = DB;
window.Utils   = Utils;
window.toast   = toast;
window.Modal   = Modal;
window.Router  = Router;
window.CajaDB  = CajaDB;
window.Stock   = Stock;
