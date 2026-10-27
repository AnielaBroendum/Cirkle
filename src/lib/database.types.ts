export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'consumer' | 'brand' | 'retailer';
          name: string;
          email: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: 'consumer' | 'brand' | 'retailer';
          name: string;
          email: string;
          avatar_url?: string | null;
          phone?: string | null;
        };
        Update: {
          id?: string;
          role?: 'consumer' | 'brand' | 'retailer';
          name?: string;
          email?: string;
          avatar_url?: string | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          logo_url: string | null;
          website: string | null;
          return_policy_url: string | null;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          logo_url?: string | null;
          website?: string | null;
          return_policy_url?: string | null;
          onboarding_complete?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          logo_url?: string | null;
          website?: string | null;
          return_policy_url?: string | null;
          onboarding_complete?: boolean;
        };
        Relationships: [];
      };
      brand_payout_details: {
        Row: {
          brand_id: string;
          reg_no: string | null;
          account_no: string | null;
          cvr: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          reg_no?: string | null;
          account_no?: string | null;
          cvr?: string | null;
        };
        Update: {
          brand_id?: string;
          reg_no?: string | null;
          account_no?: string | null;
          cvr?: string | null;
        };
        Relationships: [];
      };
      retailer_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          latitude: number | null;
          longitude: number | null;
          logo_url: string | null;
          store_photos: string[];
          store_type: string | null;
          opening_hours: string | null;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          logo_url?: string | null;
          store_photos?: string[];
          store_type?: string | null;
          opening_hours?: string | null;
          onboarding_complete?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          logo_url?: string | null;
          store_photos?: string[];
          store_type?: string | null;
          opening_hours?: string | null;
          onboarding_complete?: boolean;
        };
        Relationships: [];
      };
      retailer_payout_details: {
        Row: {
          retailer_id: string;
          reg_no: string | null;
          account_no: string | null;
          cvr: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          retailer_id: string;
          reg_no?: string | null;
          account_no?: string | null;
          cvr?: string | null;
        };
        Update: {
          retailer_id?: string;
          reg_no?: string | null;
          account_no?: string | null;
          cvr?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          description: string | null;
          price_dkk: number;
          deposit_amount_dkk: number | null;
          images: string[];
          sizes: string[];
          colors: string[];
          materials: string | null;
          category: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          description?: string | null;
          price_dkk: number;
          deposit_amount_dkk?: number | null;
          images?: string[];
          sizes?: string[];
          colors?: string[];
          materials?: string | null;
          category?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          description?: string | null;
          price_dkk?: number;
          deposit_amount_dkk?: number | null;
          images?: string[];
          sizes?: string[];
          colors?: string[];
          materials?: string | null;
          category?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          size: string;
          color: string;
          sku: string | null;
          stock_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          size: string;
          color: string;
          sku?: string | null;
          stock_count?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          size?: string;
          color?: string;
          sku?: string | null;
          stock_count?: number;
        };
        Relationships: [];
      };
      samples: {
        Row: {
          id: string;
          product_id: string;
          retailer_id: string;
          brand_id: string;
          qr_code_url: string | null;
          status: 'active' | 'returned' | 'damaged' | 'inactive';
          deposit_amount_dkk: number | null;
          deposit_status: string | null;
          size: string | null;
          color: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          retailer_id: string;
          brand_id: string;
          qr_code_url?: string | null;
          status?: 'active' | 'returned' | 'damaged' | 'inactive';
          deposit_amount_dkk?: number | null;
          deposit_status?: string | null;
          size?: string | null;
          color?: string | null;
          activated_at?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          retailer_id?: string;
          brand_id?: string;
          qr_code_url?: string | null;
          status?: 'active' | 'returned' | 'damaged' | 'inactive';
          deposit_amount_dkk?: number | null;
          deposit_status?: string | null;
          size?: string | null;
          color?: string | null;
          activated_at?: string | null;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          sample_id: string | null;
          product_id: string;
          scanner_user_id: string | null;
          source_type: 'retailer' | 'peer';
          source_retailer_id: string | null;
          source_user_id: string | null;
          scanned_at: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sample_id?: string | null;
          product_id: string;
          scanner_user_id?: string | null;
          source_type: 'retailer' | 'peer';
          source_retailer_id?: string | null;
          source_user_id?: string | null;
          scanned_at?: string;
          user_agent?: string | null;
        };
        Update: {
          id?: string;
          sample_id?: string | null;
          product_id?: string;
          scanner_user_id?: string | null;
          source_type?: 'retailer' | 'peer';
          source_retailer_id?: string | null;
          source_user_id?: string | null;
          scanned_at?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          consumer_user_id: string;
          brand_id: string;
          status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          total_dkk: number;
          points_used: number;
          discount_dkk: number;
          shipping_name: string;
          shipping_address: string;
          shipping_city: string;
          shipping_postal_code: string;
          shipping_country: string;
          tracking_number: string | null;
          tracking_url: string | null;
          carrier: 'PostNord' | 'GLS' | 'DAO' | 'Bring' | 'Other' | null;
          shipped_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consumer_user_id: string;
          brand_id: string;
          status?: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          total_dkk: number;
          points_used?: number;
          discount_dkk?: number;
          shipping_name: string;
          shipping_address: string;
          shipping_city: string;
          shipping_postal_code: string;
          shipping_country?: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          carrier?: 'PostNord' | 'GLS' | 'DAO' | 'Bring' | 'Other' | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          consumer_user_id?: string;
          brand_id?: string;
          status?: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          total_dkk?: number;
          points_used?: number;
          discount_dkk?: number;
          shipping_name?: string;
          shipping_address?: string;
          shipping_city?: string;
          shipping_postal_code?: string;
          shipping_country?: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          carrier?: 'PostNord' | 'GLS' | 'DAO' | 'Bring' | 'Other' | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_variant_id: string | null;
          product_name: string;
          size: string | null;
          color: string | null;
          quantity: number;
          unit_price_dkk: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_variant_id?: string | null;
          product_name: string;
          size?: string | null;
          color?: string | null;
          quantity?: number;
          unit_price_dkk: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_variant_id?: string | null;
          product_name?: string;
          size?: string | null;
          color?: string | null;
          quantity?: number;
          unit_price_dkk?: number;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          note?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
          note?: string | null;
        };
        Relationships: [];
      };
      attributions: {
        Row: {
          id: string;
          order_id: string;
          scan_id: string | null;
          attribution_type: 'direct' | 'deferred' | 'tier2' | 'peer';
          source_retailer_id: string | null;
          source_user_id: string | null;
          commission_rate: number | null;
          commission_amount_dkk: number | null;
          points_amount: number | null;
          status: 'pending' | 'confirmed' | 'paid' | 'reversed';
          attribution_window_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          scan_id?: string | null;
          attribution_type: 'direct' | 'deferred' | 'tier2' | 'peer';
          source_retailer_id?: string | null;
          source_user_id?: string | null;
          commission_rate?: number | null;
          commission_amount_dkk?: number | null;
          points_amount?: number | null;
          status?: 'pending' | 'confirmed' | 'paid' | 'reversed';
          attribution_window_expires_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          scan_id?: string | null;
          attribution_type?: 'direct' | 'deferred' | 'tier2' | 'peer';
          source_retailer_id?: string | null;
          source_user_id?: string | null;
          commission_rate?: number | null;
          commission_amount_dkk?: number | null;
          points_amount?: number | null;
          status?: 'pending' | 'confirmed' | 'paid' | 'reversed';
          attribution_window_expires_at?: string | null;
        };
        Relationships: [];
      };
      points_ledger: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string;
          order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          reason: string;
          order_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          reason?: string;
          order_id?: string | null;
        };
        Relationships: [];
      };
      saved_products: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          scan_id: string | null;
          size: string | null;
          saved_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          scan_id?: string | null;
          size?: string | null;
          saved_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          scan_id?: string | null;
          size?: string | null;
          saved_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          type: 'scan' | 'save' | 'purchase';
          user_id: string | null;
          brand_id: string;
          product_id: string;
          size: string | null;
          retailer_id: string | null;
          sample_id: string | null;
          giver_user_id: string | null;
          scan_id: string | null;
          order_id: string | null;
          order_item_id: string | null;
          quantity: number;
          unit_price_dkk: number | null;
          occurred_at: string;
          origin: 'live' | 'backfill' | 'seed';
        };
        Insert: {
          id?: string;
          type: 'scan' | 'save' | 'purchase';
          user_id?: string | null;
          brand_id: string;
          product_id: string;
          size?: string | null;
          retailer_id?: string | null;
          sample_id?: string | null;
          giver_user_id?: string | null;
          scan_id?: string | null;
          order_id?: string | null;
          order_item_id?: string | null;
          quantity?: number;
          unit_price_dkk?: number | null;
          occurred_at?: string;
          origin?: 'live' | 'backfill' | 'seed';
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      brand_stories: {
        Row: {
          id: string;
          brand_id: string;
          position: number;
          kind: 'video' | 'image';
          path: string;
          url: string;
          duration_seconds: number | null;
          width: number;
          height: number;
          bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          position: number;
          kind: 'video' | 'image';
          path: string;
          url: string;
          duration_seconds?: number | null;
          width: number;
          height: number;
          bytes: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['brand_stories']['Insert']>;
        Relationships: [];
      };
      tag_prints: {
        Row: { id: string; sample_id: string; user_id: string; portal: 'brand' | 'retail'; printed_at: string };
        Insert: { id?: string; sample_id: string; user_id: string; portal: 'brand' | 'retail'; printed_at?: string };
        Update: Partial<Database['public']['Tables']['tag_prints']['Insert']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; created_at: string };
        Insert: { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };
      brand_retailer_partnerships: {
        Row: {
          id: string;
          brand_id: string;
          retailer_id: string | null;
          status: 'invited' | 'active' | 'paused' | 'declined';
          commission_direct: number;
          commission_deferred: number;
          commission_tier2: number;
          invitation_token: string | null;
          invitation_email: string | null;
          invited_at: string;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          retailer_id?: string | null;
          status?: 'invited' | 'active' | 'paused' | 'declined';
          commission_direct?: number;
          commission_deferred?: number;
          commission_tier2?: number;
          invitation_token?: string | null;
          invitation_email?: string | null;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          brand_id?: string;
          retailer_id?: string | null;
          status?: 'invited' | 'active' | 'paused' | 'declined';
          commission_direct?: number;
          commission_deferred?: number;
          commission_tier2?: number;
          invitation_token?: string | null;
          invitation_email?: string | null;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      sample_requests: {
        Row: {
          id: string;
          retailer_id: string;
          brand_id: string;
          partnership_id: string;
          status: 'pending' | 'approved' | 'shipped' | 'received' | 'rejected';
          note: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          retailer_id: string;
          brand_id: string;
          partnership_id: string;
          status?: 'pending' | 'approved' | 'shipped' | 'received' | 'rejected';
          note?: string | null;
          review_note?: string | null;
        };
        Update: {
          id?: string;
          retailer_id?: string;
          brand_id?: string;
          partnership_id?: string;
          status?: 'pending' | 'approved' | 'shipped' | 'received' | 'rejected';
          note?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
        };
        Relationships: [];
      };
      sample_request_items: {
        Row: {
          id: string;
          request_id: string;
          product_id: string;
          size: string;
          color: string;
          deposit_amount_dkk: number;
          sample_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          product_id: string;
          size: string;
          color: string;
          deposit_amount_dkk: number;
          sample_id?: string | null;
        };
        Update: {
          id?: string;
          request_id?: string;
          product_id?: string;
          size?: string;
          color?: string;
          deposit_amount_dkk?: number;
          sample_id?: string | null;
        };
        Relationships: [];
      };
      sample_transactions: {
        Row: {
          id: string;
          sample_id: string;
          retailer_id: string;
          brand_id: string;
          transaction_type: 'deposit_paid' | 'deposit_refunded' | 'deposit_forfeited' | 'swap_out' | 'swap_in';
          amount_dkk: number;
          note: string | null;
          swap_request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sample_id: string;
          retailer_id: string;
          brand_id: string;
          transaction_type: 'deposit_paid' | 'deposit_refunded' | 'deposit_forfeited' | 'swap_out' | 'swap_in';
          amount_dkk: number;
          note?: string | null;
          swap_request_id?: string | null;
        };
        Update: {
          id?: string;
          sample_id?: string;
          retailer_id?: string;
          brand_id?: string;
          transaction_type?: 'deposit_paid' | 'deposit_refunded' | 'deposit_forfeited' | 'swap_out' | 'swap_in';
          amount_dkk?: number;
          note?: string | null;
          swap_request_id?: string | null;
        };
        Relationships: [];
      };
      swap_requests: {
        Row: {
          id: string;
          retailer_id: string;
          brand_id: string;
          return_sample_id: string;
          new_product_id: string;
          new_size: string;
          new_color: string;
          new_sample_id: string | null;
          status: 'requested' | 'approved' | 'return_shipped' | 'return_received' | 'inspected_ok' | 'inspected_damaged' | 'new_shipped' | 'completed' | 'cancelled';
          reason: string | null;
          inspection_note: string | null;
          return_tracking_number: string | null;
          new_tracking_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          retailer_id: string;
          brand_id: string;
          return_sample_id: string;
          new_product_id: string;
          new_size: string;
          new_color: string;
          new_sample_id?: string | null;
          status?: 'requested' | 'approved' | 'return_shipped' | 'return_received' | 'inspected_ok' | 'inspected_damaged' | 'new_shipped' | 'completed' | 'cancelled';
          reason?: string | null;
          inspection_note?: string | null;
          return_tracking_number?: string | null;
          new_tracking_number?: string | null;
        };
        Update: {
          id?: string;
          retailer_id?: string;
          brand_id?: string;
          return_sample_id?: string;
          new_product_id?: string;
          new_size?: string;
          new_color?: string;
          new_sample_id?: string | null;
          status?: 'requested' | 'approved' | 'return_shipped' | 'return_received' | 'inspected_ok' | 'inspected_damaged' | 'new_shipped' | 'completed' | 'cancelled';
          reason?: string | null;
          inspection_note?: string | null;
          return_tracking_number?: string | null;
          new_tracking_number?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_points_balance: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_retailer_deposit_total: {
        Args: { p_retailer_id: string };
        Returns: number;
      };
      get_brand_deposits_held: {
        Args: { p_brand_id: string };
        Returns: number;
      };
      get_brand_save_counts: {
        Args: { p_since: string };
        Returns: { day: string; saves: number }[];
      };
      get_brand_dashboard: {
        Args: {
          p_start: string;
          p_prev_start: string;
          p_end: string;
          p_product?: string | null;
          p_retailer?: string | null;
          p_size?: string | null;
          p_bucket?: 'hour' | 'day' | 'month';
          p_tz?: string;
        };
        Returns: Record<string, unknown> | null;
      };
      reorder_brand_stories: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      get_brand_nav_counts: {
        Args: Record<string, never>;
        Returns: { orders: number; returns: number } | null;
      };
      get_brand_dashboard_stores: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
    };
  };
};
