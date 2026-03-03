import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AvatarUploadProps {
  currentUrl?: string | null;
  fullName?: string | null;
  size?: number;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentUrl,
  fullName,
  size = 96,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");

      // Resize/crop to square on a canvas
      const bitmap = await createImageBitmap(file);
      const minDim = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        bitmap,
        (bitmap.width - minDim) / 2,
        (bitmap.height - minDim) / 2,
        minDim,
        minDim,
        0,
        0,
        400,
        400
      );

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
      );

      const path = `${user.id}/profile.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (profileError) throw profileError;

      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Foto atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      setDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao enviar foto: " + err.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDialogOpen(true);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <>
      <div
        className="relative group cursor-pointer"
        style={{ width: size, height: size }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div
          className="rounded-full overflow-hidden ring-2 ring-primary/40 bg-primary/20 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-display font-bold text-primary"
              style={{ fontSize: size * 0.35 }}
            >
              {initials}
            </span>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-6 w-6 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
          <Camera className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar foto</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-48 h-48 rounded-full object-cover ring-2 ring-primary/40"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Salvando..." : "Salvar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
