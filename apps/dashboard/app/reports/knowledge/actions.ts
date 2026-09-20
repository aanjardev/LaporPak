"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminAccessToken } from "@/lib/auth";
import {
  createKnowledgeDocument,
  deactivateKnowledgeDocument,
  KnowledgeApiError,
  reviewKnowledgeDocument,
  updateKnowledgeDocument,
} from "@/lib/knowledge";
import { knowledgeDetailPath, knowledgeSettingsPath } from "@/lib/knowledge-route";

export type KnowledgeFormState = { message: string | null };

const categories = new Set(["village_profile", "sop", "governance", "custom"]);
const invalidMessage = "Periksa judul, isi, kunci layanan, dan ID desa, lalu coba lagi.";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function handleAuthError(error: unknown, returnPath: string) {
  if (error instanceof KnowledgeApiError && error.status === 401) {
    redirect(`/login?reauth=1&next=${encodeURIComponent(returnPath)}`);
  }
  if (error instanceof KnowledgeApiError && error.status === 403) {
    redirect("/access-denied");
  }
}

export async function createKnowledgeAction(
  _state: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const title = textValue(formData, "title");
  const content = textValue(formData, "content");
  const category = textValue(formData, "category");
  const serviceKey = textValue(formData, "service_key");
  if (!title || !content || !categories.has(category) || (serviceKey && !/^[a-z0-9_-]+$/.test(serviceKey))) {
    return { message: invalidMessage };
  }

  const payload = new FormData();
  payload.set("title", title);
  payload.set("pasted_content", content);
  payload.set("category", category);
  payload.set("is_mandatory", String(formData.get("is_mandatory") === "on"));
  const unitId = textValue(formData, "administrative_unit_id");
  if (serviceKey) payload.set("service_key", serviceKey);
  if (unitId) payload.set("administrative_unit_id", unitId);

  try {
    await createKnowledgeDocument(payload, await getAdminAccessToken());
  } catch (error) {
    handleAuthError(error, knowledgeSettingsPath);
    return { message: error instanceof KnowledgeApiError && error.status === 422
      ? invalidMessage
      : "Sumber belum dapat disimpan. Isi formulir tetap tersedia untuk dicoba lagi." };
  }
  revalidatePath(knowledgeSettingsPath);
  redirect(`${knowledgeSettingsPath}?saved=1`);
}

export async function updateKnowledgeAction(
  id: string,
  _state: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const title = textValue(formData, "title");
  const content = textValue(formData, "content");
  const category = textValue(formData, "category");
  const serviceKey = textValue(formData, "service_key");
  if (!title || !content || !categories.has(category) || (serviceKey && !/^[a-z0-9_-]+$/.test(serviceKey))) {
    return { message: invalidMessage };
  }

  const returnPath = knowledgeDetailPath(id);
  try {
    await updateKnowledgeDocument(
      id,
      {
        title,
        content,
        category,
        service_key: serviceKey || undefined,
        is_mandatory: formData.get("is_mandatory") === "on",
      },
      await getAdminAccessToken(),
    );
  } catch (error) {
    handleAuthError(error, returnPath);
    if (error instanceof KnowledgeApiError && error.status === 404) {
      return { message: "Sumber tidak ditemukan atau aksesnya telah berubah. Salin isi Anda sebelum meninggalkan halaman." };
    }
    return { message: error instanceof KnowledgeApiError && error.status === 422
      ? invalidMessage
      : "Perubahan belum dapat disimpan. Isi formulir tetap tersedia untuk dicoba lagi." };
  }
  revalidatePath(knowledgeSettingsPath);
  revalidatePath(returnPath);
  redirect(`${returnPath}?saved=1`);
}

export async function deactivateKnowledgeAction(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) redirect(`${knowledgeSettingsPath}?error=invalid`);
  try {
    await deactivateKnowledgeDocument(id, await getAdminAccessToken());
  } catch (error) {
    handleAuthError(error, knowledgeSettingsPath);
    redirect(`${knowledgeSettingsPath}?error=${error instanceof KnowledgeApiError && error.status === 404 ? "not-found" : "delete"}`);
  }
  revalidatePath(knowledgeSettingsPath);
  redirect(`${knowledgeSettingsPath}?deleted=1`);
}

export async function reviewKnowledgeAction(
  id: string,
  _state: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const status = textValue(formData, "status");
  const reason = textValue(formData, "reason");
  const returnPath = knowledgeDetailPath(id);
  if (!(["approved", "rejected"] as string[]).includes(status) || !reason || reason.length > 1000) {
    return { message: "Pilih keputusan dan isi alasan 1–1000 karakter." };
  }
  try {
    await reviewKnowledgeDocument(
      id,
      { status: status as "approved" | "rejected", reason },
      await getAdminAccessToken(),
    );
  } catch (error) {
    handleAuthError(error, returnPath);
    if (error instanceof KnowledgeApiError && error.status === 404) {
      return { message: "Sumber tidak ditemukan atau berada di luar cakupan desa Anda." };
    }
    if (error instanceof KnowledgeApiError && error.status === 409) {
      return { message: "Status sumber telah berubah. Muat ulang lalu periksa kembali." };
    }
    return { message: "Keputusan review belum dapat disimpan. Silakan coba lagi." };
  }
  revalidatePath(knowledgeSettingsPath);
  revalidatePath(returnPath);
  redirect(`${returnPath}?reviewed=1`);
}
