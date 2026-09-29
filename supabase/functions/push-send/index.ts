// push-send: server-side wake-up for killed/backgrounded apps.
//
// The sender's app is always open when it triggers this (dispatch, chat send,
// status advance), so no DB webhooks are needed: the client invokes this
// function, we verify the caller is an order participant with the user's own
// JWT, then push to the *recipient's* stored Expo tokens via the Expo Push
// API (service role reads only — clients never hold privileged credentials).
//
// POST { order_id: string, kind: 'pabili' | 'message' | 'status',
//        title?: string, body?: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Kind = "pabili" | "message" | "status";

type Body = {
  order_id?: string;
  kind?: Kind;
  title?: string;
  body?: string;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function snippet(text: string, max = 140): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: { message: "Method not allowed." } });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) {
    console.error("Supabase env is not configured.");
    return json(500, { error: { message: "Push service is not configured." } });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return json(400, { error: { message: "Invalid JSON body." } });
  }
  const { order_id: orderId, kind } = payload;
  if (!orderId || (kind !== "pabili" && kind !== "message" && kind !== "status")) {
    return json(400, { error: { message: "order_id and kind ('pabili' | 'message' | 'status') are required." } });
  }

  // Caller identity from their own JWT (forwarded by functions.invoke).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const callerId = userData.user?.id;
  if (userError || !callerId) return json(401, { error: { message: "Not signed in." } });

  const admin = createClient(url, serviceKey);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_number, town, dropoff_address, customer_id, rider_id, total_delivery_fee, status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return json(404, { error: { message: "Order not found." } });
  const o = order as {
    order_number: string;
    town: string;
    dropoff_address: string;
    customer_id: string;
    rider_id: string | null;
    total_delivery_fee: number | string | null;
    status: string;
  };
  const isCustomer = o.customer_id === callerId;
  const isRider = o.rider_id === callerId;
  if (!isCustomer && !isRider) return json(403, { error: { message: "Not an order participant." } });

  // Resolve recipients + copy from the database, not the wire.
  let recipientIds: string[] = [];
  let title = payload.title?.trim() || "";
  let body = payload.body?.trim() || "";
  let channelId = "isla-orders";

  if (kind === "pabili") {
    if (!isCustomer) return json(403, { error: { message: "Only the customer dispatches." } });
    const { data: requests } = await admin
      .from("order_requests")
      .select("rider_id")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .eq("is_current", true);
    recipientIds = [...new Set(((requests ?? []) as { rider_id: string }[]).map((r) => r.rider_id))];
    if (!title) title = `New pabili · #${o.order_number}`;
    if (!body) body = `${o.town} · ${o.dropoff_address} · ₱${Number(o.total_delivery_fee ?? 0)} fee — first to accept wins.`;
  } else if (kind === "message") {
    const otherId = isCustomer ? o.rider_id : o.customer_id;
    if (!otherId) return json(409, { error: { message: "No chat counterpart yet." } });
    recipientIds = [otherId];
    channelId = "isla-chat";
    const { data: sender } = await admin.from("profiles").select("full_name").eq("id", callerId).maybeSingle();
    const name = ((sender as { full_name?: string } | null)?.full_name?.trim()) || "New message";
    const { data: last } = await admin
      .from("order_messages")
      .select("body")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const text = (last as { body?: string } | null)?.body ?? body;
    if (!title) title = `${name} · #${o.order_number}`;
    if (!body) body = snippet(text || "Sent you a message.");
  } else {
    // status: rider's advance pings the customer; a customer cancel pings the rider.
    const otherId = isRider ? o.customer_id : o.rider_id;
    if (!otherId) return json(409, { error: { message: "Nobody to notify yet." } });
    recipientIds = [otherId];
    if (!title) title = `Order #${o.order_number}`;
    if (!body) body = `Status: ${o.status.replace(/_/g, " ")}.`;
  }

  if (recipientIds.length === 0) return json(200, { sent: 0 });

  const { data: tokens } = await admin.from("push_tokens").select("token").in("user_id", recipientIds);
  const pushTokens = [...new Set(((tokens ?? []) as { token: string }[]).map((t) => t.token))].filter((t) =>
    /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t),
  );
  if (pushTokens.length === 0) return json(200, { sent: 0 });

  const messages = pushTokens.map((to) => ({
    to,
    title,
    body: snippet(body),
    sound: "default",
    priority: "high",
    channelId,
    data: { orderId, kind },
  }));

  let res: Response;
  try {
    res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("Expo push request failed:", err);
    return json(502, { error: { message: "Push provider unreachable." } });
  }
  const resultText = await res.text();
  if (!res.ok) {
    console.error(`Expo push HTTP ${res.status}: ${resultText.slice(0, 300)}`);
    return json(502, { error: { message: "Push provider rejected the send." } });
  }
  console.log(`Push ${kind} for order ${o.order_number} → ${pushTokens.length} token(s).`);
  return json(200, { sent: pushTokens.length });
});
