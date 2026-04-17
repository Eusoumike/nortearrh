

## Plano — Nova régua de status com SLA por etapa + Kanban

### 🎯 Nova régua (6 status)

```text
Novo → Em atendimento → Aguardando cliente → Suporte Vera N1 → Abertura chamado N2 → Resolvido
```

**Mapeamento dos dados atuais (28 tickets)**:
- `aberto` (9) → `novo`
- `em_andamento` (11) → `em_atendimento`
- `aguardando_cliente` (5) → `aguardando_cliente`
- `resolvido` (3) → `resolvido`
- `fechado` (2) → mantém `fechado` no banco mas a UI trata como Resolvido (sinônimo)

### 🗄️ Migração SQL

**Renomear enum** (preserva dados):
```sql
ALTER TYPE ticket_status RENAME VALUE 'aberto' TO 'novo';
ALTER TYPE ticket_status RENAME VALUE 'em_andamento' TO 'em_atendimento';
ALTER TYPE ticket_status ADD VALUE 'suporte_vera_n1';
ALTER TYPE ticket_status ADD VALUE 'abertura_chamado_n2';
-- 'fechado' permanece (sinônimo oculto de resolvido)
```

**9 campos novos em `tickets`** (4 etapas com timer × 2 + status_changed_at já existe):
- `entered_em_atendimento_at timestamptz`
- `total_em_atendimento_seconds integer default 0`
- `entered_aguardando_cliente_at timestamptz`
- `total_aguardando_cliente_seconds integer default 0`
- `entered_vera_n1_at timestamptz`
- `total_vera_n1_seconds integer default 0`
- `entered_n2_at timestamptz`
- `total_n2_seconds integer default 0`
- `current_stage_started_at timestamptz default now()` (timer da etapa atual, qualquer que seja)

**Trigger atualizado** `handle_ticket_status_change`: ao mudar de status, fecha o acumulador da etapa que estava ativa (delta = `now() - entered_<X>_at`) e abre o `entered_<próxima>_at`. O `total_active_seconds` legado fica intocado para não quebrar.

### 🎨 Frontend

**1. `src/lib/constants.ts`** — atualizar `STATUS_LABEL`/`STATUS_TONE` com 6 entradas. `fechado` mapeia pra "Resolvido" e cor success. Adicionar `STATUS_FLOW` (array ordenado) para o kanban e setas de avanço. Novo `SLA_PER_STAGE_HOURS` (alvo por etapa, configurável).

**2. `src/pages/TicketDetail.tsx`** — layout novo:
```text
┌──────────────────────────────────────────────────────────┐
│ #123 · Título do chamado · [Status] [Prioridade] [Tipo] │
├──────────────────────┬──────────────────────────────────┤
│ COL ESQUERDA         │ COL DIREITA                       │
│ Cliente (nome,       │ Status atual + botões fluxo:     │
│  empresa, email,     │   ◀ voltar | avançar ▶            │
│  telefone)           │                                   │
│ Histórico cliente    │ Timers por etapa (4 cards):       │
│                      │   • Em atendimento  02h 15m       │
│ Descrição do chamado │   • Aguardando cli. 00h 00m       │
│                      │   • Vera N1         00h 00m       │
│ Atendimentos (tabs)  │   • N2              00h 00m       │
│                      │ Datas: criado/atualizado/resolvido│
└──────────────────────┴──────────────────────────────────┘
```
- Timers calculados client-side: `total_<x>_seconds + (status atual === x ? now - current_stage_started_at : 0)`, atualizado a cada 30s.
- Botões fluxo: "Voltar" e "Avançar" seguem `STATUS_FLOW`. Atalhos: "Marcar como Resolvido", "Encaminhar para Vera N1", "Abrir chamado N2".
- **Híbrido auto**: ao registrar atendimento com `result = 'resolvido'`, dispara mutation que muda status para `resolvido` (toast confirmando).

**3. Kanban — nova rota `/tickets/kanban`** (toggle Tabela/Kanban em `/tickets`):
- Componente `TicketKanban.tsx` com 6 colunas (`fechado` agrupado em Resolvido).
- Drag & drop usando `@dnd-kit/core` + `@dnd-kit/sortable` (já consolidado).
- Cada card: #número, título truncado, cliente, prioridade, tempo na etapa atual.
- Soltar em outra coluna → mutation `updateStatus`.
- Header `/tickets`: toggle `<TabsList>` Tabela | Kanban (preserva filtros de status/prioridade/busca).

**4. `src/pages/Dashboard.tsx`** — 4 cards novos de tempo médio por etapa (em horas), substituindo o card "Resposta média":
```text
Tempo médio em Em atendimento  |  Aguardando cliente
Tempo médio em Vera N1         |  Abertura N2
```
Cálculo: média de `total_<x>_seconds` apenas em tickets que passaram por aquela etapa.

**5. Outros toques**:
- `Tickets.tsx`: filtros e badges com 6 status (oculta `fechado`).
- `Dashboard.tsx` chart de pizza: agrupa `fechado` em Resolvido.
- `exporters.ts`: coluna "Status" usa o label novo; novas colunas opcionais "Tempo Em Atend. (h)", "Tempo Aguard. (h)", "Tempo N1 (h)", "Tempo N2 (h)".

### 📋 Ordem de execução

1. Migração SQL (rename enum + 9 colunas + trigger atualizado + backfill `current_stage_started_at = status_changed_at`)
2. Atualizar `constants.ts` + `badges.tsx`
3. Refatorar `TicketDetail.tsx` (layout 2 colunas + timers + botões fluxo + auto-resolver)
4. Adicionar `@dnd-kit` e construir `TicketKanban.tsx` + toggle em `Tickets.tsx`
5. Atualizar `Dashboard.tsx` (4 KPIs por etapa) e `exporters.ts`

### ⚠️ Pontos de atenção

- A renomeação do enum **preserva todos os dados** — nenhum `UPDATE` em massa.
- `fechado` continua existindo no enum (legado): UI sempre exibe "Resolvido" e usa cor `success`. Não aparece como destino em selects/kanban — tickets `fechado` aparecem na coluna Resolvido.
- O trigger novo só começa a contabilizar a partir da migração; tickets antigos terão `total_<x>_seconds = 0` para etapas que nunca entraram. Mostro "—" quando zero.

