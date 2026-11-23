import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "./whatsapp";

describe("normalizeWhatsAppPhone", () => {
  it("adiciona o DDI 55 a números com DDD", () => {
    expect(normalizeWhatsAppPhone("(53) 99467-0421")).toBe("5553994670421");
    expect(normalizeWhatsAppPhone("5333334444")).toBe("555333334444");
  });

  it("mantém números que já vêm com DDI", () => {
    expect(normalizeWhatsAppPhone("+55 53 99467-0421")).toBe("5553994670421");
  });

  it("devolve vazio quando não há dígitos", () => {
    expect(normalizeWhatsAppPhone("abc")).toBe("");
  });
});

describe("buildWhatsAppUrl", () => {
  it("gera o link wa.me com a mensagem codificada", () => {
    const url = buildWhatsAppUrl("5399467042", "Oii Fabiana! Convite 😁");
    expect(url).toBe(
      `https://wa.me/555399467042?text=${encodeURIComponent("Oii Fabiana! Convite 😁")}`,
    );
  });

  it("recusa número vazio", () => {
    expect(() => buildWhatsAppUrl("", "x")).toThrow(/WhatsApp válido/);
  });
});
