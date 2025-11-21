from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import json
import random

default_args = {
    'owner': 'parqueo',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'etl_parqueo_simple',
    default_args=default_args,
    description='ETL simple para generar datos de parqueo',
    schedule_interval='*/15 * * * *',  # Cada 15 minutos
    catchup=False
)

def generar_datos_parqueo(**context):
    """Generar datos simulados de ocupación"""
    import psycopg2
    
    # Conectar a PostgreSQL
    conn = psycopg2.connect(
        host='postgres',
        database='parqueo',
        user='admin',
        password='admin123'
    )
    cur = conn.cursor()
    
    # Obtener zonas
    cur.execute("SELECT id_zona, capacidad FROM zona_parqueo")
    zonas = cur.fetchall()
    
    # Generar datos de ocupación simulados
    hora_actual = datetime.now().hour
    dia_semana = datetime.now().weekday()
    
    datos = []
    for zona_id, capacidad in zonas:
        # Simular ocupación (más alta en horas pico)
        factor_hora = 0.8 if 7 <= hora_actual <= 9 or 17 <= hora_actual <= 19 else 0.5
        ocupacion = min(int(capacidad * factor_hora * random.uniform(0.7, 1.0)), capacidad)
        disponible = capacidad - ocupacion
        
        datos.append({
            'id_zona': zona_id,
            'capacidad': capacidad,
            'ocupacion': ocupacion,
            'disponible': disponible,
            'porcentaje_ocupacion': round(ocupacion / capacidad * 100, 2),
            'hora': hora_actual,
            'dia_semana': dia_semana,
            'timestamp': datetime.now().isoformat()
        })
    
    # Guardar en archivo JSON compartido
    with open('/shared/datos_parqueo.json', 'w') as f:
        json.dump(datos, f, indent=2)
    
    print(f"✅ Datos generados: {len(datos)} zonas")
    print(f"📊 Ejemplo: {datos[0]}")
    
    cur.close()
    conn.close()
    
    return datos

def preparar_para_spark(**context):
    """Preparar datos para el modelo de Spark"""
    with open('/shared/datos_parqueo.json', 'r') as f:
        datos = json.load(f)
    
    # Agregar features adicionales
    for d in datos:
        d['score'] = (
            d['disponible'] * 0.6 +  # 60% peso a disponibilidad
            (d['capacidad'] - d['ocupacion']) * 0.4  # 40% peso a capacidad libre
        )
    
    # Guardar datos procesados
    with open('/shared/datos_procesados.json', 'w') as f:
        json.dump(datos, f, indent=2)
    
    print(f"✅ Datos preparados para Spark")
    return True

# Tareas
task_generar = PythonOperator(
    task_id='generar_datos',
    python_callable=generar_datos_parqueo,
    dag=dag,
)

task_preparar = PythonOperator(
    task_id='preparar_spark',
    python_callable=preparar_para_spark,
    dag=dag,
)

task_generar >> task_preparar