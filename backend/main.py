from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import zonas

app = FastAPI()

app.include_router(zonas.router, prefix="/api")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permitir todo (puedes restringir después)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"msg": "API Parqueo funcionando"}
