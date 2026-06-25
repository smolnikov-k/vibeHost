const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface BillingPeriodInfo {
  months: number;
  pricePerMonth: number;
  discount: number;
  total: number;
}

export interface BillingStatus {
  plan: 'FREE' | 'PRO';
  aiCredits: number;
  priceRub: number;
  billingPeriods: Record<string, BillingPeriodInfo>;
  subscription: {
    status: 'INACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    priceRub: number;
    billingPeriod: number;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    hasAutopayment: boolean;
  } | null;
}

class ApiClient {
  // Clean up legacy client-side token storage (localStorage + JS cookie).
  // Auth is now handled exclusively via httpOnly cookie set by the backend.
  private clearLegacyTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vibe_token');
      const domainAttr = location.hostname.endsWith('.hostingvibe.ru') || location.hostname === 'hostingvibe.ru'
        ? '; domain=.hostingvibe.ru' : '';
      document.cookie = `vibe_token=; path=/; max-age=0${domainAttr}`;
    }
  }

  /** @deprecated No longer stores tokens client-side. Kept for call-site compat. */
  setToken(token: string | null) {
    if (!token) this.clearLegacyTokens();
  }

  /** @deprecated Auth is cookie-based. Returns null. */
  getToken(): string | null {
    return null;
  }

  async fetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Don't set Content-Type for FormData (browser sets boundary automatically)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include', // send httpOnly cookie
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Auto-logout on expired/invalid JWT (skip auth probes and auth pages to avoid redirect loops)
      if (res.status === 401) {
        const isAuthProbe = ['/auth/login', '/auth/register', '/auth/me'].some(p => path.startsWith(p));
        if (!isAuthProbe) {
          this.clearLegacyTokens();
          if (typeof window !== 'undefined') {
            const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
            if (!authPages.some(p => window.location.pathname.startsWith(p))) {
              window.location.href = '/login';
            }
          }
        }
      }
      throw new ApiError(res.status, data.error || data.message || 'Request failed');
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // Auth — backend sets httpOnly cookie; we no longer store tokens client-side
  async register(email: string, password: string, displayName?: string) {
    this.clearLegacyTokens();
    const data = await this.fetch<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    return data;
  }

  async login(email: string, password: string) {
    this.clearLegacyTokens();
    const data = await this.fetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
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

  async verifyEmail(data: { code?: string; token?: string }) {
    return this.fetch<{ success: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendVerification() {
    return this.fetch<{ success: boolean; message: string }>('/auth/resend-verification', {
      method: 'POST',
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

  getQrUrl(projectId: string, format: 'png' | 'svg' = 'png', size: number = 300) {
    return `${API_URL}/projects/${projectId}/qr?format=${format}&size=${size}`;
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
    onStatus: (data: { status: string; errorMessage?: string | null; buildLog?: string | null }) => void,
    onDone?: () => void,
  ): () => void {
    const url = `${API_URL}/projects/${projectId}/deployments/${deploymentId}/stream`;
    // Important: no JWT in query string. For cross-origin API_URL, withCredentials makes browser send vibe_token cookie.
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onStatus(data);
        if (['LIVE', 'FAILED', 'SUPERSEDED', 'PREVIEW'].includes(data.status)) {
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

  async publishDeploy(projectId: string, deploymentId: string) {
    return this.fetch<{ message: string; status: string }>(`/projects/${projectId}/deployments/${deploymentId}/publish`, {
      method: 'POST',
    });
  }

  async getVersions(projectId: string) {
    return this.fetch<{ versions: Version[]; maxVersions: number; plan: string }>(`/projects/${projectId}/versions`);
  }

  async deleteVersion(projectId: string, version: number) {
    return this.fetch<{ message: string }>(`/projects/${projectId}/versions/${version}`, {
      method: 'DELETE',
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

  async updateProfile(data: { displayName?: string; phone?: string }) {
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

  async getAdminUsers(params?: { page?: number; q?: string; plan?: string; banned?: string; sort?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.q) sp.set('q', params.q);
    if (params?.plan) sp.set('plan', params.plan);
    if (params?.banned) sp.set('banned', params.banned);
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return this.fetch<{ users: AdminUser[]; pagination: { page: number; totalPages: number; total: number } }>(`/admin/users${qs ? `?${qs}` : ''}`);
  }

  async getAdminProjects(params?: { page?: number; q?: string; status?: string; sort?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.q) sp.set('q', params.q);
    if (params?.status) sp.set('status', params.status);
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return this.fetch<{ projects: AdminProject[]; pagination: { page: number; totalPages: number; total: number } }>(`/admin/projects${qs ? `?${qs}` : ''}`);
  }

  async getAdminProjectDetail(projectId: string) {
    return this.fetch<any>(`/admin/projects/${projectId}`);
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
    // Auth is sent via cookie (domain=.hostingvibe.ru) — no JWT in URL
    const params = new URLSearchParams();
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
    return this.fetch<{ available: boolean; error?: string }>(`/slugs/check?slug=${encodeURIComponent(slug)}`);
  }

  async logout() {
    this.clearLegacyTokens();
    try {
      await this.fetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort — cookie may already be expired
    }
  }

  // Billing
  async getBillingStatus(): Promise<BillingStatus> {
    return this.fetch<BillingStatus>('/billing/status');
  }

  async createPayment(autoRenew?: boolean, period?: number): Promise<{ paymentUrl: string }> {
    return this.fetch<{ paymentUrl: string }>('/billing/create-payment', {
      method: 'POST',
      body: JSON.stringify({ autoRenew: autoRenew ?? true, period: period ?? 1 }),
    });
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

  // QR Codes
  async getQrCodes(projectId: string) {
    return this.fetch<{ qrCodes: QrCodeStyle[]; maxQrCodes: number; plan: string }>(`/projects/${projectId}/qr-codes`);
  }

  async createQrCode(projectId: string, data: QrCodeInput) {
    return this.fetch<{ qrCode: QrCodeStyle }>(`/projects/${projectId}/qr-codes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQrCode(projectId: string, qrId: string, data: QrCodeInput) {
    return this.fetch<{ qrCode: QrCodeStyle }>(`/projects/${projectId}/qr-codes/${qrId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteQrCode(projectId: string, qrId: string) {
    return this.fetch<{ success: boolean }>(`/projects/${projectId}/qr-codes/${qrId}`, {
      method: 'DELETE',
    });
  }

  // Admin extended methods
  async exportAdminUsers(): Promise<void> {
    const res = await fetch(`${API_URL}/admin/users/export`, { credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportAdminProjects(): Promise<void> {
    const res = await fetch(`${API_URL}/admin/projects/export`, { credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Maintenance mode
  async getMaintenanceStatus() {
    return this.fetch<{ enabled: boolean }>('/admin/maintenance');
  }

  async setMaintenance(enabled: boolean) {
    return this.fetch<{ enabled: boolean }>('/admin/maintenance', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async getAdminTimeline(days?: number) {
    const params = days ? `?days=${days}` : '';
    return this.fetch<{ date: string; registrations: number; deploys: number; payments: number }[]>(`/admin/stats/timeline${params}`);
  }

  async getAdminUserDetail(userId: string) {
    return this.fetch<any>(`/admin/users/${userId}`);
  }

  async updateAdminUser(userId: string, data: { plan?: string; isBanned?: boolean; storageLimit?: number }) {
    return this.fetch<any>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminSubscriptions(page?: number) {
    const params = page ? `?page=${page}` : '';
    return this.fetch<{ subscriptions: any[]; pagination: any }>(`/admin/subscriptions${params}`);
  }

  async getAdminPayments() {
    return this.fetch<{ payments: any[] }>('/admin/payments');
  }

  async updateAdminSubscription(subId: string, data: { status: string }) {
    return this.fetch<any>(`/admin/subscriptions/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAdminDomains() {
    return this.fetch<{ domains: any[] }>('/admin/domains');
  }

  async getAdminDeployments(page?: number, status?: string) {
    const sp = new URLSearchParams();
    if (page) sp.set('page', String(page));
    if (status) sp.set('status', status);
    const qs = sp.toString();
    return this.fetch<{ deployments: any[]; pagination: any }>(`/admin/deployments${qs ? `?${qs}` : ''}`);
  }

  async getAdminSystem() {
    return this.fetch<{ cpu: any; ram: any; disk: any; uptime: number; pm2: any[] }>('/admin/system');
  }

  async getAdminAuditLog(page?: number, action?: string, targetType?: string) {
    const sp = new URLSearchParams();
    if (page) sp.set('page', String(page));
    if (action) sp.set('action', action);
    if (targetType) sp.set('targetType', targetType);
    const qs = sp.toString();
    return this.fetch<{ logs: any[]; pagination: any }>(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  }

  // Admin backups
  async getAdminBackups() {
    return this.fetch<{ backups: { name: string; size: number; createdAt: string }[] }>('/admin/backups');
  }

  async createAdminBackup() {
    return this.fetch<{ backup: { name: string; size: number; createdAt: string } }>('/admin/backups/create', {
      method: 'POST',
    });
  }

  async downloadAdminBackup(filename: string): Promise<void> {
    const res = await fetch(`${API_URL}/admin/backups/${encodeURIComponent(filename)}/download`, { credentials: 'include' });
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Admin blog methods
  async getAdminArticles(page?: number, status?: string, search?: string) {
    const sp = new URLSearchParams();
    if (page) sp.set('page', String(page));
    if (status) sp.set('status', status);
    if (search) sp.set('search', search);
    const qs = sp.toString();
    return this.fetch<{ articles: any[]; pagination: any }>(`/admin/blog${qs ? `?${qs}` : ''}`);
  }

  async createAdminArticle(data: any) {
    return this.fetch<any>('/admin/blog', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAdminArticle(id: string) {
    return this.fetch<any>(`/admin/blog/${id}`);
  }

  async updateAdminArticle(id: string, data: any) {
    return this.fetch<any>(`/admin/blog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAdminArticle(id: string) {
    return this.fetch<{ success: boolean }>(`/admin/blog/${id}`, {
      method: 'DELETE',
    });
  }

  async publishAdminArticle(id: string) {
    return this.fetch<any>(`/admin/blog/${id}/publish`, {
      method: 'POST',
    });
  }

  async unpublishAdminArticle(id: string) {
    return this.fetch<any>(`/admin/blog/${id}/unpublish`, {
      method: 'POST',
    });
  }

  async uploadBlogImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.fetch<{ url: string }>('/admin/blog/upload-image', {
      method: 'POST',
      body: formData,
    });
  }

  // Blog (public, no auth)
  async getBlogArticles(params?: { page?: number; limit?: number; tag?: string; search?: string }) {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.tag) sp.set('tag', params.tag);
    if (params?.search) sp.set('search', params.search);
    const qs = sp.toString();
    const res = await fetch(`${API_URL}/blog${qs ? `?${qs}` : ''}`, { next: { revalidate: 60 } } as RequestInit);
    if (!res.ok) throw new ApiError(res.status, 'Failed to fetch articles');
    return res.json() as Promise<BlogListResponse>;
  }

  async getBlogTags() {
    const res = await fetch(`${API_URL}/blog/tags`, { next: { revalidate: 300 } } as RequestInit);
    if (!res.ok) throw new ApiError(res.status, 'Failed to fetch tags');
    return res.json() as Promise<BlogTag[]>;
  }

  async getBlogArticle(slug: string) {
    const res = await fetch(`${API_URL}/blog/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } } as RequestInit);
    if (!res.ok) throw new ApiError(res.status, 'Failed to fetch article');
    return res.json() as Promise<BlogArticle>;
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
  phone: string | null;
  plan: 'FREE' | 'PRO';
  isAdmin?: boolean;
  storageUsed: number;
  storageLimit: number;
  emailVerified?: boolean;
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
  status: 'PENDING' | 'EXTRACTING' | 'BUILDING' | 'PREVIEW' | 'LIVE' | 'FAILED' | 'SUPERSEDED';
  errorMessage: string | null;
  buildLog: string | null;
  previewSlug: string | null;
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
  users: { total: number; pro: number; recentWeek: number; newToday: number; newMonth: number; banned: number };
  projects: { total: number; live: number; sitesOnDisk: number };
  deploys: { recentWeek: number };
  storage: { totalBytes: number; totalMB: number };
  subscriptions: { active: number };
  domains: { total: number };
  forms: { total: number };
  errors: { deploys: number };
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'FREE' | 'PRO';
  isAdmin: boolean;
  isBanned: boolean;
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

export interface Version {
  version: number;
  createdAt: string;
  sizeBytes: number;
  isCurrent: boolean;
  status: string;
  hasBackup: boolean;
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

export interface QrCodeStyle {
  id: string;
  projectId: string;
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fgColor: string;
  bgColor: string;
  dotStyle: string;
  cornerSquareStyle: string;
  cornerDotStyle: string;
  createdAt: string;
  updatedAt: string;
}

export type QrCodeInput = Partial<Omit<QrCodeStyle, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;

// Blog types
export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImage: string | null;
  author: { displayName: string | null };
  status: string;
  publishedAt: string | null;
  viewCount: number;
  readTime: number;
  metaTitle: string | null;
  metaDesc: string | null;
  ogImage: string | null;
  tags: string[];
  createdAt: string;
}

export interface BlogListResponse {
  articles: Omit<BlogArticle, 'content' | 'metaTitle' | 'metaDesc' | 'ogImage' | 'status' | 'createdAt'>[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  tags: BlogTag[];
}

export interface BlogTag {
  name: string;
  count: number;
}

export const api = new ApiClient();
