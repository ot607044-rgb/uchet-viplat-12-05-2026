import React, { useState, useMemo } from 'react'
import { AlertTriangle, Bell, TrendingUp, Users, Wallet, CheckCircle, Clock, ChevronLeft, ChevronRight, DollarSign, CalendarRange } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, monthName, monthShort, getCurrentPeriod, calcFinance, getEmpPaymentSettings, formatDate } from '../utils/helpers'
import { ABSENCE_TYPES } from './Schedule'

function StatCard({ label, value, sub, color, icon: Icon, bgColor }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bgColor || '#eff6ff' }}>
        <Icon size={18} color={color || '#3b82f6'} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text-primary)', fontSize: 20 }}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function ReminderAlert({ r }) {
  const [expanded, setExpanded] = useState(false)
  const SHOW = 12
  const totalAmt = r.employees.reduce((s, e) => s + (e.amount || 0), 0)
  const hidden = r.employees.length - SHOW
  const visible = expanded ? r.employees : r.employees.slice(0, SHOW)

  return (
    <div className={`alert alert-${r.type}`} style={{ marginBottom: 10, flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, flexWrap: 'wrap' }}>
        <AlertTriangle size={14} />
        <span>
          {r.daysTo === 0
            ? `Сегодня выплата — ${r.payType} (${r.day} число)`
            : `До выплаты ${r.daysTo} дн. (${r.day} число) — ${r.payType}`}
          {r.forMonth ? ` за ${monthName(r.forMonth)} ${r.forYear}` : ''}
        </span>
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>
          {r.employees.length} чел.{totalAmt > 0 ? ` · ${formatMoney(totalAmt)}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', paddingLeft: 22 }}>
        {visible.map((e, j) => (
          <span key={j} style={{
            fontSize: 11, background: 'rgba(0,0,0,0.06)', borderRadius: 12,
            padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <span style={{ fontWeight: 600 }}>{e.name}</span>
            {e.amount > 0 && <span style={{ opacity: 0.7 }}>{formatMoney(e.amount)}</span>}
          </span>
        ))}
        {hidden > 0 && !expanded && (
          <button onClick={() => setExpanded(true)} style={{
            fontSize: 11, background: 'rgba(0,0,0,0.10)', border: 'none', borderRadius: 12,
            padding: '2px 10px', cursor: 'pointer', fontWeight: 600, color: 'inherit'
          }}>
            и ещё {hidden} →
          </button>
        )}
        {expanded && (
          <button onClick={() => setExpanded(false)} style={{
            fontSize: 11, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 12,
            padding: '2px 10px', cursor: 'pointer', fontWeight: 600, color: 'inherit'
          }}>
            свернуть ↑
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const { state, dispatch } = useApp()
  const [year, setYear] = useState(getCurrentPeriod().year)

  const { month: currentMonth } = getCurrentPeriod()

  // Previous month (salary on the 15th pays for PREVIOUS month)
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear  = currentMonth === 1 ? year - 1 : year

  // Current month stats
  const currentMonthPayrolls = useMemo(() =>
    state.payrolls.filter(p => p.month === currentMonth && p.year === year),
    [state.payrolls, currentMonth, year]
  )

  // Previous month payrolls — used for salary reminders
  const prevMonthPayrolls = useMemo(() =>
    state.payrolls.filter(p => p.month === prevMonth && p.year === prevYear),
    [state.payrolls, prevMonth, prevYear]
  )

  const totalFOT = useMemo(() =>
    currentMonthPayrolls.reduce((s, p) => s + (p.totalEarned || 0), 0),
    [currentMonthPayrolls]
  )
  const totalAdvances = useMemo(() =>
    currentMonthPayrolls.reduce((s, p) => s + (p.officialAdvance || 0) + (p.unofficialAdvance || 0) + (p.salaryOnAccount || 0), 0),
    [currentMonthPayrolls]
  )
  const totalRemaining = useMemo(() =>
    currentMonthPayrolls.reduce((s, p) => s + (p.salaryStatus === 'paid' ? 0 : (p.remaining || 0)), 0),
    [currentMonthPayrolls]
  )
  const totalPaid = useMemo(() =>
    currentMonthPayrolls.filter(p => p.salaryStatus === 'paid').reduce((s, p) => s + (p.totalEarned || 0), 0),
    [currentMonthPayrolls]
  )
  const unpaidCount = useMemo(() =>
    currentMonthPayrolls.filter(p => p.salaryStatus !== 'paid').length,
    [currentMonthPayrolls]
  )
  const activeEmployees = useMemo(() =>
    state.employees.filter(e => e.status === 'active').length,
    [state.employees]
  )

  // Reminders — per-employee, respecting individual payment settings
  const { reminderDaysBefore = 3 } = state.settings || {}
  const nowDate = new Date()
  const todayDay = nowDate.getDate()

  const reminders = useMemo(() => {
    const result = []
    const activeEmps = state.employees.filter(e => e.status === 'active')

    activeEmps.forEach(emp => {
      const ps = getEmpPaymentSettings(emp, state.settings)
      const hireDate = emp.hireDate ? emp.hireDate : null // 'YYYY-MM-DD'

      // ── Advance reminder (pays current month's advance) ──────────────────
      if (ps.hasAdvance && ps.advanceDay != null) {
        const daysTo = ps.advanceDay - todayDay
        if (daysTo >= 0 && daysTo <= reminderDaysBefore) {
          const advanceDateStr = `${year}-${String(currentMonth).padStart(2,'0')}-${String(ps.advanceDay).padStart(2,'0')}`
          if (!hireDate || hireDate <= advanceDateStr) {
            const payroll = currentMonthPayrolls.find(p => p.employeeId === emp.id)
            // Пропускаем если нет записи о начислении
            if (!payroll) return
            const status = payroll.advanceStatus || 'unpaid'
            if (status !== 'paid') {
              const advanceAmount = (payroll.officialAdvance || 0) + (payroll.unofficialAdvance || 0) + (payroll.salaryOnAccount || 0)
              result.push({
                type: daysTo === 0 ? 'danger' : 'warning',
                empName: emp.fullName,
                payType: 'аванс',
                day: ps.advanceDay,
                daysTo,
                amount: advanceAmount,
                status
              })
            }
          }
        }
      }

      // ── Salary reminder (pays PREVIOUS month's salary) ───────────────────
      if (ps.salaryDay != null) {
        const daysTo = ps.salaryDay - todayDay
        if (daysTo >= 0 && daysTo <= reminderDaysBefore) {
          const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate()
          const prevMonthEndStr = `${prevYear}-${String(prevMonth).padStart(2,'0')}-${String(prevMonthLastDay).padStart(2,'0')}`
          if (!hireDate || hireDate <= prevMonthEndStr) {
            const payroll = prevMonthPayrolls.find(p => p.employeeId === emp.id)
            // Пропускаем если нет записи о начислении за прошлый месяц
            if (!payroll) return
            const status = payroll.salaryStatus || 'unpaid'
            if (status !== 'paid') {
              result.push({
                type: daysTo === 0 ? 'danger' : 'warning',
                empName: emp.fullName,
                payType: 'зарплата',
                day: ps.salaryDay,
                daysTo,
                amount: payroll.remaining || 0,
                status,
                forMonth: prevMonth,
                forYear: prevYear
              })
            }
          }
        }
      }
    })

    // Group by payment type + day
    const byDay = {}
    result.forEach(r => {
      const key = `${r.payType}-${r.day}`
      if (!byDay[key]) byDay[key] = { ...r, employees: [] }
      byDay[key].employees.push({ name: r.empName, amount: r.amount, status: r.status })
    })

    return Object.values(byDay)
  }, [state.employees, state.settings, currentMonthPayrolls, prevMonthPayrolls, reminderDaysBefore, todayDay, currentMonth, prevMonth, prevYear, year])

  // Yearly table data
  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const payrolls = state.payrolls.filter(p => p.month === m && p.year === year)
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      const advances = payrolls.reduce((s, p) => s + (p.officialAdvance || 0) + (p.unofficialAdvance || 0) + (p.salaryOnAccount || 0), 0)
      const deductions = payrolls.reduce((s, p) => s + (p.fine || 0) + (p.otherDeductions || 0), 0)
      const paid = payrolls.filter(p => p.salaryStatus === 'paid').reduce((s, p) => s + (p.totalEarned || 0), 0)
      const remaining = payrolls.reduce((s, p) => s + (p.remaining || 0), 0)
      const fin = state.financeByMonth.find(f => f.month === m && f.year === year) || {}
      const revenue = fin.revenue || 0
      const fixedExpenses = fin.fixedExpenses || 0
      const { fotPct, profitAfterFOT } = calcFinance(fot, fin)
      return {
        month: m,
        fot, advances, deductions, paid, remaining,
        revenue, fixedExpenses, fotPct, profitAfterFOT,
        hasData: payrolls.length > 0
      }
    })
  }, [state.payrolls, state.financeByMonth, year])

  // Inline finance edit for yearly table
  const [editingFinance, setEditingFinance] = useState(null)

  function handleFinanceEdit(month, field, value) {
    const existing = state.financeByMonth.find(f => f.month === month && f.year === year) || { month, year }
    dispatch({ type: 'UPSERT_FINANCE', payload: { ...existing, [field]: parseFloat(value) || 0 } })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Главная</div>
          <div className="page-subtitle">{monthName(currentMonth)} {year}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('payroll')}>
          Начислить зарплату →
        </button>
      </div>

      {/* Reminders */}
      {reminders.map((r, i) => <ReminderAlert key={i} r={r} />)}

      {/* Stats cards */}
      <div className="stats-grid">
        <StatCard label="ФОТ за месяц" value={formatMoney(totalFOT)}
          sub="Начислено всего" color="#3b82f6" bgColor="#eff6ff" icon={DollarSign} />
        <StatCard label="Остаток к выплате" value={formatMoney(totalRemaining)}
          sub="После всех удержаний" color="#7c3aed" bgColor="#f5f3ff" icon={Wallet} />
        <StatCard label="Авансы выплачены" value={formatMoney(totalAdvances)}
          sub="Первый + второй аванс" color="#0891b2" bgColor="#ecfeff" icon={TrendingUp} />
        <StatCard label="Зарплата выплачена" value={formatMoney(totalPaid)}
          sub="Статус «Выплачено»" color="#059669" bgColor="#ecfdf5" icon={CheckCircle} />
        <StatCard label="Сотрудников" value={activeEmployees}
          sub="Активных" color="#6b7280" bgColor="#f9fafb" icon={Users} />
        <StatCard label="Не выплачено" value={unpaidCount}
          sub="Ожидают выплаты" color={unpaidCount > 0 ? '#dc2626' : '#059669'}
          bgColor={unpaidCount > 0 ? '#fef2f2' : '#ecfdf5'} icon={Clock} />
      </div>

      {/* Upcoming absences */}
      {(() => {
        const today = new Date()
        const in30 = new Date(today); in30.setDate(today.getDate() + 30)
        const upcoming = (state.absences || [])
          .filter(a => {
            const from = new Date(a.dateFrom)
            const to = new Date(a.dateTo)
            return to >= today && from <= in30
          })
          .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
          .slice(0, 8)
        if (upcoming.length === 0) return null
        return (
          <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarRange size={16} color="#7c3aed" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Ближайшие отпуска и отсутствия</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>следующие 30 дней</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {upcoming.map((a, i) => {
                const emp = state.employees.find(e => e.id === a.employeeId)
                const ti = ABSENCE_TYPES[a.type] || ABSENCE_TYPES.other
                const from = new Date(a.dateFrom)
                const isActive = from <= today
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
                    borderBottom: i < upcoming.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: isActive ? '#fffbf0' : 'white'
                  }}>
                    <span style={{ background: ti.bg, color: ti.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {ti.label}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{emp?.fullName || '—'}</span>
                    {emp?.department && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {formatDate(a.dateFrom)} — {formatDate(a.dateTo)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ti.color }}>
                      {a.days != null ? `${a.days} р.д.` : ''}
                    </span>
                    {isActive && <span style={{ fontSize: 10, background: '#fef3c7', color: '#d97706', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>сейчас</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Yearly table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Сводка по году</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 50, textAlign: 'center' }}>{year}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2 }}>Месяц</th>
                <th>Начислено</th>
                <th>Авансы</th>
                <th>Выплачено</th>
                <th>Удержания</th>
                <th>Остаток</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>% ФОТ</th>
                <th>Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {yearlyData.map(row => (
                <tr key={row.month} style={{ background: row.month === currentMonth && year === getCurrentPeriod().year ? '#fafbff' : undefined }}>
                  <td style={{
                    fontWeight: 600,
                    position: 'sticky',
                    left: 0,
                    background: row.month === currentMonth && year === getCurrentPeriod().year ? '#fafbff' : 'white',
                    zIndex: 1,
                    borderRight: '1px solid var(--border)'
                  }}>
                    {monthShort(row.month)}
                    {row.month === currentMonth && year === getCurrentPeriod().year && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>●</span>
                    )}
                  </td>
                  <td className="money">{row.fot > 0 ? formatMoney(row.fot) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="money">{row.advances > 0 ? formatMoney(row.advances) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="money money-positive">{row.paid > 0 ? formatMoney(row.paid) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="money">{row.deductions > 0 ? <span style={{ color: 'var(--danger)' }}>{formatMoney(row.deductions)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="money">{row.remaining > 0 ? formatMoney(row.remaining) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  {/* Editable finance cells */}
                  <td>
                    <input
                      type="number"
                      className="input input-mono input-sm"
                      style={{ width: 110, border: '1px solid var(--border-light)' }}
                      value={row.revenue || ''}
                      placeholder="0"
                      onChange={e => handleFinanceEdit(row.month, 'revenue', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input input-mono input-sm"
                      style={{ width: 100, border: '1px solid var(--border-light)' }}
                      value={row.fixedExpenses || ''}
                      placeholder="0"
                      onChange={e => handleFinanceEdit(row.month, 'fixedExpenses', e.target.value)}
                    />
                  </td>
                  <td>
                    {row.revenue > 0
                      ? <span style={{ fontWeight: 600, color: row.fotPct > 30 ? 'var(--danger)' : row.fotPct > 20 ? 'var(--warning)' : 'var(--success)' }}>
                          {row.fotPct.toFixed(1)}%
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td className="money">
                    {row.revenue > 0
                      ? <span style={{ color: row.profitAfterFOT >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {formatMoney(row.profitAfterFOT)}
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-footer">
                <td>Итого</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.fot, 0))}</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.advances, 0))}</td>
                <td className="money money-positive">{formatMoney(yearlyData.reduce((s, r) => s + r.paid, 0))}</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.deductions, 0))}</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.remaining, 0))}</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.revenue, 0))}</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.fixedExpenses, 0))}</td>
                <td>—</td>
                <td className="money">{formatMoney(yearlyData.reduce((s, r) => s + r.profitAfterFOT, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ padding: '10px 20px', background: '#f8f9fb', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          Поля «Выручка» и «Расходы» можно редактировать прямо в таблице
        </div>
      </div>
    </div>
  )
}
