// script.js v4 - Con Routing OSRM Real
const API_URL = "http://localhost:8000/api/zonas/";

let userLocation = null;
let userMarker = null;
let routeLines = [];
let routeLayer = null; // Para rutas GeoJSON

// Elementos DOM
const cardsEl = document.getElementById('cards');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');
const btnFloatAgregar = document.getElementById('btnFloatAgregar');
const modalAgregar = document.getElementById('modalAgregar');
const closeModalAgregar = document.getElementById('closeModalAgregar');
const btnGuardarZona = document.getElementById('btnGuardarZona');

// Inputs del formulario
const inNombre = document.getElementById('inNombre');
const inDescripcion = document.getElementById('inDescripcion');
const inDireccion = document.getElementById('inDireccion');
const inLat = document.getElementById('inLat');
const inLon = document.getElementById('inLon');
const inCapacidad = document.getElementById('inCapacidad');
const inHorarioApertura = document.getElementById('inHorarioApertura');
const inHorarioCierre = document.getElementById('inHorarioCierre');

// Inicializar mapa
const map = L.map('map').setView([4.60971, -74.08175], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markersGroup = L.featureGroup();
markersGroup.addTo(map);

// ============ FUNCIONES DE API ============

async function fetchZonas() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Error al obtener zonas de la API');
    const zonas = await res.json();
    if (!Array.isArray(zonas)) throw new Error('Formato de respuesta inválido');
    console.log('Zonas obtenidas de la BD:', zonas);
    return zonas;
  } catch (err) {
    console.error('Error al conectar con la API:', err.message);
    return [];
  }
}

// ============ NUEVA FUNCIÓN: Obtener ruta real desde OSRM ============
async function obtenerRutaReal(origenLat, origenLon, destinoLat, destinoLon) {
  try {
    const response = await fetch(`${API_URL}ruta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origen_lat: origenLat,
        origen_lon: origenLon,
        destino_lat: destinoLat,
        destino_lon: destinoLon
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al obtener ruta');
    }

    return await response.json();
  } catch (error) {
    console.error('Error obteniendo ruta:', error);
    return null;
  }
}

// ============ RENDERIZADO ============

function renderCards(zonas) {
  cardsEl.innerHTML = '';
  if (zonas.length === 0) {
    cardsEl.innerHTML = '<p style="padding:20px;text-align:center;color:#666;">No hay zonas registradas</p>';
    return;
  }
  zonas.forEach(z => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${z.nombre_zona}</h3>
      <p>${z.direccion}</p>
      <div class="meta">
        <span>Capacidad: ${z.capacidad}</span>
        <span>${z.horario_apertura} - ${z.horario_cierre}</span>
      </div>
    `;
    card.addEventListener('click', () => openModal(z));
    cardsEl.appendChild(card);
  });
}

function openModal(z) {
  const descripcionHTML = z.descripcion ? `<p>${z.descripcion}</p>` : '';
  modalBody.innerHTML = `
    <h2>${z.nombre_zona}</h2>
    ${descripcionHTML}
    <div class="modal-details">
      <div class="detail-row"><strong>Dirección</strong><span>${z.direccion || '-'}</span></div>
      <div class="detail-row"><strong>Capacidad</strong><span>${z.capacidad}</span></div>
      <div class="detail-row"><strong>Horario</strong><span>${z.horario_apertura} - ${z.horario_cierre}</span></div>
      <div class="detail-row"><strong>Coordenadas</strong><span>${z.lat}, ${z.lon}</span></div>
    </div>
    <button class="btn-como-llegar" onclick="mostrarRutaReal(${z.lat}, ${z.lon}, '${z.nombre_zona.replace(/'/g, "\\'")}')">
       Cómo llegar
    </button>
  `;
  modal.classList.remove('hidden');
}

closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden') });

function renderMapMarkers(zonas) {
  markersGroup.clearLayers();
  zonas.forEach(z => {
    if (typeof z.lat !== 'number' || typeof z.lon !== 'number') return;
    
    const marker = L.marker([z.lat, z.lon]);
    const popupContent = `
      <div class="popup-zona">
        <strong class="popup-titulo">${z.nombre_zona}</strong>
        <p class="popup-direccion">${z.direccion || ''}</p>
        <p class="popup-capacidad">Capacidad: ${z.capacidad}</p>
        <button class="btn-ver-info" data-zona-id="${z.id_zona}">Ver Información</button>
      </div>
    `;
    marker.bindPopup(popupContent);
    marker.on('popupopen', () => {
      const btnVerInfo = document.querySelector('.btn-ver-info');
      if (btnVerInfo) {
        btnVerInfo.addEventListener('click', () => {
          openModal(z);
          map.closePopup();
        });
      }
    });
    markersGroup.addLayer(marker);
  });
  if (markersGroup.getLayers().length > 0) {
    map.fitBounds(markersGroup.getBounds().pad(0.2));
  }
}


async function obtenerRecomendaciones() {
  if (!userLocation) {
    alert('Primero necesitamos tu ubicación');
    getUserLocation();
    return;
  }

  // Mostrar loading
  modalBody.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Buscando mejores zonas y calculando rutas...</p>
    </div>
  `;
  modal.classList.remove('hidden');

  try {
    // Usar el nuevo endpoint que incluye rutas
    const response = await fetch(`${API_URL}recomendar-con-ruta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: userLocation.lat,
        lon: userLocation.lon,
        top_n: 3
      })
    });

    if (response.ok) {
      const data = await response.json();
      mostrarRecomendacionesConRutas(data);
    } else {
      // Fallback al endpoint sin rutas
      const fallbackResponse = await fetch(`${API_URL}recomendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: userLocation.lat,
          lon: userLocation.lon,
          top_n: 3
        })
      });
      
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        mostrarRecomendacionesSinRutas(data.recomendaciones);
      } else {
        throw new Error('Error en ambos endpoints');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    modalBody.innerHTML = `
      <div class="error-container">
        <p> Error al obtener recomendaciones</p>
        <button onclick="modal.classList.add('hidden')">Cerrar</button>
      </div>
    `;
  }
}

function mostrarRecomendacionesConRutas(data) {
  limpiarRutas();

  const { recomendaciones, modelo_usado } = data;
  
  let html = `
    <h2> Mejores Zonas Recomendadas</h2>
    <p class="modelo-info">Modelo: ${modelo_usado}</p>
    <div class="recomendaciones-list">
  `;

  recomendaciones.forEach((rec, index) => {
    const medal = index === 0 ? '' : index === 1 ? '' : '';
    const tieneRuta = rec.ruta && rec.ruta.geometry;
    const colorRuta = ['#4285F4', '#34A853', '#FBBC05'][index];

    html += `
      <div class="recomendacion-item" data-index="${index}">
        <div class="rec-header">
          <span class="rec-medal">${medal}</span>
          <strong>${rec.nombre_zona}</strong>
        </div>
        <div class="rec-stats">
          <div class="stat">
            <span class="stat-label">Disponibles</span>
            <span class="stat-value">${rec.disponible}/${rec.capacidad}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Distancia</span>
            <span class="stat-value">${rec.distancia_km} km</span>
          </div>
          <div class="stat">
            <span class="stat-label">Tiempo</span>
            <span class="stat-value">~${rec.tiempo_estimado_min} min</span>
          </div>
          <div class="stat">
            <span class="stat-label">Score</span>
            <span class="stat-value score-badge">${rec.score}</span>
          </div>
        </div>
        <div class="rec-actions">
          ${tieneRuta ? `
            <button class="btn-ver-ruta" onclick="dibujarRutaGeoJSON(${index}, '${colorRuta}')" style="border-color: ${colorRuta}; color: ${colorRuta}">
               Ver Ruta
            </button>
          ` : `
            <button class="btn-ver-ruta disabled" disabled>
               Ruta no disponible
            </button>
          `}
          <button class="btn-ir" onclick="centrarEnZona(${rec.lat}, ${rec.lon})">
             Ver en mapa
          </button>
        </div>
      </div>
    `;

    // Guardar la geometría de la ruta en window para acceso global
    if (tieneRuta) {
      window[`ruta_${index}`] = rec.ruta.geometry;
    }
  });

  html += `
    </div>
    <div class="rec-footer">
      <button class="btn-mostrar-todas" onclick="mostrarTodasLasRutas()">
        Mostrar todas las rutas
      </button>
      <button class="btn-limpiar" onclick="limpiarRutas()">
         Limpiar rutas
      </button>
    </div>
  `;

  modalBody.innerHTML = html;
  
  // Guardar recomendaciones globalmente
  window.recomendacionesActuales = recomendaciones;
}

function mostrarRecomendacionesSinRutas(recomendaciones) {
  limpiarRutas();

  let html = '<h2> Mejores Zonas Recomendadas</h2><div class="recomendaciones-list">';

  recomendaciones.forEach((rec, index) => {
    const medal = index === 0 ? '' : index === 1 ? '' : '';
    html += `
      <div class="recomendacion-item">
        <div class="rec-header">
          <span class="rec-medal">${medal}</span>
          <strong>${rec.nombre_zona}</strong>
        </div>
        <div class="rec-details">
          <span> ${rec.distancia_km} km</span>
          <span> ~${rec.tiempo_estimado_min} min</span>
          <span> Score: ${rec.score}</span>
        </div>
        <button class="btn-ruta-rec" onclick="mostrarRutaReal(${rec.lat}, ${rec.lon}, '${rec.nombre_zona.replace(/'/g, "\\'")}')">
           Ver Ruta
        </button>
      </div>
    `;
  });

  html += '</div>';
  modalBody.innerHTML = html;
}

// ============ FUNCIONES DE RUTAS ============

function dibujarRutaGeoJSON(index, color) {
  const geometry = window[`ruta_${index}`];
  if (!geometry) {
    alert('No hay datos de ruta disponibles');
    return;
  }

  limpiarRutas();

  // Crear capa GeoJSON con la ruta
  routeLayer = L.geoJSON(geometry, {
    style: {
      color: color,
      weight: 5,
      opacity: 0.8
    }
  }).addTo(map);

  // Agregar marcador de destino
  const rec = window.recomendacionesActuales[index];
  const destMarker = L.marker([rec.lat, rec.lon], {
    icon: L.divIcon({
      className: 'destination-marker',
      html: `<div class="dest-icon" style="background: ${color}">P</div>`,
      iconSize: [30, 30]
    })
  }).addTo(map);
  routeLines.push(destMarker);

  // Ajustar vista al bounds de la ruta
  map.fitBounds(routeLayer.getBounds().pad(0.1));

  modal.classList.add('hidden');
}

function mostrarTodasLasRutas() {
  limpiarRutas();
  
  const colores = ['#4285F4', '#34A853', '#FBBC05'];
  const recomendaciones = window.recomendacionesActuales;
  
  if (!recomendaciones) return;

  recomendaciones.forEach((rec, index) => {
    const geometry = window[`ruta_${index}`];
    if (geometry) {
      const layer = L.geoJSON(geometry, {
        style: {
          color: colores[index],
          weight: 4,
          opacity: 0.7
        }
      }).addTo(map);
      routeLines.push(layer);

      // Marcador de destino
      const destMarker = L.marker([rec.lat, rec.lon], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: `<div class="dest-icon" style="background: ${colores[index]}">${index + 1}</div>`,
          iconSize: [25, 25]
        })
      }).addTo(map);
      routeLines.push(destMarker);
    }
  });

  // Ajustar vista
  if (routeLines.length > 0) {
    const group = L.featureGroup(routeLines);
    map.fitBounds(group.getBounds().pad(0.1));
  }

  modal.classList.add('hidden');
}

async function mostrarRutaReal(destLat, destLon, nombre) {
  if (!userLocation) {
    alert('No se pudo obtener tu ubicación');
    return;
  }

  // Mostrar loading en el botón o modal
  const btnComoLlegar = document.querySelector('.btn-como-llegar');
  if (btnComoLlegar) {
    btnComoLlegar.textContent = ' Calculando ruta...';
    btnComoLlegar.disabled = true;
  }

  try {
    const rutaData = await obtenerRutaReal(
      userLocation.lat, userLocation.lon,
      destLat, destLon
    );

    if (rutaData && rutaData.success) {
      limpiarRutas();
      
      // Dibujar ruta GeoJSON real
      routeLayer = L.geoJSON(rutaData.ruta.geometry, {
        style: {
          color: '#4285F4',
          weight: 5,
          opacity: 0.8
        }
      }).addTo(map);

      // Marcador de destino
      const destMarker = L.marker([destLat, destLon], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: '<div class="dest-icon">P</div>',
          iconSize: [30, 30]
        })
      }).addTo(map);
      routeLines.push(destMarker);

      // Ajustar vista
      map.fitBounds(routeLayer.getBounds().pad(0.1));
      
      modal.classList.add('hidden');
      
      // Mostrar info de la ruta
      mostrarInfoRuta(nombre, rutaData.ruta);
    } else {
      // Fallback: línea recta
      dibujarLineaRecta(destLat, destLon, nombre);
    }
  } catch (error) {
    console.error('Error:', error);
    dibujarLineaRecta(destLat, destLon, nombre);
  }
}

function dibujarLineaRecta(destLat, destLon, nombre) {
  limpiarRutas();
  
  const line = L.polyline([
    [userLocation.lat, userLocation.lon],
    [destLat, destLon]
  ], {
    color: '#4285F4',
    weight: 4,
    opacity: 0.7,
    dashArray: '10, 10' // Línea punteada para indicar que es aproximada
  }).addTo(map);

  routeLines.push(line);
  map.fitBounds(line.getBounds().pad(0.1));
  modal.classList.add('hidden');
  
  alert(`Ruta aproximada a ${nombre} (línea recta)`);
}

function mostrarInfoRuta(nombre, ruta) {
  // Crear un popup con info de la ruta
  const infoDiv = document.createElement('div');
  infoDiv.className = 'ruta-info-popup';
  infoDiv.innerHTML = `
    <div class="ruta-info-content">
      <h4> Ruta a ${nombre}</h4>
      <p> Distancia: ${ruta.distancia_km} km</p>
      <p> Tiempo estimado: ${ruta.duracion_min} min</p>
      <button onclick="this.parentElement.parentElement.remove()">✕</button>
    </div>
  `;
  document.body.appendChild(infoDiv);
  
  // Auto-remover después de 5 segundos
  setTimeout(() => {
    if (infoDiv.parentElement) infoDiv.remove();
  }, 5000);
}

function limpiarRutas() {
  routeLines.forEach(line => map.removeLayer(line));
  routeLines = [];
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

function centrarEnZona(lat, lon) {
  map.setView([lat, lon], 16);
  modal.classList.add('hidden');
}

// Exponer funciones globalmente
window.mostrarRutaReal = mostrarRutaReal;
window.dibujarRutaGeoJSON = dibujarRutaGeoJSON;
window.mostrarTodasLasRutas = mostrarTodasLasRutas;
window.limpiarRutas = limpiarRutas;
window.centrarEnZona = centrarEnZona;

// ============ AGREGAR ZONA ============

btnFloatAgregar.addEventListener('click', () => {
  modalAgregar.classList.remove('hidden');
});

closeModalAgregar.addEventListener('click', () => {
  modalAgregar.classList.add('hidden');
  limpiarFormulario();
});

modalAgregar.addEventListener('click', (e) => {
  if (e.target === modalAgregar) {
    modalAgregar.classList.add('hidden');
    limpiarFormulario();
  }
});

btnGuardarZona.addEventListener('click', async () => {
  const nombre = inNombre.value.trim();
  const descripcion = inDescripcion.value.trim();
  const direccion = inDireccion.value.trim();
  const lat = parseFloat(inLat.value);
  const lon = parseFloat(inLon.value);
  const capacidad = parseInt(inCapacidad.value);
  const horarioApertura = inHorarioApertura.value;
  const horarioCierre = inHorarioCierre.value;

  if (!nombre || !direccion || isNaN(lat) || isNaN(lon) || isNaN(capacidad) || !horarioApertura || !horarioCierre) {
    return alert('Por favor completa todos los campos');
  }

  const nuevaZona = {
    nombre_zona: nombre,
    descripcion: descripcion,
    direccion: direccion,
    lat: lat,
    lon: lon,
    capacidad: capacidad,
    horario_apertura: horarioApertura,
    horario_cierre: horarioCierre
  };

  btnGuardarZona.disabled = true;
  btnGuardarZona.textContent = 'Guardando...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaZona)
    });

    if (response.ok) {
      alert('Zona guardada exitosamente!');
      const zonas = await fetchZonas();
      renderCards(zonas);
      renderMapMarkers(zonas);
      modalAgregar.classList.add('hidden');
      limpiarFormulario();
    } else {
      alert('Error al guardar la zona');
    }
  } catch (error) {
    alert('Error de conexión');
  } finally {
    btnGuardarZona.disabled = false;
    btnGuardarZona.innerHTML = '<span class="save-icon">✓</span> Guardar Zona';
  }
});

function limpiarFormulario() {
  inNombre.value = '';
  inDescripcion.value = '';
  inDireccion.value = '';
  inLat.value = '';
  inLon.value = '';
  inCapacidad.value = '';
  inHorarioApertura.value = '06:00';
  inHorarioCierre.value = '22:00';
}


function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        userLocation = { lat, lon };
        console.log('Ubicación del usuario:', userLocation);

        if (userMarker) map.removeLayer(userMarker);

        const userIcon = L.divIcon({
          className: 'user-location-marker',
          html: '<div class="user-icon-pulse"></div>',
          iconSize: [20, 20]
        });

        userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
        userMarker.bindPopup('<strong>Tu ubicación</strong>').openPopup();
        map.setView([lat, lon], 14);

        // Obtener recomendaciones automáticamente
        setTimeout(() => obtenerRecomendaciones(), 1000);
      },
      (error) => {
        console.error('Error al obtener ubicación:', error);
        alert('No se pudo obtener tu ubicación. Puedes usar el mapa manualmente.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    alert('Tu navegador no soporta geolocalización');
  }
}


(async function init() {
  console.log('Inicializando aplicación v4...');
  const zonas = await fetchZonas();
  renderCards(zonas);
  renderMapMarkers(zonas);
  getUserLocation();
  console.log('Aplicación inicializada');
})();