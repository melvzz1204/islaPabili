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
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_releases: {        Row: {
          apk_url: string | null
          build_number: number
          created_at: string
          id: string
          is_active: boolean
          min_build: number
          notes: string
          platform: string
          version: string
        }
        Insert: {
          apk_url?: string | null
          build_number: number
          created_at?: string
          id?: string
          is_active?: boolean
          min_build?: number
          notes?: string
          platform?: string
          version?: string
        }
        Update: {
          apk_url?: string | null
          build_number?: number
          created_at?: string
          id?: string
          is_active?: boolean
          min_build?: number
          notes?: string
          platform?: string
          version?: string
        }
        Relationships: []
      }
      fare_config: {
        Row: {
          base_fare: number
          base_km: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          peak_surge: Json
          per_km_rate: number
          updated_at: string
          volume_tiers: Json
        }
        Insert: {
          base_fare?: number
          base_km?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          peak_surge?: Json
          per_km_rate?: number
          updated_at?: string
          volume_tiers?: Json
        }
        Update: {
          base_fare?: number
          base_km?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          peak_surge?: Json
          per_km_rate?: number
          updated_at?: string
          volume_tiers?: Json
        }
        Relationships: []
      }
      merchant_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          applicant_id: string
          business_permit_url: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          store_name: string
          store_photo_url: string | null
          town: Database["public"]["Enums"]["island_town"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          applicant_id: string
          business_permit_url?: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_name: string
          store_photo_url?: string | null
          town: Database["public"]["Enums"]["island_town"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          applicant_id?: string
          business_permit_url?: string | null
          category?: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_name?: string
          store_photo_url?: string | null
          town?: Database["public"]["Enums"]["island_town"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_owners: {
        Row: {
          created_at: string
          merchant_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          merchant_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          merchant_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_owners_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          phone: string | null
          town: Database["public"]["Enums"]["island_town"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          phone?: string | null
          town: Database["public"]["Enums"]["island_town"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          town?: Database["public"]["Enums"]["island_town"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          kind: string | null
          order_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          order_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          order_id?: string | null
          title?: string
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
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          estimated_price: number | null
          final_price: number | null
          id: string
          name: string
          notes: string | null
          order_id: string
          quantity: number
          store: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          name: string
          notes?: string | null
          order_id: string
          quantity: number
          store?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          store?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_current: boolean
          order_id: string
          responded_at: string | null
          rider_id: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_current?: boolean
          order_id: string
          responded_at?: string | null
          rider_id: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_current?: boolean
          order_id?: string
          responded_at?: string | null
          rider_id?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_log: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          id: number
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          id?: never
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          id?: never
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          base_fare: number
          cancelled_at: string | null
          claimed_at: string | null
          claim_code: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          discount_amount: number
          distance_fee: number
          distance_km: number | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_notes: string | null
          est_items_total: number
          fulfillment_mode: string
          grand_total: number
          id: string
          in_transit_at: string | null
          is_custom_list: boolean
          is_paid: boolean
          list_photo_urls: string[]
          merchant_id: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          per_km_rate: number
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_name: string | null
          purchased_at: string | null
          rider_earnings_estimate: number
          rider_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_name: string | null
          tip_amount: number
          total_delivery_fee: number
          town: Database["public"]["Enums"]["island_town"]
          updated_at: string
          volume_surcharge: number
          voucher_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          base_fare?: number
          cancelled_at?: string | null
          claimed_at?: string | null
          claim_code?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number
          distance_fee?: number
          distance_km?: number | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          est_items_total?: number
          fulfillment_mode?: string
          grand_total?: number
          id?: string
          in_transit_at?: string | null
          is_custom_list?: boolean
          is_paid?: boolean
          list_photo_urls?: string[]
          merchant_id?: string | null
          // Filled by trg_orders_assign_number when omitted.
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          per_km_rate?: number
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          purchased_at?: string | null
          rider_earnings_estimate?: number
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_name?: string | null
          tip_amount?: number
          total_delivery_fee?: number
          town: Database["public"]["Enums"]["island_town"]
          updated_at?: string
          volume_surcharge?: number
          voucher_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          base_fare?: number
          cancelled_at?: string | null
          claimed_at?: string | null
          claim_code?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number
          distance_fee?: number
          distance_km?: number | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          est_items_total?: number
          fulfillment_mode?: string
          grand_total?: number
          id?: string
          in_transit_at?: string | null
          is_custom_list?: boolean
          is_paid?: boolean
          list_photo_urls?: string[]
          merchant_id?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          per_km_rate?: number
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          purchased_at?: string | null
          rider_earnings_estimate?: number
          rider_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_name?: string | null
          tip_amount?: number
          total_delivery_fee?: number
          town?: Database["public"]["Enums"]["island_town"]
          updated_at?: string
          volume_surcharge?: number
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          home_town: Database["public"]["Enums"]["island_town"] | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          town_preferences: Database["public"]["Enums"]["island_town"][]
          updated_at: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          home_town?: Database["public"]["Enums"]["island_town"] | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          town_preferences?: Database["public"]["Enums"]["island_town"][]
          updated_at?: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          home_town?: Database["public"]["Enums"]["island_town"] | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          town_preferences?: Database["public"]["Enums"]["island_town"][]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          photo_url: string | null
          price: number
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          photo_url?: string | null
          price: number
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          photo_url?: string | null
          price?: number
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string
          photo_url: string | null
          rider_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          photo_url?: string | null
          rider_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          photo_url?: string | null
          rider_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_applications: {
        Row: {
          admin_notes: string | null
          bg_clearance_url: string | null
          created_at: string
          driver_license_back_url: string | null
          driver_license_front_url: string | null
          driving_experience_years: number | null
          helmet_photo_url: string | null
          id: string
          operating_towns: Database["public"]["Enums"]["island_town"][]
          reviewed_at: string | null
          reviewed_by: string | null
          rider_id: string
          rider_photo_url: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          vehicle_photo_url: string | null
          vehicle_registration_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          bg_clearance_url?: string | null
          created_at?: string
          driver_license_back_url?: string | null
          driver_license_front_url?: string | null
          driving_experience_years?: number | null
          helmet_photo_url?: string | null
          id?: string
          operating_towns?: Database["public"]["Enums"]["island_town"][]
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id: string
          rider_photo_url?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_registration_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          bg_clearance_url?: string | null
          created_at?: string
          driver_license_back_url?: string | null
          driver_license_front_url?: string | null
          driving_experience_years?: number | null
          helmet_photo_url?: string | null
          id?: string
          operating_towns?: Database["public"]["Enums"]["island_town"][]
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id?: string
          rider_photo_url?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          vehicle_photo_url?: string | null
          vehicle_registration_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_applications_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_locations: {
        Row: {
          id: number
          lat: number
          lng: number
          recorded_at: string
          rider_id: string
        }
        Insert: {
          id?: never
          lat: number
          lng: number
          recorded_at?: string
          rider_id: string
        }
        Update: {
          id?: never
          lat?: number
          lng?: number
          recorded_at?: string
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_status: {
        Row: {
          current_lat: number | null
          current_lng: number | null
          current_town: Database["public"]["Enums"]["island_town"] | null
          last_seen_at: string
          on_duty: boolean
          operating_towns: Database["public"]["Enums"]["island_town"][]
          rider_id: string
          updated_at: string
        }
        Insert: {
          current_lat?: number | null
          current_lng?: number | null
          current_town?: Database["public"]["Enums"]["island_town"] | null
          last_seen_at?: string
          on_duty?: boolean
          operating_towns?: Database["public"]["Enums"]["island_town"][]
          rider_id: string
          updated_at?: string
        }
        Update: {
          current_lat?: number | null
          current_lng?: number | null
          current_town?: Database["public"]["Enums"]["island_town"] | null
          last_seen_at?: string
          on_duty?: boolean
          operating_towns?: Database["public"]["Enums"]["island_town"][]
          rider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_status_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          method: Database["public"]["Enums"]["payment_method"] | null
          order_id: string | null
          reference: string | null
          rider_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id?: string | null
          reference?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id?: string | null
          reference?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["voucher_discount_type"]
          id: string
          is_active: boolean
          max_discount: number | null
          min_spend: number
          name: string
          town: Database["public"]["Enums"]["island_town"] | null
          updated_at: string
          usage_limit: number | null
          used_count: number
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["voucher_discount_type"]
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_spend?: number
          name: string
          town?: Database["public"]["Enums"]["island_town"] | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["voucher_discount_type"]
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_spend?: number
          name?: string
          town?: Database["public"]["Enums"]["island_town"] | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      wallets: {
        Row: {
          cash_on_hand: number
          id: string
          payout_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_on_hand?: number
          id?: string
          payout_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_on_hand?: number
          id?: string
          payout_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_merchant_owner: { Args: { p_merchant_id: string }; Returns: boolean }
      is_username_taken: { Args: { p_username: string }; Returns: boolean }
      review_rider_application: {
        Args: { p_application_id: string; p_decision: string; p_reason?: string | null }
        Returns: Database["public"]["Tables"]["rider_applications"]["Row"]
      }
      accept_pabili_order: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      request_pabili_riders: {
        Args: { p_order_id: string }
        Returns: number
      }
      respond_pabili_request: {
        Args: { p_order_id: string; p_decision: string }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      verify_claim_code: {
        Args: { p_order_id: string; p_code: string }
        Returns: boolean
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      island_town:
        | "boac"
        | "gasan"
        | "mogpog"
        | "santa_cruz"
        | "torrijos"
        | "buenavista"
      merchant_category: "fast_food" | "grocery" | "drugstore" | "local"
      order_status:
        | "pending_dispatch"
        | "rider_assigned"
        | "items_purchased"
        | "in_transit"
        | "completed"
        | "cancelled"
        | "failed"
        | "awaiting_merchant"
        | "preparing"
        | "ready"
        | "declined"
      payment_method: "cod" | "ewallet"
      request_status: "pending" | "accepted" | "declined" | "expired"
      transaction_kind:
        | "cod_collected"
        | "ewallet_paid"
        | "commission"
        | "tip"
        | "cashout"
        | "adjustment"
      transaction_status: "pending" | "settled" | "failed" | "refunded"
      user_role: "customer" | "rider" | "admin" | "merchant"
      voucher_discount_type: "fixed" | "percent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      approval_status: ["pending", "approved", "rejected"],
      island_town: [
        "boac",
        "gasan",
        "mogpog",
        "santa_cruz",
        "torrijos",
        "buenavista",
      ],
      merchant_category: ["fast_food", "grocery", "drugstore", "local"],
      order_status: [
        "pending_dispatch",
        "rider_assigned",
        "items_purchased",
        "in_transit",
        "completed",
        "cancelled",
        "failed",
      ],
      payment_method: ["cod", "ewallet"],
      request_status: ["pending", "accepted", "declined", "expired"],
      transaction_kind: [
        "cod_collected",
        "ewallet_paid",
        "commission",
        "tip",
        "cashout",
        "adjustment",
      ],
      transaction_status: ["pending", "settled", "failed", "refunded"],
      user_role: ["customer", "rider", "admin"],
      voucher_discount_type: ["fixed", "percent"],
    },
  },
} as const