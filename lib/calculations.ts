import type { FabricUnit, HppCalculation, ProductFormValues } from "@/types/product";

export const YARD_TO_METER = 0.9144;
export const METER_TO_YARD = 1.09361;

export function parseLocaleNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const commaIndex = raw.lastIndexOf(",");
    const dotIndex = raw.lastIndexOf(".");
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = raw
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");

    return Number(normalized) || 0;
  }

  if (hasComma) {
    return Number(raw.replace(",", ".")) || 0;
  }

  return Number(raw.replace(/,/g, "")) || 0;
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Math.round(value || 0));
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits
  }).format(value || 0);
}

export function convertFabricQuantity(quantity: number, from: FabricUnit) {
  if (from === "yard") {
    return {
      meter: quantity * YARD_TO_METER,
      yard: quantity
    };
  }

  return {
    meter: quantity,
    yard: quantity * METER_TO_YARD
  };
}

export function calculateHpp(values: ProductFormValues): HppCalculation {
  const fabricQty = parseLocaleNumber(values.fabric_qty);
  const fabricPrice = parseLocaleNumber(values.fabric_price);
  const fabricPrintingPrice = values.fabric_printing_enabled ? parseLocaleNumber(values.fabric_printing_price) : 0;
  const fabricCost = fabricQty * fabricPrice;
  const fabricPrintingCost = fabricQty * fabricPrintingPrice;
  const additional = (values.additional_materials || []).reduce(
    (acc, material) => {
      const qty = parseLocaleNumber(material.qty);
      const materialCost = qty * parseLocaleNumber(material.price);
      const printingCost = material.printing_enabled ? qty * parseLocaleNumber(material.printing_price) : 0;
      return {
        material: acc.material + materialCost,
        printing: acc.printing + printingCost
      };
    },
    { material: 0, printing: 0 }
  );
  const additionalMaterialsCost = additional.material;
  const additionalPrintingCost = additional.printing;
  const totalMaterialsCost = fabricCost + additionalMaterialsCost;
  const totalPrintingCost = fabricPrintingCost + additionalPrintingCost;
  const totalMaterial = totalMaterialsCost + totalPrintingCost;
  const sewing = parseLocaleNumber(values.sewing_cost);
  const accessory = parseLocaleNumber(values.accessory_cost);
  const label = parseLocaleNumber(values.label_cost);
  const shipping = parseLocaleNumber(values.shipping_cost);
  const other = parseLocaleNumber(values.other_cost);
  const totalComponentsCost = sewing + accessory + label + shipping + other;
  const margin =
    values.margin_preset === "custom"
      ? parseLocaleNumber(values.custom_margin)
      : parseLocaleNumber(values.margin_preset);

  const totalHpp = totalMaterial + totalComponentsCost;
  const sellingPrice = totalHpp * (1 + margin / 100);
  const profit = sellingPrice - totalHpp;
  const profitPercent = totalHpp > 0 ? (profit / totalHpp) * 100 : 0;

  return {
    fabricCost,
    fabricPrintingCost,
    additionalMaterialsCost,
    additionalPrintingCost,
    totalMaterialsCost,
    totalPrintingCost,
    totalMaterial,
    totalComponentsCost,
    totalHpp,
    margin,
    sellingPrice,
    profit,
    profitPercent
  };
}
