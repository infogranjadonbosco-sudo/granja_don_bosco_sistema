-- ==========================================================
-- REPARACIÓN INTEGRAL DEL ESQUEMA (Sincronización con Código)
-- ==========================================================

-- 1. REPARAR TABLA DE PRODUCTOS
DO $$ 
BEGIN
    -- Imagen del producto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url') THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
    END IF;

    -- Unidad de medida
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unidad_medida') THEN
        ALTER TABLE products ADD COLUMN unidad_medida TEXT DEFAULT 'Unidad';
    END IF;
END $$;

-- 2. REPARAR TABLA DE USUARIOS (Permisos avanzados)
DO $$ 
BEGIN
    -- Permiso para eliminar
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'puede_eliminar') THEN
        ALTER TABLE usuarios ADD COLUMN puede_eliminar BOOLEAN DEFAULT FALSE;
    END IF;

    -- Permiso para agregar productos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'puede_agregar') THEN
        ALTER TABLE usuarios ADD COLUMN puede_agregar BOOLEAN DEFAULT FALSE;
    END IF;

    -- Permiso para gestionar inventario/stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'puede_inventario') THEN
        ALTER TABLE usuarios ADD COLUMN puede_inventario BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. ASEGURAR BUCKETS DE STORAGE
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true) 
ON CONFLICT (id) DO NOTHING;

-- 4. POLÍTICAS DE SEGURIDAD PARA STORAGE
-- Permitir ver fotos de productos a todos
CREATE POLICY "Acceso público productos" ON storage.objects FOR SELECT USING (bucket_id = 'products');

-- Permitir a admins y usuarios con permiso subir fotos de productos
CREATE POLICY "Subida de productos autorizada" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'products' AND (
        (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin' OR
        (SELECT puede_agregar FROM public.usuarios WHERE id = auth.uid()) = true
    )
);

-- 5. PARA REFRESCAR CACHÉ DE POSTGREST
NOTIFY pgrst, 'reload schema';
