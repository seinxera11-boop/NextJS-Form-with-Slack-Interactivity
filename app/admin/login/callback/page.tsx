"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";


export default function AdminAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuth() {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.hash
      );

      if (error) {
        console.error("Auth error:", error.message);
        router.replace("/admin/login?error=session_failed");
        return;
      }

      // Redirect to admin dashboard after successful login
      router.replace("/admin");
    }

    handleAuth();
  }, [router]);

  return <div>Logging you in...</div>; // Temporary UI while processing
}