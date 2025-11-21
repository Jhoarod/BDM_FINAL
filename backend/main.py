from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.zonas import router as zonas_router

app = FastAPI(title="API Parqueos", version="1.0")

# CORS - Permitir peticiones del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción especifica los dominios exactos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas
app.include_router(zonas_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "API de Parqueos funcionando correctamente"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}