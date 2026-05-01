-- Agenda fechamento automático de chamados em "aguardando_cliente" a cada 30 minutos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-waiting-tickets-30min') THEN
    PERFORM cron.unschedule('auto-close-waiting-tickets-30min');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-close-waiting-tickets-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bxibhzanfscdrkbkvulp.supabase.co/functions/v1/auto-close-waiting-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aWJoemFuZnNjZHJrYmt2dWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDA1NzMsImV4cCI6MjA5MjAxNjU3M30.PY8s3KOOYMG8DceSCYgEXC-iQTFqLwEneLu_gUevMEE'
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);
