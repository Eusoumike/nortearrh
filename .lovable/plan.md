## Módulo CRM Completo — Nortear Connect

Construção do CRM substituindo o Pipedrive, começando do zero (sem migração), preservando o pipeline kanban atual e expandindo com todos os recursos pedidos.

**Observação importante sobre nomes de tabelas:** O projeto já possui a tabela `deals` (e não `crm_deals`). Vou aplicar as novas colunas em `deals` e nomear as novas tabelas como `deal_activities`, `deal_contacts` e `sales_metas` (mantendo padrão do projeto). Se preferir os nomes do spec (`crm_deals/crm_activities/...`), me avise antes de aprovar.

---

### Fase 1 — Banco de dados (migration)

**Expandir `deals`:** `plano_contratado`, `extensoes text[]`, `quem_implanta`, `motivo_perda`, `canal_origem`, `faixa_colaboradores`, `etiqueta`, `segmento`, `estado`, `origem_lead`, `fonte_indicacao`, `probabilidade`, `notas`, `won_at`, `lost_at`.

**Expandir `clients`:** `status_nortear` (default `ativo_saudavel`), `fornecedor_beneficios text[]`, `fornecedor_rh_digital text[]`, `modulos_ativos text[]`, `potencial_cross text[]`, `segmento`, `estado`, `faixa_colaboradores`. (`fonte_indicacao` já existe.)

**Novas tabelas:**
- `deal_activities` (tipo, título, descrição, prioridade, agendado_para, realizado_em, status, resultado, deal_id, client_id, created_by)
- `deal_contacts` (nome, cargo, papel, email, telefone, whatsapp, notas, deal_id, client_id)
- `sales_metas` (mes date único, valor_meta, quantidade_meta, produto)
- `deal_history` (deal_id, campo, valor_antigo, valor_novo, changed_by, changed_at) — para a aba Histórico

**RLS:** `SELECT` para `is_staff`; `INSERT/UPDATE/DELETE` para `is_staff` (admin/manager/agent). Bloqueia viewers.

**Trigger:** ao mover `stage` para `fechado_ganho` → setar `won_at`; `fechado_perdido` → `lost_at`. Trigger de log em `deal_history` para mudanças de stage e campos chave.

---

### Fase 2 — Pipeline Kanban evoluído (`/crm/pipeline`)

Manter o kanban existente. Adicionar:
- **Card enriquecido:** empresa (bold), contato, valor R$, badge produto, badge etiqueta (🔥🌡❄), sino se atividade pendente atrasada, tempo na etapa atual, faixa de colaboradores.
- **Header de coluna:** nome + contagem + valor total formatado.
- **Filtros no topo:** produto, etiqueta, origem do lead, faixa de colaboradores, responsável.
- **Modal "Ganho":** ao mover para `fechado_ganho`, abrir confirmação que cria automaticamente:
  - Cliente em `clients` (se não vinculado)
  - Implantação em `implantacoes` (etapa inicial)
  - Contrato em `contratos_rh_digital` ou `lancamentos_vr` (conforme produto)
  - Vincula parceiro (`configuracoes_parceiro`) se houver fonte de indicação que case com parceiro
- **Modal "Perdido":** select com 13 motivos + observação opcional.

---

### Fase 3 — Página de detalhe do deal (`/crm/:id`)

4 abas via tabs do shadcn:
1. **Visão Geral** — timeline de atividades (2/3) + painel lateral (próxima atividade, valor, plano, produto, etapa, probabilidade, etiqueta, notas).
2. **Dados do Deal** — formulário com todos os campos agrupados (Produto/Contrato, Origem, Gerais).
3. **Contatos** — lista CRUD em `deal_contacts` com botão WhatsApp clicável.
4. **Histórico** — registros de `deal_history` em timeline.

---

### Fase 4 — Atividades

- **Modal "Nova atividade"** com tipo (ícones), título, prioridade, datetime, descrição. Status inicial `pendente`; ao marcar realizada, pedir resultado.
- **Página `/crm/atividades`** — tabela com filtros (status, tipo, período, deal) e ações.
- **Notificações no sino do TopBar:** ao carregar app, query `agendado_para <= now()+1h AND status='pendente'`. Atrasadas → badge vermelho no card do deal + item no sino.

---

### Fase 5 — Perfil do cliente

Em `src/pages/ClientDetail.tsx`, adicionar campos: status_nortear (select com badge colorido), multi-select fornecedor_beneficios, fornecedor_rh_digital, modulos_ativos, potencial_cross, segmento, estado (UF), faixa_colaboradores.

---

### Fase 6 — Analytics (`/crm/analytics`)

- **4 KPI cards:** deals ativos, valor pipeline, taxa de conversão, ticket médio.
- **Funil:** barras horizontais por etapa + % conversão (destaque na maior perda).
- **Gráficos** (recharts já no projeto): deals por origem (pizza), top 8 segmentos (barras).
- **Meta mensal:** barra de progresso (valor e quantidade). Botão "Definir meta" → modal salva em `sales_metas`.
- **Tabela de performance:** últimos 6 meses + atual (deals ganhos, valor, ticket médio, % conversão).

---

### Fase 7 — Menu

Em `AppSidebar.tsx`, expandir grupo CRM:
```
CRM
├── Pipeline      → /crm/pipeline
├── Atividades    → /crm/atividades
└── Analytics     → /crm/analytics
```

---

### Detalhes técnicos

- Roteamento em `App.tsx`: novas rotas `/crm/:id`, `/crm/atividades`, `/crm/analytics`.
- Permissões: viewers só leem; agent+ escrevem; admin/manager apagam.
- Sino: hook `useCrmNotifications` que junta SLA de chamados + atividades CRM.
- Tipagem: `src/integrations/supabase/types.ts` é regenerado pela migration.
- Conversão "Ganho" será atômica em uma única função RPC (`finalize_won_deal`) ou em sequência client-side com rollback otimista.

---

### Fora do escopo desta entrega

- Sincronização/importação de dados do Pipedrive (já existe `pipedrive-sync` mas user disse "do zero").
- Automações de e-mail/WhatsApp em massa.
- Integração com calendário externo (Google/Outlook) para atividades.

Aprovar para iniciar? Confirme também se posso usar os nomes `deal_activities/deal_contacts/sales_metas` ou se prefere os do spec.