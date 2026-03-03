import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MessageSquare, Plus, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORIES = [
  { value: "general", label: "Geral" },
  { value: "announcements", label: "Avisos" },
  { value: "training", label: "Treinamento" },
  { value: "opportunities", label: "Oportunidades de Negócio" },
];

const ForumPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [newThread, setNewThread] = useState({ title: "", content: "", category: "general" });
  const [replyContent, setReplyContent] = useState("");

  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads", user?.id],
    queryFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!membership?.group_id) return [];

      const { data, error } = await supabase
        .from("discussion_threads")
        .select("*, profiles(full_name)")
        .eq("group_id", membership.group_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: replies } = useQuery({
    queryKey: ["replies", selectedThread?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_replies")
        .select("*, profiles(full_name)")
        .eq("thread_id", selectedThread.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedThread,
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!membership?.group_id) throw new Error("Sem grupo");

      const { error } = await supabase.from("discussion_threads").insert({
        group_id: membership.group_id,
        author_id: user!.id,
        title: newThread.title,
        content: newThread.content,
        category: newThread.category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      setDialogOpen(false);
      setNewThread({ title: "", content: "", category: "general" });
      toast.success("Tópico criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussion_replies").insert({
        thread_id: selectedThread.id,
        author_id: user!.id,
        content: replyContent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["replies"] });
      setReplyContent("");
      toast.success("Resposta enviada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (selectedThread) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Button variant="ghost" onClick={() => setSelectedThread(null)}>← Voltar</Button>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">
              {CATEGORIES.find(c => c.value === selectedThread.category)?.label}
            </span>
            <h2 className="font-display font-bold text-xl mt-2">{selectedThread.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              por {selectedThread.profiles?.full_name} • {new Date(selectedThread.created_at).toLocaleDateString("pt-BR")}
            </p>
            <p className="mt-4">{selectedThread.content}</p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {replies?.map((reply: any) => (
            <Card key={reply.id} className="bg-muted border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium">{reply.profiles?.full_name}</p>
                <p className="text-sm mt-1">{reply.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(reply.created_at).toLocaleDateString("pt-BR")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Escreva uma resposta..."
            className="bg-muted border-border"
          />
          <Button onClick={() => replyMutation.mutate()} disabled={!replyContent.trim() || replyMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Fórum</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold uppercase tracking-wider">
              <Plus className="h-4 w-4 mr-2" />Novo Tópico
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-popover border-border">
            <DialogHeader><DialogTitle className="font-display">Novo Tópico</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createThreadMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  value={newThread.category}
                  onChange={(e) => setNewThread(prev => ({ ...prev, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={newThread.title} onChange={(e) => setNewThread(prev => ({ ...prev, title: e.target.value }))} className="bg-muted border-border" required />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea value={newThread.content} onChange={(e) => setNewThread(prev => ({ ...prev, content: e.target.value }))} className="bg-muted border-border" rows={5} required />
              </div>
              <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={createThreadMutation.isPending}>
                Publicar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : !threads || threads.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p>Nenhum tópico ainda. Seja o primeiro!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((thread: any) => (
            <Card
              key={thread.id}
              className="bg-card border-border card-hover-border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedThread(thread)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded uppercase">
                      {CATEGORIES.find(c => c.value === thread.category)?.label}
                    </span>
                    <h3 className="font-medium mt-1">{thread.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {thread.profiles?.full_name} • {new Date(thread.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ForumPage;
