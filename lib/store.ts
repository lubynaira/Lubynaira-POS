"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { isLocalImageUrl } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type { AppView, Brand, BrandSettings, Customer, Product, UserRole } from "@/types/product";

interface HppState {
  activeView: AppView;
  products: Product[];
  customers: Customer[];
  brands: Brand[];
  settings: BrandSettings;
  role: UserRole;
  editingProduct: Product | null;
  setActiveView: (view: AppView) => void;
  setProducts: (products: Product[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setBrands: (brands: Brand[]) => void;
  addCustomer: (customer: Customer) => void;
  addBrand: (brand: Brand) => void;
  removeCustomer: (id: string) => void;
  removeBrand: (id: string) => void;
  clearLocalDrafts: () => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  duplicateProduct: (product: Product) => Product;
  setSettings: (settings: BrandSettings) => void;
  setRole: (role: UserRole) => void;
  startEdit: (product: Product) => void;
  clearEditing: () => void;
}

interface PersistedHppState {
  activeView: AppView;
  products: Product[];
  customers: Customer[];
  brands: Brand[];
  settings: BrandSettings;
  role: UserRole;
}

const defaultSettings: BrandSettings = {
  brand_name: "Skupy Fashion",
  logo_url: null,
  theme_color: "#cb9e36"
};

function getSafeLocalStorage(): StateStorage {
  if (typeof window === "undefined") {
    throw new Error("Local storage hanya tersedia di browser.");
  }

  return {
    getItem: (name) => window.localStorage.getItem(name),
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value);
      } catch (error) {
        console.warn("Draft lokal tidak disimpan karena storage penuh.", error);
      }
    },
    removeItem: (name) => window.localStorage.removeItem(name)
  };
}


export const useHppStore = create<HppState>()(
  persist(
    (set, get) => ({
      activeView: "dashboard",
      products: [],
      customers: [],
      brands: [],
      settings: defaultSettings,
      role: "owner",
      editingProduct: null,
      setActiveView: (activeView) => set({ activeView }),
      setProducts: (products) => set({ products }),
      setCustomers: (customers) => set({ customers }),
      setBrands: (brands) => set({ brands }),
      addCustomer: (customer) =>
        set((state) => ({
          customers: [customer, ...(state.customers || []).filter((item) => item.id !== customer.id)]
        })),
      addBrand: (brand) =>
        set((state) => ({
          brands: [brand, ...(state.brands || []).filter((item) => item.id !== brand.id)]
        })),
      removeCustomer: (id) =>
        set((state) => ({
          customers: (state.customers || []).filter((customer) => customer.id !== id)
        })),
      removeBrand: (id) =>
        set((state) => ({
          brands: (state.brands || []).filter((brand) => brand.id !== id)
        })),
      clearLocalDrafts: () => {
        try {
          window.localStorage.removeItem("skupy-hpp-gamis-store");
        } catch {
          // Clearing local drafts should never block the app.
        }
        set({ products: [], editingProduct: null });
      },
      addProduct: (product) =>
        set((state) => ({
          products: [product, ...(state.products || []).filter((item) => item.id !== product.id)]
        })),
      updateProduct: (product) =>
        set((state) => ({
          products: (state.products || []).map((item) => (item.id === product.id ? product : item))
        })),
      removeProduct: (id) =>
        set((state) => ({
          products: (state.products || []).filter((product) => product.id !== id)
        })),
      duplicateProduct: (product) => {
        const clone: Product = {
          ...product,
          id: generateId(),
          created_at: new Date().toISOString(),
          product_code: `${product.product_code}-COPY`,
          product_name: `${product.product_name} Copy`
        };
        get().addProduct(clone);
        return clone;
      },
      setSettings: (settings) => set({ settings }),
      setRole: (role) => set({ role }),
      startEdit: (editingProduct) => set({ editingProduct, activeView: "calculator" }),
      clearEditing: () => set({ editingProduct: null })
    }),
    {
      name: "skupy-hpp-gamis-store",
      storage: createJSONStorage<PersistedHppState>(() => getSafeLocalStorage()),
      version: 2,
      partialize: (state) => ({
        products: (state.products || []).map(sanitizeProductForStorage),
        customers: (state.customers || []).map(sanitizeCustomerForStorage),
        brands: (state.brands || []).map(sanitizeBrandForStorage),
        settings: sanitizeSettingsForStorage(state.settings),
        role: state.role,
        activeView: state.activeView
      }),
      migrate: (persistedState) => sanitizePersistedState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState)
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (!error) return;
        try {
          window.localStorage.removeItem("skupy-hpp-gamis-store");
        } catch {
          // Ignore inaccessible storage.
        }
      }
    }
  )
);

function sanitizePersistedState(value: unknown): PersistedHppState {
  const state = (value && typeof value === "object" ? value : {}) as Partial<PersistedHppState>;
  const customers = Array.isArray(state.customers) ? state.customers.map(sanitizeCustomerForStorage) : [];
  const brands = Array.isArray(state.brands) ? state.brands.map(sanitizeBrandForStorage) : [];

  return {
    activeView: sanitizeActiveView(state.activeView),
    products: Array.isArray(state.products) ? state.products.map(sanitizeProductForStorage) : [],
    customers,
    brands: mergeLegacyBrandsForStorage(brands, customers),
    settings: sanitizeSettingsForStorage(state.settings || defaultSettings),
    role: state.role || "owner"
  };
}

function sanitizeActiveView(view: unknown): AppView {
  if (view === "history" || view === "converter") return "conversion";
  if (
    view === "dashboard" ||
    view === "customers" ||
    view === "calculator" ||
    view === "models" ||
    view === "conversion" ||
    view === "kalkulator" ||
    view === "settings"
  ) {
    return view;
  }
  return "dashboard";
}

function sanitizeProductForStorage(product: Product): Product {
  return {
    ...product,
    brand_id: product.brand_id || null,
    customer_id: product.customer_id || null,
    logo_url: isLocalImageUrl(product.logo_url) ? null : product.logo_url,
    photo_url: isLocalImageUrl(product.photo_url) ? null : product.photo_url,
    additional_materials: Array.isArray(product.additional_materials) ? product.additional_materials : []
  };
}

function sanitizeCustomerForStorage(customer: Customer): Customer {
  return {
    ...customer,
    phone: customer.phone || customer.whatsapp || "",
    logo_url: isLocalImageUrl(customer.logo_url) ? null : customer.logo_url
  };
}

function sanitizeBrandForStorage(brand: Brand): Brand {
  return {
    ...brand,
    customer_id: brand.customer_id || null,
    logo_url: isLocalImageUrl(brand.logo_url) ? null : brand.logo_url
  };
}

function mergeLegacyBrandsForStorage(brands: Brand[], customers: Customer[]) {
  const safeBrands = Array.isArray(brands) ? brands : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const existing = new Set(safeBrands.map((brand) => brand.brand_name.toLowerCase()));
  const legacyBrands = safeCustomers
    .filter((customer) => customer.brand_name && !existing.has(customer.brand_name.toLowerCase()))
    .map((customer) => ({
      id: `legacy-${customer.id}`,
      created_at: customer.created_at,
      brand_name: customer.brand_name || customer.customer_name,
      logo_url: isLocalImageUrl(customer.logo_url) ? null : customer.logo_url,
      customer_id: customer.id,
      customer_name: customer.customer_name,
      owner: customer.customer_name,
      legacy: true
    }));

  return [...safeBrands, ...legacyBrands];
}

function sanitizeSettingsForStorage(settings: BrandSettings): BrandSettings {
  return {
    ...defaultSettings,
    ...settings,
    logo_url: isLocalImageUrl(settings.logo_url) ? null : settings.logo_url
  };
}
