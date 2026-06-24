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
      account_reminders: {
        Row: {
          created_at: string
          due_at: string
          id: string
          invoice_id: string
          message: string
          next_remind_at: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          telegram_sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_at?: string
          id?: string
          invoice_id: string
          message: string
          next_remind_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          telegram_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          invoice_id?: string
          message?: string
          next_remind_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          telegram_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_followup_settings: {
        Row: {
          created_at: string
          id: number
          initial_delay_days: number
          snooze_days: number
          threshold_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          initial_delay_days?: number
          snooze_days?: number
          threshold_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          initial_delay_days?: number
          snooze_days?: number
          threshold_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          module: string
          user_id: string | null
          user_name: string
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          module: string
          user_id?: string | null
          user_name: string
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          module?: string
          user_id?: string | null
          user_name?: string
          user_role?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          critical_quantity: number
          daily_report_last_sent_date: string | null
          daily_report_time: string
          id: number
          low_stock_threshold: number
          org_address: string
          org_name: string
          org_phone: string
          show_sms_message: boolean
          updated_at: string
          whatsapp_message: string
        }
        Insert: {
          critical_quantity?: number
          daily_report_last_sent_date?: string | null
          daily_report_time?: string
          id?: number
          low_stock_threshold?: number
          org_address?: string
          org_name?: string
          org_phone?: string
          show_sms_message?: boolean
          updated_at?: string
          whatsapp_message?: string
        }
        Update: {
          critical_quantity?: number
          daily_report_last_sent_date?: string | null
          daily_report_time?: string
          id?: number
          low_stock_threshold?: number
          org_address?: string
          org_name?: string
          org_phone?: string
          show_sms_message?: boolean
          updated_at?: string
          whatsapp_message?: string
        }
        Relationships: []
      }
      customer_balances: {
        Row: {
          created_at: string
          current_balance: number
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          name?: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_notes: string | null
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_notes?: string | null
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_notes?: string | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      daily_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_name: string
          id: string
          image_path: string | null
          invoice_number: string | null
          notes: string | null
          payment_method: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_name: string
          id?: string
          image_path?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_name?: string
          id?: string
          image_path?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      house_cash_ops: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          notes: string | null
          op_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          notes?: string | null
          op_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          notes?: string | null
          op_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number | null
          amount_manual: boolean
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          image_path: string | null
          invoice_number: string
          last_reminder_at: string | null
          paid_amount: number
          paid_at: string | null
          payment_status: string
          printed_ttc: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          amount_manual?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          image_path?: string | null
          invoice_number: string
          last_reminder_at?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          printed_ttc?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          amount_manual?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          image_path?: string | null
          invoice_number?: string
          last_reminder_at?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_status?: string
          printed_ttc?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          enabled: boolean
          kind: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          kind: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          delivered_at: string | null
          delivery_invoice_number: string | null
          delivery_invoice_path: string | null
          delivery_notes: string | null
          delivery_started_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          details: string | null
          driver_name: string | null
          files: string[] | null
          id: string
          images: string[]
          invoiced_at: string | null
          pointeur_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          voice_note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivered_at?: string | null
          delivery_invoice_number?: string | null
          delivery_invoice_path?: string | null
          delivery_notes?: string | null
          delivery_started_at?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          details?: string | null
          driver_name?: string | null
          files?: string[] | null
          id?: string
          images?: string[]
          invoiced_at?: string | null
          pointeur_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          voice_note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivered_at?: string | null
          delivery_invoice_number?: string | null
          delivery_invoice_path?: string | null
          delivery_notes?: string | null
          delivery_started_at?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          details?: string | null
          driver_name?: string | null
          files?: string[] | null
          id?: string
          images?: string[]
          invoiced_at?: string | null
          pointeur_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          voice_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quantities: {
        Row: {
          category: string
          label: string
          min_quantity: number
          previous_quantity: number
          product_key: string
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          label: string
          min_quantity?: number
          previous_quantity?: number
          product_key: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          label?: string
          min_quantity?: number
          previous_quantity?: number
          product_key?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      receptions: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          goods_type: string
          id: string
          is_archived: boolean
          notes: string | null
          quantity: number
          supplier: string
          unit: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          goods_type: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          quantity: number
          supplier: string
          unit: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          goods_type?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          quantity?: number
          supplier?: string
          unit?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          module: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          module: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          module?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      temp_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          id: string
          kind: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          kind: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          id?: string
          kind?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          name: string
          tracking_url: string | null
          url_updated_at: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          tracking_url?: string | null
          url_updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tracking_url?: string | null
          url_updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: { p_message: string; p_order_id?: string; p_type: string }
        Returns: undefined
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
      app_role: "admin" | "employee" | "accountant" | "delivery" | "monitor"
      delivery_status: "new" | "in_progress" | "delivered" | "partial"
      invoice_status: "new" | "sent"
      order_status: "active" | "archived"
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
      app_role: ["admin", "employee", "accountant", "delivery", "monitor"],
      delivery_status: ["new", "in_progress", "delivered", "partial"],
      invoice_status: ["new", "sent"],
      order_status: ["active", "archived"],
    },
  },
} as const
