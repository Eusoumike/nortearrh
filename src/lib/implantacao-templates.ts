import { supabase } from "@/integrations/supabase/client";

export type TemplateCategoria = {
  id: string;
  template_id: string;
  nome: string;
  icone: string | null;
  cor: string | null;
  ordem: number;
};

export type TemplateTarefa = {
  id: string;
  template_id: string;
  categoria_id: string;
  descricao: string;
  prazo_dias_offset: number | null;
  ordem: number;
};

export type Template = {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
};

/**
 * Aplica um template numa implantação:
 * - Copia categorias do template (continuando ordem após as existentes)
 * - Copia tarefas, calculando prazo = data_inicio + prazo_dias_offset
 */
export async function applyTemplateToImplantacao(
  implantacaoId: string,
  templateId: string,
  dataInicio?: string | null,
) {
  const db = supabase as any;

  const { data: cats, error: e1 } = await db
    .from("implantacao_template_categorias")
    .select("*")
    .eq("template_id", templateId)
    .order("ordem", { ascending: true });
  if (e1) throw e1;

  const { data: tasks, error: e2 } = await db
    .from("implantacao_template_tarefas")
    .select("*")
    .eq("template_id", templateId)
    .order("ordem", { ascending: true });
  if (e2) throw e2;

  // ordem inicial = max(ordem) + 1 das categorias atuais
  const { data: existingCats } = await db
    .from("implantacao_categorias")
    .select("ordem")
    .eq("implantacao_id", implantacaoId)
    .order("ordem", { ascending: false })
    .limit(1);
  const ordemBase = (existingCats?.[0]?.ordem ?? -1) + 1;

  const catMap = new Map<string, string>(); // templateCatId -> newCatId

  for (let i = 0; i < (cats ?? []).length; i++) {
    const c = cats[i] as TemplateCategoria;
    const { data: novo, error } = await db
      .from("implantacao_categorias")
      .insert({
        implantacao_id: implantacaoId,
        nome: c.nome,
        icone: c.icone ?? "task_alt",
        cor: c.cor ?? "#3B82F6",
        ordem: ordemBase + i,
      })
      .select("id")
      .single();
    if (error) throw error;
    catMap.set(c.id, novo.id);
  }

  const base = dataInicio ? new Date(dataInicio) : new Date();
  const tarefasPayload = (tasks ?? []).map((t: TemplateTarefa, idx: number) => {
    const catId = catMap.get(t.categoria_id);
    if (!catId) return null;
    let prazo: string | null = null;
    if (t.prazo_dias_offset != null) {
      const d = new Date(base);
      d.setDate(d.getDate() + t.prazo_dias_offset);
      prazo = d.toISOString().slice(0, 10);
    }
    return {
      implantacao_id: implantacaoId,
      categoria_id: catId,
      titulo: t.descricao,
      status: "pendente",
      prazo,
      ordem: idx,
    };
  }).filter(Boolean);

  if (tarefasPayload.length > 0) {
    const { error } = await db.from("implantacao_tarefas").insert(tarefasPayload);
    if (error) throw error;
  }
}

/**
 * Cria um novo template a partir das categorias/tarefas atuais da implantação.
 */
export async function saveImplantacaoAsTemplate(
  implantacaoId: string,
  userId: string,
  nome: string,
  descricao?: string,
) {
  const db = supabase as any;

  const { data: tpl, error: errTpl } = await db
    .from("implantacao_templates")
    .insert({ user_id: userId, nome, descricao: descricao ?? null })
    .select("id")
    .single();
  if (errTpl) throw errTpl;

  const { data: cats } = await db
    .from("implantacao_categorias")
    .select("*")
    .eq("implantacao_id", implantacaoId)
    .order("ordem", { ascending: true });

  const { data: tasks } = await db
    .from("implantacao_tarefas")
    .select("*")
    .eq("implantacao_id", implantacaoId)
    .order("ordem", { ascending: true });

  const catMap = new Map<string, string>();

  for (const c of cats ?? []) {
    const { data: novo, error } = await db
      .from("implantacao_template_categorias")
      .insert({
        template_id: tpl.id,
        nome: c.nome,
        icone: c.icone ?? "task_alt",
        cor: c.cor ?? "#3B82F6",
        ordem: c.ordem,
      })
      .select("id")
      .single();
    if (error) throw error;
    catMap.set(c.id, novo.id);
  }

  const payload = (tasks ?? []).map((t: any) => {
    const cid = catMap.get(t.categoria_id);
    if (!cid) return null;
    return {
      template_id: tpl.id,
      categoria_id: cid,
      descricao: t.titulo,
      prazo_dias_offset: null,
      ordem: t.ordem ?? 0,
    };
  }).filter(Boolean);

  if (payload.length > 0) {
    const { error } = await db.from("implantacao_template_tarefas").insert(payload);
    if (error) throw error;
  }

  return tpl.id as string;
}
