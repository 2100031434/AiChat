// Hand-written mirror of supabase/schema.sql — kept minimal on purpose.
// If the schema changes, update this alongside it.
//
// Shape (Row/Insert/Update/Relationships on tables, Row/Relationships on
// views, Tables/Views/Functions on the schema) matches what
// @supabase/postgrest-js's GenericTable/GenericSchema expect — without it,
// `.insert()`/`.update()` silently fall back to `never` instead of erroring
// on typos, since the Database type no longer structurally matches.
export interface Database {
  public: {
    Tables: {
      model_pricing: {
        Row: {
          model_id: string;
          display_name: string;
          input_price_per_mtok: number;
          output_price_per_mtok: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          model_id: string;
          display_name: string;
          input_price_per_mtok: number;
          output_price_per_mtok: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["model_pricing"]["Insert"]>;
        Relationships: [];
      };
      usage_logs: {
        Row: {
          id: string;
          created_at: string;
          model_id: string;
          request_type: "text" | "pdf";
          status: "success" | "error";
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          cost_usd: number;
          latency_ms: number | null;
          input_preview: string | null;
          output_preview: string | null;
          error_message: string | null;
          user_id: string | null;
          guest_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          model_id: string;
          request_type: "text" | "pdf";
          status?: "success" | "error";
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          latency_ms?: number | null;
          input_preview?: string | null;
          output_preview?: string | null;
          error_message?: string | null;
          user_id?: string | null;
          guest_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["usage_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "usage_logs_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "model_pricing";
            referencedColumns: ["model_id"];
          },
          {
            foreignKeyName: "usage_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      usage_summary: {
        Row: {
          model_id: string;
          request_count: number;
          success_count: number;
          error_count: number;
          total_input_tokens: number;
          total_output_tokens: number;
          total_tokens: number;
          total_cost_usd: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
