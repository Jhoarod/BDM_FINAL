from pydantic import BaseModel
from datetime import time

class ZonaBase(BaseModel):
    nombre_zona: str
    descripcion: str | None
    direccion: str
    capacidad: int
    horario_apertura: time
    horario_cierre: time
    lat: float
    lon: float

class ZonaCreate(ZonaBase):
    pass

class ZonaSchema(ZonaBase):
    id_zona: int

    class Config:
        orm_mode = True
