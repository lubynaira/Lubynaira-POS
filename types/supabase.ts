import type { FabricUnit, UserRole } from "@/types/product";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          full_name: string | null;
          role: UserRole;
        };
        Insert: {
          id: string;
          created_at?: string;
          full_name?: string | null;
          role?: UserRole;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
        };
        Relationships: [];
      };
      brand_settings: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          brand_name: string;
          logo_url: string | null;
          theme_color: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
          brand_name?: string;
          logo_url?: string | null;
          theme_color?: string;
        };
        Update: {
          updated_at?: string;
          brand_name?: string;
          logo_url?: string | null;
          theme_color?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          user_id: string | null;
          created_at: string;
          updated_at: string;
          customer_name: string;
          brand_name?: string;
          whatsapp?: string;
          phone: string;
          address: string;
          notes: string;
          logo_url: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          customer_name: string;
          brand_name?: string;
          whatsapp?: string;
          phone?: string;
          address?: string;
          notes?: string;
          logo_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          user_id: string | null;
          customer_id: string | null;
          created_at: string;
          updated_at: string;
          brand_name: string;
          logo_url: string | null;
          owner: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
          brand_name: string;
          logo_url?: string | null;
          owner?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string | null;
          created_at: string;
          updated_at: string;
          brand_id: string | null;
          customer_id: string | null;
          brand_name: string;
          product_name: string;
          product_code: string;
          customer_name: string | null;
          collection_name: string | null;
          product_color: string | null;
          production_date: string;
          logo_url: string | null;
          photo_url: string | null;
          fabric_qty: number;
          fabric_unit: FabricUnit;
          fabric_price: number;
          fabric_printing_enabled: boolean;
          fabric_printing_price: number;
          additional_materials: Json | null;
          printing_cost: number;
          sewing_cost: number;
          accessory_cost: number;
          label_cost: number;
          shipping_cost: number;
          other_cost: number;
          total_hpp: number;
          margin: number;
          selling_price: number;
          profit: number;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          brand_id?: string | null;
          customer_id?: string | null;
          brand_name: string;
          product_name: string;
          product_code: string;
          customer_name?: string | null;
          collection_name?: string | null;
          product_color?: string | null;
          production_date: string;
          logo_url?: string | null;
          photo_url?: string | null;
          fabric_qty: number;
          fabric_unit: FabricUnit;
          fabric_price: number;
          fabric_printing_enabled?: boolean;
          fabric_printing_price?: number;
          additional_materials?: Json | null;
          printing_cost?: number;
          sewing_cost: number;
          accessory_cost?: number;
          label_cost?: number;
          shipping_cost?: number;
          other_cost?: number;
          total_hpp: number;
          margin: number;
          selling_price: number;
          profit: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
