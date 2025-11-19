from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Zona

router = APIRouter(prefix="/zonas", tags=["Zonas"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def get_zonas(db: Session = Depends(get_db)):
    zonas = db.query(Zona).all()

    # Convertimos cada zona a JSON y le agregamos lat/lon
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
            "lat": getattr(z, "lat", None),
            "lon": getattr(z, "lon", None),
        })

    return resultado
