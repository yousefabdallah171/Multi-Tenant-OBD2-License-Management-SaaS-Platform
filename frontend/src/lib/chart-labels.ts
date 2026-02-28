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
  const [monthToken, yearToken] = label.split(' ')
  const monthIndex = MONTHS[monthToken]

  if (monthIndex === undefined || !yearToken) {
    return label
  }

  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(Number(yearToken), monthIndex, 1))
}
