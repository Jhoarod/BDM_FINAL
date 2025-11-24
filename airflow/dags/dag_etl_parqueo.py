
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.bash import BashOperator
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
    'etl_parqueo_con_spark',
    default_args=default_args,
    description='ETL completo: Extract -> Transform -> Spark ML -> Load',
    schedule_interval='*/15 * * * *',
    catchup=False,
    tags=['parqueo', 'etl', 'spark', 'ml']
)

SHARED_PATH = '/shared'


def extraer_datos(**context):
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
    
    ruta = os.path.join(SHARED_PATH, 'datos_raw.json')
    with open(ruta, 'w') as f:
        json.dump(datos, f, indent=2)
    
    cur.close()
    conn.close()
    
    print(f"✓ EXTRACT: {len(datos)} zonas extraídas")
    return {'total_zonas': len(datos)}


def transformar_datos(**context):
    
    with open(os.path.join(SHARED_PATH, 'datos_raw.json'), 'r') as f:
        datos = json.load(f)
    
    hora_actual = datetime.now().hour
    dia_semana = datetime.now().weekday()
    
    datos_procesados = []
    for d in datos:
        capacidad = d['capacidad']
        
        # Simular ocupación realista
        if 7 <= hora_actual <= 9 or 17 <= hora_actual <= 19:
            factor = random.uniform(0.70, 0.95)
        elif 12 <= hora_actual <= 14:
            factor = random.uniform(0.55, 0.80)
        elif 20 <= hora_actual <= 23 or 0 <= hora_actual <= 6:
            factor = random.uniform(0.10, 0.35)
        else:
            factor = random.uniform(0.35, 0.60)
        
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
    
    ruta = os.path.join(SHARED_PATH, 'datos_procesados.json')
    with open(ruta, 'w') as f:
        json.dump(datos_procesados, f, indent=2)
    
    print(f"✓ TRANSFORM: {len(datos_procesados)} registros procesados")
    
    if datos_procesados:
        ejemplo = datos_procesados[0]
        print(f"  Ejemplo: {ejemplo['nombre_zona']} - {ejemplo['disponible']}/{ejemplo['capacidad']} disponibles")
    
    return {'total_procesados': len(datos_procesados)}


def verificar_spark_disponible(**context):
    """Verificar si Spark está disponible antes de ejecutar"""
    import socket
    import time
    
    max_intentos = 3
    for intento in range(max_intentos):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('spark-master', 7077))
            sock.close()
            
            if result == 0:
                print(f"✓ Spark Master disponible en intento {intento + 1}")
                return True
            
            print(f"⚠ Spark no disponible, intento {intento + 1}/{max_intentos}")
            time.sleep(5)
        except Exception as e:
            print(f"❌ Error conectando a Spark: {e}")
    
    return False


def validar_resultados(**context):
    archivos = ['datos_raw.json', 'datos_procesados.json', 'recomendaciones.json']
    
    for archivo in archivos:
        ruta = os.path.join(SHARED_PATH, archivo)
        if not os.path.exists(ruta):
            print(f"⚠ Archivo no encontrado: {archivo}")
            if archivo == 'recomendaciones.json':
                # No es crítico si Spark falló
                continue
            raise FileNotFoundError(f"Archivo crítico no encontrado: {ruta}")
        
        with open(ruta, 'r') as f:
            data = json.load(f)
        
        print(f"✓ {archivo}: OK ({len(data) if isinstance(data, list) else 'dict'})")
    
    print("=" * 50)
    print("✓ Pipeline ETL completado exitosamente")
    print("=" * 50)
    return True



task_extract = PythonOperator(
    task_id='extract_datos_postgres',
    python_callable=extraer_datos,
    dag=dag,
)

task_transform = PythonOperator(
    task_id='transform_calcular_ocupacion',
    python_callable=transformar_datos,
    dag=dag,
)

task_check_spark = PythonOperator(
    task_id='verificar_spark_disponible',
    python_callable=verificar_spark_disponible,
    dag=dag,
)


task_spark = SparkSubmitOperator(
    task_id='ejecutar_modelo_spark',
    application='/opt/spark/jobs/modelo_spark.py',  # Ruta en el contenedor de Airflow
    conn_id='spark_default',  # Conexión creada automáticamente
    verbose=True,
    conf={
        'spark.master': 'spark://spark-master:7077',
        'spark.submit.deployMode': 'client',
    },
    dag=dag,
)

task_validate = PythonOperator(
    task_id='validar_pipeline',
    python_callable=validar_resultados,
    dag=dag,
)

task_log_success = BashOperator(
    task_id='log_pipeline_exitoso',
    bash_command='echo "✓ Pipeline completado: $(date +%Y-%m-%d\ %H:%M:%S)"',
    dag=dag,
)

task_extract >> task_transform >> task_check_spark >> task_spark >> task_validate >> task_log_success