import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "The Landlord Mate <support@thelandlordmate.com>";
const APP_URL = "https://app.thelandlordmate.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Notifies a landlord that a linked agent has requested specific personal
// documents (see document_pack_requests). Purely a notification -- it grants
// no access itself; that's document_agent_access, untouched by this function.
// Caller identity is resolved from their own session JWT (verify_jwt is on),
// same pattern as get-landlord-agents, rather than trusting a client-supplied
// agent name.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: agentUser }, error: authError } = await supabaseAsCaller.auth.getUser();
    if (authError || !agentUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { landlord_id, requested_types, note } = await req.json();
    if (!landlord_id || !Array.isArray(requested_types) || requested_types.length === 0) {
      return new Response(JSON.stringify({ error: "landlord_id and requested_types are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm this agent is actually linked to this landlord before sending
    // anything on their behalf -- mirrors the check in agent-update-landlord-name.
    const { data: agentRow } = await supabaseAdmin.from("users").select("email, agency_name, account_type").eq("id", agentUser.id).single();
    if (!agentRow || agentRow.account_type !== "agent") {
      return new Response(JSON.stringify({ error: "Only agents can send pack requests" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: linkedProperty } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("user_id", landlord_id)
      .or(`added_by_agent_id.eq.${agentUser.id},agent_email.eq.${(agentRow.email || "").toLowerCase()}`)
      .maybeSingle();
    if (!linkedProperty) {
      return new Response(JSON.stringify({ error: "This landlord isn't linked to your agency" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: landlordRow } = await supabaseAdmin.from("users").select("email, full_name").eq("id", landlord_id).single();
    if (!landlordRow?.email) {
      return new Response(JSON.stringify({ error: "Landlord not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentName = agentRow.agency_name || agentRow.email;
    const itemsList = requested_types.map((t: string) => `<li style="margin-bottom:6px;">${t}</li>`).join("");

    const html = `
    <div style="background:#F5F1E8;padding:32px 16px;font-family:Georgia,serif;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #EAE6DC;">
        <div style="padding:28px;">
          <p style="margin:0 0 6px;color:#0D1B2A;font-size:20px;font-weight:700;">Document request from ${agentName}</p>
          <p style="margin:0 0 18px;color:#5B6B7C;font-size:14px;">
            Hi ${landlordRow.full_name || "there"}, ${agentName} has asked you to share the following from your Landlord Mate account:
          </p>
          <ul style="margin:0 0 18px;padding-left:20px;color:#0D1B2A;font-size:14px;line-height:1.7;">
            ${itemsList}
          </ul>
          ${note ? `<p style="margin:0 0 18px;padding:12px 14px;background:#F5F1E8;border-radius:8px;color:#0D1B2A;font-size:13px;">"${note}"</p>` : ""}
          <div style="margin-top:8px;text-align:center;">
            <a href="${APP_URL}" style="display:inline-block;background:#0D1B2A;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px;">
              Review and share
            </a>
          </div>
          <p style="margin:22px 0 0;color:#8A97A3;font-size:12px;line-height:1.6;">
            Nothing is shared automatically. Log in to My Documents to choose exactly what to share, or to dismiss this request.
          </p>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #EAE6DC;">
          <p style="margin:0;color:#8A97A3;font-size:12px;">
            The Landlord Mate Ltd &middot; Penarth, Wales &middot;
            <a href="https://thelandlordmate.com" style="color:#8A97A3;">thelandlordmate.com</a>
          </p>
        </div>
      </div>
    </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: landlordRow.email,
        subject: `${agentName} has requested some documents`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
