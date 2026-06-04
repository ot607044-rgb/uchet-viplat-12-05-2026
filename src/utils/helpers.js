// ── ID Generation ────────────────────────────────────────────────────────────
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── Formatting ───────────────────────────────────────────────────────────────
export function formatMoney(amount, showSign = false, decimals = 0) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  const formatted = Math.abs(Number(amount)).toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  const prefix = showSign && amount < 0 ? '−' : ''
  return `${prefix}${formatted} ₽`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function parseAmount(val) {
  const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]
export const MONTHS_RU_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
]

export function monthName(month) {
  return MONTHS_RU[month - 1] || ''
}
export function monthShort(month) {
  return MONTHS_RU_SHORT[month - 1] || ''
}

export function getCurrentPeriod() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

// Days until a date
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}

// Get next payment date (advance or salary)
export function getNextPaymentDate(day, month, year) {
  const now = new Date()
  let d = new Date(year, month - 1, day)
  if (d < now) {
    // Move to next month
    d = new Date(year, month, day)
  }
  return d.toISOString().slice(0, 10)
}

// ── Work duration & vacation entitlement ──────────────────────────────────────
export function calcWorkDuration(hireDate, dismissDate) {
  if (!hireDate) return null
  const start = new Date(hireDate)
  const end = dismissDate ? new Date(dismissDate) : new Date()
  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  if (end.getDate() < start.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years === 0 && months === 0) return 'менее месяца'
  const py = n => n % 10 === 1 && n % 100 !== 11 ? 'год' : [2,3,4].includes(n%10) && ![12,13,14].includes(n%100) ? 'года' : 'лет'
  const pm = n => n % 10 === 1 && n % 100 !== 11 ? 'месяц' : [2,3,4].includes(n%10) && ![12,13,14].includes(n%100) ? 'месяца' : 'месяцев'
  const parts = []
  if (years > 0) parts.push(`${years} ${py(years)}`)
  if (months > 0) parts.push(`${months} ${pm(months)}`)
  return parts.join(' ')
}

// Считает полные месяцы работы от hire до refDate
export function calcMonthsWorked(hireDate, refDate) {
  if (!hireDate) return 0
  const start = new Date(hireDate)
  const end = refDate ? new Date(refDate) : new Date()
  if (end <= start) return 0
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  // Если день конца >= дня найма — считаем этот месяц полным
  if (end.getDate() >= start.getDate()) months++
  return Math.max(0, months)
}

// Накоплено отпускных дней всего (по рабочему стажу): 2.33 дня за каждый полный месяц
export function calcAccruedVacationDays(hireDate, dismissDate, rate = 2.33) {
  const refDate = dismissDate ? new Date(Math.min(new Date(dismissDate).getTime(), Date.now())) : new Date()
  const months = calcMonthsWorked(hireDate, refDate)
  return Math.floor(months * rate)
}

// Положено дней в конкретном году (для годового графика)
export function calcEntitledVacationDays(hireDate, dismissDate, year, rate = 2.33) {
  if (!hireDate) return Math.floor(12 * rate)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59)
  const refEnd = dismissDate ? new Date(Math.min(new Date(dismissDate).getTime(), yearEnd.getTime(), Date.now())) : new Date(Math.min(yearEnd.getTime(), Date.now()))
  const refStart = new Date(Math.max(new Date(hireDate).getTime(), yearStart.getTime()))
  if (refStart > refEnd) return 0
  let months = (refEnd.getFullYear() - refStart.getFullYear()) * 12 + (refEnd.getMonth() - refStart.getMonth())
  if (refEnd.getDate() >= refStart.getDate()) months++
  months = Math.max(0, Math.min(months, 12))
  return Math.floor(months * rate)
}

// ── Vacation policy helpers ───────────────────────────────────────────────────
// Возвращает ставку начисления дней/месяц (null = не отслеживается)
export function getVacationAccrualRate(emp) {
  const p = emp?.vacationPolicy
  if (!p || p.type === 'standard') return 2.33
  if (p.type === 'untracked') return null
  if (p.type === 'custom') return (p.customDaysPerYear || 28) / 12
  return 2.33
}

export function isVacationTracked(emp) {
  return emp?.vacationPolicy?.type !== 'untracked'
}

export function getVacationPolicyLabel(emp) {
  const p = emp?.vacationPolicy
  if (!p || p.type === 'standard') return '28 дней/год'
  if (p.type === 'untracked') return 'Не отслеживается'
  if (p.type === 'custom') return p.customLabel || `${p.customDaysPerYear || 28} дней/год`
  return '28 дней/год'
}

// ── Payroll calculations ───────────────────────────────────────────────────────
export function calcPayroll(p) {
  const totalEarned = (p.salaryAmount || 0) + (p.bonus || 0) + (p.additionalEarnings || 0)

  // Итоговый аванс (без задвоения official+unofficial)
  const advanceSum = p.totalAdvance != null
    ? (p.totalAdvance || 0)
    : (p.officialAdvance || 0) + (p.unofficialAdvance || 0)

  // Итого выдано = отпускные + аванс + оф.часть ЗП + деньги в счёт з/п
  const totalDeducted = (p.vacationPay || 0)
    + advanceSum
    + (p.officialSalaryPart || 0)
    + (p.salaryOnAccount || 0)
  const remaining = totalEarned - totalDeducted - (p.fine || 0) - (p.otherDeductions || 0)
  return { totalEarned, totalDeducted, remaining }
}

// Рассчитывает второй аванс автоматически
export function calcUnofficialAdvance(totalAdvance, officialAdvance) {
  const total = totalAdvance || 0
  const official = officialAdvance || 0
  if (official > total) return 0
  return total - official
}

// Проверяет, есть ли конфликт: официальный аванс > итогового
export function hasAdvanceConflict(totalAdvance, officialAdvance) {
  return (officialAdvance || 0) > (totalAdvance || 0)
}

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_LABELS = {
  unpaid: 'Не выплачено',
  partial: 'Частично',
  paid: 'Выплачено'
}

export const BONUS_TYPE_LABELS = {
  regular: 'Обычная',
  quarterly: 'Квартальная',
  yearly: 'Новогодняя',
  oneTime: 'Разовая',
  other: 'Другая'
}

export function statusClass(status) {
  if (status === 'paid') return 'badge badge-success'
  if (status === 'partial') return 'badge badge-warning'
  return 'badge badge-danger'
}

// ── Finance calculations ───────────────────────────────────────────────────────
export function calcFinance(fot, fin) {
  if (!fin) return {}
  const revenue = fin.revenue || 0
  const fixedExpenses = fin.fixedExpenses || 0
  const otherExpenses = fin.otherExpenses || 0
  const fotPct = revenue > 0 ? (fot / revenue * 100) : 0
  const profitBeforeFOT = revenue - fixedExpenses - otherExpenses
  const profitAfterFOT = profitBeforeFOT - fot
  const fotShareInExpenses = (fot + fixedExpenses) > 0 ? (fot / (fot + fixedExpenses) * 100) : 0
  return { fotPct, profitBeforeFOT, profitAfterFOT, fotShareInExpenses }
}

// ── Production calendar & absences ───────────────────────────────────────────
export const ABSENCE_TYPES = {
  vacation:      { label: 'Отпуск',        color: '#bbf7d0', textColor: '#15803d', short: 'О' },
  sick:          { label: 'Больничный',     color: '#fef08a', textColor: '#a16207', short: 'Б' },
  dayoff:        { label: 'Отгул',          color: '#e9d5ff', textColor: '#7c3aed', short: 'Г' },
  business_trip: { label: 'Командировка',   color: '#fed7aa', textColor: '#c2410c', short: 'К' },
  absence:       { label: 'Прогул',         color: '#fecaca', textColor: '#dc2626', short: 'П' },
  remote:        { label: 'Удалённо',       color: '#bae6fd', textColor: '#0369a1', short: 'У' },
}

// Russian public holidays (key = YYYY-MM-DD)
const RU_HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05',
  '2024-01-06','2024-01-07','2024-01-08',
  '2024-02-23','2024-03-08',
  '2024-04-29','2024-04-30',
  '2024-05-01','2024-05-09','2024-05-10',
  '2024-06-12','2024-11-04','2024-12-31',
  // 2025
  '2025-01-01','2025-01-02','2025-01-03','2025-01-04','2025-01-05',
  '2025-01-06','2025-01-07','2025-01-08',
  '2025-02-24','2025-03-10',
  '2025-05-01','2025-05-02','2025-05-08','2025-05-09',
  '2025-06-12','2025-06-13',
  '2025-11-04','2025-12-31',
  // 2026
  '2026-01-01','2026-01-02','2026-01-08','2026-01-09',
  '2026-02-23','2026-03-09',
  '2026-05-01','2026-05-04','2026-05-11',
  '2026-06-12','2026-11-04',
])

export function getDayType(dateStr) {
  if (RU_HOLIDAYS.has(dateStr)) return 'holiday'
  const dow = new Date(dateStr).getDay()
  if (dow === 0 || dow === 6) return 'weekend'
  return 'workday'
}

// Возвращает 'workday' или 'restday' для сотрудника с индивидуальным сменным графиком.
// Цикл отсчитывается от даты найма (hireDate).
export function getShiftDayType(dateStr, employee) {
  const schedule = employee?.shiftSchedule
  if (!schedule || employee?.workSchedule !== 'Индивидуальный график') return getDayType(dateStr)
  const { workDays, restDays } = schedule
  const total = (workDays || 2) + (restDays || 2)
  if (total <= 0) return getDayType(dateStr)
  if (!employee.hireDate) return getDayType(dateStr)
  const start = new Date(employee.hireDate + 'T00:00:00')
  const current = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.floor((current - start) / 86400000)
  const posInCycle = ((diffDays % total) + total) % total
  return posInCycle < (workDays || 2) ? 'workday' : 'restday'
}

export const DAY_TYPE_STYLE = {
  workday: { bg: '#ffffff', text: '#374151' },
  weekend: { bg: '#f3f4f6', text: '#9ca3af' },
  holiday: { bg: '#dbeafe', text: '#1d4ed8' },
}

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// Returns all absences for an employee on a given date
export function getAbsenceOnDate(absences, employeeId, date) {
  return absences.find(a =>
    a.employeeId === employeeId &&
    a.startDate <= date &&
    a.endDate >= date
  )
}

// Count absence days by type for an employee in a year
export function countAbsenceDays(absences, employeeId, year) {
  const counts = {}
  Object.keys(ABSENCE_TYPES).forEach(t => { counts[t] = 0 })
  absences
    .filter(a => a.employeeId === employeeId && (
      a.startDate.startsWith(String(year)) || a.endDate.startsWith(String(year))
    ))
    .forEach(a => {
      const start = new Date(Math.max(new Date(a.startDate), new Date(`${year}-01-01`)))
      const end   = new Date(Math.min(new Date(a.endDate),   new Date(`${year}-12-31`)))
      let d = new Date(start)
      while (d <= end) {
        const ds = d.toISOString().slice(0,10)
        if (getDayType(ds) === 'workday') {
          counts[a.type] = (counts[a.type] || 0) + 1
        }
        d.setDate(d.getDate() + 1)
      }
    })
  return counts
}

// Рассчитывает баланс отпуска с учётом политики начисления и начального остатка
export function getVacationBalance(emp, absences) {
  const rate = getVacationAccrualRate(emp)
  if (rate === null) return { balance: 0, totalAccrued: 0, totalUsed: 0, hasOpeningBalance: false, untracked: true, rate: null }

  const today = new Date().toISOString().slice(0, 10)
  const ob = emp?.vacationOpeningBalance
  const totalAccrued = calcAccruedVacationDays(emp.hireDate, emp.dismissDate, rate)

  if (ob?.date && ob.remainingDays != null) {
    const accruedToOB = Math.floor(calcMonthsWorked(emp.hireDate, ob.date) * rate)
    const accruedAfterOB = Math.max(0, totalAccrued - accruedToOB)
    const usedAfterOB = absences
      .filter(a => a.employeeId === emp.id && a.type === 'vacation' && a.dateFrom >= ob.date && a.dateTo <= today)
      .reduce((s, a) => s + (a.days || 0), 0)
    return {
      balance: ob.remainingDays + accruedAfterOB - usedAfterOB,
      totalAccrued,
      totalUsed: usedAfterOB,
      hasOpeningBalance: true,
      ob,
      accruedAfterOB,
      usedAfterOB,
      rate
    }
  }

  const totalUsed = absences
    .filter(a => a.employeeId === emp.id && a.type === 'vacation' && a.dateTo <= today)
    .reduce((s, a) => s + (a.days || 0), 0)
  return { balance: totalAccrued - totalUsed, totalAccrued, totalUsed, hasOpeningBalance: false, rate }
}

// ── Payment settings ──────────────────────────────────────────────────────────
// Gets effective payment settings for an employee (individual overrides global)
export function getEmpPaymentSettings(emp, globalSettings) {
  const ps = emp?.paymentSettings
  if (!ps?.useIndividualPaymentSettings) {
    return {
      hasAdvance: true,
      advanceDay: globalSettings?.advanceDay || 30,
      salaryDay: globalSettings?.salaryDay || 15,
      paymentScheme: 'advance_and_salary',
      paymentComment: ''
    }
  }
  return {
    hasAdvance: ps.hasAdvance !== false,
    advanceDay: ps.hasAdvance !== false ? (ps.advanceDay || globalSettings?.advanceDay || 30) : null,
    salaryDay: ps.salaryDay || globalSettings?.salaryDay || 15,
    paymentScheme: ps.paymentScheme || 'advance_and_salary',
    paymentComment: ps.paymentComment || ''
  }
}
