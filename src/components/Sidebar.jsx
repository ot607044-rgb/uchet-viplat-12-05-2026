import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, UserPlus, Calculator, CreditCard,
  FileText, Building2, BarChart2, Settings, ChevronRight, TrendingUp, CalendarDays, CalendarRange, Percent
} from 'lucide-react'
import { useApp } from '../context/AppContext'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: Users },
  { id: 'payroll', label: 'Начисление', icon: Calculator },
  { id: 'payrollTax', label: 'Налоги ФОТ', icon: Percent },
  { id: 'payments', label: 'Выплаты', icon: CreditCard },
  { id: 'payslips', label: 'Расчётные листки', icon: FileText },
  { id: 'schedule', label: 'График работы', icon: CalendarRange },
  { id: 'departments', label: 'Отделы', icon: Building2 },
  { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
  { id: 'finance', label: 'Фин. картина', icon: TrendingUp },
  { id: 'prodCalendar', label: 'Произв. календарь', icon: CalendarDays },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

export default function Sidebar({ activePage, onNavigate }) {
  const { state } = useApp()
  const companyName = state.settings?.companyName || 'Учет выплат'
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(v => setVersion(v))
    }
  }, [])

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: '#0f1629',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      borderRight: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Logo */}
      <div style={{
        padding: '22px 18px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CreditCard size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
              {companyName.length > 14 ? companyName.slice(0, 14) + '…' : companyName}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              Учет выплат
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'all 0.15s',
                background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.55)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                textAlign: 'left',
                position: 'relative'
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: 2,
                  background: '#3b82f6'
                }} />
              )}
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer info */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.25)',
        textAlign: 'center'
      }}>
        Данные хранятся локально
        {version && <div style={{ marginTop: 4 }}>v{version}</div>}
      </div>
    </aside>
  )
}
