export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assist_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_conversations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_solutions: {
        Row: {
          categoria: string | null
          confirmado_em: string | null
          created_at: string
          id: string
          links: string[] | null
          problema: string | null
          solucao: string | null
          ticket_id: string | null
        }
        Insert: {
          categoria?: string | null
          confirmado_em?: string | null
          created_at?: string
          id?: string
          links?: string[] | null
          problema?: string | null
          solucao?: string | null
          ticket_id?: string | null
        }
        Update: {
          categoria?: string | null
          confirmado_em?: string | null
          created_at?: string
          id?: string
          links?: string[] | null
          problema?: string | null
          solucao?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_solutions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          concluido: boolean
          created_at: string
          etapa: Database["public"]["Enums"]["implantacao_etapa"]
          id: string
          implantacao_id: string
          label: string
          ordem: number
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          etapa: Database["public"]["Enums"]["implantacao_etapa"]
          id?: string
          implantacao_id: string
          label: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          etapa?: Database["public"]["Enums"]["implantacao_etapa"]
          id?: string
          implantacao_id?: string
          label?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_checklist_implantacao"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_owner: string | null
          address: string | null
          anydesk_id: string | null
          anydesk_senha: string | null
          billing_email: string | null
          cargo: string | null
          cnpj: string | null
          company: string | null
          contact_name: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          desconto_percentual: number
          document: string | null
          email: string | null
          estado: string | null
          faixa_colaboradores: string | null
          fonte_indicacao: string | null
          fornecedor_beneficios: string[] | null
          fornecedor_rh_digital: string[] | null
          health: Database["public"]["Enums"]["client_health"]
          health_reason: string | null
          id: string
          modulos_ativos: string[] | null
          name: string
          notes: string | null
          nps_data: string | null
          nps_score: number | null
          nps_token: string | null
          onboarding_iniciado_em: string | null
          parceiro_id: string | null
          phone: string | null
          pipedrive_person_id: string | null
          potencial_cross: string[] | null
          product: string | null
          products: string[]
          segmento: string | null
          status_nortear: string | null
          tags: string[] | null
          updated_at: string
          valor_com_desconto: number | null
          valor_contratado: number | null
          whatsapp: string | null
        }
        Insert: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          billing_email?: string | null
          cargo?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          desconto_percentual?: number
          document?: string | null
          email?: string | null
          estado?: string | null
          faixa_colaboradores?: string | null
          fonte_indicacao?: string | null
          fornecedor_beneficios?: string[] | null
          fornecedor_rh_digital?: string[] | null
          health?: Database["public"]["Enums"]["client_health"]
          health_reason?: string | null
          id?: string
          modulos_ativos?: string[] | null
          name: string
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          onboarding_iniciado_em?: string | null
          parceiro_id?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          potencial_cross?: string[] | null
          product?: string | null
          products?: string[]
          segmento?: string | null
          status_nortear?: string | null
          tags?: string[] | null
          updated_at?: string
          valor_com_desconto?: number | null
          valor_contratado?: number | null
          whatsapp?: string | null
        }
        Update: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          billing_email?: string | null
          cargo?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          desconto_percentual?: number
          document?: string | null
          email?: string | null
          estado?: string | null
          faixa_colaboradores?: string | null
          fonte_indicacao?: string | null
          fornecedor_beneficios?: string[] | null
          fornecedor_rh_digital?: string[] | null
          health?: Database["public"]["Enums"]["client_health"]
          health_reason?: string | null
          id?: string
          modulos_ativos?: string[] | null
          name?: string
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          onboarding_iniciado_em?: string | null
          parceiro_id?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          potencial_cross?: string[] | null
          product?: string | null
          products?: string[]
          segmento?: string | null
          status_nortear?: string | null
          tags?: string[] | null
          updated_at?: string
          valor_com_desconto?: number | null
          valor_contratado?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_owner_fkey"
            columns: ["account_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      config_comissoes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          percentual_ponto: number
          percentual_vr_primeira_carga: number
          percentual_vr_recorrencia: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          percentual_ponto?: number
          percentual_vr_primeira_carga?: number
          percentual_vr_recorrencia?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          percentual_ponto?: number
          percentual_vr_primeira_carga?: number
          percentual_vr_recorrencia?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_comissoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_comissoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_parceiro: {
        Row: {
          ativo: boolean
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          parceiro_id: string
          percentual: number
          produto: Database["public"]["Enums"]["produto_parceiro"]
          tipo_repasse: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          parceiro_id: string
          percentual?: number
          produto: Database["public"]["Enums"]["produto_parceiro"]
          tipo_repasse: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          parceiro_id?: string
          percentual?: number
          produto?: Database["public"]["Enums"]["produto_parceiro"]
          tipo_repasse?: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_parceiro_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_rh_digital: {
        Row: {
          ativo: boolean
          client_id: string | null
          cliente_nome: string
          cnpj: string | null
          created_at: string
          created_by: string | null
          data_inicio: string
          fidelidade_meses: number
          fidelidade_vencimento: string | null
          id: string
          notificar_vencimento: boolean
          observacoes: string | null
          percentual_nortear: number
          tipo_cobranca: Database["public"]["Enums"]["tipo_cobranca_rh"]
          updated_at: string
          valor_anual: number
          valor_mensalidade: number
          valor_nortear: number
        }
        Insert: {
          ativo?: boolean
          client_id?: string | null
          cliente_nome: string
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio: string
          fidelidade_meses: number
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_nortear?: number
          tipo_cobranca?: Database["public"]["Enums"]["tipo_cobranca_rh"]
          updated_at?: string
          valor_anual?: number
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Update: {
          ativo?: boolean
          client_id?: string | null
          cliente_nome?: string
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          fidelidade_meses?: number
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_nortear?: number
          tipo_cobranca?: Database["public"]["Enums"]["tipo_cobranca_rh"]
          updated_at?: string
          valor_anual?: number
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Relationships: []
      }
      crm_cnpj_consultas: {
        Row: {
          cnpj: string
          consultado_por: string | null
          consultado_por_nome: string | null
          created_at: string
          deal_criado: string | null
          id: string
          razao_social: string | null
          resultado: Json | null
          situacao: string | null
        }
        Insert: {
          cnpj: string
          consultado_por?: string | null
          consultado_por_nome?: string | null
          created_at?: string
          deal_criado?: string | null
          id?: string
          razao_social?: string | null
          resultado?: Json | null
          situacao?: string | null
        }
        Update: {
          cnpj?: string
          consultado_por?: string | null
          consultado_por_nome?: string | null
          created_at?: string
          deal_criado?: string | null
          id?: string
          razao_social?: string | null
          resultado?: Json | null
          situacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cnpj_consultas_deal_criado_fkey"
            columns: ["deal_criado"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_ticket_stages: {
        Row: {
          ativo: boolean
          color: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          label: string
          ordem: number
          sla_hours: number
          stage_key: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label: string
          ordem?: number
          sla_hours?: number
          stage_key: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label?: string
          ordem?: number
          sla_hours?: number
          stage_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          agendado_para: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          descricao: string | null
          id: string
          prioridade: string
          realizado_em: string | null
          resultado: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          realizado_em?: string | null
          resultado?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          realizado_em?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          cargo: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          email: string | null
          id: string
          nome: string
          notas: string | null
          papel: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          email?: string | null
          id?: string
          nome: string
          notas?: string | null
          papel?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          email?: string | null
          id?: string
          nome?: string
          notas?: string | null
          papel?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_history: {
        Row: {
          campo: string
          changed_at: string
          changed_by: string | null
          deal_id: string
          id: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          canal_origem: string | null
          client_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          estado: string | null
          etiqueta: string | null
          expected_close_date: string | null
          extensoes: string[] | null
          faixa_colaboradores: string | null
          fonte_indicacao: string | null
          id: string
          lost_at: string | null
          motivo_perda: string | null
          notas: string | null
          notes: string | null
          origem_lead: string | null
          owner_id: string | null
          pipedrive_deal_id: string | null
          plano_contratado: string | null
          position: number
          probabilidade: string | null
          product: Database["public"]["Enums"]["deal_product"] | null
          quem_implanta: string | null
          segmento: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at: string
          title: string
          updated_at: string
          value: number
          won_at: string | null
        }
        Insert: {
          canal_origem?: string | null
          client_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          etiqueta?: string | null
          expected_close_date?: string | null
          extensoes?: string[] | null
          faixa_colaboradores?: string | null
          fonte_indicacao?: string | null
          id?: string
          lost_at?: string | null
          motivo_perda?: string | null
          notas?: string | null
          notes?: string | null
          origem_lead?: string | null
          owner_id?: string | null
          pipedrive_deal_id?: string | null
          plano_contratado?: string | null
          position?: number
          probabilidade?: string | null
          product?: Database["public"]["Enums"]["deal_product"] | null
          quem_implanta?: string | null
          segmento?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at?: string
          title: string
          updated_at?: string
          value?: number
          won_at?: string | null
        }
        Update: {
          canal_origem?: string | null
          client_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          etiqueta?: string | null
          expected_close_date?: string | null
          extensoes?: string[] | null
          faixa_colaboradores?: string | null
          fonte_indicacao?: string | null
          id?: string
          lost_at?: string | null
          motivo_perda?: string | null
          notas?: string | null
          notes?: string | null
          origem_lead?: string | null
          owner_id?: string | null
          pipedrive_deal_id?: string | null
          plano_contratado?: string | null
          position?: number
          probabilidade?: string | null
          product?: Database["public"]["Enums"]["deal_product"] | null
          quem_implanta?: string | null
          segmento?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at?: string
          title?: string
          updated_at?: string
          value?: number
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_financeiros: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          client_id: string | null
          cliente_nome: string | null
          competencia: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          status_pagamento: Database["public"]["Enums"]["documento_financeiro_status"]
          tipo: Database["public"]["Enums"]["documento_financeiro_tipo"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          competencia: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          status_pagamento?: Database["public"]["Enums"]["documento_financeiro_status"]
          tipo?: Database["public"]["Enums"]["documento_financeiro_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          status_pagamento?: Database["public"]["Enums"]["documento_financeiro_status"]
          tipo?: Database["public"]["Enums"]["documento_financeiro_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_financeiros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_financeiros_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_comissoes: {
        Row: {
          alterado_por: string | null
          alterado_por_id: string | null
          client_id: string | null
          cliente_nome: string | null
          created_at: string
          data_alteracao: string
          id: string
          motivo: string | null
          percentual_anterior: number | null
          percentual_novo: number
          produto: Database["public"]["Enums"]["historico_comissao_produto"]
          retroativo: boolean
          vigencia_a_partir: string
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_id?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_alteracao?: string
          id?: string
          motivo?: string | null
          percentual_anterior?: number | null
          percentual_novo: number
          produto: Database["public"]["Enums"]["historico_comissao_produto"]
          retroativo?: boolean
          vigencia_a_partir: string
        }
        Update: {
          alterado_por?: string | null
          alterado_por_id?: string | null
          client_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_alteracao?: string
          id?: string
          motivo?: string | null
          percentual_anterior?: number | null
          percentual_novo?: number
          produto?: Database["public"]["Enums"]["historico_comissao_produto"]
          retroativo?: boolean
          vigencia_a_partir?: string
        }
        Relationships: []
      }
      implantacao_eventos: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          descricao: string
          id: string
          implantacao_id: string
          metadata: Json
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          descricao: string
          id?: string
          implantacao_id: string
          metadata?: Json
          tipo: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          descricao?: string
          id?: string
          implantacao_id?: string
          metadata?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_eventos_implantacao"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_eventos_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_pendencias: {
        Row: {
          conteudo: string
          created_at: string
          etapa: Database["public"]["Enums"]["implantacao_etapa"]
          id: string
          implantacao_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conteudo?: string
          created_at?: string
          etapa: Database["public"]["Enums"]["implantacao_etapa"]
          id?: string
          implantacao_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          etapa?: Database["public"]["Enums"]["implantacao_etapa"]
          id?: string
          implantacao_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pendencias_implantacao"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacao_pendencias_implantacao_id_fkey"
            columns: ["implantacao_id"]
            isOneToOne: false
            referencedRelation: "implantacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      implantacao_stage_configs: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          is_custom: boolean
          label: string
          ordem: number
          stage_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          is_custom?: boolean
          label: string
          ordem?: number
          stage_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          is_custom?: boolean
          label?: string
          ordem?: number
          stage_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      implantacoes: {
        Row: {
          client_id: string | null
          client_name: string
          cnpj: string | null
          contato_cliente: string | null
          created_at: string
          created_by: string | null
          data_go_live: string | null
          data_inicio: string | null
          email_cliente: string | null
          etapa: Database["public"]["Enums"]["implantacao_etapa"]
          gravacao_t1: string | null
          gravacao_t2: string | null
          gravacao_t3: string | null
          id: string
          metodo_registro: string | null
          metodo_registro_obs: string | null
          observacoes: string | null
          ordem: number
          produto: string | null
          responsavel_email: string | null
          responsavel_id: string | null
          telefone_cliente: string | null
          transcricao_t1: string | null
          transcricao_t2: string | null
          transcricao_t3: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          cnpj?: string | null
          contato_cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_go_live?: string | null
          data_inicio?: string | null
          email_cliente?: string | null
          etapa?: Database["public"]["Enums"]["implantacao_etapa"]
          gravacao_t1?: string | null
          gravacao_t2?: string | null
          gravacao_t3?: string | null
          id?: string
          metodo_registro?: string | null
          metodo_registro_obs?: string | null
          observacoes?: string | null
          ordem?: number
          produto?: string | null
          responsavel_email?: string | null
          responsavel_id?: string | null
          telefone_cliente?: string | null
          transcricao_t1?: string | null
          transcricao_t2?: string | null
          transcricao_t3?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          cnpj?: string | null
          contato_cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_go_live?: string | null
          data_inicio?: string | null
          email_cliente?: string | null
          etapa?: Database["public"]["Enums"]["implantacao_etapa"]
          gravacao_t1?: string | null
          gravacao_t2?: string | null
          gravacao_t3?: string | null
          id?: string
          metodo_registro?: string | null
          metodo_registro_obs?: string | null
          observacoes?: string | null
          ordem?: number
          produto?: string | null
          responsavel_email?: string | null
          responsavel_id?: string | null
          telefone_cliente?: string | null
          transcricao_t1?: string | null
          transcricao_t2?: string | null
          transcricao_t3?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implantacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implantacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_ponto: {
        Row: {
          client_id: string | null
          cliente_nome: string
          cnpj: string | null
          competencia: string
          created_at: string
          created_by: string | null
          fidelidade_inicio: string | null
          fidelidade_meses: number | null
          fidelidade_vencimento: string | null
          id: string
          notificar_vencimento: boolean
          observacoes: string | null
          percentual_nortear: number
          updated_at: string
          valor_mensalidade: number
          valor_nortear: number
        }
        Insert: {
          client_id?: string | null
          cliente_nome: string
          cnpj?: string | null
          competencia: string
          created_at?: string
          created_by?: string | null
          fidelidade_inicio?: string | null
          fidelidade_meses?: number | null
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_nortear?: number
          updated_at?: string
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Update: {
          client_id?: string | null
          cliente_nome?: string
          cnpj?: string | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          fidelidade_inicio?: string | null
          fidelidade_meses?: number | null
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_nortear?: number
          updated_at?: string
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_lancamentos_ponto_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lancamentos_ponto_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_ponto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_ponto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_vr: {
        Row: {
          client_id: string | null
          cliente_nome: string
          cnpj: string | null
          competencia: string
          created_at: string
          created_by: string | null
          fidelidade_inicio: string | null
          fidelidade_meses: number | null
          fidelidade_vencimento: string | null
          id: string
          notificar_vencimento: boolean
          observacoes: string | null
          percentual_comissao: number
          tipo: Database["public"]["Enums"]["lancamento_vr_tipo"]
          updated_at: string
          valor_base: number | null
          valor_comissao: number | null
        }
        Insert: {
          client_id?: string | null
          cliente_nome: string
          cnpj?: string | null
          competencia: string
          created_at?: string
          created_by?: string | null
          fidelidade_inicio?: string | null
          fidelidade_meses?: number | null
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_comissao?: number
          tipo?: Database["public"]["Enums"]["lancamento_vr_tipo"]
          updated_at?: string
          valor_base?: number | null
          valor_comissao?: number | null
        }
        Update: {
          client_id?: string | null
          cliente_nome?: string
          cnpj?: string | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          fidelidade_inicio?: string | null
          fidelidade_meses?: number | null
          fidelidade_vencimento?: string | null
          id?: string
          notificar_vencimento?: boolean
          observacoes?: string | null
          percentual_comissao?: number
          tipo?: Database["public"]["Enums"]["lancamento_vr_tipo"]
          updated_at?: string
          valor_base?: number | null
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lancamentos_vr_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lancamentos_vr_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_vr_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_vr_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          slug: string
          title: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug: string
          title: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          atendimento_evolucao: string | null
          client_id: string | null
          comentario_adicional: string | null
          confianca_informacoes: number | null
          created_at: string
          email: string
          empresa: string
          experiencia_geral: string | null
          feedback_aberto: string | null
          frequencia_uso: string | null
          id: string
          nome: string
          nota_atendimento: number | null
          nps_score: number | null
          source: string
          sugestao_melhoria: string | null
          tempo_cliente: string | null
          tempo_resposta: string | null
          token: string | null
        }
        Insert: {
          atendimento_evolucao?: string | null
          client_id?: string | null
          comentario_adicional?: string | null
          confianca_informacoes?: number | null
          created_at?: string
          email: string
          empresa: string
          experiencia_geral?: string | null
          feedback_aberto?: string | null
          frequencia_uso?: string | null
          id?: string
          nome: string
          nota_atendimento?: number | null
          nps_score?: number | null
          source?: string
          sugestao_melhoria?: string | null
          tempo_cliente?: string | null
          tempo_resposta?: string | null
          token?: string | null
        }
        Update: {
          atendimento_evolucao?: string | null
          client_id?: string | null
          comentario_adicional?: string | null
          confianca_informacoes?: number | null
          created_at?: string
          email?: string
          empresa?: string
          experiencia_geral?: string | null
          feedback_aberto?: string | null
          frequencia_uso?: string | null
          id?: string
          nome?: string
          nota_atendimento?: number | null
          nps_score?: number | null
          source?: string
          sugestao_melhoria?: string | null
          tempo_cliente?: string | null
          tempo_resposta?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros: {
        Row: {
          ativo: boolean
          contato: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacoes: string | null
          percentual_rh: number
          percentual_rh_tipo: Database["public"]["Enums"]["tipo_repasse_rh_padrao"]
          percentual_vr: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          percentual_rh?: number
          percentual_rh_tipo?: Database["public"]["Enums"]["tipo_repasse_rh_padrao"]
          percentual_vr?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          percentual_rh?: number
          percentual_rh_tipo?: Database["public"]["Enums"]["tipo_repasse_rh_padrao"]
          percentual_vr?: number
          updated_at?: string
        }
        Relationships: []
      }
      parcelas_rh_digital: {
        Row: {
          client_id: string | null
          cliente_nome: string
          competencia: string
          contrato_id: string
          created_at: string
          data_pagamento: string | null
          id: string
          observacoes: string | null
          percentual_nortear: number
          status: Database["public"]["Enums"]["parcela_rh_status"]
          updated_at: string
          valor_mensalidade: number
          valor_nortear: number
        }
        Insert: {
          client_id?: string | null
          cliente_nome: string
          competencia: string
          contrato_id: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          percentual_nortear?: number
          status?: Database["public"]["Enums"]["parcela_rh_status"]
          updated_at?: string
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Update: {
          client_id?: string | null
          cliente_nome?: string
          competencia?: string
          contrato_id?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          percentual_nortear?: number
          status?: Database["public"]["Enums"]["parcela_rh_status"]
          updated_at?: string
          valor_mensalidade?: number
          valor_nortear?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_parcelas_contrato"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_rh_digital"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_rh_digital_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_rh_digital"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repasses_parceiro: {
        Row: {
          client_id: string | null
          cliente_nome: string
          competencia: string
          created_at: string
          data_pagamento: string | null
          id: string
          observacoes: string | null
          origem_id: string | null
          parceiro_id: string
          parceiro_nome: string
          percentual: number
          produto: Database["public"]["Enums"]["produto_parceiro"]
          status: Database["public"]["Enums"]["status_repasse_parceiro"]
          tipo_repasse: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at: string
          valor_base: number
          valor_repasse: number
        }
        Insert: {
          client_id?: string | null
          cliente_nome: string
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          origem_id?: string | null
          parceiro_id: string
          parceiro_nome: string
          percentual?: number
          produto: Database["public"]["Enums"]["produto_parceiro"]
          status?: Database["public"]["Enums"]["status_repasse_parceiro"]
          tipo_repasse: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at?: string
          valor_base?: number
          valor_repasse?: number
        }
        Update: {
          client_id?: string | null
          cliente_nome?: string
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          origem_id?: string | null
          parceiro_id?: string
          parceiro_nome?: string
          percentual?: number
          produto?: Database["public"]["Enums"]["produto_parceiro"]
          status?: Database["public"]["Enums"]["status_repasse_parceiro"]
          tipo_repasse?: Database["public"]["Enums"]["tipo_repasse_parceiro"]
          updated_at?: string
          valor_base?: number
          valor_repasse?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_repasses_parceiro"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_parceiro_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_metas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mes: string
          produto: string
          quantidade_meta: number
          updated_at: string
          valor_meta: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes: string
          produto?: string
          quantidade_meta?: number
          updated_at?: string
          valor_meta?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mes?: string
          produto?: string
          quantidade_meta?: number
          updated_at?: string
          valor_meta?: number
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          percentual_ponto: number
          percentual_vr_primeira_carga: number
          percentual_vr_recorrencia: number
          pipedrive_api_token: string | null
          pipedrive_connected_at: string | null
          pipedrive_user_name: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          percentual_ponto?: number
          percentual_vr_primeira_carga?: number
          percentual_vr_recorrencia?: number
          pipedrive_api_token?: string | null
          pipedrive_connected_at?: string | null
          pipedrive_user_name?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          percentual_ponto?: number
          percentual_vr_primeira_carga?: number
          percentual_vr_recorrencia?: number
          pipedrive_api_token?: string | null
          pipedrive_connected_at?: string | null
          pipedrive_user_name?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_name: string | null
          assigned_to: string | null
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_categories: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          emoji: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_interactions: {
        Row: {
          author_id: string | null
          channel: Database["public"]["Enums"]["ticket_channel"] | null
          content: string | null
          created_at: string
          id: string
          interaction_at: string
          is_internal: boolean
          metadata: Json | null
          problem_description: string | null
          result: Database["public"]["Enums"]["interaction_result"] | null
          solution_applied: string | null
          summary: string | null
          ticket_id: string
          time_spent_minutes: number | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          author_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"] | null
          content?: string | null
          created_at?: string
          id?: string
          interaction_at?: string
          is_internal?: boolean
          metadata?: Json | null
          problem_description?: string | null
          result?: Database["public"]["Enums"]["interaction_result"] | null
          solution_applied?: string | null
          summary?: string | null
          ticket_id: string
          time_spent_minutes?: number | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          author_id?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"] | null
          content?: string | null
          created_at?: string
          id?: string
          interaction_at?: string
          is_internal?: boolean
          metadata?: Json | null
          problem_description?: string | null
          result?: Database["public"]["Enums"]["interaction_result"] | null
          solution_applied?: string | null
          summary?: string | null
          ticket_id?: string
          time_spent_minutes?: number | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_interactions_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_interactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_interactions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_stage_times: {
        Row: {
          created_at: string
          id: string
          stage_key: string
          ticket_id: string
          total_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          stage_key: string
          ticket_id: string
          total_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          stage_key?: string
          ticket_id?: string
          total_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          duration_seconds: number | null
          from_status: Database["public"]["Enums"]["ticket_status"] | null
          id: string
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_titles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          acao_tentada: string | null
          active_custom_stage_key: string | null
          anydesk_id: string | null
          anydesk_senha: string | null
          assigned_name: string | null
          assigned_to: string | null
          category: string | null
          channel: Database["public"]["Enums"]["ticket_channel"]
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          current_stage_started_at: string
          custom_stage_started_at: string | null
          descricao_problema: string | null
          description: string | null
          entered_aguardando_cliente_at: string | null
          entered_em_atendimento_at: string | null
          entered_n2_at: string | null
          entered_vera_n1_at: string | null
          first_response_at: string | null
          id: string
          ja_tentou: string | null
          kanban_stage_key: string | null
          opened_at: string
          organization: string | null
          pipedrive_deal_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          quem_reportou: string | null
          resolved_at: string | null
          sla_alert_sent: boolean
          sla_deadline: string | null
          sla_resolution_deadline: string | null
          sla_response_deadline: string | null
          solucao_aplicada: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          status_ativo_desde: string | null
          status_ativo_key: string | null
          status_changed_at: string
          tags: string[] | null
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["ticket_type"] | null
          title: string
          total_active_seconds: number
          total_aguardando_cliente_seconds: number
          total_em_atendimento_seconds: number
          total_n2_seconds: number
          total_vera_n1_seconds: number
          updated_at: string
        }
        Insert: {
          acao_tentada?: string | null
          active_custom_stage_key?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage_started_at?: string
          custom_stage_started_at?: string | null
          descricao_problema?: string | null
          description?: string | null
          entered_aguardando_cliente_at?: string | null
          entered_em_atendimento_at?: string | null
          entered_n2_at?: string | null
          entered_vera_n1_at?: string | null
          first_response_at?: string | null
          id?: string
          ja_tentou?: string | null
          kanban_stage_key?: string | null
          opened_at?: string
          organization?: string | null
          pipedrive_deal_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          quem_reportou?: string | null
          resolved_at?: string | null
          sla_alert_sent?: boolean
          sla_deadline?: string | null
          sla_resolution_deadline?: string | null
          sla_response_deadline?: string | null
          solucao_aplicada?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_ativo_desde?: string | null
          status_ativo_key?: string | null
          status_changed_at?: string
          tags?: string[] | null
          ticket_number: string
          ticket_type?: Database["public"]["Enums"]["ticket_type"] | null
          title: string
          total_active_seconds?: number
          total_aguardando_cliente_seconds?: number
          total_em_atendimento_seconds?: number
          total_n2_seconds?: number
          total_vera_n1_seconds?: number
          updated_at?: string
        }
        Update: {
          acao_tentada?: string | null
          active_custom_stage_key?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string | null
          channel?: Database["public"]["Enums"]["ticket_channel"]
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_stage_started_at?: string
          custom_stage_started_at?: string | null
          descricao_problema?: string | null
          description?: string | null
          entered_aguardando_cliente_at?: string | null
          entered_em_atendimento_at?: string | null
          entered_n2_at?: string | null
          entered_vera_n1_at?: string | null
          first_response_at?: string | null
          id?: string
          ja_tentou?: string | null
          kanban_stage_key?: string | null
          opened_at?: string
          organization?: string | null
          pipedrive_deal_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          quem_reportou?: string | null
          resolved_at?: string | null
          sla_alert_sent?: boolean
          sla_deadline?: string | null
          sla_resolution_deadline?: string | null
          sla_response_deadline?: string | null
          solucao_aplicada?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_ativo_desde?: string | null
          status_ativo_key?: string | null
          status_changed_at?: string
          tags?: string[] | null
          ticket_number?: string
          ticket_type?: Database["public"]["Enums"]["ticket_type"] | null
          title?: string
          total_active_seconds?: number
          total_aguardando_cliente_seconds?: number
          total_em_atendimento_seconds?: number
          total_n2_seconds?: number
          total_vera_n1_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      clients_safe: {
        Row: {
          account_owner: string | null
          address: string | null
          anydesk_id: string | null
          anydesk_senha: string | null
          billing_email: string | null
          cnpj: string | null
          company: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          document: string | null
          email: string | null
          health: Database["public"]["Enums"]["client_health"] | null
          health_reason: string | null
          id: string | null
          name: string | null
          notes: string | null
          nps_data: string | null
          nps_score: number | null
          nps_token: string | null
          phone: string | null
          pipedrive_person_id: string | null
          tags: string[] | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: never
          anydesk_senha?: never
          billing_email?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          document?: string | null
          email?: string | null
          health?: Database["public"]["Enums"]["client_health"] | null
          health_reason?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: never
          anydesk_senha?: never
          billing_email?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          document?: string | null
          email?: string | null
          health?: Database["public"]["Enums"]["client_health"] | null
          health_reason?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_owner_fkey"
            columns: ["account_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_remove_user_access: {
        Args: { _target_user: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent" | "viewer"
      client_health: "saudavel" | "em_atencao" | "critico"
      deal_product: "vr_beneficios" | "rh_digital" | "ambos"
      deal_stage:
        | "lead"
        | "contato"
        | "apresentacao"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      documento_financeiro_status: "pendente" | "pago"
      documento_financeiro_tipo: "nota_fiscal" | "boleto" | "outro"
      historico_comissao_produto:
        | "vr_primeira_carga"
        | "vr_recorrencia"
        | "ponto"
      implantacao_etapa:
        | "novo_cliente"
        | "boas_vindas"
        | "treinamento_1"
        | "treinamento_2"
        | "treinamento_3"
        | "finalizado"
      interaction_result:
        | "resolvido"
        | "parcialmente_resolvido"
        | "escalado"
        | "aguardando"
      interaction_type:
        | "nota"
        | "email"
        | "ligacao"
        | "whatsapp"
        | "reuniao"
        | "mudanca_status"
        | "remoto"
        | "anotacao"
      lancamento_vr_tipo: "primeira_carga" | "recorrencia"
      parcela_rh_status: "pendente" | "pago" | "inadimplente"
      produto_parceiro: "rh_digital" | "vr_beneficios"
      status_repasse_parceiro: "pendente" | "pago"
      ticket_channel:
        | "email"
        | "whatsapp"
        | "telefone"
        | "chat"
        | "portal"
        | "pipedrive"
        | "outro"
        | "reuniao"
        | "anydesk"
      ticket_priority: "baixa" | "media" | "alta" | "critica" | "urgente"
      ticket_status:
        | "novo"
        | "em_atendimento"
        | "aguardando_cliente"
        | "resolvido"
        | "fechado"
        | "suporte_vera_n1"
        | "abertura_chamado_n2"
      ticket_type:
        | "duvida_uso"
        | "configuracao"
        | "fechamento"
        | "admissao_demissao"
        | "bug_sistema"
        | "produto_rh_digital"
        | "beneficios_vr"
        | "upgrade"
        | "downgrade"
        | "financeiro"
      tipo_cobranca_rh: "mensal" | "anual"
      tipo_repasse_parceiro:
        | "primeira_mensalidade"
        | "recorrencia"
        | "primeira_carga_vr"
      tipo_repasse_rh_padrao: "primeira_mensalidade" | "recorrencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "agent", "viewer"],
      client_health: ["saudavel", "em_atencao", "critico"],
      deal_product: ["vr_beneficios", "rh_digital", "ambos"],
      deal_stage: [
        "lead",
        "contato",
        "apresentacao",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      documento_financeiro_status: ["pendente", "pago"],
      documento_financeiro_tipo: ["nota_fiscal", "boleto", "outro"],
      historico_comissao_produto: [
        "vr_primeira_carga",
        "vr_recorrencia",
        "ponto",
      ],
      implantacao_etapa: [
        "novo_cliente",
        "boas_vindas",
        "treinamento_1",
        "treinamento_2",
        "treinamento_3",
        "finalizado",
      ],
      interaction_result: [
        "resolvido",
        "parcialmente_resolvido",
        "escalado",
        "aguardando",
      ],
      interaction_type: [
        "nota",
        "email",
        "ligacao",
        "whatsapp",
        "reuniao",
        "mudanca_status",
        "remoto",
        "anotacao",
      ],
      lancamento_vr_tipo: ["primeira_carga", "recorrencia"],
      parcela_rh_status: ["pendente", "pago", "inadimplente"],
      produto_parceiro: ["rh_digital", "vr_beneficios"],
      status_repasse_parceiro: ["pendente", "pago"],
      ticket_channel: [
        "email",
        "whatsapp",
        "telefone",
        "chat",
        "portal",
        "pipedrive",
        "outro",
        "reuniao",
        "anydesk",
      ],
      ticket_priority: ["baixa", "media", "alta", "critica", "urgente"],
      ticket_status: [
        "novo",
        "em_atendimento",
        "aguardando_cliente",
        "resolvido",
        "fechado",
        "suporte_vera_n1",
        "abertura_chamado_n2",
      ],
      ticket_type: [
        "duvida_uso",
        "configuracao",
        "fechamento",
        "admissao_demissao",
        "bug_sistema",
        "produto_rh_digital",
        "beneficios_vr",
        "upgrade",
        "downgrade",
        "financeiro",
      ],
      tipo_cobranca_rh: ["mensal", "anual"],
      tipo_repasse_parceiro: [
        "primeira_mensalidade",
        "recorrencia",
        "primeira_carga_vr",
      ],
      tipo_repasse_rh_padrao: ["primeira_mensalidade", "recorrencia"],
    },
  },
} as const
