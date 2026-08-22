-- ============================================================================
-- Cierra la puerta abierta en `comandas`.
--
-- Estado actual (comprobado contra produccion el 2026-08-22):
--   - Cualquiera en internet LEE todas las comandas: mesas, habitaciones,
--     articulos y totales, incluidas las ya cobradas.
--   - Cualquiera en internet ACTUALIZA: puede marcar mesas como pagadas.
--   - NADIE puede BORRAR, ni siquiera la dueña: hay RLS activo sin politica de
--     DELETE, asi que el borrado devuelve "exito" y afecta 0 filas.
--
-- Lo que de verdad hace falta:
--   - El huesped pide desde su habitacion SIN iniciar sesion (RestaurantMenu.tsx):
--     necesita INSERT, y SELECT de lo que tiene pendiente. Nunca actualiza nada.
--   - El POS y la dueña entran con sesion (ComandasPage.tsx): necesitan todo.
--
-- Ejecutar en Supabase -> SQL Editor. Es idempotente: se puede repetir.
-- ============================================================================

-- 1. Partir de cero con las politicas de esta tabla, sin depender de sus nombres.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'comandas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.comandas', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- 2. Permisos de tabla. Sin el GRANT, la politica no sirve de nada; sin la
--    politica, el GRANT tampoco. Hacen falta los dos.
REVOKE ALL ON public.comandas FROM anon;
GRANT SELECT, INSERT ON public.comandas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comandas TO authenticated;

-- 3. El huesped solo ve lo que aun esta pendiente. Deja de exponerse el
--    historico de consumos ya cobrados de toda la posada.
CREATE POLICY "Huesped lee comandas pendientes"
  ON public.comandas FOR SELECT TO anon
  USING (payment_status = 'pendiente');

-- 4. El huesped puede pedir, pero no puede fabricar un pedido que ya venga
--    marcado como servido o como pagado.
CREATE POLICY "Huesped crea su pedido"
  ON public.comandas FOR INSERT TO anon
  WITH CHECK (status = 'preparando' AND payment_status = 'pendiente');

-- 5. El personal con sesion iniciada maneja el resto: cambiar estados, cobrar
--    y borrar un pedido cargado por error.
CREATE POLICY "Personal lee comandas"
  ON public.comandas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Personal crea comandas"
  ON public.comandas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Personal actualiza comandas"
  ON public.comandas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Personal borra comandas"
  ON public.comandas FOR DELETE TO authenticated USING (true);

-- 6. Comprobacion. Deberian salir 6 politicas.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'comandas'
ORDER BY cmd, policyname;
