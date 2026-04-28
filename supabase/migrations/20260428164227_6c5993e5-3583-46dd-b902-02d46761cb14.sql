-- Add explicit RLS policies for the private 'portalnortear' storage bucket.
-- Internal team (admin/manager/agent) can read/write; viewers and anon are denied.

CREATE POLICY "Equipe interna lê arquivos do portalnortear"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'portalnortear'
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Equipe interna envia arquivos para o portalnortear"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portalnortear'
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Equipe interna atualiza arquivos do portalnortear"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portalnortear'
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
)
WITH CHECK (
  bucket_id = 'portalnortear'
  AND NOT public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Admin/manager apagam arquivos do portalnortear"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portalnortear'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);