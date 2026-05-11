DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_repasse_rh_padrao') THEN
    CREATE TYPE public.tipo_repasse_rh_padrao AS ENUM ('primeira_mensalidade', 'recorrencia');
  END IF;
END $$;

ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS percentual_vr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentual_rh_tipo public.tipo_repasse_rh_padrao NOT NULL DEFAULT 'primeira_mensalidade',
  ADD COLUMN IF NOT EXISTS percentual_rh numeric NOT NULL DEFAULT 0;

ALTER TABLE public.parceiros
  ADD CONSTRAINT parceiros_percentual_vr_range CHECK (percentual_vr >= 0 AND percentual_vr <= 50),
  ADD CONSTRAINT parceiros_percentual_rh_range CHECK (percentual_rh >= 0 AND percentual_rh <= 10);