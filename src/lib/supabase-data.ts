import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type DbMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  sku: string;
  image: string;
  description: string;
  active?: boolean;
  truckId?: string;
};

export type DbOrderLine = {
  name: string;
  qty: number;
  station: 'HOT' | 'COLD';
};

export type DbOrder = {
  id: string;
  customer: string;
  items: string;
  total: number;
  status: 'new' | 'preparing' | 'delivered';
  time: string;
  type?: 'dine-in' | 'takeout';
  createdAt?: number;
  note?: string;
  lineItems?: DbOrderLine[];
  truckId?: string;
};

export type DbTruck = {
  id: string;
  name: string;
  location: string;
  active: boolean;
};

export type StaffRole = 'Manager' | 'Server' | 'Kitchen';

export type DbStaffMember = {
  id: string;
  name: string;
  role: StaffRole;
  image?: string;
  active?: boolean;
};

export type DbRolePermission = {
  role: StaffRole;
  dashboard: boolean;
  kitchen: boolean;
  pos: boolean;
  inventory: boolean;
  staff: boolean;
};

export type DbStaffAccount = {
  staffId: string;
  username: string;
  passwordHash: string;
  active: boolean;
  mustChangePassword: boolean;
};

export type DbIngredient = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  stock: number;
  image: string;
};

const getStorageBucketName = () =>
  String(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? 'ops-media').trim() || 'ops-media';

const normalizeMenuItem = (row: any): DbMenuItem => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  category: String(row.category ?? 'Uncategorized'),
  price: Number(row.price ?? 0),
  cost: Number(row.cost ?? 0),
  stock: Number(row.stock ?? 0),
  sku: String(row.sku ?? ''),
  image: String(row.image ?? ''),
  description: String(row.description ?? ''),
  active: typeof row.is_active === 'boolean' ? row.is_active : typeof row.active === 'boolean' ? row.active : true,
  truckId: row.truck_id ? String(row.truck_id) : undefined,
});

const normalizeOrder = (row: any): DbOrder => {
  const rawLineItems = Array.isArray(row.line_items) ? row.line_items : [];
  const lineItems = rawLineItems
    .map((item: any) => ({
      name: String(item?.name ?? ''),
      qty: Number(item?.qty ?? 1),
      station: item?.station === 'COLD' ? 'COLD' : 'HOT',
    }))
    .filter((item: DbOrderLine) => item.name.length > 0);

  const rawCreatedAt = row.created_at ?? row.createdAt;
  const createdAt =
    typeof rawCreatedAt === 'number'
      ? rawCreatedAt
      : rawCreatedAt
        ? new Date(rawCreatedAt).getTime()
        : undefined;

  return {
    id: String(row.id),
    customer: String(row.customer ?? 'Guest'),
    items: String(row.items ?? ''),
    total: Number(row.total ?? 0),
    status: row.status === 'preparing' || row.status === 'delivered' ? row.status : 'new',
    time: String(row.time ?? ''),
    type: row.type === 'takeout' ? 'takeout' : 'dine-in',
    createdAt,
    note: typeof row.note === 'string' ? row.note : undefined,
    lineItems,
    truckId: row.truck_id ? String(row.truck_id) : undefined,
  };
};

const normalizeTruck = (row: any): DbTruck => ({
  id: String(row.id),
  name: String(row.name ?? 'Unnamed Truck'),
  location: String(row.location ?? ''),
  active: Boolean(row.is_active ?? true),
});

const normalizeStaffMember = (row: any): DbStaffMember => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  role: row.role === 'Server' || row.role === 'Kitchen' ? row.role : 'Manager',
  image: typeof row.image === 'string' ? row.image : undefined,
  active: Boolean(row.is_active ?? true),
});

const normalizeRolePermission = (row: any): DbRolePermission => ({
  role: row.role === 'Server' || row.role === 'Kitchen' ? row.role : 'Manager',
  dashboard: Boolean(row.dashboard_access ?? row.dashboard ?? false),
  kitchen: Boolean(row.kitchen_ops ?? row.kitchen ?? false),
  pos: Boolean(row.pos_terminal ?? row.pos ?? false),
  inventory: Boolean(row.inventory_mgmt ?? row.inventory ?? false),
  staff: Boolean(row.staff_permissions ?? row.staff ?? false),
});

const normalizeStaffAccount = (row: any): DbStaffAccount => ({
  staffId: String(row.staff_id ?? ''),
  username: String(row.username ?? ''),
  passwordHash: String(row.password_hash ?? ''),
  active: Boolean(row.is_active ?? true),
  mustChangePassword: Boolean(row.must_change_password ?? true),
});

const normalizeIngredient = (row: any): DbIngredient => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  category: String(row.category ?? 'General'),
  unit: String(row.unit ?? 'unit'),
  unitCost: Number(row.unit_cost ?? row.unitCost ?? 0),
  stock: Number(row.stock ?? 0),
  image: String(row.image ?? ''),
});

export const uploadOpsImage = async (
  file: File,
  pathPrefix: 'menus' | 'ingredients' | 'staff',
): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const bucket = getStorageBucketName();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const filePath = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || undefined,
    });
    if (error) return null;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
};

export const fetchMenuItems = async (truckId?: string): Promise<DbMenuItem[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('menu_items')
      .select('id,name,category,price,cost,stock,sku,image,description,is_active,truck_id');
    
    if (truckId) {
      query = query.eq('truck_id', truckId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error || !data) return null;
    return data.map(normalizeMenuItem);
  } catch {
    return null;
  }
};

export const insertMenuItem = async (item: DbMenuItem): Promise<DbMenuItem | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost: item.cost,
      stock: item.stock,
      sku: item.sku,
      image: item.image,
      description: item.description,
      is_active: item.active ?? true,
      truck_id: item.truckId || null,
    };
    const { data, error } = await supabase.from('menu_items').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeMenuItem(data);
  } catch {
    return null;
  }
};

export const deleteMenuItem = async (itemId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
    return !error;
  } catch {
    return false;
  }
};

export const fetchOrders = async (truckId?: string): Promise<DbOrder[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('orders')
      .select('id,customer,items,total,status,time,type,created_at,note,line_items,truck_id');
    
    if (truckId) {
      query = query.eq('truck_id', truckId);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

    if (error || !data) return null;
    return data.map(normalizeOrder);
  } catch {
    return null;
  }
};

export const fetchIngredients = async (): Promise<DbIngredient[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ingredients')
      .select('id,name,category,unit,unit_cost,stock,image')
      .order('name', { ascending: true });
    if (error || !data) return null;
    return data.map(normalizeIngredient);
  } catch {
    return null;
  }
};

export const insertIngredient = async (ingredient: DbIngredient): Promise<DbIngredient | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      unit: ingredient.unit,
      unit_cost: ingredient.unitCost,
      stock: ingredient.stock,
      image: ingredient.image,
    };
    const { data, error } = await supabase.from('ingredients').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeIngredient(data);
  } catch {
    return null;
  }
};

export const deleteIngredient = async (ingredientId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('ingredients').delete().eq('id', ingredientId);
    return !error;
  } catch {
    return false;
  }
};

export const fetchStaffMembers = async (): Promise<DbStaffMember[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staff_members')
      .select('id,name,role,image,is_active')
      .order('name', { ascending: true });
    if (error || !data) return null;
    return data.map(normalizeStaffMember);
  } catch {
    return null;
  }
};

export const fetchRolePermissions = async (): Promise<DbRolePermission[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role,dashboard_access,kitchen_ops,pos_terminal,inventory_mgmt,staff_permissions');
    if (error || !data) return null;
    return data.map(normalizeRolePermission);
  } catch {
    return null;
  }
};

export const fetchStaffAccounts = async (): Promise<DbStaffAccount[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staff_accounts')
      .select('staff_id,username,password_hash,is_active,must_change_password');
    if (error || !data) return null;
    return data.map(normalizeStaffAccount);
  } catch {
    return null;
  }
};

export const insertOrder = async (order: DbOrder): Promise<DbOrder | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      id: order.id,
      customer: order.customer,
      items: order.items,
      total: order.total,
      status: order.status,
      time: order.time,
      type: order.type ?? 'dine-in',
      note: order.note ?? null,
      line_items: order.lineItems ?? [],
      created_at: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      truck_id: order.truckId || null,
    };
    const { data, error } = await supabase.from('orders').insert(payload).select().single();
    if (error || !data) return null;
    return normalizeOrder(data);
  } catch {
    return null;
  }
};

export const updateMenuItemStock = async (itemId: string, stock: number): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('menu_items').update({ stock }).eq('id', itemId);
    return !error;
  } catch {
    return false;
  }
};

export const updateOrderStatus = async (orderId: string, status: DbOrder['status']): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    return !error;
  } catch {
    return false;
  }
};

export const fetchTrucks = async (): Promise<DbTruck[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('trucks')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data) return null;
    return data.map(normalizeTruck);
  } catch {
    return null;
  }
};

export const upsertTruck = async (truck: DbTruck): Promise<DbTruck | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      id: truck.id,
      name: truck.name,
      location: truck.location,
      is_active: truck.active,
    };
    const { data, error } = await supabase.from('trucks').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeTruck(data);
  } catch {
    return null;
  }
};

export const deleteTruck = async (truckId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('trucks').delete().eq('id', truckId);
    return !error;
  } catch {
    return false;
  }
};

export const upsertStaffMember = async (member: DbStaffMember): Promise<DbStaffMember | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      id: member.id,
      name: member.name,
      role: member.role,
      image: member.image ?? null,
      is_active: member.active ?? true,
    };
    const { data, error } = await supabase.from('staff_members').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeStaffMember(data);
  } catch {
    return null;
  }
};

export const upsertRolePermission = async (permission: DbRolePermission): Promise<DbRolePermission | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      role: permission.role,
      dashboard_access: permission.dashboard,
      kitchen_ops: permission.kitchen,
      pos_terminal: permission.pos,
      inventory_mgmt: permission.inventory,
      staff_permissions: permission.staff,
    };
    const { data, error } = await supabase.from('role_permissions').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeRolePermission(data);
  } catch {
    return null;
  }
};

export const upsertStaffAccount = async (account: DbStaffAccount): Promise<DbStaffAccount | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const payload = {
      staff_id: account.staffId,
      username: account.username,
      password_hash: account.passwordHash,
      is_active: account.active,
      must_change_password: account.mustChangePassword,
    };
    const { data, error } = await supabase.from('staff_accounts').upsert(payload).select().single();
    if (error || !data) return null;
    return normalizeStaffAccount(data);
  } catch {
    return null;
  }
};

export const updateStaffPassword = async ({
  staffId,
  passwordHash,
}: {
  staffId: string;
  passwordHash: string;
}): Promise<DbStaffAccount | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('staff_accounts')
      .update({
        password_hash: passwordHash,
        must_change_password: false,
      })
      .eq('staff_id', staffId)
      .select()
      .single();

    if (error || !data) return null;
    return normalizeStaffAccount(data);
  } catch {
    return null;
  }
};

export const deleteStaffMember = async (staffId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('staff_members').delete().eq('id', staffId);
    return !error;
  } catch {
    return false;
  }
};

export const subscribeToOpsRealtime = ({
  onMenuItemsChange,
  onOrdersChange,
  onIngredientsChange,
  onStaffChange,
  onPermissionsChange,
  onStaffAccountsChange,
}: {
  onMenuItemsChange: () => void;
  onOrdersChange: () => void;
  onIngredientsChange?: () => void;
  onStaffChange?: () => void;
  onPermissionsChange?: () => void;
  onStaffAccountsChange?: () => void;
}) => {
  if (!isSupabaseConfigured()) return () => {};
  try {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('ops-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        onMenuItemsChange();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        onOrdersChange();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => {
        onIngredientsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, () => {
        onStaffChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, () => {
        onPermissionsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_accounts' }, () => {
        onStaffAccountsChange?.();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  } catch {
    return () => {};
  }
};
