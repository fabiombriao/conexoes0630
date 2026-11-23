/** Normaliza um número brasileiro para o formato aceito pelo `wa.me` (DDI + DDD + número). */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // 10 ou 11 dígitos = DDD + número, sem DDI.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    throw new Error("Informe um WhatsApp válido com DDD.");
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
