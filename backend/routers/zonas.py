from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Zona
from schemas import ZonaCreate, ZonaSchema
from pydantic import BaseModel
import subprocess
import json
import os

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

# ============================================
# NUEVA RUTA: RECOMENDACIONES CON ML
# ============================================

class UbicacionUsuario(BaseModel):
    lat: float
    lon: float
    top_n: int = 3

@router.post("/recomendar")
def recomendar_zonas(ubicacion: UbicacionUsuario):
    """Obtener recomendaciones de zonas usando el modelo ML de Spark"""
    try:
        # Ejecutar el script de Spark
        result = subprocess.run([
            'python3', '/shared/../spark/jobs/modelo_simple.py'
        ], capture_output=True, text=True, timeout=10)
        
        # Si el script no existe o falla, usar modelo simple local
        if result.returncode != 0:
            print("⚠️ Spark no disponible, usando modelo local")
            return _modelo_local(ubicacion.lat, ubicacion.lon, ubicacion.top_n)
        
        # Leer resultado de Spark
        if os.path.exists('/shared/recomendaciones.json'):
            with open('/shared/recomendaciones.json', 'r') as f:
                return json.load(f)
        else:
            return _modelo_local(ubicacion.lat, ubicacion.lon, ubicacion.top_n)
            
    except Exception as e:
        print(f"Error en recomendaciones: {e}")
        return _modelo_local(ubicacion.lat, ubicacion.lon, ubicacion.top_n)

def _modelo_local(user_lat, user_lon, top_n):
    """Modelo local simple si Spark no está disponible"""
    import math
    from datetime import datetime
    
    db = SessionLocal()
    zonas = db.query(Zona).all()
    
    def calcular_distancia(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    
    recomendaciones = []
    for z in zonas:
        distancia = calcular_distancia(user_lat, user_lon, z.lat, z.lon)
        score = 100 / (1 + distancia)  # Simple: más cerca = mejor score
        
        recomendaciones.append({
            'id_zona': z.id_zona,
            'nombre_zona': z.nombre_zona,
            'direccion': z.direccion,
            'lat': z.lat,
            'lon': z.lon,
            'capacidad': z.capacidad,
            'distancia_km': round(distancia, 2),
            'score': round(score, 2),
            'tiempo_estimado_min': round(distancia * 3, 0)
        })
    
    recomendaciones.sort(key=lambda x: x['score'], reverse=True)
    db.close()
    
    return {
        'timestamp': datetime.now().isoformat(),
        'ubicacion_usuario': {'lat': user_lat, 'lon': user_lon},
        'recomendaciones': recomendaciones[:top_n]
    }