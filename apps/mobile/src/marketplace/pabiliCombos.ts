/** Pre-made pabili combos: tap to drop the items into the list, then edit qty. */

export type ComboItem = { name: string; qty: string };

export type PabiliCombo = {
  id: string;
  label: string;
  hint: string;
  /** Pre-fills "where to buy" when the combo is picked. */
  store?: string;
  items: ComboItem[];
};

export const PABILI_COMBOS: PabiliCombo[] = [
  {
    id: 'jollibee',
    label: 'Jollibee',
    hint: 'Bida ang saya',
    store: 'Jollibee',
    items: [
      { name: 'Chickenjoy bucket 6pc', qty: '1' },
      { name: 'Jolly Spaghetti', qty: '2' },
      { name: 'Yumburger', qty: '2' },
      { name: 'Jolly Crispy Fries', qty: '1' },
      { name: 'Peach Mango Pie', qty: '2' },
      { name: 'Coke float', qty: '2' },
    ],
  },
  {
    id: 'condiments',
    label: 'Condiments',
    hint: 'Pangsahog essentials',
    items: [
      { name: 'Toyo 1L', qty: '1' },
      { name: 'Suka 1L', qty: '1' },
      { name: 'Patis 350ml', qty: '1' },
      { name: 'Asin 1kg', qty: '1' },
      { name: 'Paminta 50g', qty: '1' },
      { name: 'Bawang', qty: '3' },
      { name: 'Sibuyas', qty: '3' },
      { name: 'Mantika 1L', qty: '1' },
    ],
  },
  {
    id: 'laundry',
    label: 'Laundry',
    hint: 'Labada combo',
    items: [
      { name: 'Detergent powder 1kg', qty: '1' },
      { name: 'Fabric conditioner 1L', qty: '1' },
      { name: 'Bleach 500ml', qty: '1' },
      { name: 'Bath soap', qty: '2' },
    ],
  },
  {
    id: 'beverage',
    label: 'Beverages',
    hint: 'Drinks & coffee',
    items: [
      { name: 'Coke 1.5L', qty: '1' },
      { name: 'Bottled water 1L', qty: '2' },
      { name: 'Coffee sachets', qty: '6' },
      { name: 'Powdered juice', qty: '2' },
    ],
  },
  {
    id: 'sinigang',
    label: 'Sinigang',
    hint: 'Pork sinigang set',
    items: [
      { name: 'Pork ribs 1kg', qty: '1' },
      { name: 'Sinigang mix', qty: '2' },
      { name: 'Kangkong tali', qty: '1' },
      { name: 'Labanos', qty: '2' },
      { name: 'Okra', qty: '6' },
      { name: 'Kamatis', qty: '4' },
      { name: 'Siling haba', qty: '2' },
    ],
  },
  {
    id: 'adobo',
    label: 'Adobo',
    hint: 'Chicken adobo set',
    items: [
      { name: 'Chicken 1kg', qty: '1' },
      { name: 'Toyo 500ml', qty: '1' },
      { name: 'Suka 500ml', qty: '1' },
      { name: 'Bawang', qty: '1' },
      { name: 'Dahon ng laurel', qty: '1' },
      { name: 'Pamintang buo', qty: '1' },
    ],
  },
  {
    id: 'tinola',
    label: 'Tinola',
    hint: 'Chicken tinola set',
    items: [
      { name: 'Whole chicken 1kg', qty: '1' },
      { name: 'Sayote', qty: '2' },
      { name: 'Dahon ng sili', qty: '1' },
      { name: 'Luya', qty: '1' },
      { name: 'Patis 350ml', qty: '1' },
    ],
  },
];
