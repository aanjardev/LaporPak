/**
 * Village API client for multi-desa support.
 */

import { getBrowserAccessToken } from "./supabase/browser";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getBrowserAccessToken();

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

export interface VillageAIPersonality {
  name: string;
  emoji: string;
  vibe: string;
  welcome_message: string;
  custom_greetings: string[];
  tone: string;
}

export interface VillageMetadata {
  ai_personality: VillageAIPersonality;
  is_ai_enabled: boolean;
  whatsapp_business_name?: string;
  logo_url?: string;
  primary_color?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
}

export interface Village {
  id: string;
  name: string;
  level: string;
  parent_id?: string;
  metadata: VillageMetadata;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VillageStats {
  total_reports: number;
  pending_reports: number;
  resolved_reports: number;
  total_requests: number;
  pending_requests: number;
  knowledge_documents: number;
  whatsapp_connected: boolean;
}

export interface VillageDetail extends Village {
  stats: VillageStats;
}

export interface VillageListResponse {
  items: Village[];
  total: number;
}

export interface WhatsAppChannelInfo {
  phone_number?: string;
  is_connected: boolean;
  connected_at?: string;
  last_message_at?: string;
}

export interface VillageChannelResponse {
  village_id: string;
  whatsapp: WhatsAppChannelInfo;
}

// ============================================================================
// Village API Functions
// ============================================================================

/**
 * Get list of villages accessible to current admin.
 */
export async function getMyVillages(): Promise<VillageListResponse> {
  return apiFetch<VillageListResponse>("/api/v1/villages/me");
}

/**
 * Get list of all villages (system admin).
 */
export async function getVillages(params?: {
  page?: number;
  page_size?: number;
  level?: string;
  is_active?: boolean;
  search?: string;
}): Promise<VillageListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
  if (params?.level) searchParams.set("level", params.level);
  if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return apiFetch<VillageListResponse>(`/api/v1/villages${query ? `?${query}` : ""}`);
}

/**
 * Get village details including statistics.
 */
export async function getVillage(villageId: string): Promise<VillageDetail> {
  return apiFetch<VillageDetail>(`/api/v1/villages/${villageId}`);
}

/**
 * Create a new village (system admin only).
 */
export async function createVillage(data: {
  name: string;
  level?: string;
  parent_id?: string;
  metadata?: VillageMetadata;
}): Promise<Village> {
  return apiFetch<Village>("/api/v1/villages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update a village (system admin only).
 */
export async function updateVillage(
  villageId: string,
  data: {
    name?: string;
    parent_id?: string;
    is_active?: boolean;
    metadata?: VillageMetadata;
  }
): Promise<Village> {
  return apiFetch<Village>(`/api/v1/villages/${villageId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a village (soft delete, system admin only).
 */
export async function deleteVillage(villageId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/villages/${villageId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// WhatsApp Channel API Functions
// ============================================================================

/**
 * Get WhatsApp connection status for a village.
 */
export async function getWhatsAppStatus(villageId: string): Promise<WhatsAppChannelInfo> {
  return apiFetch<WhatsAppChannelInfo>(`/api/v1/villages/${villageId}/whatsapp/status`);
}

/**
 * Initialize WhatsApp connection for a village.
 */
export async function initWhatsAppConnection(villageId: string): Promise<{
  status: string;
  connection_token: string;
  village_id: string;
  village_name: string;
  instructions?: Record<string, string>;
  message: string;
}> {
  return apiFetch(`/api/v1/villages/${villageId}/whatsapp/init`, {
    method: "POST",
  });
}

/**
 * Link a WhatsApp phone number to a village.
 */
export async function linkWhatsAppPhone(
  villageId: string,
  phoneNumber: string
): Promise<{
  status: string;
  phone_number: string;
  village_id: string;
  village_name: string;
  message: string;
}> {
  return apiFetch(`/api/v1/villages/${villageId}/whatsapp/link-phone?phone_number=${encodeURIComponent(phoneNumber)}`, {
    method: "POST",
  });
}

/**
 * Disconnect WhatsApp from a village.
 */
export async function disconnectWhatsApp(villageId: string): Promise<void> {
  return apiFetch(`/api/v1/villages/${villageId}/whatsapp/disconnect`, {
    method: "DELETE",
  });
}

// ============================================================================
// OpenClaw Integration API Functions
// ============================================================================

/**
 * Get OpenClaw configuration for a village.
 */
export async function getOpenClawConfig(villageId: string): Promise<{
  village_id: string;
  village_name: string;
  workspace_path: string;
  openclaw_api_url: string;
  openclaw_api_key?: string;
  instructions: string[];
}> {
  return apiFetch(`/api/v1/villages/${villageId}/openclaw/config`);
}

/**
 * Generate OpenClaw workspace for a village.
 */
export async function generateOpenClawWorkspace(villageId: string): Promise<{
  status: string;
  village_id: string;
  village_name: string;
  files: Record<string, string>;
  message: string;
}> {
  return apiFetch(`/api/v1/villages/${villageId}/openclaw/generate-workspace`, {
    method: "POST",
  });
}

// ============================================================================
// Village Admin Management API Functions
// ============================================================================

/**
 * List admins for a village.
 */
export async function listVillageAdmins(villageId: string): Promise<Array<{
  id: string;
  display_name?: string;
  role: string;
  is_active: boolean;
  assigned_at: string;
}>> {
  return apiFetch(`/api/v1/villages/${villageId}/admins`);
}
