import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from './data';

/** Price/name snapshot at add-time so the cart survives catalog edits. */
export type CartLine = {
  productId: string;
  merchantId: string;
  name: string;
  /** Null for free-text lines: the store confirms the price when packing. */
  price: number | null;
  photoUrl: string | null;
  qty: number;
  /** True for customer-typed lines (no catalog product behind them). */
  custom: boolean;
};

const STORAGE_KEY = 'islapabili_guest_cart_v1';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  loaded: boolean;
  add: (product: Product, qty?: number) => void;
  /** Free-text line for a store: the store sets the price when packing. */
  addCustom: (merchantId: string, name: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const entry of raw as Partial<CartLine>[]) {
    if (
      entry &&
      typeof entry.productId === 'string' &&
      typeof entry.name === 'string' &&
      (entry.price == null || typeof entry.price === 'number') &&
      typeof entry.qty === 'number' &&
      entry.qty > 0
    ) {
      out.push({
        productId: entry.productId,
        merchantId: typeof entry.merchantId === 'string' ? entry.merchantId : '',
        name: entry.name,
        price: typeof entry.price === 'number' ? entry.price : null,
        photoUrl: typeof entry.photoUrl === 'string' ? entry.photoUrl : null,
        qty: Math.min(Math.floor(entry.qty), 99),
        custom: entry.custom === true,
      });
    }
  }
  return out;
}

export function CartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        try {
          setLines(sanitize(raw ? JSON.parse(raw) : []));
        } catch {
          setLines([]);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) {
          setLines([]);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => undefined);
  }, [lines, loaded]);

  const add = useCallback((product: Product, qty = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.productId === product.id);
      if (found) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, qty: Math.min(l.qty + qty, 99) } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          merchantId: product.merchantId,
          name: product.name,
          price: product.price,
          photoUrl: product.photoUrl,
          qty: Math.min(Math.max(qty, 1), 99),
          custom: false,
        },
      ];
    });
  }, []);

  const addCustom = useCallback((merchantId: string, name: string, qty = 1) => {
    const clean = name.trim();
    if (!clean) return;
    const id = `custom-${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`;
    setLines((prev) => [
      ...prev,
      {
        productId: id,
        merchantId,
        name: clean,
        price: null,
        photoUrl: null,
        qty: Math.min(Math.max(qty, 1), 99),
        custom: true,
      },
    ]);
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, qty: Math.min(Math.floor(qty), 99) } : l)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * (l.price ?? 0), 0),
      loaded,
      add,
      addCustom,
      setQty,
      remove,
      clear,
    }),
    [lines, loaded, add, addCustom, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
