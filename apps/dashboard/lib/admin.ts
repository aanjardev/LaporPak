/**
 * Admin invitation API client for multi-desa support.
 */

import { getAdminAccessToken } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAdminAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// Types
// ============================================================================

export type AdminRole = "system_admin" | "village_admin";

export interface AdminInvitation {
  id: string;
  email: string;
  role: AdminRole;
  village_id?: string;
  village_name?: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  invited_by?: string;
  invited_at: string;
  expires_at?: string;
  accepted_at?: string;
}

export interface AdminInvitationListResponse {
  items: AdminInvitation[];
  total: number;
}

export interface AdminAccount {
  id: string;
  email?: string;
  display_name?: string;
  role: AdminRole;
  villages: Array<{ id: string; name: string }>;
  is_active: boolean;
  created_at: string;
}

export interface AdminAccountListResponse {
  items: AdminAccount[];
  total: number;
}

// ============================================================================
// Invitation API Functions
// ============================================================================

/**
 * Create an invitation for a new admin.
 */
export async function createInvitation(data: {
  email: string;
  role: AdminRole;
  village_id?: string;
}): Promise<AdminInvitation> {
  return apiFetch<AdminInvitation>("/api/v1/admin/invitations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * List admin invitations.
 */
export async function getInvitations(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  role?: AdminRole;
  village_id?: string;
}): Promise<AdminInvitationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params?.status) searchParams.set("status_filter", params.status);
  if (params?.role) searchParams.set("role", params.role);
  if (params?.village_id) searchParams.set("village_id", params.village_id);

  const query = searchParams.toString();
  return apiFetch<AdminInvitationListResponse>(`/api/v1/admin/invitations${query ? `?${query}` : ""}`);
}

/**
 * Revoke an invitation.
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

/**
 * Resend an invitation.
 */
export async function resendInvitation(invitationId: string): Promise<AdminInvitation> {
  return apiFetch<AdminInvitation>(`/api/v1/admin/invitations/${invitationId}/resend`, {
    method: "POST",
  });
}

// ============================================================================
// Admin Account API Functions
// ============================================================================

/**
 * List admin accounts.
 */
export async function getAdminAccounts(params?: {
  page?: number;
  page_size?: number;
  role?: AdminRole;
  is_active?: boolean;
  search?: string;
}): Promise<AdminAccountListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params?.role) searchParams.set("role", params.role);
  if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return apiFetch<AdminAccountListResponse>(`/api/v1/admin/accounts${query ? `?${query}` : ""}`);
}

/**
 * Update an admin account.
 */
export async function updateAdminAccount(
  accountId: string,
  data: {
    display_name?: string;
    is_active?: boolean;
    role?: AdminRole;
  }
): Promise<AdminAccount> {
  return apiFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Village-Admin Membership API Functions
// ============================================================================

/**
 * Assign an admin to a village.
 */
export async function assignAdminToVillage(
  villageId: string,
  adminId: string
): Promise<{
  message: string;
  admin_id: string;
  village_id: string;
  village_name: string;
}> {
  return apiFetch(`/api/v1/admin/villages/${villageId}/admins`, {
    method: "POST",
    body: JSON.stringify({ admin_id: adminId }),
  });
}

/**
 * Remove an admin from a village.
 */
export async function removeAdminFromVillage(
  villageId: string,
  adminId: string
): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/villages/${villageId}/admins/${adminId}`, {
    method: "DELETE",
  });
}
