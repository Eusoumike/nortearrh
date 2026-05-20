# Redesign Nortear Connect — Plano de Execução

Este é um redesign muito amplo (15 áreas, dezenas de páginas/componentes). Para entregar com qualidade sem quebrar funcionalidades, vou executar em **6 fases sequenciais**, validando cada uma antes de seguir.

## Fase 1 — Fundação (base global)
- Criar `src/components/ui/empty-state.tsx` (EmptyState reutilizável).
- Criar `src/components/ui/page-header.tsx` (header padronizado: título + subtítulo + ações).
- Adicionar tokens/utilitários em `index.css` para card hover, labels uppercase, border-left priority.
- Documentar padrões de tipografia/espaçamento (já refletidos via Tailwind classes existentes).

## Fase 2 — Shell (Sidebar + TopBar + Mobile Nav)
- `AppSidebar.tsx`: reorganizar em grupos **Início / Vendas / Operação / Gestão**, rodapé com Configurações + Sair, CRM expansível com sub-itens, avatar+role no header, estilo de labels/ítens conforme spec.
- `TopBar.tsx`: breadcrumb dinâmico (via `useLocation` + map de rotas), busca global ⌘K (placeholder funcional), sino consolidado, avatar dropdown.
- Mobile bottom nav: 5 itens (Início/Chamados/Clientes/CRM/Mais) + sheet.

## Fase 3 — Dashboard + Listas core
- **Dashboard**: 3 zonas (KPIs clicáveis → módulos, Atenção imediata 2 colunas, Gráficos com títulos claros). Remover bloco SLA detalhado (manter link para `/sla-dashboard`).
- **Chamados** (`/chamados` + kanban): header, chips de filtro sempre visíveis, card com border-left por prioridade, badge Assist.
- **Clientes** (`/clientes`): header, chips de produto, card com border-left por status_nortear.
- **Tarefas / Implantação**: headers + filtros + cards no novo padrão.

## Fase 4 — Detalhes (TicketDetail + ClientDetail)
- `TicketDetail.tsx`: layout 3 colunas (35/40/25) — info + timeline + metadados.
- `ClientDetail.tsx`: 4 tabs (Visão Geral 2 colunas / Chamados / Financeiro / Onboarding).

## Fase 5 — CRM + Financeiro + Performance + Configurações
- CRM Pipeline/Detail/Atividades/Analytics: refinar headers, filtros, cards conforme spec.
- Financeiro: tabs com ícones + header por aba.
- Performance: header + tabs com ícones.
- Settings: já tem sidebar interna — ajustar grupos conforme nova lista (Perfil/Equipe/Suporte/Onboarding/Financeiro/Integrações/Assist/Sistema).

## Fase 6 — Estados vazios + Notificações
- Aplicar `<EmptyState>` em todas listas/kanbans vazios.
- `NotificationDropdown` unificado com agrupamento por categoria e badge por tipo.

## Considerações técnicas
- **Sem mudanças de schema** — apenas UI/UX.
- **Sem mudanças de lógica de negócio** — preservar queries, mutations, RLS.
- Reusar `semantic tokens` do design system (`bg-card`, `text-muted-foreground`, `border-border`, `text-sidebar-*`). Nenhuma cor hardcoded.
- Cada fase será um commit conceitual; entre elas, posso parar para você revisar.

## Estimativa
~25–40 arquivos editados/criados no total. Cada fase = 1 turn de implementação focado.

---

**Quero confirmar antes de começar:**

1. Posso seguir as 6 fases **em sequência** sem perguntar entre elas, ou prefere revisar fase por fase?
2. O **sino de notificações consolidado** (item 15) deve agrupar dados que já existem hoje (SLA + CRM activities) — devo criar tipos de notificação novos no banco ou apenas consolidar visualmente o que já existe? Recomendo **apenas consolidar visualmente** (sem schema novo).
3. A **busca global ⌘K** deve ser funcional já agora (buscar em chamados/clientes/deals) ou só visual nesta rodada?