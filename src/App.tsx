import React, { useState } from 'react';
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
  AlertTriangle
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

// --- Types ---

type View = 'dashboard' | 'orders' | 'menu' | 'kitchen' | 'settings' | 'login';

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

// --- Components ---

const Sidebar = ({ activeView, setView }: { activeView: View; setView: (v: View) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Receipt },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const LOGO_URL = "https://storage.googleapis.com/static.antigravity.dev/projects/0921448f-9bed-4b83-8a10-06ddbaef767f/logo.png";

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-low flex flex-col py-8 z-50">
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
            onClick={() => setView(item.id as View)}
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
          Support
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) => {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md flex justify-between items-center px-8 py-4 w-full">
      <div className="flex items-center gap-6">
        <h2 className="font-headline font-black text-xl text-on-surface uppercase tracking-tighter">{title}</h2>
        {subtitle && (
          <>
            <div className="h-4 w-[1px] bg-outline-variant/30"></div>
            <div className="flex items-center gap-2 text-primary font-bold font-headline text-sm">
              {subtitle}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button className="bg-neon-gradient text-on-primary-fixed px-6 py-2 rounded-sm font-headline font-bold text-sm hover:opacity-90 active:scale-95 transition-all">
          New Order
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

// --- Views ---

const DashboardView = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mx-0 order-ticker py-2 px-6 flex items-center justify-between rounded-sm bg-secondary/20 text-secondary border border-secondary/30">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-sm tracking-tighter">LIVE STATUS</span>
          <div className="flex gap-4 text-xs font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary rounded-full"></span> 12 New</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary/50 rounded-full"></span> 5 Preparing</span>
          </div>
        </div>
        <div className="font-mono text-sm font-bold">14:32:05 PM</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm">
          <TrendingUp className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">Total Revenue</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">¥428,500</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-secondary">
              <TrendingUp className="w-4 h-4" />
              <span>+12.5% from yesterday</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-low p-6 relative overflow-hidden group rounded-sm">
          <ShoppingBag className="absolute top-0 right-0 p-4 w-24 h-24 text-primary opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative z-10">
            <p className="font-mono text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">Orders Today</p>
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">184</h3>
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
            <h3 className="font-headline text-4xl font-black text-on-surface tracking-tighter">¥2,328</h3>
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
          <h2 className="font-headline text-2xl font-bold tracking-tight mb-6">Inventory Alerts</h2>
          <div className="space-y-6 flex-1">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-surface-highest overflow-hidden">
                  <img src="https://picsum.photos/seed/miso/100/100" alt="Miso" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-sm font-bold">Miso Paste (Red)</p>
                  <p className="text-xs text-error font-medium">Critical: 1.2kg left</p>
                </div>
              </div>
              <button className="p-2 hover:bg-error/10 text-error transition-colors rounded-sm">
                <ShoppingCart className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sm bg-surface-highest overflow-hidden">
                  <img src="https://picsum.photos/seed/butter/100/100" alt="Butter" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-sm font-bold">AOP French Butter</p>
                  <p className="text-xs text-secondary font-medium">Low Stock: 4 units</p>
                </div>
              </div>
              <button className="p-2 hover:bg-secondary/10 text-secondary transition-colors rounded-sm">
                <ShoppingCart className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button className="w-full mt-8 py-3 text-xs font-bold tracking-[0.2em] uppercase border border-outline-variant/30 hover:border-primary/50 transition-all text-on-surface/80">
            View Full Inventory
          </button>
        </div>
      </div>

      <div className="bg-surface-low rounded-sm overflow-hidden">
        <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-headline text-2xl font-bold tracking-tight">Recent Orders</h2>
          <div className="flex gap-6 items-center">
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-error-container text-on-surface text-[10px] font-black uppercase tracking-tighter">NEW: 12</span>
              <span className="px-3 py-1 bg-secondary/20 text-secondary text-[10px] font-black uppercase tracking-tighter">PREP: 05</span>
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
            {RECENT_ORDERS.map((order) => (
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

const POSView = () => {
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
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

  return (
    <div className="flex h-[calc(100vh-4rem)] animate-in fade-in duration-500">
      <div className="flex-1 overflow-y-auto p-8 pr-4 custom-scrollbar">
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button key={cat} className={cn(
              "px-6 py-2 rounded-full text-sm whitespace-nowrap transition-colors font-bold",
              cat === 'All Items' ? "bg-primary text-on-primary-fixed" : "bg-surface-high text-on-surface/70 hover:text-on-surface"
            )}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MENU_ITEMS.map(item => (
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

      <aside className="w-96 bg-surface-low flex flex-col border-l border-outline-variant/10 shadow-2xl">
        <div className="p-6 pb-4">
          <div className="bg-background p-1 rounded-sm flex items-center">
            <button className="flex-1 py-2 text-xs font-bold font-headline rounded-sm bg-primary text-on-primary-fixed uppercase tracking-wider">In-Person</button>
            <button className="flex-1 py-2 text-xs font-bold font-headline rounded-sm text-on-surface/40 hover:text-on-surface uppercase tracking-wider">Delivery</button>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="font-headline font-bold text-xl uppercase tracking-tighter">Current Order</h2>
            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5">#2489</span>
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
                    <button className="w-6 h-6 flex items-center justify-center bg-surface-high rounded-sm text-on-surface/60 hover:text-primary active:scale-90">-</button>
                    <span className="text-xs font-mono">{i.qty}</span>
                    <button className="w-6 h-6 flex items-center justify-center bg-surface-high rounded-sm text-on-surface/60 hover:text-primary active:scale-90">+</button>
                  </div>
                  <button className="text-xs text-error/60 hover:text-error transition-colors uppercase font-mono">Remove</button>
                </div>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
              <ShoppingBag className="w-12 h-12 mb-4" />
              <p className="font-headline font-bold uppercase tracking-widest text-xs">Cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-background border-t border-outline-variant/10">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-mono text-on-surface/60">
              <span>Subtotal</span>
              <span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs font-mono text-on-surface/60">
              <span>Tax (10%)</span>
              <span>¥{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-headline font-black pt-2 border-t border-outline-variant/10 text-primary">
              <span>TOTAL</span>
              <span>¥{total.toLocaleString()}</span>
            </div>
          </div>
          <button className="w-full py-5 bg-neon-gradient text-on-primary-fixed font-headline font-extrabold text-lg uppercase tracking-widest rounded-sm shadow-xl hover:shadow-primary/20 active:scale-95 transition-all duration-200">
            Submit Order
          </button>
        </div>
      </aside>
    </div>
  );
};

const KitchenView = () => {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {KITCHEN_ORDERS.map((order) => (
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

const MenuView = () => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <p className="font-mono text-primary text-sm font-bold uppercase tracking-[0.2em] mb-2">Inventory Control</p>
          <h3 className="font-headline font-black text-4xl text-on-surface leading-none uppercase">The Atelier Stock</h3>
        </div>
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/40 w-4 h-4" />
            <input 
              className="w-full bg-surface-low border-none focus:ring-1 focus:ring-primary text-on-surface pl-10 pr-4 py-3 text-xs font-mono rounded-sm tracking-widest uppercase transition-all" 
              placeholder="SEARCH PRODUCTS..." 
              type="text"
            />
          </div>
          <button className="bg-neon-gradient text-on-primary-fixed font-headline font-bold text-sm uppercase px-8 py-3 rounded-sm shadow-xl active:scale-95 transition-all">
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-surface-low p-1 rounded-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-high">
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60">Product</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">Category</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">Cost</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">Price</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">Stock</th>
              <th className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {MENU_ITEMS.map((item) => (
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
                <td className="px-6 py-5 text-center font-mono text-sm">{item.stock}</td>
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

const SettingsView = () => {
  const staff = [
    { name: 'Kenji Sato', role: 'Manager', image: 'https://picsum.photos/seed/kenji/100/100' },
    { name: 'Léa Dubois', role: 'Kitchen', image: 'https://picsum.photos/seed/lea/100/100' },
    { name: 'Marcus Thorne', role: 'Server', image: 'https://picsum.photos/seed/marcus/100/100', active: true },
    { name: 'Yuki Tanaka', role: 'Server', image: 'https://picsum.photos/seed/yuki/100/100' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-outline-variant/10 pb-8">
        <div className="space-y-1">
          <p className="font-mono text-secondary text-xs uppercase tracking-widest">Administrative Control</p>
          <h3 className="font-headline text-4xl font-extrabold tracking-tighter">Staff & Permissions</h3>
        </div>
        <button className="bg-neon-gradient text-on-primary-fixed px-8 py-4 rounded-sm font-headline text-sm font-bold active:scale-95 transition-all shadow-xl flex items-center">
          <Plus className="mr-2 w-5 h-5" />
          ADD STAFF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 bg-surface-low p-6 rounded-sm space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-headline text-lg font-bold">Active Staff</h4>
            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">12 Members</span>
          </div>
          <div className="space-y-4">
            {staff.map((s, idx) => (
              <div key={idx} className={cn(
                "group flex items-center p-3 rounded-sm bg-surface-high transition-all hover:translate-x-1 cursor-pointer",
                s.active && "border-l-2 border-primary"
              )}>
                <img src={s.image} alt={s.name} className="w-12 h-12 rounded-sm object-cover mr-4 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                <div className="flex-1">
                  <p className="font-bold text-on-surface">{s.name}</p>
                  <p className="font-mono text-xs text-on-surface/40">{s.role}</p>
                </div>
                <ArrowRight className={cn("w-4 h-4", s.active ? "text-primary" : "text-on-surface/20")} />
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-8 space-y-8">
          <div className="flex space-x-1 bg-background p-1 rounded-sm">
            <button className="flex-1 bg-surface-high text-primary font-headline text-sm font-bold py-3 transition-all">MANAGER</button>
            <button className="flex-1 text-on-surface/50 hover:text-on-surface font-headline text-sm font-bold py-3 transition-all">SERVER</button>
            <button className="flex-1 text-on-surface/50 hover:text-on-surface font-headline text-sm font-bold py-3 transition-all">KITCHEN</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'Dashboard Access', desc: 'Overview of analytics, sales, and truck performance metrics.', icon: LayoutDashboard },
              { title: 'Kitchen Ops', desc: 'Live ticket management, prep lists, and station assignments.', icon: ChefHat },
              { title: 'POS Terminal', desc: 'Transaction handling, discounts, and payment processing.', icon: Receipt },
              { title: 'Inventory Mgmt', desc: 'Stock levels, supplier orders, and waste tracking.', icon: ShoppingBag },
            ].map((p, idx) => (
              <div key={idx} className="bg-surface-low p-6 rounded-sm relative overflow-hidden group">
                <p.icon className="absolute top-0 right-0 p-4 w-32 h-32 text-on-surface opacity-5 group-hover:opacity-10 transition-opacity" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-2">
                    <h5 className="font-headline font-bold text-xl">{p.title}</h5>
                    <p className="text-sm text-on-surface/60">{p.desc}</p>
                  </div>
                  <div className="flex items-center">
                    <input defaultChecked className="w-6 h-6 rounded-sm bg-background border-none text-primary focus:ring-primary transition-all" type="checkbox" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 space-x-4">
            <button className="px-6 py-3 font-headline text-sm font-bold text-on-surface/50 hover:text-on-surface transition-colors">DISCARD CHANGES</button>
            <button className="bg-neon-gradient text-on-primary-fixed px-10 py-3 rounded-sm font-headline text-sm font-bold shadow-lg active:scale-95 transition-transform">SAVE PERMISSIONS</button>
          </div>
        </section>
      </div>
    </div>
  );
};

const LoginView = ({ onLogin }: { onLogin: () => void }) => {
  const LOGO_URL = "https://storage.googleapis.com/static.antigravity.dev/projects/0921448f-9bed-4b83-8a10-06ddbaef767f/logo.png";

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
                <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-secondary font-bold">Street Luxury</p>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-secondary/50"></div>
              </div>
            </motion.div>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
            <div className="space-y-2">
              <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 block ml-1 font-bold">Atelier ID</label>
              <div className="relative group">
                <input 
                  className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none" 
                  placeholder="IDENTIFICATION REQUIRED" 
                  type="text"
                />
                <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-baseline px-1">
                <label className="font-mono text-[10px] tracking-widest uppercase text-primary/80 font-bold">Access Key</label>
              </div>
              <div className="relative group">
                <input 
                  className="w-full bg-black/40 border border-outline-variant/30 rounded-sm py-4 px-5 text-on-surface placeholder:text-surface-highest focus:border-primary focus:ring-0 transition-all duration-500 text-sm outline-none" 
                  placeholder="••••••••" 
                  type="password"
                />
                <div className="absolute inset-0 border border-primary/0 group-focus-within:border-primary/50 transition-all duration-500 pointer-events-none"></div>
              </div>
            </div>

            <button className="group relative w-full overflow-hidden bg-black border border-primary/30 py-5 rounded-sm active:scale-[0.98] transition-all duration-300">
              <div className="absolute inset-0 bg-neon-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="relative z-10 font-headline font-black text-on-surface group-hover:text-on-primary-fixed uppercase tracking-[0.3em] text-sm transition-colors duration-500">
                Enter Atelier
              </span>
            </button>
          </form>

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

  const handleLogin = () => {
    setIsLoggedIn(true);
    setView('dashboard');
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <DashboardView />;
      case 'orders': return <POSView />;
      case 'menu': return <MenuView />;
      case 'kitchen': return <KitchenView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'dashboard': return 'Admin Dashboard';
      case 'orders': return 'POS Terminal 01';
      case 'menu': return 'Menu Management';
      case 'kitchen': return 'Kitchen Board';
      case 'settings': return 'Settings';
      default: return 'Tokyo x Paris';
    }
  };

  const getSubtitle = () => {
    if (view === 'dashboard' || view === 'orders') {
      return (
        <>
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Truck 01 • Shibuya Crossing
        </>
      );
    }
    if (view === 'kitchen') {
      return (
        <div className="flex items-center gap-6 text-xs text-secondary font-bold">
          <span>Average Prep Time: 14m 20s</span>
          <span>8 Active Orders</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-sans">
      <Sidebar activeView={view} setView={setView} />
      
      <main className="ml-64 flex-1 flex flex-col">
        <TopBar title={getTitle()} subtitle={getSubtitle()} />
        
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
    </div>
  );
}
