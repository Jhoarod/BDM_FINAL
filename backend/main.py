from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.zonas import router as zonas_router
from routers.auth import router as auth_router

app = FastAPI(title="API Parqueos", version="1.0")

# CORS - Permitir peticiones del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas
app.include_router(zonas_router, prefix="/api")
app.include_router(auth_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "API de Parqueos funcionando correctamente"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}