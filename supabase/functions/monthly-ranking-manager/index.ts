import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const day = now.getDate();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split("T")[0];

    const actions: string[] = [];

    // On the 22nd: lock current month rankings
    if (day >= 22) {
      const { error } = await supabase
        .from("monthly_rankings")
        .update({ is_locked: true })
        .eq("month", currentMonth)
        .eq("is_locked", false);
      if (error) throw error;
      actions.push(`Locked rankings for ${currentMonth}`);
    }

    // On the 1st: archive previous month
    if (day === 1) {
      const { error } = await supabase
        .from("monthly_rankings")
        .update({ is_archived: true })
        .eq("month", previousMonth)
        .eq("is_archived", false);
      if (error) throw error;
      actions.push(`Archived rankings for ${previousMonth}`);
    }

    return new Response(
      JSON.stringify({ success: true, actions, day, currentMonth }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
