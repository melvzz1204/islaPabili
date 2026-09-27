// Supabase Auth "Send SMS" hook → Semaphore (PH SMS gateway).
//
// Replaces Twilio for OTP delivery. Supabase POSTs { user: { phone }, sms: { otp } }
// signed with the hook secret; we verify the signature, then deliver via
// POST https://api.semaphore.co/api/v4/messages (form-encoded).
//
// Env (via `supabase secrets set`, never committed):
//   SEND_SMS_HOOK_SECRET – hook secret from Dashboard (format "v1,whsec_...").
//   SEMAPHORE_API_KEY    – from semaphore.co dashboard.
//   SEMAPHORE_SENDERNAME – optional; omit to use the account's default sender name.
//
// NOTE: Semaphore silently drops messages starting with the word "TEST",
// so the OTP template below never starts with it.

import { Webhook } from "npm:standardwebhooks@1.0.0";

const SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages";

type HookPayload = {
  user: { phone?: string };
  sms: { otp?: string };
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendViaSemaphore(phone: string, message: string): Promise<{ ok: boolean; detail: string }> {
  const apiKey = Deno.env.get("SEMAPHORE_API_KEY");
  if (!apiKey) return { ok: false, detail: "SEMAPHORE_API_KEY is not configured." };
  const senderName = Deno.env.get("SEMAPHORE_SENDERNAME") ?? undefined;

  const form = new URLSearchParams({ apikey: apiKey, number: phone, message });
  if (senderName) form.set("sendername", senderName);

  let res: Response;
  try {
    res = await fetch(SEMAPHORE_URL, { method: "POST", body: form });
  } catch (err) {
    return { ok: false, detail: `Semaphore request failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  const text = await res.text();
  if (!res.ok) return { ok: false, detail: `Semaphore HTTP ${res.status}: ${text.slice(0, 300)}` };
  return { ok: true, detail: text.slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: { message: "Method not allowed." } });

  const rawSecret = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
  const base64Secret = rawSecret.replace(/^v1,whsec_/, "");
  if (!base64Secret) {
    console.error("SEND_SMS_HOOK_SECRET is not configured.");
    return json(500, { error: { message: "SMS hook is not configured." } });
  }

  const payload = await req.text();
  let data: HookPayload;
  try {
    const wh = new Webhook(base64Secret);
    data = wh.verify(payload, Object.fromEntries(req.headers)) as HookPayload;
  } catch (err) {
    console.error("Hook signature verification failed:", err);
    return json(401, { error: { message: "Invalid hook signature." } });
  }

  const phone = data.user?.phone?.trim();
  const otp = data.sms?.otp?.trim();
  if (!phone || !otp) {
    console.error("Hook payload missing phone/otp.");
    return json(400, { error: { message: "Invalid SMS hook payload." } });
  }

  const message = `Your IslaPabili code is ${otp}. Never share this code.`;
  const result = await sendViaSemaphore(phone, message);
  if (!result.ok) {
    console.error(`Semaphore send failed for ${phone}: ${result.detail}`);
    return json(502, { error: { message: `Failed to send SMS: ${result.detail}` } });
  }

  console.log(`OTP sent via Semaphore to ${phone} (${result.detail})`);
  return json(200, {});
});
