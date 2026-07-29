import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { generateId, calcPayroll, calcUnofficialAdvance } from '../utils/helpers'

const AppContext = createContext(null)

// Производственный календарь России (рабочие дни по месяцам)
export const DEFAULT_PROD_CALENDAR = {
  2023: { 1:17, 2:18, 3:22, 4:20, 5:20, 6:21, 7:21, 8:23, 9:21, 10:22, 11:21, 12:21 },
  2024: { 1:17, 2:21, 3:21, 4:22, 5:18, 6:19, 7:23, 8:22, 9:21, 10:23, 11:20, 12:21 },
  2025: { 1:16, 2:18, 3:20, 4:22, 5:18, 6:20, 7:23, 8:21, 9:22, 10:23, 11:19, 12:22 },
  2026: { 1:15, 2:19, 3:21, 4:22, 5:18, 6:21, 7:23, 8:21, 9:22, 10:22, 11:21, 12:22 },
}

const DEFAULT_SETTINGS = {
  advanceDay: 30,
  salaryDay: 15,
  reminderDaysBefore: 3,
  backgroundColor: '#f8f9fb',
  companyName: 'Моя компания',
  maxFotPct: 35,
  criticalFotPct: 45,
  cooperationFormats: ['ТК', 'ГПХ', 'Самозанятый', 'ИП', 'Прочее'],
  workSchedules: ['8 часов', '4 часа', '2 часа', '1 раз в неделю', 'Индивидуальный график', 'Прочее'],
  employmentTypes: ['Полная занятость', 'Частичная занятость', 'Проектная занятость', 'Временная занятость', 'Стажировка', 'Прочее'],
  taxRates: {
    'ТК':          { ndfl: 13, sv: 30,   nsp: 0.2 },
    'ГПХ':         { ndfl: 13, sv: 27.1, nsp: 0   },
    'Самозанятый': { ndfl: 0,  sv: 0,    nsp: 0   },
    'ИП':          { ndfl: 0,  sv: 0,    nsp: 0   },
    'default':     { ndfl: 13, sv: 30,   nsp: 0.2 },
  },
  vacationOverlapRules: []
}

const initialState = {
  employees: [],
  payrolls: [],
  departments: [],
  managers: [],
  financeByMonth: [],
  absences: [],
  taxRecords: [],
  productionCalendar: DEFAULT_PROD_CALENDAR,
  settings: DEFAULT_SETTINGS,
  currentPage: 'dashboard',
  pageProps: {},
  loading: true
}

function recompute(payrolls) {
  return payrolls.map(p => {
    const { totalEarned, totalDeducted, remaining } = calcPayroll(p)
    return { ...p, totalEarned, totalDeducted, remaining }
  })
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD': {
      const data = action.payload
      // Merge production calendar: default values + saved user overrides
      const savedCal = data.productionCalendar || {}
      const mergedCal = { ...DEFAULT_PROD_CALENDAR }
      Object.keys(savedCal).forEach(year => {
        mergedCal[year] = { ...DEFAULT_PROD_CALENDAR[year], ...savedCal[year] }
      })
      return {
        ...state,
        employees: data.employees || [],
        payrolls: recompute(data.payrolls || []),
        departments: data.departments || [],
        managers: data.managers || [],
        financeByMonth: data.financeByMonth || [],
        absences: data.absences || [],
        taxRecords: data.taxRecords || [],
        productionCalendar: mergedCal,
        settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
        currentPage: 'dashboard',
        pageProps: {},
        loading: false
      }
    }

    // ── Employees ────────────────────────────────────────────────────────────
    case 'ADD_EMPLOYEE': {
      const emp = {
        ...action.payload,
        id: generateId(),
        positionHistory: [],
        salaryHistory: [],
        employmentHistory: action.payload.hireDate
          ? [{ type: 'hired', date: action.payload.hireDate }]
          : []
      }
      return { ...state, employees: [...state.employees, emp] }
    }
    case 'UPDATE_EMPLOYEE': {
      const employees = state.employees.map(e => {
        if (e.id !== action.payload.id) return e
        const updated = { ...e, ...action.payload }
        // Track position history
        if (action.payload.position && action.payload.position !== e.position) {
          updated.positionHistory = [...(e.positionHistory || []),
            { date: new Date().toISOString().slice(0, 10), from: e.position, to: action.payload.position }]
        }
        // Track salary history
        if (action.payload.salary !== undefined && action.payload.salary !== e.salary) {
          updated.salaryHistory = [...(e.salaryHistory || []),
            { date: new Date().toISOString().slice(0, 10), from: e.salary, to: action.payload.salary }]
        }
        return updated
      })
      return { ...state, employees }
    }
    case 'DELETE_EMPLOYEE': {
      return {
        ...state,
        employees: state.employees.filter(e => e.id !== action.payload),
        payrolls: state.payrolls.filter(p => p.employeeId !== action.payload)
      }
    }
    case 'DISMISS_EMPLOYEE': {
      const employees = state.employees.map(e =>
        e.id === action.payload.id
          ? {
              ...e,
              status: 'dismissed',
              dismissDate: action.payload.date,
              employmentHistory: [...(e.employmentHistory || []), { type: 'dismissed', date: action.payload.date }]
            }
          : e
      )
      return { ...state, employees }
    }
    case 'RESTORE_EMPLOYEE': {
      const id = action.payload.id ?? action.payload
      const date = action.payload.date ?? new Date().toISOString().slice(0, 10)
      const employees = state.employees.map(e =>
        e.id === id
          ? {
              ...e,
              status: 'active',
              dismissDate: null,
              hireDate: date,
              employmentHistory: [...(e.employmentHistory || []), { type: 'hired', date }]
            }
          : e
      )
      return { ...state, employees }
    }

    // ── Payrolls ─────────────────────────────────────────────────────────────
    case 'UPSERT_PAYROLL': {
      const p = action.payload
      const { totalEarned, totalDeducted, remaining } = calcPayroll(p)
      const computed = { ...p, totalEarned, totalDeducted, remaining }
      const exists = state.payrolls.find(x => x.id === p.id)
      const payrolls = exists
        ? state.payrolls.map(x => x.id === p.id ? computed : x)
        : [...state.payrolls, computed]
      return { ...state, payrolls }
    }
    case 'UPDATE_PAYROLL_FIELD': {
      const { id, field, value } = action.payload
      const payrolls = state.payrolls.map(p => {
        if (p.id !== id) return p
        const updated = { ...p, [field]: value }
        // Автоматически пересчитываем unofficialAdvance при изменении totalAdvance или officialAdvance
        if (field === 'totalAdvance' || field === 'officialAdvance') {
          updated.unofficialAdvance = calcUnofficialAdvance(updated.totalAdvance, updated.officialAdvance)
        }
        const { totalEarned, totalDeducted, remaining } = calcPayroll(updated)
        return { ...updated, totalEarned, totalDeducted, remaining }
      })
      return { ...state, payrolls }
    }
    case 'DELETE_PAYROLL': {
      return { ...state, payrolls: state.payrolls.filter(p => p.id !== action.payload) }
    }
    case 'COPY_PREVIOUS_MONTH': {
      const { month, year } = action.payload
      // Find previous month
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const prevPayrolls = state.payrolls.filter(p => p.month === prevMonth && p.year === prevYear)
      if (prevPayrolls.length === 0) return state
      // Check which employees don't have payrolls this month
      const existingIds = new Set(
        state.payrolls.filter(p => p.month === month && p.year === year).map(p => p.employeeId)
      )
      const firstDayOfMonth = new Date(year, month - 1, 1)
      const newPayrolls = prevPayrolls
        .filter(p => {
          if (existingIds.has(p.employeeId)) return false
          const emp = state.employees.find(e => e.id === p.employeeId)
          if (!emp) return false
          if (emp.hireDate && new Date(emp.hireDate) > new Date(year, month, 0)) return false
          if (emp.status === 'dismissed' && emp.dismissDate && new Date(emp.dismissDate) < firstDayOfMonth) return false
          return true
        })
        .map(p => {
          const emp = state.employees.find(e => e.id === p.employeeId)
          const newP = {
            ...p,
            id: generateId(),
            month,
            year,
            salaryAmount: emp?.salary || p.salaryAmount,
            bonus: 0,
            additionalEarnings: 0,
            vacationPay: 0,
            totalAdvance: 0,
            officialAdvance: 0,
            unofficialAdvance: 0,
            officialSalaryPart: 0,
            salaryOnAccount: 0,
            fine: 0,
            otherDeductions: 0,
            advanceStatus: 'unpaid',
            salaryStatus: 'unpaid',
            advancePayDate: null,
            salaryPayDate: null,
            comment: ''
          }
          const { totalEarned, totalDeducted, remaining } = calcPayroll(newP)
          return { ...newP, totalEarned, totalDeducted, remaining }
        })
      return { ...state, payrolls: [...state.payrolls, ...newPayrolls] }
    }

    // ── Absences ──────────────────────────────────────────────────────────────
    case 'ADD_ABSENCE': {
      const absence = { ...action.payload, id: generateId() }
      return { ...state, absences: [...state.absences, absence] }
    }
    case 'UPDATE_ABSENCE': {
      return {
        ...state,
        absences: state.absences.map(a => a.id === action.payload.id ? { ...a, ...action.payload } : a)
      }
    }
    case 'DELETE_ABSENCE': {
      return { ...state, absences: state.absences.filter(a => a.id !== action.payload) }
    }

    // ── Departments & Managers ────────────────────────────────────────────────
    case 'ADD_DEPARTMENT': {
      const dept = { id: generateId(), name: action.payload }
      return { ...state, departments: [...state.departments, dept] }
    }
    case 'UPDATE_DEPARTMENT': {
      return {
        ...state,
        departments: state.departments.map(d => d.id === action.payload.id ? action.payload : d)
      }
    }
    case 'DELETE_DEPARTMENT': {
      return { ...state, departments: state.departments.filter(d => d.id !== action.payload) }
    }
    case 'ADD_MANAGER': {
      const mgr = { id: generateId(), name: action.payload }
      return { ...state, managers: [...state.managers, mgr] }
    }
    case 'UPDATE_MANAGER': {
      return {
        ...state,
        managers: state.managers.map(m => m.id === action.payload.id ? action.payload : m)
      }
    }
    case 'DELETE_MANAGER': {
      return { ...state, managers: state.managers.filter(m => m.id !== action.payload) }
    }

    // ── Tax records ───────────────────────────────────────────────────────────
    // payload: { employeeId, month, year, officialBase, ndflOverride, svOverride }
    case 'UPSERT_TAX_RECORD': {
      const { employeeId, month, year } = action.payload
      const exists = state.taxRecords.find(
        r => r.employeeId === employeeId && r.month === month && r.year === year
      )
      const taxRecords = exists
        ? state.taxRecords.map(r =>
            r.employeeId === employeeId && r.month === month && r.year === year
              ? { ...r, ...action.payload }
              : r
          )
        : [...state.taxRecords, action.payload]
      return { ...state, taxRecords }
    }

    // ── Finance ───────────────────────────────────────────────────────────────
    case 'UPSERT_FINANCE': {
      const { month, year } = action.payload
      const exists = state.financeByMonth.find(f => f.month === month && f.year === year)
      const financeByMonth = exists
        ? state.financeByMonth.map(f => (f.month === month && f.year === year) ? action.payload : f)
        : [...state.financeByMonth, action.payload]
      return { ...state, financeByMonth }
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.payload } }
    }

    // ── Production Calendar ───────────────────────────────────────────────────
    case 'UPDATE_PROD_CALENDAR': {
      const { year, month, workingDays } = action.payload
      return {
        ...state,
        productionCalendar: {
          ...state.productionCalendar,
          [year]: { ...(state.productionCalendar[year] || {}), [month]: workingDays }
        }
      }
    }
    case 'RESET_PROD_CALENDAR_YEAR': {
      const year = action.payload
      return {
        ...state,
        productionCalendar: { ...state.productionCalendar, [year]: { ...DEFAULT_PROD_CALENDAR[year] } }
      }
    }

    case 'DELETE_FINANCE': {
      const { month, year } = action.payload
      return { ...state, financeByMonth: state.financeByMonth.filter(f => !(f.month === month && f.year === year)) }
    }

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload.page, pageProps: action.payload.props || {} }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const saveTimer = useRef(null)
  const isFirstLoad = useRef(true)

  // Load data on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.loadData().then(data => {
        dispatch({ type: 'LOAD', payload: data })
      })
    } else {
      // Browser fallback for development without Electron
      const raw = localStorage.getItem('payroll-data')
      if (raw) {
        try { dispatch({ type: 'LOAD', payload: JSON.parse(raw) }) }
        catch { dispatch({ type: 'LOAD', payload: {} }) }
      } else {
        dispatch({ type: 'LOAD', payload: {} })
      }
    }
  }, [])

  // Auto-save with debounce
  useEffect(() => {
    if (state.loading) return
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const data = {
        employees: state.employees,
        payrolls: state.payrolls,
        departments: state.departments,
        managers: state.managers,
        financeByMonth: state.financeByMonth,
        absences: state.absences,
        taxRecords: state.taxRecords,
        productionCalendar: state.productionCalendar,
        settings: state.settings
      }
      if (window.electronAPI) {
        window.electronAPI.saveData(data)
      } else {
        localStorage.setItem('payroll-data', JSON.stringify(data))
      }
    }, 800)
    return () => clearTimeout(saveTimer.current)
  }, [state])

  const exportJSON = useCallback(async () => {
    const data = {
      employees: state.employees,
      payrolls: state.payrolls,
      departments: state.departments,
      managers: state.managers,
      financeByMonth: state.financeByMonth,
      absences: state.absences,
      taxRecords: state.taxRecords,
      productionCalendar: state.productionCalendar,
      settings: state.settings
    }
    if (window.electronAPI) {
      return window.electronAPI.exportJSON(data)
    }
  }, [state])

  const importJSON = useCallback(async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.importJSON()
    if (result.ok && result.data) {
      dispatch({ type: 'LOAD', payload: result.data })
      return true
    }
    return false
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, exportJSON, importJSON }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
