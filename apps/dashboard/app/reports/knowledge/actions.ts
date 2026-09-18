"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminAccessToken } from "@/lib/auth";
import {
  createKnowledgeDocument,
  deactivateKnowledgeDocument,
  KnowledgeApiError,
  updateKnowledgeDocument,
} from "@/lib/knowledge";

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
    handleAuthError(error, "/reports/knowledge");
    return { message: error instanceof KnowledgeApiError && error.status === 422
      ? invalidMessage
      : "Sumber belum dapat disimpan. Isi formulir tetap tersedia untuk dicoba lagi." };
  }
  revalidatePath("/reports/knowledge");
  redirect("/reports/knowledge?saved=1");
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

  const returnPath = `/reports/knowledge/${encodeURIComponent(id)}`;
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
  revalidatePath("/reports/knowledge");
  revalidatePath(returnPath);
  redirect(`${returnPath}?saved=1`);
}

export async function deactivateKnowledgeAction(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) redirect("/reports/knowledge?error=invalid");
  try {
    await deactivateKnowledgeDocument(id, await getAdminAccessToken());
  } catch (error) {
    handleAuthError(error, "/reports/knowledge");
    redirect(`/reports/knowledge?error=${error instanceof KnowledgeApiError && error.status === 404 ? "not-found" : "delete"}`);
  }
  revalidatePath("/reports/knowledge");
  redirect("/reports/knowledge?deleted=1");
}
