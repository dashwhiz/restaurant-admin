// Database row types — mirror the existing Supabase schema exactly.
// See docs/data-model.md for the full table reference. The database is the
// SAME one the old HTML app used; do not rename columns here without changing
// the database too.

export type Department = 'Бар' | 'Кујна';

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  department: Department | string;
  // Kalo / yield — tracked for RAW PREP loss only (defrosting, trimming), NOT
  // applied during cooking. See docs/features/kalo.md. There is no yield_pct
  // column: usable yield is derived from these two and computed where shown.
  kalo_defrost: number | null;
  kalo_trim: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  price_updated_at: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  product_id: string;
  quantity: number;
}

export interface Purchase {
  id: string;
  product_id: string;
  quantity: number;
  cost_per_unit: number;
  ddv_rate: number;
  price_with_ddv: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  recipe_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface WasteLog {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  created_at: string;
}

export interface StocktakeLog {
  id: string;
  product_id: string;
  system_qty: number;
  counted_qty: number;
  difference: number;
  created_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  type: string;
  event_date: string | null;
  guest_count: number;
  price_per_person: number;
  status: 'planned' | 'done' | string;
  notes: string | null;
  created_at: string;
}

export interface EventMenuItem {
  id: string;
  event_id: string;
  recipe_id: string;
  course: string;
  qty_per_person: number;
}

export interface PosImport {
  id: string;
  import_date: string;
  filename: string | null;
  total_items: number;
  total_revenue: number;
  total_gratis: number;
  matched_items: number;
  created_at: string;
}

export interface PosSalesItem {
  id: string;
  import_id: string;
  sifra: string | null;
  name: string | null;
  unit: string | null;
  qty: number;
  amount: number;
  gratis_qty: number;
  gratis_amount: number;
  recipe_id: string | null;
  matched: boolean;
}

// Maps a POS šifra to a recipe so daily imports auto-match next time.
// See docs/features/pos-import.md.
export interface PosMapping {
  id: string;
  sifra: string;
  recipe_id: string | null;
  skip: boolean;
  created_at: string;
}
