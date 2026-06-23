
Mudanças simples no `TicketDetail`:

**1. Excluir chamado**
- Botão "Excluir" no header (ícone lixeira, variante destructive ghost), visível só para admin/manager (RLS já bloqueia os outros, mas escondo na UI usando `useAuth` + checagem em `user_roles`).
- Abre `AlertDialog` confirmando ação.
- Ao confirmar: `supabase.from("tickets").delete().eq("id", id)`, invalida `["tickets"]` e `["dashboard-tickets"]`, toast e `navigate("/tickets")`.

**2. Form de atendimento simplificado**
- No formulário de "Registrar atendimento" (aba dentro de Atendimentos), remover os 2 campos atuais `problem_description` e `solution_applied`.
- Substituir por um único `Textarea` chamado **"Resumo"** (4-5 linhas), salvando no campo já existente `summary` da tabela `ticket_interactions`.
- Mantém o resto: tipo, canal, resultado, tempo gasto, interno/público.
- Na listagem de interações, exibir o `summary` no lugar onde hoje aparece "Problema/Solução".

**Banco**: nenhuma migração. As colunas `problem_description` e `solution_applied` continuam existindo (interações antigas preservadas), só não preenchemos mais. Na exibição da timeline, se `summary` existir mostro ele; senão, mostro o `problem_description`/`solution_applied` antigos (compat).

**Arquivos tocados**: apenas `src/pages/TicketDetail.tsx`.
