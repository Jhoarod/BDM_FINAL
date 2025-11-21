// script.js - v7 con ML y recomendaciones
const API_URL = "http://localhost:8000/api/zonas/";

let userLocation = null;
let userMarker = null;
let routeLines = [];

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

async function fetchZonas(){
  try {
    const res = await fetch(API_URL);
    if(!res.ok) throw new Error('Error al obtener zonas de la API');
    const zonas = await res.json();
    if(!Array.isArray(zonas)) throw new Error('Formato de respuesta inválido');
    console.log('Zonas obtenidas de la BD:', zonas);
    return zonas;
  } catch (err) {
    console.error('Error al conectar con la API:', err.message);
    return [];
  }
}

function renderCards(zonas){
  cardsEl.innerHTML = '';
  if(zonas.length === 0) {
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

function openModal(z){
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
    <button class="btn-como-llegar" onclick="mostrarRuta(${z.lat}, ${z.lon}, '${z.nombre_zona}')">
      🗺️ Cómo llegar
    </button>
  `;
  modal.classList.remove('hidden');
}

closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden') });

function renderMapMarkers(zonas){
  markersGroup.clearLayers();
  zonas.forEach(z => {
    if(typeof z.lat !== 'number' || typeof z.lon !== 'number') return;
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
      if(btnVerInfo) {
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

// ============================================
// FUNCIONES DE RECOMENDACIONES ML
// ============================================

async function obtenerRecomendaciones() {
  if (!userLocation) {
    alert('Primero necesitamos tu ubicación');
    getUserLocation();
    return;
  }

  try {
    const response = await fetch('http://localhost:8000/api/zonas/recomendar', {
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
      mostrarRecomendaciones(data.recomendaciones);
    } else {
      alert('Error al obtener recomendaciones');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión con el servidor');
  }
}

function mostrarRecomendaciones(recomendaciones) {
  // Limpiar rutas anteriores
  routeLines.forEach(line => map.removeLayer(line));
  routeLines = [];

  let html = '<h2>🎯 Mejores Zonas Recomendadas</h2><div class="recomendaciones-list">';
  
  recomendaciones.forEach((rec, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    html += `
      <div class="recomendacion-item">
        <div class="rec-header">
          <span class="rec-medal">${medal}</span>
          <strong>${rec.nombre_zona}</strong>
        </div>
        <div class="rec-details">
          <span>📍 ${rec.distancia_km} km</span>
          <span>⏱️ ~${rec.tiempo_estimado_min} min</span>
          <span>📊 Score: ${rec.score}</span>
        </div>
        <button class="btn-ruta-rec" onclick="dibujarRuta(${rec.lat}, ${rec.lon}, '${rec.nombre_zona}')">
          Ver Ruta
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  
  modalBody.innerHTML = html;
  modal.classList.remove('hidden');
}

function dibujarRuta(destLat, destLon, nombre) {
  if (!userLocation) {
    alert('No se pudo obtener tu ubicación');
    return;
  }

  // Dibujar línea simple (en producción usar OSRM)
  const line = L.polyline([
    [userLocation.lat, userLocation.lon],
    [destLat, destLon]
  ], {
    color: '#4285F4',
    weight: 4,
    opacity: 0.7
  }).addTo(map);

  routeLines.push(line);
  
  // Centrar mapa en la ruta
  map.fitBounds(line.getBounds().pad(0.1));
  
  modal.classList.add('hidden');
  alert(`Ruta a ${nombre} dibujada en el mapa`);
}

window.mostrarRuta = dibujarRuta;

// ============================================
// MODAL AGREGAR ZONA
// ============================================

btnFloatAgregar.addEventListener('click', () => {
  modalAgregar.classList.remove('hidden');
});

closeModalAgregar.addEventListener('click', () => {
  modalAgregar.classList.add('hidden');
  limpiarFormulario();
});

modalAgregar.addEventListener('click', (e) => {
  if(e.target === modalAgregar) {
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

  if(!nombre || !direccion || isNaN(lat) || isNaN(lon) || isNaN(capacidad) || !horarioApertura || !horarioCierre) {
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

// ============================================
// GEOLOCALIZACIÓN
// ============================================

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
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }
}

// ============================================
// INICIALIZAR
// ============================================

(async function init(){
  console.log('Inicializando aplicación...');
  const zonas = await fetchZonas();
  renderCards(zonas);
  renderMapMarkers(zonas);
  getUserLocation();
  console.log('Aplicación inicializada');
})();