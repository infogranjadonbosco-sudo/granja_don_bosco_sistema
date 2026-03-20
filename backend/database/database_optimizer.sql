-- ==========================================
-- SCRIPT DE OPTIMIZACIÓN Y AJUSTES FINALES
-- Uso: Ejecutar para añadir columnas faltantes
-- ==========================================

-- Añadir soporte para URLs de imágenes en productos si no existen
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ajustar el tipo de dato y valor por defecto para unidad_medida
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS unidad_medida TEXT DEFAULT 'Unidades';

-- Limpiar espacios en blanco en nombres de categorías existentes
UPDATE products SET category = TRIM(category) WHERE category IS NOT NULL;

-- Asegurar que todos los productos tengan una unidad asignada
UPDATE products SET unidad_medida = 'Unid.' WHERE unidad_medida IS NULL OR unidad_medida = '';

-- Verificación de columnas (Comando de control)
SELECT id, name, category, stock, unidad_medida FROM products LIMIT 5;
