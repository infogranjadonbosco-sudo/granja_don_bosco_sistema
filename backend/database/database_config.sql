Success. No rows returned



CREATE TABLE IF NOT EXISTS configuracion (
  id TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracion' AND policyname = 'Lectura pública de config') THEN
        CREATE POLICY "Lectura pública de config" ON configuracion FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracion' AND policyname = 'Admins modifican config') THEN
        CREATE POLICY "Admins modifican config" ON configuracion FOR ALL USING (
          (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'admin'
        );
    END IF;
END $$;
