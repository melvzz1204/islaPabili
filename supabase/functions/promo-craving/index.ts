// promo-craving: daily 11:00AM lunch-craving broadcast, ad-style.
//
// Server-side companion to the in-app local 11AM nudge
// (scheduleDailyCraving in apps/mobile/src/lib/notify.ts): this wakes
// killed/backgrounded apps by pushing to every stored Expo token and
// writing a promo inbox row per customer. Run daily at 11:00 Asia/Manila
// via Supabase cron (see README cron section).
//
// Auth: Supabase cron (x-cron-secret: CRON_SECRET) or an admin JWT.
// POST { title?: string, body?: string } — defaults rotate by day.

import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ROTATION: { title: string; body: string }[] = [
  { title: "11AM na! Gutom ka na ba? 🍚", body: "Anong lunch cravings mo? Pabili ka na — rider ang bahala." },
  { title: "Lunch break malapit na 🍗", body: "Order na bago mag-lunch rush. Mabilis ang rider ngayon." },
  { title: "Anong ulam today? 🍲", body: "Pabili ng paborito mo sa IslaPabili — door-to-door, COD pa." },
  { title: "Merienda o lunch? 🥤", body: "Isang tap lang, darating ang cravings mo. Open Shop na!" },
  { title: "Gutom check! 👀", body: "Huwag magpalipas ng gutom — magpabili ka na bago 12PM rush." },
  { title: "Craving alert 🍔", body: "Masarap kumain nang busog. Order na, sagot na ng rider ang pila." },
  { title: "Tanghalian na! 🐟", body: "Fresh, mainit, delivered. Magpabili ka na sa IslaPabili." },
];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: { message: "Method not allowed." } });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!url || !anonKey || !serviceKey) {
    return json(500, { error: { message: "Push service is not configured." } });
  }

  const isCron = cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret;
  const admin = createClient(url, serviceKey);
  if (!isCron) {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (userError || !callerId) return json(401, { error: { message: "Not signed in." } });
    const { data: profile } = await admin.from("profiles").select("role").eq("id", callerId).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      return json(403, { error: { message: "Admins only." } });
    }
  }

  let override: { title?: string; body?: string } = {};
  try {
    override = (await req.json()) as { title?: string; body?: string };
  } catch {
    // Empty body is fine; rotation applies.
  }
  const day = Math.floor(Date.now() / 86400000);
  const copy = ROTATION[day % ROTATION.length]!;
  const title = override.title?.trim() || copy.title;
  const body = override.body?.trim() || copy.body;

  // Customers only: riders/merchants get order + chat pushes, not promos.
  const { data: customers } = await admin.from("profiles").select("id").eq("role", "customer").limit(5000);
  const customerIds = [...new Set(((customers ?? []) as { id: string }[]).map((c) => c.id))];
  if (customerIds.length === 0) return json(200, { sent: 0, customers: 0 });

  // Chunked: a single .in() with thousands of ids would blow URL limits.
  const tokenRows: { user_id: string; token: string }[] = [];
  for (let i = 0; i < customerIds.length; i += 200) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", customerIds.slice(i, i + 200));
    tokenRows.push(...((tokens ?? []) as { user_id: string; token: string }[]));
  }
  const byUser = new Map<string, string>();
  for (const t of tokenRows) {
    if (/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t.token) && !byUser.has(t.user_id)) {
      byUser.set(t.user_id, t.token);
    }
  }

  // Inbox rows (one per customer) so the promo is visible in-app too.
  const rows = customerIds.map((user_id) => ({ user_id, kind: "promo", title, body }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("notifications").insert(rows.slice(i, i + 500));
  }

  const messages = [...byUser.values()].map((to) => ({
    to,
    title,
    body,
    sound: "default" as const,
    priority: "high" as const,
    channelId: "isla-orders",
    data: { kind: "promo" },
  }));
  if (messages.length === 0) return json(200, { sent: 0, customers: customerIds.length });

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      if (res.ok) sent += Math.min(100, messages.length - i);
    } catch {
      // Best-effort per batch; inbox rows already written.
    }
  }
  console.log(`Promo craving broadcast → ${sent} token(s), ${customerIds.length} inbox rows.`);
  return json(200, { sent, customers: customerIds.length });
});
