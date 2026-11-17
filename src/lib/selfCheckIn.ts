// Autoconfirmação de presença por geolocalização.
// A distância é validada no servidor (RPC confirm_self_attendance); aqui ficam
// só os helpers de data e as mensagens exibidas ao membro.

export type SelfCheckInStatus =
  | "confirmed"
  | "already_confirmed"
  | "too_far"
  | "low_accuracy"
  | "not_active"
  | "no_group"
  | "invalid_location"
  | "outside_window";

/** Motivo da recusa quando a confirmação é tentada fora da janela (terça, 06:30–09:00). */
export type SelfCheckInWindowReason = "wrong_day" | "too_early" | "too_late";

/** Texto fixo da janela de confirmação (a regra de verdade fica no servidor). */
export const SELF_CHECKIN_WINDOW_LABEL = "terças-feiras, das 06:30 às 09:00";

export interface SelfCheckInResult {
  status: SelfCheckInStatus;
  reason?: SelfCheckInWindowReason | null;
  distance_m?: number | null;
  max_distance_m?: number | null;
  max_accuracy_m?: number | null;
}

const MEETING_TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso da reunião, igual à usada pelo servidor. */
export function todayInMeetingTimeZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MEETING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const formatMeters = (value: number | null | undefined) =>
  value == null ? "" : `${Math.round(value).toLocaleString("pt-BR")} m`;

function describeOutsideWindow(reason?: SelfCheckInWindowReason | null): string {
  switch (reason) {
    case "too_early":
      return "Ainda não abriu. Hoje a confirmação começa às 06:30.";
    case "too_late":
      return "A confirmação de hoje já encerrou (era até às 09:00).";
    case "wrong_day":
    default:
      return `A confirmação de presença só é aceita às ${SELF_CHECKIN_WINDOW_LABEL}.`;
  }
}

/** Texto amigável para cada resposta da RPC. */
export function describeSelfCheckIn(result: SelfCheckInResult): { ok: boolean; message: string } {
  const max = formatMeters(result.max_distance_m ?? 100);
  switch (result.status) {
    case "confirmed":
      return { ok: true, message: `Presença confirmada! Você está a ${formatMeters(result.distance_m)} do local.` };
    case "already_confirmed":
      return { ok: true, message: "Sua presença de hoje já estava confirmada." };
    case "too_far":
      return {
        ok: false,
        message: `Você está a ${formatMeters(result.distance_m)} do local. É preciso estar a até ${max} para confirmar.`,
      };
    case "low_accuracy":
      return {
        ok: false,
        message: `Não consegui determinar sua posição com precisão suficiente (até ${formatMeters(result.max_accuracy_m ?? 100)}). Ative o GPS/localização precisa, vá para um local aberto e tente de novo.`,
      };
    case "outside_window":
      return { ok: false, message: describeOutsideWindow(result.reason) };
    case "not_active":
      return { ok: false, message: "Somente membros ativos podem confirmar presença." };
    case "no_group":
      return { ok: false, message: "Você ainda não está vinculado a um grupo." };
    case "invalid_location":
    default:
      return { ok: false, message: "Não foi possível ler sua localização. Tente novamente." };
  }
}

/** Mensagem para erros do navegador (GeolocationPositionError.code). */
export function describeGeolocationError(code: number | undefined): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return "Permissão de localização negada. Libere a localização deste site nas configurações do navegador e tente novamente.";
    case 2: // POSITION_UNAVAILABLE
      return "Não foi possível obter sua localização. Verifique se o GPS está ligado e tente novamente.";
    case 3: // TIMEOUT
      return "Demorou demais para obter sua localização. Tente novamente em um local com melhor sinal.";
    default:
      return "Não foi possível ler sua localização neste dispositivo.";
  }
}
