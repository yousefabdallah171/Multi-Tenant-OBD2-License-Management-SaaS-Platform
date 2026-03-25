const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

export function localizeMonthLabel(label: string, locale: string) {
  const normalized = label.trim()

  const isoMonthMatch = normalized.match(/^(\d{4})-(\d{2})$/)
  if (isoMonthMatch) {
    const [, year, month] = isoMonthMatch
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1))
  }

  const shortMonthYearMatch = normalized.match(/^([A-Za-z]{3})\s+(\d{4})$/)
  if (shortMonthYearMatch) {
    const [, monthToken, yearToken] = shortMonthYearMatch
    const monthIndex = MONTHS[monthToken]
    if (monthIndex !== undefined) {
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(Number(yearToken), monthIndex, 1))
    }
  }

  const dayMonthMatch = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3})$/)
  if (dayMonthMatch) {
    const [, dayToken, monthToken] = dayMonthMatch
    const monthIndex = MONTHS[monthToken]
    if (monthIndex !== undefined) {
      return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(new Date().getFullYear(), monthIndex, Number(dayToken)))
    }
  }

  return label
}

export function truncateChartLabel(label: string | number, maxLength = 22) {
  const normalized = String(label).replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}...`
}
