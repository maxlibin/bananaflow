import { AppLayout } from "../../components/app-shell/app-layout";
import { ProviderKeyForm } from "../../components/settings/provider-key-form";
import { LOCAL_ENABLED_PROVIDERS } from "../../host/local/providers";
import { PROVIDERS } from "../../lib/providers/types";
import { clearKey, getProviderKeys, saveKey, testKey } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const keys = await getProviderKeys();

  return (
    <AppLayout
      title="Settings"
      description="Bring your own provider keys. Keys are encrypted with APP_SECRET and never leave this server."
    >
      <div className="space-y-4">
        {LOCAL_ENABLED_PROVIDERS.map((providerId) => {
          const info = PROVIDERS[providerId];
          const saved = keys.find((key) => key.provider === providerId) ?? null;
          return (
            <ProviderKeyForm
              key={providerId}
              provider={providerId}
              label={info.label}
              helpUrl={info.keyUrl}
              lastFour={saved ? saved.lastFour : null}
              onSave={saveKey}
              onClear={clearKey}
              onTest={testKey}
            />
          );
        })}
        <p className="text-sm text-muted-foreground">
          Google AI Studio keys unlock the Nano Banana image models and Veo video. OpenAI keys unlock
          GPT Image and Sora. If no key is saved here, the server falls back to the provider&apos;s
          environment variable (<code>GOOGLE_API_KEY</code>, <code>OPENAI_API_KEY</code>).
        </p>
      </div>
    </AppLayout>
  );
}
