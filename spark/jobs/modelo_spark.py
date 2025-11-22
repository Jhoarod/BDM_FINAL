
from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from datetime import datetime, timedelta
import json
import random
import os

default_args = {
    'owner': 'parqueo',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 1,
    'retry_delay': timedelta(minutes=2),
}

dag = DAG(
    'etl_parqueo_spark',
    default_args=default_args,
    description='ETL con Spark real',
    schedule_interval='*/15 * * * *',
    catchup=False,
    tags=['parqueo', 'spark']
)

SHARED_PATH = '/shared'


def extraer_datos(**context):
    """Extraer datos de PostgreSQL"""
    import psycopg2
    
    conn = psycopg2.connect(
        host='postgres',
        database='parqueo',
        user='admin',
        password='admin123'
    )
    cur = conn.cursor()
    cur.execute("SELECT id_zona, nombre_zona, capacidad, lat, lon FROM zona_parqueo")
    zonas = cur.fetchall()
    
    hora = datetime.now().hour
    dia = datetime.now().weekday()
    
    datos = []
    for row in zonas:
        capacidad = row[2]
        # Simular ocupación
        if 7 <= hora <= 9 or 17 <= hora <= 19:
            factor = random.uniform(0.7, 0.95)
        elif hora >= 20 or hora <= 6:
            factor = random.uniform(0.1, 0.3)
        else:
            factor = random.uniform(0.4, 0.6)
        
        ocupacion = min(int(capacidad * factor), capacidad)
        
        datos.append({
            'id_zona': row[0],
            'nombre_zona': row[1],
            'capacidad': capacidad,
            'lat': float(row[3]),
            'lon': float(row[4]),
            'ocupacion': ocupacion,
            'disponible': capacidad - ocupacion,
            'hora': hora,
            'dia_semana': dia
        })
    
    with open(f'{SHARED_PATH}/datos_procesados.json', 'w') as f:
        json.dump(datos, f)
    
    cur.close()
    conn.close()
    print(f"Extraídos {len(datos)} registros")


def verificar_spark(**context):
    """Verificar si Spark está disponible"""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('spark-master', 7077))
        sock.close()
        if result == 0:
            return 'ejecutar_spark'
        else:
            return 'modelo_fallback'
    except:
        return 'modelo_fallback'


def modelo_fallback(**context):
    """Modelo Python si Spark no está disponible"""
    with open(f'{SHARED_PATH}/datos_procesados.json', 'r') as f:
        datos = json.load(f)
    
    # Modelo simple local
    for d in datos:
        factor_disp = d['disponible'] / d['capacidad'] if d['capacidad'] > 0 else 0
        d['score_base'] = round(factor_disp * 100, 2)
    
    with open(f'{SHARED_PATH}/datos_procesados.json', 'w') as f:
        json.dump(datos, f)
    
    print("Modelo fallback ejecutado")



task_extract = PythonOperator(
    task_id='extraer_datos',
    python_callable=extraer_datos,
    dag=dag,
)

task_check_spark = BranchPythonOperator(
    task_id='verificar_spark',
    python_callable=verificar_spark,
    dag=dag,
)

# Spark real (requiere conexión configurada en Airflow)
task_spark = SparkSubmitOperator(
    task_id='ejecutar_spark',
    application='/opt/spark/jobs/modelo_spark.py',
    conn_id='spark_default',  
    verbose=True,
    dag=dag,
)

task_fallback = PythonOperator(
    task_id='modelo_fallback',
    python_callable=modelo_fallback,
    dag=dag,
)

task_done = BashOperator(
    task_id='completado',
    bash_command='echo "Pipeline completado $(date)"',
    trigger_rule='one_success',  
    dag=dag,
)

# Flujo
task_extract >> task_check_spark
task_check_spark >> task_spark >> task_done
task_check_spark >> task_fallback >> task_done