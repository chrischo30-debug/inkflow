"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AccessRelayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const at = searchParams.get("at");
    const rt = searchParams.get("rt");

    if (!at || !rt) {
      setError("Missing session tokens.");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: at, refresh_token: rt })
      .then(({ error }) => {
        if (error) {
          setError(error.message);
        } else {
          router.replace("/");
        }
      });
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => window.close()}
            className="text-sm text-on-surface-variant hover:text-on-surface"
          >
            Close tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <p className="text-sm text-on-surface-variant">Accessing account…</p>
    </div>
  );
}
