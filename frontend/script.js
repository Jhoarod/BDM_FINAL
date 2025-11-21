// script.js
const API_URL = "http://localhost:8000/api/zonas/";

const FALLBACK_ZONAS = [
  {
    id_zona: 1,
    nombre_zona: "Zona Norte",
    descripcion: "Parqueadero cubierto en el sector norte",
    direccion: "Calle 120 # 15-30",
    capacidad: 50,
    horario_apertura: "06:00",
    horario_cierre: "22:00",
    lat: 4.701594,
    lon: -74.055558
  },
  {
    id_zona: 2,
    nombre_zona: "Zona Centro",
    descripcion: "Parqueadero principal en el centro",
    direccion: "Cra 10 # 20-15",
    capacidad: 40,
    horario_apertura: "06:00",
    horario_cierre: "23:00",
    lat: 4.609710,
    lon: -74.081754
  },
  {
    id_zona: 3,
    nombre_zona: "Zona Sur",
    descripcion: "Parqueadero al aire libre",
    direccion: "Av Boyacá # 45-22",
    capacidad: 30,
    horario_apertura: "07:00",
    horario_cierre: "21:00",
    lat: 4.598056,
    lon: -74.120000
  },
  {
    id_zona: 4,
    nombre_zona: "Zona VIP",
    descripcion: "Parqueadero privado premium",
    direccion: "Calle 95 # 14-11",
    capacidad: 20,
    horario_apertura: "06:00",
    horario_cierre: "23:59",
    lat: 4.677000,
    lon: -74.058000
  },
  {
    id_zona: 5,
    nombre_zona: "Zona Económica",
    descripcion: "Parqueadero económico y amplio",
    direccion: "Cra 50 # 80-12",
    capacidad: 60,
    horario_apertura: "08:00",
    horario_cierre: "20:00",
    lat: 4.650000,
    lon: -74.100000
  }
];

// Elementos DOM - Modal original de detalles
const cardsEl = document.getElementById('cards');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');

// Elementos DOM - Modal AGREGAR nueva zona
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
    if(!res.ok) throw new Error('No hay respuesta del API');
    const zonas = await res.json();
    if(!Array.isArray(zonas) || zonas.length === 0) throw new Error('Formato inválido');
    return zonas;
  } catch (err) {
    console.warn('API no disponible, usando datos de ejemplo:', err.message);
    return FALLBACK_ZONAS;
  }
}

function renderCards(zonas){
  cardsEl.innerHTML = '';
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
      <div class="detail-row">
        <strong>Dirección</strong>
        <span>${z.direccion || '-'}</span>
      </div>
      <div class="detail-row">
        <strong>Capacidad</strong>
        <span>${z.capacidad}</span>
      </div>
      <div class="detail-row">
        <strong>Horario</strong>
        <span>${z.horario_apertura} - ${z.horario_cierre}</span>
      </div>
      <div class="detail-row">
        <strong>Coordenadas</strong>
        <span>${z.lat}, ${z.lon}</span>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { 
  if(e.target === modal) modal.classList.add('hidden') 
});

function renderMapMarkers(zonas){
  markersGroup.clearLayers();

  zonas.forEach(z => {
    if(typeof z.lat !== 'number' || typeof z.lon !== 'number') return;
    
    const marker = L.marker([z.lat, z.lon]);
    
    // Crear popup con botón "Ver Información"
    const popupContent = `
      <div class="popup-zona">
        <strong class="popup-titulo">${z.nombre_zona}</strong>
        <p class="popup-direccion">${z.direccion || ''}</p>
        <p class="popup-capacidad">Capacidad: ${z.capacidad}</p>
        <button class="btn-ver-info" data-zona-id="${z.id_zona}">Ver Información</button>
      </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Evento cuando se abre el popup
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

  // Validación
  if(!nombre) return alert('Por favor ingresa el nombre');
  if(!direccion) return alert('Por favor ingresa la dirección');
  if(isNaN(lat) || isNaN(lon)) return alert('Coordenadas inválidas');
  if(isNaN(capacidad) || capacidad <= 0) return alert('Capacidad inválida');
  if(!horarioApertura) return alert('Por favor ingresa el horario de apertura');
  if(!horarioCierre) return alert('Por favor ingresa el horario de cierre');

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

  console.log('Nueva zona a guardar:', nuevaZona);

  // Aquí puedes hacer el POST al API
  try {
    // Descomentar cuando tengas el endpoint listo:
    // const response = await fetch(API_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(nuevaZona)
    // });
    // 
    // if (response.ok) {
    //   alert('✓ Zona guardada exitosamente!');
    //   const zonas = await fetchZonas();
    //   renderCards(zonas);
    //   renderMapMarkers(zonas);
    // } else {
    //   alert('Error al guardar la zona en el servidor');
    // }

    alert('Zona guardada exitosamente!');

  } catch (error) {
    console.error('Error al guardar:', error);
    alert('Error al guardar la zona');
  }

  modalAgregar.classList.add('hidden');
  limpiarFormulario();
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

// Inicializar
(async function init(){
  const zonas = await fetchZonas();
  renderCards(zonas);
  renderMapMarkers(zonas);
})();