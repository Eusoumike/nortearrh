-- Tabela de classificações de ticket
CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text,
  color text NOT NULL DEFAULT '#0F7173',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ticket_categories_name_unique ON public.ticket_categories (lower(name));

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê classificações"
  ON public.ticket_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Cria classificações"
  ON public.ticket_categories FOR INSERT
  TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Atualiza classificações"
  ON public.ticket_categories FOR UPDATE
  TO authenticated
  USING (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Apaga classificações"
  ON public.ticket_categories FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_ticket_categories_updated_at
  BEFORE UPDATE ON public.ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();