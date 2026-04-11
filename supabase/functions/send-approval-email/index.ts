import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@2.7.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, userName } = await req.json();

    if (!userId || !userName) {
      return new Response(
        JSON.stringify({ error: "userId and userName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = Deno.env.get("MAILU_SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("MAILU_SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("MAILU_SMTP_USER");
    const smtpPass = Deno.env.get("MAILU_SMTP_PASS");
    const fromEmail = Deno.env.get("MAILU_FROM_EMAIL") || smtpUser;
    const fromName = Deno.env.get("MAILU_FROM_NAME") || "Conexões 06:30";
    const appUrl = Deno.env.get("APP_URL") || "https://conexoes0630.vercel.app";

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
    }

    // Use service role key to access auth.users
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser.user?.email) {
      throw new Error(`Could not find email for user: ${authError?.message || "email not found"}`);
    }

    const email = authUser.user.email;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const htmlContent = [
      '<!DOCTYPE html>',
      '<html lang="pt-BR">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '</head>',
      '<body style="margin: 0; padding: 0; background-color: #121212;">',
      '  <div style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #e0e0e0; max-width: 600px; margin: 20px auto; padding: 30px; border-radius: 8px; border: 1px solid #333333;">',
      `    <h2 style="color: #ffffff; margin-top: 0;">Olá, <span style="color: #ff5c00;">${userName}</span>! 🎉</h2>`,
      '    <p>Temos uma ótima notícia: a sua solicitação de cadastro foi <strong style="color: #ffffff;">aprovada</strong> com sucesso!</p>',
      '',
      '    <div style="background-color: #2a2a2a; padding: 20px; border-radius: 6px; border-left: 4px solid #ff5c00; margin: 25px 0;">',
      '      <p style="margin: 0; color: #e0e0e0; font-style: italic;">',
      '        "O despertador do sucesso toca às 06:30."',
      '      </p>',
      '    </div>',
      '',
      '    <p>Você já está liberado para acessar o painel e começar a usar todos os recursos do aplicativo.</p>',
      '',
      '    <p style="text-align: center; margin: 35px 0;">',
      `      <a href="${appUrl}/login" style="display: inline-block; padding: 14px 28px; color: #ffffff; background-color: #ff5c00; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Acessar o Aplicativo</a>`,
      '    </p>',
      '',
      '    <p style="font-size: 14px; color: #a0a0a0;">Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:<br>',
      `    <a href="${appUrl}/login" style="color: #ff5c00; word-break: break-all;">${appUrl}/login</a></p>`,
      '',
      '    <br>',
      '    <p style="color: #a0a0a0;">Abraços,<br><strong style="color: #ffffff;">Equipe Conexões <span style="color: #ff5c00;">06:30</span></strong></p>',
      '  </div>',
      '</body>',
      '</html>',
    ].join('\n');

    const textContent = `Olá, ${userName}!\n\nSua conta foi aprovada. Acesse: ${appUrl}/login\n\nEquipe Conexões 06:30`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: "Sua conta no Conexões 06:30 foi aprovada! 🎉",
      text: textContent,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId, sentTo: email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
