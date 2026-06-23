# Etapas do Chamado

Transformar cada chamado num fluxo estruturado de etapas (sub-tarefas), com responsável, datas, status, timeline visual e progresso. Distinto das etapas globais do ticket (novo → em atendimento → resolvido) e das "tasks" já existentes — estas são **etapas de execução por chamado**, ordenáveis e versionadas no histórico.

## Antes de começar — 2 decisões rápidas

1. **Já existe `tasks` (sub-tarefas do ticket) e `custom_ticket_stages` (etapas customizadas globais).** Posso:
   - **(a) Criar nova tabela `ticket_etapas`** dedicada ao conceito de "Etapas do Chamado" (recomendado — mantém semântica limpa, drag-and-drop, status próprio, sem misturar com tasks operacionais).
   - **(b) Estender `tasks`** adicionando `ordem`, `data_inicio`, `data_conclusao`, `status_etapa` — reaproveita UI/histórico, mas mistura conceitos.
   
   **Recomendo (a).** Confirma?

2. **Notificações:** in-app (badge/toast no sino) ou também e-mail? Por padrão faço **só in-app** nesta primeira versão (e-mail exige template + edge function dedicada).

---

## Escopo

### Banco (migração)
- Tabela `ticket_etapas`:
  - `ticket_id` (FK tickets, cascade)
  - `nome`, `descricao`
  - `responsavel_id` (FK profiles, nullable)
  - `data_inicio`, `data_conclusao` (timestamptz, nullable)
  - `prazo` (timestamptz, nullable — usado para alerta de proximidade)
  - `status` enum `etapa_status`: `pendente | em_andamento | concluida`
  - `ordem` (int, para drag-and-drop)
  - `created_by`, timestamps
- Tabela `ticket_etapa_historico`: registra criação/edição/conclusão/exclusão (`acao`, `etapa_id`, `ticket_id`, `user_id`, `payload jsonb`, `created_at`).
- Tabela `notificacoes` (se ainda não existir uma genérica) ou reuso de mecanismo atual — vou checar antes de criar.
- GRANTs + RLS:
  - Leitura: qualquer usuário staff que pode ver o ticket.
  - Insert/Update/Delete: `admin`/`manager` livres; `agent` só pode atualizar etapa onde `responsavel_id = auth.uid()`.
- Trigger: ao mudar `status` para `em_andamento` preencher `data_inicio` se vazio; para `concluida` preencher `data_conclusao`; gravar histórico automaticamente.

### Backend / lógica
- View ou coluna gerada: progresso = `count(concluidas)/count(total)` (calculado no client por simplicidade).
- Realtime opcional na tabela `ticket_etapas` (postgres_changes) para refletir mudanças entre abas.

### Frontend
- Novo componente `src/components/tickets/TicketEtapas.tsx`:
  - Lista/timeline com cores por status (cinza = pendente, azul = em andamento, verde = concluída).
  - Barra de progresso no topo (% concluído).
  - Botão "Adicionar etapa" → dialog com formulário (nome, descrição, responsável combobox, datas, prazo, status).
  - Editar inline (popover) e excluir (confirm).
  - **Drag-and-drop** com `@dnd-kit/sortable` (já costuma estar instalado; senão instalo).
  - Badge "Etapa atual" na primeira `em_andamento`; "Próximas" nas `pendente`.
- Integração:
  - `TicketDetail.tsx`: nova seção "Etapas do Chamado" acima/junto a Tasks.
  - `NewTicketDialog`/`NewTicket.tsx`: seção opcional "Etapas iniciais" (lista simples, sem drag — etapas são criadas após salvar o ticket).
- Histórico:
  - Aba/seção "Histórico de etapas" dentro do ticket exibindo `ticket_etapa_historico` com usuário + timestamp em horário de Brasília.

### Notificações (in-app)
- Ao atribuir responsável: insert em `notificacoes` para o `responsavel_id`.
- Ao concluir etapa: notifica criador do ticket e responsável anterior.
- Ao aproximar do prazo (≤ 24h): edge function cron diária `etapas-prazo-alerta` (reaproveita o padrão de `check-sla-alerts`).

### Permissões (UI)
- Botões Adicionar/Excluir só aparecem para `admin`/`manager`.
- `agent` enxerga tudo, mas só pode editar status/datas da etapa onde é responsável.
- `viewer` somente leitura.

## Detalhes técnicos

- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable`. Persistência: ao soltar, faz `update` em lote dos campos `ordem` das etapas afetadas.
- Status enum no Postgres: `CREATE TYPE etapa_status AS ENUM (...)`.
- RLS para `agent`: policy `UPDATE` com `USING (responsavel_id = auth.uid()) WITH CHECK (responsavel_id = auth.uid())`.
- Histórico via trigger `AFTER INSERT/UPDATE/DELETE` em `ticket_etapas`, gravando `auth.uid()` e diff em `payload jsonb`.
- Realtime: `supabase.channel('ticket-etapas-<ticket_id>').on('postgres_changes', ...)`.
- SEO/UI: respeitar tokens semânticos do `index.css` (sem cores hardcoded).

## Entregáveis
1. Migração `ticket_etapas` + `ticket_etapa_historico` + enum + triggers + RLS + GRANTs.
2. `src/components/tickets/TicketEtapas.tsx` (lista + dialog + dnd).
3. `src/components/tickets/TicketEtapaHistorico.tsx`.
4. Integração em `TicketDetail.tsx`.
5. (Opcional v2) Edge function `etapas-prazo-alerta` para alertas de prazo.

## Fora de escopo desta versão
- Templates de etapas reutilizáveis por tipo de chamado (posso fazer depois — já existe padrão em `implantacao_templates`).
- Dependências entre etapas (etapa B só inicia se A concluída).
- Notificações por e-mail (fica para v2 se quiser).

---

**Responde:**  
- (1) tabela nova (a) ou estender `tasks` (b)?  
- (2) notificações só in-app, ou também por e-mail?  
- (3) algo mais a incluir/remover antes de eu construir?
