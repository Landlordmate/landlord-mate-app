import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Returns the agent(s) linked to the CALLING landlord — resolved from their own
// properties' agent_email / added_by_agent_id, which a landlord's own RLS can't
// turn into a name/email (same cross-user-read problem get-agent-landlords solves
// in the other direction). This function requires a valid JWT (verify_jwt is on)
// and resolves the caller from that token itself rather than trusting a
// client-supplied id — deliberately stricter than get-agent-landlords/
// lookup-landlord, which currently trust whatever id/email the client sends.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAsCaller.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: props, error: propsError } = await supabaseAdmin
      .from("properties")
      .select("agent_email, added_by_agent_id")
      .eq("user_id", user.id);
    if (propsError) throw propsError;

    const emails = [...new Set((props || []).map((p) => (p.agent_email || "").toLowerCase().trim()).filter(Boolean))];
    const agentIds = [...new Set((props || []).map((p) => p.added_by_agent_id).filter(Boolean))];

    const agentsById = new Map();

    if (agentIds.length > 0) {
      const { data: byId } = await supabaseAdmin
        .from("users")
        .select("id, email, agency_name, account_type")
        .in("id", agentIds)
        .eq("account_type", "agent");
      for (const a of byId || []) agentsById.set(a.id, a);
    }

    if (emails.length > 0) {
      const { data: byEmail } = await supabaseAdmin
        .from("users")
        .select("id, email, agency_name, account_type")
        .in("email", emails)
        .eq("account_type", "agent");
      for (const a of byEmail || []) agentsById.set(a.id, a);
    }

    const agents = Array.from(agentsById.values()).map((a) => ({
      id: a.id,
      email: a.email,
      agency_name: a.agency_name || null,
    }));

    return new Response(JSON.stringify({ agents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
