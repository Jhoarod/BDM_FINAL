from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Zona
from schemas import ZonaCreate, ZonaSchema

router = APIRouter(prefix="/zonas", tags=["Zonas"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def get_zonas(db: Session = Depends(get_db)):
    """Obtener todas las zonas de parqueo"""
    zonas = db.query(Zona).all()

    resultado = []
    for z in zonas:
        resultado.append({
            "id_zona": z.id_zona,
            "nombre_zona": z.nombre_zona,
            "descripcion": z.descripcion,
            "direccion": z.direccion,
            "capacidad": z.capacidad,
            "horario_apertura": str(z.horario_apertura),
            "horario_cierre": str(z.horario_cierre),
            "lat": z.lat,
            "lon": z.lon,
        })

    return resultado

@router.post("/", response_model=ZonaSchema)
def create_zona(zona: ZonaCreate, db: Session = Depends(get_db)):
    """Crear una nueva zona de parqueo"""
    try:
        nueva_zona = Zona(
            nombre_zona=zona.nombre_zona,
            descripcion=zona.descripcion,
            direccion=zona.direccion,
            capacidad=zona.capacidad,
            horario_apertura=zona.horario_apertura,
            horario_cierre=zona.horario_cierre,
            lat=zona.lat,
            lon=zona.lon
        )
        
        db.add(nueva_zona)
        db.commit()
        db.refresh(nueva_zona)
        
        return nueva_zona
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear zona: {str(e)}")

@router.get("/{id_zona}")
def get_zona_by_id(id_zona: int, db: Session = Depends(get_db)):
    """Obtener una zona específica por ID"""
    zona = db.query(Zona).filter(Zona.id_zona == id_zona).first()
    
    if not zona:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    
    return {
        "id_zona": zona.id_zona,
        "nombre_zona": zona.nombre_zona,
        "descripcion": zona.descripcion,
        "direccion": zona.direccion,
        "capacidad": zona.capacidad,
        "horario_apertura": str(zona.horario_apertura),
        "horario_cierre": str(zona.horario_cierre),
        "lat": zona.lat,
        "lon": zona.lon,
    }