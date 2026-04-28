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
        ]
      }
      clients: {
        Row: {
          account_owner: string | null
          address: string | null
          anydesk_id: string | null
          anydesk_senha: string | null
          billing_email: string | null
          cnpj: string | null
          company: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          health: Database["public"]["Enums"]["client_health"]
          health_reason: string | null
          id: string
          name: string
          notes: string | null
          nps_data: string | null
          nps_score: number | null
          nps_token: string | null
          phone: string | null
          pipedrive_person_id: string | null
          tags: string[] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          billing_email?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          health?: Database["public"]["Enums"]["client_health"]
          health_reason?: string | null
          id?: string
          name: string
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          tags?: string[] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          account_owner?: string | null
          address?: string | null
          anydesk_id?: string | null
          anydesk_senha?: string | null
          billing_email?: string | null
          cnpj?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          health?: Database["public"]["Enums"]["client_health"]
          health_reason?: string | null
          id?: string
          name?: string
          notes?: string | null
          nps_data?: string | null
          nps_score?: number | null
          nps_token?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          tags?: string[] | null
          updated_at?: string
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
      system_settings: {
        Row: {
          created_at: string
          id: string
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
          description: string | null
          entered_aguardando_cliente_at: string | null
          entered_em_atendimento_at: string | null
          entered_n2_at: string | null
          entered_vera_n1_at: string | null
          first_response_at: string | null
          id: string
          opened_at: string
          organization: string | null
          pipedrive_deal_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_alert_sent: boolean
          sla_deadline: string | null
          sla_resolution_deadline: string | null
          sla_response_deadline: string | null
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
          description?: string | null
          entered_aguardando_cliente_at?: string | null
          entered_em_atendimento_at?: string | null
          entered_n2_at?: string | null
          entered_vera_n1_at?: string | null
          first_response_at?: string | null
          id?: string
          opened_at?: string
          organization?: string | null
          pipedrive_deal_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_alert_sent?: boolean
          sla_deadline?: string | null
          sla_resolution_deadline?: string | null
          sla_response_deadline?: string | null
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
          description?: string | null
          entered_aguardando_cliente_at?: string | null
          entered_em_atendimento_at?: string | null
          entered_n2_at?: string | null
          entered_vera_n1_at?: string | null
          first_response_at?: string | null
          id?: string
          opened_at?: string
          organization?: string | null
          pipedrive_deal_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_alert_sent?: boolean
          sla_deadline?: string | null
          sla_resolution_deadline?: string | null
          sla_response_deadline?: string | null
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
      [_ in never]: never
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
    }
    Enums: {
      app_role: "admin" | "manager" | "agent" | "viewer"
      client_health: "saudavel" | "em_atencao" | "critico"
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
      ],
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
    },
  },
} as const
