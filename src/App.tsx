import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  Volume2,
  VolumeX,
  Camera,
  Eye,
  EyeOff,
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
  deleteIngredient,
  fetchIngredients,
  fetchMenuItems,
  fetchOrders,
  fetchStaffAccounts,
  fetchRolePermissions,
  fetchStaffMembers,
  insertIngredient,
  insertMenuItem,
  insertOrder,
  subscribeToOpsRealtime,
  deleteMenuItem,
  updateMenuItemStock,
  updateStaffPassword,
  uploadOpsImage,
  upsertStaffAccount,
  upsertRolePermission,
  upsertStaffMember,
} from './lib/supabase-data';

// --- Types ---

type View = 'dashboard' | 'orders' | 'inventoryIngredients' | 'inventoryMenu' | 'kitchen' | 'settings' | 'login';
type Language = 'en' | 'th';
type ThemeMode = 'dark' | 'light';
type CurrencyCode = 'THB' | 'JPY' | 'USD' | 'EUR';
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
  active: boolean;
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
  dbStatus: Order['status'];
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

interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  prevStock: number;
  nextStock: number;
  delta: number;
  reason: string;
  timestamp: number;
}

interface IngredientItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  stock: number;
  image: string;
}

interface MenuRecipeLine {
  ingredientId: string;
  quantity: number;
}

// --- Mock Data ---

const MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Shibuya Shoyu',
    category: 'อาหาร',
    price: 1200,
    cost: 450,
    stock: 45,
    sku: 'RAM-001',
    image: 'https://picsum.photos/seed/ramen/400/300',
    description: '12-hour aged chicken & soy broth, handmade noodles',
    active: true,
  },
  {
    id: '2',
    name: 'Truffle Croissant',
    category: 'อาหาร',
    price: 850,
    cost: 320,
    stock: 12,
    sku: 'CRP-024',
    image: 'https://picsum.photos/seed/croissant/400/300',
    description: 'AOP butter, black winter truffle, sea salt flake',
    active: true,
  },
  {
    id: '3',
    name: 'Miso Macarons (6pk)',
    category: 'อาหาร',
    price: 1400,
    cost: 600,
    stock: 24,
    sku: 'CRP-025',
    image: 'https://picsum.photos/seed/macarons/400/300',
    description: 'White miso ganache, toasted sesame, yuzu zest',
    active: true,
  },
  {
    id: '4',
    name: 'Neon Gin Fizz',
    category: 'เครื่องดื่ม',
    price: 1800,
    cost: 400,
    stock: 88,
    sku: 'DRK-102',
    image: 'https://picsum.photos/seed/cocktail/400/300',
    description: 'Japanese Gin, lychee, sparkling elderflower',
    active: true,
  },
  {
    id: '5',
    name: 'Wagyu Sando',
    category: 'อาหาร',
    price: 3500,
    cost: 1500,
    stock: 8,
    sku: 'TAP-005',
    image: 'https://picsum.photos/seed/wagyu/400/300',
    description: 'A5 Miyazaki Wagyu, honey mustard, milk bread',
    active: true,
  },
  {
    id: '6',
    name: 'Matcha Crepe',
    category: 'อาหาร',
    price: 900,
    cost: 300,
    stock: 15,
    sku: 'CRP-026',
    image: 'https://picsum.photos/seed/matcha/400/300',
    description: '20 layers of Uji matcha cream & delicate crepes',
    active: true,
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

const INGREDIENTS_MOCK: IngredientItem[] = [
  { id: 'ing-1', name: 'Miso Paste', category: 'Sauce', unit: 'kg', unitCost: 220, stock: 8, image: 'https://picsum.photos/seed/miso/300/300' },
  { id: 'ing-2', name: 'Ramen Noodles', category: 'Noodles', unit: 'portion', unitCost: 45, stock: 120, image: 'https://picsum.photos/seed/noodles/300/300' },
  { id: 'ing-3', name: 'Wagyu Slice', category: 'Meat', unit: 'portion', unitCost: 420, stock: 24, image: 'https://picsum.photos/seed/wagyu-ingredient/300/300' },
  { id: 'ing-4', name: 'Truffle Oil', category: 'Oil', unit: 'ml', unitCost: 12, stock: 900, image: 'https://picsum.photos/seed/truffle-oil/300/300' },
];

const MENU_RECIPES_MOCK: Record<string, MenuRecipeLine[]> = {
  '1': [
    { ingredientId: 'ing-1', quantity: 0.08 },
    { ingredientId: 'ing-2', quantity: 1 },
  ],
  '5': [
    { ingredientId: 'ing-3', quantity: 1.2 },
    { ingredientId: 'ing-4', quantity: 5 },
  ],
};

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

const MENU_CATEGORY_OPTIONS = ['อาหาร', 'เครื่องดื่ม'];
const INGREDIENT_CATEGORY_OPTIONS = ['Meat', 'Seafood', 'Vegetable', 'Sauce', 'Spice', 'Oil', 'Noodles', 'Dairy', 'Dry Goods', 'General'];

const TEXT = {
  en: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    menu: 'Inventory',
    inventoryIngredients: 'Ingredients',
    inventoryMenu: 'Menu Management',
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
    currency: 'Currency',
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
    inventorySummary: 'Inventory Summary',
    totalSkus: 'Total SKUs',
    totalUnits: 'Total Units',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    inventoryValue: 'Inventory Value',
    filterAll: 'All',
    filterLow: 'Low',
    filterOut: 'Out',
    movementHistory: 'Stock Movements',
    noMovement: 'No stock movement yet',
    noItemsFound: 'No items found',
    quickAdd5: '+5',
    quickMinus5: '-5',
    restock: 'Restock',
    consume: 'Usage',
    addMenuItem: 'Add Menu',
    menuName: 'Menu name',
    imageUrl: 'Image URL',
    uploadImage: 'Upload Image',
    fieldHintName: 'Enter ingredient name (e.g. Truffle Oil)',
    fieldHintImage: 'Upload ingredient photo (JPG/PNG)',
    fieldHintCategory: 'Choose ingredient category',
    fieldHintStock: 'Enter remaining quantity (number)',
    fieldHintCost: 'Enter cost per unit',
    menuFieldHintName: 'Enter menu name (e.g. Wagyu Sando)',
    menuFieldHintCategory: 'Choose menu category',
    menuFieldHintImage: 'Upload menu photo (JPG/PNG)',
    menuFieldHintStock: 'Enter starting stock (number)',
    menuFieldHintCost: 'Enter cost per menu',
    menuFieldHintPrice: 'Enter sale price per menu',
    menuFieldHintDesc: 'Short description for staff/pos',
    ingredientName: 'Ingredient name',
    ingredientUnit: 'Unit',
    ingredientUnitCost: 'Unit cost',
    ingredientStock: 'Ingredient stock',
    addIngredient: 'Add Ingredient',
    recipeBuilder: 'Recipe Builder',
    selectMenu: 'Select menu',
    selectIngredient: 'Select ingredient',
    quantity: 'Quantity',
    addToRecipe: 'Add to Recipe',
    uploading: 'Uploading...',
    recipeItems: 'Recipe Items',
    lineCost: 'Line cost',
    recipeCost: 'Recipe cost',
    margin: 'Margin',
    statusAvailable: 'Available',
    statusLow: 'Low',
    statusOut: 'Out',
    soundToggle: 'Kitchen Notifications',
    soundOn: 'Sound ON',
    soundOff: 'Sound OFF',
    logout: 'Logout',
    profile: 'Profile',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    recentActivity: 'Recent Activity',
    changePhoto: 'Change Photo',
  },
  th: {
    dashboard: 'แดชบอร์ด',
    orders: 'ออเดอร์',
    menu: 'สต็อกสินค้า',
    inventoryIngredients: 'วัตถุดิบ',
    inventoryMenu: 'จัดการเมนู',
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
    atelierStock: 'เมนูของร้าน',
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
    currency: 'สกุลเงิน',
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
    inventorySummary: 'สรุปสต็อก',
    totalSkus: 'จำนวน SKU',
    totalUnits: 'จำนวนชิ้นรวม',
    lowStock: 'ใกล้หมด',
    outOfStock: 'หมดสต็อก',
    inventoryValue: 'มูลค่าสต็อก',
    filterAll: 'ทั้งหมด',
    filterLow: 'ใกล้หมด',
    filterOut: 'หมด',
    movementHistory: 'ประวัติการปรับสต็อก',
    noMovement: 'ยังไม่มีการปรับสต็อก',
    noItemsFound: 'ไม่พบรายการสินค้า',
    quickAdd5: '+5',
    quickMinus5: '-5',
    restock: 'เติมสต็อก',
    consume: 'ตัดสต็อก',
    addMenuItem: 'เพิ่มเมนู',
    menuName: 'ชื่อเมนู',
    imageUrl: 'ลิงก์รูปภาพ',
    uploadImage: 'อัปโหลดรูป',
    fieldHintName: 'ใส่ชื่อวัตถุดิบ (เช่น Truffle Oil)',
    fieldHintImage: 'อัปโหลดรูปวัตถุดิบ (JPG/PNG)',
    fieldHintCategory: 'เลือกหมวดหมู่วัตถุดิบ',
    fieldHintStock: 'ใส่จำนวนคงเหลือ (ตัวเลข)',
    fieldHintCost: 'ใส่ต้นทุนต่อหน่วย',
    menuFieldHintName: 'ใส่ชื่อเมนู (เช่น Wagyu Sando)',
    menuFieldHintCategory: 'เลือกหมวดหมู่เมนู',
    menuFieldHintImage: 'อัปโหลดรูปเมนู (JPG/PNG)',
    menuFieldHintStock: 'ใส่จำนวนเริ่มต้น (ตัวเลข)',
    menuFieldHintCost: 'ใส่ต้นทุนต่อเมนู',
    menuFieldHintPrice: 'ใส่ราคาขายต่อเมนู',
    menuFieldHintDesc: 'คำอธิบายสั้นๆ สำหรับพนักงาน/หน้าขาย',
    ingredientName: 'ชื่อวัตถุดิบ',
    ingredientUnit: 'หน่วย',
    ingredientUnitCost: 'ราคาต่อหน่วย',
    ingredientStock: 'คงเหลือวัตถุดิบ',
    addIngredient: 'เพิ่มวัตถุดิบ',
    recipeBuilder: 'จัดสูตรเมนู',
    selectMenu: 'เลือกเมนู',
    selectIngredient: 'เลือกวัตถุดิบ',
    quantity: 'ปริมาณ',
    addToRecipe: 'เพิ่มเข้าสูตร',
    uploading: 'กำลังอัปโหลด...',
    recipeItems: 'รายการวัตถุดิบในเมนู',
    lineCost: 'ต้นทุนรายการ',
    recipeCost: 'ต้นทุนสูตร',
    margin: 'กำไรขั้นต้น',
    statusAvailable: 'พร้อมขาย',
    statusLow: 'ใกล้หมด',
    statusOut: 'หมด',
    soundToggle: 'แจ้งเตือนด้วยเสียงในครัว',
    soundOn: 'เปิดเสียง',
    soundOff: 'ปิดเสียง',
    logout: 'ออกจากระบบ',
    profile: 'โปรไฟล์',
    notifications: 'การแจ้งเตือน',
    noNotifications: 'ไม่มีการแจ้งเตือน',
    recentActivity: 'กิจกรรมล่าสุด',
    changePhoto: 'เปลี่ยนรูป',
  },
} as const;

const formatNowTime = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatCurrencyAmount = (value: number, currency: CurrencyCode, language: Language) => {
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

const toKitchenOrders = (orders: Order[]): KitchenOrder[] =>
  orders
    .filter((order) => order.status === 'new' || order.status === 'preparing')
    .slice(0, 20)
    .map((order) => {
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
        dbStatus: order.status,
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
    { id: 'inventoryIngredients', label: labels.inventoryIngredients, icon: ShoppingBag },
    { id: 'inventoryMenu', label: labels.inventoryMenu, icon: UtensilsCrossed },
    { id: 'kitchen', label: labels.kitchen, icon: ChefHat },
    { id: 'settings', label: labels.settings, icon: Settings },
  ];

  const LOGO_URL = "https://oeeodnscuvivturnxlft.supabase.co/storage/v1/object/public/ops-media/login-bg.png";
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
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold font-mono">STREET LUXURY</p>
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
  currency,
  onChangeCurrency,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  trucks,
  currentTruckId,
  onTruckChange,
  currentUser,
  onLogout,
  onUpdateUserImage,
}: {
  title: string;
  subtitle?: React.ReactNode;
  supabaseStatus: SupabaseConnectionState;
  labels: typeof TEXT.en;
  language: Language;
  onToggleLanguage: () => void;
  currency: CurrencyCode;
  onChangeCurrency: (currency: CurrencyCode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  trucks: Truck[];
  currentTruckId: string | null;
  onTruckChange: (id: string | null) => void;
  currentUser: StaffMember | null;
  onLogout: () => void;
  onUpdateUserImage: (file: File) => void;
}) => {
  const [activeMenu, setActiveMenu] = useState<'notifications' | 'profile' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenu(null);
    if (activeMenu) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenu]);

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
        <select
          className="px-3 py-2 rounded-sm bg-surface-high text-on-surface text-xs font-bold uppercase tracking-wider outline-none"
          title={labels.currency}
          value={currency}
          onChange={(event) => onChangeCurrency(event.target.value as CurrencyCode)}
        >
          <option value="THB">THB</option>
          <option value="JPY">JPY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <button
          onClick={onToggleTheme}
          className="px-3 py-2 rounded-sm bg-surface-high text-on-surface text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          title={labels.theme}
        >
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {theme === 'dark' ? labels.dark : labels.light}
        </button>
        <select
          className="bg-surface-high text-on-surface text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm outline-none border border-outline-variant/10 min-w-[200px]"
          value={currentTruckId || ''}
          onChange={(e) => onTruckChange(e.target.value)}
        >
          {trucks.map(truck => (
            <option key={truck.id} value={truck.id}>
              {truck.name} {truck.location ? `• ${truck.location}` : ''}
            </option>
          ))}
          {trucks.length === 0 && <option value="">No Trucks Found</option>}
        </select>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveMenu(prev => prev === 'notifications' ? null : 'notifications'); }}
            className={cn("p-2 rounded-sm transition-colors", activeMenu === 'notifications' ? "bg-primary/20 text-primary" : "text-on-surface/60 hover:bg-surface-high")}
          >
            <Bell className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 ml-2 group cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveMenu(prev => prev === 'profile' ? null : 'profile'); }}>
            <div className="hidden md:block text-right">
               <p className="text-[10px] font-black uppercase tracking-widest text-on-surface leading-tight">{currentUser?.name || 'Manager'}</p>
               <p className="text-[9px] font-mono text-on-surface/40 uppercase tracking-tighter">{currentUser?.role || 'Admin'}</p>
            </div>
            <div className={cn("w-8 h-8 rounded-full overflow-hidden border transition-all", activeMenu === 'profile' ? "border-primary shadow-[0_0_10px_rgba(255,82,92,0.3)]" : "border-outline-variant/30")}>
              <img 
                src={currentUser?.image || "https://picsum.photos/seed/manager/100/100"} 
                alt={currentUser?.name || "Manager"} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Dropdowns */}
          <AnimatePresence>
            {activeMenu === 'notifications' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-4 w-80 bg-surface-low border border-outline-variant/20 shadow-2xl rounded-sm overflow-hidden z-50 backdrop-blur-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-outline-variant/10 bg-surface-high/50">
                  <h4 className="font-headline font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <Bell className="w-3 h-3 text-primary" />
                    {labels.notifications}
                  </h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                  <div className="py-8 text-center opacity-20 flex flex-col items-center">
                    <Info className="w-8 h-8 mb-2" />
                    <p className="text-[10px] uppercase font-mono tracking-widest">{labels.noNotifications}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeMenu === 'profile' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-4 w-56 bg-surface-low border border-outline-variant/20 shadow-2xl rounded-sm overflow-hidden z-50 backdrop-blur-xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-outline-variant/10 bg-surface-high/50 md:hidden">
                  <p className="text-xs font-bold">{currentUser?.name}</p>
                  <p className="text-[10px] text-on-surface/50">{currentUser?.role}</p>
                </div>
                <div className="p-2 space-y-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onUpdateUserImage(file);
                        setActiveMenu(null);
                      }
                    }}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-3"
                  >
                    <Camera className="w-4 h-4" />
                    {labels.changePhoto}
                  </button>
                  <button className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-3">
                    <User className="w-4 h-4" />
                    {labels.profile}
                  </button>
                  <div className="h-[1px] bg-outline-variant/10 mx-2 my-1"></div>
                  <button 
                    onClick={onLogout}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-error hover:bg-error/10 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4" />
                    {labels.logout}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
    { id: 'inventoryIngredients' as const, label: labels.inventoryIngredients, icon: ShoppingBag },
    { id: 'inventoryMenu' as const, label: labels.inventoryMenu, icon: UtensilsCrossed },
    { id: 'kitchen' as const, label: labels.kitchen, icon: ChefHat },
    { id: 'settings' as const, label: labels.settings, icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-low/95 backdrop-blur-md border-t border-outline-variant/20 px-2 py-2">
      <div className="grid grid-cols-6 gap-1">
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

const OrderDetailsModal = ({ order, onClose, labels, formatMoney }: { order: Order; onClose: () => void; labels: typeof TEXT.en; formatMoney: (v: number) => string }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface-low border border-outline-variant/20 rounded-sm w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-start">
          <div>
            <span className="font-mono text-[10px] text-primary font-bold uppercase tracking-widest leading-none block mb-1">Receipt Transaction</span>
            <h2 className="font-headline text-2xl font-black italic tracking-tighter uppercase">{order.id}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-high rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface/40" />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">{labels.customerName}</p>
              <p className="text-sm font-bold">{order.customer}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">{labels.status}</p>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter italic",
                order.status === 'delivered' ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
              )}>{order.status}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-on-surface/40 font-bold border-b border-outline-variant/10 pb-2">{labels.recipeItems}</p>
            {order.lineItems?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-primary">{item.qty}x</span>
                  <span className="text-sm font-bold uppercase tracking-tight">{item.name}</span>
                </div>
                <span className="font-mono text-xs text-on-surface/60">{item.station}</span>
              </div>
            ))}
          </div>

          {order.note && (
            <div className="bg-background/40 p-3 rounded-sm border-l-2 border-secondary italic text-xs text-on-surface/70">
              "{order.note}"
            </div>
          )}

          <div className="pt-6 border-t border-outline-variant/10 flex justify-between items-center">
            <span className="font-headline font-black text-lg uppercase italic tracking-widest text-primary">{labels.total}</span>
            <span className="font-headline font-black text-3xl italic tracking-tighter text-secondary">{formatMoney(order.total)}</span>
          </div>
        </div>

        <div className="p-4 bg-background/60 text-center">
          <p className="text-[8px] font-mono text-on-surface/30 uppercase tracking-[0.4em]">{new Date(order.createdAt || 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({
  orders,
  menuItems,
  labels,
  formatMoney,
  onViewHistory,
}: {
  orders: Order[];
  menuItems: MenuItem[];
  labels: typeof TEXT.en;
  formatMoney: (value: number) => string;
  onViewHistory: () => void;
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const newCount = orders.filter((order) => order.status === 'new').length;
  const preparingCount = orders.filter((order) => order.status === 'preparing').length;
  const deliveredCount = orders.filter((order) => order.status === 'delivered').length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const averageOrder = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const lowStockItems = menuItems.filter((item) => item.stock <= 10).slice(0, 3);
  const recentOrders = orders.slice(0, 5);

  const realSalesData = useMemo(() => {
    // Group orders by hour for the last 12 hours
    const data: { [key: string]: number } = {};
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const hourDate = new Date(now - (11 - i) * 3600000);
      const hourKey = hourDate.getHours() + ':00';
      data[hourKey] = 0;
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt || 0);
      const hourKey = orderDate.getHours() + ':00';
      if (data[hourKey] !== undefined) {
        data[hourKey] += order.total;
      }
    });

    return Object.entries(data).map(([time, value]) => ({ time, value }));
  }, [orders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mx-0 order-ticker py-2 px-6 flex items-center justify-between rounded-sm bg-secondary/20 text-secondary border border-secondary/30">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-sm tracking-tighter uppercase">Operations Hub</span>
          <div className="flex gap-4 text-xs font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary rounded-full"></span> {newCount} {labels.status}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary/50 rounded-full"></span> {preparingCount} Processing</span>
          </div>
        </div>
        <div className="font-mono text-sm font-bold uppercase">{new Date().toLocaleTimeString()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm border border-outline-variant/10">
          <TrendingUp className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">{labels.total}</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter drop-shadow-[0_0_15px_rgba(255,82,92,0.1)]">{formatMoney(totalRevenue)}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-secondary">
              <TrendingUp className="w-4 h-4" />
              <span>Real Volume</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm border border-outline-variant/10">
          <ShoppingBag className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">{labels.orders}</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter drop-shadow-[0_0_15px_rgba(255,82,92,0.1)]">{orders.length}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary">
              <Clock className="w-4 h-4" />
              <span>Active Pulse</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm border border-outline-variant/10">
          <Receipt className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">Avg Ticket</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter drop-shadow-[0_0_15px_rgba(255,82,92,0.1)]">{formatMoney(averageOrder)}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-on-surface/40">
              <Info className="w-4 h-4" />
              <span>Live Efficiency</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-low p-8 rounded-sm border border-outline-variant/10">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="font-headline text-2xl font-black uppercase tracking-tight italic mb-2">Sales Velocity</h2>
              <p className="text-on-surface/60 text-[10px] font-bold uppercase tracking-widest font-mono">Real-time throughput (Last 12 hours)</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={realSalesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#e5e2e1', opacity: 0.4, fontSize: 10, fontFamily: 'Space Grotesk' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,82,92,0.1)' }}
                  contentStyle={{ backgroundColor: '#1c1b1b', border: '1px solid #2a2a2a', borderRadius: '2px', color: '#e5e2e1' }}
                  formatter={(value: number) => [formatMoney(value), 'Revenue']}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {realSalesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#ff525c' : '#353534'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-low p-8 rounded-sm border border-outline-variant/10 flex flex-col shadow-inner">
          <h2 className="font-headline text-2xl font-black uppercase tracking-tight italic mb-6">Inventory Health</h2>
          <div className="space-y-6 flex-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between group p-2 hover:bg-background/20 rounded-sm transition-colors border-l-2 border-transparent hover:border-secondary">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-sm bg-surface-highest overflow-hidden border border-outline-variant/10">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-tight">{item.name}</p>
                    <p className={cn('text-[10px] font-black uppercase tracking-tighter', item.stock <= 3 ? 'text-error' : 'text-secondary')}>
                      {item.stock} LEFT
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-20">
                <ChefHat className="w-10 h-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">Stable Ops</p>
              </div>
            )}
          </div>
          <button className="w-full mt-auto py-4 text-[10px] font-black tracking-[0.3em] uppercase border border-outline-variant/20 hover:border-primary/50 bg-background/20 hover:text-primary transition-all">
            Full Inventory Analysis
          </button>
        </div>
      </div>

      <div className="bg-surface-low rounded-sm overflow-hidden border border-outline-variant/10">
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-headline text-2xl font-black uppercase tracking-tight italic">{labels.orders}</h2>
          <div className="flex gap-8 items-center">
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter border border-primary/20 italic">LIVE TRANSACTIONS</span>
            </div>
            <button 
              onClick={onViewHistory}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface/40 flex items-center gap-2 hover:text-primary transition-colors"
            >
              View Full History
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-highest/30 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/40">
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
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-background/40 transition-colors group">
                  <td className="px-8 py-6 font-mono font-black italic text-primary">{order.id}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-[10px] italic border border-primary/20">
                        {order.customer.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-bold uppercase tracking-tight">{order.customer}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[11px] font-mono text-on-surface/50 tracking-tight">{order.items}</td>
                  <td className="px-8 py-6 font-black italic text-secondary">{formatMoney(order.total)}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "flex items-center gap-2 font-black text-[10px] uppercase italic tracking-tighter",
                      order.status === 'preparing' ? "text-primary" : order.status === 'delivered' ? "text-secondary" : "text-on-surface/30"
                    )}>
                      <span className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]", 
                        order.status === 'preparing' ? "bg-primary animate-pulse" : 
                        order.status === 'delivered' ? "bg-secondary" : 
                        "bg-on-surface/20"
                      )}></span>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="bg-surface-highest/50 px-5 py-2 text-[10px] font-black uppercase italic tracking-widest border border-outline-variant/20 hover:bg-neon-gradient hover:text-on-primary-fixed hover:border-transparent transition-all"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-xs font-black uppercase tracking-[0.4em] text-on-surface/20">
                    No active transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          labels={labels} 
          formatMoney={formatMoney} 
        />
      )}
    </div>
  );
};

const OrderHistoryView = ({
  orders,
  labels,
  formatMoney,
}: {
  orders: Order[];
  labels: typeof TEXT.en;
  formatMoney: (value: number) => string;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const kw = searchTerm.toLowerCase().trim();
    return orders.filter(o => 
      o.id.toLowerCase().includes(kw) || 
      o.customer.toLowerCase().includes(kw) || 
      o.items.toLowerCase().includes(kw)
    );
  }, [orders, searchTerm]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in slide-in-from-right-10 duration-500">
      <div className="p-8 border-b border-outline-variant/10 bg-surface-low">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <p className="font-mono text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-2 leading-none">{labels.inventoryControl}</p>
            <h2 className="font-headline text-4xl font-black italic tracking-tighter uppercase leading-none">Order Repository</h2>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30 w-4 h-4" />
            <input 
              className="w-full bg-background/40 border border-outline-variant/20 focus:border-primary/50 text-on-surface pl-12 pr-6 py-3.5 text-xs font-mono rounded-sm tracking-[0.2em] uppercase transition-all" 
              placeholder="SEARCH ARCHIVES..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background/20 p-4 border border-outline-variant/10 rounded-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface/40 leading-none mb-2">Total Archival</p>
            <p className="text-2xl font-black italic font-headline tracking-tighter">{orders.length}</p>
          </div>
          <div className="bg-background/20 p-4 border border-outline-variant/10 rounded-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface/40 leading-none mb-2">Delivered</p>
            <p className="text-2xl font-black italic font-headline tracking-tighter text-secondary">{orders.filter(o => o.status === 'delivered').length}</p>
          </div>
          <div className="bg-background/20 p-4 border border-outline-variant/10 rounded-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface/40 leading-none mb-2">Average Ticket</p>
            <p className="text-2xl font-black italic font-headline tracking-tighter text-primary">{formatMoney(orders.length ? Math.round(orders.reduce((s, o) => s + o.total, 0) / orders.length) : 0)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 pr-4 custom-scrollbar">
        <div className="bg-surface-low rounded-sm border border-outline-variant/10 shadow-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-highest/20 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/40">
              <tr>
                <th className="px-8 py-5">Date / Time</th>
                <th className="px-8 py-5">Order ID</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5 text-right">Revenue</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/10 uppercase">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-background/30 transition-colors group">
                  <td className="px-8 py-6 font-mono text-[10px] text-on-surface/40">
                    {new Date(order.createdAt || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-6 font-mono font-black italic text-primary">{order.id}</td>
                  <td className="px-8 py-6 font-bold tracking-tight">{order.customer}</td>
                  <td className="px-8 py-6 text-right font-black italic text-secondary">{formatMoney(order.total)}</td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center">
                      <span className={cn(
                        "px-3 py-1 rounded-sm text-[10px] font-black uppercase italic tracking-widest",
                        order.status === 'delivered' ? "bg-secondary/10 text-secondary border border-secondary/20" : "bg-primary/10 text-primary border border-primary/20"
                      )}>{order.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors underline underline-offset-4"
                    >
                      Audit View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-xs font-black uppercase tracking-[0.4em] opacity-10">
                    End of Archives
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          labels={labels} 
          formatMoney={formatMoney} 
        />
      )}
    </div>
  );
};

const POSView = ({
  menuItems,
  onSubmitOrder,
  labels,
  formatMoney,
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
  formatMoney: (value: number) => string;
}) => {
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState('');
  const [orderType, setOrderType] = useState<'dine-in' | 'takeout'>('dine-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(labels.filterAll);
  
  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.filter(item => item.active).map(item => item.category))).filter(Boolean);
    return [labels.filterAll, ...cats];
  }, [menuItems, labels.filterAll]);

  const saleMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.active) return false;
      if (selectedCategory === labels.filterAll) return true;
      return item.category === selectedCategory;
    });
  }, [menuItems, selectedCategory, labels.filterAll]);

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
          line.item.category === 'เครื่องดื่ม' || line.item.category === 'Drinks' || line.item.category === 'Pastries'
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
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full text-sm whitespace-nowrap transition-all font-bold active:scale-95 shadow-sm",
                selectedCategory === cat 
                  ? "bg-neon-gradient text-on-primary-fixed shadow-primary/20" 
                  : "bg-surface-high text-on-surface/70 hover:text-on-surface hover:bg-surface-highest"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {saleMenuItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => addToCart(item)}
              className="group bg-surface-low rounded-xl overflow-hidden cursor-pointer hover:bg-surface-high transition-all active:scale-[0.98]"
            >
              <div className="h-48 w-full relative overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-sm border border-primary/20">
                  <span className="font-mono text-primary font-bold">{formatMoney(item.price)}</span>
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
                  <span className="text-sm font-mono font-bold">{formatMoney(i.item.price * i.qty)}</span>
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
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-mono text-on-surface/60">
              <span>{labels.tax} (10%)</span>
              <span>{formatMoney(tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-headline font-black pt-2 border-t border-outline-variant/10 text-primary">
              <span>{labels.total}</span>
              <span>{formatMoney(total)}</span>
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

const KitchenView = ({ 
  kitchenOrders, 
  onUpdateStatus,
  labels,
  isSoundEnabled,
  onToggleSound,
}: { 
  kitchenOrders: KitchenOrder[]; 
  onUpdateStatus: (orderId: string, status: Order['status']) => Promise<void>;
  labels: typeof TEXT.en;
  isSoundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
}) => {
  const [stationFilter, setStationFilter] = useState<'ALL' | 'HOT' | 'COLD'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (stationFilter === 'ALL') return kitchenOrders;
    return kitchenOrders.filter(order => 
      order.items.some(item => item.station === stationFilter)
    );
  }, [kitchenOrders, stationFilter]);

  const handleAction = async (order: KitchenOrder) => {
    setUpdatingId(order.id);
    try {
      if (order.dbStatus === 'new') {
        await onUpdateStatus(order.id, 'preparing');
      } else if (order.dbStatus === 'preparing') {
        await onUpdateStatus(order.id, 'delivered');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-in fade-in duration-500">
      <div className="p-4 lg:p-8 pb-0">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex bg-surface-low p-1 rounded-sm border border-outline-variant/10">
            {(['ALL', 'HOT', 'COLD'] as const).map((station) => (
              <button
                key={station}
                onClick={() => setStationFilter(station)}
                className={cn(
                  "px-6 py-2 text-xs font-bold font-headline rounded-sm uppercase tracking-[0.2em] transition-all",
                  stationFilter === station 
                    ? "bg-primary text-on-primary-fixed shadow-lg shadow-primary/20" 
                    : "text-on-surface/40 hover:text-on-surface"
                )}
              >
                {station === 'ALL' ? labels.filterAll : station}
              </button>
            ))}
          </div>
          <div className="h-0.5 flex-1 bg-outline-variant/10"></div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onToggleSound(!isSoundEnabled)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-sm border transition-all active:scale-95",
                isSoundEnabled 
                  ? "bg-secondary/10 border-secondary/30 text-secondary" 
                  : "bg-surface-high border-outline-variant/10 text-on-surface/40 hover:text-on-surface"
              )}
              title={isSoundEnabled ? labels.soundOn : labels.soundOff}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">
                {isSoundEnabled ? labels.soundOn : labels.soundOff}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold text-on-surface/40 uppercase tracking-widest leading-none">Live Ops Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 pt-0 pr-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className={cn(
              "flex flex-col bg-surface-low relative group border-t-4 transition-all duration-300",
              order.status === 'overdue' ? "border-error shadow-[0_0_20px_rgba(255,82,92,0.1)]" : order.status === 'delayed' ? "border-secondary" : "border-outline-variant"
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
                    <h3 className="font-headline text-2xl font-bold mt-1 tracking-tighter italic">{order.id}</h3>
                    <p className="text-xs text-on-surface/40 font-mono mt-1">GUEST: {order.customer} <span className="mx-1">/</span> {order.type.toUpperCase()}</p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 flex flex-col items-end rounded-sm",
                    order.status === 'overdue' ? "bg-error/10" : order.status === 'delayed' ? "bg-secondary/10" : "bg-surface-high"
                  )}>
                    <span className={cn("font-mono text-xs font-bold", order.status === 'overdue' ? "text-error" : order.status === 'delayed' ? "text-secondary" : "text-on-surface")}>
                      {order.elapsed}
                    </span>
                    <span className="text-[8px] opacity-40 font-bold uppercase tracking-widest mt-1">ELAPSED</span>
                  </div>
                </div>

                <div className="space-y-4 flex-grow">
                  {order.items.filter(item => stationFilter === 'ALL' || item.station === stationFilter).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center group/item p-2 hover:bg-background/40 transition-colors rounded-sm border-l-2 border-transparent hover:border-primary">
                      <div className="flex items-center gap-4">
                        <span className={cn("font-mono text-xl font-black", order.status === 'overdue' ? "text-error" : order.status === 'delayed' ? "text-secondary" : "text-primary")}>
                          {item.qty}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-base uppercase font-headline tracking-tighter">{item.name}</span>
                          <span className="text-[10px] text-on-surface/40 font-mono tracking-widest">{item.station}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {order.note && (
                    <div className="mt-4 p-4 bg-background/60 border-l-2 border-secondary italic text-[11px] text-on-surface/80 leading-relaxed rounded-r-sm">
                      <p className="text-[8px] font-bold text-secondary uppercase tracking-widest mb-1 not-italic">Chef's Note:</p>
                      "{order.note}"
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => handleAction(order)}
                    disabled={updatingId === order.id}
                    className={cn(
                      "w-full py-5 font-headline font-black text-sm tracking-[0.2em] uppercase active:scale-95 transition-all rounded-sm shadow-lg",
                      updatingId === order.id ? "opacity-50 grayscale" :
                      order.dbStatus === 'new' ? "bg-surface-highest text-on-surface" : "bg-neon-gradient text-on-primary-fixed shadow-primary/20"
                    )}
                  >
                    {updatingId === order.id ? labels.uploading :
                     order.dbStatus === 'new' ? "Start Cooking" : "Ready for Pickup"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-40 border-2 border-dashed border-outline-variant/10 rounded-sm">
              <ChefHat className="w-16 h-16 text-on-surface/10 mb-4" />
              <p className="font-headline font-black uppercase tracking-[0.4em] text-on-surface/20 text-sm">{labels.noItemsFound}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MenuView = ({
  menuItems,
  onChangeStock,
  inventoryMovements,
  ingredients,
  menuRecipes,
  onAddMenuItem,
  onAddIngredient,
  onUpsertRecipeLine,
  onUpdateMenuMeta,
  onDeleteMenuItem,
  onToggleMenuActive,
  formatMoney,
  showIngredientPanel = true,
  labels,
}: {
  menuItems: MenuItem[];
  onChangeStock: (itemId: string, nextStock: number, reason?: string) => void;
  inventoryMovements: InventoryMovement[];
  ingredients: IngredientItem[];
  menuRecipes: Record<string, MenuRecipeLine[]>;
  onAddMenuItem: (payload: {
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    imageFile?: File | null;
    description: string;
    recipeLines?: MenuRecipeLine[];
    active?: boolean;
  }) => Promise<void>;
  onAddIngredient: (payload: {
    name: string;
    unit: string;
    unitCost: number;
    stock: number;
    category?: string;
    imageFile?: File | null;
  }) => Promise<void>;
  onUpsertRecipeLine: (payload: {
    menuId: string;
    ingredientId: string;
    quantity: number;
  }) => void;
  onUpdateMenuMeta: (itemId: string, patch: Partial<Pick<MenuItem, 'category' | 'cost' | 'price'>>) => void;
  onDeleteMenuItem: (itemId: string) => Promise<void>;
  onToggleMenuActive: (itemId: string, active: boolean) => Promise<void>;
  formatMoney: (value: number) => string;
  showIngredientPanel?: boolean;
  labels: typeof TEXT.en;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [newMenu, setNewMenu] = useState({
    name: '',
    category: MENU_CATEGORY_OPTIONS[0],
    price: 0,
    cost: 0,
    stock: 0,
    description: '',
    active: true,
  });
  const [draftRecipeIngredientId, setDraftRecipeIngredientId] = useState(ingredients[0]?.id ?? '');
  const [draftRecipeQty, setDraftRecipeQty] = useState(1);
  const [draftRecipeLines, setDraftRecipeLines] = useState<MenuRecipeLine[]>([]);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unitCost: 0,
    stock: 0,
  });
  const [newMenuImageFile, setNewMenuImageFile] = useState<File | null>(null);
  const [newIngredientImageFile, setNewIngredientImageFile] = useState<File | null>(null);
  const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);
  const [isSubmittingIngredient, setIsSubmittingIngredient] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState(menuItems[0]?.id ?? '');
  const [selectedIngredientId, setSelectedIngredientId] = useState(ingredients[0]?.id ?? '');
  const [recipeQty, setRecipeQty] = useState(1);

  const categories = useMemo(
    () => [labels.filterAll, ...Array.from(new Set(menuItems.map((item) => item.category)))],
    [labels.filterAll, menuItems],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set([...MENU_CATEGORY_OPTIONS, ...menuItems.map((item) => item.category)])).filter(Boolean),
    [menuItems],
  );
  const [activeCategory, setActiveCategory] = useState<string>(labels.filterAll);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(labels.filterAll);
    }
  }, [activeCategory, categories, labels.filterAll]);

  useEffect(() => {
    if (!selectedMenuId && menuItems.length > 0) {
      setSelectedMenuId(menuItems[0].id);
    }
  }, [menuItems, selectedMenuId]);

  useEffect(() => {
    if (!selectedIngredientId && ingredients.length > 0) {
      setSelectedIngredientId(ingredients[0].id);
    }
  }, [ingredients, selectedIngredientId]);

  useEffect(() => {
    if (!draftRecipeIngredientId && ingredients.length > 0) {
      setDraftRecipeIngredientId(ingredients[0].id);
    }
  }, [draftRecipeIngredientId, ingredients]);

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchCategory = activeCategory === labels.filterAll || item.category === activeCategory;
      const matchKeyword =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword);
      const matchStock =
        stockFilter === 'all'
          ? true
          : stockFilter === 'out'
            ? item.stock === 0
            : item.stock > 0 && item.stock <= 10;
      return matchCategory && matchKeyword && matchStock;
    });
  }, [menuItems, activeCategory, labels.filterAll, searchTerm, stockFilter]);

  const summary = useMemo(() => {
    const totalSkus = menuItems.length;
    const totalUnits = menuItems.reduce((sum, item) => sum + item.stock, 0);
    const lowStock = menuItems.filter((item) => item.stock > 0 && item.stock <= 10).length;
    const outOfStock = menuItems.filter((item) => item.stock === 0).length;
    const inventoryValue = menuItems.reduce((sum, item) => sum + item.cost * item.stock, 0);
    return { totalSkus, totalUnits, lowStock, outOfStock, inventoryValue };
  }, [menuItems]);

  const recipeLines = menuRecipes[selectedMenuId] || [];
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient] as const)),
    [ingredients],
  );

  const recipeCost = recipeLines.reduce((sum, line) => {
    const ingredient = ingredientMap.get(line.ingredientId);
    return sum + (ingredient ? ingredient.unitCost * line.quantity : 0);
  }, 0);
  const selectedMenu = menuItems.find((item) => item.id === selectedMenuId);
  const menuMargin = selectedMenu ? selectedMenu.price - recipeCost : 0;

  const draftRecipeCost = useMemo(
    () =>
      draftRecipeLines.reduce((sum, line) => {
        const ingredient = ingredientMap.get(line.ingredientId);
        return sum + (ingredient ? ingredient.unitCost * line.quantity : 0);
      }, 0),
    [draftRecipeLines, ingredientMap],
  );

  const addDraftIngredientToRecipe = () => {
    if (!draftRecipeIngredientId || draftRecipeQty <= 0) return;
    const safeQty = Math.max(0.01, draftRecipeQty);
    setDraftRecipeLines((prev) => {
      const foundIndex = prev.findIndex((line) => line.ingredientId === draftRecipeIngredientId);
      const next = [...prev];
      if (foundIndex >= 0) {
        next[foundIndex] = { ...next[foundIndex], quantity: safeQty };
      } else {
        next.push({ ingredientId: draftRecipeIngredientId, quantity: safeQty });
      }
      return next;
    });
  };

  const removeDraftIngredient = (id: string) => {
    setDraftRecipeLines((prev) => prev.filter((item) => item.ingredientId !== id));
  };

  const submitNewMenu = async () => {
    if (!newMenu.name.trim()) return;
    setIsSubmittingMenu(true);
    try {
      await onAddMenuItem({
        name: newMenu.name.trim(),
        category: newMenu.category.trim() || MENU_CATEGORY_OPTIONS[0],
        price: Math.max(0, newMenu.price),
        cost: Math.max(0, draftRecipeLines.length > 0 ? draftRecipeCost : newMenu.cost),
        stock: Math.max(0, Math.floor(newMenu.stock)),
        imageFile: newMenuImageFile,
        description: newMenu.description.trim() || '-',
        recipeLines: draftRecipeLines,
        active: newMenu.active,
      });
      setNewMenu({
        name: '',
        category: MENU_CATEGORY_OPTIONS[0],
        price: 0,
        cost: 0,
        stock: 0,
        description: '',
        active: true,
      });
      setNewMenuImageFile(null);
      setDraftRecipeLines([]);
    } finally {
      setIsSubmittingMenu(false);
    }
  };

  const submitNewIngredient = async () => {
    if (!newIngredient.name.trim()) return;
    setIsSubmittingIngredient(true);
    try {
      await onAddIngredient({
        name: newIngredient.name.trim(),
        unit: 'unit',
        unitCost: Math.max(0, newIngredient.unitCost),
        stock: Math.max(0, Math.floor(newIngredient.stock)),
        imageFile: newIngredientImageFile,
      });
      setNewIngredient({
        name: '',
        unitCost: 0,
        stock: 0,
      });
      setNewIngredientImageFile(null);
    } finally {
      setIsSubmittingIngredient(false);
    }
  };

  const addIngredientToRecipe = () => {
    if (!selectedMenuId || !selectedIngredientId || recipeQty <= 0) return;
    onUpsertRecipeLine({
      menuId: selectedMenuId,
      ingredientId: selectedIngredientId,
      quantity: recipeQty,
    });
  };

  const stockStatus = (stock: number) => {
    if (stock <= 0) return { label: labels.statusOut, cls: 'bg-error/20 text-error' };
    if (stock <= 10) return { label: labels.statusLow, cls: 'bg-secondary/20 text-secondary' };
    return { label: labels.statusAvailable, cls: 'bg-primary/15 text-primary' };
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <p className="font-mono text-primary text-sm font-bold uppercase tracking-[0.2em] mb-2">{labels.inventoryControl}</p>
          <h3 className="font-headline font-black text-4xl text-on-surface leading-none uppercase">{labels.atelierStock}</h3>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[420px]">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold",
                  activeCategory === category
                    ? "bg-primary text-on-primary-fixed"
                    : "bg-surface-high text-on-surface/70",
                )}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all' as const, label: labels.filterAll },
              { key: 'low' as const, label: labels.filterLow },
              { key: 'out' as const, label: labels.filterOut },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStockFilter(filter.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold",
                  stockFilter === filter.key
                    ? "bg-secondary text-background"
                    : "bg-surface-high text-on-surface/70",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 w-4 h-4" />
            <input 
              className="w-full bg-surface-low border-none focus:ring-1 focus:ring-primary text-on-surface pl-10 pr-4 py-3 text-xs font-mono rounded-sm tracking-widest uppercase transition-all" 
              placeholder={labels.searchProducts}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
            />
          </div>
        </div>
      </div>

      <div className={cn("grid gap-6", showIngredientPanel ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")}>
        <div className="bg-surface-low border border-outline-variant/10 rounded-sm p-4 space-y-3">
          <h4 className="font-headline text-lg font-bold">{labels.addMenuItem}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-background/60 px-3 py-2 rounded-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{labels.menuName}</span>
                <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintName}</span>
              </div>
              <input
                className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
                placeholder={labels.menuName}
                value={newMenu.name}
                onChange={(event) => setNewMenu((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="bg-background/60 px-3 py-2 rounded-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{labels.category}</span>
                <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintCategory}</span>
              </div>
              <select
                className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
                value={newMenu.category}
                onChange={(event) => setNewMenu((prev) => ({ ...prev, category: event.target.value }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-background/60 px-3 py-2 rounded-sm md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="text-xs font-bold text-primary italic uppercase tracking-wider">{labels.recipeBuilder}</h5>
                  <p className="text-[10px] text-on-surface/50">{labels.recipeItems}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-on-surface/50 uppercase tracking-widest">{labels.recipeCost}</p>
                  <p className="font-mono text-sm font-bold text-secondary">{formatMoney(draftRecipeLines.length > 0 ? draftRecipeCost : newMenu.cost)}</p>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <select
                  className="flex-1 bg-background/40 px-3 py-2 rounded-sm text-xs outline-none"
                  value={draftRecipeIngredientId}
                  onChange={(event) => setDraftRecipeIngredientId(event.target.value)}
                >
                  <option value="" disabled>{labels.selectIngredient}</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({formatMoney(ing.unitCost)}/{ing.unit})</option>
                  ))}
                </select>
                <div className="w-24">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-background/40 px-3 py-2 rounded-sm text-xs outline-none"
                    placeholder="Qty"
                    value={draftRecipeQty}
                    onChange={(event) => setDraftRecipeQty(Number(event.target.value))}
                  />
                </div>
                <button
                  type="button"
                  onClick={addDraftIngredientToRecipe}
                  className="bg-secondary text-background px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-tighter hover:scale-95 active:scale-90 transition-transform"
                >
                  {labels.addToRecipe}
                </button>
              </div>

              {draftRecipeLines.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {draftRecipeLines.map((line) => {
                    const ing = ingredientMap.get(line.ingredientId);
                    return (
                      <div key={line.ingredientId} className="flex justify-between items-center bg-background/20 px-3 py-2 rounded-sm group relative">
                        <div className="flex items-center gap-3">
                          {ing?.image && <img src={ing.image} className="w-6 h-6 rounded-sm object-cover" alt="" />}
                          <div>
                            <p className="text-[10px] font-bold">{ing?.name || 'Unknown'}</p>
                            <p className="text-[8px] text-on-surface/50">{line.quantity} {ing?.unit} × {formatMoney(ing?.unitCost ?? 0)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-mono font-bold text-secondary">{formatMoney((ing?.unitCost ?? 0) * line.quantity)}</p>
                          <button
                            type="button"
                            onClick={() => removeDraftIngredient(line.ingredientId)}
                            className="bg-error/20 text-error w-5 h-5 rounded-sm flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {draftRecipeLines.length === 0 && (
                <div className="bg-background/20 px-3 py-4 rounded-sm border border-dashed border-outline-variant/30 flex items-center justify-center">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface/30 font-bold">{labels.noItemsFound}</p>
                </div>
              )}

              {/* Keep a manual cost fallback if someone really wants to override, but hide if recipe exists */}
              {draftRecipeLines.length === 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-on-surface/50 uppercase tracking-widest">{labels.cost} (Manual Fallback)</span>
                  </div>
                  <input
                    className="w-full bg-background/30 px-3 py-2 rounded-sm outline-none text-xs font-mono"
                    placeholder={labels.cost}
                    type="number"
                    min="0"
                    value={newMenu.cost}
                    onChange={(event) => setNewMenu((prev) => ({ ...prev, cost: Number(event.target.value) }))}
                  />
                </div>
              )}
            </div>
            <div className="bg-background/60 px-3 py-2 rounded-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{labels.price}</span>
                <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintPrice}</span>
              </div>
              <input
                className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
                placeholder={labels.price}
                type="number"
                min="0"
                value={newMenu.price}
                onChange={(event) => setNewMenu((prev) => ({ ...prev, price: Number(event.target.value) }))}
              />
            </div>
            <div className="bg-background/60 px-3 py-2 rounded-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{labels.stock}</span>
                <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintStock}</span>
              </div>
              <input
                className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
                placeholder={labels.stock}
                type="number"
                min="0"
                value={newMenu.stock}
                onChange={(event) => setNewMenu((prev) => ({ ...prev, stock: Number(event.target.value) }))}
              />
            </div>
          </div>

          <div className="bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.orderNote}</span>
              <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintDesc}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
              placeholder={labels.orderNote}
              value={newMenu.description}
              onChange={(event) => setNewMenu((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <label className="block bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.uploadImage}</span>
              <span className="text-[10px] text-on-surface/55">{labels.menuFieldHintImage}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none file:mr-3 file:px-3 file:py-1 file:rounded-sm file:border-0 file:bg-surface-high file:text-on-surface"
              type="file"
              accept="image/*"
              onChange={(event) => setNewMenuImageFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex items-center justify-between bg-background/60 px-3 py-2 rounded-sm">
            <span className="text-xs font-semibold">{labels.status}</span>
            <button
              type="button"
              onClick={() => setNewMenu((prev) => ({ ...prev, active: !prev.active }))}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                newMenu.active ? "bg-primary/15 text-primary" : "bg-error/20 text-error",
              )}
            >
              {newMenu.active ? labels.statusAvailable : labels.statusOut}
            </button>
          </label>
          <button
            onClick={submitNewMenu}
            disabled={isSubmittingMenu}
            className="bg-neon-gradient text-on-primary-fixed px-6 py-2 rounded-sm font-bold disabled:opacity-60"
          >
            {isSubmittingMenu ? labels.uploading : labels.addMenuItem}
          </button>
        </div>

        {showIngredientPanel && (
        <div className="bg-surface-low border border-outline-variant/10 rounded-sm p-4 space-y-3">
          <h4 className="font-headline text-lg font-bold">{labels.addIngredient}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="bg-background/60 px-3 py-2 rounded-sm outline-none"
              placeholder={labels.ingredientName}
              value={newIngredient.name}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, name: event.target.value }))}
            />
            <label className="block text-xs text-on-surface/70 bg-background/60 px-3 py-2 rounded-sm">
              {labels.uploadImage}
              <input
                className="mt-1 w-full bg-background/30 px-2 py-1 rounded-sm outline-none file:mr-3 file:px-3 file:py-1 file:rounded-sm file:border-0 file:bg-surface-high file:text-on-surface"
                type="file"
                accept="image/*"
                onChange={(event) => setNewIngredientImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <input
              className="bg-background/60 px-3 py-2 rounded-sm outline-none"
              placeholder={labels.ingredientStock}
              type="number"
              min="0"
              value={newIngredient.stock}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, stock: Number(event.target.value) }))}
            />
            <input
              className="bg-background/60 px-3 py-2 rounded-sm outline-none"
              placeholder={labels.ingredientUnitCost}
              type="number"
              min="0"
              value={newIngredient.unitCost}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, unitCost: Number(event.target.value) }))}
            />
          </div>
          <button
            onClick={submitNewIngredient}
            disabled={isSubmittingIngredient}
            className="bg-neon-gradient text-on-primary-fixed px-6 py-2 rounded-sm font-bold disabled:opacity-60"
          >
            {isSubmittingIngredient ? labels.uploading : labels.addIngredient}
          </button>
        </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard title={labels.totalSkus} value={summary.totalSkus.toLocaleString()} />
        <SummaryCard title={labels.totalUnits} value={summary.totalUnits.toLocaleString()} />
        <SummaryCard title={labels.lowStock} value={summary.lowStock.toLocaleString()} />
        <SummaryCard title={labels.outOfStock} value={summary.outOfStock.toLocaleString()} />
        <SummaryCard title={labels.inventoryValue} value={formatMoney(summary.inventoryValue)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-6">
        <div className="xl:col-span-1 bg-surface-low p-1 rounded-sm overflow-x-auto border border-outline-variant/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-high">
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60">{labels.product}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.category}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">{labels.cost}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">{labels.price}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.stock}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.status}</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.remove}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filteredItems.map((item) => (
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
                  <select
                    className="w-28 bg-background/60 text-center rounded-sm px-2 py-1 text-xs outline-none"
                    value={item.category}
                    onChange={(event) => onUpdateMenuMeta(item.id, { category: event.target.value })}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-5 text-right font-mono text-sm text-on-surface/60">
                  <input
                    className="w-24 bg-background/40 text-right rounded-sm px-2 py-1 text-xs outline-none cursor-not-allowed opacity-80"
                    type="number"
                    min="0"
                    value={item.cost}
                    readOnly
                    title={labels.recipeCost}
                    aria-label={labels.recipeCost}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </td>
                <td className="px-6 py-5 text-right font-mono text-sm font-bold text-secondary">
                  <input
                    className="w-24 bg-background/60 text-right rounded-sm px-2 py-1 text-xs outline-none"
                    type="number"
                    min="0"
                    value={item.price}
                    onChange={(event) => onUpdateMenuMeta(item.id, { price: Number(event.target.value) })}
                  />
                </td>
                <td className="px-6 py-5 text-center font-mono text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onChangeStock(item.id, Math.max(0, item.stock - 1), labels.consume)}
                      className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                    >
                      -
                    </button>
                    <span>{item.stock}</span>
                    <button
                      onClick={() => onChangeStock(item.id, item.stock + 1, labels.restock)}
                      className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onChangeStock(item.id, item.stock + 5, labels.restock)}
                      className="px-2 h-5 bg-surface-high rounded-sm text-[10px] font-bold text-on-surface/60 hover:text-primary"
                    >
                      {labels.quickAdd5}
                    </button>
                    <button
                      onClick={() => onChangeStock(item.id, Math.max(0, item.stock - 5), labels.consume)}
                      className="px-2 h-5 bg-surface-high rounded-sm text-[10px] font-bold text-on-surface/60 hover:text-primary"
                    >
                      {labels.quickMinus5}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <button
                      onClick={() => onToggleMenuActive(item.id, !item.active)}
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full',
                        item.active ? 'bg-primary/15 text-primary' : 'bg-error/20 text-error',
                      )}
                      title={item.active ? 'Selling' : 'Disabled'}
                    >
                      {item.active ? labels.statusAvailable : labels.statusOut}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <button
                    onClick={() => {
                      const ok = window.confirm(`${labels.remove}: ${item.name}?`);
                      if (!ok) return;
                      onDeleteMenuItem(item.id);
                    }}
                    className="w-8 h-7 bg-surface-high rounded-sm text-on-surface/60 hover:text-error font-bold"
                    title={labels.remove}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-on-surface/50">
                  {labels.noItemsFound}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>



          <div className="bg-surface-low border border-outline-variant/10 rounded-sm p-5 space-y-6">
            <div>
              <h4 className="font-headline text-xl font-black uppercase tracking-tight mb-1">{labels.recipeBuilder}</h4>
              {selectedMenu ? (
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{selectedMenu.name}</p>
              ) : (
                <p className="text-[10px] text-on-surface/40 uppercase tracking-widest">{labels.selectMenu}</p>
              )}
            </div>

            {selectedMenu && (
              <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-background/60 rounded-sm">
                  <select
                    className="flex-1 bg-background/10 px-3 py-2 rounded-sm text-xs outline-none"
                    value={selectedIngredientId}
                    onChange={(event) => setSelectedIngredientId(event.target.value)}
                  >
                    <option value="" disabled>{labels.selectIngredient}</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({formatMoney(ing.unitCost)}/{ing.unit})</option>
                    ))}
                  </select>
                  <div className="w-24">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full bg-background/10 px-3 py-2 rounded-sm text-xs outline-none text-right font-mono"
                      placeholder="Qty"
                      value={recipeQty}
                      onChange={(event) => setRecipeQty(Number(event.target.value))}
                    />
                  </div>
                  <button
                    onClick={addIngredientToRecipe}
                    className="bg-primary text-on-primary-fixed px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-tighter hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    {labels.addToRecipe}
                  </button>
                </div>

                <div className="space-y-2 border-t border-outline-variant/10 pt-4">
                  <div className="flex justify-between items-center px-4 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/40 font-mono">{labels.recipeItems}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface/40 font-mono text-right lg:mr-10">{labels.cost}</span>
                  </div>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {recipeLines.map((line) => {
                      const ing = ingredientMap.get(line.ingredientId);
                      const lineCost = (ing?.unitCost ?? 0) * line.quantity;
                      return (
                        <div key={line.ingredientId} className="flex justify-between items-center bg-background/40 hover:bg-surface-high px-4 py-3 rounded-sm group transition-colors border border-outline-variant/10">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-sm bg-background border border-outline-variant/20 overflow-hidden">
                              <img src={ing?.image} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-xs font-bold leading-tight">{ing?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-on-surface/60 mt-1 font-mono">
                                {line.quantity} {ing?.unit} <span className="text-on-surface/30">×</span> {formatMoney(ing?.unitCost ?? 0)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-xs font-mono font-black text-secondary">{formatMoney(lineCost)}</p>
                            <button
                              onClick={() => onUpsertRecipeLine({ menuId: selectedMenuId, ingredientId: line.ingredientId, quantity: 0 })}
                              className="bg-error/10 text-error hover:bg-error/25 w-7 h-7 rounded-sm flex items-center justify-center text-sm font-bold opacity-30 group-hover:opacity-100 transition-opacity"
                              title={labels.remove}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {recipeLines.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-outline-variant/20 rounded-sm">
                        <p className="text-[10px] uppercase font-black tracking-[0.3em] text-on-surface/20">{labels.cartEmpty}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 space-y-3 pt-6 border-t border-outline-variant/20">
                  <div className="flex justify-between items-end border-b border-outline-variant/10 pb-3">
                    <span className="text-xs font-bold text-on-surface/60 uppercase tracking-widest font-headline">{labels.recipeCost}</span>
                    <span className="text-2xl font-black text-secondary font-headline italic tracking-tighter drop-shadow-[0_0_10px_rgba(233,195,73,0.3)]">{formatMoney(recipeCost)}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-outline-variant/10 pb-3">
                    <span className="text-xs font-bold text-on-surface/60 uppercase tracking-widest font-headline">{labels.price}</span>
                    <span className="text-2xl font-black text-primary font-headline italic tracking-tighter">{formatMoney(selectedMenu.price)}</span>
                  </div>
                  <div className="flex justify-between items-end bg-neon-gradient/5 p-4 rounded-sm border border-primary/20">
                    <span className="text-xs font-black text-primary uppercase tracking-[0.2em] font-headline">{labels.margin}</span>
                    <div className="text-right">
                      <p className="text-3xl font-black text-on-primary-fixed font-headline italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,82,92,0.4)]">{formatMoney(menuMargin)}</p>
                      <p className="text-[10px] font-mono text-primary font-bold">({((menuMargin / (selectedMenu.price || 1)) * 100).toFixed(1)}%)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

const IngredientsView = ({
  ingredients,
  onAddIngredient,
  onUpdateIngredient,
  onDeleteIngredient,
  labels,
  formatMoney,
}: {
  ingredients: IngredientItem[];
  onAddIngredient: (payload: {
    name: string;
    unit: string;
    unitCost: number;
    stock: number;
    category?: string;
    imageFile?: File | null;
  }) => Promise<void>;
  onUpdateIngredient: (
    ingredientId: string,
    patch: Partial<Pick<IngredientItem, 'name' | 'category' | 'stock' | 'unitCost'>>,
  ) => void;
  onDeleteIngredient: (ingredientId: string) => Promise<void>;
  labels: typeof TEXT.en;
  formatMoney: (value: number) => string;
}) => {
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    unitCost: 0,
    stock: 0,
  });
  const [newIngredientImageFile, setNewIngredientImageFile] = useState<File | null>(null);
  const [isSubmittingIngredient, setIsSubmittingIngredient] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIngredients = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return ingredients;
    return ingredients.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [ingredients, searchTerm]);

  const stockStatus = (stock: number) => {
    if (stock <= 0) return { label: labels.statusOut, cls: 'bg-error/20 text-error' };
    if (stock <= 10) return { label: labels.statusLow, cls: 'bg-secondary/20 text-secondary' };
    return { label: labels.statusAvailable, cls: 'bg-primary/15 text-primary' };
  };

  const submitNewIngredient = async () => {
    if (!newIngredient.name.trim()) return;
    setIsSubmittingIngredient(true);
    try {
      await onAddIngredient({
        name: newIngredient.name.trim(),
        unit: 'unit',
        unitCost: Math.max(0, newIngredient.unitCost),
        stock: Math.max(0, Math.floor(newIngredient.stock)),
        imageFile: newIngredientImageFile,
      });
      setNewIngredient({ name: '', unitCost: 0, stock: 0 });
      setNewIngredientImageFile(null);
    } finally {
      setIsSubmittingIngredient(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="font-mono text-primary text-sm font-bold uppercase tracking-[0.2em] mb-2">{labels.inventoryControl}</p>
        <h3 className="font-headline font-black text-4xl text-on-surface leading-none uppercase">{labels.inventoryIngredients}</h3>
      </div>

      <div className="bg-surface-low border border-outline-variant/10 rounded-sm p-4 space-y-3">
        <h4 className="font-headline text-lg font-bold">{labels.addIngredient}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.ingredientName}</span>
              <span className="text-[10px] text-on-surface/55">{labels.fieldHintName}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
              placeholder={labels.ingredientName}
              value={newIngredient.name}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <label className="block bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.uploadImage}</span>
              <span className="text-[10px] text-on-surface/55">{labels.fieldHintImage}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none file:mr-3 file:px-3 file:py-1 file:rounded-sm file:border-0 file:bg-surface-high file:text-on-surface"
              type="file"
              accept="image/*"
              onChange={(event) => setNewIngredientImageFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.ingredientStock}</span>
              <span className="text-[10px] text-on-surface/55">{labels.fieldHintStock}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
              placeholder={labels.ingredientStock}
              type="number"
              min="0"
              value={newIngredient.stock}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, stock: Number(event.target.value) }))}
            />
          </div>
          <div className="bg-background/60 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{labels.ingredientUnitCost}</span>
              <span className="text-[10px] text-on-surface/55">{labels.fieldHintCost}</span>
            </div>
            <input
              className="w-full bg-background/30 px-2 py-1 rounded-sm outline-none"
              placeholder={labels.ingredientUnitCost}
              type="number"
              min="0"
              value={newIngredient.unitCost}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, unitCost: Number(event.target.value) }))}
            />
          </div>
        </div>
        <button
          onClick={submitNewIngredient}
          disabled={isSubmittingIngredient}
          className="bg-neon-gradient text-on-primary-fixed px-6 py-2 rounded-sm font-bold disabled:opacity-60"
        >
          {isSubmittingIngredient ? labels.uploading : labels.addIngredient}
        </button>
      </div>

      <div className="bg-surface-low border border-outline-variant/10 rounded-sm p-4">
        <div className="relative w-full md:w-96 mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 w-4 h-4" />
          <input
            className="w-full bg-background/60 border-none focus:ring-1 focus:ring-primary text-on-surface pl-10 pr-4 py-3 text-xs font-mono rounded-sm tracking-widest uppercase transition-all"
            placeholder={labels.searchProducts}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            type="text"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-high">
                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60">{labels.ingredientName}</th>

                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">{labels.ingredientUnitCost}</th>
                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.ingredientStock}</th>
                <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">{labels.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredIngredients.map((item) => (
                <tr key={item.id} className="hover:bg-surface-high transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-background rounded-sm overflow-hidden">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <input
                        className="bg-background/40 px-2 py-1 rounded-sm outline-none text-sm font-semibold w-56 max-w-full"
                        value={item.name}
                        onChange={(event) => onUpdateIngredient(item.id, { name: event.target.value })}
                      />
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <input
                      className="w-28 bg-background/60 text-right rounded-sm px-2 py-1 text-xs outline-none"
                      type="number"
                      min="0"
                      value={item.unitCost}
                      onChange={(event) => onUpdateIngredient(item.id, { unitCost: Number(event.target.value) })}
                    />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onUpdateIngredient(item.id, { stock: Math.max(0, item.stock - 1) })}
                        className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                      >
                        -
                      </button>
                      <span className="font-mono">{item.stock}</span>
                      <button
                        onClick={() => onUpdateIngredient(item.id, { stock: item.stock + 1 })}
                        className="w-5 h-5 bg-surface-high rounded-sm text-on-surface/60 hover:text-primary"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full', stockStatus(item.stock).cls)}>
                        {stockStatus(item.stock).label}
                      </span>
                      <button
                        onClick={() => {
                          const ok = window.confirm(`${labels.remove}: ${item.name}?`);
                          if (!ok) return;
                          onDeleteIngredient(item.id);
                        }}
                        className="w-8 h-7 bg-surface-high rounded-sm text-on-surface/60 hover:text-error font-bold"
                        title={labels.remove}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIngredients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-on-surface/50">
                    {labels.noItemsFound}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-on-surface/50 mt-3">{labels.inventoryValue}: {formatMoney(filteredIngredients.reduce((sum, item) => sum + item.stock * item.unitCost, 0))}</p>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value }: { title: string; value: string }) => (
  <div className="bg-surface-low border border-outline-variant/10 rounded-sm px-4 py-3">
    <p className="text-[10px] uppercase tracking-widest text-on-surface/50 font-mono">{title}</p>
    <p className="font-headline font-black text-xl text-on-surface mt-1">{value}</p>
  </div>
);

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
  trucks,
  onUpsertTruck,
  onDeleteTruck,
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
  trucks: Truck[];
  onUpsertTruck: (truck: Truck) => Promise<void>;
  onDeleteTruck: (truckId: string) => Promise<void>;
}) => {
  const roleLabels: Record<StaffRole, string> = {
    Manager: labels.manager,
    Server: labels.server,
    Kitchen: labels.kitchenRole,
  };

  const [activeSettingsTab, setActiveSettingsTab] = useState<'staff' | 'permissions' | 'trucks'>('staff');
  const [selectedStaffId, setSelectedStaffId] = useState(staffMembers[0]?.id ?? '');
  const [activeRole, setActiveRole] = useState<StaffRole>('Manager');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('Server');
  const [draftPermissions, setDraftPermissions] = useState<PermissionMatrix>(permissionMatrix);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');

  // Truck states
  const [newTruckName, setNewTruckName] = useState('');
  const [newTruckLocation, setNewTruckLocation] = useState('');

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

      <div className="flex space-x-6 border-b border-outline-variant/10 mb-8">
        <button 
          onClick={() => setActiveSettingsTab('staff')}
          className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-all", activeSettingsTab === 'staff' ? "border-primary text-primary" : "border-transparent text-on-surface/40 hover:text-on-surface")}
        >
          {labels.activeStaff}
        </button>
        <button 
          onClick={() => setActiveSettingsTab('permissions')}
          className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-all", activeSettingsTab === 'permissions' ? "border-primary text-primary" : "border-transparent text-on-surface/40 hover:text-on-surface")}
        >
          {labels.posPermission}
        </button>
        <button 
          onClick={() => setActiveSettingsTab('trucks')}
          className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-all", activeSettingsTab === 'trucks' ? "border-primary text-primary" : "border-transparent text-on-surface/40 hover:text-on-surface")}
        >
          Operating Trucks
        </button>
      </div>

      {activeSettingsTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
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

          <section className="lg:col-span-8 bg-surface-low p-8 border border-outline-variant/10 rounded-sm">
             <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-40">
                <User className="w-16 h-16" />
                <h3 className="font-headline text-2xl font-black">Staff Management</h3>
                <p className="text-sm max-w-xs">Select a staff member from the left to manage their role and account credentials.</p>
             </div>
          </section>
        </div>
      )}

      {activeSettingsTab === 'permissions' && (
        <section className="space-y-8 animate-in fade-in duration-300">
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
      )}

      {activeSettingsTab === 'trucks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
           <section className="lg:col-span-4 bg-surface-low p-8 rounded-sm space-y-6 border border-outline-variant/10">
              <h4 className="font-headline text-lg font-bold">New Operating Truck</h4>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-on-surface/40 mb-1 block">Truck Name</label>
                    <input 
                       value={newTruckName}
                       onChange={e => setNewTruckName(e.target.value)}
                       placeholder="e.g. Truck #01"
                       className="w-full bg-surface-high text-on-surface px-4 py-3 rounded-sm outline-none"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-on-surface/40 mb-1 block">Location</label>
                    <input 
                       value={newTruckLocation}
                       onChange={e => setNewTruckLocation(e.target.value)}
                       placeholder="e.g. Shibuya Crossing"
                       className="w-full bg-surface-high text-on-surface px-4 py-3 rounded-sm outline-none"
                    />
                 </div>
                 <button 
                    onClick={() => {
                       if (!newTruckName) return;
                       onUpsertTruck({ id: `truck-${Date.now()}`, name: newTruckName, location: newTruckLocation, active: true });
                       setNewTruckName('');
                       setNewTruckLocation('');
                    }}
                    className="w-full bg-neon-gradient text-on-primary-fixed px-6 py-4 rounded-sm font-black uppercase text-[10px] tracking-[0.3em]"
                 >
                    Register Truck
                 </button>
              </div>
           </section>

           <section className="lg:col-span-8 bg-surface-low p-8 border border-outline-variant/10 rounded-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {trucks.map(truck => (
                    <div key={truck.id} className="p-6 bg-surface-high rounded-sm border border-outline-variant/10 flex justify-between items-center group">
                       <div>
                          <p className="font-headline font-black text-xl italic uppercase tracking-tighter">{truck.name}</p>
                          <p className="text-xs text-on-surface/50">{truck.location}</p>
                       </div>
                       <button 
                          onClick={() => onDeleteTruck(truck.id)}
                          className="p-3 text-error/40 hover:text-error hover:bg-error/10 rounded-sm transition-all"
                       >
                          <X className="w-5 h-5" />
                       </button>
                    </div>
                 ))}
                 {trucks.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-20">
                       <LayoutDashboard className="w-16 h-16 mx-auto mb-4" />
                       <p className="font-mono text-xs uppercase tracking-widest">No Active Trucks Registered</p>
                    </div>
                 )}
              </div>
           </section>
        </div>
      )}

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
  staffAccounts,
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
  staffAccounts: StaffAccount[];
}) => {
  const LOGO_URL = "https://oeeodnscuvivturnxlft.supabase.co/storage/v1/object/public/ops-media/login-bg.png";
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingStaffId, setPendingStaffId] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState(false);

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
                  {staffAccounts.filter(a => a.active).length > 0 ? (
                    <select
                      className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none appearance-none cursor-pointer"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    >
                      <option value="" disabled className="bg-surface-low text-on-surface/50">-- Select User --</option>
                      {staffAccounts.filter(a => a.active).map(acc => (
                        <option key={acc.staffId} value={acc.username} className="bg-surface-low text-on-surface">
                          {acc.username}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                      placeholder={labels.username}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      type="text"
                    />
                  )}
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none rounded-sm"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline px-1">
                  <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 font-bold">{labels.accessKey}</label>
                </div>
                <div className="relative group">
                  <input
                    className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 pr-12 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/50 hover:text-primary transition-colors cursor-pointer z-10"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none rounded-sm"></div>
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
  const [currency, setCurrency] = useState<CurrencyCode>('THB');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionState>('missing_env');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [menuRecipes, setMenuRecipes] = useState<Record<string, MenuRecipeLine[]>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [currentTruckId, setCurrentTruckId] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSION_MATRIX);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('ops_currency');
    if (saved === 'THB' || saved === 'JPY' || saved === 'USD' || saved === 'EUR') {
      setCurrency(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ops_currency', currency);
  }, [currency]);

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
    const [remoteTrucks, remoteMenu, remoteIngredients, remoteOrders, remoteStaff, remotePermissions, remoteAccounts] = await Promise.all([
      fetchTrucks(),
      fetchMenuItems(),
      fetchIngredients(),
      fetchOrders(),
      fetchStaffMembers(),
      fetchRolePermissions(),
      fetchStaffAccounts(),
    ]);

    if (remoteTrucks) {
      setTrucks(remoteTrucks);
      if (remoteTrucks.length > 0 && !currentTruckId) {
        setCurrentTruckId(remoteTrucks[0].id);
      }
    }
    if (remoteMenu) {
      setMenuItems(
        remoteMenu.map((item) => ({
          ...item,
          active: typeof item.active === 'boolean' ? item.active : true,
        })),
      );
    }
    if (remoteIngredients) {
      setIngredients(
        remoteIngredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          category: ingredient.category,
          unit: ingredient.unit,
          unitCost: ingredient.unitCost,
          stock: ingredient.stock,
          image: ingredient.image || `https://picsum.photos/seed/${ingredient.id}/300/300`,
        })),
      );
    }
    if (remoteOrders) {
      setOrders(remoteOrders);
    }
    if (remoteStaff) {
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
    if (remotePermissions) {
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
    if (remoteAccounts) {
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
        if (remoteStaff) {
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
        if (remoteAccounts) {
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
          if (remoteMenu) {
            setMenuItems(
              remoteMenu.map((item) => ({
                ...item,
                active: typeof item.active === 'boolean' ? item.active : true,
              })),
            );
          }
        });
      },
      onIngredientsChange: () => {
        fetchIngredients().then((remoteIngredients) => {
          if (!remoteIngredients) return;
          setIngredients(
            remoteIngredients.map((ingredient) => ({
              id: ingredient.id,
              name: ingredient.name,
              category: ingredient.category,
              unit: ingredient.unit,
              unitCost: ingredient.unitCost,
              stock: ingredient.stock,
              image: ingredient.image || `https://picsum.photos/seed/${ingredient.id}/300/300`,
            })),
          );
        });
      },
      onOrdersChange: () => {
        fetchOrders().then((remoteOrders) => {
          if (remoteOrders) setOrders(remoteOrders);
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

  const lastProcessedOrderIds = useRef<string[]>([]);
  useEffect(() => {
    if (orders.length === 0) return;
    
    const currentIds = orders.map(o => o.id);
    const prevIds = lastProcessedOrderIds.current;
    
    if (prevIds.length > 0) {
      const newIds = currentIds.filter(id => !prevIds.includes(id));
      const hasNewIncomingOrders = orders.some(o => 
        newIds.includes(o.id) && 
        o.status === 'new' && 
        (!currentTruckId || o.truckId === currentTruckId)
      );

      if (hasNewIncomingOrders && isSoundEnabled) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.warn('[audio] blocked', e));
      }
    }
    
    lastProcessedOrderIds.current = currentIds;
  }, [orders, isSoundEnabled, currentTruckId]);

  const handleChangeStock = (itemId: string, nextStock: number, reason?: string) => {
    let movement: InventoryMovement | null = null;
    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const clampedStock = Math.max(0, nextStock);
        const delta = clampedStock - item.stock;
        if (delta !== 0) {
          movement = {
            id: `mv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: item.id,
            itemName: item.name,
            prevStock: item.stock,
            nextStock: clampedStock,
            delta,
            reason: reason ?? (delta > 0 ? labels.restock : labels.consume),
            timestamp: Date.now(),
          };
        }
        return { ...item, stock: clampedStock };
      }),
    );

    if (movement) {
      setInventoryMovements((prev) => [movement as InventoryMovement, ...prev].slice(0, 120));
    }

    if (supabaseStatus === 'connected') {
      updateMenuItemStock(itemId, Math.max(0, nextStock)).catch(() => {
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
      truckId: currentTruckId || undefined,
    };
    setOrders((prev) => [localOrder, ...prev].slice(0, 50));

    if (supabaseStatus === 'connected') {
      const remoteOrder = await insertOrder(localOrder);
      if (remoteOrder) {
        setOrders((prev) => [remoteOrder, ...prev.filter((order) => order.id !== localOrder.id)].slice(0, 50));
      }
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
    if (supabaseStatus === 'connected') {
      await updateOrderStatus(orderId, status);
    }
  };

  const handleAddMenuItem = async (payload: {
    name: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    imageFile?: File | null;
    description: string;
    recipeLines?: MenuRecipeLine[];
    active?: boolean;
  }) => {
    const uploadedImage =
      supabaseStatus === 'connected' && payload.imageFile
        ? await uploadOpsImage(payload.imageFile, 'menus')
        : null;
    const nextId = `m-${Date.now().toString(36)}`;
    const skuPrefix = (payload.category || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
    const nextItem: MenuItem = {
      id: nextId,
      name: payload.name,
      category: payload.category,
      price: Math.max(0, payload.price),
      cost: Math.max(0, payload.cost),
      stock: Math.max(0, Math.floor(payload.stock)),
      sku: `${skuPrefix}-${Math.floor(Math.random() * 900 + 100)}`,
      image:
        uploadedImage ||
        (payload.imageFile ? URL.createObjectURL(payload.imageFile) : '') ||
        `https://picsum.photos/seed/menu-${Date.now()}/400/300`,
      description: payload.description,
      active: payload.active ?? true,
    };
    setMenuItems((prev) => [nextItem, ...prev]);
    if (payload.recipeLines && payload.recipeLines.length > 0) {
      setMenuRecipes((prev) => ({ ...prev, [nextItem.id]: payload.recipeLines ?? [] }));
    }
    if (supabaseStatus === 'connected') {
      const remote = await insertMenuItem(nextItem);
      if (remote) {
        setMenuItems((prev) =>
          prev.map((item) => (item.id === nextItem.id ? remote : item)),
        );
      }
    }
  };

  const handleAddIngredient = async (payload: {
    name: string;
    unit: string;
    unitCost: number;
    stock: number;
    category?: string;
    imageFile?: File | null;
  }) => {
    const uploadedImage =
      supabaseStatus === 'connected' && payload.imageFile
        ? await uploadOpsImage(payload.imageFile, 'ingredients')
        : null;
    const nextIngredient: IngredientItem = {
      id: `ing-${Date.now().toString(36)}`,
      name: payload.name,
      category: payload.category?.trim() || 'General',
      unit: payload.unit,
      unitCost: Math.max(0, payload.unitCost),
      stock: Math.max(0, Math.floor(payload.stock)),
      image:
        uploadedImage ||
        (payload.imageFile ? URL.createObjectURL(payload.imageFile) : '') ||
        `https://picsum.photos/seed/ing-${Date.now()}/300/300`,
    };
    setIngredients((prev) => [nextIngredient, ...prev]);
    if (supabaseStatus === 'connected') {
      const remote = await insertIngredient(nextIngredient);
      if (remote) {
        setIngredients((prev) =>
          prev.map((item) =>
            item.id === nextIngredient.id
              ? {
                  ...item,
                  id: remote.id,
                  name: remote.name,
                  category: remote.category,
                  unit: remote.unit,
                  unitCost: remote.unitCost,
                  stock: remote.stock,
                  image: remote.image || item.image,
                }
              : item,
          ),
        );
      }
    }
  };

  const handleUpsertRecipeLine = (payload: {
    menuId: string;
    ingredientId: string;
    quantity: number;
  }) => {
    const safeQty = Math.max(0.01, payload.quantity);
    setMenuRecipes((prev) => {
      const existing = prev[payload.menuId] ?? [];
      const foundIndex = existing.findIndex((line) => line.ingredientId === payload.ingredientId);
      const nextLines = [...existing];
      if (foundIndex >= 0) {
        nextLines[foundIndex] = { ...nextLines[foundIndex], quantity: safeQty };
      } else {
        nextLines.push({ ingredientId: payload.ingredientId, quantity: safeQty });
      }

      const nextCost = nextLines.reduce((sum, line) => {
        const ingredient = ingredients.find((item) => item.id === line.ingredientId);
        return sum + (ingredient ? ingredient.unitCost * line.quantity : 0);
      }, 0);

      let updatedMenu: MenuItem | null = null;
      setMenuItems((prevMenu) =>
        prevMenu.map((item) => {
          if (item.id !== payload.menuId) return item;
          updatedMenu = { ...item, cost: nextCost };
          return updatedMenu;
        }),
      );
      if (supabaseStatus === 'connected' && updatedMenu) {
        insertMenuItem(updatedMenu).catch(() => {
          console.warn('[supabase] update menu cost failed');
        });
      }

      return {
        ...prev,
        [payload.menuId]: nextLines,
      };
    });
  };

  const handleUpdateIngredient = (
    ingredientId: string,
    patch: Partial<Pick<IngredientItem, 'name' | 'category' | 'stock' | 'unitCost'>>,
  ) => {
    let updatedIngredient: IngredientItem | null = null;
    setIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== ingredientId) return item;
        updatedIngredient = {
          ...item,
          ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
          ...(typeof patch.category === 'string' ? { category: patch.category } : {}),
          ...(typeof patch.stock === 'number' && Number.isFinite(patch.stock)
            ? { stock: Math.max(0, Math.floor(patch.stock)) }
            : {}),
          ...(typeof patch.unitCost === 'number' && Number.isFinite(patch.unitCost)
            ? { unitCost: Math.max(0, patch.unitCost) }
            : {}),
        };
        return updatedIngredient;
      }),
    );

    if (supabaseStatus === 'connected' && updatedIngredient) {
      insertIngredient(updatedIngredient).catch(() => {
        console.warn('[supabase] update ingredient failed');
      });
    }
  };

  const handleDeleteIngredient = async (ingredientId: string) => {
    setIngredients((prev) => prev.filter((item) => item.id !== ingredientId));
    if (supabaseStatus === 'connected') {
      const ok = await deleteIngredient(ingredientId);
      if (!ok) {
        console.warn('[supabase] delete ingredient failed');
        fetchIngredients().then((remote) => {
          if (!remote || remote.length === 0) return;
          setIngredients(
            remote.map((ingredient) => ({
              id: ingredient.id,
              name: ingredient.name,
              category: ingredient.category,
              unit: ingredient.unit,
              unitCost: ingredient.unitCost,
              stock: ingredient.stock,
              image: ingredient.image || `https://picsum.photos/seed/${ingredient.id}/300/300`,
            })),
          );
        });
      }
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
    setMenuRecipes((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    if (supabaseStatus === 'connected') {
      const ok = await deleteMenuItem(itemId);
      if (!ok) {
        console.warn('[supabase] delete menu item failed');
        fetchMenuItems().then((remote) => {
          if (!remote || remote.length === 0) return;
          setMenuItems(
            remote.map((item) => ({
              ...item,
              active: typeof item.active === 'boolean' ? item.active : true,
            })),
          );
        });
      }
    }
  };

  const handleToggleMenuActive = async (itemId: string, active: boolean) => {
    let updated: MenuItem | null = null;
    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        updated = { ...item, active };
        return updated;
      }),
    );
    if (supabaseStatus === 'connected' && updated) {
      await insertMenuItem(updated);
    }
  };

  const handleUpdateMenuMeta = (
    itemId: string,
    patch: Partial<Pick<MenuItem, 'category' | 'cost' | 'price'>>,
  ) => {
    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          ...(typeof patch.category === 'string' ? { category: patch.category } : {}),
          ...(typeof patch.cost === 'number' && Number.isFinite(patch.cost)
            ? { cost: Math.max(0, patch.cost) }
            : {}),
          ...(typeof patch.price === 'number' && Number.isFinite(patch.price)
            ? { price: Math.max(0, patch.price) }
            : {}),
        };
      }),
    );
  };

  const kitchenOrders = useMemo(() => toKitchenOrders(orders), [orders]);
  const labels = TEXT[language];
  const formatMoney = (value: number) => formatCurrencyAmount(value, currency, language);
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

  const handleUpsertTruck = async (truck: Truck) => {
    setTrucks(prev => {
      const exists = prev.find(t => t.id === truck.id);
      if (exists) return prev.map(t => t.id === truck.id ? truck : t);
      return [...prev, truck];
    });
    if (supabaseStatus === 'connected') {
      await upsertTruck(truck);
    }
  };

  const handleDeleteTruck = async (truckId: string) => {
    setTrucks(prev => prev.filter(t => t.id !== truckId));
    if (supabaseStatus === 'connected') {
      await deleteTruck(truckId);
    }
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
    setCurrentUser(matchedStaff);
    setView('dashboard');
    setMobileMenuOpen(false);
    return { ok: true };
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView('login');
    setMobileMenuOpen(false);
  };

  const handleUpdateUserImage = async (file: File) => {
    if (!currentUser) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setStaffMembers(prev => prev.map(s => s.id === currentUser.id ? { ...s, image: dataUrl } : s));
        setCurrentUser(prev => prev ? { ...prev, image: dataUrl } : null);
      }
    };
    reader.readAsDataURL(file);

    if (supabaseStatus === 'connected') {
      const publicUrl = await uploadOpsImage(file, 'staff');
      if (publicUrl) {
        const updatedStaff = { ...currentUser, image: publicUrl };
        await upsertStaffMember(updatedStaff);
        setStaffMembers(prev => prev.map(s => s.id === currentUser.id ? updatedStaff : s));
        setCurrentUser(updatedStaff);
      }
    }
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
        staffAccounts={staffAccounts}
      />
    );
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': 
        return (
          <DashboardView 
            orders={orders.filter(o => !currentTruckId || o.truckId === currentTruckId)} 
            menuItems={menuItems.filter(item => !currentTruckId || item.truckId === currentTruckId)} 
            labels={labels} 
            formatMoney={formatMoney} 
            onViewHistory={() => setView('orderHistory')}
          />
        );
      case 'orderHistory':
        return (
          <OrderHistoryView 
            orders={orders.filter(o => !currentTruckId || o.truckId === currentTruckId)} 
            labels={labels} 
            formatMoney={formatMoney} 
          />
        );
      case 'orders': 
        return (
          <POSView 
            menuItems={menuItems.filter(item => !currentTruckId || item.truckId === currentTruckId)} 
            onSubmitOrder={handleSubmitOrder} 
            labels={labels} 
            formatMoney={formatMoney} 
          />
        );
      case 'inventoryMenu':
        return (
          <MenuView
            menuItems={menuItems}
            onChangeStock={handleChangeStock}
            inventoryMovements={inventoryMovements}
            ingredients={ingredients}
            menuRecipes={menuRecipes}
            onAddMenuItem={handleAddMenuItem}
            onAddIngredient={handleAddIngredient}
            onUpsertRecipeLine={handleUpsertRecipeLine}
            onUpdateMenuMeta={handleUpdateMenuMeta}
            onDeleteMenuItem={handleDeleteMenuItem}
            onToggleMenuActive={handleToggleMenuActive}
            formatMoney={formatMoney}
            showIngredientPanel={false}
            labels={labels}
          />
        );
      case 'inventoryIngredients':
        return (
          <IngredientsView
            ingredients={ingredients}
            onAddIngredient={handleAddIngredient}
            onUpdateIngredient={handleUpdateIngredient}
            onDeleteIngredient={handleDeleteIngredient}
            labels={labels}
            formatMoney={formatMoney}
          />
        );
      case 'kitchen': 
        return (
          <KitchenView 
            kitchenOrders={kitchenOrders.filter(o => !currentTruckId || o.dbStatus === 'delivered' || orders.find(ord => ord.id === o.id)?.truckId === currentTruckId)} 
            onUpdateStatus={handleUpdateOrderStatus} 
            labels={labels} 
            isSoundEnabled={isSoundEnabled}
            onToggleSound={setIsSoundEnabled}
          />
        );
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
            trucks={trucks}
            onUpsertTruck={handleUpsertTruck}
            onDeleteTruck={handleDeleteTruck}
          />
        );
      default: 
        return (
          <DashboardView 
            orders={orders.filter(o => !currentTruckId || o.truckId === currentTruckId)} 
            menuItems={menuItems.filter(item => !currentTruckId || item.truckId === currentTruckId)} 
            labels={labels} 
            formatMoney={formatMoney} 
            onViewHistory={() => setView('orderHistory')}
          />
        );
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'dashboard': return labels.adminDashboard;
      case 'orders': return labels.posTerminal;
      case 'inventoryIngredients': return labels.inventoryIngredients;
      case 'inventoryMenu': return labels.inventoryMenu;
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
          currency={currency}
          onChangeCurrency={setCurrency}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          trucks={trucks}
          currentTruckId={currentTruckId}
          onTruckChange={setCurrentTruckId}
          currentUser={currentUser}
          onLogout={handleLogout}
          onUpdateUserImage={handleUpdateUserImage}
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
