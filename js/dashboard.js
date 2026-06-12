/**
 * dashboard.js — Dashboard principal con stats y gráficos
 */

function initDashboard() {
  const ventas      = DB.get('ventas', []);
  const ingredientes= DB.get('ingredientes', []);
  const metas       = DB.get('metas', []);
  const caja        = DB.get('caja', []);
  const hoy         = Utils.today();
  const mes         = Utils.monthKey();
  const cfg         = DB.get('config', DB.defaults.config);

  // Calcular métricas
  const ventasHoy   = ventas.filter(v => v.fecha === hoy);
  const ventasMes   = ventas.filter(v => Utils.monthKey(v.fecha) === mes);
  const totalHoy    = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const totalMes    = ventasMes.reduce((s, v) => s + (v.total || 0), 0);
  const unidadesHoy = ventasHoy.reduce((s, v) => s + (v.cantidad || 0), 0);

  const cajaMes   = caja.filter(c => Utils.monthKey(c.fecha) === mes);
  const ingMes    = cajaMes.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.monto, 0);
  const egMes     = cajaMes.filter(c => c.tipo === 'egreso').reduce((s, c) => s + c.monto, 0);
  const ganMes    = ingMes - egMes;

  const stockCrit  = ingredientes.filter(i => i.stock <= (i.stockMinimo || cfg.stockMinimo || 200));
  const negocio    = cfg.negocio || 'Maite';

  // Meta principal (primera meta de ventas del mes)
  const metaVentas  = metas.find(m => m.tipo === 'ventas');
  const metaPct     = metaVentas ? Math.min(100, Math.round(totalMes / metaVentas.objetivo * 100)) : null;

  let html = `
    <div class="fade-in">
      <div style="margin-bottom:1.4rem">
        <h2 style="font-family:var(--font-display);font-weight:900;font-size:1.4rem">
          ¡Hola! 👋 <span style="color:var(--pink)">${Utils.escHtml(negocio)}</span>
        </h2>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-top:4px">
          ${new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      <div class="stats-grid">
        <div class="stat-card pink">
          <div class="stat-icon">🛒</div>
          <div class="stat-value">${Utils.formatMoney(totalHoy)}</div>
          <div class="stat-label">Ventas hoy</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${unidadesHoy}</div>
          <div class="stat-label">Unidades hoy</div>
        </div>
        <div class="stat-card teal">
          <div class="stat-icon">💚</div>
          <div class="stat-value">${Utils.formatMoney(totalMes)}</div>
          <div class="stat-label">Ventas del mes</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">💰</div>
          <div class="stat-value">${Utils.formatMoney(ganMes)}</div>
          <div class="stat-label">Balance mensual</div>
        </div>
        ${stockCrit.length > 0 ? `
        <div class="stat-card yellow" style="cursor:pointer" onclick="Router.go('inventario')">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value">${stockCrit.length}</div>
          <div class="stat-label">Stock crítico</div>
        </div>` : ''}
      </div>
  `;

  // Meta progress
  if (metaVentas) {
    html += `
      <div class="card" style="margin-bottom:1.2rem">
        <div class="card-title">🎯 Meta del mes: ${Utils.escHtml(metaVentas.nombre)}</div>
        <div class="meta-header">
          <span>Progreso</span>
          <span class="meta-pct">${metaPct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${metaPct}%"></div></div>
        <div class="meta-detail">${Utils.formatMoney(totalMes)} de ${Utils.formatMoney(metaVentas.objetivo)}</div>
      </div>
    `;
  }

  // Gráfico de ventas últimos 7 días
  html += renderGrafico7Dias(ventas);

  // Alertas stock
  if (stockCrit.length > 0) {
    html += `
      <div class="alert alert-warning">
        ⚠️ <strong>${stockCrit.length} ingrediente(s) con stock bajo:</strong>
        ${stockCrit.map(i => Utils.escHtml(i.nombre)).join(', ')}
      </div>
    `;
  }

  // Últimas ventas
  const ultimas = ventas.slice(-5).reverse();
  if (ultimas.length > 0) {
    html += `
      <div class="card">
        <div class="card-title">🕐 Últimas ventas</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Receta</th><th>Cant.</th><th>Total</th></tr></thead>
            <tbody>
              ${ultimas.map(v => `<tr>
                <td>${Utils.formatDate(v.fecha)}</td>
                <td>${Utils.escHtml(v.receta || 'Alfajor')}</td>
                <td>${v.cantidad}</td>
                <td style="color:var(--teal);font-weight:700">${Utils.formatMoney(v.total)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="card">
        <div class="card-title">🛒 Empezá a registrar ventas</div>
        <div class="empty-state" style="padding:1.5rem">
          <div class="empty-icon">🍫</div>
          <p>Registrá tus primeras ventas en el módulo de Ventas.</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="Router.go('ventas')">Ir a Ventas</button>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  document.getElementById('moduleContainer').innerHTML = html;
}

function renderGrafico7Dias(ventas) {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d  = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const lbl = d.toLocaleDateString('es-CL', { weekday:'short' });
    const total = ventas.filter(v => v.fecha === key).reduce((s, v) => s + (v.total || 0), 0);
    dias.push({ key, lbl, total });
  }

  const maxVal = Math.max(...dias.map(d => d.total), 1);
  const colores = ['#e8427d','#ff8c42','#ffd166','#06d6a0','#9b5de5','#e8427d','#ff8c42'];

  const bars = dias.map((d, i) => {
    const h = Math.round((d.total / maxVal) * 100);
    return `
      <div class="bar-col">
        <span class="bar-val">${d.total > 0 ? Utils.formatMoney(d.total) : ''}</span>
        <div class="bar" style="height:${h}%;background:${colores[i]}" title="${d.lbl}: ${Utils.formatMoney(d.total)}"></div>
        <span class="bar-label">${d.lbl}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-container" style="margin-bottom:1.2rem">
      <div class="chart-title">📊 Ventas últimos 7 días</div>
      <div class="bar-chart">${bars}</div>
    </div>
  `;
}

Router.register('dashboard', initDashboard);
