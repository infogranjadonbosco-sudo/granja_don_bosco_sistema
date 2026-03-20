-- ==========================================
-- CONFIGURACIÓN DE TABLA DE SISTEMA
-- Autores: Rodrigo y Melvin
-- ==========================================

-- Crear tabla para configuraciones dinámicas
CREATE TABLE IF NOT EXISTS configuracion (
  id TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Habilitar seguridad de filas (RLS)
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Definición de Políticas de Acceso
-- 1. Permitir que cualquiera pueda leer la configuración
DROP POLICY IF EXISTS "Lectura pública de config" ON configuracion;
CREATE POLICY "Lectura pública de config" ON configuracion 
FOR SELECT USING (true);

-- 2. Solo administradores pueden modificar valores
DROP POLICY IF EXISTS "Admins modifican config" ON configuracion;
CREATE POLICY "Admins modifican config" ON configuracion 
FOR ALL USING (
  (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
);
 
