import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { useApp } from '../context/AppContext'
import { formatMoney, monthShort, BONUS_TYPE_LABELS, calcFinance, formatDate, calcWorkDuration, calcEntitledVacationDays, calcAccruedVacationDays, calcMonthsWorked, getVacationBalance, isVacationTracked, getVacationAccrualRate, getVacationPolicyLabel } from '../utils/helpers'
import { ABSENCE_TYPES } from './Schedule'
import { EmployeeModal } from './Employees'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16']

function ChartCard({ title, children, height = 260 }) {
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function fmt(v) {
  if (!v) return '0'
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}М`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}К`
  return v.toLocaleString('ru-RU')
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, marginTop: 2 }}>
          {p.name}: {typeof p.value === 'number' ? formatMoney(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

function VacationDetailModal({ emp, absences, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const ob = emp?.vacationOpeningBalance
  const vb = getVacationBalance(emp, absences)
  const { totalAccrued, balance } = vb

  // Если есть нач. остаток — считаем месяцы и накоплено от даты остатка
  const rate = getVacationAccrualRate(emp) || 2.33
  const rateLabel = rate.toFixed(2)
  const obMonths = ob ? calcMonthsWorked(emp.hireDate, ob.date) : 0
  const accruedToOB = ob ? Math.floor(obMonths * rate) : 0
  const accruedAfterOB = ob ? Math.max(0, totalAccrued - accruedToOB) : 0

  const totalMonths = calcMonthsWorked(emp.hireDate, emp.dismissDate)
  const policyLabel = getVacationPolicyLabel(emp)

  // Карточки сводки: разные в зависимости от наличия нач. остатка
  const summaryCards = ob
    ? [
        { label: 'Стаж', value: calcWorkDuration(emp.hireDate, emp.dismissDate) || '—', sub: null, color: '#374151' },
        { label: `Нач. остаток на ${formatDate(ob.date)}`, value: `${ob.remainingDays} дн.`, sub: 'точка отсчёта', color: '#0891b2' },
        { label: `Накоплено с ${formatDate(ob.date)}`, value: `${accruedAfterOB} дн.`, sub: `${totalMonths - obMonths} мес × ${rateLabel}`, color: '#1d4ed8' },
        { label: 'Использовано (факт)', value: `${vb.usedAfterOB} дн.`, sub: 'после даты остатка', color: '#059669' },
      ]
    : [
        { label: 'Стаж', value: calcWorkDuration(emp.hireDate, emp.dismissDate) || '—', sub: null, color: '#374151' },
        { label: 'Накоплено всего', value: `${totalAccrued} дн.`, sub: `${totalMonths} мес × ${rateLabel}`, color: '#1d4ed8' },
        { label: 'Использовано', value: `${vb.totalUsed} дн.`, sub: 'прошедшие отпуска', color: '#059669' },
      ]

  // Таблица: все отпуска, с разной логикой расчёта при наличии нач. остатка
  const vacations = absences
    .filter(a => a.employeeId === emp.id && a.type === 'vacation')
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))

  let runningUsed = 0
  const rows = vacations.map(a => {
    const isFuture = a.dateFrom > today
    const isBeforeOB = ob && a.dateFrom < ob.date
    const monthsToVac = calcMonthsWorked(emp.hireDate, a.dateFrom)
    const accruedToVac = ob
      ? ob.remainingDays + Math.max(0, Math.floor(monthsToVac * rate) - accruedToOB)
      : Math.floor(monthsToVac * rate)
    // Накопленное не должно уменьшаться от строки к строке
    const relevant = !isBeforeOB && !isFuture
    if (relevant) runningUsed += (a.days || 0)
    const balanceAfter = accruedToVac - (isBeforeOB ? 0 : runningUsed)
    return { ...a, accruedToVac, runningUsed, balanceAfter, isFuture, isBeforeOB }
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Расчёт отпуска — {emp.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {emp.department} · принят {formatDate(emp.hireDate)}
            </div>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Сводка */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${summaryCards.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
            {summaryCards.map(s => (
              <div key={s.label} style={{ padding: '12px 14px', background: '#f8f9fb', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Карточка остатка */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: balance < 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${balance < 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {ob
                  ? `Остаток = нач. остаток (${ob.remainingDays}) + накоплено с ${formatDate(ob.date)} (${accruedAfterOB}) − использовано (${vb.usedAfterOB})`
                  : `Остаток = накоплено (${totalAccrued}) − использовано (${vb.totalUsed})`
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 16, flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: balance < 0 ? '#dc2626' : balance === 0 ? '#6b7280' : '#059669' }}>
                  {balance > 0 ? `+${balance}` : balance} дн.
                </div>
                <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                  на {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          {/* Правило начисления */}
          <div style={{ padding: '7px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 11, color: '#1d4ed8', marginBottom: 14 }}>
            <strong>{policyLabel}</strong> = {rateLabel} дн/мес за каждый полный месяц работы от даты приёма
            {ob && <span style={{ color: '#92400e' }}> · Расчёт ведётся от нач. остатка на {formatDate(ob.date)}</span>}
          </div>

          {/* Таблица периодов */}
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Отпуска не зафиксированы</div>
          ) : (
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Период отпуска</th>
                  <th style={{ textAlign: 'center' }}>Дней</th>
                  <th style={{ textAlign: 'center' }}>{ob ? 'Доступно к дате' : 'Накоплено к дате'}</th>
                  <th style={{ textAlign: 'center' }}>Использовано итого</th>
                  <th style={{ textAlign: 'center' }}>Баланс после</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const muted = r.isFuture || r.isBeforeOB
                  const rowStyle = r.isBeforeOB
                    ? { opacity: 0.4, background: '#f9fafb' }
                    : r.isFuture ? { opacity: 0.55, background: '#f8f9fb' } : {}
                  return (
                    <tr key={r.id} style={rowStyle}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        {formatDate(r.dateFrom)} — {formatDate(r.dateTo)}
                        {r.isBeforeOB && <span style={{ marginLeft: 6, fontSize: 10, background: '#fde68a', color: '#92400e', borderRadius: 4, padding: '1px 5px' }}>до нач. остатка</span>}
                        {r.isFuture && !r.isBeforeOB && <span style={{ marginLeft: 6, fontSize: 10, background: '#e5e7eb', color: '#6b7280', borderRadius: 4, padding: '1px 5px' }}>запланирован</span>}
                        {r.comment && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{r.comment}</div>}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: muted ? '#9ca3af' : '#059669' }}>{r.days}</td>
                      <td style={{ textAlign: 'center', color: muted ? '#9ca3af' : 'inherit' }}>{r.isBeforeOB ? '—' : r.accruedToVac}</td>
                      <td style={{ textAlign: 'center', color: muted ? '#9ca3af' : 'inherit' }}>{r.isBeforeOB || r.isFuture ? '—' : r.runningUsed}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: muted ? '#9ca3af' : r.balanceAfter < 0 ? '#dc2626' : r.balanceAfter === 0 ? '#6b7280' : '#1d4ed8' }}>
                        {r.isBeforeOB || r.isFuture ? '—' : r.balanceAfter > 0 ? `+${r.balanceAfter}` : r.balanceAfter}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export default function Analytics() {
  const { state, dispatch } = useApp()
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState('fot')
  const [cardEmployee, setCardEmployee] = useState(null)
  const [vacationDetailEmp, setVacationDetailEmp] = useState(null)

  // Monthly data for the year
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const payrolls = state.payrolls.filter(p => p.month === m && p.year === year)
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      const advances = payrolls.reduce((s, p) => s + (p.totalAdvance != null ? (p.totalAdvance || 0) : ((p.officialAdvance || 0) + (p.unofficialAdvance || 0))), 0)
      const deductions = payrolls.reduce((s, p) => s + (p.fine || 0) + (p.otherDeductions || 0), 0)
      const bonuses = payrolls.reduce((s, p) => s + (p.bonus || 0), 0)
      const additionalEarnings = payrolls.reduce((s, p) => s + (p.additionalEarnings || 0), 0)
      const remaining = payrolls.reduce((s, p) => s + (p.remaining || 0), 0)
      const fin = state.financeByMonth.find(f => f.month === m && f.year === year) || {}
      const revenue = fin.revenue || 0
      const fixedExpenses = fin.fixedExpenses || 0
      const { fotPct, profitAfterFOT } = calcFinance(fot, fin)
      return {
        name: monthShort(m),
        fot, advances, deductions, bonuses, additionalEarnings, remaining,
        revenue, fixedExpenses, fotPct: parseFloat(fotPct.toFixed(1)), profitAfterFOT
      }
    })
  }, [state.payrolls, state.financeByMonth, year])

  // Department data
  const deptData = useMemo(() => {
    const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))]
    return depts.map(dept => {
      const payrolls = state.payrolls.filter(p => p.department === dept && p.year === year)
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      const count = state.employees.filter(e => e.department === dept && e.status === 'active').length
      return { name: dept, fot, count }
    }).filter(d => d.fot > 0).sort((a, b) => b.fot - a.fot)
  }, [state, year])

  // Manager data
  const mgrData = useMemo(() => {
    const mgrs = [...new Set(state.employees.map(e => e.manager).filter(Boolean))]
    return mgrs.map(mgr => {
      const payrolls = state.payrolls.filter(p => p.manager === mgr && p.year === year)
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      return { name: mgr, fot }
    }).filter(d => d.fot > 0).sort((a, b) => b.fot - a.fot)
  }, [state, year])

  // Bonus breakdown
  const bonusData = useMemo(() => {
    const types = {}
    state.payrolls.filter(p => p.year === year && p.bonus > 0).forEach(p => {
      const t = p.bonusType || 'regular'
      types[t] = (types[t] || 0) + (p.bonus || 0)
    })
    return Object.entries(types).map(([k, v]) => ({ name: BONUS_TYPE_LABELS[k] || k, value: v }))
  }, [state.payrolls, year])

  // Employee bonuses
  const empBonusData = useMemo(() => {
    const byEmp = {}
    state.payrolls.filter(p => p.year === year && p.bonus > 0).forEach(p => {
      const emp = state.employees.find(e => e.id === p.employeeId)
      const name = emp?.fullName || p.employeeId
      byEmp[name] = (byEmp[name] || 0) + (p.bonus || 0)
    })
    return Object.entries(byEmp).map(([n, v]) => ({ name: n, bonus: v }))
      .sort((a, b) => b.bonus - a.bonus).slice(0, 10)
  }, [state, year])

  // Employee additional earnings
  const empAdditionalData = useMemo(() => {
    const byEmp = {}
    state.payrolls.filter(p => p.year === year && p.additionalEarnings > 0).forEach(p => {
      const emp = state.employees.find(e => e.id === p.employeeId)
      const name = emp?.fullName || p.employeeId
      byEmp[name] = (byEmp[name] || 0) + (p.additionalEarnings || 0)
    })
    return Object.entries(byEmp).map(([n, v]) => ({ name: n, additional: v }))
      .sort((a, b) => b.additional - a.additional).slice(0, 10)
  }, [state, year])

  // Combined bonus + additional by employee (top 10)
  const empCombinedData = useMemo(() => {
    const byEmp = {}
    state.payrolls.filter(p => p.year === year).forEach(p => {
      const total = (p.bonus || 0) + (p.additionalEarnings || 0)
      if (total <= 0) return
      const emp = state.employees.find(e => e.id === p.employeeId)
      const name = emp?.fullName || p.employeeId
      if (!byEmp[name]) byEmp[name] = { name, bonus: 0, additional: 0 }
      byEmp[name].bonus += (p.bonus || 0)
      byEmp[name].additional += (p.additionalEarnings || 0)
    })
    return Object.values(byEmp)
      .map(e => ({ ...e, total: e.bonus + e.additional }))
      .sort((a, b) => b.total - a.total).slice(0, 10)
  }, [state, year])

  // Absence analytics
  const absenceStats = useMemo(() => {
    const yearAbs = state.absences.filter(a => {
      const y1 = new Date(a.dateFrom).getFullYear()
      const y2 = new Date(a.dateTo).getFullYear()
      return y1 === year || y2 === year
    })
    // By type
    const byType = {}
    yearAbs.forEach(a => {
      const t = a.type || 'other'
      byType[t] = (byType[t] || 0) + (a.days != null ? a.days : 0)
    })
    const byTypePie = Object.entries(byType).map(([t, v]) => ({
      name: ABSENCE_TYPES[t]?.label || t, value: v, color: ABSENCE_TYPES[t]?.color || '#999'
    }))
    // By employee (vacation days) — только прошедшие отпуска, только отслеживаемые
    const todayStr2 = new Date().toISOString().slice(0, 10)
    const byEmp = {}
    yearAbs.filter(a => a.type === 'vacation' && a.dateTo <= todayStr2).forEach(a => {
      const emp = state.employees.find(e => e.id === a.employeeId)
      if (!emp || !isVacationTracked(emp)) return
      if (!byEmp[emp.id]) byEmp[emp.id] = { name: emp.fullName, days: 0, emp }
      byEmp[emp.id].days += (a.days != null ? a.days : 0)
    })
    const byEmpArr = Object.values(byEmp)
      .map(({ name, days, emp }) => ({
        name, days,
        entitled: calcEntitledVacationDays(emp.hireDate, emp.dismissDate, year, getVacationAccrualRate(emp)),
        duration: calcWorkDuration(emp.hireDate, emp.dismissDate),
        dept: emp.department || '—'
      }))
      .sort((a, b) => b.days - a.days)
    // All active employees — vacation balance table
    const allEmpVacation = state.employees
      .filter(e => (e.status === 'active' || (e.dismissDate && new Date(e.dismissDate).getFullYear() >= year)) && isVacationTracked(e))
      .map(emp => {
        const takenThisYear = byEmp[emp.id]?.days || 0
        const vb = getVacationBalance(emp, state.absences)
        const rate = getVacationAccrualRate(emp)
        const entitledYear = calcEntitledVacationDays(emp.hireDate, emp.dismissDate, year, rate)
        const accrued = vb.hasOpeningBalance
          ? vb.ob.remainingDays + vb.accruedAfterOB
          : vb.totalAccrued
        return {
          emp, name: emp.fullName, dept: emp.department || '—',
          hireDate: emp.hireDate,
          duration: calcWorkDuration(emp.hireDate, emp.dismissDate),
          accrued,
          takenAllTime: vb.totalUsed,
          takenThisYear,
          entitledYear,
          balance: vb.balance,
          hasOpeningBalance: vb.hasOpeningBalance,
          ob: vb.ob,
          policyLabel: getVacationPolicyLabel(emp)
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    // Overlaps: find pairs of employees whose absences overlap, filtered by configured rules
    const overlapRules = state.settings?.vacationOverlapRules || []
    const overlaps = []
    for (let i = 0; i < yearAbs.length; i++) {
      for (let j = i + 1; j < yearAbs.length; j++) {
        const a = yearAbs[i], b = yearAbs[j]
        if (a.employeeId === b.employeeId) continue
        // Если правила заданы — показываем только нарушения правил
        if (overlapRules.length > 0) {
          const empAObj = state.employees.find(e => e.id === a.employeeId)
          const empBObj = state.employees.find(e => e.id === b.employeeId)
          const hasRule = overlapRules.some(r => {
            if (r.type === 'dept') {
              return empAObj?.department === r.dept && empBObj?.department === r.dept
            }
            return (r.empAId === a.employeeId && r.empBId === b.employeeId) ||
                   (r.empAId === b.employeeId && r.empBId === a.employeeId)
          })
          if (!hasRule) continue
        }
        const aFrom = new Date(a.dateFrom), aTo = new Date(a.dateTo)
        const bFrom = new Date(b.dateFrom), bTo = new Date(b.dateTo)
        if (aFrom <= bTo && bFrom <= aTo) {
          const oStart = aFrom > bFrom ? aFrom : bFrom
          const oEnd = aTo < bTo ? aTo : bTo
          const empA = state.employees.find(e => e.id === a.employeeId)
          const empB = state.employees.find(e => e.id === b.employeeId)
          overlaps.push({
            empA: empA?.fullName || '—',
            empB: empB?.fullName || '—',
            deptA: empA?.department || '',
            deptB: empB?.department || '',
            typeA: a.type, typeB: b.type,
            fromA: a.dateFrom, toA: a.dateTo,
            fromB: b.dateFrom, toB: b.dateTo,
            overlapFrom: oStart.toISOString().slice(0, 10),
            overlapTo: oEnd.toISOString().slice(0, 10)
          })
        }
      }
    }
    return { byTypePie, byEmpArr, overlaps, total: yearAbs.length, allEmpVacation }
  }, [state.absences, state.employees, year])

  // Employee monthly breakdown table
  const empMonthlyData = useMemo(() => {
    const empMap = {}
    state.payrolls.filter(p => p.year === year).forEach(p => {
      const emp = state.employees.find(e => e.id === p.employeeId)
      if (!emp) return
      if (!empMap[p.employeeId]) {
        empMap[p.employeeId] = {
          id: p.employeeId,
          name: emp.fullName,
          dept: emp.department || '—',
          months: {}
        }
      }
      empMap[p.employeeId].months[p.month] = (empMap[p.employeeId].months[p.month] || 0) + (p.totalEarned || 0)
    })
    return Object.values(empMap).map(e => {
      const monthValues = Array.from({ length: 12 }, (_, i) => e.months[i + 1] || 0)
      const total = monthValues.reduce((s, v) => s + v, 0)
      const workedMonths = monthValues.filter(v => v > 0).length
      const avg = workedMonths > 0 ? total / workedMonths : 0
      return { ...e, monthValues, total, workedMonths, avg }
    }).sort((a, b) => b.total - a.total)
  }, [state.payrolls, state.employees, year])

  // ── Налоги ФОТ по месяцам (используем те же ставки и taxRecords что в PayrollTax) ──
  const taxMonthlyData = useMemo(() => {
    const taxRates = state.settings?.taxRates || {}

    function getRatesInline(cooperationFormat) {
      const keys = Object.keys(taxRates).filter(k => k !== 'default')
      if (cooperationFormat) {
        for (const key of keys) {
          if (cooperationFormat.toLowerCase().includes(key.toLowerCase())) {
            const r = taxRates[key] || {}
            return { ndfl: (r.ndfl || 0) / 100, sv: (r.sv || 0) / 100, nsp: (r.nsp || 0) / 100 }
          }
        }
      }
      const def = taxRates['default'] || { ndfl: 13, sv: 30, nsp: 0.2 }
      return { ndfl: def.ndfl / 100, sv: def.sv / 100, nsp: (def.nsp || 0) / 100 }
    }

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const payrolls = state.payrolls.filter(p => p.month === m && p.year === year)
      let totalEarned = 0, totalOfficialBase = 0, totalNdfl = 0, totalSv = 0, totalNsp = 0

      payrolls.forEach(p => {
        const emp = state.employees.find(e => e.id === p.employeeId)
        const earned = p.totalEarned || 0
        const rec = state.taxRecords.find(r => r.employeeId === p.employeeId && r.month === m && r.year === year)
        const officialBase = rec?.officialBase != null ? rec.officialBase : earned
        const rates = getRatesInline(emp?.cooperationFormat)
        const ndfl = Math.round(rec?.ndflOverride != null ? rec.ndflOverride : officialBase * rates.ndfl)
        const sv   = parseFloat(((rec?.svOverride  != null ? rec.svOverride  : officialBase * rates.sv)).toFixed(2))
        const nsp  = parseFloat(((rec?.nspOverride != null ? rec.nspOverride : officialBase * rates.nsp)).toFixed(2))
        totalEarned      += earned
        totalOfficialBase+= officialBase
        totalNdfl        += ndfl
        totalSv          += sv
        totalNsp         += nsp
      })

      return {
        name: monthShort(m),
        month: m,
        earned: totalEarned,
        officialBase: totalOfficialBase,
        ndfl: totalNdfl,
        sv: totalSv,
        nsp: totalNsp,
        totalTax: totalNdfl + totalSv + totalNsp,
        net: totalEarned,
        employerCost: parseFloat((totalEarned + totalNdfl + totalSv + totalNsp).toFixed(2)),
        count: payrolls.length
      }
    })
  }, [state.payrolls, state.employees, state.taxRecords, state.settings, year])

  const taxYearTotals = useMemo(() => taxMonthlyData.reduce(
    (a, m) => ({ earned: a.earned + m.earned, officialBase: a.officialBase + m.officialBase, ndfl: a.ndfl + m.ndfl, sv: a.sv + m.sv, nsp: a.nsp + m.nsp, totalTax: a.totalTax + m.totalTax, net: a.net + m.net, employerCost: a.employerCost + m.employerCost }),
    { earned: 0, officialBase: 0, ndfl: 0, sv: 0, nsp: 0, totalTax: 0, net: 0, employerCost: 0 }
  ), [taxMonthlyData])

  // Finance input handler
  function handleFinance(month, field, value) {
    const existing = state.financeByMonth.find(f => f.month === month && f.year === year) || { month, year }
    dispatch({ type: 'UPSERT_FINANCE', payload: { ...existing, [field]: parseFloat(value) || 0 } })
  }

  const yearlyTotals = monthlyData.reduce((acc, m) => ({
    fot: acc.fot + m.fot,
    advances: acc.advances + m.advances,
    bonuses: acc.bonuses + m.bonuses,
    additionalEarnings: acc.additionalEarnings + m.additionalEarnings,
    deductions: acc.deductions + m.deductions
  }), { fot: 0, advances: 0, bonuses: 0, additionalEarnings: 0, deductions: 0 })

  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Аналитика</div>
          <div className="page-subtitle">ФОТ {year}: {formatMoney(yearlyTotals.fot)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}>←</button>
          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 50, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}>→</button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'ФОТ за год', value: formatMoney(yearlyTotals.fot), color: '#3b82f6' },
          { label: 'Авансы за год', value: formatMoney(yearlyTotals.advances), color: '#10b981' },
          { label: 'Премии за год', value: formatMoney(yearlyTotals.bonuses), color: '#8b5cf6' },
          { label: 'Доп. начисления за год', value: formatMoney(yearlyTotals.additionalEarnings), color: '#f59e0b' },
          { label: 'Штрафы/удержания за год', value: formatMoney(yearlyTotals.deductions), color: '#ef4444' }
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          ['fot', 'ФОТ по месяцам'],
          ['depts', 'По отделам'],
          ['managers', 'По руководителям'],
          ['bonuses', 'Премии и доп начисления'],
          ['taxes', 'ФОТ и налоги'],
          ['finance', 'Финансы'],
          ['absences', `Отпуска${absenceStats.overlaps.length > 0 ? ` (⚠ ${absenceStats.overlaps.length} пересеч.)` : ''}`]
        ].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'fot' && (
        <div>
          <ChartCard title="ФОТ по месяцам (начислено / авансы / остаток)">
            <BarChart data={monthlyData} margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fot" name="Начислено" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="advances" name="Авансы" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="remaining" name="Остаток" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Динамика ФОТ за год" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="fot" name="ФОТ" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} />
            </AreaChart>
          </ChartCard>

          {/* Таблица начислений по сотрудникам */}
          {empMonthlyData.length > 0 && (() => {
            const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
            // Итоговая строка по месяцам
            const totByMonth = Array.from({ length: 12 }, (_, i) =>
              empMonthlyData.reduce((s, e) => s + (e.monthValues[i] || 0), 0)
            )
            const grandTotal = empMonthlyData.reduce((s, e) => s + e.total, 0)
            const activeMonths = totByMonth.filter(v => v > 0).length
            const grandAvg = activeMonths > 0 ? grandTotal / activeMonths : 0

            return (
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Начисления по сотрудникам — {year}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Средняя з/п рассчитывается по отработанным месяцам</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: 11, minWidth: 1100 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fb' }}>
                        <th style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2, minWidth: 160, fontWeight: 700 }}>Сотрудник</th>
                        <th style={{ minWidth: 80, color: 'var(--text-muted)', fontWeight: 600 }}>Отдел</th>
                        {MONTHS_SHORT.map(m => (
                          <th key={m} style={{ textAlign: 'right', minWidth: 72, fontWeight: 600 }}>{m}</th>
                        ))}
                        <th style={{ textAlign: 'right', minWidth: 90, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff' }}>Итого</th>
                        <th style={{ textAlign: 'right', minWidth: 90, fontWeight: 700, color: '#059669', background: '#f0fdf4' }}>Ср. з/п</th>
                        <th style={{ textAlign: 'center', minWidth: 60, fontWeight: 600, color: 'var(--text-muted)' }}>Мес.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empMonthlyData.map((e, ri) => (
                        <tr key={e.id} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ position: 'sticky', left: 0, background: ri % 2 === 0 ? 'white' : '#fafafa', zIndex: 1, fontWeight: 600, fontSize: 12 }}>
                            {e.name}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{e.dept}</td>
                          {e.monthValues.map((v, mi) => (
                            <td key={mi} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: v > 0 ? '#111' : '#d1d5db' }}>
                              {v > 0 ? v.toLocaleString('ru-RU') : '—'}
                            </td>
                          ))}
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff' }}>
                            {e.total.toLocaleString('ru-RU')}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669', background: '#f0fdf4' }}>
                            {Math.round(e.avg).toLocaleString('ru-RU')}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{e.workedMonths}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#1e3a5f', color: 'white' }}>
                        <td style={{ position: 'sticky', left: 0, background: '#1e3a5f', zIndex: 1, fontWeight: 700, fontSize: 12, color: 'white' }}>
                          ИТОГО
                        </td>
                        <td />
                        {totByMonth.map((v, mi) => (
                          <td key={mi} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: v > 0 ? '#93c5fd' : '#4b6a8b' }}>
                            {v > 0 ? v.toLocaleString('ru-RU') : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#bfdbfe', background: '#172d4d' }}>
                          {grandTotal.toLocaleString('ru-RU')}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#6ee7b7', background: '#14382a' }}>
                          {Math.round(grandAvg).toLocaleString('ru-RU')}
                        </td>
                        <td style={{ textAlign: 'center', color: '#93c5fd', fontSize: 11 }}>{activeMonths}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'depts' && (
        <div>
          {deptData.length === 0 ? (
            <div className="empty-state"><h3>Нет данных по отделам</h3></div>
          ) : (
            <>
              <ChartCard title="ФОТ по отделам за год">
                <BarChart data={deptData} layout="vertical" margin={{ top: 4, right: 80, bottom: 0, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="fot" name="ФОТ" radius={[0, 4, 4, 0]}>
                    {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ChartCard>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ChartCard title="Доля ФОТ по отделам" height={240}>
                  <PieChart>
                    <Pie data={deptData} dataKey="fot" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ChartCard>
                <div className="chart-card">
                  <div className="chart-title">Детализация по отделам</div>
                  <table className="table">
                    <thead>
                      <tr><th>Отдел</th><th>Сотр.</th><th>ФОТ</th><th>%</th></tr>
                    </thead>
                    <tbody>
                      {deptData.map((d, i) => {
                        const total = deptData.reduce((s, x) => s + x.fot, 0)
                        return (
                          <tr key={d.name}>
                            <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                              {d.name}
                            </td>
                            <td>{d.count}</td>
                            <td className="money">{formatMoney(d.fot)}</td>
                            <td>{total > 0 ? `${((d.fot / total) * 100).toFixed(1)}%` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'managers' && (
        <div>
          {mgrData.length === 0 ? (
            <div className="empty-state"><h3>Нет данных по руководителям</h3></div>
          ) : (
            <ChartCard title="ФОТ подчинённых по руководителям за год" height={300}>
              <BarChart data={mgrData} layout="vertical" margin={{ top: 4, right: 80, bottom: 0, left: 130 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={125} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="fot" name="ФОТ" radius={[0, 4, 4, 0]}>
                  {mgrData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>
          )}
        </div>
      )}

      {tab === 'bonuses' && (
        <div>
          {/* Итоговые карточки */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Премии за год', value: formatMoney(yearlyTotals.bonuses), color: '#8b5cf6', bg: '#faf5ff', border: '#e9d5ff' },
              { label: 'Доп. начисления за год', value: formatMoney(yearlyTotals.additionalEarnings), color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
              { label: 'Итого премии + доп. начисл.', value: formatMoney(yearlyTotals.bonuses + yearlyTotals.additionalEarnings), color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Раздел: Премии */}
          <div style={{ fontWeight: 700, fontSize: 13, color: '#7c3aed', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #e9d5ff' }}>
            Премии
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <ChartCard title="Премии по типам за год" height={240}>
              {bonusData.length > 0 ? (
                <PieChart>
                  <Pie data={bonusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {bonusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных о премиях</div>
              )}
            </ChartCard>
            <ChartCard title="Топ-10 сотрудников по премиям" height={240}>
              {empBonusData.length > 0 ? (
                <BarChart data={empBonusData} layout="vertical" margin={{ top: 4, right: 60, bottom: 0, left: 110 }}>
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={105} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="bonus" name="Премия" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
              )}
            </ChartCard>
          </div>

          {/* Раздел: Доп. начисления */}
          <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #fde68a' }}>
            Доп. начисления
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <ChartCard title="Доп. начисления по месяцам" height={240}>
              {monthlyData.some(m => m.additionalEarnings > 0) ? (
                <BarChart data={monthlyData} margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="additionalEarnings" name="Доп. начисления" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет доп. начислений за {year}</div>
              )}
            </ChartCard>
            <ChartCard title="Топ-10 сотрудников по доп. начислениям" height={240}>
              {empAdditionalData.length > 0 ? (
                <BarChart data={empAdditionalData} layout="vertical" margin={{ top: 4, right: 60, bottom: 0, left: 110 }}>
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={105} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="additional" name="Доп. начисления" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
              )}
            </ChartCard>
          </div>

          {/* Раздел: Итоговый сводный */}
          <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #bbf7d0' }}>
            Итого: Премии + Доп. начисления
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard title="Премии и доп. начисления по месяцам" height={260}>
              {monthlyData.some(m => m.bonuses > 0 || m.additionalEarnings > 0) ? (
                <BarChart data={monthlyData} margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="bonuses" name="Премии" fill="#8b5cf6" radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="additionalEarnings" name="Доп. начисления" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
              )}
            </ChartCard>
            <ChartCard title="Топ-10 сотрудников: премии + доп. начисления" height={260}>
              {empCombinedData.length > 0 ? (
                <BarChart data={empCombinedData} layout="vertical" margin={{ top: 4, right: 60, bottom: 0, left: 110 }}>
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={105} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="bonus" name="Премии" fill="#8b5cf6" stackId="b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="additional" name="Доп. начисл." fill="#f59e0b" stackId="b" radius={[0, 4, 4, 0]} />
                </BarChart>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {tab === 'taxes' && (
        <div>
          {/* Пояснение логики */}
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            background: '#f0f4ff', border: '1px solid #c7d2fe', fontSize: 12, lineHeight: 1.7
          }}>
            <div style={{ fontWeight: 700, color: '#4f46e5', marginBottom: 6, fontSize: 13 }}>
              📌 Логика отображаемых цифр
            </div>
            <div style={{ color: '#374151' }}>
              <b>Начислено</b> — сумма к выплате сотруднику на руки (уже после НДФЛ, так принято в системе).
              {' '}<b>Офиц. зарплата</b> — база для расчёта налогов (настраивается в разделе «Налоги ФОТ»).
            </div>
            <div style={{ marginTop: 4, color: '#374151' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>На руки</span> = Начислено
              &nbsp;·&nbsp;
              <span style={{ color: '#dc2626', fontWeight: 700 }}>НДФЛ</span> — уплачивает работодатель в бюджет дополнительно к выплате сотруднику
              &nbsp;·&nbsp;
              <span style={{ color: '#7c3aed', fontWeight: 700 }}>СВ</span> — страховые взносы (30%), доп. расход работодателя
              &nbsp;·&nbsp;
              <span style={{ color: '#0e7490', fontWeight: 700 }}>НСП</span> — несчастные случаи (0,2% по умолчанию)
            </div>
            <div style={{ marginTop: 4, color: '#374151' }}>
              <span style={{ color: '#0891b2', fontWeight: 700 }}>Расходы работодателя</span> = Начислено + НДФЛ + СВ + НСП
              &nbsp;·&nbsp;
              <span style={{ color: '#dc2626', fontWeight: 700 }}>Итого налогов</span> = НДФЛ + СВ + НСП
            </div>
          </div>

          {/* Карточки-итоги за год */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Начислено за год (на руки)', value: taxYearTotals.earned,       color: '#059669', bg: '#ecfdf5', border: '#bbf7d0', dec: 0 },
              { label: 'НДФЛ за год',               value: taxYearTotals.ndfl,         color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dec: 0 },
              { label: 'Страховые взносы за год',   value: taxYearTotals.sv,           color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff', dec: 2 },
              { label: 'НСП за год',                value: taxYearTotals.nsp,          color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc', dec: 2 },
              { label: 'Итого налогов за год',      value: taxYearTotals.totalTax,     color: '#dc2626', bg: '#fff1f2', border: '#fecaca', dec: 2 },
              { label: 'Расходы работодателя',      value: taxYearTotals.employerCost, color: '#0891b2', bg: '#f0f9ff', border: '#7dd3fc', dec: 2 },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{formatMoney(c.value, false, c.dec)}</div>
              </div>
            ))}
          </div>

          {/* График */}
          <ChartCard title="ФОТ и налоги по месяцам — структура расходов работодателя" height={280}>
            <BarChart data={taxMonthlyData.filter(m => m.earned > 0)} margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="net"  name="На руки"          fill="#10b981" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="ndfl" name="НДФЛ"             fill="#ef4444" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="sv"   name="Страховые взносы" fill="#8b5cf6" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="nsp"  name="НСП"              fill="#0e7490" stackId="a" radius={[3,3,0,0]} />
            </BarChart>
          </ChartCard>

          {/* Таблица по месяцам */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Детализация по месяцам — {year}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                Ставки и база для расчёта настраиваются в разделе «Налоги ФОТ»
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    <th style={{ fontWeight: 700, minWidth: 60 }}>Месяц</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 70 }}>Сотрудн.</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 100 }}>Начислено</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 100, color: '#1d4ed8' }}>Офиц. база</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 90, color: '#dc2626', background: '#fef2f2' }}>НДФЛ</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 100, color: '#7c3aed', background: '#f5f3ff' }}>Страх. взносы</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 70, color: '#0e7490', background: '#ecfeff' }}>НСП</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 100, color: '#dc2626' }}>Итого налогов</th>
                    <th style={{ textAlign: 'right', fontWeight: 700, minWidth: 120, color: '#0891b2', background: '#f0f9ff' }}>Расходы работодат.</th>
                  </tr>
                </thead>
                <tbody>
                  {taxMonthlyData.map((row, i) => {
                    const isEmpty = row.earned === 0
                    return (
                      <tr key={row.month} style={{ background: i % 2 === 0 ? 'white' : '#fafbff', opacity: isEmpty ? 0.4 : 1 }}>
                        <td style={{ fontWeight: 700, fontSize: 13 }}>{row.name}</td>
                        <td style={{ textAlign: 'right', color: '#6b7280' }}>{row.count > 0 ? row.count : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.earned)}</td>
                        <td style={{ textAlign: 'right', color: '#1d4ed8', fontWeight: 600 }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.officialBase)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626', background: '#fef9f9' }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.ndfl)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#7c3aed', background: '#faf5ff' }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.sv, false, 2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0e7490', background: '#ecfeff' }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.nsp, false, 2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.totalTax, false, 2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0891b2', background: '#f0fdff' }}>{isEmpty ? <span style={{ color: '#d1d5db' }}>—</span> : formatMoney(row.employerCost, false, 2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1e3a5f', color: 'white', fontWeight: 700 }}>
                    <td style={{ fontWeight: 800, fontSize: 13, color: 'white' }}>ИТОГО</td>
                    <td />
                    <td style={{ textAlign: 'right', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>{formatMoney(taxYearTotals.earned)}</td>
                    <td style={{ textAlign: 'right', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>{formatMoney(taxYearTotals.officialBase)}</td>
                    <td style={{ textAlign: 'right', color: '#fca5a5', fontFamily: 'var(--font-mono)', background: '#3b1c1c', fontWeight: 800, fontSize: 14 }}>{formatMoney(taxYearTotals.ndfl)}</td>
                    <td style={{ textAlign: 'right', color: '#c4b5fd', fontFamily: 'var(--font-mono)', background: '#2d1f4e', fontWeight: 800, fontSize: 14 }}>{formatMoney(taxYearTotals.sv, false, 2)}</td>
                    <td style={{ textAlign: 'right', color: '#67e8f9', fontFamily: 'var(--font-mono)', background: '#0c3040', fontWeight: 800, fontSize: 14 }}>{formatMoney(taxYearTotals.nsp, false, 2)}</td>
                    <td style={{ textAlign: 'right', color: '#fca5a5', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14 }}>{formatMoney(taxYearTotals.totalTax, false, 2)}</td>
                    <td style={{ textAlign: 'right', color: '#67e8f9', fontFamily: 'var(--font-mono)', background: '#0c2d35', fontWeight: 800, fontSize: 14 }}>{formatMoney(taxYearTotals.employerCost, false, 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Итоговая формула */}
            <div style={{ padding: '10px 20px', background: '#f8f9fb', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>📐 <b>Итого налогов</b> = НДФЛ + СВ + НСП</span>
              <span>📐 <b>Расходы работодателя</b> = Начислено + НДФЛ + СВ + НСП</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <div>
          <ChartCard title="ФОТ как % от выручки" height={240}>
            <LineChart data={monthlyData} margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip formatter={(v) => [`${v}%`, '% ФОТ']} />
              <Line type="monotone" dataKey="fotPct" name="% ФОТ от выручки" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
            </LineChart>
          </ChartCard>

          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
              Финансовые данные по месяцам — введите для аналитики
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Месяц</th>
                    <th>ФОТ</th>
                    <th>Выручка ₽</th>
                    <th>Пост. расходы ₽</th>
                    <th>Проч. расходы ₽</th>
                    <th>% ФОТ</th>
                    <th>Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row, i) => {
                    const m = i + 1
                    const fin = state.financeByMonth.find(f => f.month === m && f.year === year) || {}
                    return (
                      <tr key={m}>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td className="money">{formatMoney(row.fot)}</td>
                        <td>
                          <input type="number" className="input input-sm input-mono" style={{ width: 110 }}
                            value={fin.revenue || ''} placeholder="0"
                            onChange={e => handleFinance(m, 'revenue', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" className="input input-sm input-mono" style={{ width: 100 }}
                            value={fin.fixedExpenses || ''} placeholder="0"
                            onChange={e => handleFinance(m, 'fixedExpenses', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" className="input input-sm input-mono" style={{ width: 100 }}
                            value={fin.otherExpenses || ''} placeholder="0"
                            onChange={e => handleFinance(m, 'otherExpenses', e.target.value)} />
                        </td>
                        <td>
                          {row.fotPct > 0
                            ? <span style={{ fontWeight: 700, color: row.fotPct > 30 ? '#dc2626' : row.fotPct > 20 ? '#d97706' : '#059669' }}>
                                {row.fotPct}%
                              </span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                          }
                        </td>
                        <td className="money">
                          {row.revenue > 0
                            ? <span style={{ fontWeight: 700, color: row.profitAfterFOT >= 0 ? '#059669' : '#dc2626' }}>
                                {formatMoney(row.profitAfterFOT)}
                              </span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'absences' && (
        <div>
          {absenceStats.total === 0 ? (
            <div className="empty-state"><h3>Нет данных об отсутствиях за {year} год</h3><p>Добавьте отпуска в разделе «График работы»</p></div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Записей об отсутствии', value: absenceStats.total, color: '#059669' },
                  { label: 'Сотрудников брали отпуск', value: absenceStats.byEmpArr.length, color: '#3b82f6' },
                  { label: 'Пересечений по датам', value: absenceStats.overlaps.length === 0 ? '✓ нет' : absenceStats.overlaps.length, color: absenceStats.overlaps.length > 0 ? '#dc2626' : '#059669' }
                ].map(s => (
                  <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', borderLeft: `4px solid ${s.color}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <ChartCard title="Дни отсутствия по типу" height={220}>
                  {absenceStats.byTypePie.length > 0 ? (
                    <PieChart>
                      <Pie data={absenceStats.byTypePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                        {absenceStats.byTypePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v + ' дн.', n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Нет данных</div>}
                </ChartCard>
                <ChartCard title="Дни отпуска по сотрудникам (топ-10)" height={220}>
                  {absenceStats.byEmpArr.length > 0 ? (
                    <BarChart data={absenceStats.byEmpArr.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 50, bottom: 0, left: 120 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115} />
                      <Tooltip formatter={v => [v + ' дн.', 'Отпуск']} />
                      <Bar dataKey="days" name="Отпуск" fill="#059669" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Нет данных</div>}
                </ChartCard>
              </div>
              {/* Таблица остатков отпускных дней */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                  Баланс отпускных дней (2,33 дня/месяц · 28 дней/год)
                </div>
                <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', background: '#f8f9fb' }}>
                  Накоплено = стаж (полные месяцы) × 2,33 · Остаток = накоплено − использовано за всё время · <span style={{ color: '#92400e' }}>★ — указан начальный остаток</span>
                </div>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Сотрудник</th>
                      <th>Отдел</th>
                      <th>Дата приёма</th>
                      <th>Стаж</th>
                      <th style={{ textAlign: 'center' }}>Накоплено всего</th>
                      <th style={{ textAlign: 'center' }}>Исп. в {year} г.</th>
                      <th style={{ textAlign: 'center' }}>Исп. всего</th>
                      <th style={{ textAlign: 'center', fontWeight: 800 }}>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absenceStats.allEmpVacation.map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>
                          <span onClick={() => setCardEmployee(e.emp)} style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline dotted' }}>
                            {e.name}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{e.dept}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatDate(e.hireDate)}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{e.duration || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span onClick={() => setVacationDetailEmp(e.emp)}
                            style={{ fontWeight: 700, color: '#1d4ed8', cursor: 'pointer', textDecoration: 'underline dotted', fontSize: 13 }}
                            title="Открыть расчёт отпуска">
                            {e.accrued}
                          </span>
                          {e.hasOpeningBalance && <span title={`Нач. остаток на ${formatDate(e.ob?.date)}: ${e.ob?.remainingDays} дн.`} style={{ marginLeft: 4, color: '#92400e', fontSize: 11 }}>★</span>}
                        </td>
                        <td style={{ textAlign: 'center', color: e.takenThisYear > 0 ? '#059669' : 'var(--text-muted)' }}>{e.takenThisYear || '—'}</td>
                        <td style={{ textAlign: 'center', color: e.takenAllTime > 0 ? '#374151' : 'var(--text-muted)' }}>{e.takenAllTime || '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: e.balance < 0 ? '#dc2626' : e.balance === 0 ? 'var(--text-muted)' : '#1d4ed8' }}>
                          {e.balance > 0 ? `+${e.balance}` : e.balance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                  {absenceStats.overlaps.length > 0
                    ? <span style={{ color: '#dc2626' }}>⚠ Пересечения по датам ({absenceStats.overlaps.length})</span>
                    : <span style={{ color: '#059669' }}>✓ Пересечений нет</span>}
                </div>
                {absenceStats.overlaps.length > 0 ? (
                  <table className="table">
                    <thead><tr><th>Сотрудник А</th><th>Тип</th><th>Сотрудник Б</th><th>Тип</th><th>Период пересечения</th></tr></thead>
                    <tbody>
                      {absenceStats.overlaps.map((o, i) => {
                        const tiA = ABSENCE_TYPES[o.typeA] || ABSENCE_TYPES.other
                        const tiB = ABSENCE_TYPES[o.typeB] || ABSENCE_TYPES.other
                        return (
                          <tr key={i}>
                            <td><span style={{ fontWeight: 600 }}>{o.empA}</span>{o.deptA && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{o.deptA}</div>}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(o.fromA)} — {formatDate(o.toA)}</div></td>
                            <td><span style={{ background: tiA.bg, color: tiA.color, borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{tiA.label}</span></td>
                            <td><span style={{ fontWeight: 600 }}>{o.empB}</span>{o.deptB && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{o.deptB}</div>}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(o.fromB)} — {formatDate(o.toB)}</div></td>
                            <td><span style={{ background: tiB.bg, color: tiB.color, borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{tiB.label}</span></td>
                            <td style={{ fontWeight: 600, color: '#dc2626' }}>{formatDate(o.overlapFrom)} — {formatDate(o.overlapTo)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Все сотрудники уходят в отпуска в разное время</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>

    {cardEmployee && (
      <EmployeeModal
        employee={cardEmployee}
        initialTab="absences"
        onClose={() => setCardEmployee(null)}
        onEdit={() => setCardEmployee(null)}
        onDismiss={() => setCardEmployee(null)}
        onRestore={() => setCardEmployee(null)}
        onDelete={() => setCardEmployee(null)}
      />
    )}
    {vacationDetailEmp && (
      <VacationDetailModal
        emp={vacationDetailEmp}
        absences={state.absences}
        onClose={() => setVacationDetailEmp(null)}
      />
    )}
    </>
  )
}
