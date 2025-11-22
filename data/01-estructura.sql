
-- Tabla usuario
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    dni VARCHAR(20) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(150),
    password VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT NOW()
);

-- Tabla vehiculo
CREATE TABLE vehiculo (
    id_vehiculo SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    placa VARCHAR(10) UNIQUE NOT NULL,
    tipo VARCHAR(30),
    color VARCHAR(30),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- Zona de parqueo
CREATE TABLE zona_parqueo (
    id_zona SERIAL PRIMARY KEY,
    nombre_zona VARCHAR(50) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(200),
    capacidad INT,
    horario_apertura TIME,
    horario_cierre TIME,
    lat DECIMAL(10,6),
    lon DECIMAL(10,6)   
);

-- Espacios de parqueo
CREATE TABLE espacio_parqueo (
    id_espacio SERIAL PRIMARY KEY,
    id_zona INT NOT NULL,
    numero_espacio INT NOT NULL,
    tipo_vehiculo VARCHAR(30),
    estado VARCHAR(15) DEFAULT 'LIBRE',
    FOREIGN KEY (id_zona) REFERENCES zona_parqueo(id_zona)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (id_zona, numero_espacio)
);

-- Tarifa
CREATE TABLE tarifa (
    id_tarifa SERIAL PRIMARY KEY,
    id_zona INT NOT NULL,
    tipo_vehiculo VARCHAR(30) NOT NULL,
    valor_minuto DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_zona) REFERENCES zona_parqueo(id_zona)
        ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE (id_zona, tipo_vehiculo)
);

-- Registro del parqueo
CREATE TABLE registro_parqueo (
    id_registro SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_vehiculo INT NOT NULL,
    id_espacio INT NOT NULL,
    fecha_ingreso TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_salida TIMESTAMP,
    minutos_total INT,
    valor_total DECIMAL(10,2),
    estado VARCHAR(20) DEFAULT 'ACTIVO',
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculo(id_vehiculo),
    FOREIGN KEY (id_espacio) REFERENCES espacio_parqueo(id_espacio)
);

-- Historial de estado 
CREATE TABLE historial_estado_espacio (
    id_historial SERIAL PRIMARY KEY,
    id_espacio INT NOT NULL,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    fecha_cambio TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (id_espacio) REFERENCES espacio_parqueo(id_espacio)
);
