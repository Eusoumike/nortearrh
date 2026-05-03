DROP TRIGGER IF EXISTS on_first_response ON public.ticket_interactions;

CREATE TRIGGER on_first_response
  AFTER INSERT ON public.ticket_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_response();

UPDATE public.tickets t
SET first_response_at = sub.first_at
FROM (
  SELECT ticket_id, MIN(created_at) AS first_at
  FROM public.ticket_interactions
  WHERE type IN ('ligacao','whatsapp','reuniao','email','nota')
  GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id
  AND t.first_response_at IS NULL;