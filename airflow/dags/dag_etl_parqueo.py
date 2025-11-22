
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import json
import random
import os

default_args = {
    'owner': 'parqueo',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
}

dag = DAG(
    'etl_parqueo_v4',
    default_args=default_args,
    description='ETL: genera datos de ocupación cada 15 minutos',
    schedule_interval='*/15 * * * *',
    catchup=False,
    tags=['parqueo', 'etl']
)

SHARED_PATH = '/shared'


def extraer_datos(**context):
    """EXTRACT: Obtener datos de zonas desde PostgreSQL"""
    import psycopg2
    
    conn = psycopg2.connect(
        host='postgres',
        database='parqueo',
        user='admin',
        password='admin123'
    )
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id_zona, nombre_zona, capacidad, lat, lon 
        FROM zona_parqueo
    """)
    zonas = cur.fetchall()
    
    datos = [{
        'id_zona': row[0],
        'nombre_zona': row[1],
        'capacidad': row[2],
        'lat': float(row[3]) if row[3] else 0,
        'lon': float(row[4]) if row[4] else 0,
        'timestamp_extraccion': datetime.now().isoformat()
    } for row in zonas]
    
    # Guardar datos crudos
    ruta = os.path.join(SHARED_PATH, 'datos_raw.json')
    with open(ruta, 'w') as f:
        json.dump(datos, f, indent=2)
    
    cur.close()
    conn.close()
    
    print(f"✓ EXTRACT: {len(datos)} zonas extraídas")
    return len(datos)


def transformar_datos(**context):
    """TRANSFORM: Simular ocupación y calcular métricas"""
    
    # Leer datos crudos
    with open(os.path.join(SHARED_PATH, 'datos_raw.json'), 'r') as f:
        datos = json.load(f)
    
    hora_actual = datetime.now().hour
    dia_semana = datetime.now().weekday()
    
    datos_procesados = []
    for d in datos:
        capacidad = d['capacidad']
        
        # Simular ocupación según hora del día
        if 7 <= hora_actual <= 9 or 17 <= hora_actual <= 19:
            # Horas pico: alta ocupación
            factor = random.uniform(0.70, 0.95)
        elif 12 <= hora_actual <= 14:
            # Hora almuerzo: ocupación media-alta
            factor = random.uniform(0.55, 0.80)
        elif 20 <= hora_actual <= 23 or 0 <= hora_actual <= 6:
            # Noche: baja ocupación
            factor = random.uniform(0.10, 0.35)
        else:
            # Resto del día
            factor = random.uniform(0.35, 0.60)
        
        # Fin de semana: menos ocupación
        if dia_semana >= 5:
            factor *= 0.65
        
        ocupacion = min(int(capacidad * factor), capacidad)
        disponible = capacidad - ocupacion
        
        datos_procesados.append({
            'id_zona': d['id_zona'],
            'nombre_zona': d['nombre_zona'],
            'lat': d['lat'],
            'lon': d['lon'],
            'capacidad': capacidad,
            'ocupacion': ocupacion,
            'disponible': disponible,
            'porcentaje_ocupacion': round(ocupacion / capacidad * 100, 2) if capacidad > 0 else 0,
            'hora': hora_actual,
            'dia_semana': dia_semana,
            'es_hora_pico': 7 <= hora_actual <= 9 or 17 <= hora_actual <= 19,
            'es_fin_semana': dia_semana >= 5,
            'timestamp': datetime.now().isoformat()
        })
    
    # Guardar datos procesados (este es el archivo que lee el API)
    ruta = os.path.join(SHARED_PATH, 'datos_procesados.json')
    with open(ruta, 'w') as f:
        json.dump(datos_procesados, f, indent=2)
    
    print(f" TRANSFORM: {len(datos_procesados)} registros procesados")
    
    # Log de ejemplo
    if datos_procesados:
        ejemplo = datos_procesados[0]
        print(f"  Ejemplo: {ejemplo['nombre_zona']} - {ejemplo['disponible']}/{ejemplo['capacidad']} disponibles")
    
    return len(datos_procesados)


def generar_predicciones(**context):
    """PREDICT: Generar predicciones simples para próxima hora"""
    
    with open(os.path.join(SHARED_PATH, 'datos_procesados.json'), 'r') as f:
        datos = json.load(f)
    
    hora_actual = datetime.now().hour
    hora_siguiente = (hora_actual + 1) % 24
    
    predicciones = []
    for d in datos:
        # Predecir cambio en ocupación
        if hora_siguiente in [7, 8, 17, 18]:
            # Entrando a hora pico: aumentará
            cambio = random.uniform(0.05, 0.15)
        elif hora_siguiente in [10, 11, 15, 16]:
            # Saliendo de hora pico: disminuirá
            cambio = random.uniform(-0.10, -0.03)
        elif hora_siguiente >= 20 or hora_siguiente <= 6:
            # Noche: disminuirá
            cambio = random.uniform(-0.15, -0.05)
        else:
            # Estable
            cambio = random.uniform(-0.05, 0.05)
        
        ocupacion_predicha = min(
            max(d['ocupacion'] + int(d['capacidad'] * cambio), 0),
            d['capacidad']
        )
        
        predicciones.append({
            'id_zona': d['id_zona'],
            'nombre_zona': d['nombre_zona'],
            'ocupacion_actual': d['ocupacion'],
            'ocupacion_predicha': ocupacion_predicha,
            'disponible_predicho': d['capacidad'] - ocupacion_predicha,
            'tendencia': 'subiendo' if cambio > 0.02 else 'bajando' if cambio < -0.02 else 'estable',
            'hora_prediccion': hora_siguiente,
            'confianza': round(random.uniform(0.75, 0.92), 2)
        })
    
    # Guardar predicciones
    ruta = os.path.join(SHARED_PATH, 'predicciones.json')
    with open(ruta, 'w') as f:
        json.dump({
            'generado_en': datetime.now().isoformat(),
            'hora_predicha': hora_siguiente,
            'predicciones': predicciones
        }, f, indent=2)
    
    print(f"✓ PREDICT: {len(predicciones)} predicciones generadas para las {hora_siguiente}:00")
    return len(predicciones)


def validar_pipeline(**context):
    """Validar que todos los archivos se generaron correctamente"""
    archivos = ['datos_raw.json', 'datos_procesados.json', 'predicciones.json']
    
    for archivo in archivos:
        ruta = os.path.join(SHARED_PATH, archivo)
        if not os.path.exists(ruta):
            raise FileNotFoundError(f" Archivo no encontrado: {ruta}")
        
        with open(ruta, 'r') as f:
            data = json.load(f)
        
        # Verificar que no esté vacío
        if isinstance(data, list) and len(data) == 0:
            raise ValueError(f" Archivo vacío: {archivo}")
        if isinstance(data, dict) and 'predicciones' in data and len(data['predicciones']) == 0:
            raise ValueError(f"Sin predicciones en: {archivo}")
        
        print(f"✓ {archivo}: OK")
    
    print("=" * 40)
    print(" Pipeline ETL completado exitosamente")
    print("=" * 40)
    return True



task_extract = PythonOperator(
    task_id='extraer_datos',
    python_callable=extraer_datos,
    dag=dag,
)

task_transform = PythonOperator(
    task_id='transformar_datos',
    python_callable=transformar_datos,
    dag=dag,
)

task_predict = PythonOperator(
    task_id='generar_predicciones',
    python_callable=generar_predicciones,
    dag=dag,
)

task_validate = PythonOperator(
    task_id='validar_pipeline',
    python_callable=validar_pipeline,
    dag=dag,
)

# Flujo del DAG
task_extract >> task_transform >> task_predict >> task_validate