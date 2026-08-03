"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { candidateApi, type Candidate, type CreateCandidatePayload, type UpdateCandidatePayload } from "@/lib/api/candidateApi";

function extractError(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  const detail = response?.data?.detail;
  if (Array.isArray(detail)) { const raw = (detail[0] as { msg?: string })?.msg ?? fallback; return raw.replace(/^Value error,\s*/i, ""); }
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — please check your connection.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (typeof window === "undefined") return null;
  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        {children}
      </div>
    </div>,
    document.body
  );
}

function Field({
  label, id, value, onChange, type = "text", placeholder, required, textarea,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; textarea?: boolean;
}) {
  const cls = "block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500";
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {textarea ? (
        <textarea id={id} value={value} required={required} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-none`} />
      ) : (
        <input id={id} type={type} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

const EMPTY_FORM = { name: "", email: "", phone: "", position: "", notes: "" };

function AddCandidateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (c: Candidate) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const payload: CreateCandidatePayload = { name: form.name.trim(), email: form.email.trim(), ...(form.phone.trim() && { phone: form.phone.trim() }), ...(form.position.trim() && { position: form.position.trim() }), ...(form.notes.trim() && { notes: form.notes.trim() }) };
      const res = await candidateApi.create(payload);
      onSuccess(res.data);
    } catch (err) { setError(extractError(err, "Failed to add candidate.")); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Add Candidate</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 dark:text-gray-500">Create a new candidate record</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
        <Field label="Full name" id="c-name" value={form.name} onChange={set("name")} required placeholder="Your Full Name" />
        <Field label="Email address" id="c-email" type="email" value={form.email} onChange={set("email")} required placeholder="you@gmail.com" />
        <Field label="Phone" id="c-phone" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
        <Field label="Position" id="c-position" value={form.position} onChange={set("position")} placeholder="e.g. Software Engineer" />
        <Field label="Notes" id="c-notes" value={form.notes} onChange={set("notes")} placeholder="Any additional notes..." textarea />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60">{saving ? "Adding…" : "Add Candidate"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditCandidateModal({ candidate, onClose, onSuccess }: { candidate: Candidate; onClose: () => void; onSuccess: (c: Candidate) => void }) {
  const [form, setForm] = useState({ name: candidate.name, email: candidate.email, phone: candidate.phone ?? "", position: candidate.position ?? "", notes: candidate.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const payload: UpdateCandidatePayload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, position: form.position.trim() || undefined, notes: form.notes.trim() || undefined };
      const res = await candidateApi.update(candidate.id, payload);
      onSuccess(res.data);
    } catch (err) { setError(extractError(err, "Failed to update candidate.")); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Edit Candidate</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 dark:text-gray-500">{candidate.name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
        <Field label="Full name" id="e-name" value={form.name} onChange={set("name")} required placeholder="Your Full Name" />
        <Field label="Email address" id="e-email" type="email" value={form.email} onChange={set("email")} required placeholder="you@leapswitch.com" />
        <Field label="Phone" id="e-phone" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
        <Field label="Position" id="e-position" value={form.position} onChange={set("position")} placeholder="e.g. Software Engineer" />
        <Field label="Notes" id="e-notes" value={form.notes} onChange={set("notes")} placeholder="Any additional notes..." textarea />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60">{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteCandidateModal({ candidate, onClose, onSuccess }: { candidate: Candidate; onClose: () => void; onSuccess: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try { await candidateApi.delete(candidate.id); onSuccess(candidate.id); }
    catch (err) { setError(extractError(err, "Failed to delete candidate.")); setDeleting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Delete Candidate</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">{candidate.name}</span>? This action cannot be undone.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </Modal>
  );
}

const CandidateTableRow = memo(function CandidateTableRow({
  c,
  onEdit,
  onDelete,
}: {
  c: Candidate;
  onEdit: (c: Candidate) => void;
  onDelete: (c: Candidate) => void;
}) {
  return (
    <tr className="hover:bg-orange-50/30 transition-colors dark:hover:bg-orange-950/10">
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.email}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.phone ?? "—"}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.position ?? "—"}</td>
      <td className="px-4 py-3 text-gray-400 text-xs dark:text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-orange-50 hover:text-[#F97316] transition-colors dark:text-gray-500 dark:hover:bg-orange-950/30 dark:hover:text-orange-400" title="Edit">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button type="button" onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400" title="Delete">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );
});

const CandidateMobileCard = memo(function CandidateMobileCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Candidate;
  onEdit: (c: Candidate) => void;
  onDelete: (c: Candidate) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate dark:text-gray-100">{c.name}</p>
          <p className="text-xs text-gray-500 truncate dark:text-gray-400">{c.email}</p>
          {c.position && <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{c.position}</p>}
          {c.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{c.phone}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-orange-50 hover:text-[#F97316] dark:text-gray-500 dark:hover:bg-orange-950/30 dark:hover:text-orange-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button type="button" onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function Candidate() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"add" | { type: "edit" | "delete"; candidate: Candidate } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    candidateApi.list()
      .then((res) => setCandidates(res.data))
      .catch(() => setError("Failed to load candidates."))
      .finally(() => setLoading(false));
  }, []);

  const closeModal = useCallback(() => setModal(null), []);
  const openEdit = useCallback((c: Candidate) => setModal({ type: "edit", candidate: c }), []);
  const openDelete = useCallback((c: Candidate) => setModal({ type: "delete", candidate: c }), []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Candidates</h2>
          <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{candidates.length} total</p>
        </div>
        <button type="button" onClick={() => setModal("add")} className="flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Candidate
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-[#F97316]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {!loading && error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</div>}

      {!loading && !error && candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/30">
            <svg className="h-7 w-7 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No candidates yet</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Click &ldquo;Add Candidate&rdquo; to get started.</p>
        </div>
      )}

      {!loading && !error && candidates.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl ring-1 ring-gray-100 dark:ring-gray-800">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  {["Name", "Email", "Phone", "Position", "Added", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white dark:divide-gray-800 dark:bg-transparent">
                {candidates.map((c) => (
                  <CandidateTableRow key={c.id} c={c} onEdit={openEdit} onDelete={openDelete} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {candidates.map((c) => (
              <CandidateMobileCard key={c.id} c={c} onEdit={openEdit} onDelete={openDelete} />
            ))}
          </div>
        </>
      )}

      {modal === "add" && (
        <AddCandidateModal onClose={closeModal} onSuccess={(c) => { setCandidates((prev) => [c, ...prev]); closeModal(); showToast("Candidate added successfully."); }} />
      )}
      {modal !== null && modal !== "add" && modal.type === "edit" && (
        <EditCandidateModal candidate={modal.candidate} onClose={closeModal} onSuccess={(updated) => { setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c))); closeModal(); showToast("Candidate updated successfully."); }} />
      )}
      {modal !== null && modal !== "add" && modal.type === "delete" && (
        <DeleteCandidateModal candidate={modal.candidate} onClose={closeModal} onSuccess={(id) => { setCandidates((prev) => prev.filter((c) => c.id !== id)); closeModal(); showToast("Candidate deleted."); }} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-gray-700">
          {toast}
        </div>
      )}
    </div>
  );
}
