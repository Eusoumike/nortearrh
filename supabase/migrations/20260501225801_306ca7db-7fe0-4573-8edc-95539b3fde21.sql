-- Recreate function to mark first response on tickets when an interaction is added
CREATE OR REPLACE FUNCTION public.handle_first_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type IN ('ligacao','whatsapp','reuniao','remoto','email','anotacao') THEN
    UPDATE public.tickets
    SET first_response_at = NOW()
    WHERE id = NEW.ticket_id
      AND first_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- (Re)create trigger on ticket_interactions
DROP TRIGGER IF EXISTS on_first_response ON public.ticket_interactions;
CREATE TRIGGER on_first_response
  AFTER INSERT ON public.ticket_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_response();

-- Backfill historical data
UPDATE public.tickets t
SET first_response_at = sub.min_created
FROM (
  SELECT ticket_id, MIN(created_at) AS min_created
  FROM public.ticket_interactions
  GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id
  AND t.first_response_at IS NULL;