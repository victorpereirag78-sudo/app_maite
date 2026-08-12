/**
 * estadisticas.js — Gráficos y estadísticas de ventas
 */

function initEstadisticas() {
  const ventas = DB.get('ventas', []);
  const caja   = DB.get('caja', []);

  let html = `
    <div class="section-header">
      <h2 class="section-title">📈 Estadísticas</h2>
    </div>
  `;

  if (ventas.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">📈</div>
      <p>Sin datos aún. Registrá ventas para ver estadísticas.</p></div>`;
    document.getElementById('moduleContainer').innerHTML = html;
    return;
  }

  // ── Ventas por mes (últimos 6 meses)
  const meses = Utils.ultimosMeses(6).map(d => {
    const key = Utils.monthKey(d);
    const lbl = d.toLocaleDateString('es-CL', { month: 'short', year:'2-digit' });
    const total = ventas.filter(v => Utils.monthKey(v.fecha) === key)
                        .reduce((s, v) => s + (v.total || 0), 0);
    return { key, lbl, total };
  });
  html += renderBarras('Ventas por mes (últimos 6)', meses, 'total', 'lbl', ['#e8427d','#ff8c42','#ffd166','#06d6a0','#9b5de5','#4fc3f7']);

  // ── Productos más vendidos
  const byReceta = {};
  ventas.forEach(v => {
    const k = v.receta || 'Sin receta';
    byReceta[k] = (byReceta[k] || 0) + (v.cantidad || 0);
  });
  const topProductos = Object.entries(byReceta)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, cantidad]) => ({ lbl: nombre, total: cantidad }));

  html += renderBarras('Productos más vendidos (unidades)', topProductos, 'total', 'lbl',
    ['#9b5de5','#e8427d','#ff8c42','#ffd166','#06d6a0']);

  // ── Balance mensual (ingresos vs egresos)
  html += renderBalanceMensual(ventas, caja);

  // ── Tabla resumen mensual
  html += `
    <div class="card" style="margin-top:1.2rem">
      <div class="card-title">📊 Resumen mensual</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ventas</th><th>Unidades</th><th>Promedio/venta</th></tr></thead>
        <tbody>
          ${meses.map(m => {
            const vMes = ventas.filter(v => Utils.monthKey(v.fecha) === m.key);
            const unid = vMes.reduce((s, v) => s + (v.cantidad || 0), 0);
            const prom = vMes.length > 0 ? m.total / vMes.length : 0;
            return `<tr>
              <td>${Utils.escHtml(Utils.getMonthName(m.key))}</td>
              <td style="color:var(--teal);font-weight:700">${Utils.formatMoney(m.total)}</td>
              <td>${unid}</td>
              <td>${Utils.formatMoney(prom)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  `;

  document.getElementById('moduleContainer').innerHTML = html;
}

function renderBarras(titulo, data, valKey, lblKey, colores) {
  const maxVal = Math.max(...data.map(d => d[valKey]), 1);
  const bars = data.map((d, i) => {
    const h   = Math.max(4, Math.round((d[valKey] / maxVal) * 100));
    const col = colores[i % colores.length];
    return `
      <div class="bar-col">
        <span class="bar-val">${d[valKey] > 0 ? (d[valKey] > 9999 ? Utils.formatMoney(d[valKey]) : d[valKey]) : ''}</span>
        <div class="bar" style="height:${h}%;background:${col}" title="${Utils.escHtml(d[lblKey])}: ${d[valKey]}"></div>
        <span class="bar-label" style="font-size:0.65rem;text-align:center;max-width:42px;word-break:break-word">${Utils.escHtml(d[lblKey])}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-container">
      <div class="chart-title">${titulo}</div>
      <div class="bar-chart" style="height:160px">${bars}</div>
    </div>
  `;
}

function renderBalanceMensual(ventas, caja) {
  const meses = Utils.ultimosMeses(6).map(d => {
    const key = Utils.monthKey(d);
    const lbl = d.toLocaleDateString('es-CL', { month: 'short' });
    const ing  = caja.filter(c => c.tipo === 'ingreso' && Utils.monthKey(c.fecha) === key)
                     .reduce((s, c) => s + c.monto, 0);
    const eg   = caja.filter(c => c.tipo === 'egreso' && Utils.monthKey(c.fecha) === key)
                     .reduce((s, c) => s + c.monto, 0);
    return { lbl, ing, eg, bal: ing - eg };
  });

  const maxVal = Math.max(...meses.map(m => Math.max(m.ing, m.eg)), 1);
  const bars = meses.map(m => {
    const hIng = Math.max(4, Math.round((m.ing / maxVal) * 100));
    const hEg  = Math.max(4, Math.round((m.eg  / maxVal) * 100));
    return `
      <div class="bar-col" style="gap:2px">
        <div style="display:flex;align-items:flex-end;gap:2px;height:140px">
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div class="bar" style="height:${hIng}%;background:var(--teal);width:100%" title="Ingresos: ${Utils.formatMoney(m.ing)}"></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div class="bar" style="height:${hEg}%;background:#ff4466;width:100%" title="Egresos: ${Utils.formatMoney(m.eg)}"></div>
          </div>
        </div>
        <span class="bar-label">${m.lbl}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-container">
      <div class="chart-title">💚 Ingresos vs ❤️ Egresos (últimos 6 meses)</div>
      <div style="display:flex;gap:1rem;margin-bottom:0.6rem">
        <span style="display:flex;align-items:center;gap:5px;font-size:0.8rem">
          <span style="width:12px;height:12px;background:var(--teal);border-radius:3px;display:inline-block"></span> Ingresos
        </span>
        <span style="display:flex;align-items:center;gap:5px;font-size:0.8rem">
          <span style="width:12px;height:12px;background:#ff4466;border-radius:3px;display:inline-block"></span> Egresos
        </span>
      </div>
      <div class="bar-chart" style="height:180px;align-items:flex-end">${bars}</div>
    </div>
  `;
}

Router.register('estadisticas', initEstadisticas);
