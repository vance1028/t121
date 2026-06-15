const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('clinrand_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }

  return data.data as T;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<any>('/auth/me'),
  },
  trials: {
    list: () => request<any[]>('/trials'),
    get: (id: number) => request<any>(`/trials/${id}`),
    create: (data: any) => request<any>('/trials', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/trials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/trials/${id}`, { method: 'DELETE' }),
    addGroup: (trialId: number, data: any) => request<any>(`/trials/${trialId}/groups`, { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (groupId: number, data: any) => request<any>(`/trials/groups/${groupId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteGroup: (groupId: number) => request<void>(`/trials/groups/${groupId}`, { method: 'DELETE' }),
    addFactor: (trialId: number, data: any) => request<any>(`/trials/${trialId}/stratification-factors`, { method: 'POST', body: JSON.stringify(data) }),
    deleteFactor: (factorId: number) => request<void>(`/trials/stratification-factors/${factorId}`, { method: 'DELETE' }),
  },
  sites: {
    list: (trialId?: number) => request<any[]>(`/sites${trialId ? `?trial_id=${trialId}` : ''}`),
    create: (data: any) => request<any>('/sites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/sites/${id}`, { method: 'DELETE' }),
  },
  subjects: {
    list: (trialId?: number, status?: string) =>
      request<any[]>(`/subjects${trialId ? `?trial_id=${trialId}` : ''}${status ? `&status=${status}` : ''}`),
    get: (id: number) => request<any>(`/subjects/${id}`),
    create: (data: any) => request<any>('/subjects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/subjects/${id}`, { method: 'DELETE' }),
    allocate: (id: number) => request<any>(`/subjects/${id}/allocate`, { method: 'POST' }),
  },
  randomization: {
    sequences: (trialId: number) => request<any[]>(`/randomization/sequences/${trialId}`),
    generate: (trialId: number, seed?: number) =>
      request<any>(`/randomization/generate/${trialId}`, { method: 'POST', body: JSON.stringify({ seed }) }),
  },
  unblind: {
    create: (subjectId: number, reason: string) =>
      request<any>('/unblind', { method: 'POST', body: JSON.stringify({ subject_id: subjectId, reason }) }),
    records: (trialId?: number) =>
      request<any[]>(`/unblind/records${trialId ? `?trial_id=${trialId}` : ''}`),
  },
  dashboard: {
    overview: (trialId: number) => request<any>(`/dashboard/overview/${trialId}`),
    trend: (trialId: number) => request<any[]>(`/dashboard/trend/${trialId}`),
    balance: (trialId: number) => request<any[]>(`/dashboard/balance/${trialId}`),
  },
};
