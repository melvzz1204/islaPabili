import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Badge, Field, Modal } from '../components/ui';
import { OrdersInbox } from './Orders';

type Merchant = Database['public']['Tables']['merchants']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

type FormState = {
  id?: string;
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  unit: string;
  is_active: boolean;
  file: File | null;
  photo_url: string | null;
};

const EMPTY_FORM: FormState = {
  name: '',
  category: 'General',
  description: '',
  price: '',
  stock: '0',
  unit: 'pc',
  is_active: true,
  file: null,
  photo_url: null,
};

async function uploadPhoto(file: File, merchantId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `product-photos/${merchantId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('product-photos').upload(path, file, {
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

function photoSrc(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  const { data } = supabase.storage.from('product-photos').getPublicUrl(photoUrl);
  return data.publicUrl;
}

export function Dashboard({ merchant, onSignOut }: { merchant: Merchant; onSignOut: () => void }) {
  const [tab, setTab] = useState<'products' | 'orders'>('orders');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState(merchant.name);
  const [storePhone, setStorePhone] = useState(merchant.phone ?? '');
  const [storeAddress, setStoreAddress] = useState(merchant.address ?? '');
  const [savingStore, setSavingStore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProducts(data ?? []);
  }, [merchant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setError(null);
    setModal({ ...EMPTY_FORM });
  };

  const openEdit = (p: Product) => {
    setError(null);
    setModal({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      stock: String(p.stock),
      unit: p.unit,
      is_active: p.is_active,
      file: null,
      photo_url: p.photo_url,
    });
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const price = Number(modal.price);
    const stock = Math.floor(Number(modal.stock));
    if (!modal.name.trim()) {
      setError('Enter a product name.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Enter a valid price greater than zero.');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setError('Stock must be zero or more.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const photo_url = modal.file ? await uploadPhoto(modal.file, merchant.id) : modal.photo_url;
      const payload = {
        merchant_id: merchant.id,
        name: modal.name.trim(),
        category: modal.category.trim() || 'General',
        description: modal.description.trim(),
        price,
        stock,
        unit: modal.unit.trim() || 'pc',
        is_active: modal.is_active,
        photo_url,
      };
      const { error } = modal.id
        ? await supabase.from('products').update(payload).eq('id', modal.id)
        : await supabase.from('products').insert(payload);
      if (error) throw error;
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  };

  const removeProduct = async (p: Product) => {
    if (!window.confirm(`Delete “${p.name}”?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  };

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    const { error } = await supabase
      .from('merchants')
      .update({ name: storeName.trim(), phone: storePhone.trim() || null, address: storeAddress.trim() || null })
      .eq('id', merchant.id);
    setSavingStore(false);
    if (error) setError(error.message);
  };

  return (
    <>
      <div className="row-between">
        <div>
          <h1>{merchant.name}</h1>
          <p>Catalog manager · {products.filter((p) => p.is_active).length} live products</p>
        </div>
        <div className="btn-row">
          <button type="button" className="isla-btn isla-btn-accent isla-btn-sm" onClick={openNew}>
            + Add product
          </button>
          <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={onSignOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="chip-row" role="tablist" aria-label="Dashboard sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={`isla-btn isla-btn-sm ${tab === 'orders' ? 'isla-btn-primary' : 'isla-btn-secondary'}`}
          onClick={() => setTab('orders')}
        >
          Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'products'}
          className={`isla-btn isla-btn-sm ${tab === 'products' ? 'isla-btn-primary' : 'isla-btn-secondary'}`}
          onClick={() => setTab('products')}
        >
          Products
        </button>
      </div>

      {tab === 'orders' ? (
        <OrdersInbox merchantId={merchant.id} />
      ) : (
        <>
      {error ? <p className="error" role="alert">{error}</p> : null}

      {loading ? (
        <div className="isla-card"><p>Loading products…</p></div>
      ) : products.length === 0 ? (
        <div className="isla-card">
          <h2>No products yet</h2>
          <p>Add your first product to appear in the customer marketplace.</p>
          <div className="btn-row">
            <button type="button" className="isla-btn isla-btn-primary" onClick={openNew}>
              + Add product
            </button>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => {
            const src = photoSrc(p.photo_url);
            return (
              <div key={p.id} className="isla-card">
                {src ? (
                  <img className="product-photo" src={src} alt={p.name} loading="lazy" />
                ) : (
                  <div className="product-photo-fallback" aria-hidden="true">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="row-between">
                  <span className="product-name">{p.name}</span>
                  <Badge tone={p.is_active ? 'ok' : 'bad'}>{p.is_active ? 'LIVE' : 'HIDDEN'}</Badge>
                </div>
                <p>{p.category} · Stock: {p.stock}</p>
                <span className="product-price">₱{Number(p.price).toFixed(2)}</span>
                <div className="btn-row">
                  <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button type="button" className="isla-btn isla-btn-secondary isla-btn-sm" onClick={() => void toggleActive(p)}>
                    {p.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" className="isla-btn isla-btn-danger isla-btn-sm" onClick={() => void removeProduct(p)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={(e) => void saveStore(e)} className="isla-card">
        <h2>Storefront</h2>
        <Field label="Store name">
          <input className="isla-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </Field>
        <Field label="Contact number">
          <input className="isla-input" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} />
        </Field>
        <Field label="Address">
          <input className="isla-input" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
        </Field>
        <div className="btn-row">
          <button type="submit" className="isla-btn isla-btn-secondary" disabled={savingStore}>
            {savingStore ? 'Saving…' : 'Save storefront'}
          </button>
        </div>
      </form>

      {modal ? (
        <Modal title={modal.id ? 'Edit product' : 'Add product'} onClose={() => setModal(null)}>
          <form onSubmit={(e) => void saveProduct(e)} className="isla-card" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
            <Field label="Name (required)">
              <input className="isla-input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <input className="isla-input" placeholder="General" value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="isla-input" value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
            </Field>
            <Field label="Price ₱ (required)">
              <input className="isla-input" inputMode="decimal" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} />
            </Field>
            <Field label="Stock">
              <input className="isla-input" inputMode="numeric" value={modal.stock} onChange={(e) => setModal({ ...modal, stock: e.target.value })} />
            </Field>
            <Field label="Unit">
              <input className="isla-input" placeholder="pc" value={modal.unit} onChange={(e) => setModal({ ...modal, unit: e.target.value })} />
            </Field>
            <Field label="Photo">
              <input
                className="isla-input"
                type="file"
                accept="image/*"
                onChange={(e) => setModal({ ...modal, file: e.target.files?.[0] ?? null })}
              />
            </Field>
            <label className="isla-label">
              <span>
                <input
                  type="checkbox"
                  checked={modal.is_active}
                  onChange={(e) => setModal({ ...modal, is_active: e.target.checked })}
                />{' '}
                Visible in marketplace
              </span>
            </label>
            {error ? <p className="error" role="alert">{error}</p> : null}
            <button type="submit" className="isla-btn isla-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.id ? 'Save changes' : 'Add product'}
            </button>
          </form>
        </Modal>
      ) : null}
        </>
      )}
    </>
  );
}
