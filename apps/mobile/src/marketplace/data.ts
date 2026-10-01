import { shouldFilterTowns, TOWN_LABELS, type Town } from '@isla/shared';
import type { Database, Supabase } from '@isla/supabase';

/** Live catalog types (Supabase) for the public guest marketplace. */

/** Flagship merchant, Jollibee Boac (see supabase/seed.sql). Menu/prices/stock all come from the DB. */
export const JOLLIBEE_MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

export type MerchantKind = 'pharmacy' | 'restaurant' | 'grocery' | 'retail' | 'electronics';

export type Merchant = {
  id: string;
  name: string;
  kind: MerchantKind;
  town: string;
  tagline: string;
};

type DbCategory = Database['public']['Enums']['merchant_category'];

const KIND_FROM_DB: Record<DbCategory, MerchantKind> = {
  drugstore: 'pharmacy',
  fast_food: 'restaurant',
  grocery: 'grocery',
  local: 'retail',
};

export const KIND_LABEL: Record<MerchantKind, string> = {
  pharmacy: 'Pharmacy',
  restaurant: 'Restaurant',
  grocery: 'Grocery',
  retail: 'Retail',
  electronics: 'Electronics',
};

export type Category = { id: string; label: string };

export type Product = {
  id: string;
  merchantId: string;
  categoryId: string;
  categoryLabel: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  unit: string;
  photoUrl: string | null;
};

type MerchantRow = Database['public']['Tables']['merchants']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];

function toMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    name: row.name,
    kind: KIND_FROM_DB[row.category] ?? 'retail',
    town: TOWN_LABELS[row.town] ?? row.town,
    tagline: row.address ?? KIND_LABEL[KIND_FROM_DB[row.category] ?? 'retail'],
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    categoryId: row.category,
    categoryLabel: row.category,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock: row.stock,
    unit: row.unit,
    photoUrl: row.photo_url,
  };
}

/**
 * Public catalog read, anon-safe via products_select_public / merchants_select.
 *
 * `towns` restricts the result set to those municipalities. Omit it, or pass
 * every supported town, to return the whole island (the default for guests).
 */
export async function fetchMerchants(
  client: Supabase,
  towns?: readonly Town[],
): Promise<Merchant[]> {
  const restricted = shouldFilterTowns(towns);
  let query = client.from('merchants').select('*').eq('is_active', true);
  if (restricted) query = query.in('town', [...towns!]);
  const { data, error } = await query.order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMerchant);
}

export async function fetchMerchant(client: Supabase, id: string): Promise<Merchant | null> {
  const { data, error } = await client.from('merchants').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data && data.is_active ? toMerchant(data) : null;
}

export async function fetchProducts(client: Supabase, merchantId: string): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toProduct);
}

export function categoriesOf(products: Product[]): Category[] {
  const seen = new Map<string, string>();
  for (const p of products) {
    if (!seen.has(p.categoryId)) seen.set(p.categoryId, p.categoryLabel);
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

/** Resolve a product-photos storage path (or absolute URL) to a fetchable URL. */
export function productPhotoSrc(client: Supabase, photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  const { data } = client.storage.from('product-photos').getPublicUrl(photoUrl);
  return data.publicUrl;
}

export function searchProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
}

export const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
