// ═══════════════════════════════════════════════════
// mapa.js — Horus HN
// ═══════════════════════════════════════════════════

const COLORES = {
  ms13:      '#ef4444',
  b18:       '#3b82f6',
  mixta:     '#f59e0b',
  narco:     '#22c55e',
  homicidio: '#dc2626',
  robo:      '#a855f7'
};

const ETIQUETAS = {
  ms13:      'MS-13',
  b18:       'Barrio 18',
  mixta:     'Zona mixta',
  narco:     'Narco / CO',
  homicidio: 'Homicidio',
  robo:      'Robo / Asalto'
};

// ── MAPA ─────────────────────────────────────────
const mapa = L.map('mapa', { zoomControl: false }).setView([14.0818, -87.2068], 13);

L.control.zoom({ position: 'bottomright' }).addTo(mapa);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  { attribution: '© CartoDB', maxZoom: 19, crossOrigin: true }
).addTo(mapa);

// Referencia global a la capa GeoJSON para toggle
let geojsonLayer = null;
let todasLasCapas = {};   // tipo -> array de layers

// ── TOGGLE DE CAPAS ──────────────────────────────
function toggleCapaPoligonos(tipo) {
  if (!todasLasCapas[tipo]) return;
  todasLasCapas[tipo].forEach(function(layer) {
    if (mapa.hasLayer(layer)) {
      mapa.removeLayer(layer);
    } else {
      mapa.addLayer(layer);
    }
  });
}

// ── ICONO PIN ────────────────────────────────────
function crearIcono(tipo) {
  const color = COLORES[tipo];
  const html =
    '<div style="' +
      'width:12px;height:12px;border-radius:50%;' +
      'background:' + color + ';' +
      'border:2px solid rgba(255,255,255,0.9);' +
      'box-shadow:0 0 10px ' + color + ',0 0 20px ' + color + '55;' +
    '"></div>';
  return L.divIcon({
    html: html, className: '',
    iconSize: [12,12], iconAnchor: [6,6], popupAnchor: [0,-8]
  });
}

// ── POPUP ────────────────────────────────────────
function crearPopup(c, esLocal) {
  const color    = COLORES[c.tipo];
  const etiqueta = ETIQUETAS[c.tipo];
  return '<div style="font-size:12px;min-width:200px;font-family:sans-serif;color:#e2e8f0">' +
    '<div style="font-weight:700;font-size:14px;color:' + color + ';margin-bottom:4px">' + c.nombre + '</div>' +
    '<div style="display:inline-block;background:' + color + '33;color:' + color + ';' +
      'padding:2px 9px;border-radius:4px;font-size:10px;margin-bottom:7px;font-family:monospace">' +
      etiqueta + ' &middot; Severidad ' + c.severidad + '/3' +
    '</div>' +
    '<div style="font-size:11px;color:#94a3b8;margin-bottom:5px">' + (c.descripcion || '') + '</div>' +
    '<div style="font-size:10px;color:#64748b;border-top:1px solid rgba(255,255,255,0.08);padding-top:5px">' +
      '📅 ' + (c.fecha || '') + '<br>' +
      '📰 ' + (c.medio || '') + '<br>' +
      '🔖 ' + (c.fuente || '') +
      (esLocal ? '<br><span style="color:#f59e0b">★ Ingresado manualmente</span>' : '') +
    '</div>' +
    '</div>';
}

// ── SIDEBAR ──────────────────────────────────────
function renderSidebar(colonias) {
  const lista = document.getElementById('sidebar-list');
  const bars  = document.getElementById('type-bars');

  if (!lista || !bars) return;

  if (!colonias.length) {
    lista.innerHTML = '<div style="padding:16px;text-align:center;color:#4a5568;font-size:11px">' +
      'Agregá colonias desde "+ Zona"</div>';
    return;
  }

  // Ordenar por severidad desc
  const sorted = colonias.slice().sort(function(a,b){ return b.severidad - a.severidad; });

  lista.innerHTML = sorted.map(function(c) {
    const color = COLORES[c.tipo];
    const sevColor = c.severidad === 3 ? '#ef4444' : c.severidad === 2 ? '#f59e0b' : '#22c55e';
    return '<div class="col-card" style="border-left-color:' + color + '" ' +
      'onclick="flyTo(' + c.lat + ',' + c.lng + ')">' +
      '<div class="cc-dot" style="background:' + color + '"></div>' +
      '<div class="cc-info">' +
        '<div class="cc-name">' + c.nombre + '</div>' +
        '<div class="cc-meta">' + ETIQUETAS[c.tipo] + ' · ' + (c.fecha || '') + '</div>' +
      '</div>' +
      '<div class="cc-sev" style="color:' + sevColor + '">' + c.severidad + '/3</div>' +
      '</div>';
  }).join('');

  // Barras por tipo
  const total = colonias.length;
  const tipos = ['ms13','b18','mixta','narco','homicidio','robo'];
  bars.innerHTML = tipos.map(function(t) {
    const count = colonias.filter(function(c){ return c.tipo === t; }).length;
    const pct   = total ? Math.round(count / total * 100) : 0;
    return '<div class="type-row">' +
      '<div class="type-label">' + ETIQUETAS[t] + '</div>' +
      '<div class="type-bar"><div class="type-fill" style="width:' + pct + '%;background:' + COLORES[t] + '"></div></div>' +
      '<div class="type-count">' + count + '</div>' +
    '</div>';
  }).join('');

  // Stats
  const criticas = colonias.filter(function(c){ return c.severidad === 3; }).length;
  const elTotal = document.getElementById('stat-total');
  const elCrit  = document.getElementById('stat-criticas');
  if (elTotal) elTotal.textContent = total;
  if (elCrit)  elCrit.textContent  = criticas;
}

function flyTo(lat, lng) {
  mapa.flyTo([lat, lng], 16, { duration: 1.2 });
}

// ── FUNCIÓN PRINCIPAL ────────────────────────────
async function iniciar() {

  // 1. Cargar colonias del JSON base
  const colonias = await cargarColonias();
  window._coloniasBase = colonias;

  // 2. Cargar zonas locales
  const locales = cargarZonasLocales();

  // 3. Todas juntas para el sidebar y stats
  const todas = colonias.concat(locales);
  renderSidebar(todas);

  // 4. Mapa de calor
  const puntos = todas.map(function(c) {
    return [c.lat, c.lng, c.severidad / 3];
  });
  L.heatLayer(puntos, {
    radius: 35, blur: 22, max: 1.0,
    gradient: { 0.2:'#1e40af', 0.5:'#ca8a04', 0.8:'#ea580c', 1.0:'#dc2626' }
  }).addTo(mapa);

  // 5. Polígonos GeoJSON con colonias coloreadas
  await cargarPoligonos(todas);

  // 6. Pins encima de los polígonos clasificados
  todas.forEach(function(c) {
    const esLocal = locales.some(function(l){ return l.id === c.id; });
    L.marker([c.lat, c.lng], { icon: crearIcono(c.tipo) })
      .addTo(mapa)
      .bindPopup(crearPopup(c, esLocal), { maxWidth: 240 });
  });
}

// ── POLÍGONOS GEOJSON ────────────────────────────
async function cargarPoligonos(colonias) {
  try {
    const res = await fetch('data/colonias_dc.geojson');
    if (!res.ok) { console.log('colonias_dc.geojson no encontrado'); return; }
    const geojson = await res.json();

    // Índice por nombre para colorear
    const porNombre = {};
    colonias.forEach(function(c) {
      porNombre[c.nombre.trim().toUpperCase()] = c;
    });

    L.geoJSON(geojson, {

      style: function(feature) {
        const nombre = (feature.properties.nombre || '').trim().toUpperCase();
        const datos  = porNombre[nombre];

        if (datos) {
          const color = COLORES[datos.tipo];
          return {
            color:       color,
            fillColor:   color,
            fillOpacity: 0.40,
            weight:      2,
            opacity:     0.9
          };
        }
        // Sin clasificar
        return {
          color:       '#94a3b8',
          fillColor:   '#94a3b8',
          fillOpacity: 0.04,
          weight:      0.8
        };
      },

      onEachFeature: function(feature, capa) {
        const nombre = (feature.properties.nombre || 'Sin nombre').trim();
        const datos  = porNombre[nombre.toUpperCase()];
        const color  = datos ? COLORES[datos.tipo] : '#94a3b8';

        // Guardar referencia por tipo para toggle
        if (datos) {
          if (!todasLasCapas[datos.tipo]) todasLasCapas[datos.tipo] = [];
          todasLasCapas[datos.tipo].push(capa);
        }

        let html =
          '<div style="font-size:12px;min-width:200px;font-family:sans-serif;color:#e2e8f0">' +
          '<div style="font-weight:700;font-size:14px;color:' + color + ';margin-bottom:4px">' + nombre + '</div>';

        if (datos) {
          html +=
            '<div style="display:inline-block;background:' + color + '33;color:' + color + ';' +
            'padding:2px 9px;border-radius:4px;font-size:10px;margin-bottom:6px;font-family:monospace">' +
            ETIQUETAS[datos.tipo] + ' · Severidad ' + datos.severidad + '/3</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">' + (datos.descripcion || '') + '</div>' +
            '<div style="font-size:10px;color:#64748b">📰 ' + (datos.medio || '') + ' · ' + (datos.fecha || '') + '</div>';
        } else {
          html += '<div style="font-size:10px;color:#4a5568;margin-top:4px">Sin clasificar — agregala desde "+ Zona"</div>';
        }

        html += '</div>';
        capa.bindPopup(html, { maxWidth: 230 });

        // Hover
        capa.on('mouseover', function() {
          capa.setStyle({
            fillOpacity: datos ? 0.65 : 0.18,
            weight: datos ? 3 : 1.5
          });
        });
        capa.on('mouseout', function() {
          capa.setStyle({
            fillOpacity: datos ? 0.40 : 0.04,
            fillColor: datos ? COLORES[datos.tipo] : '#94a3b8',
            weight: datos ? 2 : 0.8
          });
        });
      }

    }).addTo(mapa);

    console.log('Polígonos: ' + geojson.features.length + ' colonias cargadas');

  } catch(e) {
    console.log('Error GeoJSON:', e.message);
  }
}

// ── localStorage ─────────────────────────────────
function cargarZonasLocales() {
  return JSON.parse(localStorage.getItem('zonas') || '[]');
}

// ── ARRANCAR ─────────────────────────────────────
// Compatibilidad con todos los navegadores
if (typeof Promise !== 'undefined') {
  iniciar().then(function() {
  var loader = document.getElementById('loader');
  if (loader) {
    // Espera mínimo 3.5s para que se vea la animación completa
    var ya = Date.now();
    var espera = Math.max(0, 6500 - (Date.now() - ya));
    setTimeout(function() {
      loader.classList.add('hide');
    }, 6500);
  }
  }).catch(function(e) {
    console.error('Error al iniciar:', e);
    var loader = document.getElementById('loader');
    if (loader) loader.classList.add('hide');
  });
} else {
  console.error('Tu navegador no soporta Promesas');
}
