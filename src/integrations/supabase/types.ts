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
      attendance_records: {
        Row: {
          id: string
          member_id: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_record_status"]
          substitute_name: string | null
        }
        Insert: {
          id?: string
          member_id: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_record_status"]
          substitute_name?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_record_status"]
          substitute_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_records_member"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          is_test: boolean
          rejection_reason: string | null
          session_date: string
          status: Database["public"]["Enums"]["attendance_session_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          is_test?: boolean
          rejection_reason?: string | null
          session_date: string
          status?: Database["public"]["Enums"]["attendance_session_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          is_test?: boolean
          rejection_reason?: string | null
          session_date?: string
          status?: Database["public"]["Enums"]["attendance_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_attendance_sessions_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_attendance_records: {
        Row: {
          created_at: string
          id: string
          invitation_id: string
          invited_by: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_record_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_id: string
          invited_by: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_record_status"]
        }
        Update: {
          created_at?: string
          id?: string
          invitation_id?: string
          invited_by?: string
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "guest_attendance_records_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "visitor_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_attendance_records_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "guest_attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_attendance_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          is_test: boolean
          rejection_reason: string | null
          session_date: string
          status: Database["public"]["Enums"]["attendance_session_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          is_test?: boolean
          rejection_reason?: string | null
          session_date: string
          status?: Database["public"]["Enums"]["attendance_session_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          is_test?: boolean
          rejection_reason?: string | null
          session_date?: string
          status?: Database["public"]["Enums"]["attendance_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "guest_attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_attendance_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          attendance_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_value: number | null
          closing_date: string | null
          completion_date: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contribution_date: string
          created_at: string
          group_id: string
          id: string
          is_repeat_business: boolean | null
          meeting_date: string | null
          meeting_location: string | null
          meeting_member_id: string | null
          meeting_topics: string[] | null
          notes: string | null
          meeting_confirmation_status: string | null
          meeting_confirmed_by: string | null
          meeting_confirmed_at: string | null
          meeting_declined_by: string | null
          meeting_declined_at: string | null
          referral_action: Database["public"]["Enums"]["referral_action"] | null
          referral_category: string | null
          referral_description: string | null
          referral_status: Database["public"]["Enums"]["referral_status"] | null
          referred_to: string | null
          related_referral_id: string | null
          substitute_name: string | null
          temperature:
            | Database["public"]["Enums"]["referral_temperature"]
            | null
          type: Database["public"]["Enums"]["contribution_type"]
          ueg_points: number | null
          ueg_title: string | null
          ueg_type: Database["public"]["Enums"]["ueg_type"] | null
          ueg_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_value?: number | null
          closing_date?: string | null
          completion_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contribution_date?: string
          created_at?: string
          group_id: string
          id?: string
          is_repeat_business?: boolean | null
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_member_id?: string | null
          meeting_topics?: string[] | null
          notes?: string | null
          meeting_confirmation_status?: string | null
          meeting_confirmed_by?: string | null
          meeting_confirmed_at?: string | null
          meeting_declined_by?: string | null
          meeting_declined_at?: string | null
          referral_action?:
            | Database["public"]["Enums"]["referral_action"]
            | null
          referral_category?: string | null
          referral_description?: string | null
          referral_status?:
            | Database["public"]["Enums"]["referral_status"]
            | null
          referred_to?: string | null
          related_referral_id?: string | null
          substitute_name?: string | null
          temperature?:
            | Database["public"]["Enums"]["referral_temperature"]
            | null
          type: Database["public"]["Enums"]["contribution_type"]
          ueg_points?: number | null
          ueg_title?: string | null
          ueg_type?: Database["public"]["Enums"]["ueg_type"] | null
          ueg_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_value?: number | null
          closing_date?: string | null
          completion_date?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contribution_date?: string
          created_at?: string
          group_id?: string
          id?: string
          is_repeat_business?: boolean | null
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_member_id?: string | null
          meeting_topics?: string[] | null
          notes?: string | null
          meeting_confirmation_status?: string | null
          meeting_confirmed_by?: string | null
          meeting_confirmed_at?: string | null
          meeting_declined_by?: string | null
          meeting_declined_at?: string | null
          referral_action?:
            | Database["public"]["Enums"]["referral_action"]
            | null
          referral_category?: string | null
          referral_description?: string | null
          referral_status?:
            | Database["public"]["Enums"]["referral_status"]
            | null
          referred_to?: string | null
          related_referral_id?: string | null
          substitute_name?: string | null
          temperature?:
            | Database["public"]["Enums"]["referral_temperature"]
            | null
          type?: Database["public"]["Enums"]["contribution_type"]
          ueg_points?: number | null
          ueg_title?: string | null
          ueg_type?: Database["public"]["Enums"]["ueg_type"] | null
          ueg_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_related_referral_id_fkey"
            columns: ["related_referral_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contributions_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          thread_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          thread_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_threads: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          group_id: string
          id: string
          pinned: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          group_id: string
          id?: string
          pinned?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          pinned?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_threads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          registered_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          registered_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          registered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["event_type"]
          group_id: string
          id: string
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["event_type"]
          group_id: string
          id?: string
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          group_id?: string
          id?: string
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_events_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_group_members_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_rankings: {
        Row: {
          created_at: string
          deal_points: number
          group_id: string
          id: string
          indication_points: number
          is_archived: boolean
          is_locked: boolean
          member_id: string
          month: string
          position: number | null
          presence_points: number
          total_points: number
          tt_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_points?: number
          group_id: string
          id?: string
          indication_points?: number
          is_archived?: boolean
          is_locked?: boolean
          member_id: string
          month: string
          position?: number | null
          presence_points?: number
          total_points?: number
          tt_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_points?: number
          group_id?: string
          id?: string
          indication_points?: number
          is_archived?: boolean
          is_locked?: boolean
          member_id?: string
          month?: string
          position?: number | null
          presence_points?: number
          total_points?: number
          tt_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_monthly_rankings_profiles"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      term_commitment_versions: {
        Row: {
          content_markdown: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          version: number
        }
        Insert: {
          content_markdown: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          version: number
        }
        Update: {
          content_markdown?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_commitment_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      term_commitments: {
        Row: {
          cpf: string | null
          created_at: string
          declined_at: string | null
          id: string
          member_id: string
          pdf_path: string | null
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["term_commitment_status"]
          term_version_id: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          member_id: string
          pdf_path?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["term_commitment_status"]
          term_version_id: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          member_id?: string
          pdf_path?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["term_commitment_status"]
          term_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_commitments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_commitments_term_version_id_fkey"
            columns: ["term_version_id"]
            isOneToOne: false
            referencedRelation: "term_commitment_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_permissions: Json | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          gains_accomplishments: string | null
          gains_goals: string | null
          gains_interests: string | null
          gains_networks: string | null
          gains_skills: string | null
          id: string
          instagram_url: string | null
          keywords: string[] | null
          linkedin_url: string | null
          professional_title: string | null
          profile_completed: boolean | null
          status: string
          updated_at: string
          vcr_score: number | null
          video_url: string | null
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          admin_permissions?: Json | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          gains_accomplishments?: string | null
          gains_goals?: string | null
          gains_interests?: string | null
          gains_networks?: string | null
          gains_skills?: string | null
          id: string
          instagram_url?: string | null
          keywords?: string[] | null
          linkedin_url?: string | null
          professional_title?: string | null
          profile_completed?: boolean | null
          status?: string
          updated_at?: string
          vcr_score?: number | null
          video_url?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          admin_permissions?: Json | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          gains_accomplishments?: string | null
          gains_goals?: string | null
          gains_interests?: string | null
          gains_networks?: string | null
          gains_skills?: string | null
          id?: string
          instagram_url?: string | null
          keywords?: string[] | null
          linkedin_url?: string | null
          professional_title?: string | null
          profile_completed?: boolean | null
          status?: string
          updated_at?: string
          vcr_score?: number | null
          video_url?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_invitations: {
        Row: {
          created_at: string
          event_date: string
          group_id: string
          id: string
          invite_token: string
          invited_by: string
          status: Database["public"]["Enums"]["invitation_status"]
          visitor_email: string | null
          visitor_name: string
          visitor_profession: string | null
          visitor_whatsapp: string | null
          whatsapp_opened_at: string | null
        }
        Insert: {
          created_at?: string
          event_date: string
          group_id: string
          id?: string
          invite_token?: string
          invited_by: string
          status?: Database["public"]["Enums"]["invitation_status"]
          visitor_email?: string | null
          visitor_name: string
          visitor_profession?: string | null
          visitor_whatsapp?: string | null
          whatsapp_opened_at?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          group_id?: string
          id?: string
          invite_token?: string
          invited_by?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          visitor_email?: string | null
          visitor_name?: string
          visitor_profession?: string | null
          visitor_whatsapp?: string | null
          whatsapp_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_visitor_invitations_invited_by"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      broadcast_notification: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      create_notification: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      get_user_group_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_superadmins: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      send_term_commitment_notification: {
        Args: {
          _member_id: string
          _term_version_id: string
        }
        Returns: undefined
      }
      recalculate_ranking_positions: {
        Args: { _group_id: string; _month: string }
        Returns: undefined
      }
      resolve_one_to_one_contribution: {
        Args: { _accepted: boolean; _contribution_id: string }
        Returns: undefined
      }
      upsert_ranking_points: {
        Args: {
          _deal?: number
          _group_id: string
          _indication?: number
          _member_id: string
          _month: string
          _presence?: number
          _tt?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "member" | "group_leader" | "admin"
      attendance_record_status: "present" | "absent" | "substituted"
      attendance_session_status:
        | "test"
        | "pending_approval"
        | "approved"
        | "rejected"
      attendance_status: "present" | "absent" | "substituted"
      contribution_type:
        | "referral"
        | "onf"
        | "one_to_one"
        | "ueg"
        | "attendance"
      event_type:
        | "weekly_meeting"
        | "regional_event"
        | "training"
        | "guest_day"
        | "business_round"
      invitation_status: "pending" | "confirmed" | "declined"
      referral_action: "called" | "scheduled" | "email" | "in_person"
      referral_status: "new" | "pending" | "closed_won" | "closed_lost"
      referral_temperature: "hot" | "warm" | "cold"
      term_commitment_status: "pending" | "sent" | "signed" | "declined"
      ueg_type:
        | "article"
        | "podcast"
        | "book"
        | "msp_training"
        | "event"
        | "video"
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
      app_role: ["member", "group_leader", "admin"],
      attendance_record_status: ["present", "absent", "substituted"],
      attendance_session_status: [
        "test",
        "pending_approval",
        "approved",
        "rejected",
      ],
      attendance_status: ["present", "absent", "substituted"],
      contribution_type: ["referral", "onf", "one_to_one", "ueg", "attendance"],
      event_type: [
        "weekly_meeting",
        "regional_event",
        "training",
        "guest_day",
        "business_round",
      ],
      invitation_status: ["pending", "confirmed", "declined"],
      referral_action: ["called", "scheduled", "email", "in_person"],
      referral_status: ["new", "pending", "closed_won", "closed_lost"],
      referral_temperature: ["hot", "warm", "cold"],
      ueg_type: [
        "article",
        "podcast",
        "book",
        "msp_training",
        "event",
        "video",
      ],
    },
  },
} as const
