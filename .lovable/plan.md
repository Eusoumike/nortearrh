# Fase 2 — Reestruturar formulários de chamado

Aplicar os novos campos da Fase 1 nos formulários de criar/editar chamado. Nada é removido do banco — apenas escondido do UI.

## O que será feito

### 1. Novo componente `TemaAutocomplete`
- Arquivo: `src/components/tickets/TemaAutocomplete.tsx`
- Combobox baseado em `Command` + `Popover` (padrão shadcn já usado no projeto).
- Consulta `ticket_temas_frequentes` ordenada por `total_ocorrencias`.
- Filtra localmente conforme digitação; se nenhum item bate, oferece "Criar tema: …".
- Ao selecionar um tema existente, dispara `onChange(tema, modulo_afetado_sugerido)` para permitir auto-preenchimento do módulo.

### 2. Refatorar `NewTicketDialog.tsx`
- Reorganizar em duas seções: **Sobre o problema** e **Contato (opcional)** (recolhível via `Collapsible`).
- Campos visíveis: Cliente, Tema*, Módulo afetado*, Quem reportou, Prioridade, Canal, Descrição*.
- Campos escondidos do UI (permanecem no banco): `impacto`, `resultado_esperado`, `resultado_obtido`, `ja_tentou`, `category`, `acao_tentada`, `ticket_type`, `title` (será derivado de `tema`).
- Insert em `tickets`: gravar `tema`, `modulo_afetado`, além de `title = tema` para manter compatibilidade com telas ainda não migradas.
- Módulo auto-preenche quando tema é escolhido, mas usuário pode sobrescrever.

### 3. Refatorar `EditTicketDialog.tsx`
- Mesma estrutura de campos.
- Adicionar `solucao_curta` (obrigatório quando status = resolvido) e checkbox `vira_artigo_assist`.
- Origem do problema como select (`erro_configuracao`, `duvida_operacional`, `bug_sistema`, `permissao_faltando`, `dado_incorreto`, `cliente_resolveu_sozinho`, `outros`).

### 4. Página `src/pages/NewTicket.tsx`
- Redirecionar para abrir o dialog novo (ou aplicar os mesmos campos). Verificar uso atual antes de decidir.

## Detalhes técnicos

- Constantes novas em `src/lib/constants.ts`:
  - `MODULO_AFETADO_OPTIONS` (10 valores)
  - `ORIGEM_PROBLEMA_OPTIONS` (7 valores)
  - `QUEM_REPORTOU_OPTIONS`
- `TemaAutocomplete` usa `useQuery(['temas-frequentes'])` com `staleTime: 60_000`.
- Validações: `tema` e `modulo_afetado` obrigatórios na criação; `solucao_curta` obrigatório na edição quando `status === 'resolvido'`.
- Nada de novo tipo TS até o Supabase regenerar `types.ts` (colunas novas já existem no banco, então já devem estar tipadas).

## Fora do escopo
- Kanban, detalhes do chamado (`TicketDetail.tsx`), exportação, Assist — ficam para depois.
- Remoção de colunas antigas do banco (Fase 3).
