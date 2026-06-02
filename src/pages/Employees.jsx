import React, { useState, useMemo } from 'react'
import { Search, Plus, Edit2, UserX, UserCheck, Trash2, X, Eye, Users, CalendarDays, Save, Pencil } from 'lucide-react'
// Edit2 остаётся для иконки редактирования отсутствий внутри AbsencesTab
import { useApp } from '../context/AppContext'
import { formatMoney, formatDate, calcWorkDuration, getVacationBalance, getVacationPolicyLabel, getVacationAccrualRate } from '../utils/helpers'
import { ABSENCE_TYPES } from './Schedule'
import { CustomSelect, HYBRID_DAYS, DAY_OPTS, DEFAULT_HYBRID, DEFAULT_PAYMENT_SETTINGS, BASE_COOPERATION_FORMATS, BASE_WORK_SCHEDULES, BASE_EMPLOYMENT_TYPES } from './AddEmployee'
import { getFormatColors } from './PayrollTax'

const EMPTY_ABS_FORM = { type: 'vacation', dateFrom: '', dateTo: '', comment: '' }

function AbsencesTab({ employeeId }) {
  const { state, dispatch } = useApp()
  const emp = state.employees.find(e => e.id === employeeId)
  const ob = emp?.vacationOpeningBalance
  const [form, setForm] = useState(null) // null = closed, {} = new, {id,...} = edit
  const [showObForm, setShowObForm] = useState(false)
  const [obDate, setObDate] = useState(ob?.date || '')
  const [obDays, setObDays] = useState(ob?.remainingDays != null ? String(ob.remainingDays) : '')

  const absences = state.absences
    .filter(a => a.employeeId === employeeId)
    .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom))

  const vacBalance = emp ? getVacationBalance(emp, state.absences) : null

  function openAdd() { setForm({ ...EMPTY_ABS_FORM }) }
  function openEdit(a) { setForm({ id: a.id, type: a.type, dateFrom: a.dateFrom, dateTo: a.dateTo, comment: a.comment || '' }) }
  function closeForm() { setForm(null) }

  function saveForm() {
    if (!form.dateFrom || !form.dateTo) return
    const days = Math.round((new Date(form.dateTo) - new Date(form.dateFrom)) / 86400000) + 1
    if (form.id) {
      dispatch({ type: 'UPDATE_ABSENCE', payload: { id: form.id, type: form.type, dateFrom: form.dateFrom, dateTo: form.dateTo, comment: form.comment, days } })
    } else {
      dispatch({ type: 'ADD_ABSENCE', payload: { employeeId, type: form.type, dateFrom: form.dateFrom, dateTo: form.dateTo, comment: form.comment, days } })
    }
    setForm(null)
  }

  function deleteAbs(id) {
    if (window.confirm('Удалить запись об отсутствии?')) dispatch({ type: 'DELETE_ABSENCE', payload: id })
  }

  function saveOpeningBalance() {
    if (!emp) return
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: {
      ...emp,
      vacationOpeningBalance: (obDate && obDays !== '') ? { date: obDate, remainingDays: Number(obDays) } : null
    }})
    setShowObForm(false)
  }

  function clearOpeningBalance() {
    if (!emp || !window.confirm('Удалить начальный остаток?')) return
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, vacationOpeningBalance: null }})
    setObDate(''); setObDays('')
  }

  return (
    <div>
      {/* Баланс отпуска */}
      {vacBalance && (
        <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ob ? 8 : 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>Баланс отпуска</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ob && <button onClick={clearOpeningBalance} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626', padding: '2px 6px' }}>Удалить нач. остаток</button>}
              <button onClick={() => { setObDate(ob?.date || ''); setObDays(ob?.remainingDays != null ? String(ob.remainingDays) : ''); setShowObForm(v => !v) }}
                style={{ background: 'none', border: '1px solid #15803d', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#15803d', padding: '2px 8px', fontWeight: 600 }}>
                {ob ? 'Изменить нач. остаток' : '+ Нач. остаток'}
              </button>
            </div>
          </div>
          {ob ? (
            /* С начальным остатком: показываем только цифры от даты остатка */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 8 }}>
              {[
                { label: `Нач. остаток на ${formatDate(ob.date)}`, value: `${ob.remainingDays} дн.`, color: '#0891b2' },
                { label: `Накоплено с ${formatDate(ob.date)}`, value: `${vacBalance.accruedAfterOB} дн.`, color: '#374151' },
                { label: 'Использовано (факт)', value: `${vacBalance.usedAfterOB} дн.`, color: '#374151' },
                { label: 'Остаток', value: `${vacBalance.balance} дн.`, color: vacBalance.balance < 0 ? '#dc2626' : '#059669', bold: true },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '8px 6px', background: 'white', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, lineHeight: 1.3 }}>{s.label}</div>
                  <div style={{ fontSize: s.bold ? 15 : 13, fontWeight: s.bold ? 800 : 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          ) : (
            /* Без начального остатка: стандартная строка */
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Накоплено всего: <strong>{vacBalance.totalAccrued} дн.</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Использовано: <strong>{vacBalance.totalUsed} дн.</strong>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: vacBalance.balance < 0 ? '#dc2626' : '#059669' }}>
                Остаток: {vacBalance.balance} дн.
              </div>
            </div>
          )}
          {/* Форма начального остатка */}
          {showObForm && (
            <div style={{ marginTop: 12, padding: 12, background: 'white', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#374151' }}>Начальный остаток отпуска</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Укажите дату и сколько дней отпуска оставалось у сотрудника на эту дату. Система будет рассчитывать баланс от этой точки.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <div className="form-label">На дату</div>
                  <input type="date" className="input input-sm" value={obDate} onChange={e => setObDate(e.target.value)} />
                </div>
                <div>
                  <div className="form-label">Остаток (дней)</div>
                  <input type="number" className="input input-sm" min="0" value={obDays}
                    placeholder="0" onChange={e => setObDays(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveOpeningBalance} disabled={!obDate || obDays === ''}>
                  <Save size={13} /> Сохранить
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowObForm(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={13} /> Добавить отсутствие</button>
      </div>

      {/* Форма добавления/редактирования */}
      {form && (
        <div style={{ marginBottom: 16, padding: 14, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{form.id ? 'Редактировать' : 'Добавить отсутствие'}</div>
          {/* Тип */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {Object.entries(ABSENCE_TYPES).map(([key, val]) => (
              <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))}
                style={{ padding: '4px 10px', borderRadius: 6, border: '2px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderColor: form.type === key ? val.color : '#e5e7eb',
                  background: form.type === key ? val.color : 'white',
                  color: form.type === key ? 'white' : 'var(--text-secondary)' }}>
                {val.label}
              </button>
            ))}
          </div>
          {/* Даты */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div className="form-label">С</div>
              <input type="date" className="input input-sm" value={form.dateFrom}
                onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div>
              <div className="form-label">По</div>
              <input type="date" className="input input-sm" value={form.dateTo}
                onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
          </div>
          {form.dateFrom && form.dateTo && form.dateTo >= form.dateFrom && (
            <div style={{ fontSize: 11, color: '#0891b2', marginBottom: 8 }}>
              {Math.round((new Date(form.dateTo) - new Date(form.dateFrom)) / 86400000) + 1} календ. дн.
            </div>
          )}
          {/* Комментарий */}
          <div style={{ marginBottom: 10 }}>
            <div className="form-label">Комментарий</div>
            <input type="text" className="input input-sm" value={form.comment}
              placeholder="Необязательно"
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={saveForm} disabled={!form.dateFrom || !form.dateTo || form.dateTo < form.dateFrom}>
              <Save size={13} /> Сохранить
            </button>
            <button className="btn btn-secondary btn-sm" onClick={closeForm}>Отмена</button>
          </div>
        </div>
      )}

      {/* Список отсутствий */}
      {absences.length === 0 && !form ? (
        <div className="empty-state"><div>Нет записей об отсутствиях</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {absences.map(a => {
            const ti = ABSENCE_TYPES[a.type] || ABSENCE_TYPES.other
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: ti.bg, border: `1px solid ${ti.color}30`, borderRadius: 8 }}>
                <span style={{ padding: '2px 8px', borderRadius: 5, background: ti.color, color: 'white', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{ti.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(a.dateFrom)} — {formatDate(a.dateTo)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.days} дн.</span>
                {a.comment && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{a.comment}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '2px 5px', borderRadius: 4 }}><Edit2 size={13} /></button>
                  <button onClick={() => deleteAbs(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 5px', borderRadius: 4 }}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmployeeEditForm({ empId, onDone }) {
  const { state, dispatch } = useApp()
  const emp = state.employees.find(e => e.id === empId)
  const [form, setForm] = useState(() => ({
    fullName: '', position: '', hireDate: '', status: 'active', department: '',
    manager: '', comment: '', cooperationFormat: '', workSchedule: '',
    workFormat: '', employmentType: '',
    ...emp,
    salary: emp?.salary ?? '',
    hybridDays: { ...DEFAULT_HYBRID, ...(emp?.hybridDays || {}) },
    paymentSettings: { ...DEFAULT_PAYMENT_SETTINGS, ...(emp?.paymentSettings || {}) }
  }))
  const [errors, setErrors] = useState({})

  const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))]
  const managers = [...new Set(state.employees.map(e => e.manager).filter(Boolean))]
  const positions = [...new Set(state.employees.map(e => e.position).filter(Boolean))]
  const cooperationFormats = [...BASE_COOPERATION_FORMATS, ...(state.settings?.cooperationFormats || []).filter(v => !BASE_COOPERATION_FORMATS.includes(v))]
  const workSchedules = [...BASE_WORK_SCHEDULES, ...(state.settings?.workSchedules || []).filter(v => !BASE_WORK_SCHEDULES.includes(v))]
  const employmentTypes = [...BASE_EMPLOYMENT_TYPES, ...(state.settings?.employmentTypes || []).filter(v => !BASE_EMPLOYMENT_TYPES.includes(v))]

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); setErrors(e => ({ ...e, [field]: '' })) }
  function setPS(field, value) { setForm(f => ({ ...f, paymentSettings: { ...f.paymentSettings, [field]: value } })) }
  function setDay(day, value) { setForm(f => ({ ...f, hybridDays: { ...f.hybridDays, [day]: value } })) }
  function addToList(listName, value) {
    const current = state.settings[listName] || []
    if (!current.includes(value)) dispatch({ type: 'UPDATE_SETTINGS', payload: { [listName]: [...current, value] } })
  }

  function save() {
    if (!form.fullName.trim()) { setErrors({ fullName: 'Введите ФИО' }); return }
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: {
      ...emp, ...form,
      salary: parseFloat(form.salary) || 0,
      hybridDays: form.workFormat === 'гибрид' ? form.hybridDays : DEFAULT_HYBRID
    }})
    if (form.cooperationFormat && !BASE_COOPERATION_FORMATS.includes(form.cooperationFormat)) addToList('cooperationFormats', form.cooperationFormat)
    if (form.workSchedule && !BASE_WORK_SCHEDULES.includes(form.workSchedule)) addToList('workSchedules', form.workSchedule)
    if (form.employmentType && !BASE_EMPLOYMENT_TYPES.includes(form.employmentType)) addToList('employmentTypes', form.employmentType)
    onDone()
  }

  const SectionTitle = ({ title }) => (
    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 4 }}>{title}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Личные данные */}
      <SectionTitle title="Личные данные" />
      <div>
        <div className="form-label">ФИО *</div>
        <input className="input" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
        {errors.fullName && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{errors.fullName}</div>}
      </div>
      <div className="form-row-3">
        <div>
          <div className="form-label">Дата приёма</div>
          <input type="date" className="input" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
        </div>
        <div>
          <div className="form-label">Оклад (₽)</div>
          <input type="number" className="input" min="0" value={form.salary} onChange={e => set('salary', e.target.value)} />
        </div>
        <div>
          <div className="form-label">Статус</div>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Работает</option>
            <option value="dismissed">Уволен</option>
          </select>
        </div>
      </div>

      {/* Рабочие данные */}
      <SectionTitle title="Рабочие данные" />
      <div className="form-row-3">
        <div>
          <div className="form-label">Отдел</div>
          <input list="ef-depts" className="input" value={form.department} onChange={e => set('department', e.target.value)} />
          <datalist id="ef-depts">{depts.map(d => <option key={d} value={d} />)}</datalist>
        </div>
        <div>
          <div className="form-label">Должность</div>
          <input list="ef-positions" className="input" value={form.position} onChange={e => set('position', e.target.value)} />
          <datalist id="ef-positions">{positions.map(p => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <div className="form-label">Руководитель</div>
          <input list="ef-managers" className="input" value={form.manager} onChange={e => set('manager', e.target.value)} />
          <datalist id="ef-managers">{managers.map(m => <option key={m} value={m} />)}</datalist>
        </div>
      </div>

      {/* Условия сотрудничества */}
      <SectionTitle title="Условия сотрудничества" />
      <div className="form-row">
        <div>
          <div className="form-label">Формат сотрудничества</div>
          <CustomSelect value={form.cooperationFormat} onChange={v => set('cooperationFormat', v)} options={cooperationFormats} onAdd={v => addToList('cooperationFormats', v)} placeholder="Выберите..." />
        </div>
        <div>
          <div className="form-label">Тип занятости</div>
          <CustomSelect value={form.employmentType} onChange={v => set('employmentType', v)} options={employmentTypes} onAdd={v => addToList('employmentTypes', v)} placeholder="Выберите..." />
        </div>
      </div>
      <div className="form-row">
        <div>
          <div className="form-label">График работы</div>
          <CustomSelect value={form.workSchedule} onChange={v => set('workSchedule', v)} options={workSchedules} onAdd={v => addToList('workSchedules', v)} placeholder="Выберите..." />
        </div>
        <div>
          <div className="form-label">Формат работы</div>
          <select className="select" value={form.workFormat} onChange={e => set('workFormat', e.target.value)}>
            <option value="">Выберите...</option>
            <option value="офис">Офис</option>
            <option value="удалённо">Удалённо</option>
            <option value="гибрид">Гибрид</option>
          </select>
        </div>
      </div>
      {form.workFormat === 'гибрид' && (
        <div style={{ padding: 12, background: '#f8f9fb', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>ДНИ ГИБРИДНОГО ГРАФИКА</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {HYBRID_DAYS.map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                <select className="select" value={form.hybridDays[key] || ''} onChange={e => setDay(key, e.target.value)}>
                  <option value="">—</option>
                  {DAY_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Настройки выплат */}
      <SectionTitle title="Настройки выплат" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8f9fb', borderRadius: 8, border: '1px solid var(--border)' }}>
        <input type="checkbox" id="ef-ps" checked={form.paymentSettings.useIndividualPaymentSettings} onChange={e => setPS('useIndividualPaymentSettings', e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
        <label htmlFor="ef-ps" style={{ fontSize: 13, cursor: 'pointer' }}>Индивидуальные настройки выплат</label>
      </div>
      {form.paymentSettings.useIndividualPaymentSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: '#f8f9fb', borderRadius: 8 }}>
          <div>
            <div className="form-label">Схема выплаты</div>
            <select className="select" value={form.paymentSettings.paymentScheme} onChange={e => setPS('paymentScheme', e.target.value)}>
              <option value="advance_and_salary">Аванс + зарплата</option>
              <option value="single_payment">Вся зарплата одним платежом</option>
              <option value="custom">Индивидуальная схема</option>
            </select>
          </div>
          {form.paymentSettings.paymentScheme !== 'single_payment' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="ef-adv" checked={form.paymentSettings.hasAdvance} onChange={e => setPS('hasAdvance', e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
              <label htmlFor="ef-adv" style={{ fontSize: 13, cursor: 'pointer' }}>Есть аванс</label>
            </div>
          )}
          {form.paymentSettings.hasAdvance && form.paymentSettings.paymentScheme !== 'single_payment' && (
            <div>
              <div className="form-label">День аванса</div>
              <select className="select" value={form.paymentSettings.advanceDay} onChange={e => setPS('advanceDay', Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="form-label">День зарплаты</div>
            <select className="select" value={form.paymentSettings.salaryDay} onChange={e => setPS('salaryDay', Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div className="form-label">Комментарий по выплатам</div>
            <input className="input" placeholder="Например: оплачиваем полностью 30 числа" value={form.paymentSettings.paymentComment} onChange={e => setPS('paymentComment', e.target.value)} />
          </div>
        </div>
      )}

      {/* Комментарий */}
      <div>
        <div className="form-label">Комментарий</div>
        <textarea className="textarea" rows={2} value={form.comment || ''} onChange={e => set('comment', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button className="btn btn-primary" onClick={save}><Save size={13} /> Сохранить изменения</button>
        <button className="btn btn-secondary" onClick={onDone}>Отмена</button>
      </div>
    </div>
  )
}

const PRESET_BANKS = [
  'Сбербанк', 'ВТБ', 'Альфа-Банк', 'Тинькофф', 'Газпромбанк',
  'Россельхозбанк', 'Совкомбанк', 'МТС Банк', 'Открытие', 'Райффайзен',
]

function PreferredBankSection({ employeeId }) {
  const { state, dispatch } = useApp()
  const emp = state.employees.find(e => e.id === employeeId)
  const current = emp?.preferredBank || ''
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current)

  function save() {
    if (!emp) return
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, preferredBank: value.trim() || null } })
    setEditing(false)
  }

  return (
    <div style={{ marginTop: 12, padding: 14, background: '#f8f9fb', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 12 : 4 }}>
        <div className="form-label" style={{ marginBottom: 0 }}>Предпочтительный банк</div>
        <button onClick={() => { setValue(current); setEditing(v => !v) }}
          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          {editing ? 'Отмена' : current ? 'Изменить' : '+ Добавить'}
        </button>
      </div>
      {!editing && (
        current
          ? <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{current}</span>
          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Не указан</span>
      )}
      {editing && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {PRESET_BANKS.map(b => (
              <button key={b} onClick={() => setValue(b)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${value === b ? '#3b82f6' : '#e5e7eb'}`,
                  background: value === b ? '#eff6ff' : 'white', color: value === b ? '#1d4ed8' : 'var(--text-secondary)', transition: 'all 0.12s' }}>
                {b}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input type="text" className="input input-sm" placeholder="Или введите свой банк..."
              value={value} onChange={e => setValue(e.target.value)}
              style={{ flex: 1 }} />
            {value && <button onClick={() => setValue('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}>✕</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} /> Сохранить</button>
            {current && <button className="btn btn-secondary btn-sm" onClick={() => { dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, preferredBank: null } }); setEditing(false) }}>Удалить</button>}
          </div>
        </div>
      )}
    </div>
  )
}

const POLICY_OPTIONS = [
  { type: 'standard', label: '28 дней/год', desc: 'Стандарт (2,33 дн/мес)', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  { type: 'untracked', label: 'Не отслеживается', desc: 'Не попадает в аналитику', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { type: 'custom', label: 'Свой вариант', desc: 'Задать кол-во дней', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
]

function VacationPolicySection({ employeeId }) {
  const { state, dispatch } = useApp()
  const emp = state.employees.find(e => e.id === employeeId)
  const policy = emp?.vacationPolicy || { type: 'standard' }
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ type: 'standard', customDaysPerYear: 28, customLabel: '' })

  function startEdit() {
    setForm({ type: policy.type || 'standard', customDaysPerYear: policy.customDaysPerYear || 28, customLabel: policy.customLabel || '' })
    setEditing(true)
  }

  function save() {
    if (!emp) return
    const newPolicy = form.type === 'standard' ? null : {
      type: form.type,
      ...(form.type === 'custom' ? { customDaysPerYear: form.customDaysPerYear, customLabel: form.customLabel } : {})
    }
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...emp, vacationPolicy: newPolicy } })
    setEditing(false)
  }

  const label = getVacationPolicyLabel(emp)
  const rate = getVacationAccrualRate(emp)
  const opt = POLICY_OPTIONS.find(o => o.type === (policy.type || 'standard'))

  return (
    <div style={{ marginTop: 16, padding: 14, background: '#f8f9fb', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 12 : 4 }}>
        <div className="form-label" style={{ marginBottom: 0 }}>Условия отпуска</div>
        <button onClick={editing ? () => setEditing(false) : startEdit}
          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          {editing ? 'Отмена' : 'Изменить'}
        </button>
      </div>
      {!editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ padding: '3px 10px', borderRadius: 6, background: opt?.bg, color: opt?.color, fontSize: 12, fontWeight: 700, border: `1px solid ${opt?.border}` }}>{label}</span>
          {rate != null && policy.type === 'custom' && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rate.toFixed(2)} дн/мес</span>
          )}
        </div>
      )}
      {editing && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {POLICY_OPTIONS.map(o => (
              <button key={o.type} onClick={() => setForm(f => ({ ...f, type: o.type }))}
                style={{ flex: 1, padding: '9px 6px', borderRadius: 9, border: `2px solid ${form.type === o.type ? o.border : '#e5e7eb'}`,
                  background: form.type === o.type ? o.bg : 'white', color: form.type === o.type ? o.color : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.15s' }}>
                <div>{o.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, color: form.type === o.type ? o.color : 'var(--text-muted)' }}>{o.desc}</div>
              </button>
            ))}
          </div>
          {form.type === 'untracked' && (
            <div style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              Сотрудник не будет отображаться в таблице баланса отпусков и в аналитике
            </div>
          )}
          {form.type === 'custom' && (
            <div style={{ padding: 10, background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff', marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div className="form-label">Название варианта</div>
                  <input type="text" className="input input-sm" placeholder="Напр: Удлинённый отпуск"
                    value={form.customLabel} onChange={e => setForm(f => ({ ...f, customLabel: e.target.value }))} />
                </div>
                <div>
                  <div className="form-label">Дней в год</div>
                  <input type="number" className="input input-sm" min="1" max="365"
                    value={form.customDaysPerYear} onChange={e => setForm(f => ({ ...f, customDaysPerYear: Number(e.target.value) || 28 }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                Начисление: {((form.customDaysPerYear || 28) / 12).toFixed(2)} дн/мес · расчёт аналогичен стандартному, но по вашей ставке
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} /> Сохранить</button>
        </div>
      )}
    </div>
  )
}

export function EmployeeModal({ employee, onClose, onEdit, onDismiss, onRestore, onDelete, initialTab = 'info' }) {
  const { state, dispatch } = useApp()
  const [tab, setTab] = useState(initialTab)
  const [dismissDate, setDismissDate] = useState(new Date().toISOString().slice(0, 10))
  const [showDismissForm, setShowDismissForm] = useState(false)

  const liveEmp = state.employees.find(e => e.id === employee.id) || employee

  const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))]
  const managers = [...new Set(state.employees.map(e => e.manager).filter(Boolean))]
  const positions = [...new Set(state.employees.map(e => e.position).filter(Boolean))]
  const cooperationFormats = [...BASE_COOPERATION_FORMATS, ...(state.settings?.cooperationFormats || []).filter(v => !BASE_COOPERATION_FORMATS.includes(v))]
  const workSchedules = [...BASE_WORK_SCHEDULES, ...(state.settings?.workSchedules || []).filter(v => !BASE_WORK_SCHEDULES.includes(v))]
  const employmentTypes = [...BASE_EMPLOYMENT_TYPES, ...(state.settings?.employmentTypes || []).filter(v => !BASE_EMPLOYMENT_TYPES.includes(v))]

  const initForm = (emp) => ({
    fullName: emp.fullName || '',
    hireDate: emp.hireDate || '',
    salary: emp.salary ?? '',
    status: emp.status || 'active',
    department: emp.department || '',
    position: emp.position || '',
    manager: emp.manager || '',
    cooperationFormat: emp.cooperationFormat || '',
    employmentType: emp.employmentType || '',
    workSchedule: emp.workSchedule || '',
    workFormat: emp.workFormat || '',
    hybridDays: { ...DEFAULT_HYBRID, ...(emp.hybridDays || {}) },
    paymentSettings: { ...DEFAULT_PAYMENT_SETTINGS, ...(emp.paymentSettings || {}) },
    comment: emp.comment || '',
  })

  const [f, setF] = useState(() => initForm(liveEmp))
  const [dirty, setDirty] = useState(false)

  function upd(field, val) { setF(prev => ({ ...prev, [field]: val })); setDirty(true) }
  function updPS(field, val) { setF(prev => ({ ...prev, paymentSettings: { ...prev.paymentSettings, [field]: val } })); setDirty(true) }
  function updDay(day, val) { setF(prev => ({ ...prev, hybridDays: { ...prev.hybridDays, [day]: val } })); setDirty(true) }

  function save() {
    if (!f.fullName.trim()) return
    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...liveEmp, ...f, salary: parseFloat(f.salary) || 0 } })
    setDirty(false)
  }
  function reset() { setF(initForm(liveEmp)); setDirty(false) }

  const payrolls = state.payrolls
    .filter(p => p.employeeId === liveEmp.id)
    .sort((a, b) => b.year - a.year || b.month - a.month)
  const totalPaid = payrolls.filter(p => p.salaryStatus === 'paid').reduce((s, p) => s + (p.totalEarned || 0), 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{f.fullName || liveEmp.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {f.position || liveEmp.position} · {f.department || liveEmp.department}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={`badge ${liveEmp.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
              {liveEmp.status === 'active' ? 'Работает' : 'Уволен'}
            </span>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
            <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ padding: '4px 10px', fontSize: 12 }}>
              <Trash2 size={13} /> Удалить
            </button>
            {liveEmp.status === 'active'
              ? <button className="btn btn-secondary btn-sm" onClick={() => setShowDismissForm(true)} style={{ padding: '4px 10px', fontSize: 12 }}>
                  <UserX size={13} /> Уволить
                </button>
              : <button className="btn btn-success btn-sm" onClick={onRestore} style={{ padding: '4px 10px', fontSize: 12 }}>
                  <UserCheck size={13} /> Восстановить
                </button>
            }
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
            <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="tabs" style={{ padding: '0 24px', marginBottom: 0 }}>
          {['info', 'history', 'payrolls', 'absences'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'info' ? 'Информация' : t === 'history' ? 'История' : t === 'payrolls' ? 'Начисления' : '📅 График работы'}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ paddingTop: 16 }}>
          {tab === 'info' && (
            <div>
              {/* Строка 1: основные данные */}
              <div className="form-row-3" style={{ marginBottom: 14 }}>
                <div>
                  <div className="form-label">ФИО</div>
                  <input className="input" value={f.fullName} onChange={e => upd('fullName', e.target.value)} />
                </div>
                <div>
                  <div className="form-label">Статус</div>
                  <select className="select" value={f.status} onChange={e => upd('status', e.target.value)}>
                    <option value="active">Работает</option>
                    <option value="dismissed">Уволен</option>
                  </select>
                </div>
                <div>
                  <div className="form-label">Оклад (₽)</div>
                  <input type="number" className="input" min="0" value={f.salary} onChange={e => upd('salary', e.target.value)} />
                </div>
              </div>

              {/* Строка 2: даты */}
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div>
                  <div className="form-label">Дата приёма</div>
                  <input type="date" className="input" value={f.hireDate} onChange={e => upd('hireDate', e.target.value)} />
                  {f.hireDate && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      Стаж: {calcWorkDuration(f.hireDate, liveEmp.dismissDate)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="form-label">Должность</div>
                  <input list="em-positions" className="input" value={f.position} onChange={e => upd('position', e.target.value)} />
                  <datalist id="em-positions">{positions.map(p => <option key={p} value={p} />)}</datalist>
                </div>
              </div>

              {/* Строка 3: отдел / руководитель */}
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div>
                  <div className="form-label">Отдел</div>
                  <input list="em-depts" className="input" value={f.department} onChange={e => upd('department', e.target.value)} />
                  <datalist id="em-depts">{depts.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <div className="form-label">Руководитель</div>
                  <input list="em-managers" className="input" value={f.manager} onChange={e => upd('manager', e.target.value)} />
                  <datalist id="em-managers">{managers.map(m => <option key={m} value={m} />)}</datalist>
                </div>
              </div>

              {/* Условия сотрудничества */}
              <div style={{ padding: 14, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', marginBottom: 14 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>Условия сотрудничества</div>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="form-label">Формат сотрудничества</div>
                    <CustomSelect value={f.cooperationFormat} onChange={v => upd('cooperationFormat', v)} options={cooperationFormats}
                      onAdd={v => { const cur = state.settings?.cooperationFormats || []; if (!cur.includes(v)) dispatch({ type: 'UPDATE_SETTINGS', payload: { cooperationFormats: [...cur, v] } }) }}
                      placeholder="Выберите..." />
                  </div>
                  <div>
                    <div className="form-label">Тип занятости</div>
                    <CustomSelect value={f.employmentType} onChange={v => upd('employmentType', v)} options={employmentTypes}
                      onAdd={v => { const cur = state.settings?.employmentTypes || []; if (!cur.includes(v)) dispatch({ type: 'UPDATE_SETTINGS', payload: { employmentTypes: [...cur, v] } }) }}
                      placeholder="Выберите..." />
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="form-label">График работы</div>
                    <CustomSelect value={f.workSchedule} onChange={v => upd('workSchedule', v)} options={workSchedules}
                      onAdd={v => { const cur = state.settings?.workSchedules || []; if (!cur.includes(v)) dispatch({ type: 'UPDATE_SETTINGS', payload: { workSchedules: [...cur, v] } }) }}
                      placeholder="Выберите..." />
                  </div>
                  <div>
                    <div className="form-label">Формат работы</div>
                    <select className="select" value={f.workFormat} onChange={e => upd('workFormat', e.target.value)}>
                      <option value="">Выберите...</option>
                      <option value="офис">Офис</option>
                      <option value="удалённо">Удалённо</option>
                      <option value="гибрид">Гибрид</option>
                    </select>
                  </div>
                </div>
                {f.workFormat === 'гибрид' && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>ДНИ ГИБРИДНОГО ГРАФИКА</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {HYBRID_DAYS.map(([key, label]) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                          <select className="select" value={f.hybridDays[key] || ''} onChange={e => updDay(key, e.target.value)}>
                            <option value="">—</option>
                            {DAY_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Настройки выплат */}
              <div style={{ padding: 14, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: f.paymentSettings.useIndividualPaymentSettings ? 12 : 0 }}>
                  <input type="checkbox" id="em-ps" checked={f.paymentSettings.useIndividualPaymentSettings}
                    onChange={e => updPS('useIndividualPaymentSettings', e.target.checked)}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <label htmlFor="em-ps" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Индивидуальные настройки выплат</label>
                </div>
                {f.paymentSettings.useIndividualPaymentSettings && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-row">
                      <div>
                        <div className="form-label">Схема выплаты</div>
                        <select className="select" value={f.paymentSettings.paymentScheme} onChange={e => updPS('paymentScheme', e.target.value)}>
                          <option value="advance_and_salary">Аванс + зарплата</option>
                          <option value="single_payment">Вся зарплата одним платежом</option>
                          <option value="custom">Индивидуальная схема</option>
                        </select>
                      </div>
                      {f.paymentSettings.paymentScheme !== 'single_payment' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                          <input type="checkbox" id="em-adv" checked={f.paymentSettings.hasAdvance}
                            onChange={e => updPS('hasAdvance', e.target.checked)}
                            style={{ width: 15, height: 15, cursor: 'pointer' }} />
                          <label htmlFor="em-adv" style={{ fontSize: 13, cursor: 'pointer' }}>Есть аванс</label>
                        </div>
                      )}
                    </div>
                    <div className="form-row">
                      {f.paymentSettings.hasAdvance && f.paymentSettings.paymentScheme !== 'single_payment' && (
                        <div>
                          <div className="form-label">День аванса</div>
                          <select className="select" value={f.paymentSettings.advanceDay} onChange={e => updPS('advanceDay', Number(e.target.value))}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      )}
                      {f.paymentSettings.paymentScheme !== 'single_payment' && (
                        <div>
                          <div className="form-label">День зарплаты</div>
                          <select className="select" value={f.paymentSettings.salaryDay} onChange={e => updPS('salaryDay', Number(e.target.value))}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="form-label">Комментарий по выплатам</div>
                      <input className="input" placeholder="Например: оплачиваем полностью 30 числа"
                        value={f.paymentSettings.paymentComment}
                        onChange={e => updPS('paymentComment', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Комментарий */}
              <div style={{ marginBottom: 14 }}>
                <div className="form-label">Комментарий</div>
                <textarea className="textarea" rows={2} value={f.comment} onChange={e => upd('comment', e.target.value)} placeholder="Необязательно" />
              </div>

              {/* Кнопки сохранения — только если есть изменения */}
              {dirty && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: '#92400e', flex: 1, alignSelf: 'center' }}>Есть несохранённые изменения</span>
                  <button className="btn btn-primary btn-sm" onClick={save}><Save size={13} /> Сохранить</button>
                  <button className="btn btn-secondary btn-sm" onClick={reset}>Отмена</button>
                </div>
              )}

              {/* Всего выплачено */}
              <div style={{ marginBottom: 14, padding: 12, background: '#f8f9fb', borderRadius: 8 }}>
                <div className="form-label">Всего выплачено за всё время</div>
                <div className="money" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{formatMoney(totalPaid)}</div>
              </div>

              <PreferredBankSection employeeId={liveEmp.id} />
              <VacationPolicySection employeeId={liveEmp.id} />

              {showDismissForm && (
                <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div className="form-label">Дата увольнения</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input type="date" className="input" value={dismissDate} onChange={e => setDismissDate(e.target.value)} />
                    <button className="btn btn-danger" onClick={() => { onDismiss(dismissDate); setShowDismissForm(false) }}>Уволить</button>
                    <button className="btn btn-secondary" onClick={() => setShowDismissForm(false)}>Отмена</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div>
              {(liveEmp.salaryHistory?.length > 0 || liveEmp.positionHistory?.length > 0) ? (
                <>
                  {liveEmp.salaryHistory?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div className="section-title">История оклада</div>
                      <table className="table" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                        <thead><tr><th>Дата</th><th>Был</th><th>Стал</th></tr></thead>
                        <tbody>
                          {liveEmp.salaryHistory.map((h, i) => (
                            <tr key={i}>
                              <td>{formatDate(h.date)}</td>
                              <td className="money">{formatMoney(h.from)}</td>
                              <td className="money" style={{ color: 'var(--success)', fontWeight: 600 }}>{formatMoney(h.to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {liveEmp.positionHistory?.length > 0 && (
                    <div>
                      <div className="section-title">История должности</div>
                      <table className="table" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                        <thead><tr><th>Дата</th><th>Была</th><th>Стала</th></tr></thead>
                        <tbody>
                          {liveEmp.positionHistory.map((h, i) => (
                            <tr key={i}>
                              <td>{formatDate(h.date)}</td>
                              <td>{h.from}</td>
                              <td style={{ fontWeight: 600 }}>{h.to}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state"><div>История изменений пуста</div></div>
              )}
            </div>
          )}

          {tab === 'payrolls' && (
            <div>
              {payrolls.length > 0 ? (
                <table className="table" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  <thead>
                    <tr><th>Период</th><th>Начислено</th><th>Удержано</th><th>Остаток</th><th>Статус з/п</th></tr>
                  </thead>
                  <tbody>
                    {payrolls.map(p => (
                      <tr key={p.id}>
                        <td>{p.month}/{p.year}</td>
                        <td className="money">{formatMoney(p.totalEarned)}</td>
                        <td className="money">{formatMoney(p.totalDeducted)}</td>
                        <td className="money">{formatMoney(p.remaining)}</td>
                        <td>
                          <span className={`badge ${p.salaryStatus === 'paid' ? 'badge-success' : p.salaryStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                            {p.salaryStatus === 'paid' ? 'Выплачено' : p.salaryStatus === 'partial' ? 'Частично' : 'Не выплачено'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state"><div>Нет данных по начислениям</div></div>
              )}
            </div>
          )}

          {tab === 'absences' && <AbsencesTab employeeId={liveEmp.id} />}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export default function Employees({ onNavigate }) {
  const { state, dispatch } = useApp()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const filtered = useMemo(() => {
    return state.employees.filter(e => {
      const matchSearch = !search || e.fullName.toLowerCase().includes(search.toLowerCase())
      const matchDept = !filterDept || e.department === filterDept
      const matchManager = !filterManager || e.manager === filterManager
      const matchStatus = !filterStatus || e.status === filterStatus
      return matchSearch && matchDept && matchManager && matchStatus
    }).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ru'))
  }, [state.employees, search, filterDept, filterManager, filterStatus])

  const depts = useMemo(() => [...new Set(state.employees.map(e => e.department).filter(Boolean))], [state.employees])
  const managers = useMemo(() => [...new Set(state.employees.map(e => e.manager).filter(Boolean))], [state.employees])

  function handleDismiss(date) {
    dispatch({ type: 'DISMISS_EMPLOYEE', payload: { id: selectedEmployee.id, date } })
    setSelectedEmployee(prev => ({ ...prev, status: 'dismissed', dismissDate: date }))
  }

  function handleRestore() {
    dispatch({ type: 'RESTORE_EMPLOYEE', payload: selectedEmployee.id })
    setSelectedEmployee(null)
  }

  function handleDelete() {
    if (!confirm(`Удалить сотрудника ${selectedEmployee.fullName}? Это действие нельзя отменить.`)) return
    dispatch({ type: 'DELETE_EMPLOYEE', payload: selectedEmployee.id })
    setSelectedEmployee(null)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Сотрудники</div>
          <div className="page-subtitle">
            {state.employees.filter(e => e.status === 'active').length} активных,{' '}
            {state.employees.filter(e => e.status === 'dismissed').length} уволенных
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('addEmployee')}>
          <Plus size={14} /> Добавить сотрудника
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Поиск по ФИО..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="active">Работают</option>
          <option value="dismissed">Уволены</option>
        </select>
        <select className="select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">Все отделы</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="select" value={filterManager} onChange={e => setFilterManager(e.target.value)}>
          <option value="">Все руководители</option>
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        {(search || filterDept || filterManager || filterStatus) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterDept(''); setFilterManager(''); setFilterStatus('') }}>
            <X size={12} /> Сбросить
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={48} /></div>
          <h3>{state.employees.length === 0 ? 'Сотрудников пока нет' : 'Нет совпадений'}</h3>
          <p>{state.employees.length === 0 ? 'Добавьте первого сотрудника' : 'Попробуйте изменить фильтры'}</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th>Должность</th>
                <th>Руководитель</th>
                <th>Оклад</th>
                <th>Дата приёма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmployee(e)}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.fullName}</div>
                    {e.cooperationFormat && (() => {
                      const c = getFormatColors(e.cooperationFormat)
                      return <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: c.bg, color: c.text, fontWeight: 700, display: 'inline-block', marginTop: 3 }}>{e.cooperationFormat}</span>
                    })()}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.department || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.position || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.manager || '—'}</td>
                  <td className="money" style={{ fontWeight: 600 }}>{formatMoney(e.salary)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatDate(e.hireDate)}</td>
                  <td>
                    <span className={`badge ${e.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                      {e.status === 'active' ? 'Работает' : 'Уволен'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-icon btn-secondary" onClick={ev => { ev.stopPropagation(); setSelectedEmployee(e) }}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => { onNavigate('addEmployee', { editEmployee: selectedEmployee }); setSelectedEmployee(null) }}
          onDismiss={handleDismiss}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
