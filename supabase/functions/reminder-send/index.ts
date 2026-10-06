// reminder-send: re-nudge customers with orders stuck in `delivered`.
//
// No auto-complete by design: the order waits until the customer taps
// "Natanggap ko na". This function wakes customers whose order has sat in
// `delivered` for 2h+ (or 6h+ since the last nudge), so unconfirmed
// deliveries don't go silent. Safe to run hourly via cron.
//
// Auth: Supabase cron (x-cron-secret: CRON_SECRET) or an admin JWT.
// POST { min_hours?: number } — defaults: first nudge 2h, repeat every 6h.

import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CRAVING_FALLBACK = "Nadala na ba? Pakiconfirm 👀";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: { message: "Method not allowed." } });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!url || !anonKey || !serviceKey) {
    return json(500, { error: { message: "Push service is not configured." } });
  }

  // Cron (service key, no user JWT) must present the shared secret.
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

  let minHours = 2;
  try {
    const payload = (await req.json()) as { min_hours?: number };
    if (typeof payload.min_hours === "number" && payload.min_hours > 0) minHours = payload.min_hours;
  } catch {
    // Empty body is fine; defaults apply.
  }

  const firstCutoff = new Date(Date.now() - minHours * 3600_000).toISOString();
  const repeatCutoff = new Date(Date.now() - 6 * 3600_000).toISOString();

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, order_number, customer_id, delivered_at, delivered_reminded_at")
    .eq("status", "delivered")
    .lte("delivered_at", firstCutoff)
    .or(`delivered_reminded_at.is.null,delivered_reminded_at.lte.${repeatCutoff}`)
    .limit(200);
  if (ordersError) return json(500, { error: { message: "Could not load delivered orders." } });
  const stuck = (orders ?? []) as {
    id: string;
    order_number: string;
    customer_id: string;
    delivered_at: string | null;
    delivered_reminded_at: string | null;
  }[];
  if (stuck.length === 0) return json(200, { sent: 0, nudged: 0 });

  let nudged = 0;
  let sent = 0;
  for (const o of stuck) {
    const title = CRAVING_FALLBACK;
    const body =
      `Order ${o.order_number} naghihintay pa ng confirm mo. ` +
      `Tap "Natanggap ko na" pag nakuha mo na — salamat!`;
    await admin.from("notifications").insert({
      user_id: o.customer_id,
      order_id: o.id,
      title,
      body,
    });
    const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", o.customer_id);
    const pushTokens = [...new Set(((tokens ?? []) as { token: string }[]).map((t) => t.token))].filter((t) =>
      /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t),
    );
    if (pushTokens.length > 0) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(
            pushTokens.map((to) => ({
              to,
              title,
              body,
              sound: "default",
              priority: "high",
              channelId: "isla-orders",
              data: { orderId: o.id, kind: "status" },
            })),
          ),
        });
        if (res.ok) sent += pushTokens.length;
      } catch {
        // Best-effort per order; inbox row already written.
      }
    }
    await admin.from("orders").update({ delivered_reminded_at: new Date().toISOString() }).eq("id", o.id);
    nudged += 1;
  }
  return json(200, { sent, nudged });
});
