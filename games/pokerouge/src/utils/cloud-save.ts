import type { SessionSaveData, SystemSaveData } from "#types/save-data";

const SUPABASE_URL = "https://fcaurruifyeoofapuqcs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_njYaCOufPHLjbkxo3brV0Q_eD6m6RLW";
const GAME_ID = "pokerouge";

type SupabaseClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }>;
  };
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: unknown }>;
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: { game_state: unknown; updated_at: string } | null; error: unknown }>;
        };
      };
    };
  };
};

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string, options?: Record<string, unknown>) => SupabaseClient;
    };
  }
}

let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }

  const supabase = window.supabase;
  if (!supabase?.createClient) {
    console.warn("[CloudSave] Supabase client is not loaded");
    client = null;
    return client;
  }

  client = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

async function getUserId(): Promise<string | null> {
  const supabase = getClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch (error) {
    console.warn("[CloudSave] Could not read Supabase session", error);
    return null;
  }
}

function slotName(type: "system" | "session", slotId = 0): string {
  return type === "system" ? "system" : `session-${slotId}`;
}

export async function saveCloudSystem(data: SystemSaveData): Promise<void> {
  await saveCloud("system", 0, data);
}

export async function loadCloudSystem(): Promise<{ data: SystemSaveData; updatedAt: string } | null> {
  return await loadCloud<SystemSaveData>("system", 0);
}

export async function saveCloudSession(slotId: number, data: SessionSaveData): Promise<void> {
  await saveCloud("session", slotId, data);
}

export async function loadCloudSession(slotId: number): Promise<{ data: SessionSaveData; updatedAt: string } | null> {
  return await loadCloud<SessionSaveData>("session", slotId);
}

async function saveCloud(type: "system" | "session", slotId: number, data: unknown): Promise<void> {
  const supabase = getClient();
  const userId = await getUserId();

  if (!supabase || !userId) {
    return;
  }

  try {
    const { error } = await supabase.from("game_saves").upsert(
      {
        user_id: userId,
        game_id: GAME_ID,
        slot_name: slotName(type, slotId),
        game_state: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,game_id,slot_name" },
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn("[CloudSave] Cloud save failed; local/server save is still authoritative", error);
  }
}

async function loadCloud<T>(type: "system" | "session", slotId: number): Promise<{ data: T; updatedAt: string } | null> {
  const supabase = getClient();
  const userId = await getUserId();

  if (!supabase || !userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("game_saves")
      .select("game_state,updated_at")
      .eq("user_id", userId)
      .eq("game_id", GAME_ID)
      .eq("slot_name", slotName(type, slotId))
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data?.game_state || typeof data.game_state !== "object") {
      return null;
    }

    return {
      data: data.game_state as T,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.warn("[CloudSave] Cloud load failed; falling back to normal save", error);
    return null;
  }
}
