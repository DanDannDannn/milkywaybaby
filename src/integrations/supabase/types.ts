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
      babies: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          name: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      baby_members: {
        Row: {
          baby_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["baby_role"]
          user_id: string
        }
        Insert: {
          baby_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["baby_role"]
          user_id: string
        }
        Update: {
          baby_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["baby_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "baby_members_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      diapers: {
        Row: {
          baby_id: string
          created_at: string
          id: string
          logged_by: string
          note: string | null
          occurred_at: string
          type: Database["public"]["Enums"]["diaper_type"]
          updated_at: string
        }
        Insert: {
          baby_id: string
          created_at?: string
          id?: string
          logged_by: string
          note?: string | null
          occurred_at?: string
          type: Database["public"]["Enums"]["diaper_type"]
          updated_at?: string
        }
        Update: {
          baby_id?: string
          created_at?: string
          id?: string
          logged_by?: string
          note?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["diaper_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diapers_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      feedings: {
        Row: {
          amount: number
          baby_id: string
          created_at: string
          id: string
          logged_by: string
          note: string | null
          occurred_at: string
          type: Database["public"]["Enums"]["feeding_type"]
          unit: Database["public"]["Enums"]["feeding_unit"]
          updated_at: string
        }
        Insert: {
          amount: number
          baby_id: string
          created_at?: string
          id?: string
          logged_by: string
          note?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["feeding_type"]
          unit?: Database["public"]["Enums"]["feeding_unit"]
          updated_at?: string
        }
        Update: {
          amount?: number
          baby_id?: string
          created_at?: string
          id?: string
          logged_by?: string
          note?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["feeding_type"]
          unit?: Database["public"]["Enums"]["feeding_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedings_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
      temperatures: {
        Row: {
          baby_id: string
          created_at: string
          id: string
          logged_by: string
          note: string | null
          occurred_at: string
          updated_at: string
          value_c: number
        }
        Insert: {
          baby_id: string
          created_at?: string
          id?: string
          logged_by: string
          note?: string | null
          occurred_at?: string
          updated_at?: string
          value_c: number
        }
        Update: {
          baby_id?: string
          created_at?: string
          id?: string
          logged_by?: string
          note?: string | null
          occurred_at?: string
          updated_at?: string
          value_c?: number
        }
        Relationships: [
          {
            foreignKeyName: "temperatures_baby_id_fkey"
            columns: ["baby_id"]
            isOneToOne: false
            referencedRelation: "babies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_baby_member: {
        Args: { _baby_id: string; _user_id: string }
        Returns: boolean
      }
      join_baby_by_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      baby_role: "owner" | "caregiver"
      diaper_type: "wet" | "dirty" | "mixed"
      feeding_type: "breast" | "formula"
      feeding_unit: "ml" | "oz"
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
      baby_role: ["owner", "caregiver"],
      diaper_type: ["wet", "dirty", "mixed"],
      feeding_type: ["breast", "formula"],
      feeding_unit: ["ml", "oz"],
    },
  },
} as const
