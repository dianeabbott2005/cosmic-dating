export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "chats_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversation_contexts: {
        Row: {
          ai_reengagement_attempts: number
          chat_id: string
          consecutive_negative_count: number
          context_summary: string | null
          current_threshold: number
          detailed_chat: string | null
          important_memories: string | null
          last_updated: string
        }
        Insert: {
          ai_reengagement_attempts?: number
          chat_id: string
          consecutive_negative_count?: number
          context_summary?: string | null
          current_threshold?: number
          detailed_chat?: string | null
          important_memories?: string | null
          last_updated?: string
        }
        Update: {
          ai_reengagement_attempts?: number
          chat_id?: string
          consecutive_negative_count?: number
          context_summary?: string | null
          current_threshold?: number
          detailed_chat?: string | null
          important_memories?: string | null
          last_updated?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_contexts_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      delayed_messages: {
        Row: {
          chat_id: string
          content: string
          context_update_payload: Json | null
          created_at: string | null
          id: string
          scheduled_send_time: string
          sender_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          chat_id: string
          content: string
          context_update_payload?: Json | null
          created_at?: string | null
          id?: string
          scheduled_send_time: string
          sender_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          chat_id?: string
          content?: string
          context_update_payload?: Json | null
          created_at?: string | null
          id?: string
          scheduled_send_time?: string
          sender_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delayed_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delayed_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      matches: {
        Row: {
          compatibility_score: number
          created_at: string
          id: string
          matched_user_id: string
          user_id: string
        }
        Insert: {
          compatibility_score: number
          created_at?: string
          id?: string
          matched_user_id: string
          user_id: string
        }
        Update: {
          compatibility_score?: number
          created_at?: string
          id?: string
          matched_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          is_processed: boolean | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          is_processed?: boolean | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          is_processed?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_chart: Json | null
          block_threshold: number
          created_at: string
          current_city: string | null
          current_country: string | null
          current_timezone: string | null
          date_of_birth: string
          email: string
          first_name: string
          gender: string
          has_agreed_to_terms: boolean | null
          id: string
          is_active: boolean | null
          last_name: string
          latitude: number | null
          longitude: number | null
          looking_for: string
          max_age: number
          min_age: number
          personality_prompt: string | null
          place_of_birth: string
          time_of_birth: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_chart?: Json | null
          block_threshold?: number
          created_at?: string
          current_city?: string | null
          current_country?: string | null
          current_timezone?: string | null
          date_of_birth: string
          email: string
          first_name: string
          gender: string
          has_agreed_to_terms?: boolean | null
          id?: string
          is_active?: boolean | null
          last_name: string
          latitude?: number | null
          longitude?: number | null
          looking_for: string
          max_age: number
          min_age: number
          personality_prompt?: string | null
          place_of_birth: string
          time_of_birth: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_chart?: Json | null
          block_threshold?: number
          created_at?: string
          current_city?: string | null
          current_country?: string | null
          current_timezone?: string | null
          date_of_birth?: string
          email?: string
          first_name?: string
          gender?: string
          has_agreed_to_terms?: boolean | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          latitude?: number | null
          longitude?: number | null
          looking_for?: string
          max_age?: number
          min_age?: number
          personality_prompt?: string | null
          place_of_birth?: string
          time_of_birth?: string
          timezone?: string | null
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
      create_bidirectional_match: {
        Args: {
          user1_uuid: string
          user2_uuid: string
          compatibility_score_val: number
        }
        Returns: undefined
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: Record<PropertyKey, never>
      }
      trigger_ai_chat_response: {
        Args: Record<PropertyKey, never>
        Returns: Record<PropertyKey, never>
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never