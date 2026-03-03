import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Search, Linkedin, Instagram, Globe, Phone, Calendar } from "lucide-react";

const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["members-list", user?.id],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!membership?.group_id) return [];
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles(*)")
        .eq("group_id", membership.group_id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = members?.filter((m: any) => {
    const name = m.profiles?.full_name?.toLowerCase() || "";
    const keywords = (m.profiles?.keywords || []).join(" ").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || keywords.includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-display font-bold">Membros</h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-border"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p>Nenhum membro encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m: any) => (
            <Card
              key={m.user_id}
              className="bg-card border-border card-hover-border cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedMember(m.profiles)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-primary">
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      m.profiles?.full_name?.[0] || "?"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.profiles?.full_name || "Membro"}</p>
                    <p className="text-sm text-muted-foreground truncate">{m.profiles?.professional_title}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.profiles?.company_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Perfil do Membro</DialogTitle>
          {selectedMember && <MemberProfile profile={selectedMember} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MemberProfile: React.FC<{ profile: any }> = ({ profile }) => {
  const socialLinks = [
    { key: "linkedin_url", icon: Linkedin, label: "LinkedIn", color: "bg-blue-600" },
    { key: "instagram_url", icon: Instagram, label: "Instagram", color: "bg-pink-600" },
    { key: "whatsapp", icon: Phone, label: "WhatsApp", color: "bg-green-600" },
    { key: "website_url", icon: Globe, label: "Website", color: "bg-muted" },
  ].filter((l) => profile[l.key]);

  const gainsFields = [
    { key: "gains_goals", label: "Objetivos (Goals)" },
    { key: "gains_accomplishments", label: "Conquistas (Accomplishments)" },
    { key: "gains_interests", label: "Interesses (Interests)" },
    { key: "gains_networks", label: "Redes (Networks)" },
    { key: "gains_skills", label: "Habilidades (Skills)" },
  ].filter((f) => profile[f.key]);

  return (
    <div>
      <div className="h-32 bg-gradient-to-r from-primary/40 via-primary/20 to-accent/20 rounded-t-lg" />
      <div className="px-6 pb-6 -mt-10">
        <div className="flex items-end gap-4 mb-4">
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl ring-4 ring-card">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              profile.full_name?.[0] || "?"
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h2 className="text-xl font-display font-bold truncate">{profile.full_name}</h2>
            <p className="text-sm text-muted-foreground">{profile.professional_title}</p>
            <p className="text-sm text-muted-foreground">{profile.company_name}</p>
          </div>
        </div>

        {profile.bio && <p className="text-sm mb-4">{profile.bio}</p>}

        {socialLinks.length > 0 && (
          <div className="flex gap-2 mb-4">
            {socialLinks.map((link) => {
              let href = profile[link.key];
              if (link.key === "whatsapp") {
                const num = href.replace(/\D/g, "");
                href = `https://wa.me/${num}`;
              }
              return (
                <a key={link.key} href={href} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="outline" className={`rounded-full border-border`}>
                    <link.icon className="h-4 w-4" />
                  </Button>
                </a>
              );
            })}
          </div>
        )}

        {profile.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {profile.keywords.map((kw: string) => (
              <span key={kw} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        )}

        {gainsFields.length > 0 && (
          <div className="space-y-3 mb-4">
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-muted-foreground">Perfil GAINS</h3>
            {gainsFields.map((f) => (
              <div key={f.key}>
                <p className="text-xs font-medium text-primary">{f.label}</p>
                <p className="text-sm">{profile[f.key]}</p>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full font-bold uppercase tracking-wider">
          <Calendar className="h-4 w-4 mr-2" />
          Agendar Téte a téte
        </Button>
      </div>
    </div>
  );
};

export default MembersPage;
