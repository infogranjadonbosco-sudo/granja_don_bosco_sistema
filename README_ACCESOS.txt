🔐 GUÍA DE ACCESO Y CONFIGURACIÓN - GRANJA DON BOSCO v2.0

Este documento contiene la información necesaria para la revisión y el despliegue local del sistema.

=== ⚠️ NOTA DE SEGURIDAD PARA EL EVALUADOR ===
Este archivo ha sido incluido temporalmente con el único propósito de facilitar la revisión técnica del funcionamiento del proyecto. Se reconoce y manifiesta que, en un entorno de producción real, este tipo de información sensible (credenciales y accesos) debe ser gestionada siguiendo los estándares internacionales de ciberseguridad, mediante el uso de bóvedas de secretos (Secrets Vaults) o variables de entorno cifradas. Por motivos exclusivamente académicos y de revisión funcional, se proporcionan los siguientes accesos de prueba:

=== 🛠️ CONFIGURACIÓN TÉCNICA (LOCAL) ===
Para que la aplicación funcione correctamente en su computadora local (después de 'npm install'), debe renombrar el archivo '.env.example' a '.env' o crear uno nuevo con las siguientes claves:

VITE_SUPABASE_URL=[URL DE TU PROYECTO SUPABASE]
VITE_SUPABASE_ANON_KEY=[TU CLAVE ANON DE SUPABASE]

Nota: El despliegue oficial en Netlify ya cuenta con estas variables configuradas internamente.

=== 👤 CUENTAS DE USUARIO PARA PRUEBAS ===

-- ADMINISTRADORES (Acceso Total: Tienda, Dashboard, Base de Datos) --
1. Jose Ramirez
   - Email: jose.ramirez@granjadonbosco.com
   - Clave: Jramirez.2026.GDB!

2. Ricardo Alas
   - Email: ricardo.alas@granjadonbosco.com
   - Clave: RAlas.2026.GDB!

3. Roberto Medina
   - Email: roberto.medina@granjadonbosco.com
   - Clave: RMedina.2026.GDB!


-- PERSONAL / COLABORADORES (Acceso Limitado: Tienda, Jornada, Anuncios) --
1. Diego Lopez
   - Email: diego.lopez@granjadonbosco.com
   - Clave: DLopez.2026.GDB!

2. Elena Sanchez
   - Email: elena.sanchez@granjadonbosco.com
   - Clave: ESanchez.2026.GDB!


=== 📦 CATEGORÍAS DEL SISTEMA ===
El sistema organiza los productos automáticamente en las siguientes categorías maestras:
1. LÁCTEOS Y DERIVADOS
2. PRODUCTOS CÁRNICOS
3. AVES Y DERIVADOS (Pollo, Huevos, etc.)
4. PRODUCTOS PECUARIOS (Animales vivos)
5. ALIMENTOS Y CONCENTRADOS
6. MEDICINA Y VETERINARIA
7. OTROS (Suministros varios)

--------------------------------------------------
Proyecto desarrollado para Fines Académicos y Profesionales.
Autores: Melvin Omar Lopez / Rodrigo Ariel Lopez
--------------------------------------------------
