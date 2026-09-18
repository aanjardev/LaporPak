"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminAccessToken } from "@/lib/auth";
import {
  createKnowledgeDocument,
  deactivateKnowledgeDocument,
  updateKnowledgeDocument,
} from "@/lib/knowledge";

const categories = new Set(["village_profile", "sop", "governance", "custom"]);

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function createKnowledgeAction(formData: FormData) {
  const title = textValue(formData, "title");
  const content = textValue(formData, "content");
  const category = textValue(formData, "category");
  if (!title || !content || !categories.has(category)) {
    redirect("/reports/knowledge?error=invalid");
  }

  const payload = new FormData();
  payload.set("title", title);
  payload.set("pasted_content", content);
  payload.set("category", category);
  payload.set("is_mandatory", String(formData.get("is_mandatory") === "on"));
  const serviceKey = textValue(formData, "service_key");
  const unitId = textValue(formData, "administrative_unit_id");
  if (serviceKey) payload.set("service_key", serviceKey);
  if (unitId) payload.set("administrative_unit_id", unitId);

  try {
    await createKnowledgeDocument(payload, await getAdminAccessToken());
  } catch {
    redirect("/reports/knowledge?error=save");
  }
  revalidatePath("/reports/knowledge");
  redirect("/reports/knowledge?saved=1");
}

export async function updateKnowledgeAction(id: string, formData: FormData) {
  const title = textValue(formData, "title");
  const content = textValue(formData, "content");
  const category = textValue(formData, "category");
  if (!title || !content || !categories.has(category)) {
    redirect(`/reports/knowledge/${id}?error=invalid`);
  }

  try {
    await updateKnowledgeDocument(
      id,
      {
        title,
        content,
        category,
        service_key: textValue(formData, "service_key") || undefined,
        is_mandatory: formData.get("is_mandatory") === "on",
      },
      await getAdminAccessToken(),
    );
  } catch {
    redirect(`/reports/knowledge/${id}?error=save`);
  }
  revalidatePath("/reports/knowledge");
  redirect(`/reports/knowledge/${id}?saved=1`);
}

export async function deactivateKnowledgeAction(formData: FormData) {
  const id = textValue(formData, "id");
  if (!id) redirect("/reports/knowledge?error=invalid");
  try {
    await deactivateKnowledgeDocument(id, await getAdminAccessToken());
  } catch {
    redirect("/reports/knowledge?error=delete");
  }
  revalidatePath("/reports/knowledge");
  redirect("/reports/knowledge?deleted=1");
}
