const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface BillingStatus {
  plan: 'FREE' | 'PRO';
  aiCredits: number;
  subscription: {
    status: 'INACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    priceRub: number;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
  } | null;
}

class ApiClient {
  setToken(token: string | null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('vibe_token', token);
        // Mirror to cookie for Next.js middleware (server-side route protection)
        document.cookie = `vibe_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      } else {
        localStorage.removeItem('vibe_token');
        document.cookie = 'vibe_token=; path=/; max-age=0';
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vibe_token');
    }
    return null;
  }

  async fetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Read token fresh each request (multi-tab safe)
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets boundary automatically)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Auto-logout on expired/invalid JWT (skip auth endpoints to avoid loop)
      if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      throw new ApiError(res.status, data.error || data.message || 'Request failed');
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // Auth
  async register(email: string, password: string, displayName?: string) {
    const data = await this.fetch<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.fetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.fetch<User>('/auth/me');
  }

  async forgotPassword(email: string) {
    return this.fetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.fetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Files
  async getProjectFiles(projectId: string, dirPath?: string) {
    const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
    return this.fetch<{ path: string; files: FileEntry[]; total: number }>(`/projects/${projectId}/files${params}`);
  }

  // Projects
  async getProjects() {
    return this.fetch<Project[]>('/projects');
  }

  async createProject(title: string, slug: string) {
    return this.fetch<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ title, slug }),
    });
  }

  async getProject(id: string) {
    return this.fetch<Project & { deployments?: Deployment[]; domains?: Domain[] }>(`/projects/${id}`);
  }

  async updateProject(id: string, data: Partial<Pick<Project, 'title' | 'description' | 'isPublic' | 'tags'>>) {
    return this.fetch<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string) {
    return this.fetch(`/projects/${id}`, { method: 'DELETE' });
  }

  getExportUrl(projectId: string) {
    return `${API_URL}/projects/${projectId}/export`;
  }

  // Deploy
  async deploy(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.fetch<{ deploymentId: string; version: number; status: string; message: string }>(`/projects/${projectId}/deploy`, {
      method: 'POST',
      body: formData,
    });
  }

  async getDeployments(projectId: string) {
    return this.fetch<Deployment[]>(`/projects/${projectId}/deployments`);
  }

  /** SSE stream for deploy status. Returns cleanup function. */
  streamDeployStatus(
    projectId: string,
    deploymentId: string,
    onStatus: (data: { status: string; errorMessage?: string | null }) => void,
    onDone?: () => void,
  ): () => void {
    const token = this.getToken();
    const url = `${API_URL}/projects/${projectId}/deployments/${deploymentId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onStatus(data);
        if (['LIVE', 'FAILED', 'SUPERSEDED'].includes(data.status)) {
          es.close();
          onDone?.();
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => { es.close(); onDone?.(); };
    return () => es.close();
  }

  async deployGithub(projectId: string, repoUrl: string, subdir?: string) {
    return this.fetch<{ message: string; status: string; deploymentId?: string }>(`/projects/${projectId}/deploy-github`, {
      method: 'POST',
      body: JSON.stringify({ repoUrl, subdir: subdir || undefined }),
    });
  }

  async rollback(projectId: string, version: number) {
    return this.fetch<{ message: string; version: number }>(`/projects/${projectId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  }

  // Gallery
  async getGallery(params?: { q?: string; sort?: string; tag?: string; page?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.page) searchParams.set('page', String(params.page));
    const qs = searchParams.toString();
    return this.fetch<GalleryResponse>(`/gallery${qs ? `?${qs}` : ''}`);
  }

  async getGalleryTags() {
    return this.fetch<GalleryTag[]>('/gallery/meta/tags');
  }

  async toggleLike(slug: string) {
    return this.fetch<{ liked: boolean; likes: number }>(`/gallery/${slug}/like`, {
      method: 'POST',
    });
  }

  // Domains
  async getDomains() {
    return this.fetch<Domain[]>('/domains');
  }

  async addDomain(hostname: string, projectId: string) {
    return this.fetch<Domain & { instructions: DnsInstructions }>('/domains', {
      method: 'POST',
      body: JSON.stringify({ hostname, projectId }),
    });
  }

  async verifyDomain(id: string) {
    return this.fetch<{ verified: boolean; sslStatus?: string; message: string }>(`/domains/${id}/verify`, {
      method: 'POST',
    });
  }

  async deleteDomain(id: string) {
    return this.fetch<{ success: boolean }>(`/domains/${id}`, { method: 'DELETE' });
  }

  // Profile
  async changePassword(currentPassword: string, newPassword: string) {
    return this.fetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async updateProfile(data: { displayName?: string }) {
    return this.fetch<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Account
  async deleteAccount(password: string) {
    return this.fetch<{ message: string }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }

  // Admin
  async getAdminStats() {
    return this.fetch<AdminStats>('/admin/stats');
  }

  async getAdminUsers(params?: { page?: number; q?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.q) sp.set('q', params.q);
    const qs = sp.toString();
    return this.fetch<{ users: AdminUser[]; pagination: { page: number; totalPages: number; total: number } }>(`/admin/users${qs ? `?${qs}` : ''}`);
  }

  async getAdminProjects(params?: { page?: number; q?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.q) sp.set('q', params.q);
    const qs = sp.toString();
    return this.fetch<{ projects: AdminProject[]; pagination: { page: number; totalPages: number; total: number } }>(`/admin/projects${qs ? `?${qs}` : ''}`);
  }

  async suspendProject(id: string) {
    return this.fetch<{ status: string }>(`/admin/projects/${id}/suspend`, { method: 'PATCH' });
  }

  // Analytics
  async getProjectAnalytics(projectId: string, days?: number) {
    const params = days ? `?days=${days}` : '';
    return this.fetch<AnalyticsSummary>(`/projects/${projectId}/analytics${params}`);
  }

  // Report
  async reportProject(slug: string, reason: string, message?: string) {
    return this.fetch<{ success: boolean; message: string }>('/report', {
      method: 'POST',
      body: JSON.stringify({ slug, reason, message }),
    });
  }

  // Admin reports
  async getAdminReports(params?: { page?: number; status?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.status) sp.set('status', params.status);
    const qs = sp.toString();
    return this.fetch<{ reports: AdminReport[]; pagination: { page: number; totalPages: number; total: number } }>(`/admin/reports${qs ? `?${qs}` : ''}`);
  }

  async updateReportStatus(id: string, status: string) {
    return this.fetch<AdminReport>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Telegram
  async getTelegramStatus() {
    return this.fetch<TelegramStatus>('/telegram/status');
  }

  async generateTelegramLink() {
    return this.fetch<{ deepLink: string; linkCode: string }>('/telegram/generate-link', {
      method: 'POST',
    });
  }

  async unlinkTelegram() {
    return this.fetch<{ success: boolean; message: string }>('/telegram/unlink', {
      method: 'DELETE',
    });
  }

  async getFormSubmissions(page?: number) {
    const params = page ? `?page=${page}` : '';
    return this.fetch<FormSubmissionsResponse>(`/telegram/submissions${params}`);
  }

  // Visual Editor (unified /edit namespace)
  async getEditPages(projectId: string) {
    return this.fetch<{ pages: { path: string; size: number; modified: string }[] }>(`/projects/${projectId}/edit/pages`);
  }

  getEditPreviewUrl(projectId: string, pagePath?: string, slug?: string) {
    const token = this.getToken();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (pagePath) params.set('path', pagePath);
    const qs = params.toString();
    // Serve preview from the subdomain so origin matches and assets/SPA routing work
    if (slug) {
      return `https://${slug}.hostingvibe.ru/__vibe_preview${qs ? `?${qs}` : ''}`;
    }
    return `${API_URL}/internal/preview${qs ? `?${qs}` : ''}`;
  }

  async getEditPatches(projectId: string) {
    return this.fetch<{ patches: VisualPatch[] }>(`/projects/${projectId}/edit/patches`);
  }

  async createEditPatch(projectId: string, data: { selector: string; type: string; content?: string }) {
    return this.fetch<{ patch: VisualPatch }>(`/projects/${projectId}/edit/patches`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEditPatch(projectId: string, patchId: string, data: Partial<{ selector: string; type: string; content: string; enabled: boolean }>) {
    return this.fetch<{ patch: VisualPatch }>(`/projects/${projectId}/edit/patches/${patchId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEditPatch(projectId: string, patchId: string) {
    return this.fetch<{ success: boolean }>(`/projects/${projectId}/edit/patches/${patchId}`, {
      method: 'DELETE',
    });
  }

  async uploadEditAsset(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.fetch<{ src: string; name: string; type: string }>(`/projects/${projectId}/edit/assets`, {
      method: 'POST',
      body: formData,
    });
  }

  async getEditAssets(projectId: string) {
    return this.fetch<{ assets: { src: string; name: string; type: string }[] }>(`/projects/${projectId}/edit/assets`);
  }

  // Deprecated — backward compat, use getEditPatches/createEditPatch etc.
  async getPatches(projectId: string) {
    return this.getEditPatches(projectId);
  }

  async createPatch(projectId: string, data: { selector: string; xpath?: string; type: string; content?: string }) {
    return this.createEditPatch(projectId, data);
  }

  async updatePatch(projectId: string, patchId: string, data: Partial<{ selector: string; type: string; content: string; enabled: boolean }>) {
    return this.updateEditPatch(projectId, patchId, data);
  }

  async deletePatch(projectId: string, patchId: string) {
    return this.deleteEditPatch(projectId, patchId);
  }

  getPatchPreviewUrl(projectId: string) {
    return this.getEditPreviewUrl(projectId);
  }

  // Slug check
  async checkSlug(slug: string) {
    return this.fetch<{ available: boolean }>(`/slugs/check?slug=${encodeURIComponent(slug)}`);
  }

  logout() {
    this.setToken(null);
  }

  // Billing
  async getBillingStatus(): Promise<BillingStatus> {
    return this.fetch<BillingStatus>('/billing/status');
  }

  async createPayment(): Promise<{ paymentUrl: string }> {
    return this.fetch<{ paymentUrl: string }>('/billing/create-payment', { method: 'POST' });
  }

  async createAiPack(pack: '10' | '50'): Promise<{ paymentUrl: string }> {
    return this.fetch<{ paymentUrl: string }>('/billing/create-ai-pack', {
      method: 'POST',
      body: JSON.stringify({ pack }),
    });
  }

  async cancelSubscription(): Promise<{ success: boolean; message: string; currentPeriodEnd: string | null }> {
    return this.fetch('/billing/cancel', { method: 'POST' });
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'FREE' | 'PRO';
  isAdmin?: boolean;
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sizeBytes: number;
  fileCount: number;
  status: 'UPLOADING' | 'PROCESSING' | 'LIVE' | 'ERROR' | 'SUSPENDED';
  isPublic: boolean;
  tags: string[];
  likes: number;
  views: number;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  passwordEnabled?: boolean;
  metrikaId?: string | null;
  expiresAt?: string | null;
  customDomain?: string | null;
}

export interface Deployment {
  id: string;
  projectId: string;
  version: number;
  sizeBytes: number;
  fileCount: number;
  status: 'PENDING' | 'EXTRACTING' | 'LIVE' | 'FAILED' | 'SUPERSEDED';
  errorMessage: string | null;
  createdAt: string;
}

export interface GalleryProject {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isLiked?: boolean;
  tags: string[];
  likes: number;
  views: number;
  publishedAt: string | null;
  user: { displayName: string | null };
  customDomain?: string | null;
}

export interface GalleryResponse {
  projects: GalleryProject[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface GalleryTag {
  name: string;
  count: number;
}

export interface Domain {
  id: string;
  hostname: string;
  projectId: string;
  verified: boolean;
  verifyToken: string | null;
  sslStatus: 'PENDING' | 'PROVISIONING' | 'ACTIVE' | 'FAILED' | 'EXPIRED';
  createdAt: string;
  project?: { slug: string; title: string };
}

export interface DnsInstructions {
  cname: { type: string; name: string; value: string };
  txt: { type: string; name: string; value: string };
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified: string;
}

export interface AdminStats {
  users: { total: number; pro: number; recentWeek: number };
  projects: { total: number; live: number; sitesOnDisk: number };
  deploys: { recentWeek: number };
  storage: { totalBytes: number; totalMB: number };
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'FREE' | 'PRO';
  isAdmin: boolean;
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
  _count: { projects: number };
}

export interface AdminProject {
  id: string;
  title: string;
  slug: string;
  status: string;
  sizeBytes: number;
  views: number;
  likes: number;
  isPublic: boolean;
  currentVersion: number;
  createdAt: string;
  publishedAt: string | null;
  user: { email: string; displayName: string | null };
  customDomain?: string | null;
}

export interface AnalyticsSummary {
  views: { total: number; today: number; week: number; month: number };
  topPages: { path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  viewsByDay: { date: string; count: number }[];
}

export interface AdminReport {
  id: string;
  projectId: string;
  reason: string;
  message: string | null;
  reporterIp: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  project: { slug: string; title: string; status: string; customDomain?: string | null };
}

export interface TelegramStatus {
  linked: boolean;
  username?: string;
  linkedAt?: string;
}

export interface FormSubmission {
  id: string;
  formName: string | null;
  data: Record<string, string>;
  sentToTg: boolean;
  createdAt: string;
  project: { slug: string; title: string };
}

export interface FormSubmissionsResponse {
  submissions: FormSubmission[];
  pagination: { page: number; totalPages: number; total: number };
}

export interface VisualPatch {
  id: string;
  projectId: string;
  selector: string;
  xpath: string | null;
  type: 'text' | 'image' | 'hide' | 'style';
  content: string | null;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const api = new ApiClient();
