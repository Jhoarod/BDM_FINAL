const API_URL = 'http://localhost:8000/api/auth';

let isLoginMode = true;

// Elementos DOM
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnSubmit = document.getElementById('btnSubmit');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('spinner');
const message = document.getElementById('message');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const toggleText = document.getElementById('toggleText');
const btnToggle = document.getElementById('btnToggle');

// Toggle mostrar/ocultar password
function togglePassword() {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
  
  const eyeIcon = document.getElementById('eyeIcon');
  if (type === 'text') {
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
}

// Toggle entre login y registro
function toggleMode() {
  isLoginMode = !isLoginMode;
  
  if (isLoginMode) {
    formTitle.textContent = 'Iniciar Sesión';
    formSubtitle.textContent = 'Ingresa tus credenciales para continuar';
    btnText.textContent = 'Iniciar Sesión';
    toggleText.textContent = '¿Primera vez?';
    btnToggle.textContent = 'Registrar contraseña';
  } else {
    formTitle.textContent = 'Registrar Contraseña';
    formSubtitle.textContent = 'Crea tu contraseña para acceder al sistema';
    btnText.textContent = 'Registrar';
    toggleText.textContent = '¿Ya tienes contraseña?';
    btnToggle.textContent = 'Iniciar sesión';
  }
  
  hideMessage();
  passwordInput.value = '';
}

// Mostrar mensaje
function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

function hideMessage() {
  message.className = 'message hidden';
}

// Loading state
function setLoading(loading) {
  btnSubmit.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline';
  spinner.className = loading ? 'spinner' : 'spinner hidden';
}

// Submit del formulario
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showMessage('Por favor completa todos los campos', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  setLoading(true);
  hideMessage();
  
  try {
    const endpoint = isLoginMode ? '/login' : '/register';
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showMessage(data.message, 'success');
      
      if (isLoginMode) {
        // Guardar sesión y redirigir
        sessionStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('isLoggedIn', 'true');
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } else {
        // Registro exitoso, cambiar a login
        setTimeout(() => {
          toggleMode();
          showMessage('Ahora puedes iniciar sesión', 'success');
        }, 1500);
      }
    } else {
      showMessage(data.detail || 'Error en la operación', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('Error de conexión con el servidor', 'error');
  } finally {
    setLoading(false);
  }
});

// Verificar si ya está logueado
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    window.location.href = 'index.html';
  }
}

// Inicialización
checkAuth();