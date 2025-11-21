import json
import math
from datetime import datetime

def calcular_distancia(lat1, lon1, lat2, lon2):
    """Calcular distancia usando fórmula Haversine"""
    R = 6371  # Radio de la Tierra en km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def recomendar_zonas(user_lat, user_lon, top_n=3):
    """Modelo predictivo simple para recomendar mejores zonas"""
    
    # Cargar datos procesados de Airflow
    with open('/shared/datos_procesados.json', 'r') as f:
        datos = json.load(f)
    
    # Cargar información de zonas desde BD
    import psycopg2
    conn = psycopg2.connect(
        host='postgres',
        database='parqueo',
        user='admin',
        password='admin123'
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT id_zona, nombre_zona, direccion, lat, lon, capacidad 
        FROM zona_parqueo
    """)
    zonas_bd = {row[0]: {
        'id_zona': row[0],
        'nombre_zona': row[1],
        'direccion': row[2],
        'lat': row[3],
        'lon': row[4],
        'capacidad': row[5]
    } for row in cur.fetchall()}
    cur.close()
    conn.close()
    
    # Calcular score para cada zona
    recomendaciones = []
    hora_actual = datetime.now().hour
    
    for dato in datos:
        zona_id = dato['id_zona']
        if zona_id not in zonas_bd:
            continue
            
        zona_info = zonas_bd[zona_id]
        
        # Calcular distancia
        distancia = calcular_distancia(
            user_lat, user_lon,
            float(zona_info['lat']), float(zona_info['lon'])
        )
        
        # Factores del modelo predictivo
        factor_disponibilidad = dato['disponible'] / dato['capacidad']  # 0-1
        factor_distancia = 1 / (1 + distancia)  # Más cerca = mejor
        factor_hora = 1.0 if 7 <= hora_actual <= 20 else 0.7  # Horario favorable
        
        # Score final (modelo simple pero efectivo)
        score = (
            factor_disponibilidad * 50 +  # 50% disponibilidad
            factor_distancia * 30 +        # 30% cercanía
            factor_hora * 20               # 20% horario
        )
        
        recomendaciones.append({
            'id_zona': zona_id,
            'nombre_zona': zona_info['nombre_zona'],
            'direccion': zona_info['direccion'],
            'lat': float(zona_info['lat']),
            'lon': float(zona_info['lon']),
            'disponible': dato['disponible'],
            'capacidad': dato['capacidad'],
            'ocupacion': dato['ocupacion'],
            'porcentaje_disponible': round(factor_disponibilidad * 100, 1),
            'distancia_km': round(distancia, 2),
            'score': round(score, 2),
            'tiempo_estimado_min': round(distancia * 3, 0)  # Estimación simple
        })
    
    # Ordenar por score y retornar top N
    recomendaciones.sort(key=lambda x: x['score'], reverse=True)
    resultado = recomendaciones[:top_n]
    
    # Guardar resultado
    output = {
        'timestamp': datetime.now().isoformat(),
        'ubicacion_usuario': {'lat': user_lat, 'lon': user_lon},
        'total_evaluadas': len(recomendaciones),
        'recomendaciones': resultado
    }
    
    with open('/shared/recomendaciones.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f" Modelo ejecutado: {len(resultado)} recomendaciones generadas")
    return resultado

if __name__ == "__main__":
    # Ejemplo de uso
    recomendaciones = recomendar_zonas(4.60971, -74.08175, top_n=5)
    for i, rec in enumerate(recomendaciones, 1):
        print(f"{i}. {rec['nombre_zona']}: Score {rec['score']} - {rec['distancia_km']}km - {rec['disponible']} espacios")