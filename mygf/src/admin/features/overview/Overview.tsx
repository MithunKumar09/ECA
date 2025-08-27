// src/admin/features/overview/Overview.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/store";

// SA API
import { listOrganizations } from "../../api/organizations";
import { listSaUsers } from "../../api/saUsers";
import { listSaCourses } from "../../api/saCourses";

// Admin/Vendor API
import { listAdUsers } from "../../api/adUsers";
import { listCourses } from "../../api/courses";

// Audit (org-scoped + SA) — resilient wrapper
import { listAuditLogs } from "../../api/audit";

// Icons (just for small badges if you already use them in your Overview UI)
import { Building2, GraduationCap, Users2, Shield, BookOpen, Activity } from "lucide-react";

type CountCardProps = {
  label: string;
  value?: number | string;
  icon?: React.ReactNode;
  loading?: boolean;
};
function CountCard({ label, value, icon, loading }: CountCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-semibold">{loading ? "…" : value ?? "—"}</div>
      </div>
    </div>
  );
}

export default function OverviewUnified() {
  const { user, status } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isSA = role === "superadmin";
  const isAdmin = role === "admin";
  const isVendor = role === "vendor";

  // Don’t fetch unless we’re authenticated and actually on a guarded page
  const enabled = status === "ready" && !!user;

  // ----------------- SUPERADMIN COUNTS -----------------
  const saOrgsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:orgs:count"],
    queryFn: async () => {
      const rows = await listOrganizations({ q: "", status: "all" } as any);
      return Array.isArray(rows) ? rows.length : (Array.isArray((rows as any).items) ? (rows as any).items.length : 0);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saAdminsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:admins:count"],
    queryFn: async () => (await listSaUsers({ role: "admin", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saVendorsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:vendors:count"],
    queryFn: async () => (await listSaUsers({ role: "vendor", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saStudentsQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:students:count"],
    queryFn: async () => (await listSaUsers({ role: "student", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saCoursesQ = useQuery({
    enabled: enabled && isSA,
    queryKey: ["sa:courses:count"],
    queryFn: async () => (await listSaCourses({ status: "all" })).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ----------------- ADMIN/VENDOR COUNTS (ORG-SCOPED) -----------------
  const adVendorsQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:vendors:count", user?.orgId],
    queryFn: async () => (await listAdUsers({ role: "vendor", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const adStudentsQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:students:count", user?.orgId],
    queryFn: async () => (await listAdUsers({ role: "student", status: "all" } as any)).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const adCoursesQ = useQuery({
    enabled: enabled && (isAdmin || isVendor),
    queryKey: ["ad:courses:count", user?.orgId],
    queryFn: async () => (await listCourses({ status: "all" })).length,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Organization count for admin/vendor (scoped): your org or 0 if none
  const orgCount = isSA ? saOrgsQ.data ?? 0 : (user?.orgId ? 1 : 0);
  const orgCountLoading = isSA ? saOrgsQ.isLoading : false;

  // Admin count for admin/vendor screens:
  // - Admin: typically just themselves (1)
  // - Vendor: their manager admin (we’ll show 1 as it’s manager-scoped server side)
  const localAdminsCount = isAdmin ? 1 : (isVendor ? 1 : 0);

  // ----------------- AUDIT LOGS (recent mutations) -----------------
  // Backend should scope by org for non-SA. If your backend exposes /audit/logs, this will work.
  // If not present, the wrapper returns [] silently (no console noise).
  const auditQ = useQuery({
    enabled,
    queryKey: ["audit:recent", isSA ? "sa" : user?.orgId || "no-org"],
    queryFn: async () =>
      listAuditLogs({
        limit: 10,
        roles: ["admin", "vendor"],
        orgOnly: !isSA,
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // -------------- Mock-only cards that must stay as-is --------------
  // Keep placeholders as requested (active subs, payouts, revenue 30d)
  const mockActiveSubs = 128;           // keep mock for now
  const mockPayouts = "₹ 1.28L";        // keep mock for now
  const mockRevenue30d = "₹ 9.76L";     // keep mock for now

  // ----------------- Render -----------------
  return (
    <div className="space-y-6">
      {/* Top metrics grid (keep your existing layout; this is a safe, clean version) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Organizations */}
        <CountCard
          label={isSA ? "Organizations" : "Organization"}
          value={orgCount}
          loading={orgCountLoading}
          icon={<Building2 size={24} className="text-slate-600" />}
        />

        {/* Admins */}
        <CountCard
          label="Admins"
          value={isSA ? (saAdminsQ.data ?? 0) : localAdminsCount}
          loading={isSA ? saAdminsQ.isLoading : false}
          icon={<Shield size={24} className="text-slate-600" />}
        />

        {/* Vendors */}
        <CountCard
          label="Vendors"
          value={isSA ? (saVendorsQ.data ?? 0) : (adVendorsQ.data ?? 0)}
          loading={isSA ? saVendorsQ.isLoading : adVendorsQ.isLoading}
          icon={<Users2 size={24} className="text-slate-600" />}
        />

        {/* Students */}
        <CountCard
          label="Students"
          value={isSA ? (saStudentsQ.data ?? 0) : (adStudentsQ.data ?? 0)}
          loading={isSA ? saStudentsQ.isLoading : adStudentsQ.isLoading}
          icon={<GraduationCap size={24} className="text-slate-600" />}
        />

        {/* Courses */}
        <CountCard
          label="Courses"
          value={isSA ? (saCoursesQ.data ?? 0) : (adCoursesQ.data ?? 0)}
          loading={isSA ? saCoursesQ.isLoading : adCoursesQ.isLoading}
          icon={<BookOpen size={24} className="text-slate-600" />}
        />

        {/* Keep these 3 as mock numbers per your note */}
        <CountCard label="Active Subscriptions" value={mockActiveSubs} icon={<Activity size={24} className="text-slate-600" />} />
        <CountCard label="Payouts (pending)" value={mockPayouts} icon={<Activity size={24} className="text-slate-600" />} />
        <CountCard label="Revenue (30 days)" value={mockRevenue30d} icon={<Activity size={24} className="text-slate-600" />} />
      </div>

      {/* Recent activity (audit) */}
      <div className="rounded-xl border bg-white">
        <div className="border-b p-3 font-medium">Recent activity (admins & vendors)</div>
        <div className="divide-y">
          {(auditQ.data ?? []).map((log: any) => (
            <div key={log.id || log._id} className="p-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm">
                  <span className="font-medium">{log.actorEmail || log.actorName || "Unknown"}</span>{" "}
                  <span className="text-slate-500">({log.actorRole || "—"})</span>
                  {" "}
                  <span className="text-slate-600">{log.action || "action"}</span>
                  {log.resource ? (
                    <>
                      {" "}
                      <span className="text-slate-500">on</span>{" "}
                      <span className="font-medium">{log.resource}</span>
                      {log.resourceId ? <span className="text-slate-400"> #{log.resourceId}</span> : null}
                    </>
                  ) : null}
                </div>
                {log.message ? <div className="text-xs text-slate-500">{log.message}</div> : null}
              </div>
              <div className="text-xs text-slate-400">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
              </div>
            </div>
          ))}
          {auditQ.isLoading && (
            <div className="p-3 text-center text-slate-500 text-sm">Loading…</div>
          )}
          {!auditQ.isLoading && (auditQ.data ?? []).length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}
