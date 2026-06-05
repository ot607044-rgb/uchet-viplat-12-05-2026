import React, { useState, useMemo, useRef } from 'react'
import { Search, Plus, Copy, X, ChevronLeft, ChevronRight, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { generateId, formatMoney, monthName, getCurrentPeriod, BONUS_TYPE_LABELS, STATUS_LABELS, parseAmount, getEmpPaymentSettings, hasAdvanceConflict } from '../utils/helpers'
import { calcWorkedDays, calcWorkedDaysUntilDismiss, calcProRatedSalary } from './ProductionCalendar'

// Editable cell component
function EditCell({ value, onChange, type = 'number', width = 90 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef()

  function startEdit() {
    setDraft(value || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    setEditing(false)
    if (type === 'number') {
      onChange(parseAmount(draft))
    } else {
      onChange(draft)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === 'number' ? 'number' : 'text'}
        className="cell-input"
        style={{ width }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return (
    <span
      className="cell-editable"
      style={{ fontFamily: 'var(--font-mono)', display: 'block', minWidth: width, cursor: 'text' }}
      onClick={startEdit}
      title="Нажмите для редактирования"
    >
      {type === 'number'
        ? (value > 0 ? value.toLocaleString('ru-RU') : <span style={{ color: 'var(--text-muted)' }}>—</span>)
        : (value || <span style={{ color: 'var(--text-muted)' }}>—</span>)
      }
    </span>
  )
}

// Status select cell
function StatusCell({ value, onChange }) {
  const colors = {
    paid: { bg: '#ecfdf5', color: '#059669' },
    partial: { bg: '#fffbeb', color: '#d97706' },
    unpaid: { bg: '#fef2f2', color: '#dc2626' }
  }
  const c = colors[value] || colors.unpaid
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: 'none',
        background: c.bg,
        color: c.color,
        fontWeight: 600,
        fontSize: 11,
        borderRadius: 20,
        padding: '3px 8px',
        cursor: 'pointer',
        outline: 'none',
        minWidth: 110
      }}
    >
      <option value="unpaid">Не выплачено</option>
      <option value="partial">Частично</option>
      <option value="paid">Выплачено</option>
    </select>
  )
}

export default function Payroll() {
  const { state, dispatch } = useApp()
  const now = getCurrentPeriod()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  // PDF registry
  const [registry, setRegistry] = useState(null) // { filename, rows: [{name, amount, matchedId, selected}], payType }
  const [registryLoading, setRegistryLoading] = useState(false)

  const activeEmployees = useMemo(() =>
    state.employees.filter(e => e.status === 'active'),
    [state.employees]
  )

  // Get or create payroll rows for current month
  const payrollRows = useMemo(() => {
    const existing = state.payrolls.filter(p => p.month === month && p.year === year)
    return existing
  }, [state.payrolls, month, year])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return payrollRows
      .map(p => {
        const emp = state.employees.find(e => e.id === p.employeeId)
        return emp ? { ...p, empName: emp.fullName } : null
      })
      .filter(Boolean)
      .filter(p => {
        const matchSearch = !search || p.empName.toLowerCase().includes(search.toLowerCase())
        const matchDept = !filterDept || p.department === filterDept
        const matchManager = !filterManager || p.manager === filterManager
        const matchStatus = !filterStatus ||
          (filterStatus === 'advancePaid' && p.advanceStatus === 'paid') ||
          (filterStatus === 'advanceUnpaid' && p.advanceStatus !== 'paid') ||
          (filterStatus === 'salaryPaid' && p.salaryStatus === 'paid') ||
          (filterStatus === 'salaryUnpaid' && p.salaryStatus !== 'paid') ||
          (filterStatus === 'vacationPaid' && p.vacationPay > 0 && p.vacationPayStatus === 'paid') ||
          (filterStatus === 'vacationUnpaid' && p.vacationPay > 0 && p.vacationPayStatus !== 'paid')
        return matchSearch && matchDept && matchManager && matchStatus
      })
  }, [payrollRows, state.employees, search, filterDept, filterManager, filterStatus])

  const depts = useMemo(() => [...new Set(payrollRows.map(p => p.department).filter(Boolean))], [payrollRows])
  const managers = useMemo(() => [...new Set(payrollRows.map(p => p.manager).filter(Boolean))], [payrollRows])

  // Totals
  const totals = useMemo(() => filteredRows.reduce((acc, p) => ({
    salaryAmount: acc.salaryAmount + (p.salaryAmount || 0),
    bonus: acc.bonus + (p.bonus || 0),
    additionalEarnings: acc.additionalEarnings + (p.additionalEarnings || 0),
    vacationPay: acc.vacationPay + (p.vacationPay || 0),
    totalAdvance: acc.totalAdvance + (p.totalAdvance || 0),
    officialAdvance: acc.officialAdvance + (p.officialAdvance || 0),
    unofficialAdvance: acc.unofficialAdvance + (p.unofficialAdvance || 0),
    officialSalaryPart: acc.officialSalaryPart + (p.officialSalaryPart || 0),
    salaryOnAccount: acc.salaryOnAccount + (p.salaryOnAccount || 0),
    fine: acc.fine + (p.fine || 0),
    otherDeductions: acc.otherDeductions + (p.otherDeductions || 0),
    totalEarned: acc.totalEarned + (p.totalEarned || 0),
    totalDeducted: acc.totalDeducted + (p.totalDeducted || 0),
    remaining: acc.remaining + (p.salaryStatus === 'paid' ? 0 : (p.remaining || 0)),
  }), { salaryAmount: 0, bonus: 0, additionalEarnings: 0, vacationPay: 0, totalAdvance: 0, officialAdvance: 0, unofficialAdvance: 0, officialSalaryPart: 0, salaryOnAccount: 0, fine: 0, otherDeductions: 0, totalEarned: 0, totalDeducted: 0, remaining: 0 }), [filteredRows])

  function updateField(id, field, value) {
    dispatch({ type: 'UPDATE_PAYROLL_FIELD', payload: { id, field, value } })
  }

  function markAll(field, value) {
    const rows = field === 'advanceStatus'
      ? filteredRows.filter(p => p.ps?.paymentScheme !== 'single_payment')
      : field === 'vacationPayStatus'
        ? filteredRows.filter(p => (p.vacationPay || 0) > 0)
        : filteredRows
    rows.forEach(p => dispatch({ type: 'UPDATE_PAYROLL_FIELD', payload: { id: p.id, field, value } }))
  }

  function addMissingEmployees() {
    const existingIds = new Set(payrollRows.map(p => p.employeeId))
    const missing = activeEmployees.filter(e => !existingIds.has(e.id))
    missing.forEach(emp => {
      const newP = {
        id: generateId(),
        month, year,
        employeeId: emp.id,
        department: emp.department || '',
        manager: emp.manager || '',
        position: emp.position || '',
        salaryAmount: emp.salary || 0,
        bonus: 0, bonusType: 'regular',
        additionalEarnings: 0,
        vacationPay: 0,
        totalAdvance: 0,
        officialAdvance: 0, unofficialAdvance: 0,
        officialSalaryPart: 0, salaryOnAccount: 0,
        fine: 0, otherDeductions: 0,
        totalEarned: emp.salary || 0,
        totalDeducted: 0,
        remaining: emp.salary || 0,
        advanceStatus: 'unpaid', salaryStatus: 'unpaid', vacationPayStatus: 'unpaid',
        advancePayDate: null, salaryPayDate: null,
        comment: ''
      }
      dispatch({ type: 'UPSERT_PAYROLL', payload: newP })
    })
  }

  function copyPrevMonth() {
    dispatch({ type: 'COPY_PREVIOUS_MONTH', payload: { month, year } })
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // PDF registry helpers
  async function loadRegistry() {
    if (!window.electronAPI?.readPdfRegistry) return
    setRegistryLoading(true)
    try {
      const result = await window.electronAPI.readPdfRegistry()
      if (!result.ok) { setRegistryLoading(false); return }
      // Try to match each PDF row to a payroll row by name similarity
      const matched = result.rows.map(r => {
        // Normalize: lower, trim
        const pdfName = r.name.toLowerCase().replace(/\s+/g, ' ').trim()
        // Find best match in current month payrolls
        let bestId = null, bestScore = 0
        payrollRows.forEach(p => {
          const emp = state.employees.find(e => e.id === p.employeeId)
          if (!emp) return
          const empName = emp.fullName.toLowerCase().replace(/\s+/g, ' ').trim()
          // Score: exact match > startsWith > word overlap
          let score = 0
          if (empName === pdfName) score = 100
          else if (empName.startsWith(pdfName.split(' ')[0]) && pdfName.split(' ')[1] && empName.includes(pdfName.split(' ')[1])) score = 80
          else {
            const pdfWords = pdfName.split(' ')
            const empWords = empName.split(' ')
            const common = pdfWords.filter(w => w.length > 2 && empWords.some(ew => ew.startsWith(w) || w.startsWith(ew)))
            score = common.length * 30
          }
          if (score > bestScore) { bestScore = score; bestId = p.id }
        })
        return { ...r, matchedId: bestScore >= 60 ? bestId : null, selected: bestScore >= 60 }
      })
      setRegistry({ filename: result.filename, rows: matched, payType: 'officialSalaryPart' })
    } catch (e) { console.error(e) }
    setRegistryLoading(false)
  }

  function applyRegistry() {
    if (!registry) return
    const field = registry.payType // 'officialSalaryPart' | 'vacationPay' | 'officialAdvance'
    registry.rows.forEach(r => {
      if (r.selected && r.matchedId) {
        dispatch({ type: 'UPDATE_PAYROLL_FIELD', payload: { id: r.matchedId, field, value: r.amount } })
      }
    })
    setRegistry(null)
  }

  const missingCount = activeEmployees.filter(e => !payrollRows.find(p => p.employeeId === e.id)).length

  const topScrollRef = useRef()
  const tableRef = useRef()

  function handleTopScroll(e) {
    if (tableRef.current) tableRef.current.scrollLeft = e.target.scrollLeft
  }

  function handleTableScroll(e) {
    if (topScrollRef.current) topScrollRef.current.scrollLeft = e.target.scrollLeft
  }

  return (
    <div className="page-container" style={{ padding: '20px 16px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
          <div>
            <div className="page-title">{monthName(month)} {year}</div>
            <div className="page-subtitle">Начисление заработной платы</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {missingCount > 0 && (
            <button className="btn btn-secondary" onClick={addMissingEmployees}>
              <Plus size={13} /> Добавить {missingCount} сотр.
            </button>
          )}
          <button className="btn btn-secondary" onClick={copyPrevMonth}>
            <Copy size={13} /> Копировать прошлый месяц
          </button>
          {window.electronAPI?.readPdfRegistry && (
            <button className="btn btn-primary" onClick={loadRegistry} disabled={registryLoading}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              <Upload size={13} /> {registryLoading ? 'Читаю PDF...' : 'Загрузить реестр'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input input-sm" style={{ paddingLeft: 28, width: 220 }} placeholder="Поиск по ФИО..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select input-sm" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">Все отделы</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="select input-sm" value={filterManager} onChange={e => setFilterManager(e.target.value)}>
          <option value="">Все руководители</option>
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        <select className="select input-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="salaryPaid">З/п выплачена</option>
          <option value="salaryUnpaid">З/п не выплачена</option>
          <option value="advancePaid">Аванс выплачен</option>
          <option value="advanceUnpaid">Аванс не выплачен</option>
          <option value="vacationPaid">Отпускные выплачены</option>
          <option value="vacationUnpaid">Отпускные не выплачены</option>
        </select>
        {(search || filterDept || filterManager || filterStatus) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterDept(''); setFilterManager(''); setFilterStatus('') }}>
            <X size={12} /> Сбросить
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
          Строк: {filteredRows.length}
        </div>
      </div>

      {/* Payroll table */}
      {filteredRows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Нет данных за {monthName(month)} {year}</h3>
            <p>Нажмите «Добавить сотр.» или «Копировать прошлый месяц»</p>
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'white', overflow: 'hidden' }}>
          {/* Top scrollbar for sync */}
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            style={{ overflowX: 'auto', overflowY: 'hidden' }}
          >
            <div style={{ minWidth: 1600, height: 1 }} />
          </div>
          <div
            ref={tableRef}
            onScroll={handleTableScroll}
            style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}
          >
            <table className="table" style={{ minWidth: 1600, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, top: 0, background: '#f8f9fb', zIndex: 3, minWidth: 160 }}>ФИО</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90 }}>Отдел</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 100 }}>Должность</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 100 }}>Руководитель</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 95, color: '#1d4ed8' }}>Оклад ₽</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 85, color: '#7c3aed' }}>Премия ₽</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 100 }}>Тип премии</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 85, color: '#0891b2' }}>Доп. нач.</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90, color: '#059669', background: '#f0fdf4' }}>Отпускные</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 100, color: '#059669', background: '#f0fdf4', fontWeight: 800 }}>Итог. аванс</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90, color: '#059669' }}>Офиц. аванс</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90, color: '#6b7280' }}>Второй аванс</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 95, color: '#0891b2', background: '#ecfeff' }}>Оф. часть ЗП</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90, color: '#059669' }}>В счёт з/п</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 80, color: '#dc2626' }}>Штраф</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 90, color: '#dc2626' }}>Проч. удерж.</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 110, background: '#f0fdf4', fontWeight: 800 }}>Итого начислено</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 100, background: '#fff7ed', fontWeight: 800, color: '#c2410c' }}>Итого выдано</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 110, background: '#eff6ff', fontWeight: 800 }}>Остаток</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 120 }}>
                    <div>Статус аванса</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('advanceStatus', 'paid')}>Все ✓</button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('advanceStatus', 'unpaid')}>Сброс</button>
                    </div>
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 130, color: '#059669' }}>
                    <div>Статус отпускных</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('vacationPayStatus', 'paid')}>Все ✓</button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('vacationPayStatus', 'unpaid')}>Сброс</button>
                    </div>
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 120 }}>
                    <div>Статус з/п</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('salaryStatus', 'paid')}>Все ✓</button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => markAll('salaryStatus', 'unpaid')}>Сброс</button>
                    </div>
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 120 }}>Комментарий</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, minWidth: 44 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(p => {
                  const emp = state.employees.find(e => e.id === p.employeeId)
                  return (
                    <tr key={p.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 2, borderRight: '1px solid var(--border)', fontWeight: 600 }}>
                        {emp?.fullName || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.department || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.position || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.manager || '—'}</td>

                      {/* Editable earning fields */}
                      <td style={{ background: '#f0f7ff' }}>
                        <EditCell value={p.salaryAmount} onChange={v => updateField(p.id, 'salaryAmount', v)} />
                        {(() => {
                          const totalWD = (state.productionCalendar?.[year]?.[month]) || 0
                          if (!totalWD) return null

                          // Приём в текущем месяце
                          const hiredDays = emp?.hireDate ? calcWorkedDays(emp.hireDate, month, year) : null
                          if (hiredDays !== null && hiredDays < totalWD) {
                            const proRated = calcProRatedSalary(emp.salary || 0, totalWD, hiredDays)
                            return (
                              <button
                                onClick={() => updateField(p.id, 'salaryAmount', proRated)}
                                title={`Приём: ${emp.salary?.toLocaleString('ru-RU')} / ${totalWD} дн × ${hiredDays} дн = ${proRated?.toLocaleString('ru-RU')} ₽`}
                                style={{
                                  display: 'block', marginTop: 2, fontSize: 9, padding: '1px 5px',
                                  background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                  borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                              >
                                📅 приём {hiredDays}/{totalWD} дн → {proRated?.toLocaleString('ru-RU')} ₽
                              </button>
                            )
                          }

                          // Увольнение в текущем месяце
                          const dismissDays = emp?.dismissDate ? calcWorkedDaysUntilDismiss(emp.dismissDate, month, year) : null
                          if (dismissDays !== null && dismissDays < totalWD) {
                            const proRated = calcProRatedSalary(emp.salary || 0, totalWD, dismissDays)
                            return (
                              <button
                                onClick={() => updateField(p.id, 'salaryAmount', proRated)}
                                title={`Увольнение: ${emp.salary?.toLocaleString('ru-RU')} / ${totalWD} дн × ${dismissDays} дн = ${proRated?.toLocaleString('ru-RU')} ₽`}
                                style={{
                                  display: 'block', marginTop: 2, fontSize: 9, padding: '1px 5px',
                                  background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa',
                                  borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                              >
                                📅 увольн. {dismissDays}/{totalWD} дн → {proRated?.toLocaleString('ru-RU')} ₽
                              </button>
                            )
                          }

                          return null
                        })()}
                      </td>
                      <td style={{ background: '#faf5ff' }}><EditCell value={p.bonus} onChange={v => updateField(p.id, 'bonus', v)} /></td>
                      <td>
                        <select value={p.bonusType || 'regular'} onChange={e => updateField(p.id, 'bonusType', e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', width: '100%', outline: 'none' }}>
                          {Object.entries(BONUS_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ background: '#ecfeff' }}><EditCell value={p.additionalEarnings} onChange={v => updateField(p.id, 'additionalEarnings', v)} /></td>
                      <td style={{ background: '#f0fdf4' }}><EditCell value={p.vacationPay} onChange={v => updateField(p.id, 'vacationPay', v)} /></td>

                      {/* Advance fields — disabled for employees without advance */}
                      {(() => {
                        const ps = getEmpPaymentSettings(emp, state.settings)
                        const noAdv = !ps.hasAdvance
                        const disabledStyle = { background: '#f3f4f6', color: 'var(--text-muted)', textAlign: 'center', fontSize: 11, fontStyle: 'italic' }
                        const conflict = !noAdv && hasAdvanceConflict(p.totalAdvance, p.officialAdvance)
                        const unofficialVal = p.unofficialAdvance || 0
                        return (
                          <>
                            {/* Итоговый аванс — редактируемый */}
                            <td style={noAdv ? disabledStyle : { background: '#e6fdf0' }}>
                              {noAdv ? '—' : <EditCell value={p.totalAdvance} onChange={v => updateField(p.id, 'totalAdvance', v)} />}
                            </td>
                            {/* Официальный аванс — редактируемый */}
                            <td style={noAdv ? disabledStyle : conflict ? { background: '#fef2f2', outline: '1px solid #dc2626' } : { background: '#f0fdf4' }}>
                              {noAdv ? '—' : (
                                <div>
                                  <EditCell value={p.officialAdvance} onChange={v => updateField(p.id, 'officialAdvance', v)} />
                                  {conflict && <div style={{ fontSize: 9, color: '#dc2626', marginTop: 1 }}>офиц. &gt; итог.</div>}
                                </div>
                              )}
                            </td>
                            {/* Второй аванс — read-only, рассчитывается автоматически */}
                            <td style={noAdv ? disabledStyle : { background: '#f8f9fa', color: 'var(--text-secondary)' }}>
                              {noAdv ? '—' : (
                                <span style={{ fontFamily: 'var(--font-mono)', display: 'block', minWidth: 90, color: unofficialVal > 0 ? '#374151' : 'var(--text-muted)', fontSize: 12 }}
                                  title="Рассчитывается автоматически: Итоговый аванс − Первый аванс">
                                  {unofficialVal > 0 ? unofficialVal.toLocaleString('ru-RU') : '—'}
                                </span>
                              )}
                            </td>
                          </>
                        )
                      })()}
                      {/* Оф. часть ЗП — редактируемая */}
                      <td style={{ background: '#ecfeff' }}>
                        <EditCell value={p.officialSalaryPart} onChange={v => updateField(p.id, 'officialSalaryPart', v)} />
                      </td>
                      {/* В счёт з/п */}
                      <td>
                        <EditCell value={p.salaryOnAccount} onChange={v => updateField(p.id, 'salaryOnAccount', v)} />
                      </td>
                      <td style={{ background: '#fff5f5' }}><EditCell value={p.fine} onChange={v => updateField(p.id, 'fine', v)} /></td>
                      <td style={{ background: '#fff5f5' }}><EditCell value={p.otherDeductions} onChange={v => updateField(p.id, 'otherDeductions', v)} /></td>

                      {/* Read-only computed */}
                      <td style={{ background: '#f0fdf4', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                        {(p.totalEarned || 0).toLocaleString('ru-RU')}
                      </td>
                      <td style={{ background: '#fff7ed', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#c2410c' }}
                        title={p.totalDeducted > p.totalEarned ? '⚠ Выдано больше начисленного!' : ''}>
                        {(p.totalDeducted || 0) > 0 ? (p.totalDeducted || 0).toLocaleString('ru-RU') : '—'}
                        {p.totalDeducted > p.totalEarned && <span style={{ fontSize: 9, color: '#dc2626', display: 'block' }}>⚠ превышение</span>}
                      </td>
                      <td style={{ background: p.salaryStatus === 'paid' ? '#f0fdf4' : '#eff6ff', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: p.salaryStatus === 'paid' ? '#059669' : '#1d4ed8' }}>
                        {p.salaryStatus === 'paid'
                          ? <span style={{ fontSize: 11, color: '#059669' }}>✓ выплачено</span>
                          : (p.remaining || 0).toLocaleString('ru-RU')
                        }
                      </td>

                      {/* Status cells */}
                      <td><StatusCell value={p.advanceStatus || 'unpaid'} onChange={v => updateField(p.id, 'advanceStatus', v)} /></td>
                      <td>
                        {(p.vacationPay || 0) > 0
                          ? <StatusCell value={p.vacationPayStatus || 'unpaid'} onChange={v => updateField(p.id, 'vacationPayStatus', v)} />
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td><StatusCell value={p.salaryStatus || 'unpaid'} onChange={v => updateField(p.id, 'salaryStatus', v)} /></td>
                      <td>
                        <EditCell value={p.comment} onChange={v => updateField(p.id, 'comment', v)} type="text" width={110} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => { if (window.confirm(`Удалить ${emp?.fullName || 'сотрудника'} из начислений за этот месяц?`)) dispatch({ type: 'DELETE_PAYROLL', payload: p.id }) }}
                          title="Удалить из начислений"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 15, lineHeight: 1 }}
                        >✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="table-footer">
                  <td style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2 }}>
                    Итого ({filteredRows.length})
                  </td>
                  <td colSpan={3} />
                  <td className="money">{totals.salaryAmount > 0 ? totals.salaryAmount.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money">{totals.bonus > 0 ? totals.bonus.toLocaleString('ru-RU') : '—'}</td>
                  <td />
                  <td className="money">{totals.additionalEarnings > 0 ? totals.additionalEarnings.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: '#059669', background: '#f0fdf4' }}>{totals.vacationPay > 0 ? totals.vacationPay.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ background: '#e6fdf0', fontWeight: 700 }}>{totals.totalAdvance > 0 ? totals.totalAdvance.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money">{totals.officialAdvance > 0 ? totals.officialAdvance.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: 'var(--text-muted)' }}>{totals.unofficialAdvance > 0 ? totals.unofficialAdvance.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: '#0891b2', background: '#ecfeff' }}>{totals.officialSalaryPart > 0 ? totals.officialSalaryPart.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money">{totals.salaryOnAccount > 0 ? totals.salaryOnAccount.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: 'var(--danger)' }}>{totals.fine > 0 ? totals.fine.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: 'var(--danger)' }}>{totals.otherDeductions > 0 ? totals.otherDeductions.toLocaleString('ru-RU') : '—'}</td>
                  <td className="money" style={{ color: 'var(--success)', fontWeight: 800, background: '#f0fdf4' }}>
                    {totals.totalEarned.toLocaleString('ru-RU')}
                  </td>
                  <td className="money" style={{ color: '#c2410c', fontWeight: 800, background: '#fff7ed' }}>
                    {totals.totalDeducted > 0 ? totals.totalDeducted.toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="money" style={{ color: '#1d4ed8', fontWeight: 800, background: '#eff6ff' }}>
                    {totals.remaining.toLocaleString('ru-RU')}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>{/* end tableRef wrapper */}
          <div style={{ padding: '8px 16px', background: '#f8f9fb', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            Щёлкните по числовому полю для редактирования · Enter — сохранить · Escape — отмена · Формулы пересчитываются автоматически
          </div>
        </div>
      )}
      {/* PDF Registry Modal */}
      {registry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Upload size={18} color="#7c3aed" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Реестр выплат</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{registry.filename}</div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setRegistry(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Pay type selector */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: '#f8f9fb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Тип выплаты в реестре:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { key: 'officialSalaryPart', label: '💼 Офиц. часть зарплаты', color: '#0891b2' },
                  { key: 'vacationPay',         label: '🌴 Отпускные',            color: '#059669' },
                  { key: 'officialAdvance',     label: '📅 Официальный аванс',    color: '#7c3aed' },
                ].map(({ key, label, color }) => (
                  <button key={key} onClick={() => setRegistry(r => ({ ...r, payType: key }))}
                    style={{
                      border: `2px solid ${registry.payType === key ? color : '#e5e7eb'}`,
                      background: registry.payType === key ? color : 'white',
                      color: registry.payType === key ? 'white' : 'var(--text-secondary)',
                      borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
              {registry.rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={32} style={{ marginBottom: 8 }} />
                  <div>Не удалось распознать строки в PDF</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Возможно формат файла не поддерживается</div>
                </div>
              ) : (
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={registry.rows.every(r => r.selected)}
                          onChange={e => setRegistry(r => ({ ...r, rows: r.rows.map(row => ({ ...row, selected: e.target.checked })) }))} />
                      </th>
                      <th>ФИО из реестра</th>
                      <th>Сумма</th>
                      <th>Сопоставлен с</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registry.rows.map((r, i) => {
                      const matchedPayroll = r.matchedId ? payrollRows.find(p => p.id === r.matchedId) : null
                      const matchedEmp = matchedPayroll ? state.employees.find(e => e.id === matchedPayroll.employeeId) : null
                      return (
                        <tr key={i} style={{ background: !r.matchedId ? '#fff8f8' : r.selected ? 'white' : '#fafafa' }}>
                          <td>
                            <input type="checkbox" checked={!!r.selected} disabled={!r.matchedId}
                              onChange={e => setRegistry(reg => ({
                                ...reg,
                                rows: reg.rows.map((row, j) => j === i ? { ...row, selected: e.target.checked } : row)
                              }))} />
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td className="money" style={{ fontWeight: 700, color: '#059669' }}>
                            {r.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                          </td>
                          <td>
                            {matchedEmp ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>{matchedEmp.fullName}</span>
                            ) : (
                              <select style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px' }}
                                value={r.matchedId || ''}
                                onChange={e => setRegistry(reg => ({
                                  ...reg,
                                  rows: reg.rows.map((row, j) => j === i ? { ...row, matchedId: e.target.value || null, selected: !!e.target.value } : row)
                                }))}>
                                <option value="">— выберите —</option>
                                {payrollRows.map(p => {
                                  const emp = state.employees.find(e => e.id === p.employeeId)
                                  return emp ? <option key={p.id} value={p.id}>{emp.fullName}</option> : null
                                })}
                              </select>
                            )}
                          </td>
                          <td>
                            {r.matchedId
                              ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Найден</span>
                              : <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} /> Не найден</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Выбрано: {registry.rows.filter(r => r.selected && r.matchedId).length} из {registry.rows.length} строк ·
                Не найдено: {registry.rows.filter(r => !r.matchedId).length}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setRegistry(null)}>Отмена</button>
                <button className="btn btn-primary"
                  disabled={!registry.rows.some(r => r.selected && r.matchedId)}
                  onClick={applyRegistry}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  Применить ({registry.rows.filter(r => r.selected && r.matchedId).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
