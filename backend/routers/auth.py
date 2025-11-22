"""
auth.py - Router de autenticación
Crear en: backend/routers/auth.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from database import SessionLocal
from models import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Configuración de encriptación
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============ SCHEMAS ============

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str | None
    email: str
    
    class Config:
        from_attributes = True


# ============ FUNCIONES DE UTILIDAD ============

def hash_password(password: str) -> str:
    """Encriptar password con bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password contra hash"""
    return pwd_context.verify(plain_password, hashed_password)


# ============ ENDPOINTS ============

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login de usuario.
    - Si el usuario existe y tiene password: verificar
    - Si el usuario existe sin password: error (debe registrarse primero)
    - Si no existe: error
    """
    # Buscar usuario por email
    usuario = db.query(Usuario).filter(Usuario.email == request.email).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado. Verifica tu email."
        )
    
    # Verificar si tiene password registrada
    if not usuario.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes registrar tu contraseña primero."
        )
    
    # Verificar password
    if not verify_password(request.password, usuario.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta."
        )
    
    # Login exitoso
    return {
        "success": True,
        "message": "Login exitoso",
        "user": {
            "id": usuario.id_usuario,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "email": usuario.email
        }
    }


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registrar contraseña para usuario existente.
    El usuario debe existir en la BD (pre-registrado).
    """
    # Buscar usuario por email
    usuario = db.query(Usuario).filter(Usuario.email == request.email).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email no autorizado. Contacta al administrador."
        )
    
    # Verificar si ya tiene password
    if usuario.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este usuario ya tiene contraseña registrada. Usa login."
        )
    
    # Validar password mínima
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres."
        )
    
    # Encriptar y guardar password
    usuario.password = hash_password(request.password)
    db.commit()
    
    return {
        "success": True,
        "message": "Contraseña registrada exitosamente. Ya puedes iniciar sesión.",
        "user": {
            "id": usuario.id_usuario,
            "nombre": usuario.nombre,
            "email": usuario.email
        }
    }


@router.get("/check-email/{email}")
def check_email(email: str, db: Session = Depends(get_db)):
    """Verificar si un email está registrado y si tiene password"""
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    
    if not usuario:
        return {"exists": False, "has_password": False}
    
    return {
        "exists": True,
        "has_password": usuario.password is not None,
        "nombre": usuario.nombre
    }