
-- Fix privilege escalation: replace NOT has_role(...,'viewer') with positive is_staff check
DROP POLICY IF EXISTS "Cria tickets" ON public.tickets;
CREATE POLICY "Cria tickets" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Atualiza tickets" ON public.tickets;
CREATE POLICY "Atualiza tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe interna lê arquivos do portalnortear" ON storage.objects;
CREATE POLICY "Equipe interna lê arquivos do portalnortear" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portalnortear' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe interna envia arquivos para o portalnortear" ON storage.objects;
CREATE POLICY "Equipe interna envia arquivos para o portalnortear" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portalnortear' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe interna atualiza arquivos do portalnortear" ON storage.objects;
CREATE POLICY "Equipe interna atualiza arquivos do portalnortear" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'portalnortear' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'portalnortear' AND public.is_staff(auth.uid()));

-- Revoke execute on SECURITY DEFINER trigger helpers from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_deal_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_cnpj_from_client() FROM PUBLIC, anon, authenticated;
