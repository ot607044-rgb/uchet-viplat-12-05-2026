import React, { useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit2, X, CalendarDays } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { monthName, monthShort, getCurrentPeriod, formatDate, calcEntitledVacationDays, calcAccruedVacationDays, isVacationTracked, getVacationAccrualRate } from '../utils/helpers'
import { EmployeeModal } from './Employees'

// Российские официальные праздники (включая переносы) по годам
const RU_HOLIDAYS = {
  2023: new Set([
    '2023-01-01','2023-01-02','2023-01-03','2023-01-04','2023-01-05','2023-01-06','2023-01-09',
    '2023-02-23','2023-02-24','2023-03-08','2023-05-01','2023-05-08','2023-05-09',
    '2023-06-12','2023-11-04','2023-11-06',
  ]),
  2024: new Set([
    '2024-01-01','2024-01-02','2024-01-03','2024-01-04','2024-01-05','2024-01-06','2024-01-07','2024-01-08',
    '2024-02-23','2024-03-08','2024-03-11','2024-04-29','2024-04-30',
    '2024-05-01','2024-05-09','2024-05-10','2024-06-12',
    '2024-11-04','2024-12-30','2024-12-31',
  ]),
  2025: new Set([
    '2025-01-01','2025-01-02','2025-01-03','2025-01-06','2025-01-07','2025-01-08',
    '2025-02-24','2025-03-10',
    '2025-05-01','2025-05-02','2025-05-08','2025-05-09',
    '2025-06-12','2025-06-13','2025-11-04','2025-12-31',
  ]),
  2026: new Set([
    '2026-01-01','2026-01-02','2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09',
    '2026-02-23','2026-03-09',
    '2026-05-01','2026-05-11',
    '2026-06-12','2026-11-04',
  ]),
  2027: new Set([
    '2027-01-01','2027-01-04','2027-01-05','2027-01-06','2027-01-07','2027-01-08',
    '2027-02-22','2027-02-23','2027-03-08',
    '2027-05-03','2027-05-10',
    '2027-06-14','2027-11-04','2027-11-05',
  ]),
}
function ruHoliday(dateStr, year) {
  return !!(RU_HOLIDAYS[year]?.has(dateStr))
}

export const ABSENCE_TYPES = {
  vacation:      { label: 'Отпуск',        color: '#059669', bg: '#ecfdf5', short: 'ОТ' },
  sick:          { label: 'Больничный',     color: '#dc2626', bg: '#fef2f2', short: 'БЛ' },
  dayoff:        { label: 'Отгул',          color: '#3b82f6', bg: '#eff6ff', short: 'ОГ' },
  business_trip: { label: 'Командировка',   color: '#7c3aed', bg: '#f5f3ff', short: 'КМ' },
  unpaid:        { label: 'За свой счёт',   color: '#6b7280', bg: '#f3f4f6', short: 'БЗ' },
  other:         { label: 'Прочее',         color: '#d97706', bg: '#fffbeb', short: 'ПР' },
}

function calcWorkingDays(dateFrom, dateTo) {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  let cnt = 0
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) cnt++
  }
  return cnt
}

function calcCalendarDays(dateFrom, dateTo) {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  return Math.round((to - from) / 86400000) + 1
}

export default function Schedule() {
  const { state, dispatch } = useApp()
  const now = getCurrentPeriod()
  const [view, setView] = useState('month')
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [showModal, setShowModal] = useState(false)
  const [editAbsence, setEditAbsence] = useState(null)
  const [cardEmployee, setCardEmployee] = useState(null)
  const [form, setForm] = useState({
    employeeId: '', type: 'vacation', dateFrom: '', dateTo: '', comment: ''
  })

  const activeEmployees = useMemo(() =>
    state.employees
      .filter(e => e.status === 'active')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
    [state.employees]
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function isWeekend(day) {
    return [0, 6].includes(new Date(year, month - 1, day).getDay())
  }
  function isToday(day) {
    const t = new Date()
    return day === t.getDate() && month === t.getMonth() + 1 && year === t.getFullYear()
  }
  function isHoliday(day) {
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return ruHoliday(`${year}-${mm}-${dd}`, year)
  }

  // Absences overlapping current month — строковое сравнение (без timezone-бага)
  const monthAbsences = useMemo(() => {
    const mm = String(month).padStart(2, '0')
    const mStartStr = `${year}-${mm}-01`
    const mEndStr   = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`
    return state.absences.filter(a => a.dateFrom <= mEndStr && a.dateTo >= mStartStr)
  }, [state.absences, month, year, daysInMonth])

  // Map empId -> { day -> { type, id } } — строковое сравнение без timezone-бага
  function getAbsenceDayMap(empId) {
    const map = {}
    const mm = String(month).padStart(2, '0')
    monthAbsences.filter(a => a.employeeId === empId).forEach(a => {
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${mm}-${String(d).padStart(2, '0')}`
        if (dayStr >= a.dateFrom && dayStr <= a.dateTo) map[d] = { type: a.type, id: a.id }
      }
    })
    return map
  }

  // Yearly data: per employee, per month, absences by type
  const yearlyData = useMemo(() => {
    return activeEmployees.map(emp => {
      const byMonth = Array.from({ length: 12 }, (_, mi) => {
        const mm = String(mi + 1).padStart(2, '0')
        const mStartStr = `${year}-${mm}-01`
        const mEndStr   = `${year}-${mm}-${String(new Date(year, mi + 1, 0).getDate()).padStart(2, '0')}`
        const empAbs = state.absences.filter(a => {
          if (a.employeeId !== emp.id) return false
          return a.dateFrom <= mEndStr && a.dateTo >= mStartStr
        })
        const byType = {}
        empAbs.forEach(a => {
          const cFrom = a.dateFrom < mStartStr ? mStartStr : a.dateFrom
          const cTo   = a.dateTo   > mEndStr   ? mEndStr   : a.dateTo
          const d1 = new Date(cFrom + 'T00:00:00')
          const d2 = new Date(cTo   + 'T00:00:00')
          const cnt = Math.round((d2 - d1) / 86400000) + 1
          byType[a.type] = (byType[a.type] || 0) + cnt
        })
        return byType
      })
      const totalVacation = state.absences
        .filter(a => a.employeeId === emp.id && a.type === 'vacation')
        .filter(a => new Date(a.dateFrom).getFullYear() === year || new Date(a.dateTo).getFullYear() === year)
        .reduce((s, a) => s + (a.days != null ? a.days : calcCalendarDays(a.dateFrom, a.dateTo)), 0)
      const rate = getVacationAccrualRate(emp)
      const tracked = isVacationTracked(emp)
      const entitledDays = (tracked && rate != null) ? calcEntitledVacationDays(emp.hireDate, emp.dismissDate, year, rate) : null
      return { emp, byMonth, totalVacation, entitledDays, tracked }
    })
  }, [activeEmployees, state.absences, year])

  // Modal helpers
  function openAdd(empId = '') {
    const today = new Date().toISOString().slice(0, 10)
    setForm({ employeeId: empId || activeEmployees[0]?.id || '', type: 'vacation', dateFrom: today, dateTo: today, comment: '' })
    setEditAbsence(null)
    setShowModal(true)
  }
  function openEdit(a) {
    if (!a) return
    setForm({ employeeId: a.employeeId, type: a.type, dateFrom: a.dateFrom, dateTo: a.dateTo, comment: a.comment || '' })
    setEditAbsence(a)
    setShowModal(true)
  }
  function saveAbsence() {
    if (!form.employeeId || !form.dateFrom || !form.dateTo) return
    if (new Date(form.dateTo) < new Date(form.dateFrom)) return
    const days = calcWorkingDays(form.dateFrom, form.dateTo)
    const calDays = calcCalendarDays(form.dateFrom, form.dateTo)
    const payload = { ...form, days, calDays }
    if (editAbsence) {
      dispatch({ type: 'UPDATE_ABSENCE', payload: { ...editAbsence, ...payload } })
    } else {
      dispatch({ type: 'ADD_ABSENCE', payload })
    }
    setShowModal(false)
  }
  function deleteAbsence(id) {
    if (window.confirm('Удалить запись об отсутствии?')) {
      dispatch({ type: 'DELETE_ABSENCE', payload: id })
    }
  }
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  // Type summary for current month
  const typeCounts = useMemo(() => {
    const c = {}
    monthAbsences.forEach(a => { c[a.type] = (c[a.type] || 0) + 1 })
    return c
  }, [monthAbsences])

  const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">График работы</div>
          <div className="page-subtitle">Отпуска, больничные, отгулы, командировки</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 2 }}>
            {[['month', 'Месяц'], ['year', 'Год']].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', borderRadius: 6, padding: '4px 16px', fontSize: 12 }}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => openAdd()}>
            <Plus size={14} /> Добавить отсутствие
          </button>
        </div>
      </div>

      {/* Legend + counts */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(ABSENCE_TYPES).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: val.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{val.label}</span>
            {typeCounts[key] > 0 && (
              <span style={{ background: val.bg, color: val.color, borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>
                {typeCounts[key]}
              </span>
            )}
          </div>
        ))}
      </div>

      {view === 'month' ? (
        <>
          {/* Month navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
              {monthName(month)} {year}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
          </div>

          {/* Calendar grid */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
            {activeEmployees.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}><h3>Нет активных сотрудников</h3></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8f9fb' }}>
                      <th style={{
                        position: 'sticky', left: 0, zIndex: 3, background: '#f8f9fb',
                        padding: '8px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12,
                        borderRight: '2px solid var(--border)', minWidth: 170
                      }}>Сотрудник</th>
                      {days.map(d => {
                        const wk = isWeekend(d); const td = isToday(d); const hol = isHoliday(d)
                        return (
                          <th key={d} style={{
                            width: 26, minWidth: 26, textAlign: 'center', padding: '6px 1px',
                            fontWeight: td ? 800 : (wk || hol) ? 600 : 600,
                            color: td ? '#3b82f6' : (hol && !wk) ? '#dc2626' : wk ? '#ef4444' : 'var(--text-secondary)',
                            background: td ? '#dbeafe' : hol ? '#ffe4e4' : wk ? '#fff0f0' : '#f8f9fb',
                            borderRight: '1px solid #f0f0f0', fontSize: 10
                          }}>{d}</th>
                        )
                      })}
                      <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>Дней</th>
                    </tr>
                    <tr style={{ background: '#f8f9fb' }}>
                      <th style={{
                        position: 'sticky', left: 0, zIndex: 3, background: '#f8f9fb',
                        fontSize: 9, color: 'var(--text-muted)', padding: '2px 14px',
                        borderRight: '2px solid var(--border)', textAlign: 'left', fontWeight: 400
                      }}> </th>
                      {days.map(d => {
                        const wk = isWeekend(d); const hol = isHoliday(d)
                        const dow = new Date(year, month - 1, d).getDay()
                        return (
                          <th key={d} style={{
                            fontSize: 8, color: (wk || hol) ? '#dc2626' : 'var(--text-muted)',
                            padding: '1px', textAlign: 'center', fontWeight: hol ? 700 : 400,
                            borderRight: '1px solid #f0f0f0',
                            background: hol ? '#ffe4e4' : wk ? '#fff0f0' : undefined
                          }}>{hol && !wk ? 'П' : DOW_SHORT[dow]}</th>
                        )
                      })}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp, ri) => {
                      const dayMap = getAbsenceDayMap(emp.id)
                      const absDays = Object.keys(dayMap).length
                      return (
                        <tr key={emp.id} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{
                            position: 'sticky', left: 0, zIndex: 1,
                            background: ri % 2 === 0 ? 'white' : '#fafafa',
                            padding: '5px 14px', fontWeight: 600, fontSize: 12,
                            borderRight: '2px solid var(--border)', whiteSpace: 'nowrap'
                          }}>
                            <span onClick={() => setCardEmployee(emp)} style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline dotted' }} title="Открыть карточку">
                              {emp.fullName}
                            </span>
                            {emp.department && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{emp.department}</div>}
                          </td>
                          {days.map(d => {
                            const cell = dayMap[d]
                            const ti = cell ? ABSENCE_TYPES[cell.type] : null
                            const wk = isWeekend(d)
                            const td = isToday(d)
                            const hol = isHoliday(d)
                            return (
                              <td key={d} style={{
                                width: 26, textAlign: 'center', padding: '3px 1px',
                                background: ti ? ti.bg : td ? '#eff6ff' : hol ? '#ffe4e4' : wk ? '#fff8f8' : 'transparent',
                                borderRight: '1px solid #f0f0f0',
                                cursor: ti ? 'pointer' : 'default'
                              }}
                                onClick={() => ti && openEdit(monthAbsences.find(a => a.id === cell.id))}
                                title={ti ? `${ti.label} — нажмите чтобы изменить` : ''}
                              >
                                {ti && (
                                  <span style={{
                                    display: 'inline-block', width: 20, height: 16, borderRadius: 3,
                                    background: ti.color, color: 'white',
                                    fontSize: 7, fontWeight: 800, lineHeight: '16px', textAlign: 'center'
                                  }}>{ti.short}</span>
                                )}
                              </td>
                            )
                          })}
                          <td style={{
                            textAlign: 'center', fontWeight: 700, fontSize: 12, padding: '5px 8px',
                            color: absDays > 0 ? '#3b82f6' : 'var(--text-muted)'
                          }}>
                            {absDays > 0 ? absDays : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Records list */}
          {monthAbsences.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                Записи за {monthName(month)} {year}
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Тип</th>
                    <th>С</th>
                    <th>По</th>
                    <th style={{ textAlign: 'center' }}>Раб. дней</th>
                    <th style={{ textAlign: 'center' }}>Кал. дней</th>
                    <th>Комментарий</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...monthAbsences]
                    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
                    .map(a => {
                      const emp = state.employees.find(e => e.id === a.employeeId)
                      const ti = ABSENCE_TYPES[a.type] || ABSENCE_TYPES.other
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{emp?.fullName || '—'}</td>
                          <td>
                            <span style={{ background: ti.bg, color: ti.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                              {ti.label}
                            </span>
                          </td>
                          <td>{formatDate(a.dateFrom)}</td>
                          <td>{formatDate(a.dateTo)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#3b82f6' }}>
                            {a.days != null ? a.days : calcWorkingDays(a.dateFrom, a.dateTo)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {a.calDays != null ? a.calDays : calcCalendarDays(a.dateFrom, a.dateTo)}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.comment || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}><Edit2 size={12} /></button>
                              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteAbsence(a.id)}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <CalendarDays size={36} color="var(--text-muted)" />
              <h3>Нет отсутствий в {monthName(month)} {year}</h3>
              <p>Нажмите «Добавить отсутствие» чтобы внести отпуск, больничный или другое</p>
            </div>
          )}
        </>
      ) : (
        /* Yearly view */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 60, textAlign: 'center' }}>{year}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={14} /></button>
          </div>
          {activeEmployees.length === 0 ? (
            <div className="empty-state"><h3>Нет активных сотрудников</h3></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2, minWidth: 170 }}>Сотрудник</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} style={{ textAlign: 'center', fontSize: 11, minWidth: 56 }}>{monthShort(i + 1)}</th>
                      ))}
                      <th style={{ textAlign: 'center', minWidth: 70 }}>Отп. дн.</th>
                      <th style={{ textAlign: 'center', minWidth: 70 }}>Всего дн.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyData.map(({ emp, byMonth, totalVacation, entitledDays, tracked }) => {
                      const totalAll = byMonth.reduce((s, m) => s + Object.values(m).reduce((ss, v) => ss + v, 0), 0)
                      return (
                        <tr key={emp.id}>
                          <td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1, fontWeight: 600, borderRight: '1px solid var(--border)' }}>
                            <span onClick={() => setCardEmployee(emp)} style={{ cursor: 'pointer', color: 'var(--accent)', textDecoration: 'underline dotted' }} title="Открыть карточку">
                              {emp.fullName}
                            </span>
                            {emp.department && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{emp.department}</div>}
                          </td>
                          {byMonth.map((typeMap, mi) => {
                            const total = Object.values(typeMap).reduce((s, v) => s + v, 0)
                            if (total === 0) return <td key={mi} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>—</td>
                            return (
                              <td key={mi} style={{ textAlign: 'center', padding: '4px 3px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                  {Object.entries(typeMap).map(([type, cnt]) => {
                                    const ti = ABSENCE_TYPES[type] || ABSENCE_TYPES.other
                                    return (
                                      <span key={type} style={{
                                        background: ti.bg, color: ti.color,
                                        borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700
                                      }}>
                                        {ti.short}&nbsp;{cnt}
                                      </span>
                                    )
                                  })}
                                </div>
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontSize: 12 }}>
                            {!tracked ? (
                              <div style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>не учит.</div>
                            ) : (
                              <>
                                <div style={{ fontWeight: 700, color: totalVacation > entitledDays ? '#dc2626' : totalVacation > 0 ? '#059669' : 'var(--text-muted)' }}>
                                  {totalVacation > 0 ? totalVacation : '—'}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>из {entitledDays}</div>
                              </>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: totalAll > 0 ? '#3b82f6' : 'var(--text-muted)', fontSize: 13 }}>
                            {totalAll > 0 ? totalAll : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', background: '#f8f9fb', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                Числа — рабочие дни отсутствия · ОТ отпуск · БЛ больничный · ОГ отгул · КМ командировка · БЗ за свой счёт · ПР прочее
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{editAbsence ? 'Изменить запись' : 'Добавить отсутствие'}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Сотрудник</label>
                <select className="input" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Тип отсутствия</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(ABSENCE_TYPES).map(([key, val]) => (
                    <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))}
                      style={{
                        border: `2px solid ${form.type === key ? val.color : '#e5e7eb'}`,
                        background: form.type === key ? val.bg : 'white',
                        color: form.type === key ? val.color : 'var(--text-secondary)',
                        borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600
                      }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>С (включительно)</label>
                  <input type="date" className="input" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>По (включительно)</label>
                  <input type="date" className="input" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              {form.dateFrom && form.dateTo && new Date(form.dateTo) >= new Date(form.dateFrom) && (
                <div style={{ display: 'flex', gap: 20, background: '#f0f9ff', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <span>📅 Кал. дней: <strong>{calcCalendarDays(form.dateFrom, form.dateTo)}</strong></span>
                  <span>💼 Раб. дней: <strong>{calcWorkingDays(form.dateFrom, form.dateTo)}</strong></span>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Комментарий</label>
                <input type="text" className="input" placeholder="Необязательно..." value={form.comment}
                  onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Отмена</button>
              <button className="btn btn-primary" disabled={!form.employeeId || !form.dateFrom || !form.dateTo} onClick={saveAbsence}>
                {editAbsence ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
