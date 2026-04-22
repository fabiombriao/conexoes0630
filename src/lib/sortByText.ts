const collator = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

export function sortByText<T>(items: T[], getText: (item: T) => string | null | undefined) {
  return [...items].sort((a, b) => collator.compare((getText(a) || "").trim(), (getText(b) || "").trim()));
}
