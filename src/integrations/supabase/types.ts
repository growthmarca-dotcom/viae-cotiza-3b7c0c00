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
      agents: {
        Row: {
          access_status: Database["public"]["Enums"]["agent_access_status"]
          auto_receive_leads: boolean
          availability: Database["public"]["Enums"]["agent_availability"]
          available_for_assignment: boolean
          city: string | null
          commission_currency: string
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          company: string | null
          country: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          invitation_expires_at: string | null
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          languages: string[]
          last_name: string | null
          linked_at: string | null
          linked_by: string | null
          main_zone: string | null
          max_active_clients: number | null
          max_open_opportunities: number | null
          notes: string | null
          priority: number
          specialties: string[]
          state: string | null
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          user_id: string | null
          wa_extension: string | null
          wa_number: string | null
          wa_status: Database["public"]["Enums"]["agent_wa_status"]
          whatsapp: string | null
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["agent_access_status"]
          auto_receive_leads?: boolean
          availability?: Database["public"]["Enums"]["agent_availability"]
          available_for_assignment?: boolean
          city?: string | null
          commission_currency?: string
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name: string
          id?: string
          invitation_expires_at?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          languages?: string[]
          last_name?: string | null
          linked_at?: string | null
          linked_by?: string | null
          main_zone?: string | null
          max_active_clients?: number | null
          max_open_opportunities?: number | null
          notes?: string | null
          priority?: number
          specialties?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id?: string | null
          wa_extension?: string | null
          wa_number?: string | null
          wa_status?: Database["public"]["Enums"]["agent_wa_status"]
          whatsapp?: string | null
        }
        Update: {
          access_status?: Database["public"]["Enums"]["agent_access_status"]
          auto_receive_leads?: boolean
          availability?: Database["public"]["Enums"]["agent_availability"]
          available_for_assignment?: boolean
          city?: string | null
          commission_currency?: string
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          invitation_expires_at?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          languages?: string[]
          last_name?: string | null
          linked_at?: string | null
          linked_by?: string | null
          main_zone?: string | null
          max_active_clients?: number | null
          max_open_opportunities?: number | null
          notes?: string | null
          priority?: number
          specialties?: string[]
          state?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id?: string | null
          wa_extension?: string | null
          wa_number?: string | null
          wa_status?: Database["public"]["Enums"]["agent_wa_status"]
          whatsapp?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      booking_checklist_items: {
        Row: {
          booking_id: string
          code: string
          completed_at: string | null
          created_at: string
          id: string
          is_critical: boolean
          label: string
          notes: string | null
          sort_order: number
          status: Database["public"]["Enums"]["checklist_item_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          code: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_critical?: boolean
          label: string
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["checklist_item_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          code?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_critical?: boolean
          label?: string
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["checklist_item_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_checklist_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_documents: {
        Row: {
          booking_id: string
          created_at: string
          file_path: string | null
          id: string
          kind: Database["public"]["Enums"]["booking_document_kind"]
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_document_kind"]
          notes?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_document_kind"]
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_incidents: {
        Row: {
          booking_id: string
          category: Database["public"]["Enums"]["incident_category"]
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["incident_priority"]
          reported_by: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["incident_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          kind: Database["public"]["Enums"]["booking_payment_kind"]
          method: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["booking_payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          booking_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_payment_kind"]
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["booking_payment_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_payment_kind"]
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["booking_payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_resources: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          booking_id: string
          created_at: string
          id: string
          notes: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          resource_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id: string
          created_at?: string
          id?: string
          notes?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          resource_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          resource_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_resources_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          company_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_service_kind"]
          notes: string | null
          organization_id: string | null
          provider_id: string | null
          provider_name: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          resource_id: string | null
          responsible_user_id: string | null
          service_date: string | null
          status: Database["public"]["Enums"]["booking_operation_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_service_kind"]
          notes?: string | null
          organization_id?: string | null
          provider_id?: string | null
          provider_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          resource_id?: string | null
          responsible_user_id?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["booking_operation_status"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_service_kind"]
          notes?: string | null
          organization_id?: string | null
          provider_id?: string | null
          provider_name?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          resource_id?: string | null
          responsible_user_id?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["booking_operation_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          actor_id: string | null
          booking_id: string
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          owner_id: string
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          owner_id: string
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          owner_id?: string
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number
          assigned_agent_id: string | null
          booking_number: string | null
          client_id: string
          client_status: Database["public"]["Enums"]["client_trip_status"]
          created_at: string
          currency: string
          destination: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          operation_status: Database["public"]["Enums"]["booking_operation_status"]
          operations_notes: string | null
          operations_owner_id: string | null
          operations_taken_at: string | null
          operations_updated_at: string | null
          opportunity_id: string | null
          organization_id: string | null
          provider_id: string | null
          provider_name: string | null
          provider_notes: string | null
          provider_reference: string | null
          quotation_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          status: Database["public"]["Enums"]["booking_status"]
          tracking_enabled: boolean
          tracking_token: string
          travel_end: string | null
          travel_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          assigned_agent_id?: string | null
          booking_number?: string | null
          client_id: string
          client_status?: Database["public"]["Enums"]["client_trip_status"]
          created_at?: string
          currency?: string
          destination?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          operation_status?: Database["public"]["Enums"]["booking_operation_status"]
          operations_notes?: string | null
          operations_owner_id?: string | null
          operations_taken_at?: string | null
          operations_updated_at?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_notes?: string | null
          provider_reference?: string | null
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          status?: Database["public"]["Enums"]["booking_status"]
          tracking_enabled?: boolean
          tracking_token?: string
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          assigned_agent_id?: string | null
          booking_number?: string | null
          client_id?: string
          client_status?: Database["public"]["Enums"]["client_trip_status"]
          created_at?: string
          currency?: string
          destination?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          operation_status?: Database["public"]["Enums"]["booking_operation_status"]
          operations_notes?: string | null
          operations_owner_id?: string | null
          operations_taken_at?: string | null
          operations_updated_at?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_notes?: string | null
          provider_reference?: string | null
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          status?: Database["public"]["Enums"]["booking_status"]
          tracking_enabled?: boolean
          tracking_token?: string
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          destination: string | null
          email: string | null
          full_name: string
          id: string
          last_name: string | null
          notes: string | null
          opportunity_status: Database["public"]["Enums"]["opportunity_status"]
          pax_count: number | null
          phone: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          travel_end: string | null
          travel_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          destination?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          opportunity_status?: Database["public"]["Enums"]["opportunity_status"]
          pax_count?: number | null
          phone?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          destination?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          opportunity_status?: Database["public"]["Enums"]["opportunity_status"]
          pax_count?: number | null
          phone?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commercial_agreements: {
        Row: {
          agent_id: string | null
          agreement_type: Database["public"]["Enums"]["agreement_type"]
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          organization_id: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          title: string | null
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          agent_id?: string | null
          agreement_type?: Database["public"]["Enums"]["agreement_type"]
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          agent_id?: string | null
          agreement_type?: Database["public"]["Enums"]["agreement_type"]
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_agreements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_events: {
        Row: {
          created_at: string
          data: Json
          entity: string | null
          entity_id: string | null
          error_message: string | null
          event_type: Database["public"]["Enums"]["communication_event_type"]
          id: string
          message: string
          owner_id: string | null
          phone: string | null
          recipient_name: string | null
          recipient_user_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          event_type: Database["public"]["Enums"]["communication_event_type"]
          id?: string
          message: string
          owner_id?: string | null
          phone?: string | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          entity?: string | null
          entity_id?: string | null
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["communication_event_type"]
          id?: string
          message?: string
          owner_id?: string | null
          phone?: string | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["company_kind"]
          name: string
          notes: string | null
          organization_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          name: string
          notes?: string | null
          organization_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          name?: string
          notes?: string | null
          organization_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          accent_color: string
          address: string | null
          analysis_currency: string
          company_name: string | null
          created_at: string
          email: string | null
          facebook: string | null
          footer_text: string | null
          id: string
          instagram: string | null
          lead_assignment_enabled: boolean
          lead_assignment_mode: Database["public"]["Enums"]["lead_assignment_mode"]
          lead_assignment_rules: Json
          linkedin: string | null
          logo_path: string | null
          primary_color: string
          show_developer_branding: boolean
          tiktok: string | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          analysis_currency?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          lead_assignment_enabled?: boolean
          lead_assignment_mode?: Database["public"]["Enums"]["lead_assignment_mode"]
          lead_assignment_rules?: Json
          linkedin?: string | null
          logo_path?: string | null
          primary_color?: string
          show_developer_branding?: boolean
          tiktok?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          analysis_currency?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          footer_text?: string | null
          id?: string
          instagram?: string | null
          lead_assignment_enabled?: boolean
          lead_assignment_mode?: Database["public"]["Enums"]["lead_assignment_mode"]
          lead_assignment_rules?: Json
          linkedin?: string | null
          logo_path?: string | null
          primary_color?: string
          show_developer_branding?: boolean
          tiktok?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          note: string | null
          quote_currency: string
          rate: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          note?: string | null
          quote_currency?: string
          rate: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          note?: string | null
          quote_currency?: string
          rate?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          owner_id: string
          to_status: Database["public"]["Enums"]["lead_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          owner_id: string
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          owner_id?: string
          to_status?: Database["public"]["Enums"]["lead_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          adults_count: number | null
          assigned_agent_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          budget_amount: number | null
          budget_currency: string
          children_ages: string | null
          children_count: number | null
          city: string | null
          client_id: string | null
          commercial_notes: string | null
          converted_at: string | null
          country: string | null
          created_at: string
          days_count: number | null
          destination: string | null
          email: string | null
          first_name: string
          id: string
          language: string | null
          last_activity_at: string
          last_name: string | null
          nights_count: number | null
          notes: string | null
          opportunity_id: string | null
          pax_count: number | null
          quotation_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          services_interest: string[]
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          travel_date: string | null
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          adults_count?: number | null
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          budget_amount?: number | null
          budget_currency?: string
          children_ages?: string | null
          children_count?: number | null
          city?: string | null
          client_id?: string | null
          commercial_notes?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          days_count?: number | null
          destination?: string | null
          email?: string | null
          first_name: string
          id?: string
          language?: string | null
          last_activity_at?: string
          last_name?: string | null
          nights_count?: number | null
          notes?: string | null
          opportunity_id?: string | null
          pax_count?: number | null
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          services_interest?: string[]
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          travel_date?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          adults_count?: number | null
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          budget_amount?: number | null
          budget_currency?: string
          children_ages?: string | null
          children_count?: number | null
          city?: string | null
          client_id?: string | null
          commercial_notes?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          days_count?: number | null
          destination?: string | null
          email?: string | null
          first_name?: string
          id?: string
          language?: string | null
          last_activity_at?: string
          last_name?: string | null
          nights_count?: number | null
          notes?: string | null
          opportunity_id?: string | null
          pax_count?: number | null
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          services_interest?: string[]
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          travel_date?: string | null
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          entity: string | null
          entity_id: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_agent_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          client_id: string
          created_at: string
          currency: string
          estimated_value: number
          id: string
          lead_source: Database["public"]["Enums"]["lead_source"]
          next_action: string | null
          next_contact_date: string | null
          notes: string | null
          owner_user_id: string
          probability: number
          quotation_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          client_id: string
          created_at?: string
          currency?: string
          estimated_value?: number
          id?: string
          lead_source?: Database["public"]["Enums"]["lead_source"]
          next_action?: string | null
          next_contact_date?: string | null
          notes?: string | null
          owner_user_id: string
          probability?: number
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          estimated_value?: number
          id?: string
          lead_source?: Database["public"]["Enums"]["lead_source"]
          next_action?: string | null
          next_contact_date?: string | null
          notes?: string | null
          owner_user_id?: string
          probability?: number
          quotation_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_path: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["record_status"]
          tax_condition: string | null
          tax_id: string | null
          tax_id_type: string | null
          trade_name: string
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_condition?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          trade_name: string
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_condition?: string | null
          tax_id?: string | null
          tax_id_type?: string | null
          trade_name?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      provider_evaluations: {
        Row: {
          compliance: number
          created_at: string
          id: string
          internal_rating: number
          notes: string | null
          provider_id: string
          punctuality: number
          quality: number
          response_time: number
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance?: number
          created_at?: string
          id?: string
          internal_rating?: number
          notes?: string | null
          provider_id: string
          punctuality?: number
          quality?: number
          response_time?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance?: number
          created_at?: string
          id?: string
          internal_rating?: number
          notes?: string | null
          provider_id?: string
          punctuality?: number
          quality?: number
          response_time?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_evaluations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_company: boolean
          legal_name: string | null
          notes: string | null
          operation_mode: Database["public"]["Enums"]["provider_operation_mode"]
          organization_id: string | null
          phone: string | null
          provider_type: Database["public"]["Enums"]["provider_type"]
          state: string | null
          status: Database["public"]["Enums"]["provider_status"]
          tax_condition: string | null
          tax_id: string | null
          trade_name: string
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_company?: boolean
          legal_name?: string | null
          notes?: string | null
          operation_mode?: Database["public"]["Enums"]["provider_operation_mode"]
          organization_id?: string | null
          phone?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"]
          state?: string | null
          status?: Database["public"]["Enums"]["provider_status"]
          tax_condition?: string | null
          tax_id?: string | null
          trade_name: string
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_company?: boolean
          legal_name?: string | null
          notes?: string | null
          operation_mode?: Database["public"]["Enums"]["provider_operation_mode"]
          organization_id?: string | null
          phone?: string | null
          provider_type?: Database["public"]["Enums"]["provider_type"]
          state?: string | null
          status?: Database["public"]["Enums"]["provider_status"]
          tax_condition?: string | null
          tax_id?: string | null
          trade_name?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_history: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json
          created_at: string
          id: string
          owner_id: string
          quotation_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          owner_id: string
          quotation_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: string
          owner_id?: string
          quotation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_history_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          accommodation_address: string | null
          accommodation_description: string | null
          accommodation_name: string | null
          accommodation_services: string | null
          archived: boolean
          cancellation_policy: string | null
          client_id: string | null
          created_at: string
          currency: string
          destination: string | null
          exchange_rate: number | null
          expires_at: string | null
          guest_email: string | null
          guest_first_name: string | null
          guest_last_name: string | null
          guest_whatsapp: string | null
          id: string
          images: string[]
          nights: number | null
          notes: string | null
          other_charges: number | null
          pax_count: number | null
          price_per_night: number | null
          share_token: string
          status: Database["public"]["Enums"]["quotation_status"]
          taxes: number | null
          title: string
          total_amount: number | null
          travel_end: string | null
          travel_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accommodation_address?: string | null
          accommodation_description?: string | null
          accommodation_name?: string | null
          accommodation_services?: string | null
          archived?: boolean
          cancellation_policy?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          exchange_rate?: number | null
          expires_at?: string | null
          guest_email?: string | null
          guest_first_name?: string | null
          guest_last_name?: string | null
          guest_whatsapp?: string | null
          id?: string
          images?: string[]
          nights?: number | null
          notes?: string | null
          other_charges?: number | null
          pax_count?: number | null
          price_per_night?: number | null
          share_token?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          taxes?: number | null
          title: string
          total_amount?: number | null
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accommodation_address?: string | null
          accommodation_description?: string | null
          accommodation_name?: string | null
          accommodation_services?: string | null
          archived?: boolean
          cancellation_policy?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          exchange_rate?: number | null
          expires_at?: string | null
          guest_email?: string | null
          guest_first_name?: string | null
          guest_last_name?: string | null
          guest_whatsapp?: string | null
          id?: string
          images?: string[]
          nights?: number | null
          notes?: string | null
          other_charges?: number | null
          pax_count?: number | null
          price_per_night?: number | null
          share_token?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          taxes?: number | null
          title?: string
          total_amount?: number | null
          travel_end?: string | null
          travel_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_availability_log: {
        Row: {
          actor_id: string | null
          created_at: string
          from_availability:
            | Database["public"]["Enums"]["resource_availability"]
            | null
          id: string
          note: string | null
          owner_id: string
          resource_id: string
          to_availability: Database["public"]["Enums"]["resource_availability"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_availability?:
            | Database["public"]["Enums"]["resource_availability"]
            | null
          id?: string
          note?: string | null
          owner_id: string
          resource_id: string
          to_availability: Database["public"]["Enums"]["resource_availability"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_availability?:
            | Database["public"]["Enums"]["resource_availability"]
            | null
          id?: string
          note?: string | null
          owner_id?: string
          resource_id?: string
          to_availability?: Database["public"]["Enums"]["resource_availability"]
        }
        Relationships: [
          {
            foreignKeyName: "resource_availability_log_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_extra_links: {
        Row: {
          created_at: string
          currency: string
          extra_cost: number | null
          extra_id: string
          id: string
          is_included: boolean
          notes: string | null
          quantity: number
          resource_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          extra_cost?: number | null
          extra_id: string
          id?: string
          is_included?: boolean
          notes?: string | null
          quantity?: number
          resource_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          extra_cost?: number | null
          extra_id?: string
          id?: string
          is_included?: boolean
          notes?: string | null
          quantity?: number
          resource_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_extra_links_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "resource_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_extra_links_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_extras: {
        Row: {
          cost: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_included: boolean
          name: string
          price: number | null
          quantity_available: number | null
          record_status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_included?: boolean
          name: string
          price?: number | null
          quantity_available?: number | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_included?: boolean
          name?: string
          price?: number | null
          quantity_available?: number | null
          record_status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          address: string | null
          advance_notice_hours: number | null
          agent_id: string | null
          availability: Database["public"]["Enums"]["resource_availability"]
          base_city: string | null
          cabin_luggage_capacity: number | null
          category: Database["public"]["Enums"]["resource_category"]
          cities_served: string[]
          company_id: string | null
          contact_name: string | null
          country: string | null
          coverage_scope: string | null
          created_at: string
          description: string | null
          destinations: string[]
          driver_first_name: string | null
          driver_last_name: string | null
          driver_user_id: string | null
          dropoff_location: string | null
          email: string | null
          geo_radius_km: number | null
          has_air_conditioning: boolean
          id: string
          is_accessible: boolean
          kind: Database["public"]["Enums"]["company_kind"]
          large_luggage_capacity: number | null
          latitude: number | null
          longitude: number | null
          luggage_capacity: number | null
          main_zone: string | null
          max_distance_km: number | null
          meeting_point: string | null
          name: string
          notes: string | null
          operating_limit: number | null
          operating_zone: string | null
          organization_id: string | null
          owner_company_id: string | null
          owner_name: string | null
          owner_type: Database["public"]["Enums"]["resource_owner_type"]
          pax_capacity: number | null
          pickup_location: string | null
          postal_code: string | null
          provider_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          rental_deposit_amount: number | null
          rental_deposit_currency: string
          rental_extra_km_cost: number | null
          rental_fuel_policy: string | null
          rental_included_km: number | null
          rental_license_required: string | null
          rental_min_age: number | null
          rental_requires_driver: boolean
          rental_vehicle_condition: string | null
          requires_advance_booking: boolean
          resource_class: Database["public"]["Enums"]["resource_class"]
          self_drive: boolean
          specialties: string[]
          state: string | null
          subtype: string | null
          tourist_zones: string[]
          transport_service_types: Database["public"]["Enums"]["transport_service_type"][]
          unit_count: number | null
          updated_at: string
          user_id: string
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_fuel: string | null
          vehicle_model: string | null
          vehicle_notes: string | null
          vehicle_plate: string | null
          vehicle_transmission: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_version: string | null
          vehicle_year: number | null
          whatsapp: string | null
          zones: string[]
        }
        Insert: {
          address?: string | null
          advance_notice_hours?: number | null
          agent_id?: string | null
          availability?: Database["public"]["Enums"]["resource_availability"]
          base_city?: string | null
          cabin_luggage_capacity?: number | null
          category?: Database["public"]["Enums"]["resource_category"]
          cities_served?: string[]
          company_id?: string | null
          contact_name?: string | null
          country?: string | null
          coverage_scope?: string | null
          created_at?: string
          description?: string | null
          destinations?: string[]
          driver_first_name?: string | null
          driver_last_name?: string | null
          driver_user_id?: string | null
          dropoff_location?: string | null
          email?: string | null
          geo_radius_km?: number | null
          has_air_conditioning?: boolean
          id?: string
          is_accessible?: boolean
          kind?: Database["public"]["Enums"]["company_kind"]
          large_luggage_capacity?: number | null
          latitude?: number | null
          longitude?: number | null
          luggage_capacity?: number | null
          main_zone?: string | null
          max_distance_km?: number | null
          meeting_point?: string | null
          name: string
          notes?: string | null
          operating_limit?: number | null
          operating_zone?: string | null
          organization_id?: string | null
          owner_company_id?: string | null
          owner_name?: string | null
          owner_type?: Database["public"]["Enums"]["resource_owner_type"]
          pax_capacity?: number | null
          pickup_location?: string | null
          postal_code?: string | null
          provider_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          rental_deposit_amount?: number | null
          rental_deposit_currency?: string
          rental_extra_km_cost?: number | null
          rental_fuel_policy?: string | null
          rental_included_km?: number | null
          rental_license_required?: string | null
          rental_min_age?: number | null
          rental_requires_driver?: boolean
          rental_vehicle_condition?: string | null
          requires_advance_booking?: boolean
          resource_class?: Database["public"]["Enums"]["resource_class"]
          self_drive?: boolean
          specialties?: string[]
          state?: string | null
          subtype?: string | null
          tourist_zones?: string[]
          transport_service_types?: Database["public"]["Enums"]["transport_service_type"][]
          unit_count?: number | null
          updated_at?: string
          user_id: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_fuel?: string | null
          vehicle_model?: string | null
          vehicle_notes?: string | null
          vehicle_plate?: string | null
          vehicle_transmission?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_version?: string | null
          vehicle_year?: number | null
          whatsapp?: string | null
          zones?: string[]
        }
        Update: {
          address?: string | null
          advance_notice_hours?: number | null
          agent_id?: string | null
          availability?: Database["public"]["Enums"]["resource_availability"]
          base_city?: string | null
          cabin_luggage_capacity?: number | null
          category?: Database["public"]["Enums"]["resource_category"]
          cities_served?: string[]
          company_id?: string | null
          contact_name?: string | null
          country?: string | null
          coverage_scope?: string | null
          created_at?: string
          description?: string | null
          destinations?: string[]
          driver_first_name?: string | null
          driver_last_name?: string | null
          driver_user_id?: string | null
          dropoff_location?: string | null
          email?: string | null
          geo_radius_km?: number | null
          has_air_conditioning?: boolean
          id?: string
          is_accessible?: boolean
          kind?: Database["public"]["Enums"]["company_kind"]
          large_luggage_capacity?: number | null
          latitude?: number | null
          longitude?: number | null
          luggage_capacity?: number | null
          main_zone?: string | null
          max_distance_km?: number | null
          meeting_point?: string | null
          name?: string
          notes?: string | null
          operating_limit?: number | null
          operating_zone?: string | null
          organization_id?: string | null
          owner_company_id?: string | null
          owner_name?: string | null
          owner_type?: Database["public"]["Enums"]["resource_owner_type"]
          pax_capacity?: number | null
          pickup_location?: string | null
          postal_code?: string | null
          provider_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          rental_deposit_amount?: number | null
          rental_deposit_currency?: string
          rental_extra_km_cost?: number | null
          rental_fuel_policy?: string | null
          rental_included_km?: number | null
          rental_license_required?: string | null
          rental_min_age?: number | null
          rental_requires_driver?: boolean
          rental_vehicle_condition?: string | null
          requires_advance_booking?: boolean
          resource_class?: Database["public"]["Enums"]["resource_class"]
          self_drive?: boolean
          specialties?: string[]
          state?: string | null
          subtype?: string | null
          tourist_zones?: string[]
          transport_service_types?: Database["public"]["Enums"]["transport_service_type"][]
          unit_count?: number | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_fuel?: string | null
          vehicle_model?: string | null
          vehicle_notes?: string | null
          vehicle_plate?: string | null
          vehicle_transmission?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_version?: string | null
          vehicle_year?: number | null
          whatsapp?: string | null
          zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "resources_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_service_extras: {
        Row: {
          created_at: string
          extra_id: string
          id: string
          is_required: boolean
          notes: string | null
          quantity: number
          service_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_id: string
          id?: string
          is_required?: boolean
          notes?: string | null
          quantity?: number
          service_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_id?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          quantity?: number
          service_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_service_extras_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "resource_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_service_extras_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "transport_services"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_service_history: {
        Row: {
          actor_id: string | null
          comment: string | null
          created_at: string
          from_status:
            | Database["public"]["Enums"]["transport_service_status"]
            | null
          id: string
          owner_id: string
          service_id: string
          to_status: Database["public"]["Enums"]["transport_service_status"]
        }
        Insert: {
          actor_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["transport_service_status"]
            | null
          id?: string
          owner_id: string
          service_id: string
          to_status: Database["public"]["Enums"]["transport_service_status"]
        }
        Update: {
          actor_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["transport_service_status"]
            | null
          id?: string
          owner_id?: string
          service_id?: string
          to_status?: Database["public"]["Enums"]["transport_service_status"]
        }
        Relationships: [
          {
            foreignKeyName: "transport_service_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "transport_services"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_services: {
        Row: {
          accepted_at: string | null
          amount: number | null
          arrived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          booking_id: string | null
          city: string | null
          collected_amount: number | null
          collected_at: string | null
          collected_by: string | null
          collection_amount: number | null
          collection_currency: string
          collection_status: Database["public"]["Enums"]["transport_collection_status"]
          commission_type: Database["public"]["Enums"]["commission_type"] | null
          commission_value: number | null
          company_id: string | null
          completed_at: string | null
          cost_amount: number | null
          cost_currency: string
          cost_exchange_rate: number | null
          cost_rate_date: string | null
          country: string | null
          created_at: string
          currency: string
          destination: string | null
          driver_resource_id: string | null
          duration_minutes: number | null
          estimated_end_time: string | null
          id: string
          last_status_at: string
          last_updated_by: string | null
          luggage_count: number | null
          notes: string | null
          onboard_at: string | null
          organization_id: string | null
          origin: string | null
          pax_count: number | null
          payment_mode: Database["public"]["Enums"]["transport_payment_mode"]
          provider_id: string | null
          record_status: Database["public"]["Enums"]["record_status"]
          rejected_at: string | null
          rejection_reason: string | null
          sale_amount: number | null
          sale_currency: string
          sale_exchange_rate: number | null
          sale_rate_date: string | null
          service_date: string | null
          service_time: string | null
          service_type: Database["public"]["Enums"]["transport_service_type"]
          settled_at: string | null
          settled_by: string | null
          settlement_note: string | null
          settlement_status: Database["public"]["Enums"]["transport_settlement_status"]
          started_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["transport_service_status"]
          tourist_zone: string | null
          updated_at: string
          user_id: string
          vehicle_resource_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          booking_id?: string | null
          city?: string | null
          collected_amount?: number | null
          collected_at?: string | null
          collected_by?: string | null
          collection_amount?: number | null
          collection_currency?: string
          collection_status?: Database["public"]["Enums"]["transport_collection_status"]
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          company_id?: string | null
          completed_at?: string | null
          cost_amount?: number | null
          cost_currency?: string
          cost_exchange_rate?: number | null
          cost_rate_date?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          driver_resource_id?: string | null
          duration_minutes?: number | null
          estimated_end_time?: string | null
          id?: string
          last_status_at?: string
          last_updated_by?: string | null
          luggage_count?: number | null
          notes?: string | null
          onboard_at?: string | null
          organization_id?: string | null
          origin?: string | null
          pax_count?: number | null
          payment_mode?: Database["public"]["Enums"]["transport_payment_mode"]
          provider_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          rejected_at?: string | null
          rejection_reason?: string | null
          sale_amount?: number | null
          sale_currency?: string
          sale_exchange_rate?: number | null
          sale_rate_date?: string | null
          service_date?: string | null
          service_time?: string | null
          service_type?: Database["public"]["Enums"]["transport_service_type"]
          settled_at?: string | null
          settled_by?: string | null
          settlement_note?: string | null
          settlement_status?: Database["public"]["Enums"]["transport_settlement_status"]
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["transport_service_status"]
          tourist_zone?: string | null
          updated_at?: string
          user_id: string
          vehicle_resource_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          booking_id?: string | null
          city?: string | null
          collected_amount?: number | null
          collected_at?: string | null
          collected_by?: string | null
          collection_amount?: number | null
          collection_currency?: string
          collection_status?: Database["public"]["Enums"]["transport_collection_status"]
          commission_type?:
            | Database["public"]["Enums"]["commission_type"]
            | null
          commission_value?: number | null
          company_id?: string | null
          completed_at?: string | null
          cost_amount?: number | null
          cost_currency?: string
          cost_exchange_rate?: number | null
          cost_rate_date?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          driver_resource_id?: string | null
          duration_minutes?: number | null
          estimated_end_time?: string | null
          id?: string
          last_status_at?: string
          last_updated_by?: string | null
          luggage_count?: number | null
          notes?: string | null
          onboard_at?: string | null
          organization_id?: string | null
          origin?: string | null
          pax_count?: number | null
          payment_mode?: Database["public"]["Enums"]["transport_payment_mode"]
          provider_id?: string | null
          record_status?: Database["public"]["Enums"]["record_status"]
          rejected_at?: string | null
          rejection_reason?: string | null
          sale_amount?: number | null
          sale_currency?: string
          sale_exchange_rate?: number | null
          sale_rate_date?: string | null
          service_date?: string | null
          service_time?: string | null
          service_type?: Database["public"]["Enums"]["transport_service_type"]
          settled_at?: string | null
          settled_by?: string | null
          settlement_note?: string | null
          settlement_status?: Database["public"]["Enums"]["transport_settlement_status"]
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["transport_service_status"]
          tourist_zone?: string | null
          updated_at?: string
          user_id?: string
          vehicle_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_services_driver_resource_id_fkey"
            columns: ["driver_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_services_vehicle_resource_id_fkey"
            columns: ["vehicle_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admins_exist: { Args: never; Returns: boolean }
      booking_public_tracking: {
        Args: { _token: string }
        Returns: {
          booking_number: string
          client_status: Database["public"]["Enums"]["client_trip_status"]
          destination: string
          travel_end: string
          travel_start: string
          updated_at: string
        }[]
      }
      claim_admin_if_none: { Args: never; Returns: boolean }
      current_agent_id: { Args: never; Returns: string }
      current_driver_resource_ids: { Args: never; Returns: string[] }
      default_checklist_items: {
        Args: never
        Returns: {
          code: string
          is_critical: boolean
          label: string
          sort_order: number
        }[]
      }
      driver_service_context: {
        Args: never
        Returns: {
          booking_number: string
          client_name: string
          service_id: string
        }[]
      }
      ensure_provider_organization: {
        Args: { _provider_id: string }
        Returns: string
      }
      expire_stale_invitations: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      is_operations: { Args: { _user_id: string }; Returns: boolean }
      mark_notifications_read: { Args: { _ids: string[] }; Returns: number }
      notify_operations_team: {
        Args: {
          _body: string
          _data: Json
          _entity: string
          _entity_id: string
          _kind: string
          _owner: string
          _title: string
        }
        Returns: undefined
      }
      sync_booking_client_status: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      sync_transport_resource_state: {
        Args: { _resource_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "suspended"
      agent_access_status: "none" | "invited" | "linked"
      agent_availability: "available" | "busy" | "unavailable" | "off_hours"
      agent_status:
        | "pending"
        | "training"
        | "active"
        | "suspended"
        | "inactive"
        | "archived"
      agent_wa_status: "available" | "busy" | "offline"
      agreement_status:
        | "draft"
        | "active"
        | "expired"
        | "suspended"
        | "archived"
      agreement_type:
        | "commission_percentage"
        | "fixed_commission"
        | "net_rate"
        | "service_fee"
        | "custom"
      app_role: "admin" | "agent" | "provider" | "operations"
      booking_document_kind: "voucher" | "receipt" | "invoice" | "other"
      booking_operation_status:
        | "pending_operation"
        | "preparing"
        | "services_coordinated"
        | "ready"
        | "in_execution"
        | "finished"
        | "incident"
        | "cancelled"
      booking_payment_kind: "deposit" | "balance" | "other"
      booking_payment_status:
        | "pending"
        | "partial"
        | "paid"
        | "refunded"
        | "cancelled"
      booking_service_kind:
        | "accommodation"
        | "transfer"
        | "excursion"
        | "car_rental"
        | "flight"
        | "insurance"
        | "gastronomy"
        | "other"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "reserved"
        | "voucher_issued"
        | "completed"
        | "cancelled"
      checklist_item_status:
        | "pending"
        | "in_progress"
        | "done"
        | "not_applicable"
      client_trip_status:
        | "confirmed"
        | "driver_assigned"
        | "preparing"
        | "on_the_way"
        | "finished"
        | "cancelled"
      commission_type: "percentage" | "fixed"
      communication_event_status: "pending" | "sent" | "error"
      communication_event_type:
        | "trip_assigned"
        | "trip_reminder"
        | "schedule_changed"
        | "service_confirmed"
        | "trip_completed"
      company_kind: "internal" | "external"
      incident_category:
        | "flight"
        | "hotel"
        | "transfer"
        | "excursion"
        | "vehicle"
        | "driver"
        | "client"
        | "payment"
        | "documentation"
        | "provider"
        | "other"
      incident_priority: "low" | "medium" | "high" | "urgent"
      incident_status: "open" | "in_review" | "resolved" | "closed"
      invitation_status: "pending" | "accepted" | "rejected" | "expired"
      lead_assignment_mode: "manual" | "automatic"
      lead_source:
        | "website"
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "google"
        | "referral"
        | "existing_client"
        | "other"
      lead_status:
        | "new"
        | "unassigned"
        | "assigned"
        | "contacted"
        | "quoted"
        | "following_up"
        | "won"
        | "lost"
      opportunity_stage:
        | "new"
        | "contacted"
        | "quoted"
        | "following_up"
        | "negotiating"
        | "booked"
        | "completed"
        | "lost"
        | "cancelled"
      opportunity_status:
        | "new"
        | "contacted"
        | "quoted"
        | "negotiating"
        | "won"
        | "lost"
        | "confirmed"
        | "cancelled"
        | "expired"
      organization_role:
        | "provider"
        | "agency"
        | "wholesaler"
        | "corporate_client"
        | "partner"
      provider_operation_mode:
        | "manual"
        | "viae_portal"
        | "api"
        | "webhook"
        | "email"
        | "whatsapp"
        | "other"
      provider_status: "active" | "inactive" | "suspended" | "archived"
      provider_type:
        | "wholesaler"
        | "hotel"
        | "car_rental"
        | "transport_company"
        | "excursion_operator"
        | "independent_guide"
        | "gastronomy"
        | "nautical"
        | "air"
        | "ground"
        | "other"
      quotation_status:
        | "draft"
        | "sent"
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
      record_status: "active" | "archived" | "inactive" | "suspended"
      resource_availability:
        | "available"
        | "busy"
        | "unavailable"
        | "out_of_service"
        | "off_hours"
        | "assigned"
        | "reserved"
        | "in_service"
      resource_category:
        | "accommodation"
        | "room"
        | "vehicle"
        | "driver"
        | "taxi"
        | "transfer"
        | "excursion"
        | "guide"
        | "insurance"
        | "rental"
        | "tourism_service"
        | "agent"
        | "other"
      resource_class: "person" | "vehicle" | "company" | "equipment"
      resource_owner_type:
        | "viae"
        | "provider"
        | "partner_company"
        | "private"
        | "other"
      transport_collection_status:
        | "not_applicable"
        | "pending"
        | "collected"
        | "reported"
      transport_payment_mode:
        | "prepaid_viae"
        | "direct_to_driver"
        | "partial"
        | "pending"
      transport_service_status:
        | "pending"
        | "requested"
        | "assigned"
        | "accepted"
        | "in_transit"
        | "completed"
        | "cancelled"
        | "rejected"
        | "en_route"
        | "at_origin"
      transport_service_type:
        | "taxi"
        | "airport_transfer"
        | "tourist_transfer"
        | "intercity_transfer"
        | "private_transfer"
        | "corporate_transfer"
        | "group_transfer"
        | "driver_excursion"
        | "other"
      transport_settlement_status: "pending" | "in_review" | "settled"
      trip_type:
        | "vacation"
        | "family"
        | "adventure"
        | "honeymoon"
        | "corporate"
        | "getaway"
        | "other"
      vehicle_type:
        | "sedan"
        | "suv"
        | "van"
        | "minibus"
        | "bus"
        | "pickup"
        | "motorcycle"
        | "accessible"
        | "other"
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
      account_status: ["pending", "approved", "rejected", "suspended"],
      agent_access_status: ["none", "invited", "linked"],
      agent_availability: ["available", "busy", "unavailable", "off_hours"],
      agent_status: [
        "pending",
        "training",
        "active",
        "suspended",
        "inactive",
        "archived",
      ],
      agent_wa_status: ["available", "busy", "offline"],
      agreement_status: ["draft", "active", "expired", "suspended", "archived"],
      agreement_type: [
        "commission_percentage",
        "fixed_commission",
        "net_rate",
        "service_fee",
        "custom",
      ],
      app_role: ["admin", "agent", "provider", "operations"],
      booking_document_kind: ["voucher", "receipt", "invoice", "other"],
      booking_operation_status: [
        "pending_operation",
        "preparing",
        "services_coordinated",
        "ready",
        "in_execution",
        "finished",
        "incident",
        "cancelled",
      ],
      booking_payment_kind: ["deposit", "balance", "other"],
      booking_payment_status: [
        "pending",
        "partial",
        "paid",
        "refunded",
        "cancelled",
      ],
      booking_service_kind: [
        "accommodation",
        "transfer",
        "excursion",
        "car_rental",
        "flight",
        "insurance",
        "gastronomy",
        "other",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "reserved",
        "voucher_issued",
        "completed",
        "cancelled",
      ],
      checklist_item_status: [
        "pending",
        "in_progress",
        "done",
        "not_applicable",
      ],
      client_trip_status: [
        "confirmed",
        "driver_assigned",
        "preparing",
        "on_the_way",
        "finished",
        "cancelled",
      ],
      commission_type: ["percentage", "fixed"],
      communication_event_status: ["pending", "sent", "error"],
      communication_event_type: [
        "trip_assigned",
        "trip_reminder",
        "schedule_changed",
        "service_confirmed",
        "trip_completed",
      ],
      company_kind: ["internal", "external"],
      incident_category: [
        "flight",
        "hotel",
        "transfer",
        "excursion",
        "vehicle",
        "driver",
        "client",
        "payment",
        "documentation",
        "provider",
        "other",
      ],
      incident_priority: ["low", "medium", "high", "urgent"],
      incident_status: ["open", "in_review", "resolved", "closed"],
      invitation_status: ["pending", "accepted", "rejected", "expired"],
      lead_assignment_mode: ["manual", "automatic"],
      lead_source: [
        "website",
        "whatsapp",
        "instagram",
        "facebook",
        "google",
        "referral",
        "existing_client",
        "other",
      ],
      lead_status: [
        "new",
        "unassigned",
        "assigned",
        "contacted",
        "quoted",
        "following_up",
        "won",
        "lost",
      ],
      opportunity_stage: [
        "new",
        "contacted",
        "quoted",
        "following_up",
        "negotiating",
        "booked",
        "completed",
        "lost",
        "cancelled",
      ],
      opportunity_status: [
        "new",
        "contacted",
        "quoted",
        "negotiating",
        "won",
        "lost",
        "confirmed",
        "cancelled",
        "expired",
      ],
      organization_role: [
        "provider",
        "agency",
        "wholesaler",
        "corporate_client",
        "partner",
      ],
      provider_operation_mode: [
        "manual",
        "viae_portal",
        "api",
        "webhook",
        "email",
        "whatsapp",
        "other",
      ],
      provider_status: ["active", "inactive", "suspended", "archived"],
      provider_type: [
        "wholesaler",
        "hotel",
        "car_rental",
        "transport_company",
        "excursion_operator",
        "independent_guide",
        "gastronomy",
        "nautical",
        "air",
        "ground",
        "other",
      ],
      quotation_status: [
        "draft",
        "sent",
        "pending",
        "accepted",
        "rejected",
        "expired",
      ],
      record_status: ["active", "archived", "inactive", "suspended"],
      resource_availability: [
        "available",
        "busy",
        "unavailable",
        "out_of_service",
        "off_hours",
        "assigned",
        "reserved",
        "in_service",
      ],
      resource_category: [
        "accommodation",
        "room",
        "vehicle",
        "driver",
        "taxi",
        "transfer",
        "excursion",
        "guide",
        "insurance",
        "rental",
        "tourism_service",
        "agent",
        "other",
      ],
      resource_class: ["person", "vehicle", "company", "equipment"],
      resource_owner_type: [
        "viae",
        "provider",
        "partner_company",
        "private",
        "other",
      ],
      transport_collection_status: [
        "not_applicable",
        "pending",
        "collected",
        "reported",
      ],
      transport_payment_mode: [
        "prepaid_viae",
        "direct_to_driver",
        "partial",
        "pending",
      ],
      transport_service_status: [
        "pending",
        "requested",
        "assigned",
        "accepted",
        "in_transit",
        "completed",
        "cancelled",
        "rejected",
        "en_route",
        "at_origin",
      ],
      transport_service_type: [
        "taxi",
        "airport_transfer",
        "tourist_transfer",
        "intercity_transfer",
        "private_transfer",
        "corporate_transfer",
        "group_transfer",
        "driver_excursion",
        "other",
      ],
      transport_settlement_status: ["pending", "in_review", "settled"],
      trip_type: [
        "vacation",
        "family",
        "adventure",
        "honeymoon",
        "corporate",
        "getaway",
        "other",
      ],
      vehicle_type: [
        "sedan",
        "suv",
        "van",
        "minibus",
        "bus",
        "pickup",
        "motorcycle",
        "accessible",
        "other",
      ],
    },
  },
} as const
