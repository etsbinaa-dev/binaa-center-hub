import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "accountant", "delivery", "monitor"]);
type AppRole = z.infer<typeof RoleSchema>;

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("صلاحيات غير كافية");
}

function normalizeRole(raw: string | null | undefined): AppRole {
  if (raw === "admin" || raw === "accountant" || raw === "delivery" || raw === "monitor") return raw;
  return "monitor";
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      full_name: profiles?.find((p) => p.id === u.id)?.full_name ?? null,
      role: normalizeRole(roles?.find((r) => r.user_id === u.id)?.role as string | undefined),
    }));
  });

async function setRole(supabaseAdmin: any, userId: string, role: AppRole) {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(error.message);
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; role: AppRole }) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      password: z.string().min(6).max(72),
      full_name: z.string().trim().min(1).max(100),
      role: RoleSchema,
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) {
      const msg = /already|registered|exists/i.test(error.message)
        ? "هذا البريد الإلكتروني مسجل بالفعل"
        : error.message;
      throw new Error(msg);
    }
    if (!created.user) throw new Error("تعذّر إنشاء المستخدم");

    // Ensure profile + role exist regardless of any trigger state.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.full_name }, { onConflict: "id" });
    await setRole(supabaseAdmin, created.user.id, data.role);

    return { id: created.user.id, email: created.user.email ?? data.email };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; email?: string; full_name?: string; role?: AppRole }) =>
    z.object({
      user_id: z.string().uuid(),
      email: z.string().email().max(255).optional(),
      full_name: z.string().min(1).max(100).optional(),
      role: RoleSchema.optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.email || data.full_name) {
      const payload: any = {};
      if (data.email) payload.email = data.email;
      if (data.full_name) payload.user_metadata = { full_name: data.full_name };
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, payload);
      if (error) throw new Error(error.message);
      if (data.full_name) {
        await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", data.user_id);
      }
    }
    if (data.role) await setRole(supabaseAdmin, data.user_id, data.role);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: AppRole }) =>
    z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await setRole(supabaseAdmin, data.user_id, data.role);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("لا يمكنك حذف نفسك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
