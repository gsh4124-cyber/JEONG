export type SupabaseUser = {
  id: string;
  email?: string | null;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: SupabaseUser;
};

type SupabaseError = Error & {
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type AuthChangeCallback = (event: string, session: SupabaseSession | null) => void;

const listeners = new Set<AuthChangeCallback>();
let browserClient: SupabaseBrowserClient | null = null;

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

function storageKey(url: string) {
  return `jeong_supabase_session_v1:${url}`;
}

function toError(value: unknown, status?: number): SupabaseError {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const error = new Error(String(record.message ?? record.error_description ?? record.error ?? `Supabase request failed${status ? ` (${status})` : ""}`)) as SupabaseError;
  if (record.code) error.code = String(record.code);
  if (record.details) error.details = String(record.details);
  if (record.hint) error.hint = String(record.hint);
  if (status) error.status = status;
  return error;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

class SupabaseBrowserClient {
  private readonly url: string;
  private readonly key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private readStoredSession(): SupabaseSession | null {
    try {
      const raw = localStorage.getItem(storageKey(this.url));
      if (!raw) return null;
      const value = JSON.parse(raw) as SupabaseSession;
      return value?.access_token && value?.user?.id ? value : null;
    } catch {
      return null;
    }
  }

  private writeStoredSession(session: SupabaseSession | null) {
    if (session) localStorage.setItem(storageKey(this.url), JSON.stringify(session));
    else localStorage.removeItem(storageKey(this.url));
  }

  private normalizeSession(value: unknown): SupabaseSession {
    if (!value || typeof value !== "object") throw toError({ message: "SUPABASE_AUTH_INVALID_RESPONSE" });
    const record = value as Record<string, unknown>;
    const user = record.user as Record<string, unknown> | undefined;
    if (!record.access_token || !user?.id) throw toError(record);
    const expiresIn = Number(record.expires_in ?? 0) || undefined;
    const expiresAt = Number(record.expires_at ?? 0) || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined);
    return {
      access_token: String(record.access_token),
      refresh_token: record.refresh_token ? String(record.refresh_token) : undefined,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type: record.token_type ? String(record.token_type) : undefined,
      user: { id: String(user.id), email: user.email == null ? null : String(user.email) },
    };
  }

  private async refreshSession(session: SupabaseSession): Promise<SupabaseSession> {
    if (!session.refresh_token) return session;
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: this.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw toError(payload, response.status);
    const refreshed = this.normalizeSession(payload);
    this.writeStoredSession(refreshed);
    for (const listener of listeners) listener("TOKEN_REFRESHED", refreshed);
    return refreshed;
  }

  private async currentSession(): Promise<SupabaseSession | null> {
    let session = this.readStoredSession();
    if (!session) return null;
    if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      try { session = await this.refreshSession(session); }
      catch (error) {
        this.writeStoredSession(null);
        for (const listener of listeners) listener("SIGNED_OUT", null);
        throw error;
      }
    }
    return session;
  }

  private async userHeaders() {
    const session = await this.currentSession();
    if (!session) throw toError({ message: "SUPABASE_NOT_AUTHENTICATED" }, 401);
    return {
      apikey: this.key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  auth = {
    getSession: async () => {
      try { return { data: { session: await this.currentSession() }, error: null as SupabaseError | null }; }
      catch (error) { return { data: { session: null }, error: error as SupabaseError }; }
    },
    signInWithIdToken: async ({ provider, token, access_token }: { provider: "google"; token: string; access_token?: string }) => {
      try {
        const response = await fetch(`${this.url}/auth/v1/token?grant_type=id_token`, {
          method: "POST",
          headers: { apikey: this.key, "Content-Type": "application/json" },
          body: JSON.stringify({ provider, id_token: token, ...(access_token ? { access_token } : {}) }),
        });
        const payload = await readJson(response);
        if (!response.ok) throw toError(payload, response.status);
        const session = this.normalizeSession(payload);
        this.writeStoredSession(session);
        for (const listener of listeners) listener("SIGNED_IN", session);
        return { data: { session, user: session.user }, error: null as SupabaseError | null };
      } catch (error) {
        return { data: { session: null, user: null }, error: error as SupabaseError };
      }
    },
    signOut: async (_options?: { scope?: "local" }) => {
      this.writeStoredSession(null);
      for (const listener of listeners) listener("SIGNED_OUT", null);
      return { error: null as SupabaseError | null };
    },
    onAuthStateChange: (callback: AuthChangeCallback) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
  };

  from(table: string) {
    const client = this;
    const filters = new URLSearchParams();
    let selected = "*";
    return {
      select(columns: string) {
        selected = columns;
        return this;
      },
      eq(column: string, value: string) {
        filters.set(column, `eq.${value}`);
        return this;
      },
      async maybeSingle() {
        try {
          filters.set("select", selected);
          filters.set("limit", "1");
          const response = await fetch(`${client.url}/rest/v1/${encodeURIComponent(table)}?${filters.toString()}`, {
            headers: await client.userHeaders(),
          });
          const payload = await readJson(response);
          if (!response.ok) throw toError(payload, response.status);
          const rows = Array.isArray(payload) ? payload : [];
          return { data: rows[0] ?? null, error: null as SupabaseError | null };
        } catch (error) {
          return { data: null, error: error as SupabaseError };
        }
      },
      async insert(value: unknown) {
        try {
          const response = await fetch(`${client.url}/rest/v1/${encodeURIComponent(table)}`, {
            method: "POST",
            headers: { ...(await client.userHeaders()), Prefer: "return=minimal" },
            body: JSON.stringify(value),
          });
          const payload = await readJson(response);
          if (!response.ok) throw toError(payload, response.status);
          return { data: payload, error: null as SupabaseError | null };
        } catch (error) {
          return { data: null, error: error as SupabaseError };
        }
      },
    };
  }

  async rpc(name: string, args: Record<string, unknown>) {
    try {
      const response = await fetch(`${this.url}/rest/v1/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { ...(await this.userHeaders()), Prefer: "return=representation" },
        body: JSON.stringify(args),
      });
      const payload = await readJson(response);
      if (!response.ok) throw toError(payload, response.status);
      return { data: payload, error: null as SupabaseError | null };
    } catch (error) {
      return { data: null, error: error as SupabaseError };
    }
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config());
}

export function getSupabaseBrowserClient(): SupabaseBrowserClient | null {
  if (typeof window === "undefined") return null;
  const current = config();
  if (!current) return null;
  if (!browserClient) browserClient = new SupabaseBrowserClient(current.url, current.key);
  return browserClient;
}
