import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Calendar } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { DEFAULT_PROD_CALENDAR } from '../context/AppContext'
import { monthName, formatMoney } from '../utils/helpers'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

// Подсчитать рабочие дни с даты приёма до конца месяца (пн-пт)
export function calcWorkedDays(hireDate, month, year) {
  const hire = new Date(hireDate)
  if (hire.getFullYear() !== year || hire.getMonth() + 1 !== month) return null
  const lastDay = new Date(year, month, 0).getDate()
  let worked = 0
  for (let d = hire.getDate(); d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) worked++
  }
  return worked
}

// Подсчитать рабочие дни с начала месяца до даты увольнения включительно (пн-пт)
export function calcWorkedDaysUntilDismiss(dismissDate, month, year) {
  const dismiss = new Date(dismissDate)
  if (dismiss.getFullYear() !== year || dismiss.getMonth() + 1 !== month) return null
  let worked = 0
  for (let d = 1; d <= dismiss.getDate(); d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) worked++
  }
  return worked
}

// Рассчитать оклад пропорционально отработанным дням
export function calcProRatedSalary(salary, totalWorkingDays, workedDays) {
  if (!totalWorkingDays || !workedDays) return salary
  return Math.round((salary / totalWorkingDays) * workedDays)
}

export default function ProductionCalendar() {
  const { state, dispatch } = useApp()
  const [year, setYear] = useState(new Date().getFullYear())

  const cal = state.productionCalendar || {}
  const yearData = cal[year] || {}

  function setWorkingDays(month, val) {
    const v = Math.max(0, Math.min(31, parseInt(val) || 0))
    dispatch({ type: 'UPDATE_PROD_CALENDAR', payload: { year, month, workingDays: v } })
  }

  function resetYear() {
    if (DEFAULT_PROD_CALENDAR[year]) {
      dispatch({ type: 'RESET_PROD_CALENDAR_YEAR', payload: year })
    } else {
      alert(`Нет стандартных данных для ${year} года. Введите вручную.`)
    }
  }

  const totalWorkingDays = MONTHS.reduce((s, m) => s + (yearData[m] || 0), 0)

  // Сотрудники, принятые в этом году
  const newHires = state.employees.filter(e => {
    if (!e.hireDate) return false
    return new Date(e.hireDate).getFullYear() === year
  })

  // Сотрудники, уволенные в этом году
  const dismissed = state.employees.filter(e => {
    if (!e.dismissDate) return false
    return new Date(e.dismissDate).getFullYear() === year
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Производственный календарь</div>
          <div className="page-subtitle">Рабочие дни по месяцам · используется для расчёта оклада</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={14} /></button>
          <span style={{ fontWeight: 700, fontSize: 16, minWidth: 50, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={14} /></button>
          <button className="btn btn-secondary" onClick={resetYear} title="Сбросить к стандартным значениям РФ">
            <RotateCcw size={14} /> Сброс к РФ
          </button>
        </div>
      </div>

      {/* Пояснение */}
      <div style={{ padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>Как использовать:</strong> укажите количество рабочих дней в каждом месяце. В разделе «Начисление»
        при добавлении сотрудника, принятого в середине месяца, появится кнопка <strong>«Рассчитать по кал.»</strong> —
        она автоматически пересчитает оклад пропорционально отработанным дням.
      </div>

      {/* Таблица месяцев */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th>Месяц</th>
              <th style={{ textAlign: 'center' }}>Рабочих дней</th>
              <th style={{ textAlign: 'center' }}>Календарных дней</th>
              <th style={{ textAlign: 'center' }}>Выходных и праздников</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map(m => {
              const calDays = new Date(year, m, 0).getDate()
              const workDays = yearData[m] ?? (DEFAULT_PROD_CALENDAR[year]?.[m] || 0)
              const offDays = calDays - workDays
              const isCurrentMonth = m === new Date().getMonth() + 1 && year === new Date().getFullYear()
              const isDefault = workDays === (DEFAULT_PROD_CALENDAR[year]?.[m])
              return (
                <tr key={m} style={{ background: isCurrentMonth ? '#fafbff' : undefined }}>
                  <td style={{ fontWeight: isCurrentMonth ? 700 : 400 }}>
                    {monthName(m)}
                    {isCurrentMonth && <span style={{ marginLeft: 6, fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>● текущий</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={0} max={31}
                        value={workDays}
                        onChange={e => setWorkingDays(m, e.target.value)}
                        style={{
                          width: 60, textAlign: 'center', fontWeight: 700, fontSize: 15,
                          border: `2px solid ${isDefault ? '#e5e7eb' : '#3b82f6'}`,
                          borderRadius: 6, padding: '4px 6px', outline: 'none',
                          color: isDefault ? 'var(--text-primary)' : '#1d4ed8',
                          background: isDefault ? 'white' : '#eff6ff'
                        }}
                      />
                      {!isDefault && (
                        <button
                          onClick={() => setWorkingDays(m, DEFAULT_PROD_CALENDAR[year]?.[m] || workDays)}
                          title="Сбросить к значению РФ"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11 }}
                        >↩</button>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{calDays}</td>
                  <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{offDays}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {m === 1 && 'Новогодние праздники 1–8 янв'}
                    {m === 2 && 'День защитника Отечества 23 февр'}
                    {m === 3 && 'Международный женский день 8 марта'}
                    {m === 5 && 'Праздник весны 1 мая, День победы 9 мая'}
                    {m === 6 && 'День России 12 июня'}
                    {m === 11 && 'День народного единства 4 ноября'}
                    {m === 12 && 'Новогодние праздники 31 дек'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="table-footer">
              <td><strong>Итого за {year}</strong></td>
              <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: '#1d4ed8' }}>{totalWorkingDays}</td>
              <td style={{ textAlign: 'center' }}>{[...Array(12)].reduce((s, _, i) => s + new Date(year, i + 1, 0).getDate(), 0)}</td>
              <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>
                {[...Array(12)].reduce((s, _, i) => s + new Date(year, i + 1, 0).getDate(), 0) - totalWorkingDays}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Новые сотрудники этого года */}
      {newHires.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            <Calendar size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Сотрудники, принятые в {year} году — расчёт оклада за неполный месяц
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата приёма</th>
                <th>Оклад (полный)</th>
                <th>Месяц приёма</th>
                <th>Раб. дней в месяце</th>
                <th>Отработано дней</th>
                <th>Расчётный оклад</th>
              </tr>
            </thead>
            <tbody>
              {newHires.map(emp => {
                const hire = new Date(emp.hireDate)
                const hireMonth = hire.getMonth() + 1
                const totalWD = yearData[hireMonth] ?? (DEFAULT_PROD_CALENDAR[year]?.[hireMonth] || 0)
                const workedDays = calcWorkedDays(emp.hireDate, hireMonth, year)
                const proRated = calcProRatedSalary(emp.salary || 0, totalWD, workedDays)
                const isFullMonth = workedDays === totalWD
                return (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.fullName}</td>
                    <td>{hire.toLocaleDateString('ru-RU')}</td>
                    <td className="money">{formatMoney(emp.salary)}</td>
                    <td>{monthName(hireMonth)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{totalWD || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: isFullMonth ? '#059669' : '#d97706' }}>
                      {workedDays}
                      {isFullMonth && <span style={{ fontSize: 10, marginLeft: 4 }}>полный</span>}
                    </td>
                    <td className="money" style={{ fontWeight: 700, color: isFullMonth ? 'var(--text-primary)' : '#1d4ed8' }}>
                      {isFullMonth ? formatMoney(emp.salary) : formatMoney(proRated)}
                      {!isFullMonth && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                          {formatMoney(emp.salary)} / {totalWD} × {workedDays}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Уволенные сотрудники этого года */}
      {dismissed.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#dc2626' }}>
            <Calendar size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Сотрудники, уволенные в {year} году — расчёт оклада за неполный месяц
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата увольнения</th>
                <th>Оклад (полный)</th>
                <th>Месяц увольнения</th>
                <th>Раб. дней в месяце</th>
                <th>Отработано дней</th>
                <th>Расчётный оклад</th>
              </tr>
            </thead>
            <tbody>
              {dismissed.map(emp => {
                const dismiss = new Date(emp.dismissDate)
                const dismissMonth = dismiss.getMonth() + 1
                const totalWD = yearData[dismissMonth] ?? (DEFAULT_PROD_CALENDAR[year]?.[dismissMonth] || 0)
                const workedDays = calcWorkedDaysUntilDismiss(emp.dismissDate, dismissMonth, year)
                const proRated = calcProRatedSalary(emp.salary || 0, totalWD, workedDays)
                const isFullMonth = workedDays === totalWD
                return (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.fullName}</td>
                    <td>{dismiss.toLocaleDateString('ru-RU')}</td>
                    <td className="money">{formatMoney(emp.salary)}</td>
                    <td>{monthName(dismissMonth)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{totalWD || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: isFullMonth ? '#059669' : '#dc2626' }}>
                      {workedDays}
                      {isFullMonth && <span style={{ fontSize: 10, marginLeft: 4 }}>полный</span>}
                    </td>
                    <td className="money" style={{ fontWeight: 700, color: isFullMonth ? 'var(--text-primary)' : '#c2410c' }}>
                      {isFullMonth ? formatMoney(emp.salary) : formatMoney(proRated)}
                      {!isFullMonth && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                          {formatMoney(emp.salary)} / {totalWD} × {workedDays}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
