from fastapi import FastAPI
from database import engine
import models

app = FastAPI()

@app.get("/")
def root():
    return {"message": "API funcionando"}
