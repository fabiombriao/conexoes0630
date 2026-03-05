import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: isSuperAdmin, error: roleError } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (roleError || !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Apenas Super Admin pode criar administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();
    const password = body?.password ?? "";
    const fullName = (body?.fullName ?? "").trim();
    const role = body?.role as "group_leader" | "admin";
    const adminPermissions = body?.adminPermissions ?? null;

    if (!email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "Nome, e-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["group_leader", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Papel inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      throw createError ?? new Error("Falha ao criar usuário");
    }

    const userId = created.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: fullName,
          status: "active",
          admin_permissions: role === "group_leader" ? adminPermissions : null,
        },
        { onConflict: "id" }
      );

    if (profileError) throw profileError;

    const { error: clearRolesError } = await adminClient.from("user_roles").delete().eq("user_id", userId);
    if (clearRolesError) throw clearRolesError;

    const { error: assignRoleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (assignRoleError) throw assignRoleError;

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
