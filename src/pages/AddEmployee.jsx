import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { generateId, today } from '../utils/helpers'

function Field({ label, error, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{error}</div>}
    </div>
  )
}

function Datalist({ id, items }) {
  return (
    <datalist id={id}>
      {items.map(item => <option key={item} value={item} />)}
    </datalist>
  )
}

export function CustomSelect({ value, onChange, options, onAdd, placeholder = 'Выберите...' }) {
  const [adding, setAdding] = useState(false)
  const [newVal, setNewVal] = useState('')

  function confirm() {
    const v = newVal.trim()
    if (v) { onAdd(v); onChange(v) }
    setAdding(false); setNewVal('')
  }

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input" style={{ flex: 1 }} autoFocus
          placeholder="Введите значение..."
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setAdding(false); setNewVal('') } }}
        />
        <button className="btn btn-primary btn-sm" onClick={confirm}>Добавить</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setNewVal('') }}>Отмена</button>
      </div>
    )
  }

  return (
    <select className="select" value={value} onChange={e => {
      if (e.target.value === '__add__') setAdding(true)
      else onChange(e.target.value)
    }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add__">+ Добавить своё...</option>
    </select>
  )
}

export const HYBRID_DAYS = [
  ['mon', 'Понедельник'], ['tue', 'Вторник'], ['wed', 'Среда'],
  ['thu', 'Четверг'], ['fri', 'Пятница'], ['sat', 'Суббота'], ['sun', 'Воскресенье']
]
export const DAY_OPTS = ['офис', 'удалённо', 'выходной']

export const DEFAULT_HYBRID = { mon: 'офис', tue: 'офис', wed: 'офис', thu: 'офис', fri: 'офис', sat: 'выходной', sun: 'выходной' }

export const BASE_COOPERATION_FORMATS = ['ТК', 'ГПХ', 'Самозанятый', 'ИП', 'Прочее']
export const BASE_WORK_SCHEDULES = ['8 часов', '4 часа', '2 часа', '1 раз в неделю', 'Индивидуальный график', 'Прочее']
export const BASE_EMPLOYMENT_TYPES = ['Полная занятость', 'Частичная занятость', 'Проектная занятость', 'Временная занятость', 'Стажировка', 'Прочее']

export const PRESET_BANKS = [
  'Сбербанк', 'ВТБ', 'Альфа-Банк', 'Тинькофф', 'Газпромбанк',
  'Россельхозбанк', 'Совкомбанк', 'МТС Банк', 'Открытие', 'Райффайзен',
]

export const DEFAULT_PAYMENT_SETTINGS = {
  useIndividualPaymentSettings: false,
  hasAdvance: true,
  advanceDay: 30,
  salaryDay: 15,
  paymentScheme: 'advance_and_salary',
  paymentComment: ''
}

const EMPTY_FORM = {
  fullName: '',
  hireDate: today(),
  dismissDate: '',
  status: 'active',
  department: '',
  position: '',
  manager: '',
  salary: '',
  comment: '',
  cooperationFormat: '',
  workSchedule: '',
  workFormat: '',
  hybridDays: DEFAULT_HYBRID,
  employmentType: '',
  paymentSettings: { ...DEFAULT_PAYMENT_SETTINGS },
  preferredBank: ''
}

export default function AddEmployee({ editEmployee, onNavigate }) {
  const { state, dispatch } = useApp()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const isEdit = Boolean(editEmployee?.id)

  useEffect(() => {
    if (editEmployee) {
      setForm({
        ...EMPTY_FORM,
        ...editEmployee,
        salary: editEmployee.salary || '',
        hybridDays: { ...DEFAULT_HYBRID, ...(editEmployee.hybridDays || {}) },
        paymentSettings: { ...DEFAULT_PAYMENT_SETTINGS, ...(editEmployee.paymentSettings || {}) }
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [editEmployee])

  const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))]
  const managers = [...new Set(state.employees.map(e => e.manager).filter(Boolean))]
  const positions = [...new Set(state.employees.map(e => e.position).filter(Boolean))]

  const cooperationFormats = [
    ...BASE_COOPERATION_FORMATS,
    ...(state.settings?.cooperationFormats || []).filter(v => !BASE_COOPERATION_FORMATS.includes(v))
  ]
  const workSchedules = [
    ...BASE_WORK_SCHEDULES,
    ...(state.settings?.workSchedules || []).filter(v => !BASE_WORK_SCHEDULES.includes(v))
  ]
  const employmentTypes = [
    ...BASE_EMPLOYMENT_TYPES,
    ...(state.settings?.employmentTypes || []).filter(v => !BASE_EMPLOYMENT_TYPES.includes(v))
  ]

  function addToList(listName, value) {
    const current = state.settings[listName] || []
    if (current.includes(value)) return
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [listName]: [...current, value] } })
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function setDay(day, value) {
    setForm(f => ({ ...f, hybridDays: { ...f.hybridDays, [day]: value } }))
  }

  function setPS(field, value) {
    setForm(f => ({ ...f, paymentSettings: { ...f.paymentSettings, [field]: value } }))
  }

  function validate() {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Введите ФИО'
    if (!form.hireDate) errs.hireDate = 'Введите дату приёма'
    if (form.salary !== '' && isNaN(Number(form.salary))) errs.salary = 'Некорректная сумма'
    return errs
  }

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const payload = {
      ...form,
      salary: parseFloat(form.salary) || 0,
      id: editEmployee?.id || generateId(),
      positionHistory: editEmployee?.positionHistory || [],
      salaryHistory: editEmployee?.salaryHistory || [],
      hybridDays: form.workFormat === 'гибрид' ? form.hybridDays : DEFAULT_HYBRID
    }

    dispatch({ type: isEdit ? 'UPDATE_EMPLOYEE' : 'ADD_EMPLOYEE', payload })

    // Save custom cooperation format
    if (form.cooperationFormat && !BASE_COOPERATION_FORMATS.includes(form.cooperationFormat)) {
      const current = state.settings?.cooperationFormats || []
      if (!current.includes(form.cooperationFormat)) {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { cooperationFormats: [...current, form.cooperationFormat] } })
      }
    }
    // Save custom work schedule
    if (form.workSchedule && !BASE_WORK_SCHEDULES.includes(form.workSchedule)) {
      const current = state.settings?.workSchedules || []
      if (!current.includes(form.workSchedule)) {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { workSchedules: [...current, form.workSchedule] } })
      }
    }
    // Save custom employment type
    if (form.employmentType && !BASE_EMPLOYMENT_TYPES.includes(form.employmentType)) {
      const current = state.settings?.employmentTypes || []
      if (!current.includes(form.employmentType)) {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { employmentTypes: [...current, form.employmentType] } })
      }
    }

    setSaved(true)
    setTimeout(() => { setSaved(false); onNavigate('employees') }, 1000)
  }

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <div className="page-title">{isEdit ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</div>
          <div className="page-subtitle">{isEdit ? form.fullName : 'Заполните данные нового сотрудника'}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => onNavigate('employees')}>← Назад к списку</button>
      </div>

      <div className="card">
        {/* Личные данные */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Личные данные</div>
          <Field label="ФИО *" error={errors.fullName}>
            <input className="input" placeholder="Иванов Иван Иванович"
              value={form.fullName} onChange={e => set('fullName', e.target.value)} />
          </Field>
          <div className="form-row">
            <Field label="Дата приёма *" error={errors.hireDate}>
              <input type="date" className="input" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
            </Field>
            <Field label="Статус">
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Работает</option>
                <option value="dismissed">Уволен</option>
              </select>
            </Field>
          </div>
          {form.status === 'dismissed' && (
            <Field label="Дата увольнения">
              <input type="date" className="input" value={form.dismissDate} onChange={e => set('dismissDate', e.target.value)} />
            </Field>
          )}
        </div>

        <hr className="divider" />

        {/* Рабочие данные */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Рабочие данные</div>
          <div className="form-row-3">
            <Field label="Отдел">
              <input list="depts-list" className="input" placeholder="Выберите или введите"
                value={form.department} onChange={e => set('department', e.target.value)} />
              <Datalist id="depts-list" items={depts} />
            </Field>
            <Field label="Должность">
              <input list="positions-list" className="input" placeholder="Выберите или введите"
                value={form.position} onChange={e => set('position', e.target.value)} />
              <Datalist id="positions-list" items={positions} />
            </Field>
            <Field label="Руководитель">
              <input list="managers-list" className="input" placeholder="Выберите или введите"
                value={form.manager} onChange={e => set('manager', e.target.value)} />
              <Datalist id="managers-list" items={managers} />
            </Field>
          </div>
        </div>

        <hr className="divider" />

        {/* Оплата */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Оплата</div>
          <div className="form-row">
            <Field label="Оклад (₽)" error={errors.salary}>
              <input type="number" className="input input-mono" placeholder="0" min="0"
                value={form.salary} onChange={e => set('salary', e.target.value)} />
            </Field>
            <div />
          </div>
        </div>

        <hr className="divider" />

        {/* Условия сотрудничества */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Условия сотрудничества</div>

          <div className="form-row">
            <Field label="Формат сотрудничества">
              <CustomSelect
                value={form.cooperationFormat}
                onChange={v => set('cooperationFormat', v)}
                options={cooperationFormats}
                onAdd={v => addToList('cooperationFormats', v)}
                placeholder="Выберите формат..."
              />
            </Field>
            <Field label="Тип занятости">
              <CustomSelect
                value={form.employmentType}
                onChange={v => set('employmentType', v)}
                options={employmentTypes}
                onAdd={v => addToList('employmentTypes', v)}
                placeholder="Выберите тип..."
              />
            </Field>
          </div>

          <div className="form-row">
            <Field label="График работы">
              <CustomSelect
                value={form.workSchedule}
                onChange={v => set('workSchedule', v)}
                options={workSchedules}
                onAdd={v => addToList('workSchedules', v)}
                placeholder="Выберите график..."
              />
            </Field>
            <Field label="Формат работы">
              <select className="select" value={form.workFormat} onChange={e => set('workFormat', e.target.value)}>
                <option value="">Выберите формат...</option>
                <option value="офис">Офис</option>
                <option value="удалённо">Удалённо</option>
                <option value="гибрид">Гибрид</option>
              </select>
            </Field>
          </div>

          {/* Дни гибридного графика */}
          {form.workFormat === 'гибрид' && (
            <div style={{ marginTop: 4, padding: 16, background: '#f8f9fb', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Дни гибридного графика
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {HYBRID_DAYS.map(([key, label]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                    <select className="select" value={form.hybridDays[key] || ''} onChange={e => setDay(key, e.target.value)}>
                      <option value="">—</option>
                      {DAY_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Комментарий */}
        <Field label="Комментарий">
          <textarea className="textarea" rows={3} placeholder="Дополнительная информация..."
            value={form.comment} onChange={e => set('comment', e.target.value)} />
        </Field>

        <hr className="divider" />

        {/* Настройки выплат */}
        <div style={{ marginBottom: 8 }}>
          <div className="section-title">Настройки выплат</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: '#f8f9fb', borderRadius: 8, border: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              id="useIndividualPS"
              checked={form.paymentSettings.useIndividualPaymentSettings}
              onChange={e => setPS('useIndividualPaymentSettings', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="useIndividualPS" style={{ fontWeight: 600, cursor: 'pointer' }}>
              Использовать индивидуальные настройки выплат
            </label>
          </div>

          {!form.paymentSettings.useIndividualPaymentSettings && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, marginBottom: 12 }}>
              Сотрудник работает по общим настройкам приложения (аванс {state.settings?.advanceDay || 30}-го, зарплата {state.settings?.salaryDay || 15}-го)
            </div>
          )}

          {form.paymentSettings.useIndividualPaymentSettings && (
            <>
              <Field label="Схема выплаты">
                <select className="select" value={form.paymentSettings.paymentScheme} onChange={e => setPS('paymentScheme', e.target.value)}>
                  <option value="advance_and_salary">Аванс + зарплата</option>
                  <option value="single_payment">Вся зарплата одним платежом</option>
                  <option value="custom">Индивидуальная схема</option>
                </select>
              </Field>

              {form.paymentSettings.paymentScheme !== 'single_payment' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '8px 12px', background: '#f8f9fb', borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    id="hasAdvancePS"
                    checked={form.paymentSettings.hasAdvance}
                    onChange={e => setPS('hasAdvance', e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="hasAdvancePS" style={{ cursor: 'pointer' }}>Есть аванс</label>
                </div>
              )}

              {form.paymentSettings.hasAdvance && form.paymentSettings.paymentScheme !== 'single_payment' && (
                <Field label="День выплаты аванса">
                  <select className="select" value={form.paymentSettings.advanceDay} onChange={e => setPS('advanceDay', Number(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="День выплаты зарплаты">
                <select className="select" value={form.paymentSettings.salaryDay} onChange={e => setPS('salaryDay', Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field label="Комментарий по выплатам">
            <input
              className="input"
              placeholder="Например: оплачиваем полностью 30 числа"
              value={form.paymentSettings.paymentComment}
              onChange={e => setPS('paymentComment', e.target.value)}
            />
          </Field>

          <div style={{ marginTop: 4, padding: 14, background: '#f8f9fb', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Предпочтительный банк</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PRESET_BANKS.map(b => (
                <button key={b} type="button" onClick={() => set('preferredBank', form.preferredBank === b ? '' : b)}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${form.preferredBank === b ? '#3b82f6' : '#e5e7eb'}`,
                    background: form.preferredBank === b ? '#eff6ff' : 'white',
                    color: form.preferredBank === b ? '#1d4ed8' : 'var(--text-secondary)', transition: 'all 0.12s' }}>
                  {b}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" className="input input-sm" placeholder="Или введите свой банк..."
                value={form.preferredBank} onChange={e => set('preferredBank', e.target.value)}
                style={{ flex: 1 }} />
              {form.preferredBank && (
                <button type="button" onClick={() => set('preferredBank', '')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}>✕</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saved}>
            {saved ? '✓ Сохранено!' : isEdit ? 'Сохранить изменения' : 'Добавить сотрудника'}
          </button>
          {!isEdit && <button className="btn btn-secondary" onClick={() => setForm(EMPTY_FORM)}>Очистить</button>}
        </div>
      </div>
    </div>
  )
}
