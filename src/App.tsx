import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  UtensilsCrossed, 
  ChefHat, 
  Settings, 
  LogOut,
  HelpCircle,
  Bell,
  User,
  Plus,
  Search,
  TrendingUp,
  ShoppingBag,
  Info,
  ArrowRight,
  ShoppingCart,
  Check,
  Clock,
  AlertTriangle,
  Globe,
  Moon,
  Sun,
  Menu,
  X,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { checkSupabaseConnection, type SupabaseConnectionState } from './lib/supabase';
import {
  deleteStaffMember,
  fetchMenuItems,
  fetchOrders,
  fetchStaffAccounts,
  fetchRolePermissions,
  fetchStaffMembers,
  insertOrder,
  subscribeToOpsRealtime,
  updateMenuItemStock,
  updateStaffPassword,
  upsertStaffAccount,
  upsertRolePermission,
  upsertStaffMember,
} from './lib/supabase-data';

// --- Types ---

type View = 'dashboard' | 'orders' | 'menu' | 'kitchen' | 'settings' | 'login';
type Language = 'en' | 'th';
type ThemeMode = 'dark' | 'light';
type StaffRole = 'Manager' | 'Server' | 'Kitchen';

type RolePermission = {
  dashboard: boolean;
  kitchen: boolean;
  pos: boolean;
  inventory: boolean;
  staff: boolean;
};

type PermissionMatrix = Record<StaffRole, RolePermission>;

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  sku: string;
  image: string;
  description: string;
}

interface Order {
  id: string;
  customer: string;
  items: string;
  total: number;
  status: 'new' | 'preparing' | 'delivered';
  time: string;
  type?: 'dine-in' | 'takeout';
  createdAt?: number;
  note?: string;
  lineItems?: { name: string; qty: number; station: 'HOT' | 'COLD' }[];
}

interface KitchenOrder {
  id: string;
  customer: string;
  type: 'dine-in' | 'takeout';
  elapsed: string;
  est: string;
  status: 'overdue' | 'delayed' | 'new';
  items: { name: string; qty: number; station: 'HOT' | 'COLD' }[];
  note?: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  image: string;
  active?: boolean;
}

interface StaffAccount {
  staffId: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  active: boolean;
}

// --- Mock Data ---

const MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Shibuya Shoyu',
    category: 'Ramen',
    price: 1200,
    cost: 450,
    stock: 45,
    sku: 'RAM-001',
    image: 'https://picsum.photos/seed/ramen/400/300',
    description: '12-hour aged chicken & soy broth, handmade noodles'
  },
  {
    id: '2',
    name: 'Truffle Croissant',
    category: 'Pastries',
    price: 850,
    cost: 320,
    stock: 12,
    sku: 'CRP-024',
    image: 'https://picsum.photos/seed/croissant/400/300',
    description: 'AOP butter, black winter truffle, sea salt flake'
  },
  {
    id: '3',
    name: 'Miso Macarons (6pk)',
    category: 'Pastries',
    price: 1400,
    cost: 600,
    stock: 24,
    sku: 'CRP-025',
    image: 'https://picsum.photos/seed/macarons/400/300',
    description: 'White miso ganache, toasted sesame, yuzu zest'
  },
  {
    id: '4',
    name: 'Neon Gin Fizz',
    category: 'Drinks',
    price: 1800,
    cost: 400,
    stock: 88,
    sku: 'DRK-102',
    image: 'https://picsum.photos/seed/cocktail/400/300',
    description: 'Japanese Gin, lychee, sparkling elderflower'
  },
  {
    id: '5',
    name: 'Wagyu Sando',
    category: 'Tapas',
    price: 3500,
    cost: 1500,
    stock: 8,
    sku: 'TAP-005',
    image: 'https://picsum.photos/seed/wagyu/400/300',
    description: 'A5 Miyazaki Wagyu, honey mustard, milk bread'
  },
  {
    id: '6',
    name: 'Matcha Crepe',
    category: 'Pastries',
    price: 900,
    cost: 300,
    stock: 15,
    sku: 'CRP-026',
    image: 'https://picsum.photos/seed/matcha/400/300',
    description: '20 layers of Uji matcha cream & delicate crepes'
  }
];

const RECENT_ORDERS: Order[] = [
  { id: '#TK-8942', customer: 'Kenji Nakamura', items: '2x Miso Truffle Ramen, 1x Croissant Bun', total: 4820, status: 'preparing', time: '14:20' },
  { id: '#TK-8941', customer: 'Elena Laurent', items: '1x Wagyu Sando, 2x Bordeaux Wine Red', total: 12400, status: 'new', time: '14:15' },
  { id: '#TK-8940', customer: 'Sato M.', items: '1x Paris-Tokyo Fusion Plate', total: 3200, status: 'delivered', time: '13:45' }
];

const KITCHEN_ORDERS: KitchenOrder[] = [
  {
    id: '#TXP-9402',
    customer: 'Marc Jacobs',
    type: 'dine-in',
    elapsed: '24m',
    est: '15m',
    status: 'overdue',
    items: [
      { name: 'Wagyu Beef Bao', qty: 2, station: 'HOT' },
      { name: 'Truffle Miso Ramen', qty: 1, station: 'HOT' }
    ],
    note: 'No scallions on the Ramen, please. Allergy.'
  },
  {
    id: '#TXP-9405',
    customer: 'Takeout',
    type: 'takeout',
    elapsed: '16m',
    est: '15m',
    status: 'delayed',
    items: [
      { name: 'Paris-Tokyo Macarons', qty: 3, station: 'COLD' },
      { name: 'Yuzu Cheesecake', qty: 1, station: 'COLD' }
    ]
  },
  {
    id: '#TXP-9408',
    customer: 'Table 12',
    type: 'dine-in',
    elapsed: '3m',
    est: '10m',
    status: 'new',
    items: [
      { name: 'Matcha Escargot', qty: 1, station: 'HOT' },
      { name: 'Tuna Tataki Niçoise', qty: 2, station: 'COLD' }
    ]
  }
];

const STAFF_MEMBERS_MOCK: StaffMember[] = [
  { id: 's-1', name: 'Kenji Sato', role: 'Manager', image: 'https://picsum.photos/seed/kenji/100/100', active: true },
  { id: 's-2', name: 'Lea Dubois', role: 'Kitchen', image: 'https://picsum.photos/seed/lea/100/100', active: true },
  { id: 's-3', name: 'Marcus Thorne', role: 'Server', image: 'https://picsum.photos/seed/marcus/100/100', active: true },
  { id: 's-4', name: 'Yuki Tanaka', role: 'Server', image: 'https://picsum.photos/seed/yuki/100/100', active: true },
];

const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  Manager: { dashboard: true, kitchen: true, pos: true, inventory: true, staff: true },
  Server: { dashboard: false, kitchen: false, pos: true, inventory: false, staff: false },
  Kitchen: { dashboard: false, kitchen: true, pos: false, inventory: false, staff: false },
};

const SALES_DATA = [
  { time: '10:00', value: 12000 },
  { time: '11:00', value: 25000 },
  { time: '12:00', value: 38000 },
  { time: '13:00', value: 42000 },
  { time: '14:00', value: 64000 },
  { time: '15:00', value: 48000 },
  { time: '16:00', value: 32000 },
  { time: '17:00', value: 28000 },
  { time: '18:00', value: 55000 },
  { time: '19:00', value: 72000 },
  { time: '20:00', value: 85000 },
  { time: '21:00', value: 45000 },
  { time: '22:00', value: 30000 },
];

const TEXT = {
  en: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    menu: 'Inventory',
    kitchen: 'Kitchen',
    settings: 'Staff & Permissions',
    support: 'Support',
    newOrder: 'New Order',
    supabaseConnected: 'Supabase Connected',
    supabaseMissing: 'Supabase Missing Env',
    supabaseError: 'Supabase Error',
    adminDashboard: 'Admin Dashboard',
    posTerminal: 'POS Terminal',
    menuManagement: 'Inventory Management',
    kitchenBoard: 'Kitchen Board',
    settingsTitle: 'Staff & Permissions',
    syncing: 'Syncing with Supabase...',
    routeLabel: 'Truck 01 • Shibuya Crossing',
    avgPrep: 'Average Prep Time',
    activeOrders: 'Active Orders',
    inPerson: 'In-Person',
    takeout: 'Takeout',
    currentOrder: 'Current Order',
    customerName: 'Customer name',
    orderNote: 'Order note',
    remove: 'Remove',
    cartEmpty: 'Cart is empty',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    submitOrder: 'Submit Order',
    submitting: 'Submitting...',
    inventoryControl: 'Inventory Control',
    atelierStock: 'Atelier Stock',
    searchProducts: 'Search products...',
    addProduct: 'Add Product',
    product: 'Product',
    category: 'Category',
    cost: 'Cost',
    price: 'Price',
    stock: 'Stock',
    status: 'Status',
    cinematicLogin: 'Cinematic Login',
    atelierId: 'Atelier ID',
    accessKey: 'Access Key',
    enterAtelier: 'Enter Atelier',
    language: 'Language',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    addStaff: 'Add Staff',
    activeStaff: 'Active Staff',
    members: 'Members',
    manager: 'Manager',
    server: 'Server',
    kitchenRole: 'Kitchen',
    dashboardAccess: 'Dashboard Access',
    dashboardAccessDesc: 'Overview of analytics, sales, and truck performance metrics.',
    kitchenOps: 'Kitchen Ops',
    kitchenOpsDesc: 'Live ticket management, prep lists, and station assignments.',
    posPermission: 'POS Terminal',
    posPermissionDesc: 'Transaction handling, discounts, and payment processing.',
    inventoryPermission: 'Inventory Mgmt',
    inventoryPermissionDesc: 'Stock levels, supplier orders, and waste tracking.',
    staffPermission: 'Staff Permission',
    staffPermissionDesc: 'Manage staff list and role permissions.',
    discardChanges: 'Discard Changes',
    savePermissions: 'Save Permissions',
    permissionSaved: 'Permissions Saved',
    staffNamePlaceholder: 'Staff name',
    deleteStaff: 'Delete Staff',
    createAccount: 'Create User & Password',
    username: 'Username',
    generatedPassword: 'Generated password',
    accountCreated: 'Account created',
    noStaffSelected: 'Please select staff first',
    loginFailed: 'Invalid username or password',
    loginNoAccount: 'No user account found',
    changePasswordFirstLogin: 'First login: please change your password',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 8 characters',
    saveNewPassword: 'Save New Password',
    login: 'Login',
    passwordUpdatedPleaseLogin: 'Password updated. Please login again',
  },
  th: {
    dashboard: 'แดชบอร์ด',
    orders: 'ออเดอร์',
    menu: 'สต็อกสินค้า',
    kitchen: 'ครัว',
    settings: 'พนักงานและสิทธิ์',
    support: 'ช่วยเหลือ',
    newOrder: 'ออเดอร์ใหม่',
    supabaseConnected: 'Supabase เชื่อมต่อแล้ว',
    supabaseMissing: 'Supabase ยังไม่ตั้งค่า',
    supabaseError: 'Supabase ผิดพลาด',
    adminDashboard: 'แดชบอร์ดผู้ดูแล',
    posTerminal: 'หน้าขาย POS',
    menuManagement: 'จัดการสต็อก',
    kitchenBoard: 'บอร์ดครัว',
    settingsTitle: 'พนักงานและสิทธิ์',
    syncing: 'กำลังซิงก์กับ Supabase...',
    routeLabel: 'รถคันที่ 01 • ชิบุยะครอสซิ่ง',
    avgPrep: 'เวลาเตรียมเฉลี่ย',
    activeOrders: 'ออเดอร์ที่กำลังทำ',
    inPerson: 'หน้าร้าน',
    takeout: 'กลับบ้าน',
    currentOrder: 'ออเดอร์ปัจจุบัน',
    customerName: 'ชื่อลูกค้า',
    orderNote: 'หมายเหตุออเดอร์',
    remove: 'ลบ',
    cartEmpty: 'ยังไม่มีสินค้าในตะกร้า',
    subtotal: 'ยอดก่อนภาษี',
    tax: 'ภาษี',
    total: 'รวมทั้งหมด',
    submitOrder: 'ส่งออเดอร์',
    submitting: 'กำลังส่ง...',
    inventoryControl: 'ควบคุมสต็อก',
    atelierStock: 'สต็อกของร้าน',
    searchProducts: 'ค้นหาสินค้า...',
    addProduct: 'เพิ่มสินค้า',
    product: 'สินค้า',
    category: 'หมวดหมู่',
    cost: 'ต้นทุน',
    price: 'ราคาขาย',
    stock: 'คงเหลือ',
    status: 'สถานะ',
    cinematicLogin: 'เข้าสู่ระบบ',
    atelierId: 'รหัสผู้ใช้',
    accessKey: 'รหัสผ่าน',
    enterAtelier: 'เข้าสู่ระบบ',
    language: 'ภาษา',
    theme: 'ธีม',
    dark: 'เข้ม',
    light: 'สว่าง',
    addStaff: 'เพิ่มพนักงาน',
    activeStaff: 'พนักงานที่ใช้งาน',
    members: 'คน',
    manager: 'ผู้จัดการ',
    server: 'พนักงานเสิร์ฟ',
    kitchenRole: 'ครัว',
    dashboardAccess: 'สิทธิ์แดชบอร์ด',
    dashboardAccessDesc: 'ดูสรุปยอดขาย สถิติ และประสิทธิภาพร้าน',
    kitchenOps: 'สิทธิ์งานครัว',
    kitchenOpsDesc: 'ดูและจัดการคิวออเดอร์ในครัว',
    posPermission: 'สิทธิ์ POS',
    posPermissionDesc: 'รับออเดอร์ คิดเงิน และจัดการรายการขาย',
    inventoryPermission: 'สิทธิ์สต็อก',
    inventoryPermissionDesc: 'ตรวจสต็อก ปรับจำนวน และดูต้นทุน',
    staffPermission: 'สิทธิ์จัดการพนักงาน',
    staffPermissionDesc: 'เพิ่มพนักงานและปรับสิทธิ์ตามบทบาท',
    discardChanges: 'ยกเลิกการเปลี่ยนแปลง',
    savePermissions: 'บันทึกสิทธิ์',
    permissionSaved: 'บันทึกสิทธิ์แล้ว',
    staffNamePlaceholder: 'ชื่อพนักงาน',
    deleteStaff: 'ลบพนักงาน',
    createAccount: 'สร้าง user และ password',
    username: 'ชื่อผู้ใช้',
    generatedPassword: 'รหัสผ่านที่สร้าง',
    accountCreated: 'สร้างบัญชีสำเร็จ',
    noStaffSelected: 'กรุณาเลือกพนักงานก่อน',
    loginFailed: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    loginNoAccount: 'ไม่พบบัญชีผู้ใช้',
    changePasswordFirstLogin: 'เข้าสู่ระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่าน',
    newPassword: 'รหัสผ่านใหม่',
    confirmPassword: 'ยืนยันรหัสผ่าน',
    passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
    passwordTooShort: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
    saveNewPassword: 'บันทึกรหัสผ่านใหม่',
    login: 'เข้าสู่ระบบ',
    passwordUpdatedPleaseLogin: 'เปลี่ยนรหัสผ่านเรียบร้อย กรุณาเข้าสู่ระบบอีกครั้ง',
  },
} as const;

const formatNowTime = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const toKitchenOrders = (orders: Order[]): KitchenOrder[] =>
  orders.slice(0, 9).map((order) => {
    const elapsedMinutes = order.createdAt
      ? Math.max(1, Math.floor((Date.now() - order.createdAt) / 60000))
      : 8;
    const est = 15;
    const status: KitchenOrder['status'] =
      elapsedMinutes > est + 5 ? 'overdue' : elapsedMinutes > est ? 'delayed' : 'new';

    const fallbackItems =
      order.items
        ?.split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => ({ name: part, qty: 1, station: 'HOT' as const })) ?? [];

    return {
      id: order.id.startsWith('#') ? order.id : `#${order.id}`,
      customer: order.customer,
      type: order.type === 'takeout' ? 'takeout' : 'dine-in',
      elapsed: `${elapsedMinutes}m`,
      est: `${est}m`,
      status,
      items: order.lineItems?.length ? order.lineItems : fallbackItems,
      note: order.note,
    };
  });

// --- Components ---

const Sidebar = ({
  activeView,
  setView,
  labels,
  className,
  onNavigate,
}: {
  activeView: View;
  setView: (v: View) => void;
  labels: typeof TEXT.en;
  className?: string;
  onNavigate?: () => void;
}) => {
  const menuItems = [
    { id: 'dashboard', label: labels.dashboard, icon: LayoutDashboard },
    { id: 'orders', label: labels.orders, icon: Receipt },
    { id: 'menu', label: labels.menu, icon: UtensilsCrossed },
    { id: 'kitchen', label: labels.kitchen, icon: ChefHat },
    { id: 'settings', label: labels.settings, icon: Settings },
  ];

  const LOGO_URL = "https://storage.googleapis.com/static.antigravity.dev/projects/0921448f-9bed-4b83-8a10-06ddbaef767f/logo.png";

  return (
    <aside className={cn("h-screen w-64 bg-surface-low flex flex-col py-8 z-50 border-r border-outline-variant/10", className)}>
      <div className="px-8 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-sm overflow-hidden border border-outline-variant/30">
            <img 
              src={LOGO_URL} 
              alt="Tokyo x Paris Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="font-headline font-bold text-lg text-on-surface leading-tight">Tokyo x Paris</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold font-mono">Midnight Atelier</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setView(item.id as View);
              onNavigate?.();
            }}
            className={cn(
              "w-[calc(100%-2rem)] mx-4 py-3 flex items-center px-4 rounded-sm transition-all active:scale-[0.98] font-medium text-sm",
              activeView === item.id 
                ? "bg-neon-gradient text-on-primary-fixed shadow-lg" 
                : "text-on-surface/70 hover:bg-surface-high hover:text-on-surface"
            )}
          >
            <item.icon className={cn("mr-3 w-5 h-5", activeView === item.id ? "fill-current" : "")} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-4 mt-auto">
        <button className="w-full bg-surface-high py-3 rounded-sm text-sm font-bold text-on-surface hover:bg-surface-highest transition-colors flex items-center justify-center gap-2">
          <HelpCircle className="w-4 h-4" />
          {labels.support}
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({
  title,
  subtitle,
  supabaseStatus,
  labels,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
}: {
  title: string;
  subtitle?: React.ReactNode;
  supabaseStatus: SupabaseConnectionState;
  labels: typeof TEXT.en;
  language: Language;
  onToggleLanguage: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
}) => {
  const statusLabel =
    supabaseStatus === 'connected'
      ? labels.supabaseConnected
      : supabaseStatus === 'missing_env'
        ? labels.supabaseMissing
        : labels.supabaseError;

  const statusClass =
    supabaseStatus === 'connected'
      ? 'text-secondary bg-secondary/10 border-secondary/30'
      : supabaseStatus === 'missing_env'
        ? 'text-on-surface/60 bg-surface-high border-outline-variant/20'
        : 'text-error bg-error/10 border-error/30';

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 py-4 w-full border-b border-outline-variant/10">
      <div className="flex items-center gap-3 lg:gap-6">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-on-surface/70 hover:bg-surface-high rounded-sm"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="font-headline font-black text-lg lg:text-xl text-on-surface uppercase tracking-tighter">{title}</h2>
        {subtitle && (
          <>
            <div className="h-4 w-[1px] bg-outline-variant/30 hidden lg:block"></div>
            <div className="hidden lg:flex items-center gap-2 text-primary font-bold font-headline text-sm">
              {subtitle}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <div className={cn('hidden md:block px-3 py-1 rounded-sm border text-[10px] font-mono uppercase tracking-widest', statusClass)}>
          {statusLabel}
        </div>
        <button
          onClick={onToggleLanguage}
          className="px-3 py-2 rounded-sm bg-surface-high text-on-surface text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          title={labels.language}
        >
          <Globe className="w-4 h-4" />
          {language.toUpperCase()}
        </button>
        <button
          onClick={onToggleTheme}
          className="px-3 py-2 rounded-sm bg-surface-high text-on-surface text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          title={labels.theme}
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {theme === 'dark' ? labels.dark : labels.light}
        </button>
        <button className="hidden md:block bg-neon-gradient text-on-primary-fixed px-6 py-2 rounded-sm font-headline font-bold text-sm hover:opacity-90 active:scale-95 transition-all">
          {labels.newOrder}
        </button>
        <div className="flex items-center gap-2">
          <button className="p-2 text-on-surface/60 hover:bg-surface-high rounded-sm transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-on-surface/60 hover:bg-surface-high rounded-sm transition-colors">
            <User className="w-5 h-5" />
          </button>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
          <img 
            src="https://picsum.photos/seed/manager/100/100" 
            alt="Manager" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
};

const MobileBottomNav = ({
  activeView,
  setView,
  labels,
}: {
  activeView: View;
  setView: (v: View) => void;
  labels: typeof TEXT.en;
}) => {
  const items = [
    { id: 'dashboard' as const, label: labels.dashboard, icon: LayoutDashboard },
    { id: 'orders' as const, label: labels.orders, icon: Receipt },
    { id: 'menu' as const, label: labels.menu, icon: UtensilsCrossed },
    { id: 'kitchen' as const, label: labels.kitchen, icon: ChefHat },
    { id: 'settings' as const, label: labels.settings, icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-low/95 backdrop-blur-md border-t border-outline-variant/20 px-2 py-2">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'flex flex-col items-center justify-center py-2 rounded-sm text-[10px] font-bold',
              activeView === item.id ? 'text-primary bg-primary/10' : 'text-on-surface/55',
            )}
          >
            <item.icon className="w-4 h-4 mb-1" />
            <span className="truncate max-w-[60px]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

// --- Views ---

const DashboardView = ({
  orders,
  menuItems,
  labels,
}: {
  orders: Order[];
  menuItems: MenuItem[];
  labels: typeof TEXT.en;
}) => {
  const newCount = orders.filter((order) => order.status === 'new').length;
  const preparingCount = orders.filter((order) => order.status === 'preparing').length;
  const deliveredCount = orders.filter((order) => order.status === 'delivered').length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const averageOrder = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const lowStockItems = menuItems.filter((item) => item.stock <= 10).slice(0, 2);
  const topTwoRecent = orders.slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mx-0 order-ticker py-2 px-6 flex items-center justify-between rounded-sm bg-secondary/20 text-secondary border border-secondary/30">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-sm tracking-tighter">LIVE STATUS</span>
          <div className="flex gap-4 text-xs font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary rounded-full"></span> {newCount} {labels.status}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary/50 rounded-full"></span> {preparingCount} {labels.orders}</span>
          </div>
        </div>
        <div className="font-mono text-sm font-bold">14:32:05 PM</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm">
          <TrendingUp className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">{labels.total}</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">¥{totalRevenue.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-secondary">
              <TrendingUp className="w-4 h-4" />
              <span>+12.5% from yesterday</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm">
          <ShoppingBag className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">{labels.orders}</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">{orders.length}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary">
              <Clock className="w-4 h-4" />
              <span>Avg 12 orders / hour</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm">
          <Receipt className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">Avg Order Value</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">¥{averageOrder.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-on-surface/40">
              <Info className="w-4 h-4" />
              <span>Highest: ¥8,400 (Group)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-low p-8 rounded-sm">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="font-headline text-2xl font-bold tracking-tight mb-2">Sales Velocity</h2>
              <p className="text-on-surface/60 text-sm">Performance tracking for the last 24 hours</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 text-xs font-bold bg-primary text-on-primary-fixed rounded-full">Daily</button>
              <button className="px-4 py-1.5 text-xs font-bold bg-surface-highest text-on-surface rounded-full">Weekly</button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SALES_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#e5e2e1', opacity: 0.4, fontSize: 10, fontFamily: 'Space Grotesk' }}
                />
                <Tooltip 
                  cursor={{ fill: '#2a2a2a' }}
                  contentStyle={{ backgroundColor: '#1c1b1b', border: 'none', borderRadius: '2px', color: '#e5e2e1' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {SALES_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 60000 ? '#ff525c' : '#353534'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-low p-8 rounded-sm flex flex-col">
          <h2 className="font-headline text-2xl font-bold tracking-tight mb-6">{labels.menu}</h2>
          <div className="space-y-6 flex-1">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-sm bg-surface-highest overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className={cn('text-xs font-medium', item.stock <= 3 ? 'text-error' : 'text-secondary')}>
                      {item.stock <= 3 ? `Critical: ${item.stock} left` : `Low Stock: ${item.stock} units`}
                    </p>
                  </div>
                </div>
                <button className={cn('p-2 transition-colors rounded-sm', item.stock <= 3 ? 'hover:bg-error/10 text-error' : 'hover:bg-secondary/10 text-secondary')}>
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <p className="text-xs text-on-surface/60">Inventory is healthy. No alerts right now.</p>
            )}
          </div>
          <button className="w-full mt-8 py-3 text-xs font-bold tracking-[0.2em] uppercase border border-outline-variant/30 hover:border-primary/50 transition-all text-on-surface/80">
            View Full Inventory
          </button>
        </div>
      </div>

      <div className="bg-surface-low rounded-sm overflow-hidden">
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-headline text-2xl font-bold tracking-tight">{labels.orders}</h2>
          <div className="flex gap-6 items-center">
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-error-container text-on-surface text-[10px] font-black uppercase tracking-tighter">NEW: {newCount}</span>
              <span className="px-3 py-1 bg-secondary/20 text-secondary text-[10px] font-black uppercase tracking-tighter">PREP: {preparingCount}</span>
              <span className="px-3 py-1 bg-surface-high text-on-surface text-[10px] font-black uppercase tracking-tighter">DONE: {deliveredCount}</span>
            </div>
            <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              View History
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-surface-highest/50 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/40">
            <tr>
              <th className="px-8 py-4">ID</th>
              <th className="px-8 py-4">Customer</th>
              <th className="px-8 py-4">Items</th>
              <th className="px-8 py-4">Total</th>
              <th className="px-8 py-4">Status</th>
              <th className="px-8 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/5">
            {topTwoRecent.map((order) => (
              <tr key={order.id} className="hover:bg-surface-high transition-colors">
                <td className="px-8 py-6 font-mono font-bold">{order.id}</td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-outline-variant/20 flex items-center justify-center font-bold text-xs">
                      {order.customer.split(' ').map(n => n[0]).join('')}
                    </div>
                    {order.customer}
                  </div>
                </td>
                <td className="px-8 py-6 text-on-surface/60">{order.items}</td>
                <td className="px-8 py-6 font-bold">¥{order.total.toLocaleString()}</td>
                <td className="px-8 py-6">
                  <span className={cn(
                    "flex items-center gap-2 font-bold text-xs uppercase italic",
                    order.status === 'preparing' ? "text-primary" : order.status === 'delivered' ? "text-secondary" : "text-on-surface/40"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", order.status === 'preparing' ? "bg-primary" : order.status === 'delivered' ? "bg-secondary" : "bg-on-surface/20")}></span>
                    {order.status}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <button className="bg-surface-highest px-4 py-2 text-xs font-bold hover:bg-primary hover:text-on-primary-fixed transition-colors">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const POSView = ({
  menuItems,
  onSubmitOrder,
  labels,
}: {
  menuItems: MenuItem[];
  onSubmitOrder: (payload: {
    customer: string;
    items: string;
    total: number;
    type: 'dine-in' | 'takeout';
    note?: string;
    lineItems: { name: string; qty: number; station: 'HOT' | 'COLD' }[];
  }) => Promise<void>;
  labels: typeof TEXT.en;
}) => {
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState('');
  const [orderType, setOrderType] = useState<'dine-in' | 'takeout'>('dine-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categories = ['All Items', 'Classic Ramen', 'Parisian Pastries', 'Fusion Tapas', 'Craft Cocktails', 'Midnight Specials'];

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const subtotal = cart.reduce((acc, i) => acc + (i.item.price * i.qty), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;
  const orderId = `#TXP-${Math.floor(Date.now() % 100000)}`;

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.item.id === itemId ? { ...line, qty: Math.max(0, line.qty + delta) } : line,
        )
        .filter((line) => line.qty > 0),
    );
  };

  const removeLine = (itemId: string) => {
    setCart((prev) => prev.filter((line) => line.item.id !== itemId));
  };

  const submitOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    const payload = {
      customer: customer.trim() || 'Walk-in Guest',
      items: cart.map((line) => `${line.qty}x ${line.item.name}`).join(', '),
      total: Math.round(total),
      type: orderType,
      note: note.trim() || undefined,
      lineItems: cart.map((line) => ({
        name: line.item.name,
        qty: line.qty,
        station:
          line.item.category === 'Drinks' || line.item.category === 'Pastries'
            ? 'COLD'
            : 'HOT',
      })),
    };
    await onSubmitOrder(payload);
    setCart([]);
    setCustomer('');
    setNote('');
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-4rem)] animate-in fade-in duration-500">
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 pr-4 custom-scrollbar">
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button key={cat} className={cn(
              "px-6 py-2 rounded-full text-sm whitespace-nowrap transition-colors font-bold",
              cat === 'All Items' ? "bg-primary text-on-primary-fixed" : "bg-surface-high text-on-surface/70 hover:text-on-surface"
            )}>
              {cat === 'All Items' ? labels.product : cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => addToCart(item)}
              className="group bg-surface-low rounded-xl overflow-hidden cursor-pointer hover:bg-surface-high transition-all active:scale-[0.98]"
            >
              <div className="h-48 w-full relative overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-sm border border-primary/20">
                  <span className="font-mono text-primary font-bold">¥{item.price.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-headline text-lg font-bold tracking-tight">{item.name}</h3>
                <p className="text-xs text-on-surface-variant/60 font-sans mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-full xl:w-96 bg-surface-low flex flex-col border-t xl:border-t-0 xl:border-l border-outline-variant/10 shadow-2xl">
        <div className="p-6 pb-4">
          <div className="bg-background p-1 rounded-sm flex items-center">
            <button
              onClick={() => setOrderType('dine-in')}
              className={cn(
                "flex-1 py-2 text-xs font-bold font-headline rounded-sm uppercase tracking-wider",
                orderType === 'dine-in' ? "bg-primary text-on-primary-fixed" : "text-on-surface/40 hover:text-on-surface",
              )}
            >
              {labels.inPerson}
            </button>
            <button
              onClick={() => setOrderType('takeout')}
              className={cn(
                "flex-1 py-2 text-xs font-bold font-headline rounded-sm uppercase tracking-wider",
                orderType === 'takeout' ? "bg-primary text-on-primary-fixed" : "text-on-surface/40 hover:text-on-surface",
              )}
            >
              {labels.takeout}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="font-headline font-bold text-xl uppercase tracking-tighter">{labels.currentOrder}</h2>
            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5">{orderId}</span>
          </div>
          <div className="mt-4 space-y-2">
            <input
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder={labels.customerName}
              className="w-full bg-surface-high px-3 py-2 rounded-sm text-sm text-on-surface placeholder:text-on-surface/40 outline-none"
            />
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={labels.orderNote}
              className="w-full bg-surface-high px-3 py-2 rounded-sm text-sm text-on-surface placeholder:text-on-surface/40 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-4 custom-scrollbar">
          {cart.map((i, idx) => (
            <div key={idx} className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-sm overflow-hidden flex-shrink-0">
                <img src={i.item.image} alt={i.item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-bold font-headline leading-tight">{i.item.name}</span>
                  <span className="text-sm font-mono font-bold">¥{(i.item.price * i.qty).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(i.item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-surface-high rounded-sm text-on-surface/60 hover:text-primary active:scale-90"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono">{i.qty}</span>
                    <button
                      onClick={() => changeQty(i.item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center bg-surface-high rounded-sm text-on-surface/60 hover:text-primary active:scale-90"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeLine(i.item.id)}
                    className="text-xs text-error/60 hover:text-error transition-colors uppercase font-mono"
                  >
                    {labels.remove}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
              <ShoppingBag className="w-12 h-12 mb-4" />
              <p className="font-headline font-bold uppercase tracking-widest text-xs">{labels.cartEmpty}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-background border-t border-outline-variant/10">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-mono text-on-surface/60">
              <span>{labels.subtotal}</span>
              <span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs font-mono text-on-surface/60">
              <span>{labels.tax} (10%)</span>
              <span>¥{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-headline font-black pt-2 border-t border-outline-variant/10 text-primary">
              <span>{labels.total}</span>
              <span>¥{total.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={submitOrder}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full py-5 bg-neon-gradient disabled:opacity-40 text-on-primary-fixed font-headline font-extrabold text-lg uppercase tracking-widest rounded-sm shadow-xl hover:shadow-primary/20 active:scale-95 transition-all duration-200"
          >
            {isSubmitting ? labels.submitting : labels.submitOrder}
          </button>
        </div>
      </aside>
    </div>
  );
};

const KitchenView = ({ kitchenOrders }: { kitchenOrders: KitchenOrder[] }) => {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {kitchenOrders.map((order) => (
        <div key={order.id} className={cn(
          "flex flex-col bg-surface-low relative group border-t-4",
          order.status === 'overdue' ? "border-error" : order.status === 'delayed' ? "border-secondary" : "border-outline-variant"
        )}>
          <div className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={cn(
                  "font-mono text-[10px] uppercase font-bold tracking-[0.2em]",
                  order.status === 'overdue' ? "text-error" : order.status === 'delayed' ? "text-secondary" : "text-on-surface/40"
                )}>
                  {order.status === 'overdue' ? 'Priority Overdue' : order.status === 'delayed' ? 'Delayed Warning' : 'New Order'}
                </span>
                <h3 className="font-headline text-2xl font-bold mt-1">{order.id}</h3>
                <p className="text-xs text-on-surface/40">Order for: {order.customer} ({order.type})</p>
              </div>
              <div className={cn(
                "px-3 py-2 flex flex-col items-end",
                order.status === 'overdue' ? "bg-error/10" : order.status === 'delayed' ? "bg-secondary/10" : "bg-surface-high"
              )}>
                <span className={cn("font-mono text-xs font-bold", order.status === 'overdue' ? "text-error" : order.status === 'delayed' ? "text-secondary" : "text-on-surface")}>
                  {order.elapsed} elapsed
                </span>
                {order.est && <span className="text-[10px] opacity-60 font-medium">EST: {order.est}</span>}
              </div>
            </div>

            <div className="space-y-4 flex-grow">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={cn("font-mono text-lg font-bold", order.status === 'overdue' ? "text-error" : order.status === 'delayed' ? "text-secondary" : "text-primary")}>
                      {item.qty}x
                    </span>
                    <span className="font-bold text-base">{item.name}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-surface-high px-2 py-1 uppercase font-bold text-on-surface/60">{item.station}</span>
                </div>
              ))}
              {order.note && (
                <div className="mt-4 p-3 bg-background border-l-2 border-primary italic text-xs text-on-surface/70">
                  "{order.note}"
                </div>
              )}
            </div>

            <div className="mt-8">
              <button className={cn(
                "w-full py-4 font-headline font-bold text-sm tracking-widest uppercase active:scale-95 transition-all",
                order.status === 'overdue' ? "bg-neon-gradient text-on-primary-fixed" : "bg-surface-high text-on-surface"
              )}>
                {order.status === 'overdue' ? 'Complete Order' : 'Ready for Pickup'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const MenuView = ({
  menuItems,
  onChangeStock,
  labels,
}: {
  menuItems: MenuItem[];
  onChangeStock: (itemId: string, nextStock: number) => void;
  labels: typeof TEXT.en;
}) => {
  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <p className="font-mono text-primary text-sm font-bold uppercase tracking-[0.2em] mb-2">{labels.inventoryControl}</p>
          <h3 className="font-headline font-black text-4xl text-on-surface leading-none uppercase">{labels.atelierStock}</h3>
        </div>
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 w-4 h-4" />
            <input 
              className="w-full bg-surface-low border-none focus:ring-1 focus:ring-primary text-on-surface pl-10 pr-4 py-3 text-xs font-mono rounded-sm tracking-widest uppercase transition-all" 
              placeholder={labels.searchProducts}
              type="text"
            />
          </div>
          <button className="bg-neon-gradient text-on-primary-fixed font-headline font-bold text-sm uppercase px-8 py-3 rounded-sm shadow-xl active:scale-95 transition-all">
            {labels.addProduct}
          </button>
        </div>
      </div>

      <div className="bg-surface-low p-1 rounded-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-high">
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60">{labels.product}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.category}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">{labels.cost}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">{labels.price}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.stock}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {menuItems.map((item) => (
              <tr key={item.id} className="hover:bg-surface-high transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-background rounded-sm overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="font-headline font-bold text-sm">{item.name}</p>
                      <p className="text-[10px] text-on-surface/40 uppercase tracking-widest font-mono">SKU: {item.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-widest bg-surface-highest px-3 py-1 rounded-full text-on-surface/60">{item.category}</span>
                </td>
                <td className="px-6 py-5 text-right font-mono text-sm text-on-surface/60">¥{item.cost.toLocaleString()}</td>
                <td className="px-6 py-5 text-right font-mono text-sm font-bold text-secondary">¥{item.price.toLocaleString()}</td>
                <td className="px-6 py-5 text-center font-mono text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onChangeStock(item.id, Math.max(0, item.stock - 1))}
                      className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                    >
                      -
                    </button>
                    <span>{item.stock}</span>
                    <button
                      onClick={() => onChangeStock(item.id, item.stock + 1)}
                      className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <div className={cn(
                      "w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors",
                      item.stock > 10 ? "bg-primary/20" : "bg-error/20"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all",
                        item.stock > 10 ? "right-1 bg-primary" : "left-1 bg-error"
                      )}></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsView = ({
  labels,
  staffMembers,
  permissionMatrix,
  onAddStaff,
  onChangeStaffRole,
  onSavePermissions,
  onDeleteStaff,
  onCreateStaffAccount,
  accountMap,
}: {
  labels: typeof TEXT.en;
  staffMembers: StaffMember[];
  permissionMatrix: PermissionMatrix;
  onAddStaff: (payload: { name: string; role: StaffRole }) => void;
  onChangeStaffRole: (staffId: string, role: StaffRole) => void;
  onSavePermissions: (matrix: PermissionMatrix) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onCreateStaffAccount: (payload: { staffId: string; username: string }) => Promise<string>;
  accountMap: Map<string, string>;
}) => {
  const roleLabels: Record<StaffRole, string> = {
    Manager: labels.manager,
    Server: labels.server,
    Kitchen: labels.kitchenRole,
  };

  const [selectedStaffId, setSelectedStaffId] = useState(staffMembers[0]?.id ?? '');
  const [activeRole, setActiveRole] = useState<StaffRole>('Manager');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('Server');
  const [draftPermissions, setDraftPermissions] = useState<PermissionMatrix>(permissionMatrix);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');

  useEffect(() => {
    setDraftPermissions(permissionMatrix);
  }, [permissionMatrix]);

  useEffect(() => {
    if (!selectedStaffId && staffMembers.length > 0) {
      setSelectedStaffId(staffMembers[0].id);
    }
  }, [selectedStaffId, staffMembers]);

  const selectedStaff = staffMembers.find((staff) => staff.id === selectedStaffId);
  const selectedUsername = selectedStaff ? accountMap.get(selectedStaff.id) || '' : '';

  const permissionCards: Array<{
    key: keyof RolePermission;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'dashboard', title: labels.dashboardAccess, desc: labels.dashboardAccessDesc, icon: LayoutDashboard },
    { key: 'kitchen', title: labels.kitchenOps, desc: labels.kitchenOpsDesc, icon: ChefHat },
    { key: 'pos', title: labels.posPermission, desc: labels.posPermissionDesc, icon: Receipt },
    { key: 'inventory', title: labels.inventoryPermission, desc: labels.inventoryPermissionDesc, icon: ShoppingBag },
    { key: 'staff', title: labels.staffPermission, desc: labels.staffPermissionDesc, icon: Settings },
  ];

  const togglePermission = (role: StaffRole, permissionKey: keyof RolePermission) => {
    setDraftPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionKey]: !prev[role][permissionKey],
      },
    }));
  };

  const handleDiscard = () => {
    setDraftPermissions(permissionMatrix);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSavePermissions(draftPermissions);
    setIsSaving(false);
  };

  const handleAddStaff = () => {
    const value = newStaffName.trim();
    if (!value) return;
    onAddStaff({ name: value, role: newStaffRole });
    setNewStaffName('');
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    await onDeleteStaff(selectedStaff.id);
    setSelectedStaffId('');
  };

  const handleCreateAccount = async () => {
    if (!selectedStaff) {
      setAccountMessage(labels.noStaffSelected);
      return;
    }
    const username = usernameInput.trim() || selectedStaff.name.toLowerCase().replace(/\s+/g, '.');
    const password = await onCreateStaffAccount({ staffId: selectedStaff.id, username });
    setGeneratedPassword(password);
    setAccountMessage(labels.accountCreated);
    setUsernameInput(username);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 border-b border-outline-variant/10 pb-8">
        <div className="space-y-1">
          <p className="font-mono text-secondary text-xs uppercase tracking-widest">{labels.settingsTitle}</p>
          <h3 className="font-headline text-3xl lg:text-4xl font-extrabold tracking-tighter">{labels.settings}</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <input
            value={newStaffName}
            onChange={(event) => setNewStaffName(event.target.value)}
            placeholder={labels.staffNamePlaceholder}
            className="bg-surface-high text-on-surface px-3 py-3 rounded-sm outline-none min-w-48"
          />
          <select
            value={newStaffRole}
            onChange={(event) => setNewStaffRole(event.target.value as StaffRole)}
            className="bg-surface-high text-on-surface px-3 py-3 rounded-sm outline-none"
          >
            {(['Manager', 'Server', 'Kitchen'] as StaffRole[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddStaff}
            className="bg-neon-gradient text-on-primary-fixed px-6 py-3 rounded-sm font-headline text-sm font-bold active:scale-95 transition-all shadow-xl flex items-center justify-center"
          >
            <Plus className="mr-2 w-5 h-5" />
            {labels.addStaff}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 bg-surface-low p-6 rounded-sm space-y-6 border border-outline-variant/10">
          <div className="flex justify-between items-center">
            <h4 className="font-headline text-lg font-bold">{labels.activeStaff}</h4>
            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
              {staffMembers.length} {labels.members}
            </span>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {staffMembers.map((staff) => (
              <button
                key={staff.id}
                onClick={() => setSelectedStaffId(staff.id)}
                className={cn(
                  "w-full text-left group flex items-center p-3 rounded-sm bg-surface-high transition-all hover:translate-x-1 cursor-pointer border",
                  selectedStaffId === staff.id ? "border-primary/40" : "border-transparent",
                )}
              >
                <img
                  src={staff.image}
                  alt={staff.name}
                  className="w-12 h-12 rounded-sm object-cover mr-4 grayscale group-hover:grayscale-0 transition-all"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <p className="font-bold text-on-surface">{staff.name}</p>
                  <p className="font-mono text-xs text-on-surface/40">{roleLabels[staff.role]}</p>
                </div>
                <ArrowRight className={cn("w-4 h-4", selectedStaffId === staff.id ? "text-primary" : "text-on-surface/20")} />
              </button>
            ))}
          </div>

          {selectedStaff && (
            <div className="pt-4 border-t border-outline-variant/10">
              <p className="text-xs text-on-surface/50 mb-2">{selectedStaff.name}</p>
              <div className="grid grid-cols-3 gap-2">
                {(['Manager', 'Server', 'Kitchen'] as StaffRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => onChangeStaffRole(selectedStaff.id, role)}
                    className={cn(
                      "text-xs px-2 py-2 rounded-sm font-bold",
                      selectedStaff.role === role ? "bg-primary text-on-primary-fixed" : "bg-surface-highest text-on-surface/70",
                    )}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs text-on-surface/50">
                  {labels.username}: <span className="font-mono text-on-surface">{selectedUsername || '-'}</span>
                </p>
                <input
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                  placeholder={labels.username}
                  className="w-full bg-surface-high text-on-surface px-3 py-2 rounded-sm outline-none"
                />
                <button
                  onClick={handleCreateAccount}
                  className="w-full bg-neon-gradient text-on-primary-fixed px-4 py-2 rounded-sm text-sm font-bold"
                >
                  {labels.createAccount}
                </button>
                {generatedPassword && (
                  <div className="text-xs bg-background/60 border border-outline-variant/20 rounded-sm p-2">
                    <span className="text-on-surface/60">{labels.generatedPassword}: </span>
                    <span className="font-mono text-secondary">{generatedPassword}</span>
                  </div>
                )}
                {accountMessage && <p className="text-xs text-secondary">{accountMessage}</p>}
                <button
                  onClick={handleDelete}
                  className="w-full bg-error/20 text-error px-4 py-2 rounded-sm text-sm font-bold"
                >
                  {labels.deleteStaff}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="lg:col-span-8 space-y-8">
          <div className="flex space-x-1 bg-background p-1 rounded-sm border border-outline-variant/10">
            {(['Manager', 'Server', 'Kitchen'] as StaffRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={cn(
                  "flex-1 font-headline text-sm font-bold py-3 transition-all rounded-sm",
                  activeRole === role ? "bg-surface-high text-primary" : "text-on-surface/50 hover:text-on-surface",
                )}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {permissionCards.map((permission) => (
              <div key={permission.key} className="bg-surface-low p-6 rounded-sm relative overflow-hidden group border border-outline-variant/10">
                <permission.icon className="absolute top-0 right-0 p-4 w-32 h-32 text-on-surface opacity-5 group-hover:opacity-10 transition-opacity" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-2">
                    <h5 className="font-headline font-bold text-xl">{permission.title}</h5>
                    <p className="text-sm text-on-surface/60">{permission.desc}</p>
                  </div>
                  <div className="flex items-center">
                    <input
                      checked={draftPermissions[activeRole][permission.key]}
                      onChange={() => togglePermission(activeRole, permission.key)}
                      className="w-6 h-6 rounded-sm bg-background border-none text-primary focus:ring-primary transition-all"
                      type="checkbox"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 space-x-4">
            <button
              onClick={handleDiscard}
              className="px-6 py-3 font-headline text-sm font-bold text-on-surface/50 hover:text-on-surface transition-colors"
            >
              {labels.discardChanges}
            </button>
            <button
              onClick={handleSave}
              className="bg-neon-gradient text-on-primary-fixed px-10 py-3 rounded-sm font-headline text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? `${labels.savePermissions}...` : labels.savePermissions}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const LoginView = ({
  onLogin,
  onResetFirstLoginPassword,
  labels,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
}: {
  onLogin: (payload: { username: string; password: string }) => Promise<{
    ok: boolean;
    error?: string;
    requirePasswordChange?: boolean;
    staffId?: string;
    username?: string;
  }>;
  onResetFirstLoginPassword: (payload: { staffId: string; newPassword: string }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  labels: typeof TEXT.en;
  language: Language;
  onToggleLanguage: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) => {
  const LOGO_URL = "https://storage.googleapis.com/static.antigravity.dev/projects/0921448f-9bed-4b83-8a10-06ddbaef767f/logo.png";
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingStaffId, setPendingStaffId] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  const handleSubmitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError('');
    const result = await onLogin({
      username: username.trim(),
      password,
    });
    if (result.ok) {
      setIsSubmitting(false);
      return;
    }
    if (result.requirePasswordChange && result.staffId) {
      setPendingStaffId(result.staffId);
      setUsername(result.username ?? username.trim());
      setMode('reset');
      setPassword('');
      setAuthError(labels.changePasswordFirstLogin);
      setIsSubmitting(false);
      return;
    }
    setAuthError(result.error ?? labels.loginFailed);
    setIsSubmitting(false);
  };

  const handleSubmitPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    if (newPassword.length < 8) {
      setAuthError(labels.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError(labels.passwordMismatch);
      return;
    }
    setIsSubmitting(true);
    const result = await onResetFirstLoginPassword({
      staffId: pendingStaffId,
      newPassword,
    });
    if (!result.ok) {
      setAuthError(result.error ?? labels.loginFailed);
      setIsSubmitting(false);
      return;
    }
    setMode('login');
    setAuthError(labels.passwordUpdatedPleaseLogin);
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');
    setIsSubmitting(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-black">
      {/* Background Cinematic Elements */}
      <div className="absolute inset-0 z-0">
        <img 
          src={LOGO_URL} 
          alt="Tokyo x Paris Background" 
          className="w-full h-full object-cover opacity-40 scale-110 blur-[2px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_90%)]"></div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={onToggleLanguage}
          className="px-3 py-2 rounded-sm bg-black/40 text-on-surface text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-outline-variant/20"
        >
          <Globe className="w-4 h-4" />
          {language.toUpperCase()}
        </button>
        <button
          onClick={onToggleTheme}
          className="px-3 py-2 rounded-sm bg-black/40 text-on-surface text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-outline-variant/20"
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {theme === 'dark' ? labels.dark : labels.light}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-panel p-10 rounded-sm border border-primary/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col gap-8">
          <div className="text-center space-y-6">
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <h1 className="font-headline text-6xl font-black tracking-tighter leading-none flex flex-col italic">
                <span className="text-primary drop-shadow-[0_0_15px_rgba(255,82,92,0.8)]">TOKYO</span>
                <span className="text-secondary -mt-2 ml-8 drop-shadow-[0_0_10px_rgba(233,195,73,0.5)]">x PARIS</span>
              </h1>
              <div className="mt-4 flex items-center gap-4 w-full">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-secondary/50"></div>
                <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-secondary font-bold">{labels.cinematicLogin}</p>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-secondary/50"></div>
              </div>
            </motion.div>
          </div>

          {mode === 'login' ? (
            <form className="space-y-6" onSubmit={handleSubmitLogin}>
              <div className="space-y-2">
                <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 block ml-1 font-bold">{labels.username}</label>
                <div className="relative group">
                  <input
                    className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                    placeholder={labels.username}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    type="text"
                  />
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline px-1">
                  <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 font-bold">{labels.accessKey}</label>
                </div>
                <div className="relative group">
                  <input
                    className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                  />
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
                </div>
              </div>

              {authError && (
                <div className="text-xs text-secondary border border-secondary/30 bg-secondary/10 rounded-sm px-3 py-2">
                  {authError}
                </div>
              )}

              <button
                disabled={isSubmitting}
                className="group relative w-full overflow-hidden bg-black border border-primary/30 py-5 rounded-sm active:scale-[0.98] transition-all duration-300 disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-neon-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative z-10 font-headline font-black text-on-surface group-hover:text-on-primary-fixed uppercase tracking-[0.3em] text-sm transition-colors duration-500">
                  {labels.login}
                </span>
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmitPasswordReset}>
              <div className="space-y-2">
                <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 block ml-1 font-bold">{labels.changePasswordFirstLogin}</label>
                <div className="relative group">
                  <input
                    className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                    placeholder={labels.newPassword}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                  />
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <input
                    className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                    placeholder={labels.confirmPassword}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                  />
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
                </div>
              </div>

              {authError && (
                <div className="text-xs text-secondary border border-secondary/30 bg-secondary/10 rounded-sm px-3 py-2">
                  {authError}
                </div>
              )}

              <button
                disabled={isSubmitting}
                className="group relative w-full overflow-hidden bg-black border border-primary/30 py-5 rounded-sm active:scale-[0.98] transition-all duration-300 disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-neon-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative z-10 font-headline font-black text-on-surface group-hover:text-on-primary-fixed uppercase tracking-[0.2em] text-sm transition-colors duration-500">
                  {labels.saveNewPassword}
                </span>
              </button>
            </form>
          )}

          <div className="text-center">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-on-surface/30">
              © 2026 Midnight Atelier • Shibuya x Paris
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [language, setLanguage] = useState<Language>('th');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionState>('missing_env');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [orders, setOrders] = useState<Order[]>(RECENT_ORDERS);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(STAFF_MEMBERS_MOCK);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSION_MATRIX);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const status = await checkSupabaseConnection();
      if (isMounted) {
        setSupabaseStatus(status);
      }
      if (status !== 'connected') {
        console.warn(`[supabase] status: ${status}`);
      } else {
        console.info('[supabase] connected');
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadRemoteData = async () => {
    setIsRemoteSyncing(true);
    const [remoteMenu, remoteOrders, remoteStaff, remotePermissions, remoteAccounts] = await Promise.all([
      fetchMenuItems(),
      fetchOrders(),
      fetchStaffMembers(),
      fetchRolePermissions(),
      fetchStaffAccounts(),
    ]);
    if (remoteMenu && remoteMenu.length > 0) {
      setMenuItems(remoteMenu);
    }
    if (remoteOrders && remoteOrders.length > 0) {
      setOrders(remoteOrders);
    }
    if (remoteStaff && remoteStaff.length > 0) {
      setStaffMembers(
        remoteStaff.map((staff) => ({
          id: staff.id,
          name: staff.name,
          role: staff.role,
          image: staff.image || `https://picsum.photos/seed/${staff.id}/100/100`,
          active: staff.active,
        })),
      );
    }
    if (remotePermissions && remotePermissions.length > 0) {
      const nextMatrix: PermissionMatrix = { ...DEFAULT_PERMISSION_MATRIX };
      for (const item of remotePermissions) {
        nextMatrix[item.role] = {
          dashboard: item.dashboard,
          kitchen: item.kitchen,
          pos: item.pos,
          inventory: item.inventory,
          staff: item.staff,
        };
      }
      setPermissionMatrix(nextMatrix);
    }
    if (remoteAccounts && remoteAccounts.length > 0) {
      setStaffAccounts(
        remoteAccounts.map((account) => ({
          staffId: account.staffId,
          username: account.username,
          passwordHash: account.passwordHash,
          mustChangePassword: account.mustChangePassword,
          active: account.active,
        })),
      );
    }
    setIsRemoteSyncing(false);
  };

  useEffect(() => {
    if (supabaseStatus !== 'connected') return;
    if (!isLoggedIn) {
      Promise.all([fetchStaffMembers(), fetchStaffAccounts()]).then(([remoteStaff, remoteAccounts]) => {
        if (remoteStaff && remoteStaff.length > 0) {
          setStaffMembers(
            remoteStaff.map((staff) => ({
              id: staff.id,
              name: staff.name,
              role: staff.role,
              image: staff.image || `https://picsum.photos/seed/${staff.id}/100/100`,
              active: staff.active,
            })),
          );
        }
        if (remoteAccounts && remoteAccounts.length > 0) {
          setStaffAccounts(
            remoteAccounts.map((account) => ({
              staffId: account.staffId,
              username: account.username,
              passwordHash: account.passwordHash,
              mustChangePassword: account.mustChangePassword,
              active: account.active,
            })),
          );
        }
      });
      return;
    }

    loadRemoteData();
    const unsubscribe = subscribeToOpsRealtime({
      onMenuItemsChange: () => {
        fetchMenuItems().then((remoteMenu) => {
          if (remoteMenu && remoteMenu.length > 0) setMenuItems(remoteMenu);
        });
      },
      onOrdersChange: () => {
        fetchOrders().then((remoteOrders) => {
          if (remoteOrders && remoteOrders.length > 0) setOrders(remoteOrders);
        });
      },
      onStaffChange: () => {
        fetchStaffMembers().then((remoteStaff) => {
          if (!remoteStaff || remoteStaff.length === 0) return;
          setStaffMembers(
            remoteStaff.map((staff) => ({
              id: staff.id,
              name: staff.name,
              role: staff.role,
              image: staff.image || `https://picsum.photos/seed/${staff.id}/100/100`,
              active: staff.active,
            })),
          );
        });
      },
      onPermissionsChange: () => {
        fetchRolePermissions().then((remotePermissions) => {
          if (!remotePermissions || remotePermissions.length === 0) return;
          setPermissionMatrix((prev) => {
            const next: PermissionMatrix = { ...prev };
            for (const item of remotePermissions) {
              next[item.role] = {
                dashboard: item.dashboard,
                kitchen: item.kitchen,
                pos: item.pos,
                inventory: item.inventory,
                staff: item.staff,
              };
            }
            return next;
          });
        });
      },
      onStaffAccountsChange: () => {
        fetchStaffAccounts().then((remoteAccounts) => {
          if (!remoteAccounts) return;
          setStaffAccounts(
            remoteAccounts.map((account) => ({
              staffId: account.staffId,
              username: account.username,
              passwordHash: account.passwordHash,
              mustChangePassword: account.mustChangePassword,
              active: account.active,
            })),
          );
        });
      },
    });
    return () => {
      unsubscribe();
    };
  }, [isLoggedIn, supabaseStatus]);

  const handleChangeStock = (itemId: string, nextStock: number) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, stock: nextStock } : item)),
    );
    if (supabaseStatus === 'connected') {
      updateMenuItemStock(itemId, nextStock).catch(() => {
        console.warn('[supabase] stock update failed');
      });
    }
  };

  const handleSubmitOrder = async (payload: {
    customer: string;
    items: string;
    total: number;
    type: 'dine-in' | 'takeout';
    note?: string;
    lineItems: { name: string; qty: number; station: 'HOT' | 'COLD' }[];
  }) => {
    const localOrder: Order = {
      id: `TXP-${Date.now().toString().slice(-6)}`,
      customer: payload.customer,
      items: payload.items,
      total: payload.total,
      status: 'new',
      time: formatNowTime(),
      type: payload.type,
      note: payload.note,
      createdAt: Date.now(),
      lineItems: payload.lineItems,
    };
    setOrders((prev) => [localOrder, ...prev].slice(0, 50));

    if (supabaseStatus === 'connected') {
      const remoteOrder = await insertOrder(localOrder);
      if (remoteOrder) {
        setOrders((prev) => [remoteOrder, ...prev.filter((order) => order.id !== localOrder.id)].slice(0, 50));
      }
    }
  };

  const kitchenOrders = useMemo(() => toKitchenOrders(orders), [orders]);
  const labels = TEXT[language];
  const staffAccountMap = useMemo(
    () => new Map(staffAccounts.map((account) => [account.staffId, account.username] as const)),
    [staffAccounts],
  );

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const length = 12;
    let out = '';
    for (let index = 0; index < length; index += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  };

  const hashPassword = async (input: string) => {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleAddStaff = (payload: { name: string; role: StaffRole }) => {
    const staffId = `s-${Date.now().toString(36)}`;
    const newStaff: StaffMember = {
      id: staffId,
      name: payload.name,
      role: payload.role,
      image: `https://picsum.photos/seed/${staffId}/100/100`,
      active: true,
    };
    setStaffMembers((prev) => [newStaff, ...prev]);
    if (supabaseStatus === 'connected') {
      upsertStaffMember({
        id: newStaff.id,
        name: newStaff.name,
        role: newStaff.role,
        image: newStaff.image,
        active: newStaff.active,
      }).catch(() => {
        console.warn('[supabase] add staff failed');
      });
    }
  };

  const handleChangeStaffRole = (staffId: string, role: StaffRole) => {
    let updatedStaff: StaffMember | null = null;
    setStaffMembers((prev) =>
      prev.map((staff) => {
        if (staff.id !== staffId) return staff;
        updatedStaff = { ...staff, role };
        return updatedStaff;
      }),
    );
    if (supabaseStatus === 'connected' && updatedStaff) {
      upsertStaffMember({
        id: updatedStaff.id,
        name: updatedStaff.name,
        role,
        image: updatedStaff.image,
        active: updatedStaff.active,
      }).catch(() => {
        console.warn('[supabase] change role failed');
      });
    }
  };

  const handleSavePermissions = async (nextMatrix: PermissionMatrix) => {
    setPermissionMatrix(nextMatrix);
    if (supabaseStatus !== 'connected') return;
    const roles: StaffRole[] = ['Manager', 'Server', 'Kitchen'];
    await Promise.all(
      roles.map((role) =>
        upsertRolePermission({
          role,
          ...nextMatrix[role],
        }),
      ),
    );
  };

  const handleDeleteStaff = async (staffId: string) => {
    setStaffMembers((prev) => prev.filter((staff) => staff.id !== staffId));
    setStaffAccounts((prev) => prev.filter((account) => account.staffId !== staffId));
    if (supabaseStatus === 'connected') {
      await deleteStaffMember(staffId);
    }
  };

  const handleCreateStaffAccount = async (payload: { staffId: string; username: string }) => {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    setStaffAccounts((prev) => {
      const next = prev.filter((account) => account.staffId !== payload.staffId);
      return [
        ...next,
        {
          staffId: payload.staffId,
          username: payload.username,
          passwordHash,
          mustChangePassword: true,
          active: true,
        },
      ];
    });
    if (supabaseStatus === 'connected') {
      await upsertStaffAccount({
        staffId: payload.staffId,
        username: payload.username,
        passwordHash,
        active: true,
        mustChangePassword: true,
      });
    }
    return password;
  };

  const handleLogin = async (payload: { username: string; password: string }) => {
    const username = payload.username.trim().toLowerCase();
    if (!username || !payload.password) {
      return { ok: false, error: labels.loginFailed };
    }

    if (staffAccounts.length === 0 && supabaseStatus !== 'connected') {
      setIsLoggedIn(true);
      setView('dashboard');
      setMobileMenuOpen(false);
      return { ok: true };
    }
    if (staffAccounts.length === 0 && supabaseStatus === 'connected') {
      return { ok: false, error: labels.loginNoAccount };
    }

    const account = staffAccounts.find((item) => item.username.toLowerCase() === username);
    if (!account || !account.active) {
      return { ok: false, error: labels.loginNoAccount };
    }
    const matchedStaff = staffMembers.find((staff) => staff.id === account.staffId);
    if (!matchedStaff) {
      return { ok: false, error: labels.loginNoAccount };
    }

    const incomingHash = await hashPassword(payload.password);
    if (incomingHash !== account.passwordHash) {
      return { ok: false, error: labels.loginFailed };
    }

    if (account.mustChangePassword) {
      return {
        ok: false,
        requirePasswordChange: true,
        staffId: account.staffId,
        username: account.username,
      };
    }

    setIsLoggedIn(true);
    setView('dashboard');
    setMobileMenuOpen(false);
    return { ok: true };
  };

  const handleResetFirstLoginPassword = async (payload: {
    staffId: string;
    newPassword: string;
  }) => {
    if (!payload.staffId) {
      return { ok: false, error: labels.loginNoAccount };
    }
    if (payload.newPassword.length < 8) {
      return { ok: false, error: labels.passwordTooShort };
    }

    const nextHash = await hashPassword(payload.newPassword);

    setStaffAccounts((prev) =>
      prev.map((item) =>
        item.staffId === payload.staffId
          ? { ...item, passwordHash: nextHash, mustChangePassword: false }
          : item,
      ),
    );

    if (supabaseStatus === 'connected') {
      const updated = await updateStaffPassword({
        staffId: payload.staffId,
        passwordHash: nextHash,
      });
      if (!updated) {
        return { ok: false, error: labels.loginFailed };
      }
    }

    return { ok: true };
  };

  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={handleLogin}
        onResetFirstLoginPassword={handleResetFirstLoginPassword}
        labels={labels}
        language={language}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'en' ? 'th' : 'en'))}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <DashboardView orders={orders} menuItems={menuItems} labels={labels} />;
      case 'orders': return <POSView menuItems={menuItems} onSubmitOrder={handleSubmitOrder} labels={labels} />;
      case 'menu': return <MenuView menuItems={menuItems} onChangeStock={handleChangeStock} labels={labels} />;
      case 'kitchen': return <KitchenView kitchenOrders={kitchenOrders} />;
      case 'settings':
        return (
          <SettingsView
            labels={labels}
            staffMembers={staffMembers}
            permissionMatrix={permissionMatrix}
            onAddStaff={handleAddStaff}
            onChangeStaffRole={handleChangeStaffRole}
            onSavePermissions={handleSavePermissions}
            onDeleteStaff={handleDeleteStaff}
            onCreateStaffAccount={handleCreateStaffAccount}
            accountMap={staffAccountMap}
          />
        );
      default: return <DashboardView orders={orders} menuItems={menuItems} labels={labels} />;
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'dashboard': return labels.adminDashboard;
      case 'orders': return labels.posTerminal;
      case 'menu': return labels.menuManagement;
      case 'kitchen': return labels.kitchenBoard;
      case 'settings': return labels.settingsTitle;
      default: return 'Tokyo x Paris';
    }
  };

  const getSubtitle = () => {
    if (view === 'dashboard' || view === 'orders') {
      return (
        <>
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          {isRemoteSyncing ? labels.syncing : labels.routeLabel}
        </>
      );
    }
    if (view === 'kitchen') {
      return (
        <div className="flex items-center gap-6 text-xs text-secondary font-bold">
          <span>{labels.avgPrep}: 14m 20s</span>
          <span>{kitchenOrders.length} {labels.activeOrders}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      <Sidebar activeView={view} setView={setView} labels={labels} className="fixed left-0 top-0 hidden lg:flex" />
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]">
          <div className="w-72 h-full">
            <Sidebar
              activeView={view}
              setView={setView}
              labels={labels}
              className="shadow-2xl"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-sm bg-black/60 text-on-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      
      <main className="lg:ml-64 flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">
        <TopBar
          title={getTitle()}
          subtitle={getSubtitle()}
          supabaseStatus={supabaseStatus}
          labels={labels}
          language={language}
          onToggleLanguage={() => setLanguage((prev) => (prev === 'en' ? 'th' : 'en'))}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        
        <div className="flex-1 p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Background Decoration */}
      <div className="fixed bottom-0 right-0 w-96 h-96 opacity-[0.03] pointer-events-none select-none -mb-24 -mr-24 overflow-hidden z-0">
        <svg className="text-surface-highest" fill="currentColor" viewBox="0 0 100 100">
          <path d="M50 0 L100 100 L0 100 Z"></path>
        </svg>
      </div>
      <MobileBottomNav activeView={view} setView={setView} labels={labels} />
    </div>
  );
}
