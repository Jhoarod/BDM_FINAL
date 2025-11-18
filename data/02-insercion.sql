---------------------------------------------------------
-- USUARIOS
---------------------------------------------------------
INSERT INTO usuario (nombre, apellido, dni, telefono, email) VALUES
('Carlos', 'Ramírez', '1001234567', '3001112222', 'carlos@example.com'),
('María', 'Gómez', '1009876543', '3012223333', 'maria@example.com'),
('Juan', 'López', '1012345678', '3023334444', 'juan@example.com'),
('Ana', 'Martínez', '1018765432', '3034445555', 'ana@example.com'),
('Pedro', 'Torres', '1021122334', '3045556666', 'pedro@example.com'),
('Luisa', 'Fernández', '1025566778', '3056667777', 'luisa@example.com'),
('Jorge', 'Castro', '1039988776', '3067778888', 'jorge@example.com'),
('Sofía', 'Hernández', '1044455667', '3078889999', 'sofia@example.com'),
('Andrés', 'Mora', '1052233445', '3089991111', 'andres@example.com'),
('Diana', 'Peralta', '1056677889', '3091112222', 'diana@example.com');

---------------------------------------------------------
-- VEHÍCULOS
---------------------------------------------------------
INSERT INTO vehiculo (id_usuario, placa, tipo, color) VALUES
(1, 'ABC123', 'Carro', 'Rojo'),
(1, 'XYZ987', 'Moto', 'Negro'),
(2, 'BCD234', 'Carro', 'Blanco'),
(3, 'CDE345', 'Carro', 'Azul'),
(4, 'DEF456', 'Moto', 'Verde'),
(5, 'EFG567', 'Carro', 'Gris'),
(6, 'FGH678', 'Camioneta', 'Negro'),
(7, 'GHI789', 'Moto', 'Rojo');

---------------------------------------------------------
-- ZONAS DE PARQUEO (5)
---------------------------------------------------------
INSERT INTO zona_parqueo (nombre_zona, descripcion, direccion, capacidad, horario_apertura, horario_cierre) VALUES
('Zona Norte', 'Parqueadero cubierto en el sector norte', 'Calle 120 # 15-30', 50, '06:00', '22:00'),
('Zona Centro', 'Parqueadero principal en el centro', 'Cra 10 # 20-15', 40, '06:00', '23:00'),
('Zona Sur', 'Parqueadero al aire libre', 'Av Boyacá # 45-22', 30, '07:00', '21:00'),
('Zona VIP', 'Parqueadero privado premium', 'Calle 95 # 14-11', 20, '06:00', '23:59'),
('Zona Económica', 'Parqueadero económico y amplio', 'Cra 50 # 80-12', 60, '08:00', '20:00');

---------------------------------------------------------
-- ESPACIOS DE PARQUEO (8 por zona = 40 espacios)
---------------------------------------------------------

-- Zona 1
INSERT INTO espacio_parqueo (id_zona, numero_espacio, tipo_vehiculo) VALUES
(1,1,'Carro'),(1,2,'Carro'),(1,3,'Carro'),(1,4,'Carro'),
(1,5,'Moto'),(1,6,'Moto'),(1,7,'Carro'),(1,8,'Camioneta');

-- Zona 2
INSERT INTO espacio_parqueo (id_zona, numero_espacio, tipo_vehiculo) VALUES
(2,1,'Carro'),(2,2,'Carro'),(2,3,'Carro'),(2,4,'Moto'),
(2,5,'Moto'),(2,6,'Carro'),(2,7,'Camioneta'),(2,8,'Carro');

-- Zona 3
INSERT INTO espacio_parqueo (id_zona, numero_espacio, tipo_vehiculo) VALUES
(3,1,'Carro'),(3,2,'Carro'),(3,3,'Moto'),(3,4,'Moto'),
(3,5,'Carro'),(3,6,'Moto'),(3,7,'Carro'),(3,8,'Moto');

-- Zona 4
INSERT INTO espacio_parqueo (id_zona, numero_espacio, tipo_vehiculo) VALUES
(4,1,'Carro'),(4,2,'Carro'),(4,3,'Camioneta'),(4,4,'Camioneta'),
(4,5,'Carro'),(4,6,'Carro'),(4,7,'Moto'),(4,8,'Moto');

-- Zona 5
INSERT INTO espacio_parqueo (id_zona, numero_espacio, tipo_vehiculo) VALUES
(5,1,'Carro'),(5,2,'Carro'),(5,3,'Carro'),(5,4,'Carro'),
(5,5,'Moto'),(5,6,'Moto'),(5,7,'Moto'),(5,8,'Carro');

---------------------------------------------------------
-- TARIFAS POR ZONA Y TIPO
---------------------------------------------------------
INSERT INTO tarifa (id_zona, tipo_vehiculo, valor_minuto) VALUES
(1, 'Carro', 120), (1, 'Moto', 80), (1, 'Camioneta', 150),
(2, 'Carro', 100), (2, 'Moto', 70), (2, 'Camioneta', 130),
(3, 'Carro', 90),  (3, 'Moto', 60),
(4, 'Carro', 200), (4, 'Moto', 100), (4, 'Camioneta', 250),
(5, 'Carro', 70),  (5, 'Moto', 50);

---------------------------------------------------------
-- REGISTROS DE PARQUEO (Simulados)
---------------------------------------------------------
INSERT INTO registro_parqueo (id_usuario, id_vehiculo, id_espacio, fecha_ingreso, estado) VALUES
(1, 1, 1, NOW() - INTERVAL '2 hours', 'ACTIVO'),
(2, 3, 10, NOW() - INTERVAL '1 hour', 'ACTIVO'),
(3, 4, 17, NOW() - INTERVAL '30 minutes', 'ACTIVO'),
(4, 5, 25, NOW() - INTERVAL '3 hours', 'ACTIVO'),
(5, 6, 30, NOW() - INTERVAL '20 minutes', 'ACTIVO');

---------------------------------------------------------
-- HISTORIAL DE CAMBIOS DE ESTADO
---------------------------------------------------------
INSERT INTO historial_estado_espacio (id_espacio, estado_anterior, estado_nuevo) VALUES
(1, 'LIBRE', 'OCUPADO'),
(10, 'LIBRE', 'OCUPADO'),
(17, 'LIBRE', 'OCUPADO'),
(25, 'LIBRE', 'OCUPADO'),
(30, 'LIBRE', 'OCUPADO');
