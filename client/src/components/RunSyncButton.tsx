import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// sessionStorage keeps the admin password for this tab only, so it is not
// left behind on a shared computer after the browser closes.
const TOKEN_KEY = "deal-intel-admin-token";

type ProviderSummary = {
  provider: string;
  status: "completed" | "failed";
  sourceCount: number;
  accepted: number;
  error?: string;
};

type SyncResult = {
  sourceCount: number;
  accepted: number;
  providers: ProviderSummary[];
  ingestion?: { processed?: number };
  scoring?: { scored?: number };
};

const PROVIDER_NAMES: Record<string, string> = {
  marketcheck: "MarketCheck",
  autodev: "Auto.dev",
};

function readSavedToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the password is simply re-asked.
  }
}

async function runSync(token: string): Promise<SyncResult> {
  const res = await fetch("/api/jobs/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("Wrong password. Check the ADMIN_TOKEN secret in Cloudflare.");
  if (res.status === 503) {
    throw new Error(
      "Manual sync isn't set up yet. In Cloudflare, add a secret named ADMIN_TOKEN to the deal-intel-sa Worker, then try again.",
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ? `Sync failed: ${body.error}` : `Sync failed (${res.status}).`);
  }
  return body as SyncResult;
}

export function RunSyncButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(readSavedToken);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (running) return;
    setOpen(next);
    if (next) {
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await runSync(token.trim());
      saveToken(token.trim());
      setResult(outcome);
      await queryClient.invalidateQueries();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Wrong password")) saveToken(null);
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-2" data-testid="button-run-sync">
          <RefreshCw className="w-4 h-4" />
          Run sync now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run market sync</DialogTitle>
          <DialogDescription>
            Pulls fresh listings from MarketCheck and Auto.dev and re-scores every deal. This can
            take a minute or two.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <form onSubmit={handleSubmit} className="space-y-4" id="run-sync-form">
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Admin password (ADMIN_TOKEN)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={running}
              autoFocus
              data-testid="input-admin-token"
            />
            {running && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing all target vehicles. Keep this window open.
              </p>
            )}
          </form>
        )}

        {error && (
          <p className="flex items-start gap-2 text-sm text-red-500" data-testid="text-sync-error">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-3 text-sm" data-testid="text-sync-result">
            <p className="flex items-center gap-2 font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Sync complete: {result.ingestion?.processed ?? result.accepted} listings saved,{" "}
              {result.scoring?.scored ?? 0} deals scored.
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {result.providers.map((provider) => (
                <li key={provider.provider}>
                  <span className="font-medium text-foreground">
                    {PROVIDER_NAMES[provider.provider] ?? provider.provider}:
                  </span>{" "}
                  {provider.status === "completed"
                    ? `${provider.sourceCount.toLocaleString()} found, ${provider.accepted.toLocaleString()} matched your filters`
                    : `failed — ${provider.error ?? "unknown error"}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button type="submit" form="run-sync-form" disabled={running || !token.trim()}>
              {running ? "Running…" : "Run sync"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
