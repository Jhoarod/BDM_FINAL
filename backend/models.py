from sqlalchemy import Column, Integer, String, Text, Time, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class Zona(Base):
    __tablename__ = "zona_parqueo"

    id_zona = Column(Integer, primary_key=True)
    nombre_zona = Column(String(50))
    descripcion = Column(Text)
    direccion = Column(String(200))
    capacidad = Column(Integer)
    horario_apertura = Column(Time)
    horario_cierre = Column(Time)
    lat = Column(Float, nullable=False) 
    lon = Column(Float, nullable=False)

class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100))
    dni = Column(String(20), unique=True, nullable=False)
    telefono = Column(String(20))
    email = Column(String(150), unique=True, nullable=False)
    password = Column(String(255), nullable=True)  # Nullable hasta que se registre
    fecha_registro = Column(DateTime, server_default=func.now())