import { describe, expect, it } from "vitest";
import { describeGeolocationError, describeSelfCheckIn, todayInMeetingTimeZone } from "./selfCheckIn";

describe("todayInMeetingTimeZone", () => {
  it("usa o fuso de São Paulo, não o UTC", () => {
    // 02:00 UTC de 18/11 ainda é 23:00 de 17/11 em São Paulo (UTC-3)
    expect(todayInMeetingTimeZone(new Date("2026-11-18T02:00:00Z"))).toBe("2026-11-17");
    expect(todayInMeetingTimeZone(new Date("2026-11-18T09:30:00Z"))).toBe("2026-11-18");
  });
});

describe("describeSelfCheckIn", () => {
  it("confirmação válida é ok e cita a distância", () => {
    const r = describeSelfCheckIn({ status: "confirmed", distance_m: 42.4, max_distance_m: 100 });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("42 m");
  });

  it("já confirmada também é ok", () => {
    expect(describeSelfCheckIn({ status: "already_confirmed" }).ok).toBe(true);
  });

  it("longe demais não é ok e informa distância e limite", () => {
    const r = describeSelfCheckIn({ status: "too_far", distance_m: 350, max_distance_m: 100 });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("350 m");
    expect(r.message).toContain("100 m");
  });

  it.each(["low_accuracy", "not_active", "no_group", "invalid_location"] as const)("%s não é ok", (status) => {
    expect(describeSelfCheckIn({ status }).ok).toBe(false);
  });
});

describe("describeGeolocationError", () => {
  it("diferencia permissão negada dos demais erros", () => {
    expect(describeGeolocationError(1)).toContain("Permissão");
    expect(describeGeolocationError(3)).toContain("Demorou");
    expect(describeGeolocationError(undefined)).toContain("neste dispositivo");
  });
});
