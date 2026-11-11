-- ============================================================
-- PART13_parttimer_visibility.sql
--
-- A project another part-timer has claimed is not yours to look at, and not
-- yours to download from. Until now every part-timer could read every order,
-- every file row and every stored object.
--
-- Run this in the Supabase SQL editor (same as the other PART files). Only
-- SELECT policies are replaced, so clients (their own orders and files) and
-- admins keep the access they already had.
-- ============================================================

-- 1. Orders: a part-timer sees unclaimed work and their own claimed work only.
DROP POLICY IF EXISTS "Clients see own orders" ON public.orders;
CREATE POLICY "Clients see own orders" ON public.orders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    (
      public.has_role(auth.uid(), 'parttimer') AND
      (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

-- 2. File rows follow the order they belong to.
DROP POLICY IF EXISTS "View order files" ON public.order_files;
CREATE POLICY "View order files" ON public.order_files FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()) OR
    (
      public.has_role(auth.uid(), 'parttimer') AND
      order_id IN (
        SELECT id FROM public.orders
        WHERE assigned_to IS NULL OR assigned_to = auth.uid()
      )
    )
  );

-- 3. The stored objects themselves. Paths are <client id>/<order id>/<file>, so
--    the second folder is the order the object belongs to. Input files stay
--    readable while a project is unclaimed — that is the brief you quote from.
DROP POLICY IF EXISTS "Users view own input files" ON storage.objects;
CREATE POLICY "Users view own input files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'input-files' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      public.has_role(auth.uid(), 'admin') OR
      (
        public.has_role(auth.uid(), 'parttimer') AND
        (storage.foldername(name))[2] IN (
          SELECT id::text FROM public.orders
          WHERE assigned_to IS NULL OR assigned_to = auth.uid()
        )
      )
    )
  );

-- 4. Delivered files: the part-timer on the project, the client who owns it,
--    and admins. Nobody else.
DROP POLICY IF EXISTS "View output files" ON storage.objects;
CREATE POLICY "View output files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'output-files' AND (
      public.has_role(auth.uid(), 'admin') OR
      auth.uid()::text = (storage.foldername(name))[1] OR
      (
        public.has_role(auth.uid(), 'parttimer') AND
        (storage.foldername(name))[2] IN (
          SELECT id::text FROM public.orders WHERE assigned_to = auth.uid()
        )
      )
    )
  );
