/** Set when a guest taps "log in to checkout", the logged-in stack opens Checkout first. */
let returnToCheckout = false;

export function requestCheckoutReturn() {
  returnToCheckout = true;
}

export function consumeCheckoutReturn(): boolean {
  const v = returnToCheckout;
  returnToCheckout = false;
  return v;
}
