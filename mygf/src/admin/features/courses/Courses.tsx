import React, { useMemo, useState } from "react";
import { useAuth } from "../../auth/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Course, CourseFilters, CourseStatus, CourseVisibility } from "../../types/course";
import {
  listSaCourses, createSaCourse, updateSaCourse, deleteSaCourse, setSaCourseStatus,
  bulkUpsertSaCourses
} from "../../api/saCourses";
import {
  fetchCourses as listAdCourses, createCourse as createAdCourse,
  updateCourse as updateAdCourse, deleteCourse as deleteAdCourse, setCourseStatus as setAdCourseStatus,
  bulkUpsertCourses
} from "../../api/courses";
import { listOrganizations, type Organization } from "../../api/organizations";
import { listSaUsers } from "../../api/saUsers";
import type { SAUser } from "../../types/user";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import { Input, Label, Select } from "../../components/Input";
import {
  Pencil, Trash2, Plus, CheckCircle2, XCircle,
  Upload, FileDown, FileSpreadsheet, Info
} from "lucide-react";

type Filters = { q: string; status: "all" | CourseStatus; orgId?: string; ownerEmail?: string };

export default function CoursesUnified() {
  const qc = useQueryClient();
  const { user } = useAuth() as any;
  const role: string = (user?.role || "").toLowerCase();

  const [filters, setFilters] = useState<Filters>({ q: "", status: "all" });
  const [open, setOpen] = useState<{ mode: "create" | "edit"; initial?: Course } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const isSA = role === "superadmin";

  // — Lookups (only for superadmin UI) —
  const orgsQ = useQuery<Organization[]>({
    enabled: isSA,
    queryKey: ["orgs-lite"],
    queryFn: async () => {
      const res = await listOrganizations({ q: "", status: "active" } as any);
      return Array.isArray(res) ? res : (Array.isArray((res as any).items) ? (res as any).items : []);
    },
  });

  const adminsQ = useQuery<SAUser[]>({
    enabled: isSA,
    queryKey: ["sa-admins:lookup"],
    queryFn: () => listSaUsers({ role: "admin" } as any),
  });

  // — Data query (REAL backend) —
  const query = useQuery({
    queryKey: ["courses:unified", { ...filters, role }],
    queryFn: async () => {
      if (isSA) {
        const params: CourseFilters = {
          q: filters.q || undefined,
          status: filters.status,
          orgId: filters.orgId && filters.orgId !== "all" ? filters.orgId : undefined,
          ownerEmail: filters.ownerEmail || undefined,
        };
        return listSaCourses(params);
      } else {
        // Admin/Vendor: backend scopes by org from session; vendor uses manager mapping server-side
        return listAdCourses({ q: filters.q || undefined, status: filters.status });
      }
    },
  });

  const rows = query.data ?? [];

  // — Mutations (REAL backend) —
  const createMut = useMutation({
    mutationFn: (payload: any) => (isSA ? createSaCourse(payload) : createAdCourse(payload)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      isSA ? updateSaCourse(id, patch) : updateAdCourse(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CourseStatus }) =>
      isSA ? setSaCourseStatus(id, status) : setAdCourseStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => (isSA ? deleteSaCourse(id) : deleteAdCourse(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });

  const importMut = useMutation({
    mutationFn: (rows: any[]) => (isSA ? bulkUpsertSaCourses(rows) : bulkUpsertCourses(rows)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses:unified"] }),
  });

  // Owners dropdown for SA
  const owners = useMemo(() => {
    const arr = Array.isArray(adminsQ.data) ? adminsQ.data : [];
    return arr.map(a => ({ label: a.name || a.email, value: a.email }));
  }, [adminsQ.data]);

  const orgOptions = useMemo(() => {
    const arr = Array.isArray(orgsQ.data) ? orgsQ.data : [];
    return [
      { label: "All", value: "all" },
      { label: "Global", value: "global" },
      ...arr.map(o => ({ label: o.name, value: (o._id || (o as any).id) })),
    ];
  }, [orgsQ.data]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <header className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input placeholder="title, slug, category…" value={filters.q}
                 onChange={e => setFilters(s => ({ ...s, q: e.target.value }))} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={filters.status}
                  onChange={e => setFilters(s => ({ ...s, status: e.target.value as any }))}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        {isSA ? (
          <>
            <div>
              <Label>Org</Label>
              <Select value={filters.orgId || "all"}
                      onChange={e => setFilters(s => ({ ...s, orgId: e.target.value }))}>
                {orgOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Owner (Admin)</Label>
              <Select value={filters.ownerEmail || ""}
                      onChange={e => setFilters(s => ({ ...s, ownerEmail: e.target.value || undefined }))}>
                <option value="">Any</option>
                {owners.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </>
        ) : (
          <div className="md:col-span-2" />
        )}

        <div className="md:col-span-1 flex items-end justify-end gap-2">
          <Button variant="secondary" onClick={() => setBulkOpen(true)}>
            <Upload size={16} /> Bulk Upload
          </Button>
          <Button onClick={() => setOpen({ mode: "create" })}><Plus size={16} /> New</Button>
        </div>
      </header>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium p-3">Title</th>
              <th className="text-left font-medium p-3">Category</th>
              <th className="text-left font-medium p-3">Price</th>
              {isSA && <th className="text-left font-medium p-3">Owner</th>}
              {isSA && <th className="text-left font-medium p-3">Org</th>}
              <th className="text-left font-medium p-3">Status</th>
              <th className="text-left font-medium p-3 w-64">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: Course) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.title}</div>
                  {c.slug && <div className="text-xs text-slate-500">/{c.slug}</div>}
                </td>
                <td className="p-3">{c.category || "—"}</td>
                <td className="p-3">₹{(((c.price ?? 0) / 100).toFixed(2))}</td>
                {isSA && <td className="p-3">{(c as any).ownerName || (c as any).ownerEmail || "—"}</td>}
                {isSA && <td className="p-3">{(c as any).orgName || (c.orgId ? c.orgId : "Global")}</td>}
                <td className="p-3">
                  <span className={
                    c.status === "published"
                      ? "text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"
                      : c.status === "draft"
                      ? "text-amber-700 bg-amber-50 rounded px-2 py-0.5"
                      : "text-slate-700 bg-slate-100 rounded px-2 py-0.5"
                  }>{c.status}</span>
                </td>
                <td className="p-3 whitespace-nowrap space-x-2">
                  <Button variant="ghost" className="h-8 px-2 text-xs"
                          onClick={() => setOpen({ mode: "edit", initial: c })}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => statusMut.mutate({ id: c.id, status: c.status === "published" ? "draft" : "published" })}
                    title={c.status === "published" ? "Set Draft" : "Publish"}
                  >
                    {c.status === "published" ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => deleteMut.mutate(c.id)}>
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">No courses</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!!open && (
        <CourseFormModal
          open={true}
          mode={open.mode}
          initial={open.initial}
          role={role}
          orgs={orgOptions}
          admins={owners}
          onClose={() => setOpen(null)}
          onSubmit={async (payload) => {
            const toServer = { ...payload, price: Math.round(Number(payload.price) * 100) };
            if (open.mode === "create") {
              await createMut.mutateAsync(toServer);
            } else if (open.initial?.id) {
              await updateMut.mutateAsync({ id: open.initial.id, patch: toServer });
            }
          }}
        />
      )}

      {bulkOpen && (
        <BulkUploadModal
          role={role}
          orgs={orgOptions}
          admins={owners}
          onClose={() => setBulkOpen(false)}
          onImport={async (rows) => {
            await importMut.mutateAsync(rows);
            setBulkOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CourseFormModal({
  open, mode, initial, role, orgs, admins, onClose, onSubmit
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: Course;
  role: string;
  orgs: Array<{ label: string; value: string }>;
  admins: Array<{ label: string; value: string }>;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<any>;
}) {
  const isSA = role === "superadmin";
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [price, setPrice] = useState<string>(initial ? String((initial.price ?? 0) / 100) : "0");
  const [visibility, setVisibility] = useState<CourseVisibility>(initial?.visibility || "unlisted");
  const [status, setStatus] = useState<CourseStatus>(initial?.status || "draft");
  const [orgId, setOrgId] = useState<string>(initial?.orgId || "global");
  const [ownerEmail, setOwnerEmail] = useState<string>(initial?.ownerEmail || "");

  React.useEffect(() => {
    setTitle(initial?.title || "");
    setSlug(initial?.slug || "");
    setCategory(initial?.category || "");
    setPrice(initial ? String((initial.price ?? 0) / 100) : "0");
    setVisibility(initial?.visibility || "unlisted");
    setStatus(initial?.status || "draft");
    setOrgId(initial?.orgId || "global");
    setOwnerEmail(initial?.ownerEmail || "");
  }, [initial]);

  const canSubmit = title.trim().length > 0;

  return (
    <Modal open={open} title={mode === "create" ? "Add Course" : "Edit Course"} onClose={onClose}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            title, slug, category, price: Number(price), visibility, status,
            ...(isSA ? { orgId: orgId === "global" ? null : orgId, ownerEmail: ownerEmail || undefined } : {}),
          });
        }}
      >
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="optional-url-slug" />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Frontend" />
        </div>
        <div>
          <Label>Price (₹)</Label>
          <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label>Visibility</Label>
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value as CourseVisibility)}>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        {role === "superadmin" && (
          <>
            <div>
              <Label>Organization</Label>
              <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Owner (Admin)</Label>
              <Select value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}>
                <option value="">None</option>
                {admins.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            </div>
          </>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <Button type="submit" disabled={!canSubmit}>{mode === "create" ? "Create" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* =========================
   Bulk Upload Modal
   ========================= */
function BulkUploadModal({
  role, orgs, admins, onClose, onImport
}: {
  role: string;
  orgs: Array<{ label: string; value: string }>;
  admins: Array<{ label: string; value: string }>;
  onClose: () => void;
  onImport: (rows: any[]) => Promise<any>;
}) {
  const isSA = role === "superadmin";
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("global");
  const [ownerEmail, setOwnerEmail] = useState<string>("");

  const headers = isSA
    ? ["title","slug","category","price","visibility","status","orgId","ownerEmail","tags"]
    : ["title","slug","category","price","visibility","status","tags"];

  const sample = isSA
    ? `title,slug,category,price,visibility,status,orgId,ownerEmail,tags
React Basics,react-basics,Frontend,999.00,public,published,global,,react,frontend
Node Mastery,node-mastery,Backend,1499.00,unlisted,draft,64f0e2...,admin@org.com,node,backend
`
    : `title,slug,category,price,visibility,status,tags
UI Design,ui-design,Design,799.00,public,published,design,ui
DevOps 101,devops-101,DevOps,999.00,unlisted,draft,devops,ci
`;

  const parseCsv = (s: string) => {
    const lines = s.trim().split(/\r?\n/);
    if (lines.length === 0) return [];
    const head = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).filter(Boolean).map(line => {
      const cols = line.split(",").map(x => x.trim());
      const row:any = {};
      head.forEach((h,i)=> row[h] = cols[i]);
      return row;
    });
  };

  async function parseXlsx(file: File) {
    try {
      const XLSX = await import(/* @vite-ignore */"xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      // Normalize keys to our headers when possible
      return data.map((r:any) => {
        const o:any = {};
        for (const h of headers) {
          const foundKey = Object.keys(r).find(k => k.trim().toLowerCase() === h.toLowerCase());
          if (foundKey) o[h] = r[foundKey];
        }
        return o;
      });
    } catch (e:any) {
      setError("Failed to read XLSX. Make sure the file is a valid Excel workbook.");
      return [];
    }
  }

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    setFileName(file.name);
    try {
      let parsed: any[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        parsed = parseCsv(text);
      } else if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        parsed = await parseXlsx(file);
      } else {
        setError("Unsupported file type. Please upload CSV or XLSX.");
        setParsing(false);
        return;
      }
      // Map rupees -> paise and coerce
      const normalized = parsed.map(r => {
        const rupees = Number(String(r.price || "0").replace(/[^0-9.]/g,"")) || 0;
        const price = Math.round(rupees * 100);
        const visibility = (r.visibility || "unlisted").toString().toLowerCase();
        const status = (r.status || "draft").toString().toLowerCase();
        const slug = r.slug ? String(r.slug).toLowerCase() : undefined;

        const base:any = {
          title: r.title,
          slug,
          category: r.category || undefined,
          price,
          visibility,
          status,
          tags: r.tags || undefined,
        };

        if (isSA) {
          const og = r.orgId || (orgId === "global" ? null : orgId) || null;
          const owner = r.ownerEmail || ownerEmail || undefined;
          return { ...base, orgId: og === "global" ? null : og, ownerEmail: owner };
        }
        return base;
      });

      setRows(normalized);
    } catch (e:any) {
      setError("Could not parse the file. Please verify the columns and try again.");
    } finally {
      setParsing(false);
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = isSA ? "courses_template_superadmin.csv" : "courses_template_admin.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadXLSX = async () => {
    try {
      const XLSX = await import(/* @vite-ignore */"xlsx");
      const rows = sample.trim().split(/\r?\n/).map(line => line.split(","));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = isSA ? "courses_template_superadmin.xlsx" : "courses_template_admin.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert("XLSX generator not available. Please use CSV template instead.");
    }
  };

  const canImport = rows.length > 0;

  return (
    <Modal open title="Bulk Upload Courses" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border p-3 bg-slate-50 text-slate-700 flex items-start gap-2">
          <Info size={18} className="mt-0.5" />
          <div className="text-sm leading-relaxed">
            Upload a CSV or XLSX file. Columns supported:
            <div className="font-mono text-xs mt-1">
              {headers.join(", ")}
            </div>
            <div className="text-xs mt-1">
              Price should be in <strong>₹ (rupees)</strong>; we’ll convert to paise automatically.
              Status: <em>draft | published | archived</em>. Visibility: <em>public | private | unlisted</em>.
            </div>
          </div>
        </div>

        {isSA && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default Organization (for rows missing orgId)</Label>
              <Select value={orgId} onChange={e => setOrgId(e.target.value)}>
                {orgs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Default Owner (Admin)</Label>
              <Select value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}>
                <option value="">None</option>
                {admins.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadCSV}><FileDown size={16}/> Download CSV Template</Button>
          <Button variant="secondary" onClick={downloadXLSX}><FileSpreadsheet size={16}/> Download XLSX Template</Button>
        </div>

        <div className="rounded-xl border border-dashed p-4 text-center bg-white">
          <input
            id="bulk-file"
            type="file"
            accept=".csv,.xlsx,.xlsm"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <label htmlFor="bulk-file" className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-slate-50">
            <Upload size={16}/> {fileName ? "Choose another file" : "Choose CSV/XLSX file"}
          </label>
          {fileName && <div className="text-xs text-slate-500 mt-2">Selected: {fileName}</div>}
          {parsing && <div className="text-sm text-slate-600 mt-2">Parsing…</div>}
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        </div>

        {rows.length > 0 && (
          <div className="rounded-lg border max-h-48 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {headers.map(h => <th key={h} className="text-left font-medium p-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    {headers.map(h => <td key={h} className="p-2">{String((r as any)[h] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <div className="text-[11px] text-slate-500 p-2">Showing first 50 rows of {rows.length}…</div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => onImport(rows)} disabled={!canImport}>
            <Upload size={16}/> Import {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
