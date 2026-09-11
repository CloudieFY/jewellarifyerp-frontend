import { type MetalRates } from "./storage";
import { getStoredSuperAdminToken, getStoredTenantToken, useAuth } from "./auth";
import { useMemo } from "react";

const getAuthToken = (type: 'tenant' | 'superadmin', overrideToken?: string) => {
  if (overrideToken) return overrideToken;
  return type === 'superadmin' ? getStoredSuperAdminToken() : getStoredTenantToken();
};

const getHeaders = (type: 'tenant' | 'superadmin' = 'tenant', overrideToken?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken(type, overrideToken);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function apiCall<T>(
  url: string,
  options: RequestInit = {},
  authType: 'tenant' | 'superadmin' = 'tenant',
  overrideToken?: string
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(authType, overrideToken),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // If parsing fails, it's likely an HTML error page from the server (e.g., 502 Bad Gateway)
        console.error("Non-JSON Server Error:", errorText);
        throw new Error(`Server returned a non-JSON error (status ${response.status}): ${errorText.substring(0, 150)}`);
      }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Handle cases where the response body might be empty (e.g., for a 204 No Content response)
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);

  } catch (error) {
    console.error(`[API Network Error] ${url}:`, error);
    if (error instanceof TypeError) {
      // In modern browsers, CORS errors and "Failed to fetch" errors are both reported as TypeErrors.
      // We can provide a more helpful message that covers both possibilities.
      const isLikelyCors = window.location.origin !== new URL(url, window.location.origin).origin;
      if (isLikelyCors) {
        throw new Error(`CORS blocked for origin: ${window.location.origin}. Check backend's CORS_ORIGIN setting.`);
      }
      throw new Error('Network Error: Failed to fetch. Is the backend server running and accessible?');
    }
    throw error;
  }
}

export const publicAPI = {
  demoRequests: {
    create: (body: any) => apiCall<any>('/api/superadmin/demo-requests', { method: 'POST', body: JSON.stringify(body) }),
  },
};

const createApiResource = <T>(resource: string, authType: 'tenant' | 'superadmin' = 'tenant') => {
  const url = `/api/${resource}`;
  return (overrideToken?: string) => ({
    getAll: () => apiCall<T[]>(url, {}, authType, overrideToken),
    getOne: (id: string) => apiCall<T>(`${url}/${id}`, {}, authType, overrideToken),
    create: (body: Partial<T>) => apiCall<T>(url, { method: 'POST', body: JSON.stringify(body) }, authType, overrideToken),
    update: (id: string, body: Partial<T>) => apiCall<T>(`${url}/${id}`, { method: 'PUT', body: JSON.stringify(body) }, authType, overrideToken),
    remove: (id: string) => apiCall<void>(`${url}/${id}`, { method: 'DELETE' }, authType, overrideToken),
  });
};

/* -------------------------------------------------------------------------- */
/*                                Super Admin API                             */
/* -------------------------------------------------------------------------- */

export const superAdminAPI = {
  login: (credentials: { username: string, password: any }) => {
    return apiCall<{ token: string, admin: any }>(
      '/api/superadmin/login',
      { method: 'POST', body: JSON.stringify(credentials) },
      'superadmin'
    );
  },
  getMe: () => apiCall<any>('/api/superadmin/me', {}, 'superadmin'),
  shops: {
    ...createApiResource<any>('superadmin/shops', 'superadmin')(),
    // Custom actions for a specific shop
    suspend: (id: string) => apiCall<any>(`/api/superadmin/shops/${id}/suspend`, { method: 'POST' }, 'superadmin'),
    activate: (id: string) => apiCall<any>(`/api/superadmin/shops/${id}/activate`, { method: 'POST' }, 'superadmin'),
    renew: (id: string, body: { newEndDate: string, plan?: string }) =>
      apiCall<any>(`/api/superadmin/shops/${id}/renew`, { method: 'POST', body: JSON.stringify(body) }, 'superadmin'),
    resetUserPassword: (id: string, body: { username: string, role: string, newPassword: string }) =>
      apiCall<any>(
        `/api/superadmin/shops/${id}/reset-user-password`,
        { method: 'POST', body: JSON.stringify(body) },
        'superadmin'
      ),
    getUserPassword: (id: string, role: 'owner' | 'operator') =>
      apiCall<{ username: string, role: string, password: string }>(
        `/api/superadmin/shops/${id}/users/${role}/password`,
        {},
        'superadmin'
      ),
    updateSlug: (id: string, body: { slug: string }) =>
      apiCall<any>(
        `/api/superadmin/shops/${id}/update-slug`,
        { method: 'POST', body: JSON.stringify(body) },
        'superadmin'
      ),
  },
  demoRequests: {
    getAll: () => apiCall<any[]>('/api/superadmin/demo-requests', {}, 'superadmin'),
    update: (id: string, body: any) => apiCall<any>(`/api/superadmin/demo-requests/${id}`, { method: 'PUT', body: JSON.stringify(body) }, 'superadmin'),
    remove: (id: string) => apiCall<any>(`/api/superadmin/demo-requests/${id}`, { method: 'DELETE' }, 'superadmin'),
  },

  /* ------------------------------------------------------------------ */
  /*  Super Admin CRM (mounted at /api/superadmin/crm — cross-shop reads, */
  /*  per-shop :shopId writes; mirrors the shape of the tenant `crm`      */
  /*  resource above but every path is fixed to the superadmin auth type) */
  /* ------------------------------------------------------------------ */
  crm: (() => {
    const base = '/api/superadmin/crm';
    const get = <T = any>(path: string) => apiCall<T>(`${base}${path}`, {}, 'superadmin');
    const send = <T = any>(path: string, method: string, body?: any) =>
      apiCall<T>(`${base}${path}`, { method, body: body !== undefined ? JSON.stringify(body) : undefined }, 'superadmin');
    const qs = (q?: string) => (q ? `?${q}` : '');

    return {
      shops: () => get<any[]>('/shops'),
      dashboard: () => get('/dashboard'),
      users: (shopId: string) => get<any[]>(`/users/${shopId}`),

      leads: {
        list: (q?: string) => get(`/leads${qs(q)}`),
        get: (shopId: string, id: string) => get(`/leads/${shopId}/${id}`),
        create: (shopId: string, body: any) => send(`/leads/${shopId}`, 'POST', body),
        update: (shopId: string, id: string, body: any) => send(`/leads/${shopId}/${id}`, 'PATCH', body),
        remove: (shopId: string, id: string) => send(`/leads/${shopId}/${id}`, 'DELETE'),
        assign: (shopId: string, id: string, body: any) => send(`/leads/${shopId}/${id}/assign`, 'POST', body),
        qualify: (shopId: string, id: string, body?: any) => send(`/leads/${shopId}/${id}/qualify`, 'POST', body ?? {}),
        promote: (shopId: string, id: string, body?: any) => send(`/leads/${shopId}/${id}/promote`, 'POST', body ?? {}),
        convert: (shopId: string, id: string) => send(`/leads/${shopId}/${id}/convert`, 'POST'),
        activities: (shopId: string, id: string) => get(`/leads/${shopId}/${id}/activities`),
        addActivity: (shopId: string, id: string, body: any) => send(`/leads/${shopId}/${id}/activities`, 'POST', body),
      },

      opportunities: {
        list: (q?: string) => get(`/opportunities${qs(q)}`),
        pipeline: () => get('/opportunities/pipeline'),
        get: (shopId: string, id: string) => get(`/opportunities/${shopId}/${id}`),
        create: (shopId: string, body: any) => send(`/opportunities/${shopId}`, 'POST', body),
        update: (shopId: string, id: string, body: any) => send(`/opportunities/${shopId}/${id}`, 'PATCH', body),
        stage: (shopId: string, id: string, body: any) => send(`/opportunities/${shopId}/${id}/stage`, 'POST', body),
        assign: (shopId: string, id: string, body: any) => send(`/opportunities/${shopId}/${id}/assign`, 'POST', body),
        win: (shopId: string, id: string, body?: any) => send(`/opportunities/${shopId}/${id}/win`, 'POST', body ?? {}),
        lose: (shopId: string, id: string, body?: any) => send(`/opportunities/${shopId}/${id}/lose`, 'POST', body ?? {}),
        remove: (shopId: string, id: string) => send(`/opportunities/${shopId}/${id}`, 'DELETE'),
        activities: (shopId: string, id: string) => get(`/opportunities/${shopId}/${id}/activities`),
        addActivity: (shopId: string, id: string, body: any) => send(`/opportunities/${shopId}/${id}/activities`, 'POST', body),
      },

      tasks: {
        list: (q?: string) => get(`/tasks${qs(q)}`),
        get: (shopId: string, id: string) => get(`/tasks/${shopId}/${id}`),
        create: (shopId: string, body: any) => send(`/tasks/${shopId}`, 'POST', body),
        update: (shopId: string, id: string, body: any) => send(`/tasks/${shopId}/${id}`, 'PATCH', body),
        remove: (shopId: string, id: string) => send(`/tasks/${shopId}/${id}`, 'DELETE'),
        assign: (shopId: string, id: string, body: any) => send(`/tasks/${shopId}/${id}/assign`, 'POST', body),
        complete: (shopId: string, id: string, body?: any) => send(`/tasks/${shopId}/${id}/complete`, 'POST', body ?? {}),
      },

      demos: {
        list: (q?: string) => get(`/demos${qs(q)}`),
        get: (shopId: string, id: string) => get(`/demos/${shopId}/${id}`),
        create: (shopId: string, body: any) => send(`/demos/${shopId}`, 'POST', body),
        update: (shopId: string, id: string, body: any) => send(`/demos/${shopId}/${id}`, 'PATCH', body),
        assign: (shopId: string, id: string, body: any) => send(`/demos/${shopId}/${id}/assign`, 'POST', body),
        complete: (shopId: string, id: string, body: any) => send(`/demos/${shopId}/${id}/complete`, 'POST', body),
        cancel: (shopId: string, id: string, body?: any) => send(`/demos/${shopId}/${id}/cancel`, 'POST', body ?? {}),
        activities: (shopId: string, id: string) => get(`/demos/${shopId}/${id}/activities`),
        addActivity: (shopId: string, id: string, body: any) => send(`/demos/${shopId}/${id}/activities`, 'POST', body),
      },

      quotations: {
        list: (q?: string) => get(`/quotations${qs(q)}`),
        byOpportunity: (shopId: string, opportunityId: string) => get(`/quotations/by-opportunity/${shopId}/${opportunityId}`),
        get: (shopId: string, id: string) => get(`/quotations/${shopId}/${id}`),
        create: (shopId: string, body: any) => send(`/quotations/${shopId}`, 'POST', body),
        update: (shopId: string, id: string, body: any) => send(`/quotations/${shopId}/${id}`, 'PATCH', body),
        send: (shopId: string, id: string) => send(`/quotations/${shopId}/${id}/send`, 'POST'),
        accept: (shopId: string, id: string) => send(`/quotations/${shopId}/${id}/accept`, 'POST'),
        reject: (shopId: string, id: string) => send(`/quotations/${shopId}/${id}/reject`, 'POST'),
        activities: (shopId: string, id: string) => get(`/quotations/${shopId}/${id}/activities`),
        addActivity: (shopId: string, id: string, body: any) => send(`/quotations/${shopId}/${id}/activities`, 'POST', body),
      },
    };
  })(),
};

/* -------------------------------------------------------------------------- */
/*                                 Tenant API                                 */
/* -------------------------------------------------------------------------- */

export const tenantAuthAPI = {
  login: (credentials: { shopSlug: string, username: string, password: any }) => {
    // This is a special case. The login itself is unauthenticated.
    // We intentionally don't pass an overrideToken here.
    return apiCall<{ token: string; user: any; shop: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  getMe: (token?: string) => {
    return apiCall<any>('/api/auth/me', {}, 'tenant', token);
  },
  updateShop: (body: any, token?: string) => {
    return apiCall<any>('/api/auth/shop', {
      method: 'PUT',
      body: JSON.stringify(body),
    }, 'tenant', token);
  },
  updateLanguage: (language: string, token?: string) => {
    return apiCall<any>('/api/auth/language', {
      method: 'PUT',
      body: JSON.stringify({ preferredLanguage: language }),
    }, 'tenant', token);
  },
};


export const tenantApiResources = {
  goldRates: createApiResource<MetalRates>('gold-rates', 'tenant'),
  inventory: createApiResource<any>('inventory', 'tenant'),
  customers: createApiResource<any>('customers', 'tenant'),
  invoices: createApiResource<any>('invoices', 'tenant'),
  salesReturns: createApiResource<any>('sales-returns', 'tenant'),
  expenses: createApiResource<any>('expenses', 'tenant'),
  repairs: createApiResource<any>('repairs', 'tenant'),
  purchases: createApiResource<any>('purchases', 'tenant'),
  suppliers: createApiResource<any>('suppliers', 'tenant'),
  karigars: createApiResource<any>('karigars', 'tenant'),
  orders: createApiResource<any>('orders', 'tenant'),
  employees: createApiResource<any>('employees', 'tenant'),
  girvi: createApiResource<any>('girvi', 'tenant'),
  advances: createApiResource<any>('advances', 'tenant'),

  // Extended Inventory Masters
  categories: createApiResource<any>('inventory-extended/categories', 'tenant'),
  subcategories: createApiResource<any>('inventory-extended/subcategories', 'tenant'),
  brands: createApiResource<any>('inventory-extended/brands', 'tenant'),
  collections: createApiResource<any>('inventory-extended/collections', 'tenant'),
  purities: createApiResource<any>('inventory-extended/purities', 'tenant'),
  metals: createApiResource<any>('inventory-extended/metals', 'tenant'),
  stones: createApiResource<any>('inventory-extended/stones', 'tenant'),
  diamonds: createApiResource<any>('inventory-extended/diamonds', 'tenant'),
  units: createApiResource<any>('inventory-extended/units', 'tenant'),
  hsn: createApiResource<any>('inventory-extended/hsn', 'tenant'),
};

export function useTenantAPI() {
  const { tenantSession } = useAuth();
  return useMemo(() => {
    const token = tenantSession?.token;
    return {
      profile: {
        get: () => tenantAuthAPI.getMe(token).then((res) => ({ shop: res.shop })),
        update: (body: any) => tenantAuthAPI.updateShop(body, token),
      },
      goldRates: tenantApiResources.goldRates(token),
      inventory: tenantApiResources.inventory(token),
      customers: tenantApiResources.customers(token),
      invoices: tenantApiResources.invoices(token),
      salesReturns: tenantApiResources.salesReturns(token),
      expenses: tenantApiResources.expenses(token),
      repairs: tenantApiResources.repairs(token),
      purchases: {
        ...tenantApiResources.purchases(token),
        approve: (id: string) => apiCall<any>(`/api/purchases/${id}/approve`, { method: 'PATCH' }, 'tenant', token),
        reject: (id: string, reason: string) => apiCall<any>(`/api/purchases/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }, 'tenant', token),
        receive: (id: string) => apiCall<any>(`/api/purchases/${id}/receive`, { method: 'POST' }, 'tenant', token),
      },
      suppliers: tenantApiResources.suppliers(token),
      karigars: tenantApiResources.karigars(token),
      orders: tenantApiResources.orders(token),
      employees: tenantApiResources.employees(token),
      girvi: tenantApiResources.girvi(token),
      advances: tenantApiResources.advances(token),

      // Extended Inventory API methods
      categories: tenantApiResources.categories(token),
      subcategories: tenantApiResources.subcategories(token),
      brands: tenantApiResources.brands(token),
      collections: tenantApiResources.collections(token),
      purities: tenantApiResources.purities(token),
      metals: tenantApiResources.metals(token),
      stones: tenantApiResources.stones(token),
      diamonds: tenantApiResources.diamonds(token),
      units: tenantApiResources.units(token),
      hsn: tenantApiResources.hsn(token),

      stockAdjustments: {
        getAll: () => apiCall<any[]>('/api/inventory-extended/adjustments', {}, 'tenant', token),
        create: (body: any) => apiCall<any>('/api/inventory-extended/adjustments', { method: 'POST', body: JSON.stringify(body) }, 'tenant', token),
      },
      stockTransfers: {
        getAll: () => apiCall<any[]>('/api/inventory-extended/transfers', {}, 'tenant', token),
        create: (body: any) => apiCall<any>('/api/inventory-extended/transfers', { method: 'POST', body: JSON.stringify(body) }, 'tenant', token),
      },
      stockLedger: {
        get: (itemId?: string) => apiCall<any[]>(`/api/inventory-extended/ledger${itemId ? '?itemId=' + itemId : ''}`, {}, 'tenant', token),
      },

      /* ------------------------------------------------------------------ */
      /*  CRM module (PostgreSQL stack — mounted at /api/crm)               */
      /* ------------------------------------------------------------------ */
      crm: (() => {
        const base = '/api/crm';
        const get = <T = any>(path: string) => apiCall<T>(`${base}${path}`, {}, 'tenant', token);
        const send = <T = any>(path: string, method: string, body?: any) =>
          apiCall<T>(`${base}${path}`, { method, body: body !== undefined ? JSON.stringify(body) : undefined }, 'tenant', token);
        const qs = (q?: string) => (q ? `?${q}` : '');

        return {
          me: () => get('/me'),
          health: () => get('/health'),
          dashboard: () => get('/dashboard'),
          users: () => get<any[]>('/users'),
          branches: () => get<any[]>('/branches'),

          leads: {
            list: (q?: string) => get(`/leads${qs(q)}`),
            get: (id: string) => get(`/leads/${id}`),
            create: (body: any) => send('/leads', 'POST', body),
            update: (id: string, body: any) => send(`/leads/${id}`, 'PATCH', body),
            remove: (id: string) => send(`/leads/${id}`, 'DELETE'),
            assign: (id: string, body: any) => send(`/leads/${id}/assign`, 'POST', body),
            qualify: (id: string, body?: any) => send(`/leads/${id}/qualify`, 'POST', body ?? {}),
            promote: (id: string, body?: any) => send(`/leads/${id}/promote`, 'POST', body ?? {}),
            convert: (id: string, body?: any) => send(`/leads/${id}/convert`, 'POST', body ?? {}),
            activities: (id: string) => get(`/leads/${id}/activities`),
            addActivity: (id: string, body: any) => send(`/leads/${id}/activities`, 'POST', body),
          },

          opportunities: {
            list: (q?: string) => get(`/opportunities${qs(q)}`),
            pipeline: (q?: string) => get(`/opportunities/pipeline${qs(q)}`),
            get: (id: string) => get(`/opportunities/${id}`),
            create: (body: any) => send('/opportunities', 'POST', body),
            update: (id: string, body: any) => send(`/opportunities/${id}`, 'PATCH', body),
            stage: (id: string, body: any) => send(`/opportunities/${id}/stage`, 'POST', body),
            assign: (id: string, body: any) => send(`/opportunities/${id}/assign`, 'POST', body),
            win: (id: string, body?: any) => send(`/opportunities/${id}/win`, 'POST', body ?? {}),
            lose: (id: string, body?: any) => send(`/opportunities/${id}/lose`, 'POST', body ?? {}),
            remove: (id: string) => send(`/opportunities/${id}`, 'DELETE'),
            activities: (id: string) => get(`/opportunities/${id}/activities`),
            addActivity: (id: string, body: any) => send(`/opportunities/${id}/activities`, 'POST', body),
          },

          tasks: {
            list: (q?: string) => get(`/tasks${qs(q)}`),
            get: (id: string) => get(`/tasks/${id}`),
            create: (body: any) => send('/tasks', 'POST', body),
            update: (id: string, body: any) => send(`/tasks/${id}`, 'PATCH', body),
            remove: (id: string) => send(`/tasks/${id}`, 'DELETE'),
            assign: (id: string, body: any) => send(`/tasks/${id}/assign`, 'POST', body),
            complete: (id: string, body?: any) => send(`/tasks/${id}/complete`, 'POST', body ?? {}),
          },

          customers: {
            list: (q?: string) => get(`/customers${qs(q)}`),
            get: (id: string) => get(`/customers/${id}`),
            update: (id: string, body: any) => send(`/customers/${id}`, 'PATCH', body),
            activities: (id: string) => get(`/customers/${id}/activities`),
            addActivity: (id: string, body: any) => send(`/customers/${id}/activities`, 'POST', body),
          },
        };
      })(),
      openingStock: {
        getAll: () => apiCall<any[]>('/api/inventory-extended/opening-stock', {}, 'tenant', token),
        create: (body: any) => apiCall<any>('/api/inventory-extended/opening-stock', { method: 'POST', body: JSON.stringify(body) }, 'tenant', token),
      },
      inventoryReports: {
        getSummary: () => apiCall<any>('/api/inventory-extended/reports/summary', {}, 'tenant', token),
      },
    };
  }, [tenantSession]);
}
