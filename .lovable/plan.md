
Ajuste no plano: removo toda a parte de e-mail automático para Canais por enquanto. O resto da onda fica igual.

## O que muda no plano

**Removido:**
- Edge function `notify-canais`
- Disparo automático no submit do `NewTicketDialog` para `upgrade`/`downgrade`
- Necessidade de configurar domínio de e-mail (Lovable Emails)
- Campos `cnpj` e `current_plan` na tabela `clients` (eram só pro corpo do e-mail; entram quando reativarmos a automação)

**Mantido (P1 continua valendo):**
- Enum `ticket_type` com os 11 valores agrupados (Operacional / Escalonamento / Comercial)
- Campo obrigatório "Tipo de chamado" no `NewTicketDialog` com Select agrupado
- Coluna `ticket_type` em `tickets`
- Exibição do tipo no `TicketDetail`, no histórico do cliente (P3) e nas exportações (P7)

Quando você quiser religar o e-mail depois, é só pedir "reativa o disparo pra Canais" — adiciono a edge function, os 2 campos no cliente e o invoke no submit em uma migração curta.

## Ordem de execução atualizada

1. Migração SQL: enum `ticket_type`, enum `interaction_result`, colunas em `tickets` e `ticket_interactions`, habilitar `pg_cron` + `pg_net`
2. Edge function `check-sla-alerts` + agendamento a cada 15min (P5)
3. `NewTicketDialog` — campo "Tipo de chamado" obrigatório (P1, sem disparo de e-mail)
4. `TicketDetail` — form estruturado problema/solução (P2) + histórico do cliente (P3) + permitir editar tipo
5. `Tickets` — busca server-side debounced (P6)
6. `Dashboard` — KPI "Próximos do SLA" + lista de alertas (P5) + exportar CSV/PDF (P7)
7. Sino realtime no `TopBar` para alertas SLA (P5)

Resto do plano (estrutura dos campos de atendimento, layout, pontos de atenção sobre dados antigos com `ticket_type = NULL`) segue como combinado.
