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
          opportunity_id: string | null
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
          opportunity_id?: string | null
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
          opportunity_id?: string | null
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
          record_status?: Database["public"]["Enums"]["record_status"]
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
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
      resources: {
        Row: {
          advance_notice_hours: number | null
          agent_id: string | null
          availability: Database["public"]["Enums"]["resource_availability"]
          base_city: string | null
          category: Database["public"]["Enums"]["resource_category"]
          cities_served: string[]
          company_id: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          description: string | null
          destinations: string[]
          driver_first_name: string | null
          driver_last_name: string | null
          driver_user_id: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["company_kind"]
          luggage_capacity: number | null
          main_zone: string | null
          max_distance_km: number | null
          name: string
          notes: string | null
          operating_limit: number | null
          pax_capacity: number | null
          record_status: Database["public"]["Enums"]["record_status"]
          requires_advance_booking: boolean
          specialties: string[]
          state: string | null
          tourist_zones: string[]
          transport_service_types: Database["public"]["Enums"]["transport_service_type"][]
          unit_count: number | null
          updated_at: string
          user_id: string
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year: number | null
          whatsapp: string | null
          zones: string[]
        }
        Insert: {
          advance_notice_hours?: number | null
          agent_id?: string | null
          availability?: Database["public"]["Enums"]["resource_availability"]
          base_city?: string | null
          category?: Database["public"]["Enums"]["resource_category"]
          cities_served?: string[]
          company_id?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          destinations?: string[]
          driver_first_name?: string | null
          driver_last_name?: string | null
          driver_user_id?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          luggage_capacity?: number | null
          main_zone?: string | null
          max_distance_km?: number | null
          name: string
          notes?: string | null
          operating_limit?: number | null
          pax_capacity?: number | null
          record_status?: Database["public"]["Enums"]["record_status"]
          requires_advance_booking?: boolean
          specialties?: string[]
          state?: string | null
          tourist_zones?: string[]
          transport_service_types?: Database["public"]["Enums"]["transport_service_type"][]
          unit_count?: number | null
          updated_at?: string
          user_id: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year?: number | null
          whatsapp?: string | null
          zones?: string[]
        }
        Update: {
          advance_notice_hours?: number | null
          agent_id?: string | null
          availability?: Database["public"]["Enums"]["resource_availability"]
          base_city?: string | null
          category?: Database["public"]["Enums"]["resource_category"]
          cities_served?: string[]
          company_id?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          destinations?: string[]
          driver_first_name?: string | null
          driver_last_name?: string | null
          driver_user_id?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["company_kind"]
          luggage_capacity?: number | null
          main_zone?: string | null
          max_distance_km?: number | null
          name?: string
          notes?: string | null
          operating_limit?: number | null
          pax_capacity?: number | null
          record_status?: Database["public"]["Enums"]["record_status"]
          requires_advance_booking?: boolean
          specialties?: string[]
          state?: string | null
          tourist_zones?: string[]
          transport_service_types?: Database["public"]["Enums"]["transport_service_type"][]
          unit_count?: number | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
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
          origin: string | null
          pax_count: number | null
          payment_mode: Database["public"]["Enums"]["transport_payment_mode"]
          record_status: Database["public"]["Enums"]["record_status"]
          rejected_at: string | null
          rejection_reason: string | null
          service_date: string | null
          service_time: string | null
          service_type: Database["public"]["Enums"]["transport_service_type"]
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
          origin?: string | null
          pax_count?: number | null
          payment_mode?: Database["public"]["Enums"]["transport_payment_mode"]
          record_status?: Database["public"]["Enums"]["record_status"]
          rejected_at?: string | null
          rejection_reason?: string | null
          service_date?: string | null
          service_time?: string | null
          service_type?: Database["public"]["Enums"]["transport_service_type"]
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
          origin?: string | null
          pax_count?: number | null
          payment_mode?: Database["public"]["Enums"]["transport_payment_mode"]
          record_status?: Database["public"]["Enums"]["record_status"]
          rejected_at?: string | null
          rejection_reason?: string | null
          service_date?: string | null
          service_time?: string | null
          service_type?: Database["public"]["Enums"]["transport_service_type"]
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
      driver_service_context: {
        Args: never
        Returns: {
          booking_number: string
          client_name: string
          service_id: string
        }[]
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
      mark_notifications_read: { Args: { _ids: string[] }; Returns: number }
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
      app_role: "admin" | "agent" | "provider"
      booking_document_kind: "voucher" | "receipt" | "invoice" | "other"
      booking_payment_kind: "deposit" | "balance" | "other"
      booking_payment_status:
        | "pending"
        | "partial"
        | "paid"
        | "refunded"
        | "cancelled"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "reserved"
        | "voucher_issued"
        | "completed"
        | "cancelled"
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
      invitation_status: "pending" | "accepted" | "rejected" | "expired"
      lead_source:
        | "website"
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "google"
        | "referral"
        | "existing_client"
        | "other"
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
      app_role: ["admin", "agent", "provider"],
      booking_document_kind: ["voucher", "receipt", "invoice", "other"],
      booking_payment_kind: ["deposit", "balance", "other"],
      booking_payment_status: [
        "pending",
        "partial",
        "paid",
        "refunded",
        "cancelled",
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
      invitation_status: ["pending", "accepted", "rejected", "expired"],
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
