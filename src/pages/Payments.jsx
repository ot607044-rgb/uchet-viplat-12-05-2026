import React, { useState, useMemo, useRef, useCallback } from 'react'
import { CheckCircle, Circle, ChevronLeft, ChevronRight, CreditCard, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, monthName, getCurrentPeriod, formatDate, getEmpPaymentSettings } from '../utils/helpers'

export default function Payments() {
  const { state, dispatch } = useApp()
  const now = getCurrentPeriod()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [tab, setTab] = useState('advance') // 'advance' | 'salary' | 'all'
  const [advSort, setAdvSort] = useState({ field: null, dir: 'asc' })
  const [salSort, setSalSort] = useState({ field: null, dir: 'asc' })
  const [allSort, setAllSort] = useState({ field: null, dir: 'asc' })

  // Sync horizontal scrollbars (top mirror ↔ bottom table)
  const advTopRef = useRef(null); const advBotRef = useRef(null)
  const salTopRef = useRef(null); const salBotRef = useRef(null)
  const allTopRef = useRef(null); const allBotRef = useRef(null)
  const mkSync = (srcRef, dstRef) => () => { if (dstRef.current) dstRef.current.scrollLeft = srcRef.current.scrollLeft }
  const syncAdvTop = useCallback(mkSync(advTopRef, advBotRef), [])
  const syncAdvBot = useCallback(mkSync(advBotRef, advTopRef), [])
  const syncSalTop = useCallback(mkSync(salTopRef, salBotRef), [])
  const syncSalBot = useCallback(mkSync(salBotRef, salTopRef), [])
  const syncAllTop = useCallback(mkSync(allTopRef, allBotRef), [])
  const syncAllBot = useCallback(mkSync(allBotRef, allTopRef), [])

  const payrolls = useMemo(() =>
    state.payrolls
      .filter(p => p.month === month && p.year === year)
      .map(p => {
        const emp = state.employees.find(e => e.id === p.employeeId)
        const ps = getEmpPaymentSettings(emp, state.settings)
        return {
          ...p,
          empName: emp?.fullName || '—',
          department: p.department || emp?.department || '',
          manager: p.manager || emp?.manager || '',
          workFormat: emp?.workFormat || 'офис',
          ps
        }
      })
      .sort((a, b) => a.empName.localeCompare(b.empName, 'ru')),
    [state.payrolls, state.employees, state.settings, month, year]
  )

  // Remaining salary breakdown by work format (only unpaid)
  const remainingByFormat = useMemo(() => {
    const formats = ['офис', 'удалённо', 'гибрид']
    return formats.map(fmt => {
      const rows = payrolls.filter(p => p.workFormat === fmt && p.salaryStatus !== 'paid')
      const total = rows.reduce((s, p) => s + (p.remaining || 0), 0)
      const count = rows.length
      return { fmt, total, count }
    }).filter(f => f.count > 0 || payrolls.some(p => p.workFormat === f.fmt))
  }, [payrolls])

  function setStatus(id, field, val) {
    dispatch({ type: 'UPDATE_PAYROLL_FIELD', payload: { id, field, value: val } })
  }

  function markAll(field, value) {
    const rows = field === 'advanceStatus' ? payrollsForAdvance : payrolls
    rows.forEach(p => {
      dispatch({ type: 'UPDATE_PAYROLL_FIELD', payload: { id: p.id, field, value } })
    })
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  // Only employees who actually have advance (excludes single_payment scheme)
  const payrollsForAdvance = payrolls.filter(p => p.ps.paymentScheme !== 'single_payment')
  const payrollsWithAdvance = payrollsForAdvance.filter(p => p.ps.hasAdvance)
  const advancePaid = payrollsWithAdvance.filter(p => p.advanceStatus === 'paid')
  const salaryPaid = payrolls.filter(p => p.salaryStatus === 'paid')
  // Используем totalAdvance если задан, иначе fallback на official+unofficial
  const getAdvanceAmt = p => p.totalAdvance != null ? (p.totalAdvance || 0) : ((p.officialAdvance || 0) + (p.unofficialAdvance || 0))
  const totalAdvances = payrollsWithAdvance.reduce((s, p) => s + getAdvanceAmt(p), 0)
  const totalSalary = payrolls.reduce((s, p) => s + (p.salaryStatus === 'paid' ? 0 : (p.remaining || 0)), 0)
  const totalAdvancesPaid = advancePaid.reduce((s, p) => s + getAdvanceAmt(p), 0)
  const totalSalaryPaid = salaryPaid.reduce((s, p) => s + (p.remaining || 0), 0)

  const { advanceDay, salaryDay } = state.settings || {}

  function overallStatus(p) {
    const hasAdv = p.ps.hasAdvance
    if (hasAdv) {
      if (p.advanceStatus === 'paid' && p.salaryStatus === 'paid') return 'paid'
      if (p.advanceStatus === 'unpaid' && p.salaryStatus === 'unpaid') return 'unpaid'
      return 'partial'
    }
    return p.salaryStatus || 'unpaid'
  }

  const SCHEME_LABELS = {
    advance_and_salary: 'Аванс + зарплата',
    single_payment: 'Одним платежом',
    custom: 'Индивидуальная'
  }

  const FORMAT_ORDER = { 'офис': 0, 'гибрид': 1, 'удалённо': 2 }
  const STATUS_ORDER = { 'unpaid': 0, 'partial': 1, 'paid': 2 }

  function applySort(rows, { field, dir }, getAmount, getStatus) {
    if (!field) return rows
    const mul = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (field === 'format') return mul * ((FORMAT_ORDER[a.workFormat] ?? 99) - (FORMAT_ORDER[b.workFormat] ?? 99))
      if (field === 'amount') return mul * ((getAmount(a) || 0) - (getAmount(b) || 0))
      if (field === 'status') return mul * ((STATUS_ORDER[getStatus(a)] ?? 0) - (STATUS_ORDER[getStatus(b)] ?? 0))
      return 0
    })
  }

  function toggleSort(current, setter, field) {
    setter(prev => prev.field === field
      ? prev.dir === 'asc' ? { field, dir: 'desc' } : { field: null, dir: 'asc' }
      : { field, dir: 'asc' }
    )
  }

  const sortedAdvance = useMemo(
    () => applySort(payrollsForAdvance, advSort, p => getAdvanceAmt(p), p => p.advanceStatus || 'unpaid'),
    [payrollsForAdvance, advSort]
  )
  const sortedSalary = useMemo(
    () => applySort(payrolls, salSort, p => p.remaining || 0, p => p.salaryStatus || 'unpaid'),
    [payrolls, salSort]
  )
  const sortedAll = useMemo(
    () => applySort(payrolls, allSort, p => p.remaining || 0, p => overallStatus(p)),
    [payrolls, allSort]
  )

  function SortTh({ label, field, sort, onToggle, style }) {
    const active = sort.field === field
    return (
      <th onClick={() => onToggle(field)} style={{
        background: 'var(--surface, #fff)', cursor: 'pointer', userSelect: 'none',
        color: active ? 'var(--primary, #3b82f6)' : undefined,
        borderBottom: active ? '2px solid var(--primary, #3b82f6)' : undefined,
        whiteSpace: 'nowrap', ...style
      }}>
        {label} {active ? (sort.dir === 'asc' ? '▲' : '▼') : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>⇅</span>}
      </th>
    )
  }

  function StatusButtons({ status, onSet }) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {['unpaid', 'partial', 'paid'].map(s => {
          const labels = { unpaid: 'Не выплачено', partial: 'Частично', paid: 'Выплачено' }
          return (
            <button key={s} onClick={() => onSet(s)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 20, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                background: status === s ? (s === 'paid' ? '#059669' : s === 'partial' ? '#d97706' : '#dc2626') : '#f3f4f6',
                color: status === s ? 'white' : 'var(--text-muted)', transition: 'all 0.1s'
              }}>
              {labels[s]}
            </button>
          )
        })}
      </div>
    )
  }

  const PaymentRow = ({ p, type }) => {
    const isAdvance = type === 'advance'
    const noAdvance = !p.ps.hasAdvance
    const status = isAdvance ? p.advanceStatus : p.salaryStatus
    const amount = isAdvance ? getAdvanceAmt(p) : (p.remaining || 0)
    const statusField = isAdvance ? 'advanceStatus' : 'salaryStatus'

    if (isAdvance && noAdvance) {
      return (
        <tr style={{ background: '#f9fafb' }}>
          <td style={{ fontWeight: 600 }}>{p.empName}</td>
          <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.department}</td>
          <td style={{ fontSize: 11 }}>
            {p.workFormat === 'удалённо' ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>🏠 Удалённо</span>
              : p.workFormat === 'гибрид' ? <span style={{ color: '#0891b2', fontWeight: 600 }}>🔄 Гибрид</span>
              : <span style={{ color: '#3b82f6', fontWeight: 600 }}>🏢 Офис</span>}
          </td>
          <td colSpan={4} style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Аванс не предусмотрен</td>
          <td /><td />
        </tr>
      )
    }

    return (
      <tr>
        <td style={{ fontWeight: 600 }}>{p.empName}</td>
        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.department}</td>
        {isAdvance && (
          <>
            <td style={{ fontSize: 11 }}>
              {p.workFormat === 'удалённо' ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>🏠 Удалённо</span>
                : p.workFormat === 'гибрид' ? <span style={{ color: '#0891b2', fontWeight: 600 }}>🔄 Гибрид</span>
                : <span style={{ color: '#3b82f6', fontWeight: 600 }}>🏢 Офис</span>}
            </td>
            <td className="money" style={{ fontWeight: 700 }}>{getAdvanceAmt(p) > 0 ? formatMoney(getAdvanceAmt(p)) : '—'}</td>
            <td className="money">{p.officialAdvance > 0 ? formatMoney(p.officialAdvance) : '—'}</td>
            <td className="money">{p.unofficialAdvance > 0 ? formatMoney(p.unofficialAdvance) : '—'}</td>
            <td className="money">{p.salaryOnAccount > 0 ? formatMoney(p.salaryOnAccount) : '—'}</td>
            <td style={{ textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>{p.ps.advanceDay}-е</td>
          </>
        )}
        {!isAdvance && (
          <>
            <td style={{ fontSize: 11 }}>
              {p.workFormat === 'удалённо'
                ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>🏠 Удалённо</span>
                : p.workFormat === 'гибрид'
                ? <span style={{ color: '#0891b2', fontWeight: 600 }}>🔄 Гибрид</span>
                : <span style={{ color: '#3b82f6', fontWeight: 600 }}>🏢 Офис</span>
              }
            </td>
            <td className="money">{formatMoney(p.totalEarned)}</td>
            <td className="money" style={{ color: p.salaryStatus === 'paid' ? '#059669' : 'var(--danger)', fontWeight: p.salaryStatus === 'paid' ? 700 : 400 }}>
              {p.salaryStatus === 'paid'
                ? formatMoney((p.totalDeducted || 0) + (p.remaining || 0))
                : (p.totalDeducted > 0 ? formatMoney(p.totalDeducted) : '—')}
            </td>
            <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{SCHEME_LABELS[p.ps.paymentScheme] || '—'}</td>
            <td style={{ textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>{p.ps.salaryDay}-е</td>
          </>
        )}
        <td className="money" style={{ fontWeight: 700, fontSize: 14 }}>
          {isAdvance
            ? (p.advanceStatus === 'paid'
                ? <span style={{ color: '#059669', fontSize: 12 }}>✓ выплачено</span>
                : (amount > 0 ? formatMoney(amount) : '—'))
            : (p.salaryStatus === 'paid' ? <span style={{ color: '#059669', fontSize: 12 }}>✓ выплачено</span> : (amount > 0 ? formatMoney(amount) : '—'))
          }
        </td>
        <td>
          <StatusButtons status={status} onSet={s => setStatus(p.id, statusField, s)} />
        </td>
      </tr>
    )
  }

  // Dual-scroll wrapper: synced top + bottom horizontal scrollbars, sticky thead
  const DualScrollTable = ({ topRef, botRef, onScrollTop, onScrollBot, minWidth = 0, children }) => (
    <div>
      <div ref={topRef} onScroll={onScrollTop}
        style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
        <div style={{ height: 10, minWidth: minWidth || '100%' }} />
      </div>
      <div ref={botRef} onScroll={onScrollBot}
        style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', borderRadius: 8, border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
          <div>
            <div className="page-title">{monthName(month)} {year}</div>
            <div className="page-subtitle">Аванс {advanceDay}-го · Зарплата {salaryDay}-го</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Авансы</div>
              <div className="stat-value">{formatMoney(totalAdvances)}</div>
              <div className="stat-sub">Выплачено {advancePaid.length}/{payrolls.length} · {formatMoney(totalAdvancesPaid)}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: 20 }}>
              {advanceDay} число
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: payrolls.length > 0 ? `${(advancePaid.length / payrolls.length) * 100}%` : '0%', background: '#059669' }} />
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label">Зарплата (остаток к выплате)</div>
              <div className="stat-value">{formatMoney(totalSalary)}</div>
              <div className="stat-sub">Выплачено {salaryPaid.length}/{payrolls.length} · {formatMoney(totalSalaryPaid)}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>
              {salaryDay} число
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: payrolls.length > 0 ? `${(salaryPaid.length / payrolls.length) * 100}%` : '0%', background: '#3b82f6' }} />
          </div>
        </div>
      </div>

      {/* Remaining salary by work format */}
      {payrolls.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Остаток зарплаты по формату работы (не выплачено)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { fmt: 'офис', label: 'Офис', color: '#3b82f6', bg: '#eff6ff', emoji: '🏢' },
              { fmt: 'удалённо', label: 'Удалённо', color: '#7c3aed', bg: '#f5f3ff', emoji: '🏠' },
              { fmt: 'гибрид', label: 'Гибрид', color: '#0891b2', bg: '#ecfeff', emoji: '🔄' },
            ].map(({ fmt, label, color, bg, emoji }) => {
              const data = remainingByFormat.find(r => r.fmt === fmt) || { total: 0, count: 0 }
              const allInFormat = payrolls.filter(p => p.workFormat === fmt)
              const paidInFormat = allInFormat.filter(p => p.salaryStatus === 'paid').length
              return (
                <div key={fmt} className="card" style={{ borderLeft: `4px solid ${color}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>
                      {emoji} {label}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 20 }}>
                      {allInFormat.length} чел.
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: data.total > 0 ? color : '#059669' }}>
                    {data.total > 0 ? formatMoney(data.total) : '✓ всё выплачено'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {data.count > 0
                      ? `Не выплачено: ${data.count} из ${allInFormat.length}`
                      : `Выплачено: ${paidInFormat} из ${allInFormat.length}`
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'advance' ? 'active' : ''}`} onClick={() => setTab('advance')}>
          Авансы ({payrollsWithAdvance.filter(p => p.advanceStatus !== 'paid').length} не выплачено)
        </button>
        <button className={`tab-btn ${tab === 'salary' ? 'active' : ''}`} onClick={() => setTab('salary')}>
          Зарплата ({payrolls.filter(p => p.salaryStatus !== 'paid').length} не выплачено)
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          Сводная таблица
        </button>
      </div>

      {payrolls.length === 0 ? (
        <div className="empty-state">
          <h3>Нет данных за {monthName(month)} {year}</h3>
          <p>Сначала заполните начисления в разделе «Начисление зарплаты»</p>
        </div>
      ) : tab === 'advance' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('advanceStatus', 'paid')}>
              Отметить всё выплаченным
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('advanceStatus', 'unpaid')}>
              Сбросить
            </button>
          </div>
          <DualScrollTable topRef={advTopRef} botRef={advBotRef} onScrollTop={syncAdvTop} onScrollBot={syncAdvBot}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                <tr>
                  <th style={{ background: 'var(--surface, #fff)' }}>ФИО</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Отдел</th>
                  <SortTh label="Формат" field="format" sort={advSort} onToggle={f => toggleSort(advSort, setAdvSort, f)} />
                  <th style={{ background: 'var(--surface, #fff)' }}>Итог. аванс</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Офиц. аванс</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Второй аванс</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>В счёт з/п</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>День аванса</th>
                  <SortTh label="Итого к выплате" field="amount" sort={advSort} onToggle={f => toggleSort(advSort, setAdvSort, f)} />
                  <SortTh label="Статус" field="status" sort={advSort} onToggle={f => toggleSort(advSort, setAdvSort, f)} />
                </tr>
              </thead>
              <tbody>
                {sortedAdvance.map(p => <PaymentRow key={p.id} p={p} type="advance" />)}
              </tbody>
              <tfoot>
                <tr className="table-footer">
                  <td colSpan={2}>Итого ({payrollsForAdvance.length})</td>
                  <td />
                  <td className="money" style={{ fontWeight: 700 }}>{formatMoney(totalAdvances)}</td>
                  <td className="money">{formatMoney(payrollsForAdvance.reduce((s, p) => s + (p.officialAdvance || 0), 0))}</td>
                  <td className="money">{formatMoney(payrollsForAdvance.reduce((s, p) => s + (p.unofficialAdvance || 0), 0))}</td>
                  <td className="money">{formatMoney(payrollsForAdvance.reduce((s, p) => s + (p.salaryOnAccount || 0), 0))}</td>
                  <td />
                  <td className="money">{formatMoney(totalAdvances)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </DualScrollTable>
        </div>
      ) : tab === 'salary' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('salaryStatus', 'paid')}>Отметить всё выплаченным</button>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('salaryStatus', 'unpaid')}>Сбросить</button>
          </div>
          <DualScrollTable topRef={salTopRef} botRef={salBotRef} onScrollTop={syncSalTop} onScrollBot={syncSalBot}>
            <table className="table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                <tr>
                  <th style={{ background: 'var(--surface, #fff)' }}>ФИО</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Отдел</th>
                  <SortTh label="Формат" field="format" sort={salSort} onToggle={f => toggleSort(salSort, setSalSort, f)} />
                  <th style={{ background: 'var(--surface, #fff)' }}>Начислено</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Итого выдано</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>Схема</th>
                  <th style={{ background: 'var(--surface, #fff)' }}>День з/п</th>
                  <SortTh label="Остаток к выплате" field="amount" sort={salSort} onToggle={f => toggleSort(salSort, setSalSort, f)} />
                  <SortTh label="Статус" field="status" sort={salSort} onToggle={f => toggleSort(salSort, setSalSort, f)} />
                </tr>
              </thead>
              <tbody>
                {sortedSalary.map(p => (
                  <PaymentRow key={p.id} p={p} type="salary" />
                ))}
              </tbody>
              <tfoot>
                <tr className="table-footer">
                  <td colSpan={3}>Итого</td>
                  <td className="money">{formatMoney(payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0))}</td>
                  <td className="money">{formatMoney(payrolls.reduce((s, p) =>
                    s + (p.salaryStatus === 'paid'
                      ? (p.totalDeducted || 0) + (p.remaining || 0)
                      : (p.totalDeducted || 0)), 0))}</td>
                  <td colSpan={2} />
                  <td className="money">{formatMoney(payrolls.filter(p => p.salaryStatus !== 'paid').reduce((s, p) => s + (p.remaining || 0), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </DualScrollTable>
        </div>
      ) : (
        /* Сводная таблица */
        <DualScrollTable topRef={allTopRef} botRef={allBotRef} onScrollTop={syncAllTop} onScrollBot={syncAllBot} minWidth={1200}>
          <table className="table" style={{ minWidth: 1200, fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                <th style={{ background: 'var(--surface, #fff)' }}>ФИО</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Отдел</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Схема выплаты</th>
                <th style={{ background: 'var(--surface, #fff)' }}>День аванса</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Сумма аванса</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Статус аванса</th>
                <th style={{ background: 'var(--surface, #fff)' }}>День з/п</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Оф. часть ЗП</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Сумма з/п</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Статус з/п</th>
                <th style={{ background: 'var(--surface, #fff)' }}>Итого выдано</th>
                <SortTh label="Остаток" field="amount" sort={allSort} onToggle={f => toggleSort(allSort, setAllSort, f)} />
                <SortTh label="Общий статус" field="status" sort={allSort} onToggle={f => toggleSort(allSort, setAllSort, f)} />
                <th style={{ background: 'var(--surface, #fff)' }}>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {sortedAll.map(p => {
                const hasAdv = p.ps.hasAdvance
                const advAmt = (p.officialAdvance || 0) + (p.unofficialAdvance || 0) + (p.salaryOnAccount || 0)
                const os = overallStatus(p)
                const osColor = os === 'paid' ? '#059669' : os === 'partial' ? '#d97706' : '#dc2626'
                const osBg = os === 'paid' ? '#ecfdf5' : os === 'partial' ? '#fffbeb' : '#fef2f2'
                const osLabel = os === 'paid' ? 'Выплачено' : os === 'partial' ? 'Частично' : 'Не выплачено'
                const issuedAmt = p.salaryStatus === 'paid'
                  ? (p.totalDeducted || 0) + (p.remaining || 0)
                  : (p.totalDeducted || 0)
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.empName}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.department}</td>
                    <td style={{ fontSize: 11 }}>{SCHEME_LABELS[p.ps.paymentScheme] || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {hasAdv ? <span style={{ fontWeight: 600, color: '#059669' }}>{p.ps.advanceDay}-е</span> : <span style={{ color: 'var(--text-muted)' }}>нет</span>}
                    </td>
                    <td className="money">
                      {hasAdv ? (advAmt > 0 ? formatMoney(advAmt) : '—') : <span style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>нет аванса</span>}
                    </td>
                    <td>
                      {hasAdv
                        ? <StatusButtons status={p.advanceStatus || 'unpaid'} onSet={s => setStatus(p.id, 'advanceStatus', s)} />
                        : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>{p.ps.salaryDay}-е</td>
                    <td className="money" style={{ color: '#0891b2' }}>{p.officialSalaryPart > 0 ? formatMoney(p.officialSalaryPart) : '—'}</td>
                    <td className="money">{formatMoney(p.totalEarned)}</td>
                    <td>
                      <StatusButtons status={p.salaryStatus || 'unpaid'} onSet={s => setStatus(p.id, 'salaryStatus', s)} />
                    </td>
                    <td className="money" style={{ color: p.salaryStatus === 'paid' ? '#059669' : '#c2410c', fontWeight: 700 }}>
                      {issuedAmt > 0 ? formatMoney(issuedAmt) : '—'}
                    </td>
                    <td className="money" style={{ fontWeight: 700, color: p.salaryStatus === 'paid' ? '#059669' : '#1d4ed8' }}>
                      {p.salaryStatus === 'paid' ? <span style={{ fontSize: 11 }}>✓ выплачено</span> : formatMoney(p.remaining)}
                    </td>
                    <td>
                      <span style={{ background: osBg, color: osColor, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{osLabel}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {p.ps.paymentComment || p.comment || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="table-footer">
                {/* 14 cols: ФИО Отдел Схема ДеньАв | СуммаАв | СтатусАв | ДеньЗп | ОфЧасть | СуммаЗп | СтатусЗп | ИтогоВыдано | Остаток | ОбщийСтатус | Комментарий */}
                <td colSpan={4}>Итого ({payrolls.length})</td>
                <td className="money">{formatMoney(totalAdvances)}</td>
                <td />
                <td />
                <td />
                <td className="money">{formatMoney(payrolls.reduce((s, p) => s + (p.totalEarned || 0), 0))}</td>
                <td />
                <td className="money">{formatMoney(payrolls.reduce((s, p) =>
                  s + (p.salaryStatus === 'paid'
                    ? (p.totalDeducted || 0) + (p.remaining || 0)
                    : (p.totalDeducted || 0)), 0))}</td>
                <td className="money">{formatMoney(payrolls.filter(p => p.salaryStatus !== 'paid').reduce((s, p) => s + (p.remaining || 0), 0))}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </DualScrollTable>
      )}
    </div>
  )
}
