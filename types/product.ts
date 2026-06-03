export type FabricUnit = "meter" | "yard";
export type UserRole = "owner" | "staff";
export type AppView = "dashboard" | "customers" | "calculator" | "models" | "conversion" | "converter" | "kalkulator" | "settings";
export type ExportSize = "instagram" | "landscape" | "a4";

export interface Customer {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  address: string;
  brand_name?: string;
  whatsapp?: string;
  notes: string;
  logo_url: string | null;
}

export interface Brand {
  id: string;
  created_at: string;
  brand_name: string;
  logo_url: string | null;
  customer_id: string | null;
  customer_name: string;
  owner: string;
  legacy?: boolean;
}

export interface ProductMaterial {
  id: string;
  name: string;
  qty: number;
  unit: FabricUnit;
  price: number;
  printing_enabled: boolean;
  printing_price: number;
  total: number;
  printing_total: number;
  subtotal: number;
}

export interface ProductMaterialFormValues {
  id: string;
  name: string;
  qty: string;
  unit: FabricUnit;
  price: string;
  printing_enabled: boolean;
  printing_price: string;
}

export interface Product {
  id: string;
  created_at: string;
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
  additional_materials: ProductMaterial[];
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
}

export interface ProductFormValues {
  brand_id: string;
  customer_id: string;
  brand_name: string;
  product_name: string;
  product_code: string;
  customer_name: string;
  collection_name: string;
  product_color: string;
  production_date: string;
  logo_url: string;
  photo_url: string;
  fabric_qty: string;
  fabric_unit: FabricUnit;
  fabric_price: string;
  fabric_printing_enabled: boolean;
  fabric_printing_price: string;
  additional_materials: ProductMaterialFormValues[];
  printing_cost: string;
  sewing_cost: string;
  accessory_cost: string;
  label_cost: string;
  shipping_cost: string;
  other_cost: string;
  margin_preset: "20" | "30" | "40" | "50" | "custom";
  custom_margin: string;
}

export interface HppCalculation {
  fabricCost: number;
  fabricPrintingCost: number;
  additionalMaterialsCost: number;
  additionalPrintingCost: number;
  totalMaterialsCost: number;
  totalPrintingCost: number;
  totalMaterial: number;
  totalComponentsCost: number;
  totalHpp: number;
  margin: number;
  sellingPrice: number;
  profit: number;
  profitPercent: number;
}

export interface BrandSettings {
  brand_name: string;
  logo_url: string | null;
  theme_color: string;
}

export interface ExportSizeConfig {
  id: ExportSize;
  label: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
}
