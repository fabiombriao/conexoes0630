export function getHistoricalRankingMonths(months: string[], currentMonth: string) {
  return [...new Set(months.filter((month): month is string => Boolean(month && month.trim())))]
    .filter((month) => month < currentMonth)
    .sort((a, b) => b.localeCompare(a));
}
