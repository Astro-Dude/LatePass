import { notFound } from "next/navigation";
import { getByManageToken, getTemplates } from "@/lib/config";
import { env } from "@/lib/env";
import { toDraft } from "@/lib/templateDraft";
import ManageForm from "./ManageForm";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ manageToken: string }>;
}) {
  const { manageToken } = await params;
  const config = await getByManageToken(manageToken);
  if (!config) notFound();

  const templates = await getTemplates(config.id);

  return (
    <ManageForm
      manageToken={manageToken}
      baseUrl={env.appBaseUrl}
      initialSendToken={config.send_token}
      email={config.user_email}
      name={config.display_name}
      avatarUrl={config.avatar_url}
      dailyCap={config.daily_cap}
      initialTemplates={templates.map(toDraft)}
      appDownloadUrl={env.appDownloadUrl}
    />
  );
}
