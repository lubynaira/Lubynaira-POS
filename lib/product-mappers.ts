import { parseLocaleNumber } from "@/lib/calculations";
import { generateId } from "@/lib/utils";
import type { Database, Json } from "@/types/supabase";
import type { FabricUnit, HppCalculation, Product, ProductFormValues, ProductMaterial } from "@/types/product";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export const defaultProductValues: ProductFormValues = {
  brand_id: "",
  customer_id: "",
  brand_name: "",
  product_name: "",
  product_code: "",
  customer_name: "",
  collection_name: "",
  product_color: "",
  production_date: todayInputValue(),
  logo_url: "",
  photo_url: "",
  fabric_qty: "",
  fabric_unit: "yard",
  fabric_price: "",
  fabric_printing_enabled: false,
  fabric_printing_price: "",
  additional_materials: [],
  printing_cost: "",
  sewing_cost: "",
  accessory_cost: "",
  label_cost: "",
  shipping_cost: "",
  other_cost: "",
  margin_preset: "30",
  custom_margin: ""
};

export function formValuesFromProduct(product: Product): ProductFormValues {
  const preset = [20, 30, 40, 50].includes(product.margin)
    ? (String(product.margin) as ProductFormValues["margin_preset"])
    : "custom";

  return {
    brand_id: product.brand_id || "",
    brand_name: product.brand_name,
    customer_id: product.customer_id || "",
    product_name: product.product_name,
    product_code: product.product_code,
    customer_name: product.customer_name || "",
    collection_name: product.collection_name || "",
    product_color: product.product_color || "",
    production_date: product.production_date,
    logo_url: product.logo_url || "",
    photo_url: product.photo_url || "",
    fabric_qty: String(product.fabric_qty || ""),
    fabric_unit: product.fabric_unit,
    fabric_price: String(product.fabric_price || ""),
    fabric_printing_enabled: product.fabric_printing_enabled || product.fabric_printing_price > 0,
    fabric_printing_price: optionalCostValue(product.fabric_printing_price || 0),
    additional_materials: (product.additional_materials || []).map((material) => ({
      id: material.id || generateId(),
      name: material.name || "",
      qty: optionalCostValue(material.qty),
      unit: material.unit || "yard",
      price: optionalCostValue(material.price),
      printing_enabled: material.printing_enabled || material.printing_price > 0,
      printing_price: optionalCostValue(material.printing_price || 0)
    })),
    printing_cost: optionalCostValue(product.printing_cost),
    sewing_cost: String(product.sewing_cost || ""),
    accessory_cost: optionalCostValue(product.accessory_cost),
    label_cost: optionalCostValue(product.label_cost),
    shipping_cost: optionalCostValue(product.shipping_cost),
    other_cost: optionalCostValue(product.other_cost),
    margin_preset: preset,
    custom_margin: preset === "custom" ? String(product.margin) : ""
  };
}

export function productFromForm(
  values: ProductFormValues,
  calculation: HppCalculation,
  existingId?: string
): Product {
  return {
    id: existingId || generateId(),
    created_at: new Date().toISOString(),
    brand_id: values.brand_id || null,
    customer_id: values.customer_id || null,
    brand_name: values.brand_name.trim(),
    product_name: values.product_name.trim(),
    product_code: values.product_code.trim(),
    customer_name: values.customer_name.trim() || null,
    collection_name: values.collection_name.trim() || null,
    product_color: values.product_color.trim() || null,
    production_date: values.production_date || todayInputValue(),
    logo_url: values.logo_url || null,
    photo_url: values.photo_url || null,
    fabric_qty: parseLocaleNumber(values.fabric_qty),
    fabric_unit: values.fabric_unit,
    fabric_price: parseLocaleNumber(values.fabric_price),
    fabric_printing_enabled: values.fabric_printing_enabled,
    fabric_printing_price: values.fabric_printing_enabled ? parseLocaleNumber(values.fabric_printing_price) : 0,
    additional_materials: normalizeMaterials(values.additional_materials),
    printing_cost: calculation.totalPrintingCost,
    sewing_cost: parseLocaleNumber(values.sewing_cost),
    accessory_cost: parseLocaleNumber(values.accessory_cost),
    label_cost: parseLocaleNumber(values.label_cost),
    shipping_cost: parseLocaleNumber(values.shipping_cost),
    other_cost: parseLocaleNumber(values.other_cost),
    total_hpp: calculation.totalHpp,
    margin: calculation.margin,
    selling_price: calculation.sellingPrice,
    profit: calculation.profit
  };
}

export function todayInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function optionalCostValue(value: number) {
  return value > 0 ? String(value) : "";
}

export function productToInsert(product: Product, userId?: string): ProductInsert {
  return {
    id: product.id,
    user_id: userId || null,
    created_at: product.created_at,
    updated_at: new Date().toISOString(),
    brand_name: product.brand_name,
    brand_id: product.brand_id,
    customer_id: product.customer_id,
    product_name: product.product_name,
    product_code: product.product_code,
    customer_name: product.customer_name,
    collection_name: product.collection_name,
    product_color: product.product_color,
    production_date: product.production_date,
    logo_url: product.logo_url,
    photo_url: product.photo_url,
    fabric_qty: product.fabric_qty,
    fabric_unit: product.fabric_unit,
    fabric_price: product.fabric_price,
    fabric_printing_enabled: product.fabric_printing_enabled,
    fabric_printing_price: product.fabric_printing_price,
    additional_materials: product.additional_materials as unknown as Json,
    printing_cost: product.printing_cost,
    sewing_cost: product.sewing_cost,
    accessory_cost: product.accessory_cost,
    label_cost: product.label_cost,
    shipping_cost: product.shipping_cost,
    other_cost: product.other_cost,
    total_hpp: product.total_hpp,
    margin: product.margin,
    selling_price: product.selling_price,
    profit: product.profit
  };
}

export function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    created_at: row.created_at,
    brand_id: row.brand_id,
    customer_id: row.customer_id,
    brand_name: row.brand_name,
    product_name: row.product_name,
    product_code: row.product_code,
    customer_name: row.customer_name,
    collection_name: row.collection_name,
    product_color: row.product_color,
    production_date: row.production_date,
    logo_url: row.logo_url,
    photo_url: row.photo_url,
    fabric_qty: Number(row.fabric_qty || 0),
    fabric_unit: row.fabric_unit,
    fabric_price: Number(row.fabric_price || 0),
    fabric_printing_enabled: Boolean(row.fabric_printing_enabled),
    fabric_printing_price: Number(row.fabric_printing_price || 0),
    additional_materials: parseMaterials(row.additional_materials),
    printing_cost: Number(row.printing_cost || 0),
    sewing_cost: Number(row.sewing_cost || 0),
    accessory_cost: Number(row.accessory_cost || 0),
    label_cost: Number(row.label_cost || 0),
    shipping_cost: Number(row.shipping_cost || 0),
    other_cost: Number(row.other_cost || 0),
    total_hpp: Number(row.total_hpp || 0),
    margin: Number(row.margin || 0),
    selling_price: Number(row.selling_price || 0),
    profit: Number(row.profit || 0)
  };
}

function normalizeMaterials(values: ProductFormValues["additional_materials"]): ProductMaterial[] {
  return (values || [])
    .map((material) => {
      const qty = parseLocaleNumber(material.qty);
      const price = parseLocaleNumber(material.price);
      const printingPrice = material.printing_enabled ? parseLocaleNumber(material.printing_price) : 0;
      const total = qty * price;
      const printingTotal = qty * printingPrice;
      return {
        id: material.id || generateId(),
        name: material.name.trim(),
        qty,
        unit: material.unit,
        price,
        printing_enabled: material.printing_enabled,
        printing_price: printingPrice,
        total,
        printing_total: printingTotal,
        subtotal: total + printingTotal
      };
    })
    .filter((material) => material.name || material.qty > 0 || material.price > 0);
}

function parseMaterials(value: Json | null | undefined): ProductMaterial[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, Json | undefined>;
      const qty = Number(record.qty || 0);
      const price = Number(record.price || 0);
      const printingPrice = Number(record.printing_price || 0);
      const unit = record.unit === "meter" || record.unit === "yard" ? record.unit : "yard";
      const total = Number(record.total || qty * price);
      const printingTotal = Number(record.printing_total || qty * printingPrice);

      return {
        id: typeof record.id === "string" ? record.id : generateId(),
        name: typeof record.name === "string" ? record.name : "",
        qty,
        unit: unit as FabricUnit,
        price,
        printing_enabled: Boolean(record.printing_enabled || printingPrice > 0),
        printing_price: printingPrice,
        total,
        printing_total: printingTotal,
        subtotal: Number(record.subtotal || total + printingTotal)
      };
    })
    .filter((material): material is ProductMaterial => Boolean(material));
}
