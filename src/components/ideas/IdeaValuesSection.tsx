import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDEA_KEYS } from "@/hooks/useIdeas";
import {
  KIND_LABELS,
  NATURE_LABELS,
  PERIOD_LABELS,
  formatBRL,
  formatBRLSigned,
  parseAmount,
  summarizeValues,
  type IdeaValue,
  type ValueKind,
  type ValueNature,
  type ValuePeriod,
} from "@/lib/ideas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormState {
  label: string;
  amount: string;
  nature: ValueNature;
  kind: ValueKind;
  period: ValuePeriod;
}

const EMPTY_FORM: FormState = { label: "", amount: "", nature: "gain", kind: "one_time", period: "monthly" };

export const IdeaValuesSection: React.FC<{ ideaId: string; values: IdeaValue[] }> = ({ ideaId, values }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: IDEA_KEYS.root });
  const parsed = parseAmount(form.amount);

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        label: form.label.trim() || null,
        amount: parsed!,
        nature: form.nature,
        kind: form.kind,
        period: form.kind === "recurring" ? form.period : null,
      };
      const { error } = editingId
        ? await supabase.from("idea_values").update(row).eq("id", editingId)
        : await supabase.from("idea_values").insert({ ...row, idea_id: ideaId });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setEditingId(null);
      refresh();
    },
    onError: () => toast.error("Não foi possível salvar o valor."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("idea_values").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível excluir o valor."),
  });

  const startEdit = (v: IdeaValue) => {
    setEditingId(v.id);
    setForm({
      label: v.label ?? "",
      amount: String(v.amount).replace(".", ","),
      nature: v.nature as ValueNature,
      kind: v.kind as ValueKind,
      period: (v.period as ValuePeriod) ?? "monthly",
    });
  };

  const summary = summarizeValues(values);
  const hasOneTime = summary.oneTimeGain !== 0 || summary.oneTimeCost !== 0;
  const hasMonthly = summary.monthlyGain !== 0 || summary.monthlyCost !== 0;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Valores</h3>

      {values.length > 0 && (
        <ul className="space-y-1.5">
          {values.map((v) => {
            const isGain = v.nature === "gain";
            return (
              <li
                key={v.id}
                className={`flex items-center gap-2 rounded-lg border p-2 ${
                  editingId === v.id ? "border-primary" : "border-border"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{v.label || (isGain ? "Ganho" : "Custo")}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0 text-[10px] ${
                        isGain ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                      }`}
                    >
                      {NATURE_LABELS[v.nature as ValueNature] ?? v.nature}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {v.kind === "recurring"
                        ? `Recorrente · ${PERIOD_LABELS[v.period as ValuePeriod] ?? v.period}`
                        : KIND_LABELS.one_time}
                    </span>
                  </div>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${isGain ? "text-emerald-400" : "text-red-400"}`}>
                  {isGain ? "" : "-"}
                  {formatBRL(Number(v.amount))}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Editar valor"
                  onClick={() => startEdit(v)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Excluir valor"
                  onClick={() => {
                    if (window.confirm("Excluir este valor?")) {
                      if (editingId === v.id) {
                        setEditingId(null);
                        setForm(EMPTY_FORM);
                      }
                      remove.mutate(v.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {(hasOneTime || hasMonthly) && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {hasOneTime && (
            <p>
              Saldo único:{" "}
              <strong className={summary.oneTimeNet < 0 ? "text-red-400" : "text-emerald-400"}>
                {formatBRLSigned(summary.oneTimeNet)}
              </strong>
            </p>
          )}
          {hasMonthly && (
            <p>
              Saldo recorrente:{" "}
              <strong className={summary.monthlyNet < 0 ? "text-red-400" : "text-emerald-400"}>
                {formatBRLSigned(summary.monthlyNet)}/mês
              </strong>{" "}
              <span>(trimestral ÷ 3, semestral ÷ 6, anual ÷ 12)</span>
            </p>
          )}
        </div>
      )}

      <form
        className="space-y-3 rounded-lg border border-dashed border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed !== null) save.mutate();
        }}
      >
        <p className="text-xs font-medium text-muted-foreground">{editingId ? "Editando valor" : "Adicionar valor"}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input
              value={form.label}
              maxLength={120}
              placeholder="Ex.: assinatura dos membros"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              inputMode="decimal"
              value={form.amount}
              placeholder="0,00"
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v as ValueNature })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NATURE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ValueKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.kind === "recurring" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Periodicidade</Label>
              <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as ValuePeriod })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {form.amount.trim() !== "" && parsed === null && (
          <p className="text-xs text-destructive">Valor inválido. Use algo como 1500 ou 1.500,50.</p>
        )}
        <div className="flex justify-end gap-2">
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" size="sm" variant="secondary" disabled={parsed === null || save.isPending}>
            {editingId ? "Salvar valor" : "Adicionar valor"}
          </Button>
        </div>
      </form>
    </section>
  );
};
