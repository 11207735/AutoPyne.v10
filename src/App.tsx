import { useState, useEffect, useMemo, useRef, FormEvent, MouseEvent, SVGProps } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { AutoPyneIntro, AutoPyneLogo, AutoPyneIcon, AutoPyneHeaderBrand, ManagerData } from './components/AutoPyneIntro';
import { StaffProfilesView } from './components/StaffProfilesView';
import { QuadsAndCamelsFleetView } from './components/QuadsAndCamelsFleetView';
import { ExtraFundsAndExpensesView } from './components/ExtraFundsAndExpensesView';
import { ExcelWorkbooksView } from './components/ExcelWorkbooksView';
import { ManagerProfileView } from './components/ManagerProfileView';
import { AccountsView } from './components/AccountsView';
import {
  IdManagerView,
  RegisteredGuide,
  RegisteredDriver,
  getStoredGuides,
  saveGuidesToStorage,
  getStoredDrivers,
  saveDriversToStorage
} from './components/IdManagerView';
import {
  PaymentsDetailsModal,
  PaymentRates,
  getStoredPaymentRates,
  savePaymentRatesToStorage,
  DEFAULT_PAYMENT_RATES
} from './components/PaymentsDetailsModal';
import { AgmDragFolderModal } from './components/AgmDragFolderModal';
import { FileSystemPermissionModal } from './components/FileSystemPermissionModal';
import { 
  AgmRestoreResult,
  initSqliteDatabase,
  getAllTripsSql,
  insertTripSql,
  updateTripSql,
  deleteTripSql,
  bulkInsertTripsSql,
  queryTripsWithPaginationSql
} from './utils/agmWorkspaceManager';
import { resolveGuide, resolveDriver } from './utils/staffResolver';
import { parseExtraCount } from './utils/extraCountUtils';
import { backProCodeString } from './utils/backProSource';
import { 
  Pencil, 
  X, 
  Check, 
  Copy, 
  Laptop, 
  Info, 
  RefreshCw, 
  Plus, 
  FileCode,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Database,
  Layout,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Bus,
  Compass,
  BarChart3,
  Users,
  Search,
  Filter,
  ArrowLeft,
  Trash2,
  Building2,
  Download,
  Printer,
  Table,
  Sparkles,
  User,
  UserX,
  Settings,
  Bell,
  QrCode,
  List,
  Grid,
  SlidersHorizontal,
  MoreHorizontal,
  Package,
  RotateCcw,
  UserPlus,
  Shield,
  Flame,
  Lock,
  GraduationCap,
  Award,
  Briefcase,
  LayoutDashboard,
  TrendingUp,
  FileText,
  ClipboardList,
  Bike,
  Footprints,
  Cloud,
  HelpCircle,
  Calculator,
  Coins,
  IdCard,
  FolderUp,
  FolderSync,
  FolderLock,
  FolderCheck,
  HardDrive,
  DollarSign,
  Wallet,
  Utensils,
  UtensilsCrossed,
  Moon,
  Sun
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: () => boolean;
      init: () => Promise<any>;
      load: () => Promise<any>;
      addUpdate: (record: any) => Promise<any>;
      delete: (id: number) => Promise<any>;
      sync: () => Promise<any>;
      checkToday: () => Promise<any>;
    };
  }
}

export interface DriverItemData {
  driver: string;
  van_type: 'Big van' | 'Mini van';
  company?: string;
  pax?: string;
}

export interface DriverInput {
  id: string;
  driverId?: string;
  driverName: string;
  vanType: 'Big van' | 'Mini van';
  companyName: string;
  pax?: string;
}

export interface KnownDriverInfo {
  name: string;
  id?: string;
  vanType: 'Big van' | 'Mini van';
  companyName: string;
  originCity?: string;
  phone?: string;
  isRegistered?: boolean;
  tripCount?: number;
}

interface ResultItem {
  id: number;
  van_type?: string;
  guide: string;
  driver: string;
  company?: string;
  pax: string;
  quads: string;
  camels: string;
  person_extra?: string;
  quad_extra?: string;
  camel_extra?: string;
  extra_payment?: string;
  person_extra_pay?: string;
  quad_extra_pay?: string;
  camel_extra_pay?: string;
  meal?: 'None' | 'Lunch' | 'Dinner' | 'Both' | string;
  date: string;
  time: string;
  status?: 'Logged' | 'Confirmed' | 'Cancelled';
  driversList?: DriverItemData[];
}

export interface StaffProfile {
  id: string;
  guideId?: string;
  driverId?: string;
  name: string;
  nickname?: string;
  role: 'guide' | 'big_driver' | 'mini_driver';
  initial: string;
  daysWorked: number;
  totalTrips: number;
  totalPax: number;
  totalQuads: number;
  totalCamels: number;
  companiesSet?: Set<string>;
  companyName?: string;
  datesWorked: {
    date: string;
    trips: ResultItem[];
    dayPax: number;
    dayQuads: number;
    dayCamels: number;
  }[];
}

// Levenshtein distance calculation for fuzzy matching guide/driver typos
function getLevenshteinDistance(s1: string, s2: string): number {
  if (s1.length < s2.length) return getLevenshteinDistance(s2, s1);
  if (s2.length === 0) return s1.length;
  let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    previousRow = currentRow;
  }
  return previousRow[previousRow.length - 1];
}

// Find canonical guide/driver name from list using fuzzy distance
function getCanonicalName(inputName: string, knownNames: string[]): string {
  const cleaned = inputName.trim().toUpperCase();
  if (!cleaned || cleaned === 'WITHOUT GUIDE' || cleaned === '?') {
    return cleaned;
  }

  // Exact match first
  for (const known of knownNames) {
    if (cleaned === known.trim().toUpperCase()) {
      return known;
    }
  }

  let bestMatch = cleaned;
  let minDist = 999;

  for (const known of knownNames) {
    const kUpper = known.trim().toUpperCase();
    if (!kUpper || kUpper === 'WITHOUT GUIDE' || kUpper === '?') continue;

    const dist = getLevenshteinDistance(cleaned, kUpper);
    const maxAllowed = cleaned.length <= 4 ? 1 : cleaned.length <= 8 ? 2 : 3;
    if (dist <= maxAllowed && dist < minDist) {
      minDist = dist;
      bestMatch = known;
    }
  }

  return bestMatch;
}

function parseDateParts(dStr?: string) {
  const today = new Date();
  let dayNum = today.getDate();
  let monthNum = today.getMonth() + 1;
  let yearNum = today.getFullYear();

  if (dStr) {
    const clean = dStr.trim();
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        yearNum = parseInt(parts[0], 10) || yearNum;
        monthNum = parseInt(parts[1], 10) || monthNum;
        dayNum = parseInt(parts[2], 10) || dayNum;
      } else {
        // DD-MM-YYYY
        dayNum = parseInt(parts[0], 10) || dayNum;
        monthNum = parseInt(parts[1], 10) || monthNum;
        yearNum = parseInt(parts[2], 10) || yearNum;
      }
    }
  }

  const rawDay = String(dayNum).padStart(2, '0');
  const rawMonth = String(monthNum).padStart(2, '0');
  const rawYear = String(yearNum);
  const fullDate = `${rawDay}-${rawMonth}-${rawYear}`;

  return { day: dayNum, month: monthNum, year: yearNum, rawDay, rawMonth, rawYear, fullDate };
}

const MONTH_NAMES_MAP: { [key: string]: string } = {
  '01': '01 - January',
  '02': '02 - February',
  '03': '03 - March',
  '04': '04 - April',
  '05': '05 - May',
  '06': '06 - June',
  '07': '07 - July',
  '08': '08 - August',
  '09': '09 - September',
  '10': '10 - October',
  '11': '11 - November',
  '12': '12 - December',
};

function getRecordMonth(dStr?: string): string {
  if (!dStr) {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${month}-${today.getFullYear()}`;
  }
  const clean = dStr.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else {
        return `${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else {
        return `${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
    }
  }
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${month}-${today.getFullYear()}`;
}

export default function App() {
  // Direct scroll references for instant wheel scrolling everywhere
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const tripsListRef = useRef<HTMLDivElement>(null);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'management' | 'compiler' | 'backPro'>('management');
  const [copiedBackPro, setCopiedBackPro] = useState(false);

  // Helper for current month key
  const getCurrentMonthKey = () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${month}-${today.getFullYear()}`;
  };

  // Form states matching new requested inputs
  const [vanType, setVanType] = useState<'Big van' | 'Mini van'>('Big van');
  const [guideName, setGuideName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [companyName, setCompanyName] = useState('AGM');
  const [paxCount, setPaxCount] = useState('');
  const [quadsCount, setQuadsCount] = useState('');
  const [camelsCount, setCamelsCount] = useState('');
  const [mealOption, setMealOption] = useState<'Unselected' | 'None' | 'Lunch' | 'Dinner' | 'Both'>('Unselected');
  const [guideIdInput, setGuideIdInput] = useState('');
  const [withoutGuide, setWithoutGuide] = useState<boolean>(false);
  const [dailyLoggedSearchQuery, setDailyLoggedSearchQuery] = useState<string>('');
  const [dailyLoggedFilter, setDailyLoggedFilter] = useState<'all' | 'rest' | 'done'>('all');
  
  // Multi-Driver state (supports 1, 2, 3, 4, 5+ drivers per trip)
  // By default: 'name' (Work Without ID) until manager explicitly toggles to 'id' in Drivers Roster
  const [driverIdMode, setDriverIdMode] = useState<'id' | 'name'>(() => {
    try {
      return (localStorage.getItem('agm_driver_id_mode') as 'id' | 'name') || 'name';
    } catch {
      return 'name';
    }
  });

  const handleDriverIdModeChange = (mode: 'id' | 'name') => {
    setDriverIdMode(mode);
    try {
      localStorage.setItem('agm_driver_id_mode', mode);
    } catch {}
  };

  const [driversInput, setDriversInput] = useState<DriverInput[]>([
    { id: '1', driverId: '', driverName: '', vanType: 'Big van', companyName: 'AGM', pax: '' }
  ]);

  const [driverToRemoveId, setDriverToRemoveId] = useState<string | null>(null);

  const requestRemoveDriver = (id: string) => {
    if (driversInput.length <= 1) return;
    setDriverToRemoveId(id);
  };

  const confirmRemoveDriver = () => {
    if (!driverToRemoveId) return;
    setDriversInput(prev => prev.filter(d => d.id !== driverToRemoveId));
    setDriverToRemoveId(null);
    showNotification("Driver removed from assignment.");
  };

  const addDriverInput = () => {
    setDriversInput(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), driverId: '', driverName: '', vanType: 'Big van', companyName: 'AGM', pax: '' }
    ]);
  };

  const removeDriverInput = (id: string) => {
    requestRemoveDriver(id);
  };

  const updateDriverInput = (id: string, field: keyof DriverInput, value: string) => {
    setDriversInput(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        if (field === 'driverName') {
          const raw = value.trim().toUpperCase();
          if (raw) {
            // Find registered or previously known driver match to auto-populate company
            const regExact = registeredDrivers.find(rd => rd.name.toUpperCase() === raw);
            if (regExact) {
              if (regExact.companyName) updated.companyName = regExact.companyName.toUpperCase();
              if (regExact.vanType) updated.vanType = regExact.vanType;
              if (regExact.id) updated.driverId = regExact.id;
            } else {
              // Search in past results for company of this driver
              let foundComp = '';
              let foundVan: 'Big van' | 'Mini van' | undefined;
              for (const r of results) {
                if (r.driversList && r.driversList.length > 0) {
                  for (const drv of r.driversList) {
                    if (drv.driver && drv.driver.trim().toUpperCase() === raw && drv.company) {
                      foundComp = drv.company.toUpperCase();
                      if (drv.van_type) foundVan = drv.van_type as any;
                      break;
                    }
                  }
                } else if (r.driver && r.driver.trim().toUpperCase() === raw && r.company) {
                  foundComp = r.company.toUpperCase();
                  if (r.van_type) foundVan = r.van_type as any;
                  break;
                }
                if (foundComp) break;
              }
              if (foundComp) {
                updated.companyName = foundComp;
                if (foundVan) updated.vanType = foundVan;
              } else if (raw.length >= 2) {
                // Prefix match on registered drivers if user starts typing
                const regPrefix = registeredDrivers.find(rd => rd.name.toUpperCase().startsWith(raw));
                if (regPrefix && regPrefix.companyName && (!d.companyName || d.companyName === 'AGM')) {
                  updated.companyName = regPrefix.companyName.toUpperCase();
                }
              }
            }
          }
        }
        return updated;
      }
      return d;
    }));
  };

  // Driver ID input handler with live auto-fill for Driver Name, Van Type, and Company (Numbers only)
  const handleDriverIdChange = (id: string, newIdVal: string) => {
    const numericVal = newIdVal.replace(/\D/g, '').slice(0, 6);
    setDriversInput(prev => prev.map(d => {
      if (d.id === id) {
        const match = registeredDrivers.find(rd => {
          if (!rd.id) return false;
          const cleanRdId = rd.id.replace(/\D/g, '');
          return cleanRdId === numericVal || (numericVal.length >= 2 && cleanRdId.startsWith(numericVal));
        });
        if (match) {
          return {
            ...d,
            driverId: numericVal,
            driverName: match.name,
            vanType: match.vanType,
            companyName: match.companyName || 'AGM'
          };
        }
        return { ...d, driverId: numericVal };
      }
      return d;
    }));
  };

  const getMatchedDriverForInput = (d: DriverInput) => {
    const q = (d.driverId || d.driverName || '').trim().toUpperCase();
    if (!q) return null;
    // 1. Direct ID match
    const byId = registeredDrivers.find(rd => rd.id && rd.id.toUpperCase() === q);
    if (byId) return byId;

    // 2. Numeric 6-digit match
    const numOnly = q.replace(/[^0-9]/g, '');
    if (numOnly) {
      const byNum = registeredDrivers.find(rd => {
        if (!rd.id) return false;
        const dNum = rd.id.replace(/[^0-9]/g, '');
        return dNum === numOnly || (dNum.length === 6 && numOnly.length >= 2 && dNum.startsWith(numOnly));
      });
      if (byNum) return byNum;
    }

    // 3. Name exact match
    const byName = registeredDrivers.find(rd => rd.name.toUpperCase() === q);
    return byName || null;
  };
  
  // Extra input states (Default: 'None' / '0 DH' until chosen)
  const [personExtra, setPersonExtra] = useState<string>('None');
  const [quadExtra, setQuadExtra] = useState<string>('None');
  const [camelExtra, setCamelExtra] = useState<string>('None');
  const [personExtraPay, setPersonExtraPay] = useState<string>('0 DH');
  const [quadExtraPay, setQuadExtraPay] = useState<string>('0 DH');
  const [camelExtraPay, setCamelExtraPay] = useState<string>('0 DH');
  const [extraPayment, setExtraPayment] = useState<string>('0 DH');
  const [activeExtraTab, setActiveExtraTab] = useState<'none' | 'person' | 'quad' | 'camel'>('none');

  const getExtraStatusStyle = (type: 'person' | 'quad' | 'camel') => {
    let countVal = 'None';
    let payVal = '';

    if (type === 'person') {
      countVal = personExtra;
      payVal = personExtraPay;
    } else if (type === 'quad') {
      countVal = quadExtra;
      payVal = quadExtraPay;
    } else if (type === 'camel') {
      countVal = camelExtra;
      payVal = camelExtraPay;
    }

    const isTabActive = activeExtraTab === type;
    const isAnyTabActive = activeExtraTab !== 'none';
    const hasCount = countVal !== 'None' && countVal.trim() !== '' && countVal !== '0';
    const cleanPay = payVal.replace(/[^0-9]/g, '').trim();
    const hasPay = cleanPay !== '' && cleanPay !== '0';

    // Highlight active tab & dim inactive tabs
    let activeDimStyle = 'transition-all duration-200';
    if (isAnyTabActive) {
      if (isTabActive) {
        activeDimStyle += ' opacity-100 scale-[1.03] shadow-lg z-10';
      } else {
        activeDimStyle += ' opacity-30 hover:opacity-75 scale-95 grayscale-[20%]';
      }
    }

    // State 1: GREEN -> User entered BOTH number and pay number
    if (hasCount && hasPay) {
      return {
        btnClass: `bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)] ${activeDimStyle}`,
        statusTag: `${countVal} | ${payVal.includes('DH') ? payVal : payVal + ' DH'}`,
        badgeClass: 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50',
        isConfigured: true
      };
    }

    // State 2: ORANGE -> User entered count OR pay number (partial)
    if (hasCount || hasPay) {
      return {
        btnClass: `bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)] ${activeDimStyle}`,
        statusTag: hasCount ? `${countVal} (Pay ?)` : `Pay ${payVal} (# ?)`,
        badgeClass: 'bg-amber-500/30 text-amber-300 border border-amber-500/50',
        isConfigured: true
      };
    }

    // State 3: RED -> Clicked / Selected extra tab, but NOTHING is entered
    if (isTabActive || countVal !== 'None') {
      return {
        btnClass: `bg-rose-500/20 border-rose-500 text-rose-400 font-bold shadow-[0_0_12px_rgba(244,63,94,0.3)] ${activeDimStyle}`,
        statusTag: 'Empty',
        badgeClass: 'bg-rose-500/30 text-rose-300 border border-rose-500/50',
        isConfigured: true
      };
    }

    // State 4: Default / Unselected
    return {
      btnClass: `bg-[#050b0e] border-[#182e3b] text-zinc-400 hover:text-white ${activeDimStyle}`,
      statusTag: 'Off',
      badgeClass: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
      isConfigured: false
    };
  };

  const clearExtra = (type: 'person' | 'quad' | 'camel', e?: MouseEvent) => {
    if (e) e.stopPropagation();
    if (type === 'person') {
      setPersonExtra('None');
      setPersonExtraPay('0 DH');
      if (activeExtraTab === 'person') setActiveExtraTab('none');
    } else if (type === 'quad') {
      setQuadExtra('None');
      setQuadExtraPay('0 DH');
      if (activeExtraTab === 'quad') setActiveExtraTab('none');
    } else if (type === 'camel') {
      setCamelExtra('None');
      setCamelExtraPay('0 DH');
      if (activeExtraTab === 'camel') setActiveExtraTab('none');
    }
  };

  // Hedgefund Design System States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All Trips');
  const [activeSubTab, setActiveSubTab] = useState<string>('Setup');
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Inventar UI design states
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [activeRowMenuId, setActiveRowMenuId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'pending'>('all');

  // Intro screen opening page state (Shows AutoPyne logo in middle on project open)
  const [showIntroScreen, setShowIntroScreen] = useState<boolean>(true);

  // Interactive Excel sheet viewer modal state (Filtered by Year -> Month -> Day)
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [excelSelectedYear, setExcelSelectedYear] = useState<string>(() => {
    const today = new Date();
    return String(today.getFullYear());
  });
  const [excelSelectedMonth, setExcelSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, '0');
  });
  const [excelSelectedDay, setExcelSelectedDay] = useState<string>('ALL');
  const [expandedDaysMap, setExpandedDaysMap] = useState<{ [date: string]: boolean }>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Active Navigation Tab for Left Sidebar
  const [activeNavTab, setActiveNavTab] = useState<string>('dashboard');

  // Date and Time inputs initialized to reference values
  const [dateStr, setDateStr] = useState('01-08-2026');
  const [timeStr, setTimeStr] = useState('10:31');
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  const [hasExcelPermission, setHasExcelPermission] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('agm_excel_permission');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [recordsViewMode, setRecordsViewMode] = useState<'daily' | 'monthly_summary'>('daily');
  
  // Staff Directory Profiles Modal States
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);
  const [showFleetModal, setShowFleetModal] = useState<boolean>(false);
  const [showExtraFundsModal, setShowExtraFundsModal] = useState<boolean>(false);
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<StaffProfile | null>(null);
  const [staffActiveTab, setStaffActiveTab] = useState<'all' | 'guides' | 'big_drivers' | 'mini_drivers'>('all');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  
  // Monthly Guides & Drivers Slide Half-Page Drawer States
  const [showMonthlySlideOver, setShowMonthlySlideOver] = useState<boolean>(false);
  const [monthlySlideSearchName, setMonthlySlideSearchName] = useState<string>('');
  const [monthlySlideMonthFilter, setMonthlySlideMonthFilter] = useState<string>('ALL');
  const [monthlySlideDayFilter, setMonthlySlideDayFilter] = useState<string>('');
  const [monthlySlideTab, setMonthlySlideTab] = useState<'guides' | 'big_drivers' | 'mini_drivers' | 'companies'>('guides');
  const [monthlySlideSelectedId, setMonthlySlideSelectedId] = useState<string | null>(null);
  const [monthlySlideSelectedStaffInfo, setMonthlySlideSelectedStaffInfo] = useState<{ id: string; name: string; role: 'guide' | 'big_driver' | 'mini_driver' | 'company' } | null>(null);
  const [companyVehicleFilter, setCompanyVehicleFilter] = useState<'all' | 'big' | 'mini'>('all');
  const [companyTabFilter, setCompanyTabFilter] = useState<'all' | 'big' | 'mini' | 'both'>('all');
  
  // Registered Guides and Drivers for ID System
  const [registeredGuides, setRegisteredGuides] = useState<RegisteredGuide[]>(() => getStoredGuides());
  const [registeredDrivers, setRegisteredDrivers] = useState<RegisteredDriver[]>(() => getStoredDrivers());
  const [showIdManagerModal, setShowIdManagerModal] = useState<boolean>(false);

  // Payment rates & calculations states
  const [paymentRates, setPaymentRates] = useState<PaymentRates>(() => getStoredPaymentRates());
  const [showPaymentsDetailsModal, setShowPaymentsDetailsModal] = useState<boolean>(false);
  const [showAccountsModal, setShowAccountsModal] = useState<boolean>(false);

  // Recent Activity slide-over drawer states
  const [showRecentActivitySlideOver, setShowRecentActivitySlideOver] = useState<boolean>(false);
  const [recentActivityFilter, setRecentActivityFilter] = useState<'all' | 'Logged' | 'Confirmed' | 'Cancelled'>('all');
  const [recentActivitySearch, setRecentActivitySearch] = useState<string>('');

  // Delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<ResultItem | null>(null);

  // Managers & Admin Portal states
  const [managersList, setManagersList] = useState<ManagerData[]>(() => {
    try {
      const saved = localStorage.getItem('agm_managers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentManager, setCurrentManager] = useState<ManagerData | null>(() => {
    try {
      const saved = localStorage.getItem('agm_current_manager');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Admin Login modal states
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>('ismail@admin.com');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Active Manager Profile Modal State (Triggered by Profile 'A')
  const [showManagerProfileModal, setShowManagerProfileModal] = useState<boolean>(false);

  // Manager Management Dashboard / Users list page
  const [showManagerDashboard, setShowManagerDashboard] = useState<boolean>(false);

  // Add Manager Form modal states
  const [showAddManagerModal, setShowAddManagerModal] = useState<boolean>(false);
  const [newMgrName, setNewMgrName] = useState<string>('');
  const [newMgrLastname, setNewMgrLastname] = useState<string>('');
  const [newMgrSchool, setNewMgrSchool] = useState<string>('');
  const [newMgrSkill, setNewMgrSkill] = useState<string>('IT Student Software Developer...');

  // Ismail Password Re-Confirmation Square modal
  const [showConfirmPasswordModal, setShowConfirmPasswordModal] = useState<boolean>(false);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  
  const [hasStartedWork, setHasStartedWork] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('agm_has_started_work');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Initial Results dataset starts empty as requested by the user, now locally persisted
  const [results, setResults] = useState<ResultItem[]>(() => {
    try {
      const saved = localStorage.getItem('agm_results');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // AGM-WorkSpace Standalone Hub & Drag Folder Modal State
  const [showAgmDragFolderModal, setShowAgmDragFolderModal] = useState<boolean>(false);
  const [showFilePermissionModal, setShowFilePermissionModal] = useState<boolean>(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Restore handler when user drops or imports AGM-WorkSpace folder
  const handleRestoreAgmWorkspace = (restored: AgmRestoreResult) => {
    if (restored.trips && restored.trips.length > 0) {
      bulkInsertTripsSql(restored.trips).catch(console.warn);
      setResults(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newTrips = restored.trips.filter(t => !existingIds.has(t.id));
        const merged = [...newTrips, ...prev];
        try {
          localStorage.setItem('agm_results', JSON.stringify(merged));
        } catch {}
        return merged;
      });
    }

    if (restored.guides && restored.guides.length > 0) {
      setRegisteredGuides(prev => {
        const map = new Map<string, RegisteredGuide>(prev.map(g => [g.id, g]));
        restored.guides.forEach(g => map.set(g.id, g));
        const merged: RegisteredGuide[] = Array.from(map.values());
        saveGuidesToStorage(merged);
        return merged;
      });
    }

    if (restored.drivers && restored.drivers.length > 0) {
      setRegisteredDrivers(prev => {
        const map = new Map<string, RegisteredDriver>(prev.map(d => [d.id || d.name, d]));
        restored.drivers.forEach(d => map.set(d.id || d.name, d));
        const merged: RegisteredDriver[] = Array.from(map.values());
        saveDriversToStorage(merged);
        return merged;
      });
    }

    if (restored.managers && restored.managers.length > 0) {
      setManagersList(prev => {
        const map = new Map<string, ManagerData>(prev.map(m => [m.id, m]));
        restored.managers.forEach(m => map.set(m.id, m));
        const merged: ManagerData[] = Array.from(map.values());
        try {
          localStorage.setItem('agm_managers', JSON.stringify(merged));
        } catch {}
        return merged;
      });

      if (!currentManager && restored.managers[0]) {
        setCurrentManager(restored.managers[0]);
        try {
          localStorage.setItem('agm_current_manager', JSON.stringify(restored.managers[0]));
        } catch {}
      }
    }

    if (restored.paymentRates) {
      setPaymentRates(restored.paymentRates);
      savePaymentRatesToStorage(restored.paymentRates);
    }
  };

  // Derived list of available years in results dataset
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    const currYear = String(new Date().getFullYear());
    yearsSet.add(currYear);

    results.forEach(r => {
      const p = parseDateParts(r.date);
      if (p.rawYear) yearsSet.add(p.rawYear);
    });

    return Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
  }, [results]);

  // Derived Manager Statistics & Worked Days Counter
  const managerStats = useMemo(() => {
    const datesMap: Record<string, { count: number; pax: number; quads: number; camels: number }> = {};
    let totalPax = 0;
    let totalQuads = 0;
    let totalCamels = 0;
    const companiesSet = new Set<string>();

    results.forEach(r => {
      const dStr = r.date ? r.date.trim() : '';
      const pEx = parseExtraCount(r.person_extra);
      const qEx = parseExtraCount(r.quad_extra);
      const cEx = parseExtraCount(r.camel_extra);
      const px = (parseInt(r.pax) || 0) + pEx;
      const qd = (parseInt(r.quads) || 0) + qEx;
      const cm = (parseInt(r.camels) || 0) + cEx;

      if (dStr) {
        if (!datesMap[dStr]) {
          datesMap[dStr] = { count: 0, pax: 0, quads: 0, camels: 0 };
        }
        datesMap[dStr].count += 1;
        datesMap[dStr].pax += px;
        datesMap[dStr].quads += qd;
        datesMap[dStr].camels += cm;
        totalPax += px;
      }
      totalQuads += qd;
      totalCamels += cm;
      if (r.company) companiesSet.add(r.company.trim().toUpperCase());
    });

    const uniqueDates = Object.keys(datesMap).sort((a, b) => {
      const pA = parseDateParts(a);
      const pB = parseDateParts(b);
      if (pA.year !== pB.year) return pB.year - pA.year;
      if (pA.month !== pB.month) return pB.month - pA.month;
      return pB.day - pA.day;
    });

    return {
      daysWorked: uniqueDates.length,
      totalTrips: results.length,
      totalPax,
      totalQuads,
      totalCamels,
      companiesCount: companiesSet.size > 0 ? companiesSet.size : 1,
      datesMap,
      uniqueDates
    };
  }, [results]);

  // Derived list of available months for selected year
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const currMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    if (excelSelectedYear === 'ALL' || excelSelectedYear === String(new Date().getFullYear())) {
      monthsSet.add(currMonth);
    }

    results.forEach(r => {
      const p = parseDateParts(r.date);
      if (excelSelectedYear === 'ALL' || p.rawYear === excelSelectedYear) {
        if (p.rawMonth) monthsSet.add(p.rawMonth);
      }
    });

    return Array.from(monthsSet).sort((a, b) => Number(a) - Number(b));
  }, [results, excelSelectedYear]);

  // Derived list of available work days in selected month & year, sorted ASCENDING by day number (1 -> 31)
  const availableDaysForMonth = useMemo(() => {
    const daysSet = new Set<string>();
    results.forEach(r => {
      const p = parseDateParts(r.date);
      const matchYear = excelSelectedYear === 'ALL' || p.rawYear === excelSelectedYear;
      const matchMonth = excelSelectedMonth === 'ALL' || p.rawMonth === excelSelectedMonth || getRecordMonth(r.date) === excelSelectedMonth;
      if (matchYear && matchMonth) {
        if (r.date) daysSet.add(r.date.trim());
      }
    });

    // Sort strictly ASCENDING by Day number (1, 2, 3 ... 28, 29, 30, 31)
    return Array.from(daysSet).sort((a, b) => {
      const pA = parseDateParts(a);
      const pB = parseDateParts(b);
      if (pA.year !== pB.year) return pA.year - pB.year;
      if (pA.month !== pB.month) return pA.month - pB.month;
      return pA.day - pB.day;
    });
  }, [results, excelSelectedYear, excelSelectedMonth]);

  // Extract known canonical guide names and driver names for 1-click select
  const knownGuidesList = useMemo(() => {
    const list: string[] = [];
    // Include registered guides
    registeredGuides.forEach(rg => {
      const gName = rg.name.trim().toUpperCase();
      if (gName && !list.includes(gName)) {
        list.push(gName);
      }
    });
    results.forEach(r => {
      const g = r.guide.trim().toUpperCase();
      if (g && g !== 'WITHOUT GUIDE' && g !== 'H1' && g !== '?') {
        const canon = getCanonicalName(g, list);
        if (canon === g && !list.includes(g)) {
          list.push(g);
        }
      }
    });
    return list;
  }, [results, registeredGuides]);

  // Live match registered guide from 6-digit ID, Nickname, or Full Name
  const matchedGuide = useMemo(() => {
    const query = (guideIdInput || guideName || '').trim().toUpperCase();
    if (!query || query === 'H1' || query === 'NONE' || query === 'WITHOUT GUIDE' || query === '?') {
      return null;
    }
    // 1. Direct ID match (e.g. "100001")
    const byId = registeredGuides.find(g => g.id.toUpperCase() === query);
    if (byId) return byId;

    // 2. Numeric 6-digit match
    const numOnly = query.replace(/[^0-9]/g, '');
    if (numOnly) {
      const byNum = registeredGuides.find(g => {
        const gNum = g.id.replace(/[^0-9]/g, '');
        return gNum === numOnly || (gNum.length === 6 && numOnly.length >= 2 && gNum.startsWith(numOnly));
      });
      if (byNum) return byNum;
    }

    // 3. Name or Nickname exact match
    const byExact = registeredGuides.find(g => 
      g.name.toUpperCase() === query || 
      (g.nickname && g.nickname.toUpperCase() === query)
    );
    if (byExact) return byExact;

    // 4. Name or Nickname prefix match
    const byPartial = registeredGuides.find(g => 
      g.name.toUpperCase().startsWith(query) || 
      (g.nickname && g.nickname.toUpperCase().startsWith(query))
    );
    return byPartial || null;
  }, [guideIdInput, guideName, registeredGuides]);

  const allKnownDrivers = useMemo<KnownDriverInfo[]>(() => {
    const map = new Map<string, KnownDriverInfo>();

    // 1. Registered drivers from ID Manager (highest priority)
    registeredDrivers.forEach(rd => {
      const cleanName = (rd.name || '').trim();
      if (!cleanName) return;
      const key = cleanName.toUpperCase();
      map.set(key, {
        name: cleanName,
        id: rd.id || '',
        vanType: rd.vanType || 'Big van',
        companyName: rd.companyName || 'AGM',
        originCity: rd.originCity,
        phone: rd.phone,
        isRegistered: true,
        tripCount: 0
      });
    });

    // 2. Drivers from previous records/trips
    results.forEach(r => {
      const driversToProcess: { name: string; vanType?: string; company?: string }[] = [];
      if (r.driversList && r.driversList.length > 0) {
        r.driversList.forEach(d => {
          if (d.driver && d.driver.trim() && d.driver !== '?') {
            driversToProcess.push({ name: d.driver.trim(), vanType: d.van_type, company: d.company });
          }
        });
      } else if (r.driver && r.driver.trim() && r.driver !== '?') {
        driversToProcess.push({ name: r.driver.trim(), vanType: r.van_type, company: r.company });
      }

      driversToProcess.forEach(dItem => {
        const key = dItem.name.toUpperCase();
        const existing = map.get(key);
        if (existing) {
          existing.tripCount = (existing.tripCount || 0) + 1;
        } else {
          map.set(key, {
            name: dItem.name,
            vanType: dItem.vanType === 'Mini van' ? 'Mini van' : 'Big van',
            companyName: dItem.company || 'AGM',
            isRegistered: false,
            tripCount: 1
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.isRegistered && !b.isRegistered) return -1;
      if (!a.isRegistered && b.isRegistered) return 1;
      return (b.tripCount || 0) - (a.tripCount || 0) || a.name.localeCompare(b.name);
    });
  }, [results, registeredDrivers]);

  const allKnownCompanies = useMemo<string[]>(() => {
    const set = new Set<string>();
    set.add('AGM');
    registeredDrivers.forEach(rd => {
      if (rd.companyName && rd.companyName.trim()) {
        set.add(rd.companyName.trim().toUpperCase());
      }
    });
    results.forEach(r => {
      if (r.company && r.company.trim()) set.add(r.company.trim().toUpperCase());
      if (r.driversList) {
        r.driversList.forEach(d => {
          if (d.company && d.company.trim()) set.add(d.company.trim().toUpperCase());
        });
      }
    });
    return Array.from(set).filter(Boolean);
  }, [results, registeredDrivers]);

  const applyKnownDriver = (id: string, kd: KnownDriverInfo) => {
    setDriversInput(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          driverName: kd.name,
          vanType: kd.vanType || d.vanType,
          companyName: kd.companyName || d.companyName || 'AGM',
          driverId: kd.id || d.driverId || ''
        };
      }
      return d;
    }));
    showNotification(`✓ Driver "${kd.name}" selected (${kd.vanType}, ${kd.companyName || 'AGM'})`);
  };

  const getDriverMatchDetails = (d: DriverInput) => {
    const rawName = (d.driverName || '').trim();
    const rawId = (d.driverId || '').trim();
    const rawComp = (d.companyName || '').trim().toUpperCase();
    const query = (driverIdMode === 'id' ? (rawId || rawName) : (rawName || rawId)).trim().toUpperCase();

    let match: KnownDriverInfo | null = null;

    if (query) {
      const numOnly = query.replace(/[^0-9]/g, '');

      // 1. Direct ID match
      match = allKnownDrivers.find(kd => kd.id && kd.id.toUpperCase() === query) || null;

      // 2. Exact name match
      if (!match) {
        match = allKnownDrivers.find(kd => kd.name.toUpperCase() === query) || null;
      }

      // 3. Numeric ID prefix match (2+ digits)
      if (!match && numOnly && numOnly.length >= 2) {
        match = allKnownDrivers.find(kd => {
          if (!kd.id) return false;
          const cleanId = kd.id.replace(/[^0-9]/g, '');
          return cleanId === numOnly || (cleanId.length === 6 && cleanId.startsWith(numOnly));
        }) || null;
      }

      // 4. Name prefix match
      if (!match) {
        match = allKnownDrivers.find(kd => kd.name.toUpperCase().startsWith(query)) || null;
      }

      // 5. Name includes / partial match
      if (!match) {
        match = allKnownDrivers.find(kd => kd.name.toUpperCase().includes(query)) || null;
      }
    }

    const isExact = Boolean(match && (match.name.toUpperCase() === rawName.toUpperCase() || (match.id && match.id.toUpperCase() === rawId.toUpperCase())));
    const is4CharMatch = Boolean(match && (rawName.length >= 4 || rawId.length >= 4));
    const matchedName = match ? match.name : '';

    // Determine the suggested company for this driver
    const driverCompany = match?.companyName || (allKnownDrivers.find(kd => kd.name.toUpperCase() === rawName.toUpperCase())?.companyName) || '';
    let suggestedCompany = '';

    if (driverCompany && driverCompany.toUpperCase() !== rawComp) {
      suggestedCompany = driverCompany;
    } else if (rawComp.length >= 1) {
      const matchedComp = allKnownCompanies.find(c => c !== rawComp && c.startsWith(rawComp));
      if (matchedComp) {
        suggestedCompany = matchedComp;
      }
    }

    return { match, isExact, is4CharMatch, matchedName, suggestedCompany, driverCompany };
  };

  const knownDriversList = useMemo(() => {
    const list: string[] = [];
    // Include registered drivers from ID Manager
    registeredDrivers.forEach(rd => {
      const dName = rd.name.trim().toUpperCase();
      if (dName && !list.includes(dName)) {
        list.push(dName);
      }
    });
    results.forEach(r => {
      if (r.driversList && r.driversList.length > 0) {
        r.driversList.forEach(d => {
          const name = d.driver.trim().toUpperCase();
          if (name && name !== '?') {
            const canon = getCanonicalName(name, list);
            if (canon === name && !list.includes(name)) {
              list.push(name);
            }
          }
        });
      } else {
        const d = r.driver.trim().toUpperCase();
        if (d && d !== '?') {
          const canon = getCanonicalName(d, list);
          if (canon === d && !list.includes(d)) {
            list.push(d);
          }
        }
      }
    });
    return list;
  }, [results, registeredDrivers]);

  const knownCompaniesList = useMemo(() => {
    const list: string[] = ['AGM'];
    results.forEach(r => {
      if (r.driversList && r.driversList.length > 0) {
        r.driversList.forEach(d => {
          const c = (d.company || '').trim().toUpperCase();
          if (c && !list.includes(c)) {
            list.push(c);
          }
        });
      } else {
        const c = (r.company || '').trim().toUpperCase();
        if (c && !list.includes(c)) {
          list.push(c);
        }
      }
    });
    return list;
  }, [results]);

  const handleConfirmRecord = (id: number) => {
    setResults(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: 'Confirmed' as const } : r);
      try {
        localStorage.setItem('agm_results', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    showNotification(`Record #${id} CONFIRMED successfully!`);
  };

  const handleCancelRecord = (id: number) => {
    setResults(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: 'Cancelled' as const } : r);
      try {
        localStorage.setItem('agm_results', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    showNotification(`Record #${id} CANCELLED`);
  };

  const filteredRecentActivities = useMemo(() => {
    return results.filter(r => {
      const matchesSearch = !recentActivitySearch || 
        r.guide.toLowerCase().includes(recentActivitySearch.toLowerCase()) ||
        r.driver.toLowerCase().includes(recentActivitySearch.toLowerCase()) ||
        (r.company && r.company.toLowerCase().includes(recentActivitySearch.toLowerCase())) ||
        r.date.includes(recentActivitySearch);

      const status = r.status || 'Logged';
      const matchesFilter = recentActivityFilter === 'all' || status === recentActivityFilter;

      return matchesSearch && matchesFilter;
    });
  }, [results, recentActivitySearch, recentActivityFilter]);

  // Real-time yellow text suggestions when user types 2+ characters that match a name in database
  const guideSuggestion = useMemo(() => {
    if (vanType === 'Mini van') return null;
    const raw = guideName.trim().toUpperCase();
    if (raw.length < 2) return null;
    const found = knownGuidesList.find(g => g.startsWith(raw)) || knownGuidesList.find(g => g.includes(raw));
    if (found && found !== raw) return found;
    return null;
  }, [guideName, vanType, knownGuidesList]);

  const driverSuggestion = useMemo(() => {
    const raw = driverName.trim().toUpperCase();
    if (raw.length < 2) return null;
    const found = knownDriversList.find(d => d.startsWith(raw)) || knownDriversList.find(d => d.includes(raw));
    if (found && found !== raw) return found;
    return null;
  }, [driverName, knownDriversList]);

  const companySuggestion = useMemo(() => {
    const raw = companyName.trim().toUpperCase();
    if (raw.length < 2) return null;
    const found = knownCompaniesList.find(c => c.startsWith(raw)) || knownCompaniesList.find(c => c.includes(raw));
    if (found && found !== raw) return found;
    return null;
  }, [companyName, knownCompaniesList]);

  // Comprehensive Staff Profiles computation for Guides, Big Van Drivers, and Mini Van Drivers
  const staffProfiles = useMemo<StaffProfile[]>(() => {
    const profilesMap: Record<string, StaffProfile> = {};

    // 1. Seed ALL Registered Guides from ID Manager so they ALWAYS appear in Staff & their IDs are attached
    registeredGuides.forEach(rg => {
      const gName = (rg.name || '').trim();
      if (!gName) return;
      const guideKey = `guide_${gName.toUpperCase().replace(/\s+/g, '_')}`;
      profilesMap[guideKey] = {
        id: guideKey,
        guideId: rg.id,
        name: rg.name,
        nickname: rg.nickname,
        role: 'guide',
        initial: rg.name.charAt(0).toUpperCase() || 'G',
        daysWorked: 0,
        totalTrips: 0,
        totalPax: 0,
        totalQuads: 0,
        totalCamels: 0,
        datesWorked: []
      };
    });

    // 2. Seed ALL Registered Drivers from ID Manager
    registeredDrivers.forEach(rd => {
      const dName = (rd.name || '').trim();
      if (!dName) return;
      const isMini = rd.vanType === 'Mini van';
      const role: 'mini_driver' | 'big_driver' = isMini ? 'mini_driver' : 'big_driver';
      const driverKey = `${role}_${dName.toUpperCase().replace(/\s+/g, '_')}`;
      profilesMap[driverKey] = {
        id: driverKey,
        driverId: rd.id,
        name: rd.name,
        role: role,
        initial: rd.name.charAt(0).toUpperCase() || 'D',
        daysWorked: 0,
        totalTrips: 0,
        totalPax: 0,
        totalQuads: 0,
        totalCamels: 0,
        companiesSet: new Set<string>([rd.companyName || 'AGM']),
        companyName: rd.companyName || 'AGM',
        datesWorked: []
      };
    });

    // 3. Process every trip result from logged/stored trips
    results.forEach(r => {
      const dStr = r.date.trim();
      const pEx = parseExtraCount(r.person_extra);
      const qEx = parseExtraCount(r.quad_extra);
      const cEx = parseExtraCount(r.camel_extra);
      const paxNum = (parseInt(r.pax) || 0) + pEx;
      const quadsNum = (parseInt(r.quads) || 0) + qEx;
      const camelsNum = (parseInt(r.camels) || 0) + cEx;

      // 3.1 Guide matching and counting
      const resolvedG = resolveGuide(r.guide, registeredGuides, knownGuidesList);
      if (resolvedG) {
        const guideKey = resolvedG.profileKey;
        if (!profilesMap[guideKey]) {
          profilesMap[guideKey] = {
            id: guideKey,
            guideId: resolvedG.guideId,
            name: resolvedG.canonicalName,
            nickname: resolvedG.nickname,
            role: 'guide',
            initial: resolvedG.canonicalName.charAt(0).toUpperCase() || 'G',
            daysWorked: 0,
            totalTrips: 0,
            totalPax: 0,
            totalQuads: 0,
            totalCamels: 0,
            datesWorked: []
          };
        }
        const prof = profilesMap[guideKey];
        if (resolvedG.guideId && !prof.guideId) prof.guideId = resolvedG.guideId;
        if (resolvedG.nickname && !prof.nickname) prof.nickname = resolvedG.nickname;
        prof.totalTrips += 1;
        prof.totalPax += paxNum;
        prof.totalQuads += quadsNum;
        prof.totalCamels += camelsNum;

        let dateEntry = prof.datesWorked.find(d => d.date === dStr);
        if (!dateEntry) {
          dateEntry = {
            date: dStr,
            trips: [],
            dayPax: 0,
            dayQuads: 0,
            dayCamels: 0
          };
          prof.datesWorked.push(dateEntry);
        }
        dateEntry.trips.push(r);
        dateEntry.dayPax += paxNum;
        dateEntry.dayQuads += quadsNum;
        dateEntry.dayCamels += camelsNum;
      }

      // 3.2 Driver matching and counting (multi-driver / multi-van support)
      const dList: DriverItemData[] = (r.driversList && r.driversList.length > 0)
        ? r.driversList
        : [{ driver: r.driver, van_type: (r.van_type as any) || 'Big van', company: r.company || 'AGM', pax: r.pax }];

      dList.forEach(drv => {
        const resolvedD = resolveDriver(drv.driver, drv.van_type, drv.company, registeredDrivers, knownDriversList);
        if (resolvedD) {
          const driverKey = resolvedD.profileKey;
          const companyName = (drv.company || resolvedD.companyName || 'AGM').trim().toUpperCase() || 'AGM';

          if (!profilesMap[driverKey]) {
            profilesMap[driverKey] = {
              id: driverKey,
              driverId: resolvedD.driverId,
              name: resolvedD.canonicalName,
              role: resolvedD.role,
              initial: resolvedD.canonicalName.charAt(0).toUpperCase() || 'D',
              daysWorked: 0,
              totalTrips: 0,
              totalPax: 0,
              totalQuads: 0,
              totalCamels: 0,
              companiesSet: new Set<string>(),
              companyName: companyName,
              datesWorked: []
            };
          }
          const prof = profilesMap[driverKey];
          if (prof.companiesSet) prof.companiesSet.add(companyName);
          prof.totalTrips += 1;
          const drvPax = drv.pax ? (parseInt(drv.pax) || paxNum) : paxNum;
          prof.totalPax += drvPax;
          prof.totalQuads += quadsNum;
          prof.totalCamels += camelsNum;

          let dateEntry = prof.datesWorked.find(d => d.date === dStr);
          if (!dateEntry) {
            dateEntry = {
              date: dStr,
              trips: [],
              dayPax: 0,
              dayQuads: 0,
              dayCamels: 0
            };
            prof.datesWorked.push(dateEntry);
          }
          dateEntry.trips.push(r);
          dateEntry.dayPax += drvPax;
          dateEntry.dayQuads += quadsNum;
          dateEntry.dayCamels += camelsNum;
        }
      });
    });

    // 4. Calculate total unique days worked for each profile
    return Object.values(profilesMap).map(prof => {
      prof.daysWorked = prof.datesWorked.length;
      prof.datesWorked.sort((a, b) => a.date.localeCompare(b.date));
      if (prof.companiesSet && prof.companiesSet.size > 0) {
        prof.companyName = Array.from(prof.companiesSet).join(', ');
      }
      return prof;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [results, knownGuidesList, knownDriversList, registeredGuides, registeredDrivers]);

  // Monthly Guides Summary Table calculation
  const monthlyGuidesSummary = useMemo(() => {
    const summaryMap: Record<string, Set<string>> = {};
    results.forEach(r => {
      const dStr = r.date.trim();
      const resolvedG = resolveGuide(r.guide, registeredGuides, knownGuidesList);
      if (resolvedG) {
        const canon = resolvedG.canonicalName;
        if (!summaryMap[canon]) summaryMap[canon] = new Set();
        if (dStr) summaryMap[canon].add(dStr);
      }
    });

    return Object.entries(summaryMap).map(([guide, datesSet]) => {
      const datesList = Array.from(datesSet).sort();
      return {
        guide,
        daysWorked: datesList.length,
        dates: datesList.join(', ')
      };
    }).sort((a, b) => a.guide.localeCompare(b.guide));
  }, [results, registeredGuides, knownGuidesList]);

  // Monthly Big Van Drivers Summary Table calculation
  const monthlyBigDriversSummary = useMemo(() => {
    const summaryMap: Record<string, { datesSet: Set<string>; companiesSet: Set<string> }> = {};
    results.forEach(r => {
      const dStr = r.date.trim();
      const dList: DriverItemData[] = (r.driversList && r.driversList.length > 0)
        ? r.driversList
        : [{ driver: r.driver, van_type: (r.van_type as any) || 'Big van', company: r.company || 'AGM' }];

      dList.forEach(drv => {
        if (drv.van_type !== 'Mini van') {
          const resolvedD = resolveDriver(drv.driver, 'Big van', drv.company, registeredDrivers, knownDriversList);
          if (resolvedD) {
            const canon = resolvedD.canonicalName;
            const comp = (drv.company || resolvedD.companyName || 'AGM').trim().toUpperCase() || 'AGM';
            if (!summaryMap[canon]) summaryMap[canon] = { datesSet: new Set(), companiesSet: new Set() };
            if (dStr) summaryMap[canon].datesSet.add(dStr);
            summaryMap[canon].companiesSet.add(comp);
          }
        }
      });
    });

    return Object.entries(summaryMap).map(([driver, data]) => {
      const datesList = Array.from(data.datesSet).sort();
      const companiesList = Array.from(data.companiesSet).join(', ');
      return {
        driver,
        company: companiesList || 'AGM',
        daysWorked: datesList.length,
        vanType: 'Big van',
        dates: datesList.join(', ')
      };
    }).sort((a, b) => a.driver.localeCompare(b.driver));
  }, [results, registeredDrivers, knownDriversList]);

  // Monthly Mini Van Drivers Summary Table calculation
  const monthlyMiniDriversSummary = useMemo(() => {
    const summaryMap: Record<string, { datesSet: Set<string>; companiesSet: Set<string> }> = {};
    results.forEach(r => {
      const dStr = r.date.trim();
      const dList: DriverItemData[] = (r.driversList && r.driversList.length > 0)
        ? r.driversList
        : [{ driver: r.driver, van_type: (r.van_type as any) || 'Big van', company: r.company || 'AGM' }];

      dList.forEach(drv => {
        if (drv.van_type === 'Mini van') {
          const resolvedD = resolveDriver(drv.driver, 'Mini van', drv.company, registeredDrivers, knownDriversList);
          if (resolvedD) {
            const canon = resolvedD.canonicalName;
            const comp = (drv.company || resolvedD.companyName || 'AGM').trim().toUpperCase() || 'AGM';
            if (!summaryMap[canon]) summaryMap[canon] = { datesSet: new Set(), companiesSet: new Set() };
            if (dStr) summaryMap[canon].datesSet.add(dStr);
            summaryMap[canon].companiesSet.add(comp);
          }
        }
      });
    });

    return Object.entries(summaryMap).map(([driver, data]) => {
      const datesList = Array.from(data.datesSet).sort();
      const companiesList = Array.from(data.companiesSet).join(', ');
      return {
        driver,
        company: companiesList || 'AGM',
        daysWorked: datesList.length,
        vanType: 'Mini van',
        dates: datesList.join(', ')
      };
    }).sort((a, b) => a.driver.localeCompare(b.driver));
  }, [results, registeredDrivers, knownDriversList]);

  // Detailed Slide-Over Analysis Computation with filters for Name, Month, Day
  const monthlySlideOverData = useMemo(() => {
    const parseParts = (dStr: string) => {
      const parts = dStr.trim().split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return { year: parts[0], month: parts[1].padStart(2, '0'), day: parts[2].padStart(2, '0') };
        } else {
          return { day: parts[0].padStart(2, '0'), month: parts[1].padStart(2, '0'), year: parts[2] };
        }
      }
      return { day: '', month: '', year: '' };
    };

    const sName = monthlySlideSearchName.trim().toLowerCase();
    const sMonth = monthlySlideMonthFilter;
    const sDay = monthlySlideDayFilter.trim().padStart(2, '0');

    const filteredResults = results.filter(r => {
      const { day, month } = parseParts(r.date);
      if (sMonth !== 'ALL' && month !== sMonth) return false;
      if (sDay !== '00' && sDay !== '' && day !== sDay && !r.date.includes(monthlySlideDayFilter.trim())) return false;
      return true;
    });

    const guidesMap: Record<string, {
      name: string;
      totalPax: number;
      dates: Record<string, { date: string; pax: number; drivers: Set<string>; trips: ResultItem[] }>;
    }> = {};

    const bigDriversMap: Record<string, {
      name: string;
      totalPax: number;
      companiesSet: Set<string>;
      dates: Record<string, { date: string; pax: number; guides: Set<string>; trips: ResultItem[] }>;
    }> = {};

    const miniDriversMap: Record<string, {
      name: string;
      totalPax: number;
      companiesSet: Set<string>;
      dates: Record<string, { date: string; pax: number; trips: ResultItem[] }>;
    }> = {};

    const companiesMap: Record<string, {
      name: string;
      totalTransports: number;
      totalBigVans: number;
      totalMiniVans: number;
      totalPax: number;
      driversSet: Set<string>;
      bigDriversSet: Set<string>;
      miniDriversSet: Set<string>;
      dates: Record<string, {
        date: string;
        transportsCount: number;
        bigVansCount: number;
        miniVansCount: number;
        pax: number;
        drivers: Set<string>;
        bigDrivers: Set<string>;
        miniDrivers: Set<string>;
        trips: ResultItem[];
      }>;
    }> = {};

    filteredResults.forEach(r => {
      const pEx = parseExtraCount(r.person_extra);
      const paxNum = (parseInt(r.pax) || 0) + pEx;
      const dStr = r.date.trim();

      // Guide aggregation (only once per trip, excluding H1, WITHOUT GUIDE, ?)
      const gRaw = r.guide.trim().toUpperCase();
      if (gRaw && gRaw !== 'WITHOUT GUIDE' && gRaw !== 'H1' && gRaw !== '?') {
        const guideCanon = getCanonicalName(gRaw, knownGuidesList);
        if (!guidesMap[guideCanon]) {
          guidesMap[guideCanon] = { name: guideCanon, totalPax: 0, dates: {} };
        }
        guidesMap[guideCanon].totalPax += paxNum;
        if (!guidesMap[guideCanon].dates[dStr]) {
          guidesMap[guideCanon].dates[dStr] = { date: dStr, pax: 0, drivers: new Set(), trips: [] };
        }
        guidesMap[guideCanon].dates[dStr].pax += paxNum;
        guidesMap[guideCanon].dates[dStr].trips.push(r);
        const driverCanon = r.driver.trim() && r.driver !== '?' ? getCanonicalName(r.driver.trim().toUpperCase(), knownDriversList) : '';
        if (driverCanon) {
          guidesMap[guideCanon].dates[dStr].drivers.add(driverCanon);
        }
      }

      // Per-driver & company transport aggregation (handles multi-driver & multi-group trips correctly)
      const dList: DriverItemData[] = (r.driversList && r.driversList.length > 0)
        ? r.driversList
        : [{ driver: r.driver, van_type: (r.van_type as any) || 'Big van', company: r.company || 'AGM', pax: r.pax }];

      dList.forEach(drv => {
        const drvPax = drv.pax ? (parseInt(drv.pax) || paxNum) : (dList.length > 1 ? Math.round(paxNum / dList.length) : paxNum);
        const compRaw = (drv.company || 'AGM').trim().toUpperCase();
        const companyName = compRaw || 'AGM';
        const isMini = drv.van_type === 'Mini van';

        if (!companiesMap[companyName]) {
          companiesMap[companyName] = {
            name: companyName,
            totalTransports: 0,
            totalBigVans: 0,
            totalMiniVans: 0,
            totalPax: 0,
            driversSet: new Set(),
            bigDriversSet: new Set(),
            miniDriversSet: new Set(),
            dates: {}
          };
        }

        companiesMap[companyName].totalTransports += 1;
        if (isMini) {
          companiesMap[companyName].totalMiniVans += 1;
        } else {
          companiesMap[companyName].totalBigVans += 1;
        }
        companiesMap[companyName].totalPax += drvPax;

        const drRawForComp = drv.driver.trim().toUpperCase();
        if (drRawForComp && drRawForComp !== '?') {
          const driverCanonForComp = getCanonicalName(drRawForComp, knownDriversList);
          companiesMap[companyName].driversSet.add(driverCanonForComp);
          if (isMini) {
            companiesMap[companyName].miniDriversSet.add(driverCanonForComp);
          } else {
            companiesMap[companyName].bigDriversSet.add(driverCanonForComp);
          }
        }

        if (!companiesMap[companyName].dates[dStr]) {
          companiesMap[companyName].dates[dStr] = {
            date: dStr,
            transportsCount: 0,
            bigVansCount: 0,
            miniVansCount: 0,
            pax: 0,
            drivers: new Set(),
            bigDrivers: new Set(),
            miniDrivers: new Set(),
            trips: []
          };
        }

        companiesMap[companyName].dates[dStr].transportsCount += 1;
        if (isMini) {
          companiesMap[companyName].dates[dStr].miniVansCount += 1;
        } else {
          companiesMap[companyName].dates[dStr].bigVansCount += 1;
        }
        companiesMap[companyName].dates[dStr].pax += drvPax;
        if (!companiesMap[companyName].dates[dStr].trips.includes(r)) {
          companiesMap[companyName].dates[dStr].trips.push(r);
        }

        if (drRawForComp && drRawForComp !== '?') {
          const driverCanonForComp = getCanonicalName(drRawForComp, knownDriversList);
          companiesMap[companyName].dates[dStr].drivers.add(driverCanonForComp);
          if (isMini) {
            companiesMap[companyName].dates[dStr].miniDrivers.add(driverCanonForComp);
          } else {
            companiesMap[companyName].dates[dStr].bigDrivers.add(driverCanonForComp);
          }
        }

        const drRaw = drv.driver.trim().toUpperCase();
        if (drRaw && drRaw !== '?') {
          const driverCanon = getCanonicalName(drRaw, knownDriversList);

          if (isMini) {
            if (!miniDriversMap[driverCanon]) {
              miniDriversMap[driverCanon] = { name: driverCanon, totalPax: 0, companiesSet: new Set(), dates: {} };
            }
            miniDriversMap[driverCanon].companiesSet.add(companyName);
            miniDriversMap[driverCanon].totalPax += drvPax;
            if (!miniDriversMap[driverCanon].dates[dStr]) {
              miniDriversMap[driverCanon].dates[dStr] = { date: dStr, pax: 0, trips: [] };
            }
            miniDriversMap[driverCanon].dates[dStr].pax += drvPax;
            if (!miniDriversMap[driverCanon].dates[dStr].trips.includes(r)) {
              miniDriversMap[driverCanon].dates[dStr].trips.push(r);
            }
          } else {
            if (!bigDriversMap[driverCanon]) {
              bigDriversMap[driverCanon] = { name: driverCanon, totalPax: 0, companiesSet: new Set(), dates: {} };
            }
            bigDriversMap[driverCanon].companiesSet.add(companyName);
            bigDriversMap[driverCanon].totalPax += drvPax;
            if (!bigDriversMap[driverCanon].dates[dStr]) {
              bigDriversMap[driverCanon].dates[dStr] = { date: dStr, pax: 0, guides: new Set(), trips: [] };
            }
            bigDriversMap[driverCanon].dates[dStr].pax += drvPax;
            if (!bigDriversMap[driverCanon].dates[dStr].trips.includes(r)) {
              bigDriversMap[driverCanon].dates[dStr].trips.push(r);
            }
            const guideCanon = r.guide.trim() && r.guide !== 'WITHOUT GUIDE' && r.guide !== 'H1' && r.guide !== '?' ? getCanonicalName(r.guide.trim().toUpperCase(), knownGuidesList) : '';
            if (guideCanon) {
              bigDriversMap[driverCanon].dates[dStr].guides.add(guideCanon);
            }
          }
        }
      });
    });

    const allGuides = Object.values(guidesMap)
      .map(g => ({
        id: `g_${g.name}`,
        name: g.name,
        role: 'guide' as const,
        totalPax: g.totalPax,
        daysWorkedCount: Object.keys(g.dates).length,
        datesWorked: Object.values(g.dates).map(d => ({
          date: d.date,
          pax: d.pax,
          drivers: Array.from(d.drivers).join(', ') || 'None',
          trips: d.trips
        })).sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const allBigDrivers = Object.values(bigDriversMap)
      .map(d => ({
        id: `bd_${d.name}`,
        name: d.name,
        role: 'big_driver' as const,
        companyName: Array.from(d.companiesSet).join(', ') || 'AGM',
        totalPax: d.totalPax,
        daysWorkedCount: Object.keys(d.dates).length,
        datesWorked: Object.values(d.dates).map(dt => ({
          date: dt.date,
          pax: dt.pax,
          guides: Array.from(dt.guides).join(', ') || 'Without Guide',
          trips: dt.trips
        })).sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const allMiniDrivers = Object.values(miniDriversMap)
      .map(d => ({
        id: `md_${d.name}`,
        name: d.name,
        role: 'mini_driver' as const,
        companyName: Array.from(d.companiesSet).join(', ') || 'AGM',
        totalPax: d.totalPax,
        daysWorkedCount: Object.keys(d.dates).length,
        datesWorked: Object.values(d.dates).map(dt => ({
          date: dt.date,
          pax: dt.pax,
          trips: dt.trips
        })).sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const allCompanies = Object.values(companiesMap)
      .map(c => ({
        id: `c_${c.name}`,
        name: c.name,
        role: 'company' as const,
        totalTransports: c.totalTransports,
        totalBigVans: c.totalBigVans,
        totalMiniVans: c.totalMiniVans,
        totalPax: c.totalPax,
        driversCount: c.driversSet.size,
        driversList: Array.from(c.driversSet).join(', ') || 'None',
        bigDriversList: Array.from(c.bigDriversSet).join(', ') || 'None',
        miniDriversList: Array.from(c.miniDriversSet).join(', ') || 'None',
        daysWorkedCount: Object.keys(c.dates).length,
        datesWorked: Object.values(c.dates).map(dt => ({
          date: dt.date,
          transportsCount: dt.transportsCount,
          bigVansCount: dt.bigVansCount,
          miniVansCount: dt.miniVansCount,
          pax: dt.pax,
          drivers: Array.from(dt.drivers).join(', ') || 'None',
          bigDrivers: Array.from(dt.bigDrivers).join(', ') || 'None',
          miniDrivers: Array.from(dt.miniDrivers).join(', ') || 'None',
          trips: dt.trips
        })).sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const guides = allGuides.filter(g => !sName || g.name.toLowerCase().includes(sName));
    const bigDrivers = allBigDrivers.filter(d => !sName || d.name.toLowerCase().includes(sName));
    const miniDrivers = allMiniDrivers.filter(d => !sName || d.name.toLowerCase().includes(sName));
    const companies = allCompanies.filter(c => !sName || c.name.toLowerCase().includes(sName) || c.driversList.toLowerCase().includes(sName) || c.bigDriversList.toLowerCase().includes(sName) || c.miniDriversList.toLowerCase().includes(sName));

    return { guides, bigDrivers, miniDrivers, companies, allGuides, allBigDrivers, allMiniDrivers, allCompanies };
  }, [results, knownGuidesList, knownDriversList, monthlySlideSearchName, monthlySlideMonthFilter, monthlySlideDayFilter]);

  // Dynamically derive selected staff item so that Month & Day filters update the detail view live
  const monthlySlideSelectedItem = useMemo(() => {
    if (!monthlySlideSelectedId) return null;

    const found =
      monthlySlideOverData.allGuides.find(g => g.id === monthlySlideSelectedId) ||
      monthlySlideOverData.allBigDrivers.find(d => d.id === monthlySlideSelectedId) ||
      monthlySlideOverData.allMiniDrivers.find(d => d.id === monthlySlideSelectedId) ||
      monthlySlideOverData.allCompanies.find(c => c.id === monthlySlideSelectedId);

    if (found) return found;

    if (monthlySlideSelectedStaffInfo) {
      return {
        id: monthlySlideSelectedStaffInfo.id,
        name: monthlySlideSelectedStaffInfo.name,
        role: monthlySlideSelectedStaffInfo.role,
        totalPax: 0,
        daysWorkedCount: 0,
        datesWorked: [],
        totalTransports: 0,
        totalBigVans: 0,
        totalMiniVans: 0,
        driversCount: 0,
        driversList: '',
        bigDriversList: '',
        miniDriversList: ''
      };
    }

    return null;
  }, [monthlySlideSelectedId, monthlySlideOverData, monthlySlideSelectedStaffInfo]);

  // Save changes to localStorage (reliable for both web and electron/laptop app)
  useEffect(() => {
    try {
      localStorage.setItem('agm_results', JSON.stringify(results));
    } catch (e) {
      console.error("Failed to save results to localStorage:", e);
    }
  }, [results]);

  useEffect(() => {
    try {
      localStorage.setItem('agm_has_started_work', JSON.stringify(hasStartedWork));
    } catch (e) {
      console.error("Failed to save work state to localStorage:", e);
    }
  }, [hasStartedWork]);

  // Sync data with Embedded SQLite backend and Python engine on startup
  useEffect(() => {
    const initBackend = async () => {
      try {
        await initSqliteDatabase();
        if (window.electronAPI) {
          try {
            await window.electronAPI.init();
            const res = await window.electronAPI.load();
            if (res && res.status === 'success' && Array.isArray(res.records) && res.records.length > 0) {
              setResults(prev => {
                const combined = [...res.records];
                const seenIds = new Set(combined.map((r: ResultItem) => r.id));
                prev.forEach(p => {
                  if (!seenIds.has(p.id)) combined.push(p);
                });
                return combined;
              });
              return;
            }
          } catch (e) {
            console.warn("Electron backend load warning:", e);
          }
        }
        const sqliteRecords = await getAllTripsSql();
        if (sqliteRecords && sqliteRecords.length > 0) {
          setResults(prev => {
            const combined = [...sqliteRecords];
            const seenIds = new Set(combined.map((r: ResultItem) => r.id));
            prev.forEach(p => {
              if (!seenIds.has(p.id)) combined.push(p);
            });
            return combined;
          });
        }
      } catch (err) {
        console.error("Failed to initialize or load from SQLite/backend:", err);
      }
    };
    initBackend();
  }, []);

  // Bottom details bar date - defaulted to reference date format DD-MM-YYYY
  const [currentDate, setCurrentDate] = useState('09-07-2026');

  // Load current date on boot
  useEffect(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setCurrentDate(`${day}-${month}-${year}`);
    setDateStr(`${day}-${month}-${year}`);
    
    const hrs = String(today.getHours()).padStart(2, '0');
    const mins = String(today.getMinutes()).padStart(2, '0');
    setTimeStr(`${hrs}:${mins}`);
  }, []);

  // Sync guideName when vanType changes
  useEffect(() => {
    if (vanType === 'Mini van') {
      setGuideName('H1');
    } else {
      if (guideName === 'WITHOUT GUIDE' || guideName === 'H1') {
        setGuideName('');
      }
    }
  }, [vanType]);

  // Set transient visual notification
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Validation function: returns true if Guide, Driver, Pax, Quads, and Camels are all properly entered
  const isRecordComplete = (item: ResultItem) => {
    if (!item) return false;
    const isMini = item.van_type === 'Mini van';
    const finalGuideName = isMini ? 'H1' : (item.guide || '').trim();
    if (!finalGuideName || !(item.driver || '').trim() || finalGuideName === '?' || item.driver === '?') {
      return false;
    }

    // Pax is strictly required and must be entered (> 0)
    const pVal = (item.pax || '').trim();
    if (!pVal || pVal === '?' || pVal.toLowerCase() === 'none' || pVal === '0') {
      return false;
    }
    const parsedPax = parseInt(pVal, 10);
    if (isNaN(parsedPax) || parsedPax <= 0) {
      return false;
    }

    // Quads: must be entered/specified (either a positive count > 0, or explicitly 'None' / without quads)
    // If not entered (empty, '0', '?'), it is incomplete (REST)
    const qVal = (item.quads || '').trim();
    if (!qVal || qVal === '?' || qVal === '0') {
      const qEx = (item.quad_extra || '').trim().toLowerCase();
      if (!qEx || qEx === 'none' || qEx === '0') return false;
    }
    if (qVal && qVal.toLowerCase() !== 'none') {
      const parsedQ = parseInt(qVal, 10);
      if (isNaN(parsedQ) || parsedQ < 0) return false;
      if (parsedQ === 0) {
        const qEx = (item.quad_extra || '').trim().toLowerCase();
        if (!qEx || qEx === 'none' || qEx === '0') return false;
      }
    }

    // Camels: must be entered/specified (either a positive count > 0, or explicitly 'None' / without camels)
    // If not entered (empty, '0', '?'), it is incomplete (REST)
    const cVal = (item.camels || '').trim();
    if (!cVal || cVal === '?' || cVal === '0') {
      const cEx = (item.camel_extra || '').trim().toLowerCase();
      if (!cEx || cEx === 'none' || cEx === '0') return false;
    }
    if (cVal && cVal.toLowerCase() !== 'none') {
      const parsedC = parseInt(cVal, 10);
      if (isNaN(parsedC) || parsedC < 0) return false;
      if (parsedC === 0) {
        const cEx = (item.camel_extra || '').trim().toLowerCase();
        if (!cEx || cEx === 'none' || cEx === '0') return false;
      }
    }

    return true;
  };

  // Reset inputs
  const handleClean = () => {
    setEditingId(null);
    setDailyLoggedSearchQuery('');
    setDriversInput([{ id: '1', driverId: '', driverName: '', vanType: 'Big van', companyName: 'AGM', pax: '' }]);
    setVanType('Big van');
    setGuideName('');
    setGuideIdInput('');
    setDriverName('');
    setCompanyName('AGM');
    setPaxCount('');
    setQuadsCount('');
    setCamelsCount('');
    setPersonExtra('None');
    setQuadExtra('None');
    setCamelExtra('None');
    setPersonExtraPay('0 DH');
    setQuadExtraPay('0 DH');
    setCamelExtraPay('0 DH');
    setExtraPayment('0 DH');
    setMealOption('Unselected');
    setActiveExtraTab('none');
    setWithoutGuide(false);
  };

  // Populate form with row values to modify or cancel if already editing
  const handleEdit = (item: ResultItem, e: MouseEvent) => {
    e.stopPropagation();
    // Empty the daily search query so that all daily output is visible immediately
    setDailyLoggedSearchQuery('');

    if (editingId === item.id) {
      handleClean();
      showNotification("ℹ️ Cancelled modify mode.");
      return;
    }
    const itemVanType = (item.van_type || 'Big van') as 'Big van' | 'Mini van';
    setEditingId(item.id);
    setVanType(itemVanType);
    const gRawUpper = (item.guide || '').trim().toUpperCase();
    const isItemWithoutGuide = gRawUpper === 'WITHOUT GUIDE' || gRawUpper === 'NO GUIDE' || gRawUpper === 'NONE';
    setWithoutGuide(isItemWithoutGuide);
    setGuideName(item.guide === 'WITHOUT GUIDE' || item.guide === 'H1' || item.guide === 'NO GUIDE' ? '' : item.guide);
    setDriverName(item.driver);
    setCompanyName(item.company || 'AGM');

    const matchGuide = registeredGuides.find(rg => 
      rg.name.toUpperCase() === item.guide.toUpperCase() || 
      (rg.nickname && rg.nickname.toUpperCase() === item.guide.toUpperCase()) ||
      rg.id.toUpperCase() === item.guide.toUpperCase()
    );
    setGuideIdInput(matchGuide ? matchGuide.id : '');

    if (item.driversList && item.driversList.length > 0) {
      setDriversInput(item.driversList.map((d, i) => {
        const matchDrv = registeredDrivers.find(rd => rd.name.toUpperCase() === d.driver.toUpperCase() || (rd.id && rd.id.toUpperCase() === d.driver.toUpperCase()));
        return {
          id: String(i + 1),
          driverId: matchDrv?.id || '',
          driverName: d.driver,
          vanType: (d.van_type as any) || 'Big van',
          companyName: d.company || 'AGM',
          pax: d.pax || ''
        };
      }));
    } else {
      const matchDrv = registeredDrivers.find(rd => rd.name.toUpperCase() === (item.driver || '').toUpperCase() || (rd.id && rd.id.toUpperCase() === (item.driver || '').toUpperCase()));
      setDriversInput([{
        id: '1',
        driverId: matchDrv?.id || '',
        driverName: item.driver || '',
        vanType: itemVanType,
        companyName: item.company || 'AGM',
        pax: ''
      }]);
    }

    setPaxCount(item.pax === '?' ? '' : item.pax);
    setQuadsCount(item.quads === '?' ? '' : item.quads);
    setCamelsCount(item.camels === '?' ? '' : item.camels);
    setPersonExtra(item.person_extra || 'None');
    setQuadExtra(item.quad_extra || 'None');
    setCamelExtra(item.camel_extra || 'None');
    setPersonExtraPay(item.person_extra_pay || (item.person_extra && item.person_extra !== 'None' ? item.extra_payment || '0 DH' : '0 DH'));
    setQuadExtraPay(item.quad_extra_pay || (item.quad_extra && item.quad_extra !== 'None' ? item.extra_payment || '0 DH' : '0 DH'));
    setCamelExtraPay(item.camel_extra_pay || (item.camel_extra && item.camel_extra !== 'None' ? item.extra_payment || '0 DH' : '0 DH'));
    setExtraPayment(item.extra_payment || '0 DH');
    const m = item.meal;
    if (m === 'Lunch' || m === 'Dinner' || m === 'Both') {
      setMealOption(m);
    } else if (m && typeof m === 'string' && m.toLowerCase().includes('both')) {
      setMealOption('Both');
    } else if (m && typeof m === 'string' && m.toLowerCase().includes('lunch')) {
      setMealOption('Lunch');
    } else if (m && typeof m === 'string' && m.toLowerCase().includes('dinner')) {
      setMealOption('Dinner');
    } else if (m === 'None' || m === 'Without Meal' || m === 'No Meal') {
      setMealOption('None');
    } else {
      setMealOption('None');
    }
    setDateStr(item.date);
    setTimeStr(item.time);
    showNotification(`Modifying Record #${item.id}`);
  };

  // Submit Handler
  const handleSubmit = async (e?: FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    // 1. Strict Driver Verification: If there is no driver name or ID, ask the user to enter the driver first
    const hasAnyDriver = driversInput.some(d => (d.driverName && d.driverName.trim() !== '') || (d.driverId && d.driverId.trim() !== '')) || Boolean(driverName && driverName.trim());

    if (!hasAnyDriver) {
      showNotification("Please enter the driver name first!");
      return;
    }

    // Check each driver entry in the list
    for (let i = 0; i < driversInput.length; i++) {
      const d = driversInput[i];
      const hasId = Boolean(d.driverId && d.driverId.trim());
      const hasName = Boolean(d.driverName && d.driverName.trim());
      if (!hasName && !hasId && !driverName.trim()) {
        showNotification(driversInput.length > 1 ? `Please enter the driver name for Driver #${i + 1} first!` : "Please enter the driver name first!");
        return;
      }
    }

    // 2. Validate Drivers & Driver IDs
    let validDrivers = driversInput.filter(d => (d.driverName && d.driverName.trim() !== '') || (d.driverId && d.driverId.trim() !== ''));
    if (validDrivers.length === 0) {
      if (driverName && driverName.trim()) {
        validDrivers = [{
          id: '1',
          driverName: driverName.trim(),
          driverId: '',
          vanType: vanType || 'Big van',
          companyName: companyName || 'AGM',
          pax: paxCount || ''
        }];
      } else {
        showNotification("Please enter the driver name first!");
        return;
      }
    }

    // Auto-register any new drivers seamlessly so workflow is never blocked
    let updatedDriversList = [...registeredDrivers];
    let driversChanged = false;

    for (let i = 0; i < validDrivers.length; i++) {
      const d = validDrivers[i];
      const hasId = Boolean(d.driverId && d.driverId.trim());
      const hasName = Boolean(d.driverName && d.driverName.trim());
      const matched = getMatchedDriverForInput(d);

      if (!matched && (hasName || hasId)) {
        const rawName = (d.driverName && d.driverName.trim()) || (d.driverId && d.driverId.trim()) || `Driver ${Date.now()}`;
        const autoId = hasId ? d.driverId!.trim() : String(Math.floor(100000 + Math.random() * 900000));
        const newRegDriver: RegisteredDriver = {
          id: autoId,
          name: rawName.toUpperCase(),
          vanType: d.vanType || 'Big van',
          companyName: d.companyName?.trim().toUpperCase() || 'AGM',
          status: 'Active'
        };
        updatedDriversList.push(newRegDriver);
        driversChanged = true;
      }
    }

    if (driversChanged) {
      setRegisteredDrivers(updatedDriversList);
      saveDriversToStorage(updatedDriversList);
    }

    // 2. Guide Validation & ID Verification
    const isSingleBigVan = validDrivers.length === 1 && validDrivers[0].vanType === 'Big van';
    const isSingleMiniVan = validDrivers.length === 1 && validDrivers[0].vanType === 'Mini van';

    let finalGuideName = 'WITHOUT GUIDE';

    if (isSingleMiniVan) {
      finalGuideName = 'H1';
    } else if (withoutGuide) {
      finalGuideName = 'WITHOUT GUIDE';
    } else if (matchedGuide) {
      finalGuideName = (matchedGuide.useNicknameInLogs && matchedGuide.nickname)
        ? matchedGuide.nickname
        : matchedGuide.name;
    } else if (guideName && guideName.trim()) {
      const rawG = guideName.trim().toUpperCase();
      finalGuideName = (rawG === 'WITHOUT GUIDE' || rawG === 'H1') ? rawG : getCanonicalName(rawG, knownGuidesList);

      // Auto-register guide if not present
      if (!registeredGuides.some(g => g.name.toUpperCase() === finalGuideName.toUpperCase())) {
        const newGuideId = guideIdInput.trim() || String(Math.floor(100000 + Math.random() * 900000));
        const newRegGuide: RegisteredGuide = {
          id: newGuideId,
          name: finalGuideName,
          status: 'Active'
        };
        const nextGuides = [...registeredGuides, newRegGuide];
        setRegisteredGuides(nextGuides);
        saveGuidesToStorage(nextGuides);
      }
    } else if (guideIdInput && guideIdInput.trim()) {
      const cleanGId = guideIdInput.trim();
      finalGuideName = cleanGId.toUpperCase();
      if (!registeredGuides.some(g => (g.id && g.id === cleanGId) || g.name.toUpperCase() === finalGuideName)) {
        const newRegGuide: RegisteredGuide = {
          id: cleanGId,
          name: finalGuideName,
          status: 'Active'
        };
        const nextGuides = [...registeredGuides, newRegGuide];
        setRegisteredGuides(nextGuides);
        saveGuidesToStorage(nextGuides);
      }
    } else {
      finalGuideName = isSingleBigVan ? 'WITHOUT GUIDE' : 'WITHOUT GUIDE';
    }

    const now = new Date();
    const fallbackDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const fallbackTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const resolvedDate = dateStr && dateStr.trim() ? dateStr.trim() : fallbackDate;
    const resolvedTime = timeStr && timeStr.trim() ? timeStr.trim() : fallbackTime;

    // Immediately keep date focused on the logged date
    setDateStr(resolvedDate);
    setCurrentDate(resolvedDate);

    const formattedDrivers: DriverItemData[] = validDrivers.map(d => {
      let dName = d.driverName.trim();
      if (!dName && d.driverId) {
        const match = getMatchedDriverForInput(d);
        if (match) dName = match.name;
      }
      const rawD = (dName || 'DRIVER').toUpperCase();
      let canonD = getCanonicalName(rawD, knownDriversList);
      const comp = d.companyName.trim().toUpperCase() || 'AGM';

      if (d.vanType === 'Mini van' && validDrivers.length > 1) {
        if (!canonD || canonD === 'H1') {
          canonD = `H1-${comp}`;
        } else if (!canonD.startsWith('H1-')) {
          canonD = `H1-${canonD}`;
        }
      }

      return {
        driver: canonD,
        van_type: d.vanType,
        company: comp,
        pax: d.pax?.trim() || ''
      };
    });

    const primaryDriverName = formattedDrivers.map(d => d.driver).join(' & ');
    const allSameCompany = formattedDrivers.every(d => d.company === formattedDrivers[0].company);
    const primaryCompany = allSameCompany ? formattedDrivers[0].company : formattedDrivers.map(d => `${d.driver}: ${d.company}`).join(' | ');
    const allSameVan = formattedDrivers.every(d => d.van_type === formattedDrivers[0].van_type);
    const primaryVanType = allSameVan ? formattedDrivers[0].van_type : formattedDrivers.map(d => `${d.driver}: ${d.van_type}`).join(' | ');

    const pPay = personExtra !== 'None' ? (personExtraPay || extraPayment || '0 DH') : '0 DH';
    const qPay = quadExtra !== 'None' ? (quadExtraPay || extraPayment || '0 DH') : '0 DH';
    const cPay = camelExtra !== 'None' ? (camelExtraPay || extraPayment || '0 DH') : '0 DH';

    const newId = results.length > 0 ? Math.max(...results.map(r => r.id || 0)) + 1 : 1;
    const recordData: ResultItem = {
      id: editingId !== null ? editingId : newId,
      van_type: primaryVanType,
      guide: finalGuideName,
      driver: primaryDriverName,
      company: primaryCompany,
      pax: paxCount.trim() || '0',
      quads: quadsCount.trim() || '0',
      camels: camelsCount.trim() || '0',
      person_extra: personExtra.trim() || 'None',
      quad_extra: quadExtra.trim() || 'None',
      camel_extra: camelExtra.trim() || 'None',
      person_extra_pay: pPay,
      quad_extra_pay: qPay,
      camel_extra_pay: cPay,
      extra_payment: extraPayment.trim() || '0 DH',
      meal: (mealOption !== 'None' && mealOption !== 'Unselected') ? mealOption : 'None',
      date: resolvedDate,
      time: resolvedTime,
      driversList: formattedDrivers
    };

    // Ensure hasStartedWork is locked to true
    setHasStartedWork(true);
    try {
      localStorage.setItem('agm_has_started_work', 'true');
    } catch (e) {
      console.warn('localStorage error:', e);
    }

    // Direct synchronous state & localStorage update for instant display in Daily Logged
    if (editingId !== null) {
      setResults(prev => {
        const updated = prev.map(item => item.id === editingId ? recordData : item);
        try {
          localStorage.setItem('agm_results', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      showNotification("Record modified successfully!");
    } else {
      setResults(prev => {
        const updated = [recordData, ...prev.filter(item => item.id !== recordData.id)];
        try {
          localStorage.setItem('agm_results', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      showNotification(`New entry logged for ${finalGuideName} (${formattedDrivers.length} driver${formattedDrivers.length > 1 ? 's' : ''})!`);
    }

    // Clear search query so new record is visible immediately
    setDailyLoggedSearchQuery('');
    handleClean();

    // Persist to Embedded SQLite database in background
    try {
      if (editingId !== null) {
        await updateTripSql(recordData);
      } else {
        await insertTripSql(recordData);
      }
    } catch (e) {
      console.warn("SQLite persistence notice:", e);
    }

    // Sync with Electron backend if running inside Electron app on laptop
    if (window.electronAPI) {
      try {
        await window.electronAPI.addUpdate(recordData);
      } catch (err) {
        console.warn("Failed to add/update in Electron:", err);
      }
    }
  };

  // Remove row
  const handleDelete = async (id: number, e?: MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Immediate state & localStorage update
    setResults(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem('agm_results', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    showNotification(`Removed record #${id}`);

    // Delete from SQLite
    try {
      await deleteTripSql(id);
    } catch (e) {
      console.warn("SQLite delete notice:", e);
    }

    // Delete from Electron if available
    if (window.electronAPI) {
      try {
        await window.electronAPI.delete(id);
      } catch (err) {
        console.warn("Failed to delete in Electron:", err);
      }
    }

    if (editingId === id) {
      handleClean();
    }
  };

  // Filtered results by search query and category filter
  const filteredDisplayedResults = useMemo(() => {
    let list = results.filter(r => r.date === dateStr);
    
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(r => 
        r.guide.toLowerCase().includes(q) ||
        r.driver.toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q) ||
        r.pax.includes(q) ||
        r.date.includes(q) ||
        r.time.includes(q)
      );
    }

    if (selectedCategoryFilter === 'Big Van') {
      list = list.filter(r => r.van_type !== 'Mini van');
    } else if (selectedCategoryFilter === 'Mini Van') {
      list = list.filter(r => r.van_type === 'Mini van');
    } else if (selectedCategoryFilter === 'Quads') {
      list = list.filter(r => parseInt(r.quads) > 0 || (r.quad_extra && r.quad_extra !== 'None'));
    } else if (selectedCategoryFilter === 'Camels') {
      list = list.filter(r => parseInt(r.camels) > 0 || (r.camel_extra && r.camel_extra !== 'None'));
    } else if (selectedCategoryFilter === 'Extras') {
      list = list.filter(r => (r.extra_payment && r.extra_payment !== '0 DH' && r.extra_payment !== 'None') || (r.person_extra && r.person_extra !== 'None'));
    }

    return list;
  }, [results, dateStr, searchTerm, selectedCategoryFilter]);

  // Only display results for current selected date on interface
  const displayedResults = results.filter(r => r.date === dateStr);
  const doneCount = displayedResults.filter(r => isRecordComplete(r)).length;
  const restCount = displayedResults.length - doneCount;

  // Filtered results based on daily logged filter (all, rest, done) and search query
  const filteredDailyResults = useMemo(() => {
    let list = displayedResults;

    if (dailyLoggedFilter === 'done') {
      list = list.filter(item => isRecordComplete(item));
    } else if (dailyLoggedFilter === 'rest') {
      list = list.filter(item => !isRecordComplete(item));
    }

    const q = dailyLoggedSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(item => {
      const driverMatch = (item.driver || '').toLowerCase().includes(q);
      const guideMatch = (item.guide || '').toLowerCase().includes(q);
      const companyMatch = (item.company || '').toLowerCase().includes(q);
      const vanMatch = (item.van_type || '').toLowerCase().includes(q);
      const extraPaymentMatch = (item.extra_payment || '').toLowerCase().includes(q);
      const paxMatch = (item.pax || '').toLowerCase().includes(q);
      const timeMatch = (item.time || '').toLowerCase().includes(q);
      const mealMatch = (item.meal || '').toLowerCase().includes(q);
      const driversListMatch = item.driversList?.some(d => 
        (d.driver || '').toLowerCase().includes(q) || 
        (d.company || '').toLowerCase().includes(q) ||
        (d.van_type || '').toLowerCase().includes(q)
      );
      return driverMatch || guideMatch || companyMatch || vanMatch || extraPaymentMatch || paxMatch || timeMatch || mealMatch || Boolean(driversListMatch);
    });
  }, [displayedResults, dailyLoggedFilter, dailyLoggedSearchQuery]);

  // Source string for style.py
  const styleCodeString = `import customtkinter as ctk
import datetime
from tkinter import messagebox
import backPro

# Set window defaults
ctk.set_appearance_mode("Light")
ctk.set_default_color_theme("blue")

class AGMMainApplication(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Configure Main App Window
        self.title("AGM - TRAVEL Management Panel")
        self.geometry("1180x700")
        self.resizable(True, True)
        self.configure(fg_color="#EBEBEB")  # Matching reference light-grey background exactly
        
        # Track which ID is being updated (None = Insert Mode, Integer = Modify Mode)
        self.editing_id = None
        self.finalize_btn = None
        
        # Setup default date and time values
        today = datetime.datetime.now()
        self.default_date = today.strftime("%d-%m-%Y")
        self.default_time = today.strftime("%H:%M")

        # Initialize local database system
        backPro.initialize_system()

        # Show the Start The Work Screen first before showing main components
        self.show_start_work_screen()

    def create_header(self):
        """Builds the custom decorative laurel wreath header logo and subtitles."""
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=40, pady=(15, 5))

        # We represent the (AGM) logo nicely in text and layout
        logo_label = ctk.CTkLabel(
            header_frame, 
            text="( AGM )", 
            font=ctk.CTkFont(family="Helvetica", size=32, weight="bold"),
            text_color="#1A1A1A"
        )
        logo_label.pack(pady=(0, 2))
        
        sub1 = ctk.CTkLabel(
            header_frame, 
            text="AGM - TRAVEL 9/7/2026", 
            font=ctk.CTkFont(family="Helvetica", size=11, weight="bold"),
            text_color="#555555"
        )
        sub1.pack()
        
        sub2 = ctk.CTkLabel(
            header_frame, 
            text="System work By \\"Name\\", work in the background OJ-Abde", 
            font=ctk.CTkFont(family="Helvetica", size=10, slant="italic"),
            text_color="#777777"
        )
        sub2.pack(pady=(0, 10))
        
        # Horizontal Divider Line separating header from panel
        divider = ctk.CTkFrame(self, height=2, fg_color="#D0D0D0")
        divider.pack(fill="x", padx=40, pady=(0, 15))

    def create_main_layout(self):
        """Constructs the two-column master frame (Left inputs, Right results)."""
        self.container = ctk.CTkFrame(self, fg_color="transparent")
        self.container.pack(fill="both", expand=True, padx=40, pady=(0, 10))
        
        self.container.columnconfigure(0, weight=2, minsize=340)  # Left input panel
        self.container.columnconfigure(1, weight=3, minsize=560)  # Right results screen
        self.container.rowconfigure(0, weight=1)

        # ------------------ LEFT SIDE (INPUTS) ------------------
        left_panel = ctk.CTkFrame(self.container, fg_color="transparent")
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 25))
        
        left_scroll = ctk.CTkScrollableFrame(left_panel, fg_color="transparent", width=330)
        left_scroll.pack(fill="both", expand=True)

        # Van Type Selection
        van_label = ctk.CTkLabel(
            left_scroll, 
            text="Van Type", 
            font=ctk.CTkFont(family="Helvetica", size=15, weight="bold"),
            anchor="w"
        )
        van_label.pack(fill="x", pady=(5, 5))
        
        self.van_var = ctk.StringVar(value="Big van")
        self.van_seg = ctk.CTkSegmentedButton(
            left_scroll,
            values=["Big van", "Mini van"],
            variable=self.van_var,
            font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"),
            height=38,
            corner_radius=10,
            command=self.on_van_type_change
        )
        self.van_seg.pack(fill="x", pady=(0, 15))

        # 1. Guide Name
        guide_label = ctk.CTkLabel(
            left_scroll, 
            text="Guide Name", 
            font=ctk.CTkFont(family="Helvetica", size=15, weight="bold"),
            anchor="w"
        )
        guide_label.pack(fill="x", pady=(5, 5))
        
        self.guide_var = ctk.StringVar()
        guide_input_frame = ctk.CTkFrame(left_scroll, fg_color="#B0B0B0", height=45, corner_radius=10)
        guide_input_frame.pack(fill="x", pady=(0, 15))
        guide_input_frame.pack_propagate(False)
        
        self.guide_entry = ctk.CTkEntry(
            guide_input_frame, 
            textvariable=self.guide_var,
            fg_color="transparent", 
            border_width=0, 
            font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"),
            placeholder_text="Guide Name",
            placeholder_text_color="#555555",
            text_color="#111111"
        )
        self.guide_entry.pack(side="left", fill="both", expand=True, padx=15)
        
        guide_clear_btn = ctk.CTkButton(
            guide_input_frame, 
            text="✕", 
            width=25, 
            fg_color="transparent", 
            hover_color="#A0A0A0",
            text_color="#444444", 
            font=ctk.CTkFont(weight="bold"),
            command=lambda: self.guide_var.set("")
        )
        guide_clear_btn.pack(side="right", fill="y", padx=5)

        # 2. Driver Name
        driver_label = ctk.CTkLabel(
            left_scroll, 
            text="Driver Name", 
            font=ctk.CTkFont(family="Helvetica", size=15, weight="bold"),
            anchor="w"
        )
        driver_label.pack(fill="x", pady=(5, 5))
        
        self.driver_var = ctk.StringVar()
        driver_input_frame = ctk.CTkFrame(left_scroll, fg_color="#B0B0B0", height=45, corner_radius=10)
        driver_input_frame.pack(fill="x", pady=(0, 20))
        driver_input_frame.pack_propagate(False)
        
        self.driver_entry = ctk.CTkEntry(
            driver_input_frame, 
            textvariable=self.driver_var,
            fg_color="transparent", 
            border_width=0, 
            font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"),
            placeholder_text="Driver Name",
            placeholder_text_color="#555555",
            text_color="#111111"
        )
        self.driver_entry.pack(side="left", fill="both", expand=True, padx=15)
        
        driver_clear_btn = ctk.CTkButton(
            driver_input_frame, 
            text="✕", 
            width=25, 
            fg_color="transparent", 
            hover_color="#A0A0A0",
            text_color="#444444", 
            font=ctk.CTkFont(weight="bold"),
            command=lambda: self.driver_var.set("")
        )
        driver_clear_btn.pack(side="right", fill="y", padx=5)

        # 3. More INFO Panel
        more_info_label = ctk.CTkLabel(
            left_scroll, 
            text="More INFO", 
            font=ctk.CTkFont(family="Helvetica", size=15, weight="bold"),
            anchor="w"
        )
        more_info_label.pack(fill="x", pady=(5, 5))
        
        info_container = ctk.CTkFrame(left_scroll, fg_color="#D5D5D5", corner_radius=15)
        info_container.pack(fill="x", pady=(0, 15))
        
        # N• Pax
        self.pax_var = ctk.StringVar()
        pax_row = ctk.CTkFrame(info_container, fg_color="transparent")
        pax_row.pack(fill="x", padx=12, pady=(12, 5))
        pax_badge = ctk.CTkLabel(
            pax_row, 
            text="N• Pax", 
            fg_color="#2E2E2E", 
            text_color="white",
            corner_radius=8, 
            width=110, 
            height=34,
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold")
        )
        pax_badge.pack(side="left", padx=(0, 10))
        self.pax_entry = ctk.CTkEntry(
            pax_row, 
            textvariable=self.pax_var,
            placeholder_text="Number", 
            fg_color="white", 
            border_width=0,
            text_color="#111111",
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            corner_radius=8, 
            height=34
        )
        self.pax_entry.pack(side="right", fill="x", expand=True)
        
        # N• Quads
        self.quads_var = ctk.StringVar()
        quads_row = ctk.CTkFrame(info_container, fg_color="transparent")
        quads_row.pack(fill="x", padx=12, pady=5)
        quads_badge = ctk.CTkLabel(
            quads_row, 
            text="N• Quads", 
            fg_color="#2E2E2E", 
            text_color="white",
            corner_radius=8, 
            width=110, 
            height=34,
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold")
        )
        quads_badge.pack(side="left", padx=(0, 10))
        self.quads_entry = ctk.CTkEntry(
            quads_row, 
            textvariable=self.quads_var,
            placeholder_text="Number", 
            fg_color="white", 
            border_width=0,
            text_color="#111111",
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            corner_radius=8, 
            height=34
        )
        self.quads_entry.pack(side="right", fill="x", expand=True)

        # N• Camels
        self.camels_var = ctk.StringVar()
        camels_row = ctk.CTkFrame(info_container, fg_color="transparent")
        camels_row.pack(fill="x", padx=12, pady=(5, 12))
        camels_badge = ctk.CTkLabel(
            camels_row, 
            text="N• Camels", 
            fg_color="#2E2E2E", 
            text_color="white",
            corner_radius=8, 
            width=110, 
            height=34,
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold")
        )
        camels_badge.pack(side="left", padx=(0, 10))
        self.camels_entry = ctk.CTkEntry(
            camels_row, 
            textvariable=self.camels_var,
            placeholder_text="Number", 
            fg_color="white", 
            border_width=0,
            text_color="#111111",
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            corner_radius=8, 
            height=34
        )
        self.camels_entry.pack(side="right", fill="x", expand=True)

        # 4. Date Input
        date_label = ctk.CTkLabel(
            left_scroll, 
            text="Date (DD-MM-YYYY)", 
            font=ctk.CTkFont(family="Helvetica", size=14, weight="bold"),
            anchor="w"
        )
        date_label.pack(fill="x", pady=(5, 3))
        self.date_var = ctk.StringVar(value=self.default_date)
        self.date_entry = ctk.CTkEntry(
            left_scroll,
            textvariable=self.date_var,
            fg_color="#B0B0B0",
            border_width=0,
            corner_radius=10,
            text_color="#111111",
            font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"),
            height=40
        )
        self.date_entry.pack(fill="x", pady=(0, 10))

        # 5. Time Input
        time_label = ctk.CTkLabel(
            left_scroll, 
            text="Time (HH:MM)", 
            font=ctk.CTkFont(family="Helvetica", size=14, weight="bold"),
            anchor="w"
        )
        time_label.pack(fill="x", pady=(5, 3))
        self.time_var = ctk.StringVar(value=self.default_time)
        self.time_entry = ctk.CTkEntry(
            left_scroll,
            textvariable=self.time_var,
            fg_color="#B0B0B0",
            border_width=0,
            corner_radius=10,
            text_color="#111111",
            font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"),
            height=40
        )
        self.time_entry.pack(fill="x", pady=(0, 20))

        # Submit & Clear Buttons
        self.submit_btn = ctk.CTkButton(
            left_scroll, 
            text="Submit", 
            fg_color="#00C853", 
            hover_color="#00A844",
            text_color="white", 
            font=ctk.CTkFont(family="Helvetica", size=14, weight="bold"),
            height=44, 
            corner_radius=10,
            command=self.on_submit
        )
        self.submit_btn.pack(fill="x", pady=(0, 10))
        
        self.cleane_btn = ctk.CTkButton(
            left_scroll, 
            text="Cleane", 
            fg_color="#C0C0C0", 
            hover_color="#A8A8A8",
            text_color="#111111", 
            font=ctk.CTkFont(family="Helvetica", size=14, weight="bold"),
            height=44, 
            corner_radius=10,
            command=self.on_clean
        )
        self.cleane_btn.pack(fill="x")

        # Enforce numeric-only values on variables
        def enforce_numeric(var):
            val = var.get()
            filtered = "".join([c for c in val if c.isdigit()])
            if val != filtered:
                var.set(filtered)

        self.pax_var.trace_add("write", lambda *args: enforce_numeric(self.pax_var))
        self.quads_var.trace_add("write", lambda *args: enforce_numeric(self.quads_var))
        self.camels_var.trace_add("write", lambda *args: enforce_numeric(self.camels_var))

        # ------------------ RIGHT SIDE (RESULTS LIST) ------------------
        self.right_panel = ctk.CTkFrame(self.container, fg_color="transparent")
        self.right_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        self.right_panel.rowconfigure(1, weight=1)
        self.right_panel.columnconfigure(0, weight=1)
        
        # Header container for "Results :" and the push button
        results_header_frame = ctk.CTkFrame(self.right_panel, fg_color="transparent")
        results_header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        results_header_frame.columnconfigure(0, weight=1)
        results_header_frame.columnconfigure(1, weight=0)
        
        results_label = ctk.CTkLabel(
            results_header_frame, 
            text="Results :", 
            font=ctk.CTkFont(family="Helvetica", size=16, weight="bold"),
            anchor="w"
        )
        results_label.grid(row=0, column=0, sticky="w")
        
        # Create the transparent 50% opacity push button
        self.finalize_btn = ctk.CTkButton(
            results_header_frame,
            text="Finalize Work Day",
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            fg_color="#91A087",
            hover_color="#7FA36B",
            text_color="#1E3014",
            corner_radius=8,
            height=30,
            width=140,
            command=self.on_finalize_day
        )
        self.finalize_btn.grid(row=0, column=1, sticky="e")
        
        # Main results list container frame (with grey bg and rounded corners)
        self.results_container = ctk.CTkFrame(self.right_panel, fg_color="#D5D5D5", corner_radius=15)
        self.results_container.grid(row=1, column=0, sticky="nsew")
        
        self.scroll_frame = ctk.CTkScrollableFrame(self.results_container, fg_color="transparent")
        self.scroll_frame.pack(fill="both", expand=True, padx=12, pady=(15, 60))
        
        # Pinned Dark Footer
        self.footer_bar = ctk.CTkFrame(self.results_container, fg_color="#2E2E2E", height=45, corner_radius=0)
        self.footer_bar.place(relx=0, rely=1.0, relwidth=1.0, y=-45, anchor="nw")
        
        self.stats_label = ctk.CTkLabel(
            self.footer_bar, 
            text="Daitels DONE : 0   REST : 0", 
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            text_color="white"
        )
        self.stats_label.pack(side="left", padx=20)
        
        self.date_label = ctk.CTkLabel(
            self.footer_bar, 
            text=self.default_date, 
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            text_color="white"
        )
        self.date_label.pack(side="right", padx=20)

        # Trace changes to the date variable to immediately filter displayed results dynamically
        self.date_var.trace_add("write", lambda *args: self.load_and_render_data())

    def load_and_render_data(self):
        """Fetches from backend database and refreshes the Results column cards."""
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()
            
        records = backPro.load_records()
        for index, item in enumerate(records):
            is_done = backPro.is_record_complete(item)
            
            card_bg = "#00C853" if is_done else "#C0C0C0"
            text_color = "#004D1A" if is_done else "#1A1A1A"
            subtext_color = "#005E20" if is_done else "#555555"
            
            card = ctk.CTkFrame(self.scroll_frame, fg_color=card_bg, height=52, corner_radius=10)
            card.pack(fill="x", pady=5)
            card.pack_propagate(False)
            
            num_lbl = ctk.CTkLabel(card, text=f"  {index + 1} ", font=ctk.CTkFont(family="Helvetica", size=14, weight="bold"), text_color=text_color)
            num_lbl.pack(side="left", padx=(10, 5))
            
            names_lbl = ctk.CTkLabel(card, text=f" {item['guide'].upper()} & {item['driver'].upper()} ", font=ctk.CTkFont(family="Helvetica", size=13, weight="bold"), text_color=text_color)
            names_lbl.pack(side="left", padx=5)
            
            div_lbl = ctk.CTkLabel(card, text="|", font=ctk.CTkFont(family="Helvetica", size=15), text_color=subtext_color)
            div_lbl.pack(side="left", padx=10)
            
            pax_lbl = ctk.CTkLabel(card, text=f"N• Pax {item.get('pax', '?')}", font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"), text_color=subtext_color)
            pax_lbl.pack(side="left", padx=8)
            
            quads_lbl = ctk.CTkLabel(card, text=f"N• Quads {item.get('quads', '?')}", font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"), text_color=subtext_color)
            quads_lbl.pack(side="left", padx=8)
            
            camels_lbl = ctk.CTkLabel(card, text=f"N• Camels {item.get('camels', '?')}", font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"), text_color=subtext_color)
            camels_lbl.pack(side="left", padx=8)

            actions_frame = ctk.CTkFrame(card, fg_color="transparent")
            actions_frame.pack(side="right", padx=10, fill="y")

            edit_btn = ctk.CTkButton(
                actions_frame, text="Edit", width=35, height=30, fg_color="transparent",
                hover_color="#00B34A" if is_done else "#B0B0B0", text_color=text_color,
                command=lambda item_id=item["id"]: self.load_record_to_inputs(item_id)
            )
            edit_btn.pack(side="left", padx=2, pady=11)

            delete_btn = ctk.CTkButton(
                actions_frame, text="Del", width=35, height=30, fg_color="transparent",
                hover_color="#FF4D4D", text_color="#C62828" if not is_done else "#004D1A",
                command=lambda item_id=item["id"]: self.on_delete(item_id)
            )
            delete_btn.pack(side="left", padx=2, pady=11)

        done_count, rest_count = backPro.get_stats()
        self.stats_label.configure(text=f"Daitels DONE : {done_count}   REST : {rest_count}")

    def load_record_to_inputs(self, item_id):
        records = backPro.load_records()
        for item in records:
            if item["id"] == item_id:
                self.editing_id = item_id
                van_val = item.get("van_type", "Big van")
                self.van_var.set(van_val)
                self.guide_var.set(item["guide"])
                self.driver_var.set(item["driver"])
                self.pax_var.set("" if item["pax"] == "?" else item["pax"])
                self.quads_var.set("" if item["quads"] == "?" else item["quads"])
                self.camels_var.set("" if item["camels"] == "?" else item["camels"])
                self.date_var.set(item["date"])
                self.time_var.set(item["time"])
                
                if van_val == "Mini van":
                    self.guide_entry.configure(state="disabled")
                else:
                    self.guide_entry.configure(state="normal")
                
                self.submit_btn.configure(text="Update Item", fg_color="#1976D2")
                break

    def on_submit(self):
        van_type = self.van_var.get().strip()
        guide = self.guide_var.get().strip()
        driver = self.driver_var.get().strip()
        pax = self.pax_var.get().strip()
        quads = self.quads_var.get().strip()
        camels = self.camels_var.get().strip()
        date_val = self.date_var.get().strip()
        time_val = self.time_var.get().strip()
        
        if van_type == "Big van" and not guide:
            messagebox.showwarning("Warning", "Guide Name is required for Big van!")
            return
            
        if not driver:
            messagebox.showwarning("Warning", "Driver Name is required!")
            return

        backPro.add_or_update_record(self.editing_id, van_type, guide, driver, pax, quads, camels, date_val, time_val)
        self.on_clean()
        self.load_and_render_data()

    def on_delete(self, item_id):
        if messagebox.askyesno("Delete", "Are you sure?"):
            backPro.delete_record(item_id)
            self.load_and_render_data()

    def on_van_type_change(self, value):
        if value == "Mini van":
            self.guide_var.set("H1")
            self.guide_entry.configure(state="disabled")
        else:
            if self.guide_var.get() == "H1" or self.guide_var.get() == "WITHOUT GUIDE":
                self.guide_var.set("")
            self.guide_entry.configure(state="normal")

    def on_clean(self):
        self.van_var.set("Big van")
        self.guide_entry.configure(state="normal")
        self.guide_var.set("")
        self.driver_var.set("")
        self.pax_var.set("")
        self.quads_var.set("")
        self.camels_var.set("")
        self.date_var.set(self.default_date)
        self.time_var.set(self.default_time)
        self.editing_id = None
        self.submit_btn.configure(text="Submit", fg_color="#00C853")

    def show_start_work_screen(self):
        """Displays a gorgeous full-window start screen to begin the workday."""
        self.start_frame = ctk.CTkFrame(self, fg_color="#EBEBEB")
        self.start_frame.pack(fill="both", expand=True)
        
        # Center packing container to vertically align all elements nicely
        center_container = ctk.CTkFrame(self.start_frame, fg_color="transparent")
        center_container.place(relx=0.5, rely=0.5, anchor="center")
        
        # Decorative ( AGM ) logo
        logo_label = ctk.CTkLabel(
            center_container, 
            text="( AGM )", 
            font=ctk.CTkFont(family="Helvetica", size=48, weight="bold"),
            text_color="#1A1A1A"
        )
        logo_label.pack(pady=(20, 25))
        
        # Bold bright green start button
        start_btn = ctk.CTkButton(
            center_container,
            text="Start Work",
            font=ctk.CTkFont(family="Helvetica", size=18, weight="bold"),
            fg_color="#00C853",  # Bright Green
            hover_color="#00A844",
            text_color="#FFFFFF",
            corner_radius=14,
            height=50,
            width=240,
            command=self.on_start_work
        )
        start_btn.pack(pady=10)

        # Developer Credit / Background Work text
        info_label = ctk.CTkLabel(
            center_container, 
            text="System work By Asmae, work in the\\nbackground X-Abde", 
            font=ctk.CTkFont(family="Helvetica", size=13, weight="medium"),
            text_color="#444444",
            justify="center"
        )
        info_label.pack(pady=(15, 10))
        
        # Date section
        date_title_label = ctk.CTkLabel(
            center_container, 
            text="Date of today", 
            font=ctk.CTkFont(family="Helvetica", size=12),
            text_color="#777777"
        )
        date_title_label.pack(pady=(10, 2))
        
        spaced_date = self.default_date.replace("-", " - ")
        date_val_label = ctk.CTkLabel(
            center_container, 
            text=spaced_date, 
            font=ctk.CTkFont(family="Helvetica", size=15, weight="bold"),
            text_color="#1A1A1A"
        )
        date_val_label.pack(pady=(0, 20))

        # Bottom positioned software watermark
        footer_watermark = ctk.CTkLabel(
            self.start_frame,
            text="AGM- Travel Managment System",
            font=ctk.CTkFont(family="Helvetica", size=12, weight="bold"),
            text_color="#555555"
        )
        footer_watermark.place(relx=0.5, rely=0.95, anchor="center")

    def on_start_work(self):
        today_date = backPro.check_and_create_today_excel()
        self.start_frame.destroy()
        self.create_header()
        self.create_main_layout()
        self.load_and_render_data()

    def on_finalize_day(self):
        backPro.sync_to_excel()
        messagebox.showinfo(
            "Day Finalized", 
            f"All guides are complete and highlighted in Green!\\n\\n"
            f"Monthly workbook has been successfully compiled, "
            f"styled with the Premium AGM layout, and saved in your work directories:\\n"
            f"- Desktop/AGM-AGAFAY/\\n"
            f"- Documents/AGM-AGAFAY/\\n\\n"
            f"Great job finishing today's operations!"
        )

if __name__ == "__main__":
    app = AGMMainApplication()
    app.mainloop()`;

  const copyBackProCode = () => {
    navigator.clipboard.writeText(backProCodeString);
    setCopiedBackPro(true);
    showNotification("backPro.py code copied to clipboard!");
    setTimeout(() => setCopiedBackPro(false), 2000);
  };

  return (
    <div className="w-full h-full flex-1 overflow-hidden bg-[#060e12] text-zinc-100 flex flex-col font-sans select-none relative">
      
      {/* AutoPyne Opening Intro Page Overlay */}
      <AnimatePresence>
        {showIntroScreen && (
          <motion.div
            key="autopyne-intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50"
          >
            <AutoPyneIntro 
              onStartWork={() => {
                setHasStartedWork(true);
                setShowIntroScreen(false);
              }} 
              currentManager={currentManager}
              onOpenAddManager={() => {
                setAdminEmail('ismail@admin.com');
                setAdminPassword('');
                setAdminLoginError(null);
                setShowAdminLoginModal(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -25, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -25, x: "-50%" }}
            className="fixed top-5 left-1/2 z-50 bg-[#0c191d] text-[#00e6a8] font-mono text-xs border border-[#00c896]/40 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 backdrop-blur-md"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#00e6a8] animate-pulse shadow-[0_0_8px_#00e6a8]" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MAIN APPLICATION LAYOUT ================= */}
      <div className="w-full h-full flex-1 bg-[#081015] text-zinc-100 flex flex-col px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 space-y-3.5 overflow-hidden">

        {/* Top Bar Navigation Controls Header */}
        <header className="w-full bg-[#0a161d]/90 border border-[#162e3b] rounded-2xl px-4 sm:px-6 lg:px-7 py-2.5 sm:py-3 shadow-lg flex items-center justify-between flex-wrap gap-3 shrink-0 backdrop-blur-md">
          {/* Left Header Tools & AutoPyne Brand Logo */}
          <div className="flex items-center gap-3">
            {/* AutoPyne System Brand Logo */}
            <AutoPyneHeaderBrand onClick={() => setShowIntroScreen(true)} />

            <div className="h-6 w-px bg-[#162934] hidden sm:block" />

            <button
              type="button"
              onClick={() => setShowFilePermissionModal(true)}
              className="bg-[#060e12] hover:bg-[#0c1a22] text-zinc-200 border border-[#152733] text-xs font-mono font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer hidden md:flex"
              title="File System Access: Connected to Local AutoPyne-AGM WorkSpace"
            >
              <FolderLock className="w-3.5 h-3.5 text-[#00e6a8]" />
              <span className="w-2 h-2 rounded-full bg-[#00e6a8] animate-pulse" />
              <span>File Access: <strong className="text-[#00e6a8]">{directoryHandle ? 'Active' : 'Granted'}</strong></span>
            </button>
          </div>

          {/* Right Header Tools: Staff & Accounts, Admin Ismail, Show Excel, Manager Profile Avatar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Unified Staff & Accounts Hub Button with Counter */}
            <button
              type="button"
              onClick={() => setShowStaffModal(true)}
              className="bg-[#091f1a] hover:bg-[#0d2d26] text-[#00e6a8] border border-[#00c896]/60 hover:border-[#00e6a8] text-xs font-mono font-black px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,200,150,0.15)] active:scale-95 group"
              title="Staff, Guides, Drivers, Transport Companies & Accounts Ledger"
            >
              <Users className="w-3.5 h-3.5 text-[#00e6a8] group-hover:scale-110 transition-transform" />
              <span>Staff &amp; Accounts</span>
              <span className="bg-[#00c896] text-zinc-950 px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none shadow-sm">
                {staffProfiles.length}
              </span>
            </button>

            {/* Admin Ismail Portal Button */}
            <button
              type="button"
              onClick={() => setShowAdminLoginModal(true)}
              className="bg-[#0c1820] hover:bg-[#11232e] text-amber-300 border border-amber-500/40 hover:border-amber-400 text-xs font-mono font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Admin Ismail Master Management Portal"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Ismail</span>
            </button>

            {/* Show Excel Button (Placed in the Top Header) */}
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="bg-[#0f6b38] hover:bg-[#0c592e] text-white text-xs font-mono font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
              title="Open Monthly Holding Company Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Show Excel</span>
            </button>

            {/* Manager Profile Avatar */}
            <button
              type="button"
              onClick={() => setShowManagerProfileModal(true)}
              className="w-8 h-8 rounded-full bg-[#00c896]/20 border border-[#00c896] text-[#00e6a8] font-mono font-black text-xs flex items-center justify-center uppercase cursor-pointer hover:scale-105 transition-transform shadow-[0_0_12px_rgba(0,200,150,0.3)] ml-0.5"
              title={`Manager Profile: ${currentManager ? `${currentManager.name} ${currentManager.lastname}` : 'Abdelilah Amzil'}`}
            >
              {currentManager ? currentManager.name.charAt(0) : 'A'}
            </button>
          </div>
        </header>

        {/* ================= 4. MAIN WORKSPACE GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-left items-stretch flex-1 min-h-0 w-full overflow-hidden">

            {/* Left Column (5 Cols): TRIP INPUT DETAILS CARD */}
            {(() => {
              const editingRecordIndex = editingId !== null ? displayedResults.findIndex(item => item.id === editingId) : -1;
              const editingDisplayNum = editingRecordIndex !== -1 ? (editingRecordIndex + 1) : '';

              const isSingleMiniVan = driversInput.length === 1 && driversInput[0].vanType === 'Mini van';
              const isSingleBigVan = driversInput.length === 1 && driversInput[0].vanType === 'Big van';

              return (
                <div 
                  ref={leftPanelRef}
                  className={`lg:col-span-5 bg-[#0a141a] rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full min-h-0 overflow-y-auto no-scrollbar space-y-3.5 transition-colors ${
                    editingId !== null 
                      ? 'border border-amber-400/50' 
                      : 'border border-[#152733]'
                  }`}
                >
                  {/* Header & Editing Status Banner */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-[#152733] pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#00c896]/10 text-[#00e6a8] flex items-center justify-center border border-[#00c896]/20">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-mono font-extrabold text-white uppercase tracking-wider">
                          TRIP INPUT DETAILS
                        </h3>
                      </div>
                      {editingId !== null && (
                        <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-400/30 px-2 py-0.5 rounded-md uppercase">
                          Mode: Modify {editingDisplayNum ? `#${editingDisplayNum}` : ''}
                        </span>
                      )}
                    </div>

                    {/* VISUAL INDICATOR BANNER WHEN USER IS MODIFYING A RECORD */}
                    {editingId !== null && (
                      <div className="bg-amber-950/40 border border-amber-400/30 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs font-mono animate-fadeIn">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                            <Pencil className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-amber-300 uppercase tracking-wide text-[11px] truncate">
                              MODIFYING {vanType === 'Mini van' || !guideName || guideName.toUpperCase() === 'H1' || guideName.toUpperCase() === 'NONE' ? `DRIVER ${driverName.toUpperCase() || 'RECORD'}` : `GUIDE ${guideName.toUpperCase()}`} {editingDisplayNum ? `(#${editingDisplayNum})` : ''}
                            </p>
                            <p className="text-[10px] text-amber-200/70 truncate">
                              Inputs loaded. Edit values below and click Modify button.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

              {/* DATE & TIME in the Same Line */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-300 mb-1 uppercase tracking-wider">DATE</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      className="w-full bg-[#050b0e] border border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#071319] rounded-xl px-2.5 py-2 text-white font-mono text-xs font-bold outline-none shadow-inner placeholder-zinc-500 transition-all"
                    />
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-zinc-300 mb-1 uppercase tracking-wider">TIME</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={timeStr}
                      onChange={(e) => setTimeStr(e.target.value)}
                      placeholder="10:31"
                      className="w-full bg-[#050b0e] border border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#071319] rounded-xl px-2.5 py-2 text-white font-mono text-xs font-bold outline-none shadow-inner placeholder-zinc-500 transition-all"
                    />
                    <Clock className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* DYNAMIC MULTI-DRIVER & GUIDE SETUP */}
              <div className="space-y-2.5 bg-[#050b0e] p-3 rounded-2xl border border-[#182e3b] shadow-md">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00e6a8]" />
                    <span>GUIDE & DRIVER(S) SETUP</span>
                  </label>
                  <span className="text-[9px] font-mono text-[#00e6a8] bg-[#00c896]/20 border border-[#00c896]/50 px-2 py-0.5 rounded-full font-bold">
                    {driversInput.length} Driver{driversInput.length > 1 ? 's' : ''} Assigned
                  </span>
                </div>

                {/* GUIDE 6-DIGIT ID & LIVE CONFIRMATION SQUARE */}
                <div className="bg-[#081217] border border-[#142834] p-3 rounded-xl shadow-sm space-y-2.5 font-mono">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-[#00e6a8]" />
                      <label className="block text-[9px] font-mono font-bold text-zinc-200 uppercase tracking-wider">
                        GUIDE 6-DIGIT ID & ASSIGNMENT
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSingleBigVan && !withoutGuide && (
                        <span className="text-[9px] font-mono text-amber-300 font-bold uppercase bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                          * Required for Big Van
                        </span>
                      )}
                      {withoutGuide && (
                        <span className="text-[9px] font-mono text-amber-300 font-bold uppercase bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1">
                          <UserX className="w-2.5 h-2.5" /> No Guide
                        </span>
                      )}
                      {isSingleMiniVan && (
                        <span className="text-[9px] font-mono text-cyan-300 font-bold uppercase bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                          Mini Van (Auto: H1)
                        </span>
                      )}
                      {!isSingleMiniVan && (
                        <button
                          type="button"
                          onClick={() => setShowIdManagerModal(true)}
                          className="text-[9px] font-mono text-[#00e6a8] hover:text-white bg-[#00c896]/10 hover:bg-[#00c896]/30 border border-[#00c896]/30 px-2 py-0.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          title="Open ID Manager Portal"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Guides & IDs</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SELECT SQUARE: BIG DRIVER VAN WITHOUT GUIDE */}
                  {!isSingleMiniVan && (
                    <div
                      onClick={() => {
                        const nextVal = !withoutGuide;
                        setWithoutGuide(nextVal);
                        if (nextVal) {
                          setGuideIdInput('');
                          setGuideName('');
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        withoutGuide
                          ? 'bg-amber-950/40 border-amber-400/80 text-amber-200 shadow-md ring-1 ring-amber-400/40'
                          : 'bg-[#04080b] hover:bg-[#07131a] border-[#162d3a] text-zinc-300 hover:text-white'
                      }`}
                      title="Select if Big Van driver came alone without a tour guide"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          withoutGuide
                            ? 'bg-amber-400 border-amber-300 text-zinc-950 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                            : 'border-zinc-600 bg-zinc-900/80'
                        }`}>
                          {withoutGuide && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="text-left min-w-0">
                          <span className="text-[11px] font-mono font-bold tracking-wide block truncate text-zinc-100">
                            Big Driver Van Without Guide
                          </span>
                          <span className="text-[9.5px] text-zinc-400 block truncate leading-tight">
                            Driver comes without guide (saved as &ldquo;WITHOUT GUIDE&rdquo;, credited to driver profile only)
                          </span>
                        </div>
                      </div>
                      {withoutGuide ? (
                        <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-zinc-950 shrink-0 shadow-sm">
                          NO GUIDE SELECTED
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono text-zinc-500 bg-[#061218] border border-[#142834] px-2 py-0.5 rounded shrink-0">
                          Select Square
                        </span>
                      )}
                    </div>
                  )}

                  {/* Single Row: Left = 6-Digit ID Input | Right = Live Confirmed Guide Name / Nickname */}
                  {withoutGuide ? (
                    <div className="bg-[#05151e] border border-amber-500/40 text-amber-300 px-3 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-2">
                        <UserX className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-[11px]">WITHOUT GUIDE (Driver Solo — No Tour Guide)</span>
                      </div>
                      <span className="text-[9px] bg-amber-400 text-zinc-950 font-black px-2 py-0.5 rounded uppercase shrink-0">
                        Driver Profile Only
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      {/* Left: 6-Digit ID Input (Numbers Only) */}
                      <div className="sm:col-span-5 relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={isSingleMiniVan ? 'H1' : guideIdInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setGuideIdInput(val);
                            // Auto match
                            const match = registeredGuides.find(g => g.id.replace(/\D/g, '') === val);
                            if (match) {
                              setGuideName(match.useNicknameInLogs && match.nickname ? match.nickname : match.name);
                            } else {
                              setGuideName('');
                            }
                          }}
                          disabled={isSingleMiniVan}
                          placeholder={isSingleBigVan ? "Enter 6-Digit ID (0-9)..." : "6-Digit ID (0-9)..."}
                          className="w-full bg-[#04080b] border border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#061218] rounded-xl px-3 py-2 text-[#00e6a8] font-mono text-xs font-black outline-none shadow-inner placeholder-zinc-500 transition-all disabled:opacity-50 disabled:bg-[#030608] tracking-wider"
                        />
                        {!isSingleMiniVan && guideIdInput && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 font-bold">
                            {guideIdInput.length}/6
                          </span>
                        )}
                      </div>

                      {/* Right: Confirmed Name / Nickname in the SAME square in front of ID */}
                      <div className="sm:col-span-7 min-w-0">
                        {isSingleMiniVan ? (
                          <div className="bg-[#05151e] border border-cyan-500/30 text-cyan-300 px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-between">
                            <span>Auto: H1 (No Guide)</span>
                            <span className="text-[9px] bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-400 border border-cyan-600/40">Standard</span>
                          </div>
                        ) : matchedGuide ? (
                          <div className="bg-[#051713] border border-[#00c896]/60 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shadow-sm min-w-0">
                            <div className="min-w-0 truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00e6a8] shrink-0" />
                                <span className="text-white font-extrabold text-xs uppercase truncate">
                                  {matchedGuide.useNicknameInLogs && matchedGuide.nickname
                                    ? matchedGuide.nickname
                                    : matchedGuide.name}
                                </span>
                                {matchedGuide.nickname && (
                                  <span className="text-[10px] text-teal-300 font-bold bg-[#0a2027] border border-[#14424e] px-1.5 py-0.2 rounded shrink-0">
                                    &ldquo;{matchedGuide.nickname}&rdquo;
                                  </span>
                                )}
                              </div>
                              {matchedGuide.useNicknameInLogs && matchedGuide.nickname && (
                                <span className="text-[9px] text-[#00e6a8] block truncate font-medium">
                                  Full Name: {matchedGuide.name} (Logs as nickname)
                                </span>
                              )}
                            </div>
                            <span className="bg-[#00c896] text-zinc-950 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                              Confirmed
                            </span>
                          </div>
                        ) : guideIdInput.trim() ? (
                          <div className="bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                            <span className="text-amber-300 font-bold text-[10px] truncate">
                              Unregistered ID [{guideIdInput}]
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowIdManagerModal(true)}
                              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 cursor-pointer"
                            >
                              + Register
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#04090c] border border-[#13242e] text-zinc-500 px-3 py-2 rounded-xl text-[11px] font-mono flex items-center justify-between">
                            <span>Enter ID to confirm guide</span>
                            <button
                              type="button"
                              onClick={() => setShowIdManagerModal(true)}
                              className="text-[#00e6a8] hover:underline text-[10px] font-bold cursor-pointer"
                            >
                              Browse IDs
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* DRIVERS LIST */}
                <div className="bg-[#081217] border border-[#142834] p-3 rounded-xl shadow-sm space-y-2.5 font-mono">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Bus className="w-3.5 h-3.5 text-amber-400" />
                      <label className="block text-[9px] font-mono font-bold text-zinc-200 uppercase tracking-wider">
                        DRIVERS & TRANSPORT ASSIGNMENTS
                      </label>
                    </div>

                    {/* Work with ID vs Without ID Mode Selector */}
                    <div className="flex items-center gap-1 bg-[#04080b] p-0.5 rounded-lg border border-[#162d3a]">
                      <button
                        type="button"
                        onClick={() => handleDriverIdModeChange('id')}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          driverIdMode === 'id'
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-black shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title="Work with registered Driver ID (Auto-matching like Guides)"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Work with ID</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDriverIdModeChange('name')}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          driverIdMode === 'name'
                            ? 'bg-[#153443] text-[#00e6a8] border border-[#1e4c62] font-black shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title="Input driver name manually without ID"
                      >
                        <span>Without ID</span>
                      </button>
                    </div>
                  </div>

                  {driversInput.map((d, index) => {
                    const { match, isExact, driverCompany, suggestedCompany } = getDriverMatchDetails(d);
                    const matchedDriver = match || getMatchedDriverForInput(d);
                    const resolvedDriverCompany = driverCompany || matchedDriver?.companyName || (d.driverName ? allKnownDrivers.find(kd => kd.name.toUpperCase() === d.driverName.trim().toUpperCase())?.companyName : '') || '';

                    return (
                      <div key={d.id} className="bg-[#04080b] p-2.5 rounded-xl border border-[#182e3b] hover:border-[#224458] space-y-2 shadow-sm transition-all relative">
                        {/* Driver Card Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase flex items-center gap-1.5">
                            {driverIdMode === 'id' && <QrCode className="w-3 h-3 text-amber-400" />}
                            <span>Driver #{index + 1} {driverIdMode === 'id' ? '(ID Mode)' : ''}</span>
                            {driversInput.length > 1 && (
                              <span className="text-zinc-400 font-normal text-[9px]">(Group Split)</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-[#081217] p-0.5 rounded-lg border border-[#182e3b]">
                              <button
                                type="button"
                                onClick={() => updateDriverInput(d.id, 'vanType', 'Big van')}
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${d.vanType === 'Big van' ? 'bg-[#00c896]/30 text-[#00e6a8] border border-[#00c896]/70 font-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                              >
                                Big Van
                              </button>
                              <button
                                type="button"
                                onClick={() => updateDriverInput(d.id, 'vanType', 'Mini van')}
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${d.vanType === 'Mini van' ? 'bg-[#00c896]/30 text-[#00e6a8] border border-[#00c896]/70 font-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                              >
                                Mini Van
                              </button>
                            </div>
                            {driversInput.length > 1 && (
                              <button
                                type="button"
                                onClick={() => requestRemoveDriver(d.id)}
                                className="text-rose-300 hover:text-rose-200 text-[10px] font-mono font-bold bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 px-2 py-0.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                                title="Remove driver from assignment"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MODE 1: WORK WITH ID (BY THE EXACT SAME WAY AS GUIDES) */}
                        {driverIdMode === 'id' ? (
                          <div className="space-y-2">
                            {/* Row: Left = Driver ID Input | Right = Live Confirmed Driver Name in Green */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              {/* Left: Driver ID Input (Numbers Only) */}
                              <div className="sm:col-span-5 relative">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  value={d.driverId || ''}
                                  onChange={(e) => handleDriverIdChange(d.id, e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  placeholder={`Enter Driver #${index + 1} ID (0-9)...`}
                                  className={`w-full bg-[#081217] border rounded-xl px-3 py-2 text-amber-300 font-mono text-xs font-black outline-none shadow-inner placeholder-zinc-500 transition-all uppercase tracking-wider ${
                                    matchedDriver ? 'border-emerald-500/80 focus:border-emerald-400' : 'border-[#1a3342] focus:border-amber-400'
                                  }`}
                                />
                                {d.driverId && (
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 font-bold">
                                    {d.driverId.length}/6
                                  </span>
                                )}
                              </div>

                              {/* Right: Confirmed Name in Green in front of ID */}
                              <div className="sm:col-span-7 min-w-0">
                                {matchedDriver ? (
                                  <div className="bg-[#051713] border border-emerald-500/70 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 shadow-sm min-w-0">
                                    <div className="min-w-0 truncate">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00e6a8] shrink-0" />
                                        <span className="text-[#00e6a8] font-extrabold text-xs uppercase truncate">
                                          {matchedDriver.name}
                                        </span>
                                        <span className="text-[10px] text-emerald-300 font-bold bg-[#0a2027] border border-[#14424e] px-1.5 py-0.2 rounded shrink-0">
                                          {matchedDriver.vanType} • {matchedDriver.companyName || 'AGM'}
                                        </span>
                                      </div>
                                      {matchedDriver.originCity && (
                                        <span className="text-[9px] text-zinc-400 block truncate font-medium">
                                          City: {matchedDriver.originCity} {matchedDriver.phone ? `• ${matchedDriver.phone}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    <span className="bg-[#00c896] text-zinc-950 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                                      Confirmed
                                    </span>
                                  </div>
                                ) : d.driverId?.trim() ? (
                                  <div className="bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                                    <span className="text-amber-300 font-bold text-[10px] truncate">
                                      Unregistered ID [{d.driverId}]
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShowIdManagerModal(true)}
                                      className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 cursor-pointer"
                                    >
                                      + Register
                                    </button>
                                  </div>
                                ) : (
                                  <div className="bg-[#081217] border border-[#13242e] text-zinc-500 px-3 py-2 rounded-xl text-[11px] font-mono flex items-center justify-between">
                                    <span>Enter ID to confirm driver</span>
                                    <button
                                      type="button"
                                      onClick={() => setShowIdManagerModal(true)}
                                      className="text-amber-400 hover:underline text-[10px] font-bold cursor-pointer"
                                    >
                                      Browse Drivers
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Secondary row: Company & Pax */}
                            <div className={`grid grid-cols-1 ${driversInput.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2 pt-0.5`}>
                              <div>
                                <input
                                  type="text"
                                  value={d.companyName}
                                  onChange={(e) => updateDriverInput(d.id, 'companyName', e.target.value.toUpperCase())}
                                  placeholder={resolvedDriverCompany ? `Company: ${resolvedDriverCompany}` : "Transport Company (Default: AGM)"}
                                  className="w-full bg-[#081217] border border-[#1a3342] focus:border-[#00e6a8] focus:bg-[#0c1a22] rounded-lg px-2.5 py-1 text-[#00e6a8] font-mono text-[11px] font-bold outline-none uppercase placeholder-zinc-500 shadow-inner transition-all"
                                />
                                {resolvedDriverCompany && (
                                  <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-emerald-400 font-bold">
                                    <Building2 className="w-2.5 h-2.5 shrink-0 text-[#00e6a8]" />
                                    <span className="truncate">Driver's Company: {resolvedDriverCompany}</span>
                                  </div>
                                )}
                              </div>
                              {driversInput.length > 1 && (
                                <div>
                                  <input
                                    type="text"
                                    value={d.pax || ''}
                                    onChange={(e) => updateDriverInput(d.id, 'pax', e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="Pax for this Driver (Group Split)"
                                    className="w-full bg-[#081217] border border-[#1a3342] focus:border-white focus:bg-[#0c1a22] rounded-lg px-2.5 py-1 text-white font-mono text-[11px] outline-none text-center placeholder-zinc-500 shadow-inner transition-all"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* MODE 2: WITHOUT ID (STANDARD NAME + COMPANY + PAX) */
                          <div>
                            <div className={`grid grid-cols-1 ${driversInput.length > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
                              {/* Driver Name Input with Match Suggestion Written in Green on the Right */}
                              <div className="relative">
                                <input
                                  type="text"
                                  value={d.driverName}
                                  onChange={(e) => updateDriverInput(d.id, 'driverName', e.target.value)}
                                  onKeyDown={(e) => {
                                    if ((e.key === 'Tab' || e.key === 'Enter') && match && !isExact) {
                                      e.preventDefault();
                                      applyKnownDriver(d.id, match);
                                    }
                                  }}
                                  placeholder={`Driver #${index + 1} Name (e.g. Youssef)`}
                                  className={`w-full bg-[#081217] border rounded-lg pl-2.5 ${
                                    match && !isExact && d.driverName.trim().length >= 2
                                      ? 'pr-32 border-emerald-500/60 focus:border-emerald-400'
                                      : 'pr-2.5 border-[#1a3342] focus:border-amber-400'
                                  } py-1.5 text-white font-mono text-xs font-bold outline-none placeholder-zinc-500 shadow-inner transition-all`}
                                />

                                {/* GREEN SUGGESTION WRITTEN IN THE RIGHT OF THE INPUT SQUARE - 1 CLICK TO WRITE */}
                                {match && !isExact && d.driverName.trim().length >= 2 && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center z-10">
                                    <button
                                      type="button"
                                      onClick={() => applyKnownDriver(d.id, match)}
                                      className="text-[#00e6a8] hover:text-[#00ffbe] text-xs font-mono font-extrabold hover:underline transition-all cursor-pointer truncate max-w-[130px]"
                                      title={`Click to write "${match.name}" into input`}
                                    >
                                      {match.name}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Driver Transport Company */}
                              <div>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={d.companyName}
                                    onChange={(e) => updateDriverInput(d.id, 'companyName', e.target.value.toUpperCase())}
                                    placeholder={resolvedDriverCompany ? `Company: ${resolvedDriverCompany}` : "Company (Default: AGM)"}
                                    className="w-full bg-[#081217] border border-[#1a3342] focus:border-[#00e6a8] focus:bg-[#0c1a22] rounded-lg px-2.5 py-1.5 text-[#00e6a8] font-mono text-xs font-bold outline-none uppercase placeholder-zinc-500 shadow-inner transition-all"
                                  />
                                </div>
                                {resolvedDriverCompany && d.driverName?.trim() && (
                                  <div className="mt-1 flex items-center justify-between gap-1 text-[9px] font-mono">
                                    <div className="flex items-center gap-1 text-emerald-400 font-bold truncate">
                                      <Building2 className="w-2.5 h-2.5 shrink-0 text-[#00e6a8]" />
                                      <span className="truncate">Driver's Company: {resolvedDriverCompany}</span>
                                    </div>
                                    {d.companyName?.toUpperCase() !== resolvedDriverCompany.toUpperCase() && (
                                      <button
                                        type="button"
                                        onClick={() => updateDriverInput(d.id, 'companyName', resolvedDriverCompany.toUpperCase())}
                                        className="text-[#00e6a8] hover:text-[#00ffbe] hover:underline font-extrabold cursor-pointer shrink-0"
                                        title={`Set company to ${resolvedDriverCompany}`}
                                      >
                                        Use {resolvedDriverCompany}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Driver Pax (Only active for split multi-driver groups) */}
                              {driversInput.length > 1 && (
                                <div>
                                  <input
                                    type="text"
                                    value={d.pax || ''}
                                    onChange={(e) => updateDriverInput(d.id, 'pax', e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="Pax (Optional Split)"
                                    className="w-full bg-[#081217] border border-[#1a3342] focus:border-white focus:bg-[#0c1a22] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs outline-none text-center placeholder-zinc-500 shadow-inner transition-all"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addDriverInput}
                    className="w-full py-2 bg-[#00c896]/10 hover:bg-[#00c896]/20 text-[#00e6a8] border border-[#00c896]/30 hover:border-[#00c896]/60 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Driver (Multi-Van / Split Group)</span>
                  </button>
                </div>
              </div>

              {/* TRIP NUMBERS & ACTIVITIES (WITH PAX REQUIREMENT + WITHOUT CAMELS / QUADS SELECT SQUARES) */}
              <div className="space-y-2.5 bg-[#050b0e] border border-[#182e3b] p-3 rounded-2xl shadow-md">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00e6a8]" />
                    <span>TRIP NUMBERS & ACTIVITIES</span>
                  </label>
                  {(!paxCount || parseInt(paxCount) === 0) && (
                    <span className="text-[9px] font-mono text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                      ⚠️ Enter Pax first to enable Quads & Camels
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* PAX */}
                  <div>
                    <span className="block text-[9px] font-mono text-zinc-300 mb-1 uppercase font-bold">PAX</span>
                    <input
                      type="text"
                      value={paxCount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setPaxCount(val);
                        if (!val || parseInt(val) === 0) {
                          if (quadsCount !== 'None') setQuadsCount('');
                          if (camelsCount !== 'None') setCamelsCount('');
                        }
                      }}
                      placeholder="0"
                      className="w-full bg-[#04080b] border border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#061218] rounded-xl px-2.5 py-2 text-white font-mono text-xs font-bold outline-none text-center shadow-inner placeholder-zinc-500 transition-all"
                    />
                    <div className="text-[8px] font-mono text-zinc-400 text-center mt-1">Group Pax</div>
                  </div>

                  {/* QUADS + SELECT SQUARE */}
                  <div 
                    onClick={() => {
                      if (!paxCount || parseInt(paxCount) === 0) {
                        showNotification("⚠️ Please enter Pax count first before entering Quads!");
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[9px] font-mono text-zinc-300 uppercase font-bold">QUADS</span>
                      {quadsCount === 'None' && (
                        <span className="text-[8px] font-mono text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1 py-0.2 rounded font-bold">
                          NONE
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={quadsCount === 'None' ? 'None' : quadsCount}
                      onChange={(e) => {
                        if (!paxCount || parseInt(paxCount) === 0) {
                          showNotification("⚠️ Please enter Pax count first before entering Quads!");
                          return;
                        }
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setQuadsCount(val);
                      }}
                      disabled={!paxCount || parseInt(paxCount) === 0}
                      placeholder={!paxCount || parseInt(paxCount) === 0 ? "Pax First" : (quadsCount === 'None' ? "None" : "0")}
                      className={`w-full border rounded-xl px-2.5 py-2 font-mono text-xs font-bold outline-none text-center shadow-inner transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        quadsCount === 'None'
                          ? 'bg-amber-950/50 border-amber-400/80 text-amber-300 font-black'
                          : 'bg-[#04080b] border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#061218] text-white placeholder-zinc-500'
                      }`}
                    />

                    {/* SELECT SQUARE WITHOUT QUADS */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (quadsCount === 'None') {
                          setQuadsCount('');
                        } else {
                          setQuadsCount('None');
                        }
                      }}
                      className={`w-full mt-1.5 py-1 px-1 rounded-lg border text-[9px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-98 ${
                        quadsCount === 'None'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                          : 'bg-[#081217] border-[#142834] text-zinc-400 hover:text-zinc-200 hover:border-[#1e3c4d]'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] shrink-0 font-black transition-colors ${
                        quadsCount === 'None'
                          ? 'bg-amber-400 text-zinc-950 border-amber-300'
                          : 'border-[#182e3b] bg-[#04080b]'
                      }`}>
                        {quadsCount === 'None' ? '✓' : ''}
                      </div>
                      <span className="truncate">Without Quads</span>
                    </button>
                  </div>

                  {/* CAMELS + SELECT SQUARE */}
                  <div 
                    onClick={() => {
                      if (!paxCount || parseInt(paxCount) === 0) {
                        showNotification("⚠️ Please enter Pax count first before entering Camels!");
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[9px] font-mono text-zinc-300 uppercase font-bold">CAMELS</span>
                      {camelsCount === 'None' && (
                        <span className="text-[8px] font-mono text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1 py-0.2 rounded font-bold">
                          NONE
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={camelsCount === 'None' ? 'None' : camelsCount}
                      onChange={(e) => {
                        if (!paxCount || parseInt(paxCount) === 0) {
                          showNotification("⚠️ Please enter Pax count first before entering Camels!");
                          return;
                        }
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setCamelsCount(val);
                      }}
                      disabled={!paxCount || parseInt(paxCount) === 0}
                      placeholder={!paxCount || parseInt(paxCount) === 0 ? "Pax First" : (camelsCount === 'None' ? "None" : "0")}
                      className={`w-full border rounded-xl px-2.5 py-2 font-mono text-xs font-bold outline-none text-center shadow-inner transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        camelsCount === 'None'
                          ? 'bg-amber-950/50 border-amber-400/80 text-amber-300 font-black'
                          : 'bg-[#04080b] border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#061218] text-white placeholder-zinc-500'
                      }`}
                    />

                    {/* SELECT SQUARE WITHOUT CAMELS */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (camelsCount === 'None') {
                          setCamelsCount('');
                        } else {
                          setCamelsCount('None');
                        }
                      }}
                      className={`w-full mt-1.5 py-1 px-1 rounded-lg border text-[9px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-98 ${
                        camelsCount === 'None'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                          : 'bg-[#081217] border-[#142834] text-zinc-400 hover:text-zinc-200 hover:border-[#1e3c4d]'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] shrink-0 font-black transition-colors ${
                        camelsCount === 'None'
                          ? 'bg-amber-400 text-zinc-950 border-amber-300'
                          : 'border-[#182e3b] bg-[#04080b]'
                      }`}>
                        {camelsCount === 'None' ? '✓' : ''}
                      </div>
                      <span className="truncate">Without Camels</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* MEAL PLAN / CATERING (LUNCH / DINNER / BOTH / WITHOUT MEAL) */}
              <div className="space-y-2 border-t border-[#152733] pt-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="block text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-amber-400" />
                    <span>MEAL / CATERING PLAN</span>
                  </label>
                  {mealOption !== 'Unselected' && mealOption !== 'None' ? (
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      mealOption === 'Lunch'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : mealOption === 'Dinner'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {mealOption === 'Both' ? 'Both (Lunch & Dinner)' : mealOption}
                    </span>
                  ) : mealOption === 'None' ? (
                    <span className="text-[9px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full">
                      Without Meal
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Lunch Select Button */}
                  <button
                    type="button"
                    onClick={() => setMealOption(prev => prev === 'Lunch' ? 'Unselected' : 'Lunch')}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95 ${
                      mealOption === 'Lunch'
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                        : 'bg-[#060e12] border-[#182e3b] text-zinc-400 hover:text-zinc-200 hover:border-[#224458]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Utensils className={`w-3.5 h-3.5 ${mealOption === 'Lunch' ? 'text-amber-300' : 'text-zinc-500'}`} />
                      <span className="text-[11px] font-bold">Lunch</span>
                    </div>
                    <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-black ${
                      mealOption === 'Lunch' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-500'
                    }`}>
                      {mealOption === 'Lunch' ? '✓ SELECTED' : 'Select'}
                    </span>
                  </button>

                  {/* Dinner Select Button */}
                  <button
                    type="button"
                    onClick={() => setMealOption(prev => prev === 'Dinner' ? 'Unselected' : 'Dinner')}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95 ${
                      mealOption === 'Dinner'
                        ? 'bg-indigo-500/25 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/50'
                        : 'bg-[#060e12] border-[#182e3b] text-zinc-400 hover:text-zinc-200 hover:border-[#224458]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Moon className={`w-3.5 h-3.5 ${mealOption === 'Dinner' ? 'text-indigo-300' : 'text-zinc-500'}`} />
                      <span className="text-[11px] font-bold">Dinner</span>
                    </div>
                    <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-black ${
                      mealOption === 'Dinner' ? 'bg-indigo-400 text-zinc-950' : 'text-zinc-500'
                    }`}>
                      {mealOption === 'Dinner' ? '✓ SELECTED' : 'Select'}
                    </span>
                  </button>

                  {/* Both (Lunch & Dinner) Select Button */}
                  <button
                    type="button"
                    onClick={() => setMealOption(prev => prev === 'Both' ? 'Unselected' : 'Both')}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95 ${
                      mealOption === 'Both'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400/50'
                        : 'bg-[#060e12] border-[#182e3b] text-zinc-400 hover:text-zinc-200 hover:border-[#224458]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <UtensilsCrossed className={`w-3.5 h-3.5 ${mealOption === 'Both' ? 'text-emerald-300' : 'text-zinc-500'}`} />
                      <span className="text-[11px] font-bold truncate">Both</span>
                    </div>
                    <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-black truncate max-w-full ${
                      mealOption === 'Both' ? 'bg-emerald-400 text-zinc-950' : 'text-zinc-500'
                    }`}>
                      {mealOption === 'Both' ? '✓ LUNCH+DIN' : 'Select'}
                    </span>
                  </button>

                  {/* Without Meal Button */}
                  <button
                    type="button"
                    onClick={() => setMealOption(prev => prev === 'None' ? 'Unselected' : 'None')}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95 ${
                      mealOption === 'None'
                        ? 'bg-zinc-700/50 border-zinc-400 text-zinc-200 ring-1 ring-zinc-400/50 font-black'
                        : 'bg-[#060e12] border-[#182e3b] text-zinc-400 hover:text-zinc-200 hover:border-[#224458]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <X className={`w-3.5 h-3.5 ${mealOption === 'None' ? 'text-zinc-200' : 'text-zinc-500'}`} />
                      <span className="text-[11px] font-bold truncate">No Meal</span>
                    </div>
                    <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-black truncate max-w-full ${
                      mealOption === 'None' ? 'bg-zinc-300 text-zinc-950' : 'text-zinc-500'
                    }`}>
                      {mealOption === 'None' ? '✓ NO MEAL' : 'Select'}
                    </span>
                  </button>
                </div>
              </div>

              {/* EXTRA PAYMENTS & ACTIVITIES WITH EXCLUSIVE CLICK & COLOR LOGIC */}
              <div className="space-y-2 border-t border-[#152733] pt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    EXTRA PAYMENTS & ACTIVITIES
                  </label>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">CLICK TO SHOW DETAILS</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Person Extra Button */}
                  {(() => {
                    const st = getExtraStatusStyle('person');
                    return (
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeExtraTab === 'person') {
                              setActiveExtraTab('none');
                            } else {
                              setActiveExtraTab('person');
                              if (personExtra === 'None') setPersonExtra('');
                            }
                          }}
                          className={`w-full py-2 px-1.5 rounded-xl border text-[11px] font-mono transition-all flex flex-col items-center justify-center gap-1 cursor-pointer relative ${st.btnClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span className="truncate font-bold text-[10px]">Person Extra</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono truncate max-w-full ${st.badgeClass}`}>
                            {st.statusTag}
                          </span>
                        </button>
                        {st.isConfigured && (
                          <button
                            type="button"
                            onClick={(e) => clearExtra('person', e)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-md hover:bg-rose-500 cursor-pointer z-10"
                            title="Remove Person Extra"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Quad Extra Button */}
                  {(() => {
                    const st = getExtraStatusStyle('quad');
                    return (
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeExtraTab === 'quad') {
                              setActiveExtraTab('none');
                            } else {
                              setActiveExtraTab('quad');
                              if (quadExtra === 'None') setQuadExtra('');
                            }
                          }}
                          className={`w-full py-2 px-1.5 rounded-xl border text-[11px] font-mono transition-all flex flex-col items-center justify-center gap-1 cursor-pointer relative ${st.btnClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <Bike className="w-3.5 h-3.5" />
                            <span className="truncate font-bold text-[10px]">Quad Extra</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono truncate max-w-full ${st.badgeClass}`}>
                            {st.statusTag}
                          </span>
                        </button>
                        {st.isConfigured && (
                          <button
                            type="button"
                            onClick={(e) => clearExtra('quad', e)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-md hover:bg-rose-500 cursor-pointer z-10"
                            title="Remove Quad Extra"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Camel Extra Button */}
                  {(() => {
                    const st = getExtraStatusStyle('camel');
                    return (
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (activeExtraTab === 'camel') {
                              setActiveExtraTab('none');
                            } else {
                              setActiveExtraTab('camel');
                              if (camelExtra === 'None') setCamelExtra('');
                            }
                          }}
                          className={`w-full py-2 px-1.5 rounded-xl border text-[11px] font-mono transition-all flex flex-col items-center justify-center gap-1 cursor-pointer relative ${st.btnClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <Footprints className="w-3.5 h-3.5" />
                            <span className="truncate font-bold text-[10px]">Camel Extra</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono truncate max-w-full ${st.badgeClass}`}>
                            {st.statusTag}
                          </span>
                        </button>
                        {st.isConfigured && (
                          <button
                            type="button"
                            onClick={(e) => clearExtra('camel', e)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-md hover:bg-rose-500 cursor-pointer z-10"
                            title="Remove Camel Extra"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Exclusive Detail Input Drawer */}
                {activeExtraTab === 'none' && (
                  <p className="text-[10px] font-mono text-zinc-500 text-center py-2 bg-[#050b0e]/60 rounded-xl border border-[#182e3b]/50">
                    Click on Person Extra, Quad Extra, or Camel Extra above to configure details & price.
                  </p>
                )}

                {/* Active Person Extra Panel */}
                {activeExtraTab === 'person' && (
                  <div className="bg-[#050b0e] border border-[#182e3b] p-2.5 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#00e6a8] uppercase flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#00e6a8]" />
                        <span>Person Extra Details</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => clearExtra('person', e)}
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer font-bold"
                        title="Remove Person Extra"
                      >
                        <span className="text-[9px] uppercase">Remove</span>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Number / Count</label>
                        <input
                          type="text"
                          value={personExtra === 'None' ? '' : personExtra}
                          onChange={(e) => setPersonExtra(e.target.value)}
                          placeholder="e.g. 2"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Pay Amount (DH)</label>
                        <input
                          type="text"
                          value={personExtraPay === '0 DH' ? '' : personExtraPay}
                          onChange={(e) => setPersonExtraPay(e.target.value)}
                          placeholder="e.g. 150 DH"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-[#00e6a8] font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Quad Extra Panel */}
                {activeExtraTab === 'quad' && (
                  <div className="bg-[#050b0e] border border-[#182e3b] p-2.5 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#00e6a8] uppercase flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-[#00e6a8]" />
                        <span>Quad Extra Details</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => clearExtra('quad', e)}
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer font-bold"
                        title="Remove Quad Extra"
                      >
                        <span className="text-[9px] uppercase">Remove</span>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Number / Count</label>
                        <input
                          type="text"
                          value={quadExtra === 'None' ? '' : quadExtra}
                          onChange={(e) => setQuadExtra(e.target.value)}
                          placeholder="e.g. 1"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Pay Amount (DH)</label>
                        <input
                          type="text"
                          value={quadExtraPay === '0 DH' ? '' : quadExtraPay}
                          onChange={(e) => setQuadExtraPay(e.target.value)}
                          placeholder="e.g. 200 DH"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-[#00e6a8] font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Camel Extra Panel */}
                {activeExtraTab === 'camel' && (
                  <div className="bg-[#050b0e] border border-[#182e3b] p-2.5 rounded-xl space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#00e6a8] uppercase flex items-center gap-1.5">
                        <Footprints className="w-3.5 h-3.5 text-[#00e6a8]" />
                        <span>Camel Extra Details</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => clearExtra('camel', e)}
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer font-bold"
                        title="Remove Camel Extra"
                      >
                        <span className="text-[9px] uppercase">Remove</span>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Number / Count</label>
                        <input
                          type="text"
                          value={camelExtra === 'None' ? '' : camelExtra}
                          onChange={(e) => setCamelExtra(e.target.value)}
                          placeholder="e.g. 2"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-mono text-zinc-400 uppercase mb-0.5">Pay Amount (DH)</label>
                        <input
                          type="text"
                          value={camelExtraPay === '0 DH' ? '' : camelExtraPay}
                          onChange={(e) => setCamelExtraPay(e.target.value)}
                          placeholder="e.g. 300 DH"
                          className="w-full bg-[#04080b] border border-[#182e3b] rounded-lg px-2.5 py-1.5 text-[#00e6a8] font-mono text-xs font-bold outline-none focus:border-[#00c896]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className={`flex-1 font-mono font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-98 ${
                    editingId !== null
                      ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-amber-300 font-black'
                      : 'bg-[#00c896] hover:bg-[#00e6a8] text-zinc-950 font-black shadow-[0_0_15px_rgba(0,200,150,0.3)]'
                  }`}
                >
                  {editingId !== null ? (
                    <>
                      <Pencil className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {vanType === 'Mini van' || !guideName || guideName.toUpperCase() === 'H1' || guideName.toUpperCase() === 'NONE'
                          ? `Modify Driver ${driverName ? driverName.trim() : `#${editingId}`}`
                          : `Modify Guide ${guideName.trim()}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Log Record into Excel</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClean}
                  className="px-5 bg-[#050b0e] hover:bg-[#0a141a] text-zinc-300 font-mono font-bold text-xs rounded-xl border border-[#182e3b] hover:border-[#224458] transition-all cursor-pointer"
                >
                  {editingId !== null ? 'Cancel' : 'Clean'}
                </button>
              </div>
            </div>
          );
        })()}

            {/* Right Column (7 Cols): DAILY LOGGED OPERATIONS & EXECUTIVE SUMMARY */}
            <div className="lg:col-span-7 bg-[#08131a] rounded-2xl p-4 sm:p-5 flex flex-col h-full min-h-0 shadow-2xl border border-white/5">
              {/* Header Row - Single Line Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 gap-1.5 sm:gap-2 shrink-0 border-b border-white/5 flex-nowrap overflow-x-auto no-scrollbar">
                {/* Left: DAILY LOGGED badge + Filter Buttons (All, Rest, Done) */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 bg-[#00e6a8]/10 text-[#00e6a8] px-2 py-1 rounded-lg border border-[#00e6a8]/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e6a8] animate-pulse shadow-[0_0_8px_#00e6a8]" />
                    <span className="text-[11px] font-mono font-black uppercase tracking-wide whitespace-nowrap">
                      DAILY LOGGED
                    </span>
                  </div>

                  {/* Top Filters Group: All Logged / Rest Only / Done Only */}
                  <div className="flex items-center gap-0.5 bg-[#040a0e] p-0.5 rounded-lg border border-white/5 shrink-0">
                    {/* All Logged Button */}
                    <button
                      type="button"
                      onClick={() => setDailyLoggedFilter('all')}
                      className={`text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap ${
                        dailyLoggedFilter === 'all'
                          ? 'bg-[#00e6a8] text-zinc-950 font-black shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                      title="Show All Logged"
                    >
                      <FileSpreadsheet className="w-2.5 h-2.5" />
                      <span>All</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded-full font-mono font-black ${
                        dailyLoggedFilter === 'all' ? 'bg-zinc-950/30 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {displayedResults.length}
                      </span>
                    </button>

                    {/* Rest Only Button */}
                    <button
                      type="button"
                      onClick={() => setDailyLoggedFilter(prev => prev === 'rest' ? 'all' : 'rest')}
                      className={`text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap ${
                        dailyLoggedFilter === 'rest'
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 font-black shadow-sm'
                          : 'border-transparent text-amber-300/80 hover:text-amber-300 hover:bg-amber-400/10'
                      }`}
                      title="Filter Rest Only (Pending/Incomplete Trips)"
                    >
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>Rest</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded-full font-mono font-black ${
                        dailyLoggedFilter === 'rest' ? 'bg-zinc-950/30 text-zinc-950' : 'bg-amber-400/20 text-amber-300'
                      }`}>
                        {restCount}
                      </span>
                    </button>

                    {/* Done Only Button */}
                    <button
                      type="button"
                      onClick={() => setDailyLoggedFilter(prev => prev === 'done' ? 'all' : 'done')}
                      className={`text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap ${
                        dailyLoggedFilter === 'done'
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black shadow-sm'
                          : 'border-transparent text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                      title="Filter Done Only (Completed Trips)"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Done</span>
                      <span className={`text-[8px] px-1 py-0.2 rounded-full font-mono font-black ${
                        dailyLoggedFilter === 'done' ? 'bg-zinc-950/30 text-zinc-950' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {doneCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Right: Search Daily & Date in the same line */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Compact Search Daily */}
                  <div className="relative w-28 sm:w-36 lg:w-44">
                    <input
                      type="text"
                      value={dailyLoggedSearchQuery}
                      onChange={(e) => setDailyLoggedSearchQuery(e.target.value)}
                      placeholder="Search daily..."
                      className="w-full bg-[#040a0e] border border-[#182e3b] focus:border-[#00e6a8] focus:bg-[#071319] rounded-lg pl-6 pr-5 py-1 text-white font-mono text-[10px] outline-none shadow-inner placeholder-zinc-500 transition-all"
                    />
                    <Search className="w-2.5 h-2.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {dailyLoggedSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setDailyLoggedSearchQuery('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-white cursor-pointer"
                        title="Clear Search"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    )}
                  </div>

                  {/* Compact Date */}
                  <div className="text-[10px] font-mono text-zinc-300 flex items-center gap-1 bg-[#040a0e] px-2 py-1 rounded-lg border border-white/5 shrink-0 whitespace-nowrap">
                    <Calendar className="w-3 h-3 text-[#00e6a8]" />
                    <span className="hidden sm:inline">DATE:</span>
                    <strong className="text-white font-black">{dateStr}</strong>
                  </div>
                </div>
              </div>

              {/* ================= TOTAL DETAILS SUMMARY CARDS AT TOP OF DAILY LOGGED ================= */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3 font-mono text-left shrink-0">
                {/* Card 1: TOTAL PAX */}
                <div className="bg-[#040a0e] hover:bg-[#0b1720] p-3 rounded-xl flex items-center gap-3.5 transition-all cursor-default border border-white/5 hover:border-emerald-500/30 group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#00e6a8] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">TOTAL PAX</p>
                    <p className="text-xl font-black text-white leading-tight">
                      {displayedResults.reduce((acc, r) => acc + (parseInt(r.pax) || 0) + parseExtraCount(r.person_extra), 0)}
                    </p>
                  </div>
                </div>

                {/* Card 2: TOTAL QUADS */}
                <div className="bg-[#040a0e] hover:bg-[#0b1720] p-3 rounded-xl flex items-center gap-3.5 transition-all cursor-default border border-white/5 hover:border-amber-400/30 group">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">TOTAL QUADS</p>
                    <p className="text-xl font-black text-amber-300 leading-tight">
                      {displayedResults.reduce((acc, r) => acc + (parseInt(r.quads) || 0) + parseExtraCount(r.quad_extra), 0)}
                    </p>
                  </div>
                </div>

                {/* Card 3: TOTAL CAMELS */}
                <div className="bg-[#040a0e] hover:bg-[#0b1720] p-3 rounded-xl flex items-center gap-3.5 transition-all cursor-default border border-white/5 hover:border-cyan-400/30 group">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">TOTAL CAMELS</p>
                    <p className="text-xl font-black text-cyan-300 leading-tight">
                      {displayedResults.reduce((acc, r) => acc + (parseInt(r.camels) || 0) + parseExtraCount(r.camel_extra), 0)}
                    </p>
                  </div>
                </div>

                {/* Card 4: DAILY LOGGED */}
                <div className="bg-[#040a0e] hover:bg-[#0b1720] p-3 rounded-xl flex items-center gap-3.5 transition-all cursor-default border border-white/5 hover:border-teal-400/30 group">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate">TRIPS LOGGED</p>
                    <p className="text-xl font-black text-white leading-tight">{displayedResults.length}</p>
                  </div>
                </div>
              </div>

              {/* Empty State vs List */}
              {displayedResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center my-auto py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#040a0e] text-zinc-600 flex items-center justify-center border border-white/5">
                    <FileText className="w-7 h-7 text-zinc-500" />
                  </div>
                  <p className="text-sm font-mono font-bold text-zinc-300">
                    No active trip logs registered for {dateStr}.
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Fill in details on the left panel and click &ldquo;Log Record into Excel&rdquo;.
                  </p>
                </div>
              ) : filteredDailyResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center my-auto py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#040a0e] text-zinc-500 flex items-center justify-center border border-white/5">
                    <Search className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-xs font-mono font-bold text-zinc-300">
                    No trips match &ldquo;{dailyLoggedSearchQuery}&rdquo; {dailyLoggedFilter !== 'all' ? `(${dailyLoggedFilter.toUpperCase()} filter)` : ''} on {dateStr}.
                  </p>
                  <div className="flex items-center gap-2">
                    {dailyLoggedSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDailyLoggedSearchQuery('')}
                        className="text-xs font-mono font-bold text-[#00e6a8] hover:underline cursor-pointer bg-[#00e6a8]/10 border border-[#00e6a8]/30 px-3 py-1 rounded-lg transition-all"
                      >
                        Clear Search
                      </button>
                    )}
                    {dailyLoggedFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setDailyLoggedFilter('all')}
                        className="text-xs font-mono font-bold text-amber-300 hover:underline cursor-pointer bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-lg transition-all"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div 
                  ref={tripsListRef}
                  className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 pr-1"
                >
                  {filteredDailyResults.map((item, index) => {
                    const isEditingThisItem = editingId === item.id;
                    const isAnyItemEditing = editingId !== null;

                    const pNum = parseInt(item.pax) || 0;
                    const qNum = parseInt(item.quads) || 0;
                    const cNum = parseInt(item.camels) || 0;

                    const isPaxEmpty = !item.pax || item.pax === '?' || item.pax === '0' || pNum === 0;
                    const isQuadsEmpty = !item.quads || item.quads === '?' || item.quads === '0' || qNum === 0;
                    const isCamelsEmpty = !item.camels || item.camels === '?' || item.camels === '0' || cNum === 0;

                    // Check if this record is a Mini Van Driver (Driver without a guide or H1)
                    const guideRaw = (item.guide || '').trim();
                    const isMiniVanOrNoGuide = !guideRaw || 
                      guideRaw.toUpperCase() === 'H1' || 
                      guideRaw.toUpperCase() === 'NO GUIDE' || 
                      guideRaw.toUpperCase() === 'WITHOUT GUIDE' || 
                      guideRaw.toLowerCase() === 'none' || 
                      guideRaw.toLowerCase() === 'n/a' || 
                      guideRaw === '-';

                    // Condition: Only Guide and Driver (no pax, quads, or camels)
                    const hasNoActivities = isPaxEmpty && isQuadsEmpty && isCamelsEmpty;

                    // Condition: Missing / unresolved values with question mark
                    const hasUnresolvedQuestions = item.pax === '?' || item.quads === '?' || item.camels === '?';

                    const isItemComplete = isRecordComplete(item);

                    let borderClass = "border border-[#00e6a8]/60 border-l-4 border-l-[#00e6a8]";
                    let statusBadge = null;

                    if (isEditingThisItem) {
                      borderClass = "border border-amber-400/70 border-l-4 border-l-amber-400 bg-amber-950/20";
                      statusBadge = (
                        <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full uppercase shrink-0 flex items-center gap-1">
                          <Pencil className="w-2.5 h-2.5" /> Editing
                        </span>
                      );
                    } else if (!isItemComplete) {
                      borderClass = "border border-amber-400/70 border-l-4 border-l-amber-400 bg-amber-950/15";
                      if (hasUnresolvedQuestions) {
                        statusBadge = (
                          <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full uppercase shrink-0 flex items-center gap-1">
                            <HelpCircle className="w-2.5 h-2.5" /> Pending Details (?)
                          </span>
                        );
                      } else if (hasNoActivities) {
                        statusBadge = (
                          <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full uppercase shrink-0">
                            {isMiniVanOrNoGuide ? "Driver Only (No Pax)" : "Only Guide & Driver"}
                          </span>
                        );
                      } else if (isPaxEmpty) {
                        statusBadge = (
                          <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full uppercase shrink-0">
                            Missing Pax
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full uppercase shrink-0">
                            Incomplete Details
                          </span>
                        );
                      }
                    } else {
                      // Complete item: Green border, no "Complete" text!
                      borderClass = "border border-[#00e6a8]/60 border-l-4 border-l-[#00e6a8]";
                      statusBadge = null;
                    }

                    // Apply subtle transparency to non-edited items when editing mode is active
                    const opacityClass = isAnyItemEditing
                      ? (isEditingThisItem ? "opacity-100" : "opacity-35 transition-opacity")
                      : "opacity-100";

                    // Original index in date
                    const originalIndex = displayedResults.findIndex(r => r.id === item.id);
                    const itemDisplayNum = originalIndex !== -1 ? originalIndex + 1 : index + 1;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl bg-[#040a0e] hover:bg-[#09151e] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono transition-all shadow-md ${borderClass} ${opacityClass}`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Row Index Badge */}
                          <span className={`w-6 h-6 rounded-lg font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                            isEditingThisItem ? 'bg-amber-400 text-zinc-950' : 'bg-[#00e6a8]/15 text-[#00e6a8]'
                          }`}>
                            #{itemDisplayNum}
                          </span>

                          <div className="min-w-0 flex-1 space-y-2">
                            {/* LINE 1: GUIDE NAME & DRIVER DETAILS IN FRONT */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              {!isMiniVanOrNoGuide ? (
                                <span className="text-white font-black uppercase truncate flex items-center gap-1.5 bg-[#091722] px-2.5 py-1 rounded-lg border border-white/5">
                                  <User className="w-3.5 h-3.5 text-[#00e6a8]" />
                                  <span>Guide: {(item.guide || 'UNKNOWN').trim().toUpperCase()}</span>
                                </span>
                              ) : (
                                <span className="text-amber-300 bg-amber-400/15 text-[9px] font-mono font-black px-2.5 py-1 rounded-lg uppercase flex items-center gap-1 border border-amber-400/30">
                                  <Bus className="w-3 h-3" /> {item.van_type === 'Mini van' || guideRaw.toUpperCase() === 'H1' ? 'MINI VAN DRIVER ONLY' : 'BIG VAN (WITHOUT GUIDE)'}
                                </span>
                              )}

                              {/* DRIVER INFORMATION DIRECTLY IN FRONT OF GUIDE NAME */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {(item.driversList && item.driversList.length > 0
                                  ? item.driversList
                                  : [{ driver: item.driver, company: item.company || 'AGM' }]
                                ).map((drv, drvIdx) => {
                                  const cleanCompany = (drv.company || item.company || 'AGM').trim().toUpperCase() || 'AGM';
                                  const cleanDriver = (drv.driver || 'UNASSIGNED').trim().toUpperCase();

                                  return (
                                    <div key={drvIdx} className="flex items-center gap-2 text-[11px] bg-[#091722] px-3 py-1 rounded-lg text-zinc-300 border border-white/5 flex-wrap">
                                      <span className="text-[#00e6a8] font-bold flex items-center gap-1">
                                        <Bus className="w-3.5 h-3.5 text-[#00e6a8]" />
                                        <span>Driver: {cleanDriver}</span>
                                      </span>
                                      <span className="text-zinc-600">•</span>
                                      <span className="text-cyan-300 font-bold uppercase text-[10px] bg-cyan-500/10 px-2 py-0.5 rounded-md">
                                        Company: {cleanCompany}
                                      </span>
                                      {item.meal && item.meal !== 'None' && (
                                        <>
                                          <span className="text-zinc-600">•</span>
                                          <span className={`font-mono text-[10px] font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-md border shadow-sm ${
                                            item.meal === 'Lunch'
                                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                              : item.meal === 'Dinner'
                                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                          }`}>
                                            {item.meal === 'Lunch' && <Utensils className="w-3 h-3 text-amber-400" />}
                                            {item.meal === 'Dinner' && <Moon className="w-3 h-3 text-indigo-400" />}
                                            {item.meal === 'Both' && <UtensilsCrossed className="w-3 h-3 text-emerald-400" />}
                                            <span>{item.meal === 'Both' ? 'Lunch & Dinner' : item.meal}</span>
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* LINE 2: NEW LINE WITH PAX, QUAD, CAMELS, DATE, TIME */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <div className="flex items-center gap-1.5 bg-[#091722] px-2.5 py-1 rounded-lg">
                                <Users className="w-3 h-3 text-emerald-400" />
                                <span className="text-zinc-400 text-[10px]">Pax:</span>
                                <strong className="text-white font-black">{item.pax || '0'}</strong>
                              </div>

                              <div className="flex items-center gap-1.5 bg-[#091722] px-2.5 py-1 rounded-lg">
                                <Bike className="w-3 h-3 text-amber-400" />
                                <span className="text-zinc-400 text-[10px]">Quad:</span>
                                <strong className={item.quads === 'None' || item.quads === 'none' || !item.quads || item.quads === '0' ? 'text-zinc-500' : 'text-amber-300 font-black'}>
                                  {item.quads === 'None' || item.quads === 'none' || !item.quads ? 'None' : item.quads}
                                </strong>
                              </div>

                              <div className="flex items-center gap-1.5 bg-[#091722] px-2.5 py-1 rounded-lg">
                                <Footprints className="w-3 h-3 text-cyan-400" />
                                <span className="text-zinc-400 text-[10px]">Camel:</span>
                                <strong className={item.camels === 'None' || item.camels === 'none' || !item.camels || item.camels === '0' ? 'text-zinc-500' : 'text-cyan-300 font-black'}>
                                  {item.camels === 'None' || item.camels === 'none' || !item.camels ? 'None' : item.camels}
                                </strong>
                              </div>

                              <span className="font-mono text-[10px] text-zinc-400 flex items-center gap-1 bg-[#091722] px-2.5 py-1 rounded-lg">
                                <Calendar className="w-3 h-3 text-[#00e6a8]" />
                                <span className="text-zinc-200 font-bold">{item.date || dateStr}</span>
                              </span>

                              <span className="font-mono text-[10px] text-zinc-400 flex items-center gap-1 bg-[#091722] px-2.5 py-1 rounded-lg">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                <span className="text-zinc-200 font-bold">{item.time || '00:00'}</span>
                              </span>

                              {statusBadge}
                            </div>

                            {/* LINE 4: EXTRAS AT THE BOTTOM IF PRESENT */}
                            {((item.person_extra && item.person_extra !== 'None' && item.person_extra !== '0') ||
                              (item.quad_extra && item.quad_extra !== 'None' && item.quad_extra !== '0') ||
                              (item.camel_extra && item.camel_extra !== 'None' && item.camel_extra !== '0')) && (
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5 flex-wrap">
                                {(item.person_extra && item.person_extra !== 'None' && item.person_extra !== '0') && (
                                  <span className="text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Coins className="w-2.5 h-2.5" />
                                    <span>Extra Pax: <strong>{item.person_extra}</strong> ({item.person_extra_pay || '0 DH'})</span>
                                  </span>
                                )}
                                {(item.quad_extra && item.quad_extra !== 'None' && item.quad_extra !== '0') && (
                                  <span className="text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Bike className="w-2.5 h-2.5" />
                                    <span>Extra Quad: <strong>{item.quad_extra}</strong> ({item.quad_extra_pay || '0 DH'})</span>
                                  </span>
                                )}
                                {(item.camel_extra && item.camel_extra !== 'None' && item.camel_extra !== '0') && (
                                  <span className="text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-lg text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Footprints className="w-2.5 h-2.5" />
                                    <span>Extra Camel: <strong>{item.camel_extra}</strong> ({item.camel_extra_pay || '0 DH'})</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons: Modify & Remove (Icons Only) */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={(e) => handleEdit(item, e)}
                            className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                              isEditingThisItem
                                ? 'bg-amber-400 text-zinc-950 font-black shadow-md'
                                : 'bg-[#091722] hover:bg-[#00e6a8]/20 text-amber-400 border border-white/5'
                            }`}
                            title="Modify Record"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-2 rounded-xl bg-[#1d0e12] hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer border border-rose-500/10 active:scale-95"
                            title="Remove Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Footer Bar with Operations Tools (Fleet & Extras, Extra Funds) */}
          <div className="pt-3 border-t border-[#152733] font-mono text-xs flex items-center justify-between flex-wrap gap-2.5 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-500 font-bold hidden sm:inline">AGM TRAVEL 2026</span>

              {/* 1. Quads & Camels Fleet & Extras Button */}
              <button
                type="button"
                onClick={() => setShowFleetModal(true)}
                className="bg-gradient-to-r from-[#0a1820] via-[#0c222e] to-[#0a1820] hover:from-[#0d2a3a] hover:to-[#0f3448] text-amber-300 hover:text-white border border-amber-500/40 hover:border-amber-400 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Fleet & Extras</span>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded text-[10px] font-black">
                  {results.reduce((acc, r) => acc + (parseInt(r.quads, 10) || 0) + parseExtraCount(r.quad_extra) + (parseInt(r.camels, 10) || 0) + parseExtraCount(r.camel_extra), 0)} Q+C
                </span>
              </button>

              {/* 2. Extra Funds, Avances & Consumptions Button */}
              <button
                type="button"
                onClick={() => setShowExtraFundsModal(true)}
                className="bg-gradient-to-r from-[#0a1c24] via-[#0d2833] to-[#0a1c24] hover:from-[#0f303f] hover:to-[#123b4e] text-[#00e6a8] hover:text-white border border-[#00c896]/50 hover:border-[#00e6a8] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Coins className="w-3.5 h-3.5 text-[#00e6a8]" />
                <span>Extra Funds</span>
              </button>
            </div>
            <span className="text-[10px] text-zinc-500 hidden md:inline">By Asmae &bull; OJ-Abde</span>
          </div>

        </div>

      {/* Excel File Permission Request Modal */}
      <AnimatePresence>
        {showPermissionModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">System Excel File Permission</h3>
                  <p className="text-xs text-zinc-400">Desktop Authorization Request</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                AGM Travel Desktop System requires permission to access, create, and update Excel workbooks (<strong>.xlsx</strong>) on your computer (e.g. inside <code>~/Desktop/AGM-AGAFAY/</code>).
              </p>

              <div className="bg-[#141417] p-3.5 rounded-xl border border-zinc-800 text-[11px] text-zinc-300 mb-6 space-y-2 font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Create monthly sheets (e.g. 07-2026.xlsx)</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Auto-save guide, driver & trip records</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Offline desktop synchronization</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setHasExcelPermission(true);
                    try {
                      localStorage.setItem('agm_excel_permission', JSON.stringify(true));
                    } catch (e) {}
                    setShowPermissionModal(false);
                    setHasStartedWork(true);
                    showNotification("✅ Excel files access permission granted!");
                  }}
                  className="flex-1 bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs py-3 rounded-xl transition-all shadow-lg cursor-pointer"
                >
                  Grant Permission
                </button>
                <button
                  onClick={() => {
                    setShowPermissionModal(false);
                    showNotification("⚠️ Excel permission denied. File synchronization paused.");
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs px-4 py-3 rounded-xl transition-all border border-zinc-800 cursor-pointer"
                >
                  Deny
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= UNIFIED STAFF & ACCOUNTS FULL PAGE VIEW ================= */}
      <StaffProfilesView
        isOpen={showStaffModal}
        onClose={() => {
          setShowStaffModal(false);
          setSelectedStaffProfile(null);
        }}
        results={results}
        staffProfiles={staffProfiles}
        knownGuidesList={knownGuidesList}
        knownDriversList={knownDriversList}
        registeredGuides={registeredGuides}
        registeredDrivers={registeredDrivers}
        managersList={managersList}
        paymentRates={paymentRates}
        currentManager={currentManager}
        onSelectTripDate={(dateStr) => {
          setDateStr(dateStr);
          setShowStaffModal(false);
        }}
        showNotification={showNotification}
      />

      {/* ================= QUADS & CAMELS FLEET & EXTRAS FULL PAGE VIEW ================= */}
      {showFleetModal && (
        <div className="fixed inset-0 z-50 bg-[#03090d] text-white flex flex-col overflow-hidden animate-fadeIn">
          <QuadsAndCamelsFleetView
            results={results}
            staffProfiles={staffProfiles}
            onClose={() => setShowFleetModal(false)}
            onOpenExtraFunds={() => {
              setShowFleetModal(false);
              setShowExtraFundsModal(true);
            }}
            onSelectStaff={(staffName) => {
              setShowFleetModal(false);
              setStaffSearchQuery(staffName);
              setShowStaffModal(true);
            }}
            onSelectTripDate={(dateStr) => {
              setDateStr(dateStr);
              setShowFleetModal(false);
            }}
            showNotification={showNotification}
          />
        </div>
      )}

      {/* ================= EXTRA FUNDS & CONSUMPTIONS (AVANCES / EXPENSES) FULL PAGE VIEW ================= */}
      {showExtraFundsModal && (
        <div className="fixed inset-0 z-50 bg-[#03090d] text-white flex flex-col overflow-hidden animate-fadeIn">
          <ExtraFundsAndExpensesView
            results={results}
            staffProfiles={staffProfiles}
            currentManager={currentManager}
            onClose={() => setShowExtraFundsModal(false)}
            onOpenFleetModal={() => {
              setShowExtraFundsModal(false);
              setShowFleetModal(true);
            }}
            onSelectTripDate={(dateStr) => {
              setDateStr(dateStr);
              setShowExtraFundsModal(false);
            }}
            showNotification={showNotification}
          />
        </div>
      )}

      {/* ================= MONTHLY GUIDES & DRIVERS FULL-PAGE SYSTEM VIEW ================= */}
      <AnimatePresence>
        {showMonthlySlideOver && (
          <div className="fixed inset-0 z-50 bg-[#090a0d] text-zinc-100 flex flex-col overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full bg-[#090a0d] flex flex-col text-zinc-100 overflow-hidden"
            >
              {/* Executive System Header */}
              <div className="bg-[#101216] border-b border-zinc-800/80 shrink-0">
                <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner shrink-0">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider">Enterprise Fleet & Roster Analytics</h2>
                        <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                          System View
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">Comprehensive Monthly Work History, Drivers & Transport Companies System</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowMonthlySlideOver(false);
                      setMonthlySlideSelectedId(null);
                      setMonthlySlideSelectedStaffInfo(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer border border-zinc-800 flex items-center gap-2 font-mono text-xs font-bold shadow-sm"
                  >
                    <span>Close System View</span>
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Filters & Navigation Control Bar (MOVED TO TOP) */}
              <div className="bg-[#13151c] border-b border-zinc-800/80 shrink-0">
                <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
                    <div className="text-xs font-mono uppercase font-bold text-emerald-400 flex items-center gap-1.5 shrink-0 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
                      <Filter className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Filter Logs:</span>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <input
                        type="text"
                        placeholder="Search Name / Company / Driver..."
                        value={monthlySlideSearchName}
                        onChange={(e) => setMonthlySlideSearchName(e.target.value)}
                        className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                      {monthlySlideSearchName && (
                        <button
                          onClick={() => setMonthlySlideSearchName('')}
                          className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Month Selector */}
                    <select
                      value={monthlySlideMonthFilter}
                      onChange={(e) => setMonthlySlideMonthFilter(e.target.value)}
                      className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
                    >
                      <option value="ALL">All Months</option>
                      <option value="01">January (01)</option>
                      <option value="02">February (02)</option>
                      <option value="03">March (03)</option>
                      <option value="04">April (04)</option>
                      <option value="05">May (05)</option>
                      <option value="06">June (06)</option>
                      <option value="07">July (07)</option>
                      <option value="08">August (08)</option>
                      <option value="09">September (09)</option>
                      <option value="10">October (10)</option>
                      <option value="11">November (11)</option>
                      <option value="12">December (12)</option>
                    </select>

                    {/* Day Filter */}
                    <input
                      type="text"
                      placeholder="Filter Day (e.g. 09)"
                      value={monthlySlideDayFilter}
                      onChange={(e) => setMonthlySlideDayFilter(e.target.value)}
                      className="w-36 bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />

                    {(monthlySlideSearchName || monthlySlideMonthFilter !== 'ALL' || monthlySlideDayFilter) && (
                      <button
                        onClick={() => {
                          setMonthlySlideSearchName('');
                          setMonthlySlideMonthFilter('ALL');
                          setMonthlySlideDayFilter('');
                        }}
                        className="text-xs font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer px-1 font-bold"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* System Output Details Summary Squares (KPI Cards - AFTER Filter Logs) */}
              <div className="bg-[#0e1015] border-b border-zinc-800/80 shrink-0 py-3.5">
                <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 font-mono text-xs">
                    <div className="bg-[#161922] border border-zinc-800/80 p-3 rounded-xl hover:border-emerald-700/50 transition-colors shadow-sm">
                      <span className="text-[10px] text-zinc-400 uppercase block font-bold flex items-center gap-1.5 mb-1">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Active Guides</span>
                      </span>
                      <strong className="text-lg text-emerald-400 font-black">{monthlySlideOverData.allGuides.length}</strong>
                    </div>
                    <div className="bg-[#161922] border border-zinc-800/80 p-3 rounded-xl hover:border-emerald-700/50 transition-colors shadow-sm">
                      <span className="text-[10px] text-zinc-400 uppercase block font-bold mb-1">
                        <span>Big Van Drivers</span>
                      </span>
                      <strong className="text-lg text-emerald-400 font-black">{monthlySlideOverData.allBigDrivers.length}</strong>
                    </div>
                    <div className="bg-[#161922] border border-zinc-800/80 p-3 rounded-xl hover:border-teal-700/50 transition-colors shadow-sm">
                      <span className="text-[10px] text-zinc-400 uppercase block font-bold mb-1">
                        <span>Mini Van Drivers</span>
                      </span>
                      <strong className="text-lg text-teal-400 font-black">{monthlySlideOverData.allMiniDrivers.length}</strong>
                    </div>
                    <div className="bg-[#161922] border border-zinc-800/80 p-3 rounded-xl hover:border-purple-700/50 transition-colors shadow-sm">
                      <span className="text-[10px] text-zinc-400 uppercase block font-bold flex items-center gap-1.5 mb-1">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Transport Companies</span>
                      </span>
                      <strong className="text-lg text-purple-400 font-black">{monthlySlideOverData.allCompanies.length}</strong>
                    </div>
                    <div className="bg-[#161922] border border-zinc-800/80 p-3 rounded-xl hover:border-blue-700/50 transition-colors shadow-sm col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-zinc-400 uppercase block font-bold flex items-center gap-1.5 mb-1">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Logged Transports</span>
                      </span>
                      <strong className="text-lg text-white font-black">
                        {monthlySlideOverData.allCompanies.reduce((acc, c) => acc + c.totalTransports, 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs for Guides, Big Vans, Mini Vans & Transport Companies */}
              {!monthlySlideSelectedItem && (
                <div className="w-full bg-[#12141a]/80 border-b border-zinc-800/80 shrink-0">
                  <div className="flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-3 w-full max-w-[1920px] mx-auto overflow-x-auto">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <button
                        onClick={() => setMonthlySlideTab('guides')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          monthlySlideTab === 'guides'
                            ? 'bg-emerald-400 text-zinc-950 shadow-md font-black'
                            : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Guides ({monthlySlideOverData.guides.length})</span>
                      </button>

                      <button
                        onClick={() => setMonthlySlideTab('big_drivers')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          monthlySlideTab === 'big_drivers'
                            ? 'bg-emerald-400 text-zinc-950 shadow-md font-black'
                            : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <span>Big Vans ({monthlySlideOverData.bigDrivers.length})</span>
                      </button>

                      <button
                        onClick={() => setMonthlySlideTab('mini_drivers')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          monthlySlideTab === 'mini_drivers'
                            ? 'bg-emerald-400 text-zinc-950 shadow-md font-black'
                            : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <span>Mini Vans ({monthlySlideOverData.miniDrivers.length})</span>
                      </button>

                      <button
                        onClick={() => setMonthlySlideTab('companies')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          monthlySlideTab === 'companies'
                            ? 'bg-emerald-400 text-zinc-950 shadow-md font-black'
                            : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Company Transports ({monthlySlideOverData.companies.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Body Content */}
              <div className="flex-grow overflow-y-auto py-6 px-4 sm:px-6 lg:px-8 w-full max-w-[1920px] mx-auto space-y-6">
                {monthlySlideSelectedItem ? (
                  /* ================= DETAIL VIEW FOR CLICKED STAFF / COMPANY ================= */
                  <div className="space-y-4">
                    <button
                      onClick={() => {
                        setMonthlySlideSelectedId(null);
                        setMonthlySlideSelectedStaffInfo(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to List</span>
                    </button>

                    {/* Staff / Company Banner */}
                    <div className="bg-zinc-900/90 border border-emerald-800/80 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="text-lg font-black text-white uppercase">{monthlySlideSelectedItem.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1 font-bold">
                            {monthlySlideSelectedItem.role === 'guide' 
                              ? <><Compass className="w-3 h-3 text-emerald-400" /> Tour Guide</> 
                              : monthlySlideSelectedItem.role === 'big_driver' 
                              ? <>Big Van Driver</> 
                              : monthlySlideSelectedItem.role === 'mini_driver' 
                              ? <>Mini Van Driver</> 
                              : <><Building2 className="w-3 h-3 text-purple-400" /> Transport Company</>}
                          </span>
                          {(monthlySlideSelectedItem.role === 'big_driver' || monthlySlideSelectedItem.role === 'mini_driver') && (
                            <span className="text-[10px] font-mono text-purple-300 uppercase bg-purple-950/80 border border-purple-800/80 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 font-bold">
                              <Building2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Company: {(monthlySlideSelectedItem as any).companyName || 'AGM'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap font-mono text-xs">
                        {monthlySlideSelectedItem.role === 'company' ? (
                          <>
                            <div className="bg-black/40 border border-zinc-800 px-3 py-2 rounded-lg text-center">
                              <span className="text-[9px] text-zinc-400 uppercase block">Transports Worked</span>
                              <span className="text-sm font-extrabold text-emerald-400">{monthlySlideSelectedItem.totalTransports}</span>
                            </div>
                            <div className="bg-black/40 border border-zinc-800 px-3 py-2 rounded-lg text-center">
                              <span className="text-[9px] text-zinc-400 uppercase block">Vehicle Types</span>
                              <span className="text-xs font-bold text-zinc-200">
                                <strong className="text-emerald-400">{monthlySlideSelectedItem.totalBigVans}</strong> Big &bull; <strong className="text-teal-400">{monthlySlideSelectedItem.totalMiniVans}</strong> Mini
                              </span>
                            </div>
                            <div className="bg-black/40 border border-zinc-800 px-3 py-2 rounded-lg text-center">
                              <span className="text-[9px] text-zinc-400 uppercase block">Total Pax</span>
                              <span className="text-sm font-extrabold text-white">{monthlySlideSelectedItem.totalPax}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-black/40 border border-zinc-800 px-3 py-2 rounded-lg text-center">
                              <span className="text-[9px] text-zinc-400 uppercase block">Days Worked</span>
                              <span className="text-sm font-extrabold text-emerald-400">{monthlySlideSelectedItem.daysWorkedCount} Days</span>
                            </div>
                            <div className="bg-black/40 border border-zinc-800 px-3 py-2 rounded-lg text-center">
                              <span className="text-[9px] text-zinc-400 uppercase block">Total Pax</span>
                              <span className="text-sm font-extrabold text-white">{monthlySlideSelectedItem.totalPax}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Company Vehicle Type Filter Pills */}
                    {monthlySlideSelectedItem.role === 'company' && (
                      <div className="flex items-center gap-2 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase px-2">Vehicle Filter:</span>
                        <button
                          type="button"
                          onClick={() => setCompanyVehicleFilter('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            companyVehicleFilter === 'all'
                              ? 'bg-emerald-400 text-zinc-950 font-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          All ({monthlySlideSelectedItem.totalTransports})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyVehicleFilter('big')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            companyVehicleFilter === 'big'
                              ? 'bg-emerald-400 text-zinc-950 font-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <span>Big Vans ({monthlySlideSelectedItem.totalBigVans})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyVehicleFilter('mini')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            companyVehicleFilter === 'mini'
                              ? 'bg-emerald-400 text-zinc-950 font-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <span>Mini Vans ({monthlySlideSelectedItem.totalMiniVans})</span>
                        </button>
                      </div>
                    )}

                    {/* Worked Days List */}
                    <div>
                      <h4 className="text-xs font-bold text-emerald-300 font-mono uppercase mb-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          {monthlySlideSelectedItem.role === 'company' 
                            ? `Daily Transport Activity`
                            : `Days Worked Breakdown (${monthlySlideSelectedItem.datesWorked.length} dates)`}
                        </span>
                      </h4>

                      {(() => {
                        const rawDates = monthlySlideSelectedItem.datesWorked || [];
                        const displayDates = (monthlySlideSelectedItem.role === 'company' && companyVehicleFilter !== 'all')
                          ? rawDates.map((dt: any) => {
                              const matchingTrips = dt.trips.filter((t: ResultItem) => {
                                if (companyVehicleFilter === 'big') return t.van_type !== 'Mini van';
                                if (companyVehicleFilter === 'mini') return t.van_type === 'Mini van';
                                return true;
                              });
                              if (matchingTrips.length === 0) return null;
                              const pax = matchingTrips.reduce((acc: number, item: ResultItem) => acc + (parseInt(item.pax) || 0) + parseExtraCount(item.person_extra), 0);
                              const bigVansCount = matchingTrips.filter((item: ResultItem) => item.van_type !== 'Mini van').length;
                              const miniVansCount = matchingTrips.filter((item: ResultItem) => item.van_type === 'Mini van').length;
                              return {
                                ...dt,
                                transportsCount: matchingTrips.length,
                                bigVansCount,
                                miniVansCount,
                                pax,
                                trips: matchingTrips
                              };
                            }).filter(Boolean)
                          : rawDates;

                        if (displayDates.length === 0) {
                          return (
                            <p className="text-xs text-zinc-500 font-mono py-4 text-center">
                              No {companyVehicleFilter !== 'all' ? `${companyVehicleFilter} van` : ''} activity logged for selected filter range.
                            </p>
                          );
                        }

                        return (
                          <div className="space-y-2.5">
                            {displayDates.map((dateEntry: any, idx: number) => (
                              <div key={idx} className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 flex-wrap gap-2">
                                  <span className="text-xs font-black text-emerald-400 font-mono flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    Date: {dateEntry.date} 
                                    {monthlySlideSelectedItem.role === 'company' && (
                                      <span className="text-white bg-emerald-950 border border-emerald-700/80 px-2 py-0.5 rounded-md text-[11px] font-black uppercase">
                                        {monthlySlideSelectedItem.name} {dateEntry.transportsCount}
                                      </span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs font-mono">
                                    {monthlySlideSelectedItem.role === 'company' && (
                                      <span className="text-zinc-400 text-[10px]">
                                        ({dateEntry.bigVansCount} Big, {dateEntry.miniVansCount} Mini)
                                      </span>
                                    )}
                                    <span className="font-bold text-white bg-emerald-950 border border-emerald-700/80 px-2.5 py-0.5 rounded-md">
                                      Pax: {dateEntry.pax}
                                    </span>
                                  </div>
                                </div>

                                {/* Role-specific details */}
                                {monthlySlideSelectedItem.role === 'guide' && (
                                  <div className="text-xs font-mono text-zinc-300 flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-zinc-800/60">
                                    <span>Driver(s) on this day: <strong className="text-emerald-300 uppercase">{dateEntry.drivers}</strong></span>
                                  </div>
                                )}

                                {monthlySlideSelectedItem.role === 'big_driver' && (
                                  <div className="text-xs font-mono text-zinc-300 flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-zinc-800/60">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>Guide(s) on this day: <strong className="text-emerald-300 uppercase">{dateEntry.guides}</strong></span>
                                  </div>
                                )}

                                 {monthlySlideSelectedItem.role === 'company' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                                    {dateEntry.bigVansCount > 0 && (
                                      <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/60 flex items-start gap-2">
                                        <div>
                                          <div className="text-[10px] text-emerald-300 font-bold uppercase flex items-center gap-1">
                                            <span>Big Vans ({dateEntry.bigVansCount})</span>
                                          </div>
                                          <div className="text-zinc-200 text-[11px]">
                                            Drivers: <strong className="text-white uppercase">{dateEntry.bigDrivers || dateEntry.drivers || 'None'}</strong>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {dateEntry.miniVansCount > 0 && (
                                      <div className="bg-teal-950/40 p-2 rounded-lg border border-teal-800/60 flex items-start gap-2">
                                        <div>
                                          <div className="text-[10px] text-teal-300 font-bold uppercase flex items-center gap-1">
                                            <span>Mini Vans ({dateEntry.miniVansCount})</span>
                                          </div>
                                          <div className="text-zinc-200 text-[11px]">
                                            Drivers: <strong className="text-white uppercase">{dateEntry.miniDrivers || dateEntry.drivers || 'None'}</strong>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Trip breakdown */}
                                <div className="space-y-1">
                                  {dateEntry.trips.map((t: ResultItem, tidx: number) => (
                                    <div key={tidx} className="text-[11px] font-mono text-zinc-400 flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-md hover:bg-black/40 transition-colors">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-bold">{t.time}</span>
                                        <span>&bull;</span>
                                        <span className="text-emerald-300 font-bold uppercase">{t.driver}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                                          t.van_type === 'Mini van'
                                            ? 'bg-teal-950 text-teal-300 border-teal-800'
                                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                        }`}>
                                          {t.van_type === 'Mini van' ? 'Mini van' : 'Big van'}
                                        </span>
                                        {t.guide && t.guide !== 'WITHOUT GUIDE' && (
                                          <span className="text-zinc-400 text-[10px]">Guide: {t.guide}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-zinc-200 font-bold">Pax: {t.pax} {parseInt(t.quads) > 0 ? `| Q:${t.quads}` : ''} {parseInt(t.camels) > 0 ? `| C:${t.camels}` : ''}</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setItemToDelete(t);
                                          }}
                                          className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white transition-all cursor-pointer"
                                          title="Delete Record"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  /* ================= LIST OF STAFF MEMBERS / COMPANIES FOR SELECTED TAB ================= */
                  <div className="space-y-3">
                    {monthlySlideTab === 'companies' && (
                      <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-2 rounded-xl text-xs font-mono flex-wrap">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase px-1">Filter Company View:</span>
                        <button
                          type="button"
                          onClick={() => setCompanyTabFilter('all')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            companyTabFilter === 'all'
                              ? 'bg-emerald-400 text-zinc-950 font-black'
                              : 'text-zinc-400 hover:text-white bg-black/30 border border-zinc-800'
                          }`}
                        >
                          All Companies ({monthlySlideOverData.companies.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyTabFilter('big')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            companyTabFilter === 'big'
                              ? 'bg-emerald-400 text-zinc-950 font-black'
                              : 'text-zinc-400 hover:text-white bg-black/30 border border-zinc-800'
                          }`}
                        >
                          <span>With Big Vans</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyTabFilter('mini')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            companyTabFilter === 'mini'
                              ? 'bg-emerald-400 text-zinc-950 font-black'
                              : 'text-zinc-400 hover:text-white bg-black/30 border border-zinc-800'
                          }`}
                        >
                          <span>With Mini Vans</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompanyTabFilter('both')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            companyTabFilter === 'both'
                              ? 'bg-emerald-400 text-zinc-950 font-black'
                              : 'text-zinc-400 hover:text-white bg-black/30 border border-zinc-800'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Both Vehicles</span>
                        </button>
                      </div>
                    )}

                    {(() => {
                      let activeList: any[] = [];
                      if (monthlySlideTab === 'guides') activeList = [...monthlySlideOverData.guides];
                      else if (monthlySlideTab === 'big_drivers') activeList = [...monthlySlideOverData.bigDrivers];
                      else if (monthlySlideTab === 'mini_drivers') activeList = [...monthlySlideOverData.miniDrivers];
                      else if (monthlySlideTab === 'companies') {
                        activeList = monthlySlideOverData.companies.filter(c => {
                          if (companyTabFilter === 'big') return c.totalBigVans > 0;
                          if (companyTabFilter === 'mini') return c.totalMiniVans > 0;
                          if (companyTabFilter === 'both') return c.totalBigVans > 0 && c.totalMiniVans > 0;
                          return true;
                        });
                      }

                      activeList.sort((a, b) => a.name.localeCompare(b.name));

                      if (activeList.length === 0) {
                        return (
                          <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                            No records found for the selected filter & tab.
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {activeList.map((item) => {
                            if (item.role === 'company') {
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    setMonthlySlideSelectedId(item.id);
                                    setMonthlySlideSelectedStaffInfo({ id: item.id, name: item.name, role: item.role });
                                  }}
                                  className="h-[210px] bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-emerald-500/80 rounded-2xl p-4 flex flex-col justify-between transition-all cursor-pointer group shadow-lg hover:shadow-emerald-950/20"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 text-emerald-300 font-black flex items-center justify-center text-base uppercase shrink-0">
                                        <Building2 className="w-5 h-5 text-emerald-400" />
                                      </div>
                                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/80 text-xs font-mono font-black px-2.5 py-1 rounded-lg">
                                        {item.totalTransports} Transports
                                      </span>
                                    </div>

                                    <div>
                                      <h4 className="text-base font-black text-white uppercase group-hover:text-emerald-400 transition-colors tracking-wide truncate">
                                        {item.name}
                                      </h4>
                                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                                        Drivers: <strong className="text-zinc-200">{item.driversCount > 2 ? `${item.driversCount} Drivers` : (item.driversList || 'None')}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-2 rounded-xl border border-zinc-800/60 font-mono text-xs my-1">
                                    <div>
                                      <span className="text-[9px] text-zinc-500 uppercase block font-bold">Vehicles</span>
                                      <span className="text-zinc-200 font-bold text-[11px]">
                                        <strong className="text-emerald-400">{item.totalBigVans}</strong> Big &bull; <strong className="text-teal-400">{item.totalMiniVans}</strong> Mini
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-zinc-500 uppercase block font-bold">Passengers</span>
                                      <strong className="text-white font-extrabold text-[11px]">{item.totalPax} Pax</strong>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono font-bold text-emerald-400 group-hover:text-emerald-300">
                                    <span>Explore Ledger</span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setMonthlySlideSelectedId(item.id);
                                  setMonthlySlideSelectedStaffInfo({ id: item.id, name: item.name, role: item.role });
                                }}
                                className="h-[210px] bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-emerald-500/80 rounded-2xl p-4 flex flex-col justify-between transition-all cursor-pointer group shadow-lg hover:shadow-emerald-950/20"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black flex items-center justify-center text-lg uppercase shrink-0">
                                      {item.name.charAt(0)}
                                    </div>
                                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                                      {item.role === 'guide' ? <><Compass className="w-3 h-3 text-emerald-400" /> Tour Guide</> : item.role === 'big_driver' ? 'Big Van' : 'Mini Van'}
                                    </span>
                                  </div>

                                  <div>
                                    <h4 className="text-base font-black text-white uppercase group-hover:text-emerald-400 transition-colors tracking-wide truncate">
                                      {item.name}
                                    </h4>
                                    {(item.role === 'big_driver' || item.role === 'mini_driver') && (
                                      <p className="text-[11px] font-mono text-purple-300 mt-0.5 truncate flex items-center gap-1 font-bold">
                                        <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                                        <span>Company: {(item as any).companyName || 'AGM'}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-xl border border-zinc-800/60 font-mono text-xs my-1">
                                  <div>
                                    <span className="text-[9px] text-zinc-500 uppercase block font-bold">Days Worked</span>
                                    <strong className="text-emerald-400 font-extrabold">{item.daysWorkedCount} Days</strong>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-zinc-500 uppercase block font-bold">Passengers</span>
                                    <strong className="text-white font-extrabold">{item.totalPax} Pax</strong>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono font-bold text-emerald-400 group-hover:text-emerald-300">
                                  <span>View Days Worked</span>
                                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= EXACT EXCEL DESIGN SHEET VIEWER MODAL (MATCHING QUADS & CAMELS FLEET STYLE) ================= */}
      {showExcelModal && (
        <ExcelWorkbooksView
          results={results}
          showExcelModal={showExcelModal}
          currentDate={dateStr}
          onClose={() => setShowExcelModal(false)}
          showNotification={showNotification}
          onSelectTripDate={(dateStr) => {
            setShowExcelModal(false);
            setDateStr(dateStr);
            setSearchTerm(dateStr);
            setViewMode('list');
          }}
          onSelectStaff={(staffName) => {
            setShowExcelModal(false);
            const found = staffProfiles.find(s => s.name.toUpperCase() === staffName.toUpperCase());
            if (found) {
              setSelectedStaffProfile(found);
            }
            setShowStaffModal(true);
          }}
        />
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">Confirm Deletion</h3>
                <p className="text-xs text-zinc-300 mt-2 font-mono leading-relaxed">
                  Are you sure you want to delete the record for{' '}
                  <strong className="text-rose-400 font-extrabold uppercase">{itemToDelete.guide}</strong>
                  {itemToDelete.driver ? (
                    <>
                      {' '}
                      &bull; <strong className="text-rose-400 font-extrabold uppercase">{itemToDelete.driver}</strong>
                    </>
                  ) : null}
                  ?
                </p>
                <div className="mt-3 bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2.5 text-[11px] font-mono text-zinc-400 space-y-1">
                  <div>
                    Record #{itemToDelete.id} &bull; Date: <strong className="text-zinc-200">{itemToDelete.date}</strong> @ <strong className="text-zinc-200">{itemToDelete.time}</strong>
                  </div>
                  <div>
                    Pax: <strong className="text-emerald-400">{itemToDelete.pax}</strong> | Quads: <strong className={itemToDelete.quads === 'None' || itemToDelete.quads === 'none' ? 'text-amber-400 font-mono' : 'text-white'}>{itemToDelete.quads === 'None' || itemToDelete.quads === 'none' ? 'None' : itemToDelete.quads}</strong> | Camels: <strong className={itemToDelete.camels === 'None' || itemToDelete.camels === 'none' ? 'text-amber-400 font-mono' : 'text-white'}>{itemToDelete.camels === 'None' || itemToDelete.camels === 'none' ? 'None' : itemToDelete.camels}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(itemToDelete.id);
                    setItemToDelete(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-2.5 rounded-xl transition-all shadow-lg cursor-pointer font-mono"
                >
                  Sure
                </button>
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs py-2.5 rounded-xl transition-all border border-zinc-800 cursor-pointer font-mono"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= FULL-PAGE MANAGER PROFILE & OPERATIONS VIEW (Triggered by Profile 'A') ================= */}
      <ManagerProfileView
        isOpen={showManagerProfileModal}
        onClose={() => setShowManagerProfileModal(false)}
        currentManager={currentManager}
        managersList={managersList}
        paymentRates={paymentRates}
        managerStats={managerStats}
        onSaveManager={(updated) => {
          setCurrentManager(updated);
          localStorage.setItem('agm_current_manager', JSON.stringify(updated));
          setManagersList(prev => {
            const exists = prev.some(m => m.id === updated.id);
            const next = exists ? prev.map(m => m.id === updated.id ? updated : m) : [...prev, updated];
            localStorage.setItem('agm_managers', JSON.stringify(next));
            return next;
          });
        }}
        onSelectManager={(mgr) => {
          setCurrentManager(mgr);
          localStorage.setItem('agm_current_manager', JSON.stringify(mgr));
        }}
        onOpenPaymentsDetails={() => {
          setShowPaymentsDetailsModal(true);
        }}
        onOpenStaffModal={() => {
          setShowManagerProfileModal(false);
          setShowStaffModal(true);
        }}
        onOpenAdminLogin={() => {
          setShowManagerProfileModal(false);
          setAdminEmail('ismail@admin.com');
          setAdminPassword('');
          setAdminLoginError(null);
          setShowAdminLoginModal(true);
        }}
        onOpenAddManager={() => {
          setShowManagerProfileModal(false);
          setNewMgrName('');
          setNewMgrLastname('');
          setNewMgrSchool('');
          setNewMgrSkill('IT Student Software Developer...');
          setShowAddManagerModal(true);
        }}
        onOpenIdManager={() => {
          setShowManagerProfileModal(false);
          setShowIdManagerModal(true);
        }}
        onOpenDragFolder={() => {
          setShowManagerProfileModal(false);
          setShowAgmDragFolderModal(true);
        }}
        onOpenAccounts={() => {
          setShowManagerProfileModal(false);
          setShowAccountsModal(true);
        }}
        showNotification={showNotification}
      />

      {/* ================= 1. ADMIN LOGIN LANDING PAGE MODAL ================= */}
      <AnimatePresence>
        {showAdminLoginModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#09151a] border border-[#1e3b44] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,200,150,0.15)] relative text-left space-y-6"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-[#12242a] p-2 rounded-full border border-[#1e3b44] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Icon & Title */}
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#00c896]/10 border border-[#00c896]/30 text-[#00e6a8] flex items-center justify-center shadow-inner">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">Admin Portal Login</h2>
                  <p className="text-xs text-teal-300/80 font-mono mt-1">
                    Sign in to access workstation manager administration
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {adminLoginError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{adminLoginError}</span>
                </div>
              )}

              {/* Login Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (adminEmail.trim().toLowerCase() === 'ismail@admin.com' && adminPassword === 'agmtravelagm') {
                    setAdminLoginError(null);
                    setShowAdminLoginModal(false);
                    setShowManagerDashboard(true);
                    showNotification("🔓 Admin Ismail Authenticated");
                  } else {
                    setAdminLoginError("Invalid admin credentials! Required: ismail@admin.com / agmtravelagm");
                  }
                }}
                className="space-y-4 font-mono"
              >
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Admin User Email
                  </label>
                  <div className="relative rounded-xl border border-[#1c3943] bg-[#0d1f25] focus-within:border-[#00e6a8] transition-all flex items-center px-3.5 py-2.5">
                    <User className="w-4 h-4 text-teal-400 mr-2 shrink-0" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="ismail@admin.com"
                      required
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Default admin email: ismail@admin.com</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Admin Password
                  </label>
                  <div className="relative rounded-xl border border-[#1c3943] bg-[#0d1f25] focus-within:border-[#00e6a8] transition-all flex items-center px-3.5 py-2.5">
                    <Lock className="w-4 h-4 text-teal-400 mr-2 shrink-0" />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Default password: agmtravelagm</span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#00c896] via-teal-400 to-[#00e6a8] hover:from-[#00e6a8] hover:to-teal-300 text-zinc-950 font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(0,200,150,0.3)] cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate Admin</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 2. MANAGER PROFILES DASHBOARD MODAL ================= */}
      <AnimatePresence>
        {showManagerDashboard && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#09151a] border border-[#1e3b44] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative text-left space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header Toolbar */}
              <div className="flex items-center justify-between border-b border-[#1e3b44] pb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#00c896]/20 border border-[#00c896]/40 text-[#00e6a8] flex items-center justify-center font-bold text-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Manager Profile Users</h2>
                    <p className="text-xs text-teal-300/80 font-mono">
                      Logged in as Admin: <span className="text-[#00e6a8] font-bold">ismail@admin.com</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewMgrName('');
                      setNewMgrLastname('');
                      setNewMgrSchool('');
                      setNewMgrSkill('IT Student Software Developer...');
                      setShowAddManagerModal(true);
                    }}
                    className="bg-gradient-to-r from-[#00c896] to-teal-400 hover:from-[#00e6a8] hover:to-teal-300 text-zinc-950 font-mono font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Manager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManagerDashboard(false)}
                    className="text-zinc-400 hover:text-white bg-[#12242a] p-2 rounded-xl border border-[#1e3b44] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Manager Profiles List */}
              <div className="space-y-4">
                {managersList.length === 0 ? (
                  <div className="bg-[#0e2129]/80 border border-[#1b3a45] rounded-2xl p-8 text-center space-y-3 font-mono">
                    <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
                      <User className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white">No Manager Profiles Added Yet</p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Click the <strong className="text-[#00e6a8]">+ Add Manager</strong> button above to register a new workstation manager profile.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMgrName('');
                        setNewMgrLastname('');
                        setNewMgrSchool('');
                        setNewMgrSkill('IT Student Software Developer...');
                        setShowAddManagerModal(true);
                      }}
                      className="mt-2 bg-[#17323b] hover:bg-[#1f424e] text-[#00e6a8] font-bold text-xs px-5 py-2.5 rounded-xl border border-[#25505e] transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Register First Manager</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 font-mono">
                    {managersList.map((mgr) => {
                      const isActive = currentManager?.id === mgr.id;
                      return (
                        <div
                          key={mgr.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isActive
                              ? 'bg-[#0f2a24] border-[#00c896] shadow-[0_0_20px_rgba(0,200,150,0.2)]'
                              : 'bg-[#0c1c23] border-[#1e3b44] hover:border-teal-500/50'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-[#00c896]/20 border border-[#00c896]/40 text-[#00e6a8] flex items-center justify-center font-black text-base uppercase shrink-0">
                              {mgr.name.charAt(0)}{mgr.lastname ? mgr.lastname.charAt(0) : ''}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-extrabold text-white">
                                  {mgr.name} {mgr.lastname}
                                </h3>
                                {isActive && (
                                  <span className="bg-[#00c896] text-zinc-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Active Workstation
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-teal-300/80 flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                <span>{mgr.schoolLevel || 'Higher Education'}</span>
                              </p>
                              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span>{mgr.skill}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentManager(mgr);
                                  localStorage.setItem('agm_current_manager', JSON.stringify(mgr));
                                  setShowManagerDashboard(false);
                                  setShowIntroScreen(true);
                                  showNotification(`👤 Switched active manager to ${mgr.name} ${mgr.lastname}`);
                                }}
                                className="bg-[#142d36] hover:bg-[#1d404d] text-[#00e6a8] border border-[#234c5b] text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                              >
                                Select Profile
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const updated = managersList.filter(m => m.id !== mgr.id);
                                setManagersList(updated);
                                localStorage.setItem('agm_managers', JSON.stringify(updated));
                                if (currentManager?.id === mgr.id) {
                                  const nextMgr = updated[0] || null;
                                  setCurrentManager(nextMgr);
                                  if (nextMgr) {
                                    localStorage.setItem('agm_current_manager', JSON.stringify(nextMgr));
                                  } else {
                                    localStorage.removeItem('agm_current_manager');
                                  }
                                }
                                showNotification(`Removed manager ${mgr.name}`);
                              }}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 rounded-xl transition-all border border-rose-500/20 cursor-pointer"
                              title="Delete Manager Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 3. ADD MANAGER DETAILS FORM MODAL ================= */}
      <AnimatePresence>
        {showAddManagerModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#09151a] border border-[#1e3b44] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative text-left space-y-6"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowAddManagerModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-[#12242a] p-2 rounded-full border border-[#1e3b44] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#00c896]/10 border border-[#00c896]/30 text-[#00e6a8] flex items-center justify-center shadow-inner">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">Add Manager Details</h2>
                  <p className="text-xs text-teal-300/80 font-mono">Fill in information for the new manager profile</p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMgrName.trim() || !newMgrLastname.trim()) {
                    showNotification("⚠️ Please enter manager Name and Lastname");
                    return;
                  }
                  setConfirmPasswordInput('');
                  setConfirmError(null);
                  setShowAddManagerModal(false);
                  setShowConfirmPasswordModal(true);
                }}
                className="space-y-4 font-mono text-xs"
              >
                {/* First Name & Lastname */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={newMgrName}
                      onChange={(e) => setNewMgrName(e.target.value)}
                      placeholder="e.g. Ismail"
                      required
                      className="w-full rounded-xl border border-[#1c3943] bg-[#0d1f25] text-white p-3 focus:border-[#00e6a8] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                      Lastname *
                    </label>
                    <input
                      type="text"
                      value={newMgrLastname}
                      onChange={(e) => setNewMgrLastname(e.target.value)}
                      placeholder="e.g. Amzil"
                      required
                      className="w-full rounded-xl border border-[#1c3943] bg-[#0d1f25] text-white p-3 focus:border-[#00e6a8] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Level School / Education */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    From where level school (Education Level)
                  </label>
                  <input
                    type="text"
                    value={newMgrSchool}
                    onChange={(e) => setNewMgrSchool(e.target.value)}
                    placeholder="e.g. EST / University / Master Software Engineering"
                    className="w-full rounded-xl border border-[#1c3943] bg-[#0d1f25] text-white p-3 focus:border-[#00e6a8] focus:outline-none"
                  />
                </div>

                {/* Skill */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                    Skill (Default Profile)
                  </label>
                  <input
                    type="text"
                    value={newMgrSkill}
                    onChange={(e) => setNewMgrSkill(e.target.value)}
                    placeholder="IT Student Software Developer..."
                    required
                    className="w-full rounded-xl border border-[#1c3943] bg-[#0d1f25] text-white p-3 focus:border-[#00e6a8] focus:outline-none"
                  />
                  <span className="text-[10px] text-teal-400/70 mt-1 block">Default value: IT Student Software Developer...</span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddManagerModal(false)}
                    className="px-4 py-3 rounded-xl border border-[#1e3b44] text-zinc-400 font-bold hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#00c896] via-teal-400 to-[#00e6a8] hover:from-[#00e6a8] hover:to-teal-300 text-zinc-950 font-black py-3 rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>Proceed to Confirm</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= 4. ISMAIL RE-CONFIRMATION SQUARE MODAL ================= */}
      <AnimatePresence>
        {showConfirmPasswordModal && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-[#09151a] border-2 border-[#00c896]/40 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-[0_0_60px_rgba(0,200,150,0.3)] text-center space-y-5 relative"
            >
              {/* Ismail Admin Avatar Badge */}
              <div className="relative mx-auto w-20 h-20">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00c896]/30 via-teal-500/20 to-emerald-600/30 border-2 border-[#00e6a8] text-[#00e6a8] font-black text-2xl flex items-center justify-center shadow-2xl uppercase">
                  IS
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#00e6a8] text-zinc-950 p-1 rounded-full border-2 border-[#09151a]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">Ismail Admin</h3>
                <p className="text-xs text-[#00e6a8] font-mono font-bold mt-0.5">ismail@admin.com</p>
                <div className="mt-3 bg-[#11242c] border border-[#1d3d47] p-3 rounded-2xl text-xs font-mono text-zinc-200 leading-relaxed">
                  Ismail, confirm that you want to add this manager by entering your password again.
                </div>
              </div>

              {confirmError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-xs font-mono text-rose-300">
                  {confirmError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (confirmPasswordInput === 'agmtravelagm') {
                    const createdMgr: ManagerData = {
                      id: `mgr_${Date.now()}`,
                      name: newMgrName.trim(),
                      lastname: newMgrLastname.trim(),
                      schoolLevel: newMgrSchool.trim() || 'Software Engineering',
                      skill: newMgrSkill.trim() || 'IT Student Software Developer...',
                      createdAt: new Date().toISOString()
                    };

                    const updated = [...managersList, createdMgr];
                    setManagersList(updated);
                    localStorage.setItem('agm_managers', JSON.stringify(updated));

                    setCurrentManager(createdMgr);
                    localStorage.setItem('agm_current_manager', JSON.stringify(createdMgr));

                    setShowConfirmPasswordModal(false);
                    setShowManagerDashboard(false);
                    setShowAddManagerModal(false);
                    setShowAdminLoginModal(false);
                    setShowIntroScreen(true);

                    showNotification(`✅ Manager ${createdMgr.name} ${createdMgr.lastname} added successfully!`);
                  } else {
                    setConfirmError("Incorrect password! Ismail, enter 'agmtravelagm' to confirm.");
                  }
                }}
                className="space-y-4 font-mono"
              >
                <div>
                  <div className="relative rounded-xl border border-[#1c3943] bg-[#0d1f25] focus-within:border-[#00e6a8] transition-all flex items-center px-3.5 py-2.5">
                    <Lock className="w-4 h-4 text-[#00e6a8] mr-2 shrink-0" />
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Enter password (agmtravelagm)"
                      required
                      autoFocus
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#00c896] via-teal-400 to-[#00e6a8] hover:from-[#00e6a8] hover:to-teal-300 text-zinc-950 font-black text-xs py-3 rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,200,150,0.4)] cursor-pointer"
                  >
                    Confirm & Add
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfirmPasswordModal(false)}
                    className="px-3.5 py-3 rounded-xl bg-[#12242a] text-zinc-400 font-bold hover:text-white border border-[#1e3b44] text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Driver Assignment Remove Confirmation Modal */}
      <AnimatePresence>
        {driverToRemoveId && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#09151a] border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 font-mono text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Remove Driver from Trip?
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Are you sure you want to remove this driver from this trip assignment?
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDriverToRemoveId(null)}
                  className="flex-1 py-2.5 bg-[#050b0e] hover:bg-[#0a141a] text-zinc-300 font-bold text-xs rounded-xl border border-[#182e3b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveDriver}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer transition-all uppercase"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trip Record Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#09151a] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Delete Excursion Tour?
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Remove record #{itemToDelete.id} from daily roster
                  </p>
                </div>
              </div>

              <div className="bg-[#050f14] border border-[#132b38] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Guide:</span>
                  <span className="text-[#00e6a8] font-bold uppercase">{itemToDelete.guide}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Driver / Transport:</span>
                  <span className="text-white font-bold">{itemToDelete.driver} ({itemToDelete.van_type})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Date & Time:</span>
                  <span className="text-zinc-200">{itemToDelete.date} @ {itemToDelete.time}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#132b38] pt-2">
                  <span className="text-zinc-400">Pax / Quads / Camels:</span>
                  <span className="text-amber-300 font-bold">{itemToDelete.pax} Pax • {itemToDelete.quads} Q • {itemToDelete.camels} C</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2.5 bg-[#050b0e] hover:bg-[#0a141a] text-zinc-300 font-bold text-xs rounded-xl border border-[#182e3b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = itemToDelete.id;
                    handleDelete(idToDelete);
                    setItemToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg cursor-pointer transition-all uppercase flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Yes, Delete Tour</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payments Details & Tariffs Modal */}
      <PaymentsDetailsModal
        isOpen={showPaymentsDetailsModal}
        onClose={() => setShowPaymentsDetailsModal(false)}
        rates={paymentRates}
        onSaveRates={(newRates) => {
          setPaymentRates(newRates);
          showNotification('💰 Payments Details & Daily Tariffs Updated');
        }}
      />

      {/* Full-Screen Guide & Driver ID Manager Portal */}
      <IdManagerView
        isOpen={showIdManagerModal}
        onClose={() => setShowIdManagerModal(false)}
        guides={registeredGuides}
        drivers={registeredDrivers}
        driverIdMode={driverIdMode}
        onToggleDriverIdMode={handleDriverIdModeChange}
        onUpdateGuides={(updated) => {
          setRegisteredGuides(updated);
          saveGuidesToStorage(updated);
          showNotification(`📇 Registered Guides updated (${updated.length} active)`);
        }}
        onUpdateDrivers={(updated) => {
          setRegisteredDrivers(updated);
          saveDriversToStorage(updated);
          showNotification(`🚐 Registered Drivers updated (${updated.length} active)`);
        }}
        showNotification={showNotification}
        onSelectGuideForTrip={(guide) => {
          setGuideName(guide.name);
          setGuideIdInput(guide.id);
          setShowIdManagerModal(false);
          showNotification(`✓ Guide ${guide.name} [${guide.id}] selected for trip input`);
        }}
        onSelectDriverForTrip={(driver) => {
          setDriversInput(prev => {
            const first = prev[0] || { id: '1', driverId: '', driverName: '', vanType: 'Big van', companyName: 'AGM', pax: '' };
            return [{
              ...first,
              driverId: driver.id || '',
              driverName: driver.name,
              vanType: driver.vanType,
              companyName: driver.companyName || 'AGM'
            }, ...prev.slice(1)];
          });
          setShowIdManagerModal(false);
          showNotification(`✓ Driver ${driver.name} selected for trip input`);
        }}
      />

      {/* AGM-WorkSpace Standalone File Server & Drag Folder Hub Modal */}
      <AgmDragFolderModal
        isOpen={showAgmDragFolderModal}
        onClose={() => setShowAgmDragFolderModal(false)}
        trips={results}
        guides={registeredGuides}
        drivers={registeredDrivers}
        managers={managersList}
        paymentRates={paymentRates}
        onRestoreWorkspace={handleRestoreAgmWorkspace}
        showNotification={showNotification}
      />

      {/* Local App / File System Access Permission Modal */}
      <FileSystemPermissionModal
        isOpen={showFilePermissionModal}
        onClose={() => setShowFilePermissionModal(false)}
        trips={results}
        registeredGuides={registeredGuides}
        registeredDrivers={registeredDrivers}
        managersList={managersList}
        paymentRates={paymentRates}
        directoryHandle={directoryHandle}
        setDirectoryHandle={setDirectoryHandle}
        showNotification={showNotification}
      />

      {/* Accounts & Work Attendance Ledger Page Modal */}
      <AccountsView
        isOpen={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
        results={results}
        staffProfiles={staffProfiles}
        registeredGuides={registeredGuides}
        registeredDrivers={registeredDrivers}
        managersList={managersList}
        paymentRates={paymentRates}
        currentManager={currentManager}
        showNotification={showNotification}
      />
    </div>
  );
}

// Simple fallback icon
function AlertCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
