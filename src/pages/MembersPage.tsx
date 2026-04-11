import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Search, ShieldCheck } from "lucide-react";
import { PromoteMemberDialog } from "@/components/PromoteMemberDialog";

const MembersPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [promoteTarget, setPromoteTarget] = useState<any>(null);
  const { isSuperAdmin } = usePermissions();

  const { data: members, isLoading } = useQuery({
    queryKey: ["members-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, professional_title, company_name, avatar_url, bio, keywords, linkedin_url, instagram_url, whatsapp, website_url, video_url, gains_goals, gains_accomplishments, gains_interests, gains_networks, gains_skills, business_category")
        .eq("status", "active")
        .not("full_name", "is", null)
        .neq("full_name", "")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = members?.filter((m: any) => {
    const name = m.full_name?.toLowerCase() || "";
    const keywords = (m.keywords || []).join(" ").toLowerCase();
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
              key={m.id}
              className="bg-card border-border card-hover-border cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedMember(m)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-primary shrink-0">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      m.full_name?.[0] || "?"
                    )}
                  </div>
                   <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.full_name || "Membro"}</p>
                    <p className="text-sm text-muted-foreground truncate">{m.professional_title}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.company_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.whatsapp && (
                      <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-primary hover:fill-primary/80 transition-colors"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                    )}
                    {m.instagram_url && (
                      <a
                        href={
                          m.instagram_url.startsWith('http://') || m.instagram_url.startsWith('https://')
                            ? m.instagram_url
                            : `https://instagram.com/${m.instagram_url.replace(/^@/, '')}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Instagram"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-primary hover:fill-primary/80 transition-colors"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      </a>
                    )}
                    {m.linkedin_url && (
                      <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="LinkedIn">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-primary hover:fill-primary/80 transition-colors"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Perfil do Membro</DialogTitle>
          {selectedMember && (
            <>
              <MemberProfile profile={selectedMember} />
              {isSuperAdmin && (
                <div className="px-6 pb-6">
                  <Button
                    onClick={() => { setSelectedMember(null); setPromoteTarget(selectedMember); }}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10 gap-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Promover a Admin
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {promoteTarget && (
        <PromoteMemberDialog
          open={!!promoteTarget}
          onOpenChange={(open) => { if (!open) setPromoteTarget(null); }}
          memberId={promoteTarget.id}
          memberName={promoteTarget.full_name || "Membro"}
        />
      )}
    </div>
  );
};

const MemberProfile: React.FC<{ profile: any }> = ({ profile }) => {
  const gainsFields = [
    { key: "gains_goals", label: "🎯 Objetivos" },
    { key: "gains_accomplishments", label: "🏆 Conquistas" },
    { key: "gains_interests", label: "💡 Interesses" },
    { key: "gains_networks", label: "🌐 Redes" },
    { key: "gains_skills", label: "⚡ Habilidades" },
  ].filter((f) => profile[f.key]);

  const whatsappHref = profile.whatsapp
    ? `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`
    : null;

  const getInstagramHref = (urlOrUsername: string | null) => {
    if (!urlOrUsername) return null;
    // Se já é uma URL completa, retorna como está
    if (urlOrUsername.startsWith('http://') || urlOrUsername.startsWith('https://')) {
      return urlOrUsername;
    }
    // Se é apenas o username, gera a URL do Instagram
    const username = urlOrUsername.replace(/^@/, '');
    return `https://instagram.com/${username}`;
  };

  const socialLinks = [
    { href: whatsappHref, label: "WhatsApp", color: "bg-[#25D366]", icon: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> },
    { href: getInstagramHref(profile.instagram_url), label: "Instagram", color: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]", icon: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
    { href: profile.linkedin_url, label: "LinkedIn", color: "bg-[#0A66C2]", icon: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
    { href: profile.website_url, label: "Website", color: "bg-muted", icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ) },
  ].filter((s) => s.href);

  return (
    <div className="relative">
      {/* Cover banner */}
      <div className="h-36 bg-gradient-to-br from-primary via-primary/60 to-accent/40 rounded-t-lg" />

      {/* Avatar overlapping cover */}
      <div className="flex justify-center -mt-16 relative z-10">
        <div className="h-28 w-28 rounded-full border-4 border-card bg-primary/20 flex items-center justify-center text-primary font-bold text-5xl shadow-lg">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-28 w-28 rounded-full object-cover" />
          ) : (
            profile.full_name?.[0] || "?"
          )}
        </div>
      </div>

      <div className="px-6 pb-6 pt-3">
        {/* Name & title */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-display font-bold">{profile.full_name}</h2>
          {profile.professional_title && (
            <p className="text-sm text-muted-foreground mt-0.5">{profile.professional_title}</p>
          )}
          {profile.company_name && (
            <p className="text-sm font-semibold text-primary mt-0.5">{profile.company_name}</p>
          )}
          {profile.business_category && (
            <span className="inline-block mt-2 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
              {profile.business_category}
            </span>
          )}
        </div>

        {/* Social icon row */}
        {socialLinks.length > 0 && (
          <div className="flex justify-center gap-3 mb-5">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href!}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                className={`${s.color} h-10 w-10 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        )}

        {/* Contact info row */}
        {profile.whatsapp && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
            <span>📱</span>
            <span>{profile.whatsapp}</span>
          </div>
        )}
        {profile.video_url && (
          <div className="flex justify-center mb-4">
            <a href={profile.video_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1">
              🎬 Assistir vídeo de apresentação
            </a>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="mb-5 bg-muted/30 rounded-xl p-4 border border-border">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Sobre</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {/* Keywords */}
        {profile.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5 justify-center">
            {profile.keywords.map((kw: string) => (
              <span key={kw} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                #{kw}
              </span>
            ))}
          </div>
        )}

        {/* GAINS */}
        {gainsFields.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-display font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">
              Perfil GAINS
            </h3>
            <div className="grid gap-2">
              {gainsFields.map((f) => (
                <div key={f.key} className="bg-muted/20 border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-0.5">{f.label}</p>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{profile[f.key]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembersPage;
