import type { ExportSize, ExportSizeConfig } from "@/types/product";

export const EXPORT_SIZES: Record<ExportSize, ExportSizeConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram Portrait 1080x1350",
    width: 1080,
    height: 1350,
    orientation: "portrait"
  },
  landscape: {
    id: "landscape",
    label: "Landscape 1920x1080",
    width: 1920,
    height: 1080,
    orientation: "landscape"
  },
  a4: {
    id: "a4",
    label: "A4 1240x1754",
    width: 1240,
    height: 1754,
    orientation: "portrait"
  }
};
