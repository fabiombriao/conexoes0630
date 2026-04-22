import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type TermCommitmentVersionRow = {
  id: string;
  version: number;
  title: string;
  content_markdown: string;
  is_active: boolean;
  created_at: string;
};

export type TermCommitmentRow = {
  id: string;
  term_version_id: string;
  member_id: string;
  status: "pending" | "sent" | "signed" | "declined";
  cpf: string | null;
  pdf_path: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TermCommitmentSignatureState = "loading" | "resolved" | "signed" | "unsigned" | "error";

export function useTermCommitment() {
  const { user } = useAuth();
  const { accountStatus } = usePermissions();

  const {
    data: activeVersion,
    isLoading: versionLoading,
    isError: versionIsError,
    error: versionError,
  } = useQuery<TermCommitmentVersionRow | null>({
    queryKey: ["term-commitment-active-version"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("term_commitment_versions")
        .select("id, version, title, content_markdown, is_active, created_at")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TermCommitmentVersionRow | null;
    },
    enabled: !!user,
    retry: false,
  });

  const {
    data: commitment,
    isLoading: commitmentLoading,
    isError: commitmentIsError,
    error: commitmentError,
  } = useQuery<TermCommitmentRow | null>({
    queryKey: ["term-commitment-current", user?.id, activeVersion?.id],
    queryFn: async () => {
      if (!user || !activeVersion?.id) return null;
      const { data, error } = await supabase
        .from("term_commitments")
        .select("id, term_version_id, member_id, status, cpf, pdf_path, sent_at, signed_at, declined_at, created_at, updated_at")
        .eq("term_version_id", activeVersion.id)
        .eq("member_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as TermCommitmentRow | null;
    },
    enabled: !!user && !!activeVersion?.id && accountStatus === "active",
    retry: false,
  });

  let signatureState: TermCommitmentSignatureState = "resolved";

  if (user && accountStatus === "active" && activeVersion?.id) {
    if (versionLoading || commitmentLoading) {
      signatureState = "loading";
    } else if (versionIsError || commitmentIsError) {
      signatureState = "error";
    } else if (commitment?.status === "signed") {
      signatureState = "signed";
    } else {
      signatureState = "unsigned";
    }
  }

  const needsSignature = signatureState === "unsigned";

  return {
    activeVersion,
    commitment,
    signatureState,
    needsSignature,
    isLoading: versionLoading || commitmentLoading,
    isError: versionIsError || commitmentIsError,
    error: versionError ?? commitmentError,
  };
}
