import { useState } from 'react';
import { SUPPORTED_TOWNS, TOWN_LABELS, type Town } from '@isla/shared';
import type { Database } from '@isla/supabase';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';

type Category = Database['public']['Enums']['merchant_category'];

const CATEGORY_LABELS: Record<Category, string> = {
  fast_food: 'Fast Food',
  grocery: 'Grocery',
  drugstore: 'Drugstore / Pharmacy',
  local: 'Local Shop',
};

async function uploadDoc(file: File, uid: string, key: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `onboarding-docs/${uid}/${key}.${ext}`;
  const { error } = await supabase.storage.from('onboarding-docs').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

export function ApplyForm({ userId, onSubmitted }: { userId: string; onSubmitted: () => void }) {
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState<Category>('local');
  const [town, setTown] = useState<Town | ''>('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [permit, setPermit] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storeName.trim().length < 2) {
      setError('Enter your store name.');
      return;
    }
    if (!town) {
      setError('Pick the town where your store operates.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const business_permit_url = permit ? await uploadDoc(permit, userId, 'business_permit') : null;
      const store_photo_url = photo ? await uploadDoc(photo, userId, 'store_photo') : null;
      const { error } = await supabase.from('merchant_applications').insert({
        applicant_id: userId,
        store_name: storeName.trim(),
        category,
        town: town as Town,
        address: address.trim() || null,
        phone: phone.trim() || null,
        business_permit_url,
        store_photo_url,
        status: 'pending',
      });
      if (error) throw error;
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="isla-card">
      <h1>Merchant application</h1>
      <p>Tell us about your store. A superadmin reviews every application before your catalog goes live.</p>
      <Field label="Store name (required)">
        <input className="isla-input" placeholder="Manny's Retail – Gasan" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
      </Field>
      <Field label="Store category">
        <select className="isla-input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </Field>
      <Field label="Town (required)">
        <select className="isla-input" value={town} onChange={(e) => setTown(e.target.value as Town)}>
          <option value="">Select town…</option>
          {SUPPORTED_TOWNS.map((t) => (
            <option key={t} value={t}>{TOWN_LABELS[t]}</option>
          ))}
        </select>
      </Field>
      <Field label="Store address">
        <input className="isla-input" placeholder="Street / barangay / landmark" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="Contact number">
        <input className="isla-input" placeholder="09XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Business permit (photo)">
        <input className="isla-input" type="file" accept="image/*" onChange={(e) => setPermit(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Storefront photo">
        <input className="isla-input" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </Field>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" className="isla-btn isla-btn-primary" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
