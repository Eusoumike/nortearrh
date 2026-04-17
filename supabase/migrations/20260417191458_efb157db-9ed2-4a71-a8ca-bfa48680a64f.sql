ALTER TYPE public.ticket_status RENAME VALUE 'aberto' TO 'novo';
ALTER TYPE public.ticket_status RENAME VALUE 'em_andamento' TO 'em_atendimento';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'suporte_vera_n1';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'abertura_chamado_n2';
ALTER TABLE public.tickets ALTER COLUMN status SET DEFAULT 'novo'::ticket_status;