import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useTermCommitment } from "@/hooks/useTermCommitment";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SignaturePad, { SignaturePadHandle } from "@/components/SignaturePad";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Send,
  ShieldCheck,
  Signature,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { TermCommitmentRow } from "@/hooks/useTermCommitment";
import { buildTermCommitmentPdf } from "@/lib/termCommitmentPdf";

type MemberRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  professional_title: string | null;
  company_name: string | null;
};

const BUCKET = "term-commitments";

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-warning/15 text-warning border-warning/25" },
  sent: { label: "Enviado", className: "bg-primary/15 text-primary border-primary/25" },
  signed: { label: "Assinado", className: "bg-success/15 text-success border-success/25" },
  declined: { label: "Recusado", className: "bg-destructive/15 text-destructive border-destructive/25" },
};

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const statusForRow = (commitment?: TermCommitmentRow | null) => commitment?.status ?? "pending";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

type TermSectionBlock = {
  number: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
};

type TermDocumentStructure = {
  intro: string[];
  sections: TermSectionBlock[];
  closing: string[];
  signatureLines: string[];
};

const parseTermDocument = (title: string, content: string): TermDocumentStructure => {
  const chunks = content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const intro: string[] = [];
  const sections: TermSectionBlock[] = [];
  const closing: string[] = [];
  const signatureLines: string[] = [];
  const normalizedTitle = normalizeWhitespace(title);

  let currentSection: TermSectionBlock | null = null;
  let inClosing = false;

  for (const chunk of chunks) {
    const normalizedChunk = normalizeWhitespace(chunk);
    if (!normalizedChunk || normalizedChunk === normalizedTitle) {
      continue;
    }

    const sectionMatch = normalizedChunk.match(/^(\d+)\.\s+(.+)$/);
    if (sectionMatch) {
      currentSection = {
        number: sectionMatch[1],
        title: sectionMatch[2].trim(),
        paragraphs: [],
        bullets: [],
      };
      sections.push(currentSection);
      inClosing = false;
      continue;
    }

    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    const isBulletChunk = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));

    if (isBulletChunk) {
      const items = lines.map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
      if (currentSection) {
        currentSection.bullets.push(...items);
      } else {
        intro.push(...items);
      }
      continue;
    }

    if (lines.some((line) => /_{5,}/.test(line))) {
      signatureLines.push(...lines);
      inClosing = true;
      continue;
    }

    if (/^Conexão 6:30/i.test(normalizedChunk) || /^O sucesso tem/i.test(normalizedChunk)) {
      closing.push(normalizedChunk);
      inClosing = true;
      continue;
    }

    if (inClosing) {
      closing.push(normalizedChunk);
      continue;
    }

    if (currentSection) {
      currentSection.paragraphs.push(normalizedChunk);
    } else {
      intro.push(normalizedChunk);
    }
  }

  return { intro, sections, closing, signatureLines };
};

const TermDocumentRenderer: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  const document = React.useMemo(() => parseTermDocument(title, content), [title, content]);

  return (
    <div className="space-y-6">
      {document.intro.length > 0 && (
        <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
            <FileText className="h-3.5 w-3.5" />
            Preâmbulo
          </div>
          <div className="space-y-4 text-sm leading-7 text-foreground/90 text-justify">
            {document.intro.map((paragraph, index) => (
              <p key={`intro-${index}`} className={index === 0 ? "font-medium text-foreground" : ""}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      )}

      {document.sections.map((section) => (
        <section key={section.number} className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
              {section.number}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Cláusula {section.number}
              </p>
              <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
            </div>
          </div>

          {section.paragraphs.length > 0 && (
            <div className="space-y-4 text-sm leading-7 text-foreground/90 text-justify">
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.number}-p-${index}`}>{paragraph}</p>
              ))}
            </div>
          )}

          {section.bullets.length > 0 && (
            <ul className="mt-4 space-y-3">
              {section.bullets.map((item, index) => (
                <li key={`${section.number}-b-${index}`} className="flex gap-3 text-sm leading-7 text-foreground/90">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-primary/80" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {document.closing.length > 0 && (
        <section className="rounded-2xl border border-border bg-muted/20 p-5 text-center">
          <div className="space-y-3">
            {document.closing.map((line, index) => (
              <p
                key={`closing-${index}`}
                className={
                  index === 0
                    ? "text-base font-semibold text-foreground"
                    : "text-sm italic text-muted-foreground"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {document.signatureLines.length > 0 && (
        <section className="rounded-2xl border border-border bg-card/70 p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Assinatura física
          </div>
          <div className="space-y-5">
            {document.signatureLines.map((line, index) => {
              const label = line.replace(/\s{2,}.*$/, "").trim();
              return (
                <div key={`signature-${index}`} className="flex items-end gap-4">
                  <span className="min-w-[128px] text-sm font-medium text-foreground/80">{label}</span>
                  <span className="flex-1 border-b border-dashed border-border" />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const PdfPreview: React.FC<{ pdfPath: string; title?: string; memberName?: string }> = ({
  pdfPath,
  title = "PDF assinado",
  memberName,
}) => {
  const [open, setOpen] = useState(false);

  const { data: signedUrl, isLoading } = useQuery({
    queryKey: ["term-pdf-signed-url", pdfPath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(pdfPath, 60 * 10);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: open && !!pdfPath,
    staleTime: 5 * 60 * 1000,
  });

  const downloadPdf = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).download(pdfPath);
    if (error) {
      toast.error(error.message || "Erro ao baixar o PDF");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${memberName || "termo-assinado"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{pdfPath}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="border-border" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1" />
            Baixar
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="border-border">
              {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {open ? "Ocultar" : "Preview"}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-[520px] w-full rounded-xl" />
        ) : signedUrl ? (
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <iframe title={title} src={signedUrl} className="h-[520px] w-full" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não foi possível carregar o preview.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const MemberCard: React.FC<{
  member: MemberRow;
  commitment: TermCommitmentRow | null;
  termVersionId: string;
}> = ({ member, commitment, termVersionId }) => {
  const queryClient = useQueryClient();
  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("send_term_commitment_notification", {
        _member_id: member.id,
        _term_version_id: termVersionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notificação enviada");
      queryClient.invalidateQueries({ queryKey: ["term-commitments-admin"] });
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao enviar o termo"),
  });

  const status = statusForRow(commitment);
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const isSigned = status === "signed";

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-1 ring-primary/20 shrink-0">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                member.full_name?.[0] || "?"
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">{member.full_name || "Membro"}</p>
              <p className="text-xs text-muted-foreground truncate">{member.professional_title || member.company_name || "Sem cargo"}</p>
              {commitment?.cpf && (
                <p className="text-xs text-muted-foreground">CPF: {commitment.cpf}</p>
              )}
            </div>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isSigned ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              <Send className="h-4 w-4" />
              Enviar Termo de Compromisso
            </Button>
          ) : null}
        </div>

        {isSigned && commitment?.pdf_path && (
          <PdfPreview pdfPath={commitment.pdf_path} memberName={member.full_name || "Membro"} />
        )}
      </CardContent>
    </Card>
  );
};

const TermoCompromissoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [cpf, setCpf] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

  const termQuery = useTermCommitment();

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["term-commitment-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, professional_title, company_name")
        .eq("status", "active")
        .not("full_name", "is", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as MemberRow[];
    },
    enabled: isSuperAdmin && !!termQuery.activeVersion?.id,
  });

  const { data: adminCommitments = [] } = useQuery({
    queryKey: ["term-commitments-admin", termQuery.activeVersion?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("term_commitments")
        .select("id, term_version_id, member_id, status, cpf, pdf_path, sent_at, signed_at, declined_at, created_at, updated_at")
        .eq("term_version_id", termQuery.activeVersion!.id);
      if (error) throw error;
      return data as TermCommitmentRow[];
    },
    enabled: isSuperAdmin && !!termQuery.activeVersion?.id,
  });

  const activeVersionId = termQuery.activeVersion?.id;

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersionId) throw new Error("Versão do termo indisponível");
      if (!signatureDataUrl) throw new Error("Assinatura obrigatória");

      const cpfDigits = normalizeCpf(cpf);
      const signedAt = new Date().toISOString();
      const signerName = user?.user_metadata?.full_name || "Membro";
      const pdfBytes = await buildTermCommitmentPdf({
        title: termQuery.activeVersion!.title,
        contentMarkdown: termQuery.activeVersion!.content_markdown,
        signerName,
        cpf,
        signatureDataUrl,
        signedAt,
      });

      const pdfPath = `${user!.id}/${activeVersionId}.pdf`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: savedCommitment, error: upsertError } = await supabase
        .from("term_commitments")
        .upsert(
          {
            term_version_id: activeVersionId,
            member_id: user!.id,
            status: "signed",
            cpf: cpfDigits,
            pdf_path: pdfPath,
            sent_at: termQuery.commitment?.sent_at ?? null,
            signed_at: signedAt,
            declined_at: null,
          },
          { onConflict: "term_version_id,member_id" },
        )
        .select("id, term_version_id, member_id, status, cpf, pdf_path, sent_at, signed_at, declined_at, created_at, updated_at")
        .single();
      if (upsertError) throw upsertError;

      return savedCommitment as TermCommitmentRow;
    },
    onSuccess: async (savedCommitment) => {
      if (savedCommitment && activeVersionId) {
        await queryClient.cancelQueries({
          queryKey: ["term-commitment-current", user!.id, activeVersionId],
        });
        queryClient.setQueryData<TermCommitmentRow | null>(
          ["term-commitment-current", user!.id, activeVersionId],
          savedCommitment,
        );
      }
      toast.success("Termo assinado com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["term-commitment-members"] });
      await queryClient.invalidateQueries({ queryKey: ["term-commitments-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      signatureRef.current?.clear();
      setCpf("");
      setAgreementChecked(false);
      setSignatureDataUrl(null);
      if (!isSuperAdmin) {
        navigate("/", { replace: true });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao assinar o termo"),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersionId) throw new Error("Versão do termo indisponível");
      const cpfDigits = normalizeCpf(cpf);
      const declinedAt = new Date().toISOString();

      const { error: upsertError } = await supabase
        .from("term_commitments")
        .upsert(
          {
            term_version_id: activeVersionId,
            member_id: user!.id,
            status: "declined",
            cpf: cpfDigits,
            pdf_path: null,
            sent_at: termQuery.commitment?.sent_at ?? null,
            signed_at: null,
            declined_at: declinedAt,
          },
          { onConflict: "term_version_id,member_id" },
        );
      if (upsertError) throw upsertError;

      const { error: notifyError } = await supabase.rpc("notify_superadmins", {
        _type: "term_commitment_declined",
        _title: "Termo de compromisso recusado",
        _message: `${user?.user_metadata?.full_name || "Um membro"} recusou o termo de compromisso.`,
        _link: "/termo-compromisso",
      });
      if (notifyError) throw notifyError;
    },
    onSuccess: async () => {
      toast.success("Recusa registrada");
      await queryClient.invalidateQueries({ queryKey: ["term-commitment-current"] });
      await queryClient.invalidateQueries({ queryKey: ["term-commitments-admin"] });
      signatureRef.current?.clear();
      setCpf("");
      setAgreementChecked(false);
      setSignatureDataUrl(null);
      setSentNotice(true);
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao registrar recusa"),
  });

  const currentCommitmentStatus = termQuery.commitment?.status ?? "pending";
  const canSign = agreementChecked && cpf.replace(/\D/g, "").length === 11 && !!signatureDataUrl;

  const totalMembers = members.length;
  const signedCount = adminCommitments.filter((row) => row.status === "signed").length;
  const pendingCount = adminCommitments.filter((row) => row.status === "pending" || row.status === "sent").length;
  const declinedCount = adminCommitments.filter((row) => row.status === "declined").length;

  if (termQuery.isLoading && !termQuery.activeVersion) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (termQuery.isError) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
        <Card className="w-full max-w-xl border-border bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h1 className="text-xl font-display font-bold">Erro ao carregar o termo</h1>
              <p className="text-sm text-muted-foreground">
                O app não conseguiu ler a estrutura do termo no banco de dados de produção.
                Isso normalmente acontece quando a migração do termo ainda não foi aplicada.
              </p>
            </div>
            {termQuery.error instanceof Error && (
              <p className="text-xs text-muted-foreground break-words">{termQuery.error.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!termQuery.activeVersion) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 flex items-center justify-center">
        <Card className="w-full max-w-xl border-border bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
            <div>
              <h1 className="text-xl font-display font-bold">Termo indisponível</h1>
              <p className="text-sm text-muted-foreground">Não existe uma versão ativa do termo de compromisso no momento.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberHasSignature = currentCommitmentStatus === "signed";
  const memberDeclined = currentCommitmentStatus === "declined";
  const memberCanSubmit = currentCommitmentStatus === "pending" || currentCommitmentStatus === "sent";
  const goToAppHome = () => {
    window.location.assign("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <Badge className="bg-primary/15 text-primary border-primary/20">Termo de compromisso</Badge>
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold">Conexão 6:30</h1>
                <p className="text-muted-foreground max-w-2xl">
                  Leia o termo, desenhe sua assinatura, confirme o CPF e conclua o aceite para liberar seu acesso ao aplicativo.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border" onClick={() => navigate("/notifications")}>
                Notificações
              </Button>
              <Button variant="ghost" type="button" className="gap-2" onClick={goToAppHome}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                {termQuery.activeVersion.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[70vh] overflow-y-auto scroll-smooth px-6 py-6 pr-8">
                <TermDocumentRenderer
                  title={termQuery.activeVersion.title}
                  content={termQuery.activeVersion.content_markdown}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Signature className="h-5 w-5 text-primary" />
                  {memberHasSignature ? "Termo assinado" : "Assinatura do membro"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {memberHasSignature && termQuery.commitment?.pdf_path ? (
                  <div className="space-y-4">
                    <Badge className={STATUS_META.signed.className}>{STATUS_META.signed.label}</Badge>
                    <PdfPreview pdfPath={termQuery.commitment.pdf_path} memberName={user?.user_metadata?.full_name || "Membro"} />
                  </div>
                ) : (
                  <>
                    {memberDeclined && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                        A recusa foi registrada. O acesso continua bloqueado até um Super Admin reenviar o termo.
                      </div>
                    )}
                    {sentNotice && (
                      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                        A recusa foi enviada aos Super Admins.
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className="bg-muted border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Assinatura desenhada</Label>
                      <SignaturePad ref={signatureRef} onChange={setSignatureDataUrl} />
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                      <Checkbox
                        id="agreement"
                        checked={agreementChecked}
                        onCheckedChange={(checked) => setAgreementChecked(checked === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="agreement" className="text-sm font-medium">
                          Estou de acordo com o termo de compromisso
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          A confirmação abaixo declara que você leu e aceita todas as condições descritas neste documento.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        className="gap-2"
                        onClick={() => signMutation.mutate()}
                        disabled={!canSign || signMutation.isPending || !memberCanSubmit}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Concordar
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-border"
                        onClick={() => declineMutation.mutate()}
                        disabled={declineMutation.isPending || memberHasSignature}
                      >
                        Não concordar
                      </Button>
                    </div>
                    {!memberCanSubmit && !memberHasSignature && !memberDeclined && (
                      <p className="text-xs text-muted-foreground">
                        O termo ainda não foi enviado como notificação, mas você pode concluí-lo agora para liberar o acesso.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Painel do Super Admin
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Membros</p>
                      <p className="text-lg font-semibold">{totalMembers}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Assinados</p>
                      <p className="text-lg font-semibold text-success">{signedCount}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-lg font-semibold text-warning">{pendingCount + declinedCount}</p>
                    </div>
                  </div>

                  {membersLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28" />
                      ))}
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum membro ativo encontrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => {
                        const commitmentRow = adminCommitments.find((row) => row.member_id === member.id) ?? null;
                        return (
                          <MemberCard
                            key={member.id}
                            member={member}
                            commitment={commitmentRow}
                            termVersionId={termQuery.activeVersion.id}
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermoCompromissoPage;
