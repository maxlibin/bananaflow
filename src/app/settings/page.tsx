import { AppLayout } from "../../components/app-shell/app-layout";
import { ProviderKeyForm } from "../../components/settings/provider-key-form";
import { clearKey, getProviderKeys, saveKey, testKey } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const keys = await getProviderKeys();
  const kie = keys.find((key) => key.provider === "kie") ?? null;

  return (
    <AppLayout
      title="Settings"
      description="Bring your own provider key. Keys are encrypted with APP_SECRET and never leave this server."
    >
      <div className="space-y-4">
        <ProviderKeyForm
          provider="kie"
          label="Kie.ai"
          helpUrl="https://kie.ai/api-key"
          lastFour={kie ? kie.lastFour : null}
          onSave={saveKey}
          onClear={clearKey}
          onTest={testKey}
        />
        <p className="text-sm text-muted-foreground">
          Every image and video model in Banana Flow runs through Kie.ai. If no key is saved here,
          the server falls back to the <code>KIE_SECRET</code> environment variable.
        </p>
      </div>
    </AppLayout>
  );
}
