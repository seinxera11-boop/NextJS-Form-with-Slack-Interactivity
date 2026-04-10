// // NOTE: This route handles the PKCE "email confirmation" flow (token_hash in query string).
// // It is NOT used by the magic link flow, which delivers tokens via URL hash (#access_token=...).
// // Magic links are handled client-side in /admin/auth/callback/page.tsx via supabase.auth.setSession().
// //
// // You can safely DELETE this file if you are only using magic links.
// // Keep it only if you also use Supabase email confirmation (signup verification).

// import { createServerClient } from "@supabase/ssr";
// import { cookies } from "next/headers";
// import { NextResponse } from "next/server";

// export async function GET(req: Request) {
//   const { searchParams } = new URL(req.url);
//   const token_hash = searchParams.get("token_hash");
//   const type = searchParams.get("type");

//   if (!token_hash || !type) {
//     return NextResponse.redirect(new URL("/admin/login?error=auth", req.url));
//   }

//   const cookieStore = cookies();
//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll: async () => (await cookieStore).getAll(),
//         setAll: (cookiesToSet) => {
//           cookiesToSet.forEach(async ({ name, value, options }) =>
//             (await cookieStore).set(name, value, options)
//           );
//         },
//       },
//     }
//   );

//   const { error } = await supabase.auth.verifyOtp({
//     token_hash,
//     type: type as any,
//   });

//   if (error) {
//     return NextResponse.redirect(new URL("/admin/login?error=auth", req.url));
//   }

//   return NextResponse.redirect(new URL("/admin", req.url));
// }