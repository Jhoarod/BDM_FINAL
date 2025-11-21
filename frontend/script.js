// script.js - v6 con API real
const API_URL = "http://localhost:8000/api/zonas/";

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

// Fetch zonas desde la API
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
    alert('Error al cargar las zonas. Verifica que el servidor esté ejecutándose.');
    return [];
  }
}

// Renderizar tarjetas laterales
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

// Abrir modal de detalles
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

// Renderizar marcadores en el mapa
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

// Guardar zona en la BD mediante API
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

  console.log('Enviando zona a la API:', nuevaZona);

  // Deshabilitar botón mientras se guarda
  btnGuardarZona.disabled = true;
  btnGuardarZona.textContent = 'Guardando...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nuevaZona)
    });

    if (response.ok) {
      const zonaCreada = await response.json();
      console.log('Zona creada:', zonaCreada);
      
      alert('Zona guardada exitosamente en la base de datos!');
      
      // Recargar zonas y actualizar mapa
      const zonas = await fetchZonas();
      renderCards(zonas);
      renderMapMarkers(zonas);
      
      modalAgregar.classList.add('hidden');
      limpiarFormulario();
    } else {
      const errorData = await response.json();
      console.error('Error del servidor:', errorData);
      alert(`Error al guardar: ${errorData.detail || 'Error desconocido'}`);
    }

  } catch (error) {
    console.error('Error al guardar zona:', error);
    alert('Error de conexión. Verifica que el servidor esté ejecutándose.');
  } finally {
    // Reactivar botón
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
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================

(async function init(){
  console.log('Inicializando aplicación...');
  console.log('URL de la API:', API_URL);
  
  const zonas = await fetchZonas();
  renderCards(zonas);
  renderMapMarkers(zonas);
  
  console.log('Aplicación inicializada correctamente');
})();