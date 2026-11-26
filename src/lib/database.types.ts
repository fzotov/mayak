// Сгенерировано scripts/gen-db-types.mjs из живой схемы. Не править руками: node scripts/gen-db-types.mjs
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      accounting_articles: {
        Row: {
          code: string
          name: string
          grp: string
          register: string
          priority: number
          keywords: string[]
          vat_rate: number | null
          onec_account: string | null
          onec_item: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          code: string
          name: string
          grp: string
          register?: string
          priority?: number
          keywords?: string[]
          vat_rate?: number | null
          onec_account?: string | null
          onec_item?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          grp?: string
          register?: string
          priority?: number
          keywords?: string[]
          vat_rate?: number | null
          onec_account?: string | null
          onec_item?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      advertising_slots: {
        Row: {
          id: string
          slot_number: number
          side: string
          code_1c: string | null
          tenant_name: string | null
          is_our_ad: boolean | null
          is_free: boolean | null
          contract_end_date: string | null
          notes: string | null
          created_at: string | null
          tenant_id: string | null
          monthly_fee: number | null
        }
        Insert: {
          id?: string
          slot_number: number
          side: string
          code_1c?: string | null
          tenant_name?: string | null
          is_our_ad?: boolean | null
          is_free?: boolean | null
          contract_end_date?: string | null
          notes?: string | null
          created_at?: string | null
          tenant_id?: string | null
          monthly_fee?: number | null
        }
        Update: {
          id?: string
          slot_number?: number
          side?: string
          code_1c?: string | null
          tenant_name?: string | null
          is_our_ad?: boolean | null
          is_free?: boolean | null
          contract_end_date?: string | null
          notes?: string | null
          created_at?: string | null
          tenant_id?: string | null
          monthly_fee?: number | null
        }
        Relationships: [
        {
          foreignKeyName: "advertising_slots_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      allocations: {
        Row: {
          id: string
          tenant_id: string
          date: string
          amount: number
          source_payment_id: string | null
          source_lease_id: string | null
          target_charge_id: string | null
          target_payment_id: string | null
          deposit_operation_id: string | null
          auto: boolean
          cancelled_at: string | null
          cancel_reason: string | null
          cancelled_by: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          date: string
          amount: number
          source_payment_id?: string | null
          source_lease_id?: string | null
          target_charge_id?: string | null
          target_payment_id?: string | null
          deposit_operation_id?: string | null
          auto?: boolean
          cancelled_at?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          date?: string
          amount?: number
          source_payment_id?: string | null
          source_lease_id?: string | null
          target_charge_id?: string | null
          target_payment_id?: string | null
          deposit_operation_id?: string | null
          auto?: boolean
          cancelled_at?: string | null
          cancel_reason?: string | null
          cancelled_by?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "allocations_deposit_operation_id_fkey"
          columns: ["deposit_operation_id"]
          isOneToOne: false
          referencedRelation: "deposit_operations"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "allocations_source_lease_id_fkey"
          columns: ["source_lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "allocations_source_payment_id_fkey"
          columns: ["source_payment_id"]
          isOneToOne: false
          referencedRelation: "payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "allocations_target_charge_id_fkey"
          columns: ["target_charge_id"]
          isOneToOne: false
          referencedRelation: "charges"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "allocations_target_payment_id_fkey"
          columns: ["target_payment_id"]
          isOneToOne: false
          referencedRelation: "payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "allocations_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      audit_log: {
        Row: {
          id: number
          at: string
          user_id: string | null
          action: string
          entity: string
          entity_id: string | null
          data: Json | null
        }
        Insert: {
          id?: number
          at?: string
          user_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          data?: Json | null
        }
        Update: {
          id?: number
          at?: string
          user_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          data?: Json | null
        }
        Relationships: []
      }
      auth_tokens: {
        Row: {
          id: string
          token_hash: string
          kind: string
          email: string
          tenant_id: string | null
          payload: Json | null
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          token_hash: string
          kind: string
          email: string
          tenant_id?: string | null
          payload?: Json | null
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          token_hash?: string
          kind?: string
          email?: string
          tenant_id?: string | null
          payload?: Json | null
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "auth_tokens_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      bank_payer_links: {
        Row: {
          id: string
          payer_inn: string | null
          payer_account: string | null
          tenant_id: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payer_inn?: string | null
          payer_account?: string | null
          tenant_id: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          payer_inn?: string | null
          payer_account?: string | null
          tenant_id?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "bank_payer_links_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      bank_statement_files: {
        Row: {
          id: string
          file_name: string | null
          sha256: string
          account: string
          date_from: string | null
          date_to: string | null
          opening: number | null
          total_in: number | null
          total_out: number | null
          closing: number | null
          docs_in: number | null
          docs_out: number | null
          check_status: string
          check_note: string | null
          added: number
          skipped: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          file_name?: string | null
          sha256: string
          account: string
          date_from?: string | null
          date_to?: string | null
          opening?: number | null
          total_in?: number | null
          total_out?: number | null
          closing?: number | null
          docs_in?: number | null
          docs_out?: number | null
          check_status?: string
          check_note?: string | null
          added?: number
          skipped?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          file_name?: string | null
          sha256?: string
          account?: string
          date_from?: string | null
          date_to?: string | null
          opening?: number | null
          total_in?: number | null
          total_out?: number | null
          closing?: number | null
          docs_in?: number | null
          docs_out?: number | null
          check_status?: string
          check_note?: string | null
          added?: number
          skipped?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          id: string
          date: string
          amount: number
          direction: string
          counterparty: string | null
          description: string | null
          account_number: string | null
          reference: string | null
          matched_type: string | null
          matched_id: string | null
          import_id: string | null
          created_at: string | null
          bank_key: string | null
          doc_number: string | null
          payer_inn: string | null
          payer_account: string | null
          counter_inn: string | null
          statement_id: string | null
          tenant_id: string | null
          payment_id: string | null
          status: string
          match_note: string | null
        }
        Insert: {
          id?: string
          date: string
          amount: number
          direction: string
          counterparty?: string | null
          description?: string | null
          account_number?: string | null
          reference?: string | null
          matched_type?: string | null
          matched_id?: string | null
          import_id?: string | null
          created_at?: string | null
          bank_key?: string | null
          doc_number?: string | null
          payer_inn?: string | null
          payer_account?: string | null
          counter_inn?: string | null
          statement_id?: string | null
          tenant_id?: string | null
          payment_id?: string | null
          status?: string
          match_note?: string | null
        }
        Update: {
          id?: string
          date?: string
          amount?: number
          direction?: string
          counterparty?: string | null
          description?: string | null
          account_number?: string | null
          reference?: string | null
          matched_type?: string | null
          matched_id?: string | null
          import_id?: string | null
          created_at?: string | null
          bank_key?: string | null
          doc_number?: string | null
          payer_inn?: string | null
          payer_account?: string | null
          counter_inn?: string | null
          statement_id?: string | null
          tenant_id?: string | null
          payment_id?: string | null
          status?: string
          match_note?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "bank_transactions_payment_id_fkey"
          columns: ["payment_id"]
          isOneToOne: false
          referencedRelation: "payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "bank_transactions_statement_id_fkey"
          columns: ["statement_id"]
          isOneToOne: false
          referencedRelation: "bank_statement_files"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "bank_transactions_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      buildings: {
        Row: {
          id: string
          name: string
          address: string | null
          floors: number | null
          total_units: number | null
          description: string | null
          active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          floors?: number | null
          total_units?: number | null
          description?: string | null
          active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          floors?: number | null
          total_units?: number | null
          description?: string | null
          active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      charges: {
        Row: {
          id: string
          tenant_id: string
          lease_id: string | null
          article_code: string
          date: string
          period: string | null
          amount: number
          due_date: string
          description: string | null
          basis: Json | null
          invoice_id: string | null
          storno_of: string | null
          source: string
          billing_key: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          lease_id?: string | null
          article_code: string
          date?: string
          period?: string | null
          amount: number
          due_date: string
          description?: string | null
          basis?: Json | null
          invoice_id?: string | null
          storno_of?: string | null
          source?: string
          billing_key?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          lease_id?: string | null
          article_code?: string
          date?: string
          period?: string | null
          amount?: number
          due_date?: string
          description?: string | null
          basis?: Json | null
          invoice_id?: string | null
          storno_of?: string | null
          source?: string
          billing_key?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "charges_article_code_fkey"
          columns: ["article_code"]
          isOneToOne: false
          referencedRelation: "accounting_articles"
          referencedColumns: ["code"]
        },
        {
          foreignKeyName: "charges_invoice_id_fkey"
          columns: ["invoice_id"]
          isOneToOne: false
          referencedRelation: "invoices"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "charges_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "charges_storno_of_fkey"
          columns: ["storno_of"]
          isOneToOne: true
          referencedRelation: "charges"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "charges_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      contracts: {
        Row: {
          id: string
          number: string
          type: string
          status: string
          tenant_id: string | null
          unit_id: string | null
          start_date: string | null
          end_date: string | null
          rent_amount: number | null
          deposit: number | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          number: string
          type?: string
          status?: string
          tenant_id?: string | null
          unit_id?: string | null
          start_date?: string | null
          end_date?: string | null
          rent_amount?: number | null
          deposit?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          number?: string
          type?: string
          status?: string
          tenant_id?: string | null
          unit_id?: string | null
          start_date?: string | null
          end_date?: string | null
          rent_amount?: number | null
          deposit?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "contracts_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "contracts_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      counterparties: {
        Row: {
          id: string
          category_id: string | null
          type: string | null
          name: string
          short_name: string | null
          inn: string | null
          kpp: string | null
          ogrn: string | null
          legal_address: string | null
          actual_address: string | null
          phone: string | null
          email: string | null
          website: string | null
          contact_person: string | null
          contact_position: string | null
          contact_phone: string | null
          bank: string | null
          bik: string | null
          account: string | null
          corr_account: string | null
          status: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
          type?: string | null
          name: string
          short_name?: string | null
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          legal_address?: string | null
          actual_address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          contact_person?: string | null
          contact_position?: string | null
          contact_phone?: string | null
          bank?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
          type?: string | null
          name?: string
          short_name?: string | null
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          legal_address?: string | null
          actual_address?: string | null
          phone?: string | null
          email?: string | null
          website?: string | null
          contact_person?: string | null
          contact_position?: string | null
          contact_phone?: string | null
          bank?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "counterparties_category_id_fkey"
          columns: ["category_id"]
          isOneToOne: false
          referencedRelation: "counterparty_categories"
          referencedColumns: ["id"]
        }
      ]
      }
      counterparty_categories: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      deal_events: {
        Row: {
          id: string
          deal_id: string | null
          tenant_id: string | null
          kind: string
          text: string | null
          stage_from: string | null
          stage_to: string | null
          created_by: string | null
          created_by_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          deal_id?: string | null
          tenant_id?: string | null
          kind: string
          text?: string | null
          stage_from?: string | null
          stage_to?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          deal_id?: string | null
          tenant_id?: string | null
          kind?: string
          text?: string | null
          stage_from?: string | null
          stage_to?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "deal_events_deal_id_fkey"
          columns: ["deal_id"]
          isOneToOne: false
          referencedRelation: "deals"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deal_events_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      deal_units: {
        Row: {
          deal_id: string
          unit_id: string
        }
        Insert: {
          deal_id: string
          unit_id: string
        }
        Update: {
          deal_id?: string
          unit_id?: string
        }
        Relationships: [
        {
          foreignKeyName: "deal_units_deal_id_fkey"
          columns: ["deal_id"]
          isOneToOne: false
          referencedRelation: "deals"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deal_units_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      deals: {
        Row: {
          id: string
          number: number
          kind: string
          stage: string
          lost_reason: string | null
          name: string | null
          company: string | null
          phone: string | null
          email: string | null
          source: string
          source_detail: string | null
          lead_id: string | null
          tenant_id: string | null
          lease_id: string | null
          area_wanted: number | null
          budget: number | null
          notes: string | null
          owner_id: string | null
          next_step: string | null
          next_step_at: string | null
          created_at: string
          updated_at: string
          stage_changed_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          kind?: string
          stage?: string
          lost_reason?: string | null
          name?: string | null
          company?: string | null
          phone?: string | null
          email?: string | null
          source?: string
          source_detail?: string | null
          lead_id?: string | null
          tenant_id?: string | null
          lease_id?: string | null
          area_wanted?: number | null
          budget?: number | null
          notes?: string | null
          owner_id?: string | null
          next_step?: string | null
          next_step_at?: string | null
          created_at?: string
          updated_at?: string
          stage_changed_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          kind?: string
          stage?: string
          lost_reason?: string | null
          name?: string | null
          company?: string | null
          phone?: string | null
          email?: string | null
          source?: string
          source_detail?: string | null
          lead_id?: string | null
          tenant_id?: string | null
          lease_id?: string | null
          area_wanted?: number | null
          budget?: number | null
          notes?: string | null
          owner_id?: string | null
          next_step?: string | null
          next_step_at?: string | null
          created_at?: string
          updated_at?: string
          stage_changed_at?: string
          closed_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "deals_lead_id_fkey"
          columns: ["lead_id"]
          isOneToOne: true
          referencedRelation: "site_leads"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deals_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deals_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      deposit_history: {
        Row: {
          id: string
          date: string | null
          amount: number | null
          action: string | null
          note: string | null
          created_at: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          date?: string | null
          amount?: number | null
          action?: string | null
          note?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          date?: string | null
          amount?: number | null
          action?: string | null
          note?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "deposit_history_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      deposit_operations: {
        Row: {
          id: string
          tenant_id: string
          lease_id: string
          kind: string
          date: string
          amount: number
          reason: string
          charge_id: string | null
          payment_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          lease_id: string
          kind: string
          date?: string
          amount: number
          reason: string
          charge_id?: string | null
          payment_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          lease_id?: string
          kind?: string
          date?: string
          amount?: number
          reason?: string
          charge_id?: string | null
          payment_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "deposit_operations_charge_id_fkey"
          columns: ["charge_id"]
          isOneToOne: false
          referencedRelation: "charges"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deposit_operations_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deposit_operations_payment_id_fkey"
          columns: ["payment_id"]
          isOneToOne: false
          referencedRelation: "payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deposit_operations_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      heat_bills: {
        Row: {
          id: string
          period: string
          total_amount: number
          total_gcal: number | null
          coefficient: number | null
          photo_url: string | null
          ai_extracted: boolean | null
          items: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          period: string
          total_amount: number
          total_gcal?: number | null
          coefficient?: number | null
          photo_url?: string | null
          ai_extracted?: boolean | null
          items?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          period?: string
          total_amount?: number
          total_gcal?: number | null
          coefficient?: number | null
          photo_url?: string | null
          ai_extracted?: boolean | null
          items?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      heat_settings: {
        Row: {
          id: string
          coefficient: number
          valid_from: string
          note: string | null
          created_at: string | null
          total_area: number | null
        }
        Insert: {
          id?: string
          coefficient?: number
          valid_from?: string
          note?: string | null
          created_at?: string | null
          total_area?: number | null
        }
        Update: {
          id?: string
          coefficient?: number
          valid_from?: string
          note?: string | null
          created_at?: string | null
          total_area?: number | null
        }
        Relationships: []
      }
      incoming_invoices: {
        Row: {
          id: string
          supplier: string
          amount: number
          invoice_date: string | null
          due_date: string | null
          description: string | null
          file_url: string | null
          status: string
          building_id: string | null
          created_at: string | null
          vat: number | null
          approval_token: string | null
          approval_requested_at: string | null
          approval_requested_to: string | null
          approved_by: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          supplier: string
          amount?: number
          invoice_date?: string | null
          due_date?: string | null
          description?: string | null
          file_url?: string | null
          status?: string
          building_id?: string | null
          created_at?: string | null
          vat?: number | null
          approval_token?: string | null
          approval_requested_at?: string | null
          approval_requested_to?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          supplier?: string
          amount?: number
          invoice_date?: string | null
          due_date?: string | null
          description?: string | null
          file_url?: string | null
          status?: string
          building_id?: string | null
          created_at?: string | null
          vat?: number | null
          approval_token?: string | null
          approval_requested_at?: string | null
          approval_requested_to?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          name: string
          category: string | null
          description: string | null
          quantity: number | null
          quantity_available: number | null
          location: string | null
          cost: number | null
          serial_number: string | null
          inventory_number: string | null
          responsible_id: string | null
          photo_url: string | null
          supplier: string | null
          received_at: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          description?: string | null
          quantity?: number | null
          quantity_available?: number | null
          location?: string | null
          cost?: number | null
          serial_number?: string | null
          inventory_number?: string | null
          responsible_id?: string | null
          photo_url?: string | null
          supplier?: string | null
          received_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          description?: string | null
          quantity?: number | null
          quantity_available?: number | null
          location?: string | null
          cost?: number | null
          serial_number?: string | null
          inventory_number?: string | null
          responsible_id?: string | null
          photo_url?: string | null
          supplier?: string | null
          received_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "inventory_responsible_id_fkey"
          columns: ["responsible_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        }
      ]
      }
      inventory_categories: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          id: string
          item_id: string | null
          staff_id: string | null
          action: string
          quantity: number | null
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          item_id?: string | null
          staff_id?: string | null
          action: string
          quantity?: number | null
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          item_id?: string | null
          staff_id?: string | null
          action?: string
          quantity?: number | null
          note?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "inventory_movements_item_id_fkey"
          columns: ["item_id"]
          isOneToOne: false
          referencedRelation: "inventory"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "inventory_movements_staff_id_fkey"
          columns: ["staff_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        }
      ]
      }
      invoices: {
        Row: {
          id: string
          tenant_id: string | null
          unit_id: string | null
          number: string
          period: string | null
          rent_amount: number | null
          cleaning_amount: number | null
          utilities_amount: number | null
          services_amount: number | null
          total_amount: number | null
          status: string | null
          due_date: string | null
          created_at: string | null
          landlord_id: string | null
          notes: string | null
          lease_id: string | null
          kind: string | null
          date: string | null
          pdf_path: string | null
          billing_key: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          number: string
          period?: string | null
          rent_amount?: number | null
          cleaning_amount?: number | null
          utilities_amount?: number | null
          services_amount?: number | null
          total_amount?: number | null
          status?: string | null
          due_date?: string | null
          created_at?: string | null
          landlord_id?: string | null
          notes?: string | null
          lease_id?: string | null
          kind?: string | null
          date?: string | null
          pdf_path?: string | null
          billing_key?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          number?: string
          period?: string | null
          rent_amount?: number | null
          cleaning_amount?: number | null
          utilities_amount?: number | null
          services_amount?: number | null
          total_amount?: number | null
          status?: string | null
          due_date?: string | null
          created_at?: string | null
          landlord_id?: string | null
          notes?: string | null
          lease_id?: string | null
          kind?: string | null
          date?: string | null
          pdf_path?: string | null
          billing_key?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "invoices_landlord_id_fkey"
          columns: ["landlord_id"]
          isOneToOne: false
          referencedRelation: "landlords"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "invoices_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "invoices_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "invoices_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      kb_articles: {
        Row: {
          id: string
          title: string
          content: string
          category: string
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          category?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string
          created_at?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          id: string
          title: string
          content: string
          category: string | null
          embedding: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          category?: string | null
          embedding?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string | null
          embedding?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      landlord_accounts: {
        Row: {
          id: string
          name: string
          inn: string | null
          kpp: string | null
          ogrn: string | null
          legal_address: string | null
          bank_name: string | null
          bik: string | null
          account: string | null
          corr_account: string | null
          is_default: boolean | null
          active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          legal_address?: string | null
          bank_name?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          is_default?: boolean | null
          active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          legal_address?: string | null
          bank_name?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          is_default?: boolean | null
          active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      landlords: {
        Row: {
          id: string
          name: string
          inn: string | null
          ogrn: string | null
          legal_address: string | null
          bank_name: string | null
          bik: string | null
          account: string | null
          corr_account: string | null
          phone: string | null
          email: string | null
          is_default: boolean | null
          active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          inn?: string | null
          ogrn?: string | null
          legal_address?: string | null
          bank_name?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          phone?: string | null
          email?: string | null
          is_default?: boolean | null
          active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          inn?: string | null
          ogrn?: string | null
          legal_address?: string | null
          bank_name?: string | null
          bik?: string | null
          account?: string | null
          corr_account?: string | null
          phone?: string | null
          email?: string | null
          is_default?: boolean | null
          active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      lease_lines: {
        Row: {
          id: string
          lease_id: string
          article_code: string
          unit_id: string | null
          unit_label: string | null
          area: number | null
          rate_per_sqm: number | null
          amount: number
          valid_from: string
          valid_to: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lease_id: string
          article_code: string
          unit_id?: string | null
          unit_label?: string | null
          area?: number | null
          rate_per_sqm?: number | null
          amount: number
          valid_from: string
          valid_to?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lease_id?: string
          article_code?: string
          unit_id?: string | null
          unit_label?: string | null
          area?: number | null
          rate_per_sqm?: number | null
          amount?: number
          valid_from?: string
          valid_to?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "lease_lines_article_code_fkey"
          columns: ["article_code"]
          isOneToOne: false
          referencedRelation: "accounting_articles"
          referencedColumns: ["code"]
        },
        {
          foreignKeyName: "lease_lines_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "lease_lines_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      leases: {
        Row: {
          id: string
          tenant_id: string | null
          unit_id: string | null
          start_date: string | null
          end_date: string | null
          rent: number | null
          deposit: number | null
          deposit_paid: boolean | null
          status: string | null
          created_at: string | null
          number: string | null
          payment_day: number
          deposit_required: number
          billing_mode: string
          penalty_enabled: boolean
          penalty_rate: number
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          start_date?: string | null
          end_date?: string | null
          rent?: number | null
          deposit?: number | null
          deposit_paid?: boolean | null
          status?: string | null
          created_at?: string | null
          number?: string | null
          payment_day?: number
          deposit_required?: number
          billing_mode?: string
          penalty_enabled?: boolean
          penalty_rate?: number
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          start_date?: string | null
          end_date?: string | null
          rent?: number | null
          deposit?: number | null
          deposit_paid?: boolean | null
          status?: string | null
          created_at?: string | null
          number?: string | null
          payment_day?: number
          deposit_required?: number
          billing_mode?: string
          penalty_enabled?: boolean
          penalty_rate?: number
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "leases_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "leases_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      ledger_entries: {
        Row: {
          id: string
          tenant_id: string | null
          inn: string | null
          contract_1c_id: string | null
          contract_name: string | null
          kind: string
          doc_type: string | null
          doc_number: string | null
          date: string
          charged: number
          paid: number
          source: string
          note: string | null
          created_at: string | null
          counterparty_1c_id: string | null
        }
        Insert: {
          id: string
          tenant_id?: string | null
          inn?: string | null
          contract_1c_id?: string | null
          contract_name?: string | null
          kind: string
          doc_type?: string | null
          doc_number?: string | null
          date: string
          charged?: number
          paid?: number
          source?: string
          note?: string | null
          created_at?: string | null
          counterparty_1c_id?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          inn?: string | null
          contract_1c_id?: string | null
          contract_name?: string | null
          kind?: string
          doc_type?: string | null
          doc_number?: string | null
          date?: string
          charged?: number
          paid?: number
          source?: string
          note?: string | null
          created_at?: string | null
          counterparty_1c_id?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "ledger_entries_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      ledger_postings: {
        Row: {
          id: number
          date: string
          tenant_id: string
          lease_id: string | null
          register: string
          article_code: string | null
          period: string | null
          debit: number
          credit: number
          doc_type: string
          doc_id: string
          created_at: string
        }
        Insert: {
          id?: number
          date: string
          tenant_id: string
          lease_id?: string | null
          register: string
          article_code?: string | null
          period?: string | null
          debit?: number
          credit?: number
          doc_type: string
          doc_id: string
          created_at?: string
        }
        Update: {
          id?: number
          date?: string
          tenant_id?: string
          lease_id?: string | null
          register?: string
          article_code?: string | null
          period?: string | null
          debit?: number
          credit?: number
          doc_type?: string
          doc_id?: string
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "ledger_postings_article_code_fkey"
          columns: ["article_code"]
          isOneToOne: false
          referencedRelation: "accounting_articles"
          referencedColumns: ["code"]
        },
        {
          foreignKeyName: "ledger_postings_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "ledger_postings_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      letters: {
        Row: {
          id: string
          type: string
          status: string | null
          subject: string | null
          body: string | null
          sender: string | null
          recipient: string | null
          tenant_id: string | null
          date: string | null
          file_url: string | null
          ai_summary: string | null
          ai_action: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          type: string
          status?: string | null
          subject?: string | null
          body?: string | null
          sender?: string | null
          recipient?: string | null
          tenant_id?: string | null
          date?: string | null
          file_url?: string | null
          ai_summary?: string | null
          ai_action?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          type?: string
          status?: string | null
          subject?: string | null
          body?: string | null
          sender?: string | null
          recipient?: string | null
          tenant_id?: string | null
          date?: string | null
          file_url?: string | null
          ai_summary?: string | null
          ai_action?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "letters_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      meter_readings: {
        Row: {
          id: string
          meter_id: string | null
          reading: number
          previous_reading: number | null
          consumption: number | null
          amount: number | null
          reading_date: string | null
          photo_url: string | null
          recognized_by_ai: boolean | null
          created_at: string | null
          period: string | null
          prev_value: number | null
          curr_value: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          meter_id?: string | null
          reading: number
          previous_reading?: number | null
          consumption?: number | null
          amount?: number | null
          reading_date?: string | null
          photo_url?: string | null
          recognized_by_ai?: boolean | null
          created_at?: string | null
          period?: string | null
          prev_value?: number | null
          curr_value?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          meter_id?: string | null
          reading?: number
          previous_reading?: number | null
          consumption?: number | null
          amount?: number | null
          reading_date?: string | null
          photo_url?: string | null
          recognized_by_ai?: boolean | null
          created_at?: string | null
          period?: string | null
          prev_value?: number | null
          curr_value?: number | null
          notes?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "meter_readings_meter_id_fkey"
          columns: ["meter_id"]
          isOneToOne: false
          referencedRelation: "meters"
          referencedColumns: ["id"]
        }
      ]
      }
      meters: {
        Row: {
          id: string
          tenant_id: string | null
          unit_id: string | null
          type: string
          serial: string
          tariff: number | null
          created_at: string | null
          number: string | null
          location: string | null
          area: number | null
          heat_tariff: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          type: string
          serial: string
          tariff?: number | null
          created_at?: string | null
          number?: string | null
          location?: string | null
          area?: number | null
          heat_tariff?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          unit_id?: string | null
          type?: string
          serial?: string
          tariff?: number | null
          created_at?: string | null
          number?: string | null
          location?: string | null
          area?: number | null
          heat_tariff?: number | null
          notes?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "meters_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "meters_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      onec_article_rules: {
        Row: {
          id: number
          priority: number
          field: string
          pattern: string
          article_code: string
          note: string | null
        }
        Insert: {
          id?: number
          priority?: number
          field: string
          pattern: string
          article_code: string
          note?: string | null
        }
        Update: {
          id?: number
          priority?: number
          field?: string
          pattern?: string
          article_code?: string
          note?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "onec_article_rules_article_code_fkey"
          columns: ["article_code"]
          isOneToOne: false
          referencedRelation: "accounting_articles"
          referencedColumns: ["code"]
        }
      ]
      }
      onec_contracts: {
        Row: {
          import_id: string
          cp_id: string
          contract_id: string
          name: string | null
          number: string | null
          date: string | null
          kind: string | null
          debt: number
          advance: number
          deposit: number
          lease_id: string | null
          lease_match: string | null
        }
        Insert: {
          import_id: string
          cp_id: string
          contract_id: string
          name?: string | null
          number?: string | null
          date?: string | null
          kind?: string | null
          debt?: number
          advance?: number
          deposit?: number
          lease_id?: string | null
          lease_match?: string | null
        }
        Update: {
          import_id?: string
          cp_id?: string
          contract_id?: string
          name?: string | null
          number?: string | null
          date?: string | null
          kind?: string | null
          debt?: number
          advance?: number
          deposit?: number
          lease_id?: string | null
          lease_match?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "onec_contracts_import_id_fkey"
          columns: ["import_id"]
          isOneToOne: false
          referencedRelation: "onec_imports"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "onec_contracts_lease_id_fkey"
          columns: ["lease_id"]
          isOneToOne: false
          referencedRelation: "leases"
          referencedColumns: ["id"]
        }
      ]
      }
      onec_counterparties: {
        Row: {
          import_id: string
          cp_id: string
          name: string | null
          inn: string | null
          kpp: string | null
          debt: number
          advance: number
          deposit: number
          tenant_id: string | null
          match_by: string | null
        }
        Insert: {
          import_id: string
          cp_id: string
          name?: string | null
          inn?: string | null
          kpp?: string | null
          debt?: number
          advance?: number
          deposit?: number
          tenant_id?: string | null
          match_by?: string | null
        }
        Update: {
          import_id?: string
          cp_id?: string
          name?: string | null
          inn?: string | null
          kpp?: string | null
          debt?: number
          advance?: number
          deposit?: number
          tenant_id?: string | null
          match_by?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "onec_counterparties_import_id_fkey"
          columns: ["import_id"]
          isOneToOne: false
          referencedRelation: "onec_imports"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "onec_counterparties_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      onec_docs: {
        Row: {
          import_id: string
          cp_id: string
          contract_id: string
          doc_id: string
          type: string | null
          number: string | null
          date: string | null
          debt: number
          advance: number
          account: string | null
          lines: Json
        }
        Insert: {
          import_id: string
          cp_id: string
          contract_id: string
          doc_id: string
          type?: string | null
          number?: string | null
          date?: string | null
          debt?: number
          advance?: number
          account?: string | null
          lines?: Json
        }
        Update: {
          import_id?: string
          cp_id?: string
          contract_id?: string
          doc_id?: string
          type?: string | null
          number?: string | null
          date?: string | null
          debt?: number
          advance?: number
          account?: string | null
          lines?: Json
        }
        Relationships: [
        {
          foreignKeyName: "onec_docs_import_id_fkey"
          columns: ["import_id"]
          isOneToOne: false
          referencedRelation: "onec_imports"
          referencedColumns: ["id"]
        }
      ]
      }
      onec_imports: {
        Row: {
          id: string
          created_at: string
          created_by: string | null
          source: string
          as_of: string | null
          meta: Json | null
          totals: Json | null
          status: string
          transition_date: string | null
          posted_at: string | null
          posted_by: string | null
          post_result: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          created_by?: string | null
          source: string
          as_of?: string | null
          meta?: Json | null
          totals?: Json | null
          status?: string
          transition_date?: string | null
          posted_at?: string | null
          posted_by?: string | null
          post_result?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          created_by?: string | null
          source?: string
          as_of?: string | null
          meta?: Json | null
          totals?: Json | null
          status?: string
          transition_date?: string | null
          posted_at?: string | null
          posted_by?: string | null
          post_result?: Json | null
        }
        Relationships: []
      }
      onec_snapshot: {
        Row: {
          id: number
          fetched_at: string
          as_of: string | null
          data: Json
        }
        Insert: {
          id?: number
          fetched_at?: string
          as_of?: string | null
          data: Json
        }
        Update: {
          id?: number
          fetched_at?: string
          as_of?: string | null
          data?: Json
        }
        Relationships: []
      }
      payment_calendar: {
        Row: {
          id: string
          name: string
          amount: number
          due_date: string
          type: string
          status: string
          incoming_invoice_id: string | null
          regular_payment_id: string | null
          task_id: string | null
          building_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          amount?: number
          due_date: string
          type?: string
          status?: string
          incoming_invoice_id?: string | null
          regular_payment_id?: string | null
          task_id?: string | null
          building_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          amount?: number
          due_date?: string
          type?: string
          status?: string
          incoming_invoice_id?: string | null
          regular_payment_id?: string | null
          task_id?: string | null
          building_id?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "payment_calendar_incoming_invoice_id_fkey"
          columns: ["incoming_invoice_id"]
          isOneToOne: false
          referencedRelation: "incoming_invoices"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "payment_calendar_regular_payment_id_fkey"
          columns: ["regular_payment_id"]
          isOneToOne: false
          referencedRelation: "regular_payments"
          referencedColumns: ["id"]
        }
      ]
      }
      payments: {
        Row: {
          id: string
          tenant_id: string
          date: string
          amount: number
          type: string | null
          description: string | null
          bank_transaction_id: string | null
          invoice_id: string | null
          note: string | null
          created_at: string | null
          direction: string
          source: string
          purpose: string | null
          storno_of: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          date: string
          amount: number
          type?: string | null
          description?: string | null
          bank_transaction_id?: string | null
          invoice_id?: string | null
          note?: string | null
          created_at?: string | null
          direction?: string
          source?: string
          purpose?: string | null
          storno_of?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          date?: string
          amount?: number
          type?: string | null
          description?: string | null
          bank_transaction_id?: string | null
          invoice_id?: string | null
          note?: string | null
          created_at?: string | null
          direction?: string
          source?: string
          purpose?: string | null
          storno_of?: string | null
          created_by?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "payments_bank_transaction_id_fkey"
          columns: ["bank_transaction_id"]
          isOneToOne: false
          referencedRelation: "bank_transactions"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "payments_invoice_id_fkey"
          columns: ["invoice_id"]
          isOneToOne: false
          referencedRelation: "invoices"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "payments_storno_of_fkey"
          columns: ["storno_of"]
          isOneToOne: false
          referencedRelation: "payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "payments_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      premise_rents: {
        Row: {
          id: string
          premise_id: string | null
          monthly_rent: number | null
          cleaning_fee: number | null
          valid_from: string | null
          valid_to: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          premise_id?: string | null
          monthly_rent?: number | null
          cleaning_fee?: number | null
          valid_from?: string | null
          valid_to?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          premise_id?: string | null
          monthly_rent?: number | null
          cleaning_fee?: number | null
          valid_from?: string | null
          valid_to?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "premise_rents_premise_id_fkey"
          columns: ["premise_id"]
          isOneToOne: false
          referencedRelation: "tenant_premises"
          referencedColumns: ["id"]
        }
      ]
      }
      profiles: {
        Row: {
          user_id: string
          email: string | null
          full_name: string
          role: string
          created_at: string
        }
        Insert: {
          user_id: string
          email?: string | null
          full_name?: string
          role?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          email?: string | null
          full_name?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
      push_outbox: {
        Row: {
          id: number
          audience: string
          tenant_id: string | null
          title: string
          body: string | null
          url: string | null
          tag: string | null
          created_at: string
          sent_at: string | null
          delivered: number | null
          error: string | null
        }
        Insert: {
          audience: string
          tenant_id?: string | null
          title: string
          body?: string | null
          url?: string | null
          tag?: string | null
          created_at?: string
          sent_at?: string | null
          delivered?: number | null
          error?: string | null
        }
        Update: {
          audience?: string
          tenant_id?: string | null
          title?: string
          body?: string | null
          url?: string | null
          tag?: string | null
          created_at?: string
          sent_at?: string | null
          delivered?: number | null
          error?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "push_outbox_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          kind: string
          tenant_id: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          last_ok_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          tenant_id?: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          last_ok_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          tenant_id?: string | null
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          last_ok_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "push_subscriptions_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      regular_payments: {
        Row: {
          id: string
          name: string
          amount: number
          day_of_month: number
          category: string | null
          description: string | null
          active: boolean
          building_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          amount?: number
          day_of_month?: number
          category?: string | null
          description?: string | null
          active?: boolean
          building_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          amount?: number
          day_of_month?: number
          category?: string | null
          description?: string | null
          active?: boolean
          building_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      rent_history: {
        Row: {
          id: string
          date: string | null
          amount: number | null
          note: string | null
          created_at: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          date?: string | null
          amount?: number | null
          note?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          date?: string | null
          amount?: number | null
          note?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "rent_history_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      repair_history: {
        Row: {
          id: string
          repair_id: string | null
          status: string | null
          comment: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          repair_id?: string | null
          status?: string | null
          comment?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          repair_id?: string | null
          status?: string | null
          comment?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "repair_history_repair_id_fkey"
          columns: ["repair_id"]
          isOneToOne: false
          referencedRelation: "repairs"
          referencedColumns: ["id"]
        }
      ]
      }
      repairs: {
        Row: {
          id: string
          number: number
          tenant_id: string | null
          unit_id: string | null
          category: string
          priority: string | null
          status: string | null
          description: string
          photos: string[] | null
          assignee_id: string | null
          due_date: string | null
          completed_date: string | null
          cost: number | null
          comment: string | null
          created_at: string | null
          photos_after: string[] | null
          accepted_at: string | null
        }
        Insert: {
          id?: string
          number?: number
          tenant_id?: string | null
          unit_id?: string | null
          category: string
          priority?: string | null
          status?: string | null
          description: string
          photos?: string[] | null
          assignee_id?: string | null
          due_date?: string | null
          completed_date?: string | null
          cost?: number | null
          comment?: string | null
          created_at?: string | null
          photos_after?: string[] | null
          accepted_at?: string | null
        }
        Update: {
          id?: string
          number?: number
          tenant_id?: string | null
          unit_id?: string | null
          category?: string
          priority?: string | null
          status?: string | null
          description?: string
          photos?: string[] | null
          assignee_id?: string | null
          due_date?: string | null
          completed_date?: string | null
          cost?: number | null
          comment?: string | null
          created_at?: string | null
          photos_after?: string[] | null
          accepted_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "repairs_assignee_id_fkey"
          columns: ["assignee_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "repairs_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "repairs_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      service_categories: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      service_units: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          name: string
          category: string | null
          description: string | null
          price: number | null
          unit: string | null
          vat: number | null
          created_at: string | null
          tenant_id: string | null
          active: boolean | null
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          description?: string | null
          price?: number | null
          unit?: string | null
          vat?: number | null
          created_at?: string | null
          tenant_id?: string | null
          active?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          description?: string | null
          price?: number | null
          unit?: string | null
          vat?: number | null
          created_at?: string | null
          tenant_id?: string | null
          active?: boolean | null
        }
        Relationships: [
        {
          foreignKeyName: "services_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      settings: {
        Row: {
          id: string
          key: string
          value: number
          description: string | null
          valid_from: string
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value: number
          description?: string | null
          valid_from?: string
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: number
          description?: string | null
          valid_from?: string
          created_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      site_leads: {
        Row: {
          id: string
          created_at: string
          name: string | null
          phone: string
          email: string | null
          message: string | null
          unit_number: string | null
          area_wanted: number | null
          source: string | null
          page_url: string | null
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          name?: string | null
          phone: string
          email?: string | null
          message?: string | null
          unit_number?: string | null
          area_wanted?: number | null
          source?: string | null
          page_url?: string | null
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string | null
          phone?: string
          email?: string | null
          message?: string | null
          unit_number?: string | null
          area_wanted?: number | null
          source?: string | null
          page_url?: string | null
          status?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          id: string
          full_name: string
          position: string | null
          phone: string | null
          email: string | null
          salary: number | null
          role: string | null
          status: string | null
          passport: string | null
          contract_url: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          full_name: string
          position?: string | null
          phone?: string | null
          email?: string | null
          salary?: number | null
          role?: string | null
          status?: string | null
          passport?: string | null
          contract_url?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          position?: string | null
          phone?: string | null
          email?: string | null
          salary?: number | null
          role?: string | null
          status?: string | null
          passport?: string | null
          contract_url?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          assignee_id: string | null
          status: string | null
          priority: string | null
          due_date: string | null
          created_at: string | null
          letter_id: string | null
          source: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          assignee_id?: string | null
          status?: string | null
          priority?: string | null
          due_date?: string | null
          created_at?: string | null
          letter_id?: string | null
          source?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          assignee_id?: string | null
          status?: string | null
          priority?: string | null
          due_date?: string | null
          created_at?: string | null
          letter_id?: string | null
          source?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "tasks_assignee_id_fkey"
          columns: ["assignee_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "tasks_letter_id_fkey"
          columns: ["letter_id"]
          isOneToOne: false
          referencedRelation: "letters"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_balances: {
        Row: {
          tenant_id: string
          debt: number
          advance: number
          as_of: string | null
          updated_at: string
        }
        Insert: {
          tenant_id: string
          debt?: number
          advance?: number
          as_of?: string | null
          updated_at?: string
        }
        Update: {
          tenant_id?: string
          debt?: number
          advance?: number
          as_of?: string | null
          updated_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "tenant_balances_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: true
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_contracts: {
        Row: {
          id: string
          tenant_id: string
          contract_type: string
          contract_number: string | null
          signed_date: string | null
          valid_from: string | null
          valid_to: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          contract_type?: string
          contract_number?: string | null
          signed_date?: string | null
          valid_from?: string | null
          valid_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          contract_type?: string
          contract_number?: string | null
          signed_date?: string | null
          valid_from?: string | null
          valid_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "tenant_contracts_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_documents: {
        Row: {
          id: string
          tenant_id: string
          doc_type: string
          file_name: string | null
          file_url: string | null
          notes: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          doc_type: string
          file_name?: string | null
          file_url?: string | null
          notes?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          doc_type?: string
          file_name?: string | null
          file_url?: string | null
          notes?: string | null
          uploaded_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "tenant_documents_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_notifications: {
        Row: {
          id: string
          tenant_id: string | null
          type: string
          title: string
          body: string | null
          is_read: boolean | null
          link: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          type: string
          title: string
          body?: string | null
          is_read?: boolean | null
          link?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          type?: string
          title?: string
          body?: string | null
          is_read?: boolean | null
          link?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "tenant_notifications_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_portal_access: {
        Row: {
          id: string
          tenant_id: string | null
          email: string
          password_hash: string | null
          invite_token: string | null
          invite_sent_at: string | null
          invite_expires_at: string | null
          status: string | null
          last_login_at: string | null
          session_token: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          email: string
          password_hash?: string | null
          invite_token?: string | null
          invite_sent_at?: string | null
          invite_expires_at?: string | null
          status?: string | null
          last_login_at?: string | null
          session_token?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          email?: string
          password_hash?: string | null
          invite_token?: string | null
          invite_sent_at?: string | null
          invite_expires_at?: string | null
          status?: string | null
          last_login_at?: string | null
          session_token?: string | null
          created_at?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "tenant_portal_access_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: true
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_premises: {
        Row: {
          id: string
          tenant_id: string | null
          unit_number: string
          area_actual: number | null
          area_bti: number | null
          floor: number | null
          created_at: string | null
          unit_id: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          unit_number: string
          area_actual?: number | null
          area_bti?: number | null
          floor?: number | null
          created_at?: string | null
          unit_id?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          unit_number?: string
          area_actual?: number | null
          area_bti?: number | null
          floor?: number | null
          created_at?: string | null
          unit_id?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "tenant_premises_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "tenant_premises_unit_id_fkey"
          columns: ["unit_id"]
          isOneToOne: false
          referencedRelation: "units"
          referencedColumns: ["id"]
        }
      ]
      }
      tenant_users: {
        Row: {
          user_id: string
          tenant_id: string
          email: string | null
          invited_at: string | null
          activated_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          tenant_id: string
          email?: string | null
          invited_at?: string | null
          activated_at?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          tenant_id?: string
          email?: string | null
          invited_at?: string | null
          activated_at?: string | null
          created_at?: string
        }
        Relationships: [
        {
          foreignKeyName: "tenant_users_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
      tenants: {
        Row: {
          id: string
          full_name: string
          type: string | null
          inn: string | null
          kpp: string | null
          ogrn: string | null
          email: string | null
          phone: string | null
          legal_address: string | null
          bank_account: string | null
          bik: string | null
          bank_name: string | null
          status: string | null
          created_at: string | null
          building_id: string | null
          monthly_rent: number | null
          unit_number: string | null
          area_actual: number | null
          area_bti: number | null
          rate_per_sqm: number | null
          cleaning_fee: number | null
          cadastral_number: string | null
          contract_end_date: string | null
          blinds_type: string | null
          blinds_quantity: string | null
          blinds_owner: string | null
          activity_type: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          id_1c: string | null
          tenant_group: string | null
          ad_facade: number | null
          ad_stella: number | null
          ad_frame: number | null
          monthly_total: number | null
          contract_start_date: string | null
          contract_number: string | null
          correspondent_account: string | null
          director_name: string | null
          director_position: string | null
          director_basis: string | null
          passport_series: string | null
          passport_number: string | null
          passport_issued_by: string | null
          passport_issued_date: string | null
          onboarding_status: string | null
        }
        Insert: {
          id?: string
          full_name: string
          type?: string | null
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          email?: string | null
          phone?: string | null
          legal_address?: string | null
          bank_account?: string | null
          bik?: string | null
          bank_name?: string | null
          status?: string | null
          created_at?: string | null
          building_id?: string | null
          monthly_rent?: number | null
          unit_number?: string | null
          area_actual?: number | null
          area_bti?: number | null
          rate_per_sqm?: number | null
          cleaning_fee?: number | null
          cadastral_number?: string | null
          contract_end_date?: string | null
          blinds_type?: string | null
          blinds_quantity?: string | null
          blinds_owner?: string | null
          activity_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          id_1c?: string | null
          tenant_group?: string | null
          ad_facade?: number | null
          ad_stella?: number | null
          ad_frame?: number | null
          monthly_total?: number | null
          contract_start_date?: string | null
          contract_number?: string | null
          correspondent_account?: string | null
          director_name?: string | null
          director_position?: string | null
          director_basis?: string | null
          passport_series?: string | null
          passport_number?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          onboarding_status?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          type?: string | null
          inn?: string | null
          kpp?: string | null
          ogrn?: string | null
          email?: string | null
          phone?: string | null
          legal_address?: string | null
          bank_account?: string | null
          bik?: string | null
          bank_name?: string | null
          status?: string | null
          created_at?: string | null
          building_id?: string | null
          monthly_rent?: number | null
          unit_number?: string | null
          area_actual?: number | null
          area_bti?: number | null
          rate_per_sqm?: number | null
          cleaning_fee?: number | null
          cadastral_number?: string | null
          contract_end_date?: string | null
          blinds_type?: string | null
          blinds_quantity?: string | null
          blinds_owner?: string | null
          activity_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          id_1c?: string | null
          tenant_group?: string | null
          ad_facade?: number | null
          ad_stella?: number | null
          ad_frame?: number | null
          monthly_total?: number | null
          contract_start_date?: string | null
          contract_number?: string | null
          correspondent_account?: string | null
          director_name?: string | null
          director_position?: string | null
          director_basis?: string | null
          passport_series?: string | null
          passport_number?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          onboarding_status?: string | null
        }
        Relationships: [
        {
          foreignKeyName: "tenants_building_id_fkey"
          columns: ["building_id"]
          isOneToOne: false
          referencedRelation: "buildings"
          referencedColumns: ["id"]
        }
      ]
      }
      units: {
        Row: {
          id: string
          tenant_id: string | null
          number: string
          floor: number | null
          area: number | null
          rent: number | null
          cleaning: number | null
          created_at: string | null
          building_id: string | null
          has_window: boolean | null
          rooms_count: number | null
          type: string | null
          status: string | null
          rent_rate: number | null
          photos: string[] | null
          panorama_url: string | null
          description: string | null
          video_url: string | null
          is_published: boolean
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          number: string
          floor?: number | null
          area?: number | null
          rent?: number | null
          cleaning?: number | null
          created_at?: string | null
          building_id?: string | null
          has_window?: boolean | null
          rooms_count?: number | null
          type?: string | null
          status?: string | null
          rent_rate?: number | null
          photos?: string[] | null
          panorama_url?: string | null
          description?: string | null
          video_url?: string | null
          is_published?: boolean
        }
        Update: {
          id?: string
          tenant_id?: string | null
          number?: string
          floor?: number | null
          area?: number | null
          rent?: number | null
          cleaning?: number | null
          created_at?: string | null
          building_id?: string | null
          has_window?: boolean | null
          rooms_count?: number | null
          type?: string | null
          status?: string | null
          rent_rate?: number | null
          photos?: string[] | null
          panorama_url?: string | null
          description?: string | null
          video_url?: string | null
          is_published?: boolean
        }
        Relationships: [
        {
          foreignKeyName: "units_building_id_fkey"
          columns: ["building_id"]
          isOneToOne: false
          referencedRelation: "buildings"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "units_tenant_id_fkey"
          columns: ["tenant_id"]
          isOneToOne: false
          referencedRelation: "tenants"
          referencedColumns: ["id"]
        }
      ]
      }
    }
    Views: {
      v_charge_state: {
        Row: {
          id: string | null
          tenant_id: string | null
          lease_id: string | null
          article_code: string | null
          article_name: string | null
          grp: string | null
          register: string | null
          priority: number | null
          date: string | null
          period: string | null
          due_date: string | null
          description: string | null
          invoice_id: string | null
          source: string | null
          amount: number | null
          created_at: string | null
          effective_amount: number | null
          reversed: boolean | null
          paid: number | null
          open_amount: number | null
          days_overdue: number | null
        }
        Relationships: []
      }
      v_deposits: {
        Row: {
          lease_id: string | null
          tenant_id: string | null
          tenant_name: string | null
          number: string | null
          status: string | null
          deposit_required: number | null
          requested: number | null
          held: number | null
          shortfall: number | null
        }
        Relationships: []
      }
      v_invoice_state: {
        Row: {
          id: string | null
          tenant_id: string | null
          lease_id: string | null
          kind: string | null
          number: string | null
          date: string | null
          period: string | null
          due_date: string | null
          issue_status: string | null
          pdf_path: string | null
          created_at: string | null
          tenant_name: string | null
          total: number | null
          paid: number | null
          open_amount: number | null
          pay_status: string | null
        }
        Relationships: []
      }
      v_payment_state: {
        Row: {
          id: string | null
          tenant_id: string | null
          date: string | null
          amount: number | null
          direction: string | null
          source: string | null
          purpose: string | null
          description: string | null
          bank_transaction_id: string | null
          created_at: string | null
          reversed: boolean | null
          allocated: number | null
          free_amount: number | null
        }
        Relationships: []
      }
      v_tenant_documents: {
        Row: {
          tenant_id: string | null
          date: string | null
          created_at: string | null
          doc_type: string | null
          doc_id: string | null
          article_code: string | null
          article_name: string | null
          lease_id: string | null
          description: string | null
          charged: number | null
          paid: number | null
          invoice_id: string | null
          ref_id: string | null
          register: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_manual: {
        Args: {
          p_payment: string | null
          p_charge: string | null
          p_amount: number | null
        }
        Returns: string
      }
      allocate_tenant: {
        Args: {
          p_tenant: string | null
        }
        Returns: number
      }
      bank_assign: {
        Args: {
          p_tx: string | null
          p_tenant: string | null
          p_remember?: boolean | null
        }
        Returns: string
      }
      bank_credit: {
        Args: {
          p_tx: string | null
        }
        Returns: string
      }
      bank_identify: {
        Args: {
          p_tx: string | null
        }
        Returns: {
            tenant_id: string
            reason: string
          }[]
      }
      bank_ignore: {
        Args: {
          p_tx: string | null
          p_note: string | null
        }
        Returns: undefined
      }
      bank_import: {
        Args: {
          p_file: Json | null
        }
        Returns: Json
      }
      bank_mark_expense: {
        Args: {
          p_tx: string | null
          p_invoice: string | null
        }
        Returns: undefined
      }
      billing_lines: {
        Args: {
          p_period: string | null
        }
        Returns: {
            tenant_id: string
            tenant_name: string
            lease_id: string
            article_code: string
            amount: number
            due_date: string
            description: string
            basis: Json
            billing_key: string
            kind: string
            already: boolean
          }[]
      }
      billing_missing_readings: {
        Args: {
          p_period: string | null
        }
        Returns: {
            tenant_id: string
            tenant_name: string
            meter_id: string
            meter_type: string
            meter_label: string
          }[]
      }
      billing_post: {
        Args: {
          p_period: string | null
        }
        Returns: Json
      }
      cancel_allocation: {
        Args: {
          p_allocation: string | null
          p_reason: string | null
        }
        Returns: undefined
      }
      crm_funnel: {
        Args: {
          p_from: string | null
          p_to: string | null
        }
        Returns: {
            source: string
            deals: number
            viewings: number
            contracts: number
            won: number
            lost: number
            avg_days_to_won: number
          }[]
      }
      crm_sync_renewals: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      crm_vacancy: {
        Args: Record<PropertyKey, never>
        Returns: {
            unit_id: string
            number: string
            floor: number
            area: number
            free_since: string
            days_free: number
            open_deals: number
          }[]
      }
      deposit_offset: {
        Args: {
          p_lease: string | null
          p_charge: string | null
          p_amount: number | null
          p_reason: string | null
        }
        Returns: string
      }
      deposit_require: {
        Args: {
          p_lease: string | null
          p_amount: number | null
          p_due: string | null
          p_reason: string | null
        }
        Returns: string
      }
      inventory_adjust: {
        Args: {
          p_item: string | null
          p_available: number | null
          p_total?: number | null
        }
        Returns: number
      }
      is_staff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      ledger_turnover: {
        Args: {
          p_from: string | null
          p_to: string | null
          p_tenant?: string | null
        }
        Returns: {
            tenant_id: string
            tenant_name: string
            register: string
            article_code: string
            article_name: string
            grp: string
            lease_id: string
            opening: number
            debit: number
            credit: number
            closing: number
          }[]
      }
      my_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      onec_apply_contracts: {
        Args: {
          p_import: string | null
        }
        Returns: Json
      }
      onec_link_contract: {
        Args: {
          p_import: string | null
          p_cp: string | null
          p_contract: string | null
          p_lease: string | null
        }
        Returns: undefined
      }
      onec_link_tenant: {
        Args: {
          p_import: string | null
          p_cp: string | null
          p_tenant: string | null
        }
        Returns: undefined
      }
      onec_opening_lines: {
        Args: {
          p_import: string | null
        }
        Returns: {
            cp_id: string
            cp_name: string
            tenant_id: string
            tenant_name: string
            contract_id: string
            contract_name: string
            lease_id: string
            doc_id: string
            doc_label: string
            kind: string
            article_code: string
            article_name: string
            amount: number
            rule: string
          }[]
      }
      onec_opening_post: {
        Args: {
          p_import: string | null
          p_date: string | null
        }
        Returns: Json
      }
      onec_opening_storno: {
        Args: {
          p_import: string | null
          p_reason: string | null
        }
        Returns: number
      }
      onec_reconcile: {
        Args: {
          p_import: string | null
          p_date: string | null
        }
        Returns: {
            tenant_id: string
            tenant_name: string
            cp_names: string
            inn: string
            onec_balance: number
            onec_deposit: number
            mayak_balance: number
            mayak_deposit: number
            diff: number
            diff_deposit: number
            status: string
          }[]
      }
      onec_stage: {
        Args: {
          p: Json | null
        }
        Returns: string
      }
      onec_tenants_missing: {
        Args: {
          p_import: string | null
        }
        Returns: {
            tenant_id: string
            full_name: string
            inn: string
            id_1c: string
            status: string
            leases: number
          }[]
      }
      post_charge: {
        Args: {
          p_tenant: string | null
          p_lease: string | null
          p_article: string | null
          p_amount: number | null
          p_due: string | null
          p_period?: string | null
          p_description?: string | null
          p_date?: string | null
        }
        Returns: string
      }
      post_opening_balance: {
        Args: {
          p_tenant: string | null
          p_date: string | null
          p_amount: number | null
          p_note?: string | null
        }
        Returns: string
      }
      post_payment: {
        Args: {
          p_tenant: string | null
          p_date: string | null
          p_amount: number | null
          p_source?: string | null
          p_purpose?: string | null
          p_bank_tx?: string | null
        }
        Returns: string
      }
      push_claim: {
        Args: {
          p_limit?: number | null
        }
        Returns: Database['public']['Tables']['push_outbox']['Row'][]
      }
      refund: {
        Args: {
          p_tenant: string | null
          p_from: string | null
          p_amount: number | null
          p_date: string | null
          p_reason: string | null
          p_lease?: string | null
        }
        Returns: string
      }
      schema_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      search_knowledge: {
        Args: {
          query_embedding: string | null
          match_count?: number | null
        }
        Returns: {
            id: string
            title: string
            content: string
            category: string
            similarity: number
          }[]
      }
      staff_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      storno_charge: {
        Args: {
          p_charge: string | null
          p_reason: string | null
        }
        Returns: string
      }
      storno_payment: {
        Args: {
          p_payment: string | null
          p_reason: string | null
        }
        Returns: string
      }
      tenant_saldo: {
        Args: Record<PropertyKey, never>
        Returns: {
            tenant_id: string
            tenant_name: string
            inn: string
            email: string
            debt: number
            advance: number
            deposit: number
            balance: number
            overdue: number
            max_days_overdue: number
            oldest_due: string
            last_payment_date: string
            last_payment_amount: number
            articles: Json
          }[]
      }
      verify_ledger: {
        Args: Record<PropertyKey, never>
        Returns: {
            problem: string
            tenant_id: string
            register: string
            key: string
            from_documents: number
            from_postings: number
          }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables'] | keyof PublicSchema['Views']> =
  T extends keyof PublicSchema['Tables'] ? PublicSchema['Tables'][T]['Row']
  : T extends keyof PublicSchema['Views'] ? PublicSchema['Views'][T]['Row'] : never
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Rpc<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns']
