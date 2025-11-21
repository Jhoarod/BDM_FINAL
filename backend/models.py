from sqlalchemy import Column, Integer, String, Text, Time, ForeignKey, Float
from sqlalchemy.orm import relationship
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
