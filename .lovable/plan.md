## Fase 3 — Visualização e Base de Conhecimento

Escopo grande; proponho aplicar em blocos incrementais e **deixar item 7 (remoção física das colunas antigas) para depois de 1-2 semanas em produção**, como você mesmo pediu.

### 1. Constantes e helpers (base para tudo)
- Em `src/lib/constants.ts`: adicionar `MODULO_AFETADO_COLORS` (mapa `value → hex`) alinhado ao `MODULO_AFETADO_OPTIONS`.
- Novo componente `src/components/tickets/ModuloBadge.tsx` — badge colorido reaproveitável (listagem + kanban + dashboard).

### 2. Listagem de chamados (Tickets.tsx — vista Lista)
- Novas colunas visíveis: `#`, Tema, Cliente, **Módulo (badge colorido)**, Status, Aberto há, Ações.
- Botão "Mais colunas" (Popover com checkboxes, persistido em `localStorage`) para: Origem, Quem reportou, Canal, Prioridade, Solução (essa só renderiza para `resolvido/fechado`).
- Grid dinâmico conforme colunas ativas.

### 3. Filtros avançados
Barra de filtros acima do conteúdo (aplica tanto na lista quanto no kanban):
- Módulo (multi-select) → `.in("modulo_afetado", ...)`.
- Origem do problema (multi-select) → `.in("origem_problema", ...)`.
- Tema (busca com autocomplete em `ticket_temas_frequentes`) → `.in("tema", ...)`.
- Quem reportou (multi-select) e Prioridade (já existe como single — vira multi).
- Chips removíveis + botão "Limpar filtros" quando algum ativo. Estado sincronizado com `searchParams` para deep-link.

### 4. Kanban — card com módulo
- Em `TicketKanban.tsx`, no `TicketCard`: adicionar `<ModuloBadge>` compacto no topo (mesma linha do `#numero`), quando `t.modulo_afetado` existir.
- Incluir `modulo_afetado` no `select` da query do kanban (Tickets.tsx).

### 5. Dashboard — 3 novos insights
Em `src/pages/Dashboard.tsx`, nova seção "Insights de Chamados":
- **Chamados por módulo (7 dias)** — barras horizontais (recharts, se já disponível; fallback CSS bars).
- **Origem dos problemas (30 dias)** — donut (recharts PieChart).
- **Temas em alta** — lista dos 5 temas com maior crescimento (últimos 7 vs 7 anteriores), com seta ↑ e delta.

Queries feitas via `supabase.from("tickets").select("modulo_afetado, origem_problema, tema, created_at")` filtrando pelo período e agregando no cliente (evita RPC nova e mantém RLS existente).

### 6. Página /assist — Base de Conhecimento
Nova rota (registrar em `src/App.tsx`) e página `src/pages/Assist.tsx`:
- Tabela de `assist_artigos` com colunas: Título, Módulo (badge), Tema, Status (rascunho/publicado), 👁 Visualizações, 👍/👎.
- Filtros: status (todos / rascunhos / publicados), módulo.
- Botão "Revisar rascunhos" no header — atalho para filtro `publicado=false`.
- Ações por linha: Editar, Publicar/Despublicar, Excluir (com AlertDialog).
- Modal `EditarArtigoAssistDialog` (novo): título, problema relatado, causa raiz (select ORIGEM_PROBLEMA), passos_solucao (textarea grande), módulo, tags (input com chips), botões `Salvar rascunho` e `Publicar` (define `publicado=true`).
- Link no `AppSidebar` para `/assist`.

### 7. Sugestões inline ao criar chamado
- Em `NewTicketDialog.tsx` (e `NewTicket.tsx`), depois do tema+módulo:
  - `useQuery(['assist-sugestoes', tema, modulo])` buscando `assist_artigos` publicados por `tema_relacionado` (fallback `modulo_afetado`), ordenados por `util_positivo`, limite 3.
  - Card "Sugestões da base de conhecimento" com lista clicável abrindo `/assist?artigo=<id>` em nova aba (drawer de leitura na página Assist).

### 8. Item 7 do briefing — remoção física das colunas antigas
**Não vou executar agora.** Deixo pronto um arquivo `docs/migracao-fase3-remocao-campos-antigos.sql` com backup + `ALTER TABLE DROP COLUMN` para você rodar depois via migration quando confirmar que nada quebrou em produção.

### O que fica fora deste plano
- Fluxo público de leitura de artigo (`/assist/:id`) — se quiser, faço numa próxima rodada; por ora o modal de edição serve para revisar conteúdo.
- Markdown rendering avançado nos passos: uso textarea + `whitespace-pre-wrap` (sem lib nova).
- Alteração no schema `assist_artigos` — já tem tudo que precisa (verificado nos types).

### Arquivos criados
- `src/components/tickets/ModuloBadge.tsx`
- `src/components/tickets/AssistSugestoes.tsx`
- `src/components/assist/EditarArtigoAssistDialog.tsx`
- `src/pages/Assist.tsx`
- `docs/migracao-fase3-remocao-campos-antigos.sql`

### Arquivos alterados
- `src/lib/constants.ts` (cores por módulo)
- `src/pages/Tickets.tsx` (colunas, filtros, kanban tem `modulo_afetado`)
- `src/components/TicketKanban.tsx` (badge no card)
- `src/pages/Dashboard.tsx` (nova seção Insights)
- `src/components/NewTicketDialog.tsx` e `src/pages/NewTicket.tsx` (sugestões inline)
- `src/App.tsx` (rota `/assist`)
- `src/components/AppSidebar.tsx` (link menu)

Confirma que posso executar assim? Se quiser cortar algum bloco (ex.: pular sugestões inline ou a página /assist nesta rodada), me diz antes de eu começar.
