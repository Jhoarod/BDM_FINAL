// script.js
// Consume /api/zonas (espera un array de objetos). Si falla, usa fallback.
const API_URL = "http://localhost:8000/api/zonas/";


// Fallback con 5 zonas (lat, lon reales de ejemplo)
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

// Elementos DOM
const cardsEl = document.getElementById('cards');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');

// Inicializar mapa
const map = L.map('map').setView([4.60971, -74.08175], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let markersGroup = L.layerGroup().addTo(map);

async function fetchZonas(){
  try {
    const res = await fetch(API_URL);
    if(!res.ok) throw new Error('No hay respuesta del API');
    const zonas = await res.json();
    if(!Array.isArray(zonas) || zonas.length === 0) throw new Error('Formato de datos inválido');
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
  modalBody.innerHTML = `
    <h2>${z.nombre_zona}</h2>
    <p>${z.descripcion || ''}</p>
    <div style="margin-top:10px">
      <div class="detail-row"><strong>Dirección</strong><span>${z.direccion || '-'}</span></div>
      <div class="detail-row"><strong>Capacidad</strong><span>${z.capacidad}</span></div>
      <div class="detail-row"><strong>Horario</strong><span>${z.horario_apertura} - ${z.horario_cierre}</span></div>
      <div class="detail-row"><strong>Coordenadas</strong><span>${z.lat}, ${z.lon}</span></div>
    </div>
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
    marker.bindPopup(`<strong>${z.nombre_zona}</strong><br>${z.direccion || ''}<br>Capacidad: ${z.capacidad}`);
    marker.on('click', ()=> openModal(z));
    markersGroup.addLayer(marker);
  });
  if(zonas.length) map.fitBounds(markersGroup.getBounds().pad(0.2));
}

// Inicializar
(async function init(){
  const zonas = await fetchZonas();
  renderCards(zonas);
  renderMapMarkers(zonas);
})();



