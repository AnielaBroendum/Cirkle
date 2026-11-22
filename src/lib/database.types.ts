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
          price_dkk: number | null;
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
          price_dkk?: number | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          size?: string;
          color?: string;
          sku?: string | null;
          stock_count?: number;
          price_dkk?: number | null;
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
          return_period_ends_at: string | null;
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
          return_period_ends_at?: string | null;
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
          return_period_ends_at?: string | null;
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
          paid_out_at: string | null;
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
          paid_out_at?: string | null;
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
          paid_out_at?: string | null;
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
      consumer_consents: {
        Row: { id: string; user_id: string; consent: 'chain' | 'share_with_brands' | 'news_from_brands'; granted: boolean; source: 'consent_screen' | 'profile'; created_at: string };
        Insert: { id?: string; user_id: string; consent: 'chain' | 'share_with_brands' | 'news_from_brands'; granted: boolean; source: 'consent_screen' | 'profile'; created_at?: string };
        Update: Partial<Database['public']['Tables']['consumer_consents']['Insert']>;
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
      // 017: Brand dashboard v2 extras ("Where things stand", saves by size with the previous range, buy rate).
      get_brand_overview: {
        Args: {
          p_start: string;
          p_end: string;
          p_saves_days?: number;
          p_product?: string | null;
          p_retailer?: string | null;
          p_size?: string | null;
        };
        Returns: {
          stand: Record<'products' | 'stores' | 'orders' | 'returns', { total: number; done: number; moving: number; waiting: number }>;
          saves_by_size: { size: string | null; saves: number; prev: number }[];
          buy_rate: number | null;
        } | null;
      };
      // 018: Product library tiles and Scans column.
      get_brand_product_stats: {
        Args: { p_tz?: string };
        Returns: {
          scans_month: number;
          scans_prev_month: number;
          products: { id: string; scans_month: number; scans_total: number; sold_month: number; stores: number }[];
        } | null;
      };
      // 019: Edit product → In stores.
      get_product_store_scans: {
        Args: { p_product?: string | null };
        Returns: { retailer_id: string; name: string; placed: boolean; scans: number }[];
      };
      // 020: Stores & QR tags scan counts.
      get_brand_store_scans: {
        Args: Record<string, never>;
        Returns: {
          stores: { retailer_id: string; scans: number; products: number }[];
          product_scans: { retailer_id: string; product_id: string; scans: number }[];
        } | null;
      };
      // 021: Orders → the chain (first names only).
      get_brand_order_chain: {
        Args: { p_order: string };
        Returns: OrderChain | null;
      };
      // 029: the same for many orders (CSV export); other brands' orders left out.
      get_brand_order_chains: {
        Args: { p_orders: string[] };
        Returns: { order_id: string; chain: OrderChain }[];
      };
      // 030: the buyer or a giver in the chain; anyone else gets null. No store share.
      get_my_order_chain: {
        Args: { p_order: string };
        Returns: Omit<OrderChain, 'store_share_dkk'> | null;
      };
      // 030: get_my_order_chain for every order the caller bought.
      get_my_order_chains: {
        Args: Record<string, never>;
        Returns: { order_id: string; chain: Omit<OrderChain, 'store_share_dkk'> }[];
      };
      // 030: orders bought from a pass-on the caller is part of. First names only, no prices.
      get_my_passed_on: {
        Args: Record<string, never>;
        Returns: {
          order_id: string;
          product_id: string;
          product_name: string;
          buyer: string | null;
          bought_at: string;
          direct: boolean;
          via: string | null;
          points: number | null;
        }[];
      };
      // 022: Returns tiles. Rates in percent, amounts in øre.
      get_brand_return_stats: {
        Args: { p_tz?: string };
        Returns: {
          waiting: number;
          oldest_waiting_at: string | null;
          rate: number | null;
          prev_rate: number | null;
          refunded_amount: number;
          refunded_count: number;
          top_reason: { reason: string; count: number; total: number } | null;
        } | null;
      };
      reorder_brand_stories: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      get_brand_nav_counts: {
        Args: Record<string, never>;
        Returns: { orders: number; returns: number } | null;
      };
      // 016: Portals v2 sidebar. Dates are YYYY-MM-DD (Europe/Copenhagen), amounts in øre.
      get_brand_portal_shell: {
        Args: { p_payout_day?: number };
        Returns: {
          products: number;
          stores: number;
          orders: number;
          returns: number;
          period_start: string;
          next_payout: string;
          sales: number;
          store_cut: number;
          payout_amount: number;
        } | null;
      };
      get_retailer_overview: {
        Args: { p_tz?: string; p_payout_day?: number };
        Returns: {
          scans: { month: number; prev_month: number; weeks: number[] };
          saves: { month: number; prev_month: number; weeks: number[] };
          purchases: { month: number; prev_month: number; weeks: number[] };
          earned_month: number;
          earned_ready: number;
          earned_return_period: number;
          earned_paid_out: number;
          last_paid_out_at: string | null;
          next_payout: string;
          earnings_week: { start: string; amount: number }[];
          earnings_month: { start: string; amount: number }[];
          earnings_year: { start: string; amount: number }[];
          latest: {
            id: string;
            product_name: string | null;
            brand_name: string;
            amount: number;
            payout_status: 'return_period' | 'ready' | 'paid_out';
            /** 'passed_on' = the store's share of a sale passed on from its tag (028). */
            kind: 'store' | 'passed_on';
            ordered_at: string;
            return_period_ends_at: string | null;
            paid_out_at: string | null;
            image: string | null;
          }[];
          missing_tags: string[];
        } | null;
      };
      get_retailer_profile_stats: {
        Args: { p_tz?: string };
        Returns: {
          earned_total: number;
          brand_count: number;
          since: string | null;
          scans_month: number;
          preview_sample: string | null;
          brands: {
            id: string;
            name: string;
            logo_url: string | null;
            since: string;
            products: number;
            scans: number;
            share: number | null;
          }[];
        } | null;
      };
      get_retailer_product_stats: {
        Args: Record<string, never>;
        Returns: {
          product_id: string;
          product_name: string;
          brand_id: string;
          brand_name: string;
          image: string | null;
          price_min: number;
          price_max: number;
          sample_ids: string[];
          placed_at: string;
          scans: number;
          buys: number;
        }[];
      };
      get_retailer_portal_shell: {
        Args: { p_payout_day?: number };
        Returns: {
          products: number;
          period_start: string;
          next_payout: string;
          payout_amount: number;
          ready_amount: number;
          return_period_amount: number;
          last_paid_out_at: string | null;
        } | null;
      };
      payout_period: {
        Args: { p_payout_day?: number };
        Returns: { period_start: string; next_payout: string }[];
      };
      get_brand_dashboard_stores: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
      get_retailer_payouts: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          order_id: string;
          product_name: string | null;
          brand_name: string;
          ordered_at: string;
          delivered_at: string | null;
          return_period_ends_at: string | null;
          paid_out_at: string | null;
          amount_dkk: number;
          payout_status: 'return_period' | 'ready' | 'paid_out';
        }[];
      };
      get_retailer_most_scanned: {
        Args: { p_start: string; p_end: string; p_limit?: number };
        Returns: { product_id: string; product_name: string; brand_name: string; scans: number; buys: number }[];
      };
    };
  };
};

/** The chain on one order (get_brand_order_chain, 029). First names only. */
export type OrderChain = {
  store: string | null;
  /** True when the store was guessed from the giver's earlier purchase (orders before 026). */
  store_traced: boolean;
  /** The direct giver. */
  giver: string | null;
  /** Every giver, first giver first. */
  givers: string[];
  buyer: string | null;
  chain_id: string | null;
  /** Store's share of a passed-on sale in øre (028); null when none. */
  store_share_dkk: number | null;
  /** The order has an attribution (false: bought without a scan). */
  credited: boolean;
  /** The attribution is a pass-on. */
  passed_on: boolean;
};
