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
      award_player_candidates: {
        Row: {
          aliases: string[]
          award_categories: string[]
          created_at: string
          display_name: string
          full_name: string
          id: string
          is_active: boolean
          position: string | null
          team_code: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          award_categories?: string[]
          created_at?: string
          display_name: string
          full_name: string
          id?: string
          is_active?: boolean
          position?: string | null
          team_code?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          award_categories?: string[]
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          is_active?: boolean
          position?: string | null
          team_code?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_player_candidates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      global_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participation_confirmations: {
        Row: {
          confirmed_at: string
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_visible: boolean
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_visible?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_visible?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          hidden_from_leaderboard: boolean
          hidden_from_leaderboard_at: string | null
          hidden_from_leaderboard_by: string | null
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          hidden_from_leaderboard?: boolean
          hidden_from_leaderboard_at?: string | null
          hidden_from_leaderboard_by?: string | null
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          hidden_from_leaderboard?: boolean
          hidden_from_leaderboard_at?: string | null
          hidden_from_leaderboard_by?: string | null
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          invite_code: string
          is_active: boolean
          name: string
          prediction_deadline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          invite_code: string
          is_active?: boolean
          name: string
          prediction_deadline: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          name?: string
          prediction_deadline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_cache: {
        Row: {
          group_id: string
          id: string
          rank: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          rank: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          rank?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_cache_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_tiebreaks: {
        Row: {
          created_at: string
          id: string
          ordered_team_ids: string[]
          reference: string
          resolved_by: string
          type: Database["public"]["Enums"]["tiebreak_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordered_team_ids: string[]
          reference: string
          resolved_by: string
          type: Database["public"]["Enums"]["tiebreak_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordered_team_ids?: string[]
          reference?: string
          resolved_by?: string
          type?: Database["public"]["Enums"]["tiebreak_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_tiebreaks_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_manual_tiebreaks: {
        Row: {
          created_at: string
          group_id: string
          id: string
          ordered_team_ids: string[]
          reference: string
          type: Database["public"]["Enums"]["tiebreak_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          ordered_team_ids: string[]
          reference: string
          type: Database["public"]["Enums"]["tiebreak_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          ordered_team_ids?: string[]
          reference?: string
          type?: Database["public"]["Enums"]["tiebreak_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_manual_tiebreaks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_manual_tiebreaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          entered_by: string
          id: string
          match_id: string
          team1_score: number
          team2_score: number
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          entered_by: string
          id?: string
          match_id: string
          team1_score: number
          team2_score: number
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          entered_by?: string
          id?: string
          match_id?: string
          team1_score?: number
          team2_score?: number
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          group_code: string | null
          id: string
          match_date: string
          match_number: number | null
          match_time: string
          round: Database["public"]["Enums"]["match_round"]
          sort_order: number
          team1_id: string | null
          team1_slot: string
          team2_id: string | null
          team2_slot: string
          updated_at: string
          venue: string
        }
        Insert: {
          created_at?: string
          group_code?: string | null
          id?: string
          match_date: string
          match_number?: number | null
          match_time: string
          round: Database["public"]["Enums"]["match_round"]
          sort_order?: number
          team1_id?: string | null
          team1_slot: string
          team2_id?: string | null
          team2_slot: string
          updated_at?: string
          venue: string
        }
        Update: {
          created_at?: string
          group_code?: string | null
          id?: string
          match_date?: string
          match_number?: number | null
          match_time?: string
          round?: Database["public"]["Enums"]["match_round"]
          sort_order?: number
          team1_id?: string | null
          team1_slot?: string
          team2_id?: string | null
          team2_slot?: string
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions_advances: {
        Row: {
          created_at: string
          group_id: string
          id: string
          predicted_round: Database["public"]["Enums"]["tournament_round"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          predicted_round: Database["public"]["Enums"]["tournament_round"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          predicted_round?: Database["public"]["Enums"]["tournament_round"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_advances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_advances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_advances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions_scores: {
        Row: {
          created_at: string
          group_id: string
          id: string
          match_id: string
          predicted_team1_score: number
          predicted_team2_score: number
          predicted_winner_team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          match_id: string
          predicted_team1_score: number
          predicted_team2_score: number
          predicted_winner_team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          match_id?: string
          predicted_team1_score?: number
          predicted_team2_score?: number
          predicted_winner_team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_scores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_scores_predicted_winner_team_id_fkey"
            columns: ["predicted_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions_specials: {
        Row: {
          champion_team_id: string | null
          created_at: string
          group_id: string
          id: string
          third_place_team_id: string | null
          top_scorer_name: string | null
          top_scorer_candidate_id: string | null
          top_scorer_other_name: string | null
          top_scorer_other_team_id: string | null
          best_goalkeeper_candidate_id: string | null
          best_goalkeeper_name: string | null
          best_goalkeeper_other_name: string | null
          best_goalkeeper_other_team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          champion_team_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          third_place_team_id?: string | null
          top_scorer_name?: string | null
          top_scorer_candidate_id?: string | null
          top_scorer_other_name?: string | null
          top_scorer_other_team_id?: string | null
          best_goalkeeper_candidate_id?: string | null
          best_goalkeeper_name?: string | null
          best_goalkeeper_other_name?: string | null
          best_goalkeeper_other_team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          champion_team_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          third_place_team_id?: string | null
          top_scorer_name?: string | null
          top_scorer_candidate_id?: string | null
          top_scorer_other_name?: string | null
          top_scorer_other_team_id?: string | null
          best_goalkeeper_candidate_id?: string | null
          best_goalkeeper_name?: string | null
          best_goalkeeper_other_name?: string | null
          best_goalkeeper_other_team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_specials_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_specials_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_specials_third_place_team_id_fkey"
            columns: ["third_place_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_specials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      score_breakdowns: {
        Row: {
          advances_points: number
          champion_points: number
          correct_results_group_stage: number
          created_at: string
          details: Json | null
          exact_scores_group_stage: number
          exact_scores_knockout: number
          group_id: string
          id: string
          last_calculated_at: string
          third_place_points: number
          top_scorer_points: number
          best_goalkeeper_points: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          advances_points?: number
          champion_points?: number
          correct_results_group_stage?: number
          created_at?: string
          details?: Json | null
          exact_scores_group_stage?: number
          exact_scores_knockout?: number
          group_id: string
          id?: string
          last_calculated_at?: string
          third_place_points?: number
          top_scorer_points?: number
          best_goalkeeper_points?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          advances_points?: number
          champion_points?: number
          correct_results_group_stage?: number
          created_at?: string
          details?: Json | null
          exact_scores_group_stage?: number
          exact_scores_knockout?: number
          group_id?: string
          id?: string
          last_calculated_at?: string
          third_place_points?: number
          top_scorer_points?: number
          best_goalkeeper_points?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_breakdowns_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_breakdowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          created_at: string
          display_name_es: string | null
          flag_url: string | null
          group_code: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name_es?: string | null
          flag_url?: string | null
          group_code?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name_es?: string | null
          flag_url?: string | null
          group_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      tournament_results: {
        Row: {
          champion_team_id: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          third_place_team_id: string | null
          top_scorer_name: string | null
          top_scorer_candidate_id: string | null
          best_goalkeeper_candidate_id: string | null
          best_goalkeeper_name: string | null
          updated_at: string
        }
        Insert: {
          champion_team_id?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          third_place_team_id?: string | null
          top_scorer_name?: string | null
          top_scorer_candidate_id?: string | null
          best_goalkeeper_candidate_id?: string | null
          best_goalkeeper_name?: string | null
          updated_at?: string
        }
        Update: {
          champion_team_id?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          third_place_team_id?: string | null
          top_scorer_name?: string | null
          top_scorer_candidate_id?: string | null
          best_goalkeeper_candidate_id?: string | null
          best_goalkeeper_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_third_place_team_id_fkey"
            columns: ["third_place_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_any_group_leader: { Args: never; Returns: boolean }
      is_before_deadline: { Args: { p_group_id: string }; Returns: boolean }
      is_global_admin: { Args: never; Returns: boolean }
      is_group_leader: { Args: { p_group_id: string }; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      join_group_by_code: {
        Args: { p_invite_code: string }
        Returns: {
          group_id: string
          group_name: string
        }[]
      }
    }
    Enums: {
      group_role: "member" | "leader"
      match_round:
      | "group"
      | "round_of_32"
      | "round_of_16"
      | "quarter_final"
      | "semi_final"
      | "third_place"
      | "final"
      tiebreak_type: "group_tiebreak" | "best_thirds"
      tournament_round:
      | "round_of_32"
      | "round_of_16"
      | "quarter_final"
      | "semi_final"
      | "final"
      | "champion"
      | "no_clasifica"
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
      group_role: ["member", "leader"],
      match_round: [
        "group",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
      ],
      tiebreak_type: ["group_tiebreak", "best_thirds"],
      tournament_round: [
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "final",
        "champion",
        "no_clasifica",
      ],
    },
  },
} as const
