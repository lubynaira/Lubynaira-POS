import { supabase } from "@/lib/supabase";

export function isLocalImageUrl(value: string | null | undefined) {
  return Boolean(value?.startsWith("data:") || value?.startsWith("blob:"));
}

export function createLocalImagePreview(file: File) {
  return URL.createObjectURL(file);
}

export async function uploadPublicImage(file: File, bucket: "brand-assets" | "product-photos") {
  if (!supabase) {
    return createLocalImagePreview(file);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
