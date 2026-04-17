import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    role: null,
  });

  useEffect(() => {
    let mounted = true;

    // Listener PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null, loading: false }));

      // Buscar role async (sem bloquear o callback)
      if (session?.user) {
        setTimeout(async () => {
          const { data } = await supabase.rpc("get_user_role", { _user_id: session.user.id });
          if (mounted) setState((s) => ({ ...s, role: data ?? null }));
        }, 0);
      } else {
        setState((s) => ({ ...s, role: null }));
      }
    });

    // Sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null, loading: false }));
      if (session?.user) {
        supabase.rpc("get_user_role", { _user_id: session.user.id }).then(({ data }) => {
          if (mounted) setState((s) => ({ ...s, role: data ?? null }));
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
