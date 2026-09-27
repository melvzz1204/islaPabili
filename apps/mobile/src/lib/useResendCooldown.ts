import { useEffect, useState } from 'react';

export const RESEND_COOLDOWN_SECONDS = 60;

export function formatCooldown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Cooldown timer for OTP "Resend code" buttons.
 * Supabase rate-limits OTP requests, so the resend button
 * should stay disabled for a minute after each send.
 */
export function useResendCooldown() {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  return {
    cooldown,
    coolingDown: cooldown > 0,
    start: () => setCooldown(RESEND_COOLDOWN_SECONDS),
  };
}
