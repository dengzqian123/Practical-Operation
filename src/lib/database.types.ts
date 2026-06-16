export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string;
          avatar_url: string;
          bio: string;
          credits: number;
          role: 'admin' | 'user';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string;
          avatar_url?: string;
          bio?: string;
          credits?: number;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string | null;
          display_name?: string;
          avatar_url?: string;
          bio?: string;
          credits?: number;
          role?: 'admin' | 'user';
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          cover_url: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          cover_url?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          cover_url?: string;
          is_public?: boolean;
          updated_at?: string;
        };
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          title: string;
          prompt: string;
          model: string;
          style: string;
          duration: number;
          resolution: string;
          video_url: string;
          thumbnail_url: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          metadata: Record<string, unknown>;
          is_public: boolean;
          likes_count: number;
          views_count: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          title?: string;
          prompt: string;
          model?: string;
          style?: string;
          duration?: number;
          resolution?: string;
          video_url?: string;
          thumbnail_url?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          metadata?: Record<string, unknown>;
          is_public?: boolean;
          likes_count?: number;
          views_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          prompt?: string;
          model?: string;
          style?: string;
          duration?: number;
          resolution?: string;
          video_url?: string;
          thumbnail_url?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          metadata?: Record<string, unknown>;
          is_public?: boolean;
          likes_count?: number;
          views_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          model?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          video_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          video_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          content?: string;
          metadata?: Record<string, unknown>;
        };
      };
      user_api_keys: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          label: string;
          api_key_hint: string;
          full_key: string | null;
          is_active: boolean;
          is_global: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          label: string;
          api_key_hint: string;
          full_key?: string | null;
          is_active?: boolean;
          is_global?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          api_key_hint?: string;
          full_key?: string | null;
          is_active?: boolean;
          is_global?: boolean;
          updated_at?: string;
        };
      };
      video_likes: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Video = Database['public']['Tables']['videos']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type VideoLike = Database['public']['Tables']['video_likes']['Row'];
export type UserApiKey = Database['public']['Tables']['user_api_keys']['Row'];
