
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Zona
from schemas import ZonaCreate, ZonaSchema
from pydantic import BaseModel
import json
import os
import math
from datetime import datetime
import httpx

router = APIRouter(prefix="/zonas", tags=["Zonas"])

# ============ CONFIGURACIÓN ============
SHARED_PATH = os.getenv("SHARED_PATH", "/shared")
# OSRM: usar público por defecto, o tu instancia local
OSRM_URL = os.getenv("OSRM_URL", "http://router.project-osrm.org")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




class UbicacionUsuario(BaseModel):
    lat: float
    lon: float
    top_n: int = 3


class RutaRequest(BaseModel):
    origen_lat: float
    origen_lon: float
    destino_lat: float
    destino_lon: float




def calcular_distancia_haversine(lat1, lon1, lat2, lon2):
    """Calcular distancia en km usando fórmula Haversine"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def cargar_datos_airflow():
    """Cargar datos procesados por Airflow si existen y son recientes"""
    ruta_datos = os.path.join(SHARED_PATH, "datos_procesados.json")
    
    if not os.path.exists(ruta_datos):
        print(" Archivo de Airflow no encontrado")
        return None
    
    try:
        # Verificar que el archivo no sea muy viejo (30 min)
        file_age = datetime.now().timestamp() - os.path.getmtime(ruta_datos)
        if file_age > 1800:  # 30 minutos
            print(f" Datos de Airflow muy antiguos ({file_age/60:.1f} min)")
            return None
        
        with open(ruta_datos, 'r') as f:
            datos = json.load(f)
        
        print(f" Datos de Airflow cargados ({len(datos)} registros)")
        return datos
    except Exception as e:
        print(f" Error leyendo datos de Airflow: {e}")
        return None


@router.get("/")
def get_zonas(db: Session = Depends(get_db)):
    """Obtener todas las zonas de parqueo"""
    zonas = db.query(Zona).all()
    return [{
        "id_zona": z.id_zona,
        "nombre_zona": z.nombre_zona,
        "descripcion": z.descripcion,
        "direccion": z.direccion,
        "capacidad": z.capacidad,
        "horario_apertura": str(z.horario_apertura),
        "horario_cierre": str(z.horario_cierre),
        "lat": z.lat,
        "lon": z.lon,
    } for z in zonas]


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



@router.post("/recomendar")
def recomendar_zonas(ubicacion: UbicacionUsuario, db: Session = Depends(get_db)):
    """
    Obtener recomendaciones de zonas.
    Usa datos de Airflow si están disponibles.
    """
    # Intentar cargar datos de Airflow
    datos_airflow = cargar_datos_airflow()
    
    # Obtener zonas de la BD
    zonas = db.query(Zona).all()
    
    hora_actual = datetime.now().hour
    recomendaciones = []
    
    for zona in zonas:
        # Calcular distancia
        distancia = calcular_distancia_haversine(
            ubicacion.lat, ubicacion.lon,
            zona.lat, zona.lon
        )
        
        # Valores por defecto
        disponible = zona.capacidad
        ocupacion = 0
        fuente = 'local'
        
        # Si hay datos de Airflow, usarlos
        if datos_airflow:
            dato_zona = next(
                (d for d in datos_airflow if d['id_zona'] == zona.id_zona),
                None
            )
            if dato_zona:
                disponible = dato_zona.get('disponible', zona.capacidad)
                ocupacion = dato_zona.get('ocupacion', 0)
                fuente = 'airflow'
        
        # Calcular score del modelo predictivo
        factor_disponibilidad = disponible / zona.capacidad if zona.capacidad > 0 else 0
        factor_distancia = 1 / (1 + distancia)
        factor_hora = 1.0 if 7 <= hora_actual <= 20 else 0.7
        
        score = (
            factor_disponibilidad * 50 +
            factor_distancia * 30 +
            factor_hora * 20
        )
        
        recomendaciones.append({
            'id_zona': zona.id_zona,
            'nombre_zona': zona.nombre_zona,
            'direccion': zona.direccion,
            'lat': zona.lat,
            'lon': zona.lon,
            'capacidad': zona.capacidad,
            'disponible': disponible,
            'ocupacion': ocupacion,
            'porcentaje_disponible': round(factor_disponibilidad * 100, 1),
            'distancia_km': round(distancia, 2),
            'score': round(score, 2),
            'tiempo_estimado_min': round(distancia * 3, 0),
            'fuente_datos': fuente
        })
    
    recomendaciones.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        'timestamp': datetime.now().isoformat(),
        'ubicacion_usuario': {'lat': ubicacion.lat, 'lon': ubicacion.lon},
        'modelo_usado': 'airflow+local' if datos_airflow else 'local',
        'recomendaciones': recomendaciones[:ubicacion.top_n]
    }



@router.post("/ruta")
async def obtener_ruta(ruta: RutaRequest):
    """
    Obtener la ruta desde origen hasta destino usando OSRM.
    Retorna geometría GeoJSON para dibujar en el mapa.
    """
    try:
        # OSRM espera coordenadas como lon,lat (no lat,lon!)
        coords = f"{ruta.origen_lon},{ruta.origen_lat};{ruta.destino_lon},{ruta.destino_lat}"
        url = f"{OSRM_URL}/route/v1/driving/{coords}"
        
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
            "annotations": "false"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
        
        if data.get("code") != "Ok":
            raise HTTPException(
                status_code=400,
                detail=f"Error de OSRM: {data.get('message', 'Unknown error')}"
            )
        
        route = data["routes"][0]
        
        return {
            "success": True,
            "ruta": {
                "geometry": route["geometry"],
                "distancia_km": round(route["distance"] / 1000, 2),
                "duracion_min": round(route["duration"] / 60, 1),
                "pasos": [{
                    "instruccion": step["maneuver"]["type"],
                    "modificador": step["maneuver"].get("modifier", ""),
                    "nombre_calle": step.get("name", ""),
                    "distancia_m": round(step["distance"], 0),
                    "duracion_s": round(step["duration"], 0)
                } for leg in route["legs"] for step in leg["steps"]]
            },
            "origen": {"lat": ruta.origen_lat, "lon": ruta.origen_lon},
            "destino": {"lat": ruta.destino_lat, "lon": ruta.destino_lon}
        }
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout conectando con servicio de rutas")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error de conexión con OSRM: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo ruta: {str(e)}")


@router.post("/recomendar-con-ruta")
async def recomendar_con_ruta(ubicacion: UbicacionUsuario, db: Session = Depends(get_db)):
    """
    Obtener recomendaciones de zonas CON las rutas calculadas.
    Combina el modelo predictivo con routing real de OSRM.
    """
    # Primero obtener recomendaciones
    recomendaciones_data = recomendar_zonas(ubicacion, db)
    recomendaciones = recomendaciones_data['recomendaciones']
    
    # Agregar rutas a cada recomendación
    for rec in recomendaciones:
        try:
            ruta_req = RutaRequest(
                origen_lat=ubicacion.lat,
                origen_lon=ubicacion.lon,
                destino_lat=rec['lat'],
                destino_lon=rec['lon']
            )
            ruta_result = await obtener_ruta(ruta_req)
            
            if ruta_result['success']:
                rec['ruta'] = ruta_result['ruta']
                # Actualizar con datos reales de la ruta
                rec['distancia_km'] = ruta_result['ruta']['distancia_km']
                rec['tiempo_estimado_min'] = ruta_result['ruta']['duracion_min']
        except Exception as e:
            print(f" Error obteniendo ruta para zona {rec['id_zona']}: {e}")
            rec['ruta'] = None
    
    # Recalcular scores con distancias reales de OSRM
    hora_actual = datetime.now().hour
    for rec in recomendaciones:
        if rec.get('ruta'):
            factor_distancia = 1 / (1 + rec['distancia_km'])
            factor_disponibilidad = rec['disponible'] / rec['capacidad'] if rec['capacidad'] > 0 else 0
            factor_hora = 1.0 if 7 <= hora_actual <= 20 else 0.7
            rec['score'] = round(
                factor_disponibilidad * 50 +
                factor_distancia * 30 +
                factor_hora * 20, 2
            )
    
    # Reordenar por score actualizado
    recomendaciones.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        'timestamp': datetime.now().isoformat(),
        'ubicacion_usuario': {'lat': ubicacion.lat, 'lon': ubicacion.lon},
        'modelo_usado': recomendaciones_data['modelo_usado'],
        'recomendaciones': recomendaciones
    }