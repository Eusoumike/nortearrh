-- Limpa dados órfãos antes de criar FKs (evita falha)
UPDATE public.tasks SET ticket_id = NULL
  WHERE ticket_id IS NOT NULL AND ticket_id NOT IN (SELECT id FROM public.tickets);
UPDATE public.tasks SET client_id = NULL
  WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);
UPDATE public.tickets SET client_id = NULL
  WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);
UPDATE public.lancamentos_vr SET client_id = NULL
  WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);
UPDATE public.lancamentos_ponto SET client_id = NULL
  WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);

DELETE FROM public.ticket_interactions
  WHERE ticket_id NOT IN (SELECT id FROM public.tickets);
DELETE FROM public.implantacao_eventos
  WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
DELETE FROM public.implantacao_pendencias
  WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
DELETE FROM public.checklist_items
  WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
DELETE FROM public.parcelas_rh_digital
  WHERE contrato_id NOT IN (SELECT id FROM public.contratos_rh_digital);
DELETE FROM public.repasses_parceiro
  WHERE parceiro_id NOT IN (SELECT id FROM public.parceiros);

-- Helper: criar FK só se não existir
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('ticket_interactions', 'fk_interactions_ticket', 'ticket_id', 'tickets', 'CASCADE'),
      ('tasks',               'fk_tasks_ticket',        'ticket_id', 'tickets', 'CASCADE'),
      ('tasks',               'fk_tasks_client',        'client_id', 'clients', 'SET NULL'),
      ('tickets',             'fk_tickets_client',      'client_id', 'clients', 'SET NULL'),
      ('implantacao_eventos', 'fk_eventos_implantacao', 'implantacao_id', 'implantacoes', 'CASCADE'),
      ('implantacao_pendencias','fk_pendencias_implantacao','implantacao_id','implantacoes','CASCADE'),
      ('checklist_items',     'fk_checklist_implantacao','implantacao_id','implantacoes','CASCADE'),
      ('parcelas_rh_digital', 'fk_parcelas_contrato',   'contrato_id','contratos_rh_digital','CASCADE'),
      ('lancamentos_vr',      'fk_lancamentos_vr_client','client_id','clients','SET NULL'),
      ('lancamentos_ponto',   'fk_lancamentos_ponto_client','client_id','clients','SET NULL'),
      ('repasses_parceiro',   'fk_repasses_parceiro',   'parceiro_id','parceiros','CASCADE')
    ) AS t(tbl, conname, col, ref_tbl, on_delete)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname = 'public' AND cl.relname = fk.tbl AND c.conname = fk.conname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE %s',
        fk.tbl, fk.conname, fk.col, fk.ref_tbl, fk.on_delete
      );
    END IF;
  END LOOP;
END $$;

-- Índices nas colunas de FK e mais consultadas
CREATE INDEX IF NOT EXISTS idx_ticket_interactions_ticket_id ON public.ticket_interactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_id ON public.tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_opened_at ON public.tickets(opened_at);
CREATE INDEX IF NOT EXISTS idx_implantacao_eventos_implantacao_id ON public.implantacao_eventos(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_implantacao_pendencias_implantacao_id ON public.implantacao_pendencias(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_implantacao_id ON public.checklist_items(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_rh_contrato_id ON public.parcelas_rh_digital(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_rh_competencia ON public.parcelas_rh_digital(competencia);
CREATE INDEX IF NOT EXISTS idx_parcelas_rh_status ON public.parcelas_rh_digital(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_vr_client_id ON public.lancamentos_vr(client_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_vr_competencia ON public.lancamentos_vr(competencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_ponto_client_id ON public.lancamentos_ponto(client_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_ponto_competencia ON public.lancamentos_ponto(competencia);
CREATE INDEX IF NOT EXISTS idx_repasses_parceiro_parceiro_id ON public.repasses_parceiro(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_repasses_parceiro_client_id ON public.repasses_parceiro(client_id);
CREATE INDEX IF NOT EXISTS idx_repasses_parceiro_competencia ON public.repasses_parceiro(competencia);
CREATE INDEX IF NOT EXISTS idx_contratos_rh_client_id ON public.contratos_rh_digital(client_id);
CREATE INDEX IF NOT EXISTS idx_implantacoes_client_id ON public.implantacoes(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_account_owner ON public.clients(account_owner);