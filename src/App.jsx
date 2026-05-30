import { useEffect } from 'react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import AddEmployee from './pages/AddEmployee';
import Payroll from './pages/Payroll';
import PayrollTax from './pages/PayrollTax';
import Payments from './pages/Payments';
import PaySlips from './pages/PaySlips';
import Departments from './pages/Departments';
import Analytics from './pages/Analytics';
import FinancialPicture from './pages/FinancialPicture';
import Settings from './pages/Settings';
import ProductionCalendar from './pages/ProductionCalendar';
import Schedule from './pages/Schedule';

const PAGES = {
  dashboard: Dashboard,
  employees: Employees,
  addEmployee: AddEmployee,
  payroll: Payroll,
  payrollTax: PayrollTax,
  payments: Payments,
  payslips: PaySlips,
  departments: Departments,
  analytics: Analytics,
  finance: FinancialPicture,
  settings: Settings,
  prodCalendar: ProductionCalendar,
  schedule: Schedule,
};

export default function App() {
  const { state, dispatch } = useApp();
  const { currentPage, pageProps = {}, settings } = state;

  useEffect(() => {
    document.body.style.backgroundColor = settings.backgroundColor || '#f8fafc';
  }, [settings.backgroundColor]);

  const PageComponent = PAGES[currentPage] || Dashboard;

  const navigate = (page, props = {}) =>
    dispatch({ type: 'SET_PAGE', payload: { page, props } });

  return (
    <div className="app-layout">
      <Sidebar activePage={currentPage} onNavigate={navigate} />
      <main className="main-content">
        <PageComponent onNavigate={navigate} {...pageProps} />
      </main>
    </div>
  );
}
