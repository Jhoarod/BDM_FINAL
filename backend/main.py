from fastapi import FastAPI
from routers import zonas

app = FastAPI()

app.include_router(zonas.router, prefix="/api")

@app.get("/")
def root():
    return {"msg": "API Parqueo funcionando"}
