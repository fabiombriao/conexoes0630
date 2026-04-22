import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";
import type { PDFFont } from "npm:pdf-lib";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "term-commitments";

type ActionPayload = {
  action: "sign" | "decline";
  termVersionId: string;
  cpf?: string;
  signatureDataUrl?: string;
};

type DrawCommand =
  | {
      kind: "text";
      value: string;
      size: number;
      bold?: boolean;
      indent?: number;
      topGap?: number;
      bottomGap?: number;
      center?: boolean;
    }
  | { kind: "blank"; height: number };

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 70;

function stripBom(value: string) {
  return value.replace(/\uFEFF/g, "");
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid signature image");
  return {
    bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)),
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function buildCommands(markdown: string) {
  const commands: DrawCommand[] = [];
  const lines = stripBom(markdown).split(/\r?\n/);

  for (const rawLine of lines) {
    const normalized = rawLine.trim();

    if (!normalized) {
      commands.push({ kind: "blank", height: 8 });
      continue;
    }

    if (normalized === "TERMO DE ADESÃO –  CONEXÃO 6:30") {
      commands.push({ kind: "text", value: normalized, size: 16, bold: true, center: true, topGap: 4, bottomGap: 10 });
      continue;
    }

    if (/^\d+\./.test(normalized)) {
      commands.push({ kind: "text", value: normalized, size: 12, bold: true, topGap: 8, bottomGap: 6 });
      continue;
    }

    if (normalized.startsWith("-")) {
      commands.push({ kind: "text", value: normalized.replace(/^-+\s*/, "• "), size: 10.5, indent: 12, bottomGap: 2 });
      continue;
    }

    commands.push({ kind: "text", value: normalized, size: 10.5, bottomGap: 2 });
  }

  return commands;
}

async function drawPdf({
  title,
  contentMarkdown,
  memberName,
  cpf,
  signatureDataUrl,
}: {
  title: string;
  contentMarkdown: string;
  memberName: string;
  cpf: string;
  signatureDataUrl: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor(memberName);
  pdf.setSubject(title);
  pdf.setCreator("Conexão 6:30");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const commands = buildCommands(contentMarkdown);
  const signatureBytes = decodeDataUrl(signatureDataUrl).bytes;
  const signatureImage = await pdf.embedPng(signatureBytes);

  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN_TOP;
  const bodyWidth = A4_WIDTH - MARGIN_X * 2;

  const drawPageHeader = () => {
    page.drawText(title, {
      x: MARGIN_X,
      y,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 18;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: A4_WIDTH - MARGIN_X, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;
  };

  const newPage = () => {
    page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    y = A4_HEIGHT - MARGIN_TOP;
    drawPageHeader();
  };

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN_BOTTOM) {
      newPage();
    }
  };

  drawPageHeader();

  for (const command of commands) {
    if (command.kind === "blank") {
      ensureSpace(command.height);
      y -= command.height;
      continue;
    }

    const font = command.bold ? bold : regular;
    const indent = command.indent ?? 0;
    const maxWidth = bodyWidth - indent;
    const topGap = command.topGap ?? 0;
    const bottomGap = command.bottomGap ?? 0;
    const lineHeight = command.size * 1.35;
    const wrapped = wrapText(command.value, font, command.size, maxWidth);
    const blockHeight = topGap + wrapped.length * lineHeight + bottomGap;

    ensureSpace(blockHeight);
    y -= topGap;

    for (const segment of wrapped) {
      const textWidth = font.widthOfTextAtSize(segment, command.size);
      const x = command.center ? MARGIN_X + Math.max(0, (bodyWidth - textWidth) / 2) : MARGIN_X + indent;
      page.drawText(segment, {
        x,
        y,
        size: command.size,
        font,
        color: rgb(0.12, 0.12, 0.12),
        maxWidth,
      });
      y -= lineHeight;
    }

    y -= bottomGap;
  }

  const signatureBoxHeight = 150;
  ensureSpace(signatureBoxHeight + 20);
  y -= 8;

  page.drawText("Assinatura do membro", {
    x: MARGIN_X,
    y,
    size: 12,
    font: bold,
    color: rgb(0.08, 0.08, 0.08),
  });
  y -= 16;

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 92,
    width: bodyWidth,
    height: 92,
    borderColor: rgb(0.82, 0.82, 0.82),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 0.99),
  });

  page.drawText(`Nome: ${memberName}`, {
    x: MARGIN_X + 12,
    y: y - 24,
    size: 10.5,
    font: regular,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText(`CPF: ${cpf}`, {
    x: MARGIN_X + 12,
    y: y - 42,
    size: 10.5,
    font: regular,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText("Assinatura desenhada:", {
    x: MARGIN_X + 12,
    y: y - 60,
    size: 10.5,
    font: regular,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawImage(signatureImage, {
    x: MARGIN_X + 140,
    y: y - 72,
    width: 210,
    height: 56,
  });

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, termVersionId, cpf, signatureDataUrl } = (await req.json()) as ActionPayload;
    if (!action || !termVersionId) {
      return new Response(JSON.stringify({ error: "action and termVersionId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase credentials are not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authResult, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !authResult.user) {
      throw new Error(authError?.message || "Invalid session");
    }

    const userId = authResult.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, status")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    if (profile.status !== "active") {
      throw new Error("Only active members can sign the term");
    }

    const { data: version, error: versionError } = await supabase
      .from("term_commitment_versions")
      .select("id, title, content_markdown, is_active")
      .eq("id", termVersionId)
      .single();
    if (versionError) throw versionError;
    if (!version.is_active) {
      throw new Error("This term version is no longer active");
    }

    const { data: existingCommitment, error: commitmentError } = await supabase
      .from("term_commitments")
      .select("id, status, sent_at")
      .eq("term_version_id", termVersionId)
      .eq("member_id", userId)
      .maybeSingle();
    if (commitmentError) throw commitmentError;

    const timestamp = new Date().toISOString();
    const normalizedCpf = (cpf ?? "").replace(/\D/g, "");
    const storagePath = `${userId}/${termVersionId}.pdf`;

    if (action === "decline") {
      const { error: upsertError } = await supabase.from("term_commitments").upsert(
        {
          term_version_id: termVersionId,
          member_id: userId,
          status: "declined",
          cpf: normalizedCpf || null,
          pdf_path: null,
          sent_at: existingCommitment?.sent_at ?? timestamp,
          signed_at: null,
          declined_at: timestamp,
        },
        { onConflict: "term_version_id,member_id" },
      );
      if (upsertError) throw upsertError;

      const { error: notifyError } = await supabase.rpc("notify_superadmins", {
        _title: "Termo de compromisso recusado",
        _message: `${profile.full_name || "Um membro"} recusou o termo de compromisso e precisa de acompanhamento.`,
        _type: "term_commitment",
        _link: "/termo-compromisso",
      });
      if (notifyError) throw notifyError;

      return new Response(
        JSON.stringify({ success: true, status: "declined" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!normalizedCpf) {
      return new Response(JSON.stringify({ error: "cpf is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signatureDataUrl) {
      return new Response(JSON.stringify({ error: "signatureDataUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await drawPdf({
      title: version.title,
      contentMarkdown: version.content_markdown,
      memberName: profile.full_name || "Novo membro",
      cpf: normalizedCpf,
      signatureDataUrl,
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase.from("term_commitments").upsert(
      {
        term_version_id: termVersionId,
        member_id: userId,
        status: "signed",
        cpf: normalizedCpf,
        pdf_path: storagePath,
        sent_at: existingCommitment?.sent_at ?? timestamp,
        signed_at: timestamp,
        declined_at: null,
      },
      { onConflict: "term_version_id,member_id" },
    );
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        status: "signed",
        pdfPath: storagePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("term-commitment-sign error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
