export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface Trial {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'suspended';
  randomization_method: 'stratified_block' | 'minimization';
  block_sizes: number[];
  minimization_probability: number;
  seed: number;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  trial_id: number;
  name: string;
  code: string;
  ratio: number;
}

export interface StratificationFactor {
  id: number;
  trial_id: number;
  name: string;
  levels: string[];
}

export interface Site {
  id: number;
  trial_id: number;
  name: string;
  code: string;
}

export interface Subject {
  id: number;
  trial_id: number;
  site_id: number;
  subject_code: string;
  initials: string;
  age_group: string;
  gender: string;
  disease_stage: string;
  allocation_status: 'pending' | 'allocated' | 'unblinded';
  drug_code: string | null;
  group_id: number | null;
  enrolled_at: string;
  allocated_at: string | null;
  site_name?: string;
  group_name?: string;
}

export interface AllocationSequence {
  id: number;
  trial_id: number;
  stratification_key: string;
  position: number;
  group_id: number;
  drug_code: string;
  used: boolean;
  subject_id: number | null;
  used_at: string | null;
  group_name?: string;
}

export interface UnblindRecord {
  id: number;
  subject_id: number;
  unblinded_by: number;
  reason: string;
  revealed_group: string;
  unblinded_at: string;
  subject_code?: string;
  operator_name?: string;
}

export interface DashboardOverview {
  total: number;
  byGroup: { group_id: number; group_name: string; count: number; ratio: number }[];
  bySite: { site_id: number; site_name: string; count: number }[];
  enrollmentRate: number;
}

export interface DashboardTrend {
  date: string;
  count: number;
}

export interface DashboardBalance {
  factor: string;
  levels: { level: string; groups: { group_name: string; count: number }[] }[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AllocateResponse {
  drug_code: string;
  group_assigned?: string;
}
