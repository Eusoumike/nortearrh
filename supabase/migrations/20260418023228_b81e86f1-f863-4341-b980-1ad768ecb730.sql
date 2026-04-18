-- Converter ticket_number de integer (auto-increment) para text livre
ALTER TABLE public.tickets ALTER COLUMN ticket_number DROP DEFAULT;
ALTER TABLE public.tickets ALTER COLUMN ticket_number TYPE text USING ticket_number::text;

-- Garantir unicidade
CREATE UNIQUE INDEX IF NOT EXISTS tickets_ticket_number_unique ON public.tickets (ticket_number);

-- Função para gerar próximo número padrão (numérico sequencial) quando não informado
CREATE OR REPLACE FUNCTION public.set_default_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.ticket_number IS NULL OR trim(NEW.ticket_number) = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_number, '\D', '', 'g'), '')::INTEGER), 0) + 1
      INTO next_num
      FROM public.tickets
      WHERE ticket_number ~ '^\d+$';
    NEW.ticket_number := next_num::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_ticket_number ON public.tickets;
CREATE TRIGGER trg_set_default_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_ticket_number();