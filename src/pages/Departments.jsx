import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Building2, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, getCurrentPeriod, monthName } from '../utils/helpers'

export default function Departments() {
  const { state, dispatch } = useApp()
  const [newDept, setNewDept] = useState('')
  const [newMgr, setNewMgr] = useState('')
  const now = getCurrentPeriod()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build department stats
  const deptStats = useMemo(() => {
    const allDepts = [...new Set([
      ...state.departments.map(d => d.name),
      ...state.employees.map(e => e.department).filter(Boolean)
    ])]

    return allDepts.map(dept => {
      const employees = state.employees.filter(e => e.department === dept && e.status === 'active')
      const payrolls = state.payrolls.filter(p =>
        p.department === dept && p.month === month && p.year === year
      )
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      const remaining = payrolls.reduce((s, p) => s + (p.remaining || 0), 0)
      return { dept, employeeCount: employees.length, payrollCount: payrolls.length, fot, remaining }
    }).sort((a, b) => b.fot - a.fot)
  }, [state, month, year])

  // Build manager stats
  const mgrStats = useMemo(() => {
    const allMgrs = [...new Set([
      ...state.managers.map(m => m.name),
      ...state.employees.map(e => e.manager).filter(Boolean)
    ])]

    return allMgrs.map(mgr => {
      const subordinates = state.employees.filter(e => e.manager === mgr && e.status === 'active')
      const payrolls = state.payrolls.filter(p =>
        p.manager === mgr && p.month === month && p.year === year
      )
      const fot = payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0)
      return { mgr, subordinateCount: subordinates.length, fot }
    }).sort((a, b) => b.fot - a.fot)
  }, [state, month, year])

  function addDept() {
    if (!newDept.trim()) return
    dispatch({ type: 'ADD_DEPARTMENT', payload: newDept.trim() })
    setNewDept('')
  }

  function addMgr() {
    if (!newMgr.trim()) return
    dispatch({ type: 'ADD_MANAGER', payload: newMgr.trim() })
    setNewMgr('')
  }

  const totalFOT = deptStats.reduce((s, d) => s + d.fot, 0)
  const totalActive = state.employees.filter(e => e.status === 'active').length

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Отделы и руководители</div>
          <div className="page-subtitle">{monthName(month)} {year} · ФОТ: {formatMoney(totalFOT)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={prevMonth}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 110, textAlign: 'center' }}>
            {monthName(month)} {year}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={nextMonth}
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Departments */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={16} /> Отделы
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input input-sm"
                placeholder="Название отдела"
                value={newDept}
                onChange={e => setNewDept(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDept()}
                style={{ width: 150 }}
              />
              <button className="btn btn-primary btn-sm" onClick={addDept}><Plus size={13} /></button>
            </div>
          </div>

          {deptStats.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>Нет отделов</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deptStats.map(d => (
                <div key={d.dept} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.dept}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {d.employeeCount} сотр. · {d.payrollCount} начислений
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="money" style={{ fontWeight: 700, fontSize: 14 }}>{formatMoney(d.fot)}</div>
                      {totalFOT > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {((d.fot / totalFOT) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  {totalFOT > 0 && (
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div className="progress-fill" style={{
                        width: `${(d.fot / totalFOT) * 100}%`,
                        background: 'var(--accent)'
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Managers */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={16} /> Руководители
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input input-sm"
                placeholder="ФИО руководителя"
                value={newMgr}
                onChange={e => setNewMgr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMgr()}
                style={{ width: 160 }}
              />
              <button className="btn btn-primary btn-sm" onClick={addMgr}><Plus size={13} /></button>
            </div>
          </div>

          {mgrStats.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <p>Нет руководителей</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mgrStats.map(m => (
                <div key={m.mgr} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.mgr}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Подчинённых: {m.subordinateCount}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="money" style={{ fontWeight: 700, fontSize: 14 }}>{formatMoney(m.fot)}</div>
                      {totalFOT > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {((m.fot / totalFOT) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  {totalFOT > 0 && (
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div className="progress-fill" style={{
                        width: `${(m.fot / totalFOT) * 100}%`,
                        background: '#7c3aed'
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Employees by department table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
          Сотрудники по отделам
        </div>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Отдел</th>
                <th>ФИО</th>
                <th>Должность</th>
                <th>Руководитель</th>
                <th>Оклад</th>
                <th>ФОТ (мес.)</th>
              </tr>
            </thead>
            <tbody>
              {deptStats.map(d => {
                const employees = state.employees.filter(e => e.department === d.dept && e.status === 'active')
                return employees.map((e, i) => {
                  const payroll = state.payrolls.find(p => p.employeeId === e.id && p.month === month && p.year === year)
                  return (
                    <tr key={e.id}>
                      {i === 0 && (
                        <td rowSpan={employees.length} style={{ fontWeight: 700, background: '#fafbfc', borderRight: '1px solid var(--border)', verticalAlign: 'top' }}>
                          {d.dept}
                        </td>
                      )}
                      <td>{e.fullName}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{e.position || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{e.manager || '—'}</td>
                      <td className="money">{formatMoney(e.salary)}</td>
                      <td className="money" style={{ fontWeight: 600 }}>{payroll ? formatMoney(payroll.totalEarned) : '—'}</td>
                    </tr>
                  )
                })
              })}
              {totalActive === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Нет сотрудников</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
