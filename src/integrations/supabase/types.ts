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
          tiktok?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
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
      claim_admin_if_none: { Args: never; Returns: boolean }
      current_agent_id: { Args: never; Returns: string }
      expire_stale_invitations: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "suspended"
      agent_access_status: "none" | "invited" | "linked"
      agent_status:
        | "pending"
        | "training"
        | "active"
        | "suspended"
        | "inactive"
        | "archived"
      agent_wa_status: "available" | "busy" | "offline"
      app_role: "admin" | "agent" | "provider"
      commission_type: "percentage" | "fixed"
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
      commission_type: ["percentage", "fixed"],
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
    },
  },
} as const
