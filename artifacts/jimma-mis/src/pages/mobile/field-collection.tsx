import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useListKebeles,
  useListStreets,
  useListBlocks,
  getListStreetsQueryKey,
  getListBlocksQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflineDB, type OfflineDraft, type DraftInput } from "@/hooks/use-offline-db";
import { useSync } from "@/hooks/use-sync";
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  X,
  Send,
  Save,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential", emoji: "🏠" },
  { value: "commercial", label: "Commercial", emoji: "🏬" },
  { value: "government", label: "Government", emoji: "🏛️" },
  { value: "institution", label: "Institution", emoji: "🏫" },
  { value: "mixed", label: "Mixed Use", emoji: "🏢" },
] as const;

type PropertyType = (typeof PROPERTY_TYPES)[number]["value"];

interface FormState {
  ownerName: string;
  ownerPhone: string;
  propertyType: PropertyType;
  kebeleId: string;
  kebeleCode: string;
  kebeleName: string;
  streetId: string;
  streetName: string;
  blockCode: string;
  houseNumber: string;
  buildingName: string;
  remark: string;
  latitude: string;
  longitude: string;
}

const EMPTY: FormState = {
  ownerName: "",
  ownerPhone: "",
  propertyType: "residential",
  kebeleId: "",
  kebeleCode: "",
  kebeleName: "",
  streetId: "",
  streetName: "",
  blockCode: "",
  houseNumber: "",
  buildingName: "",
  remark: "",
  latitude: "",
  longitude: "",
};

interface FieldError {
  ownerName?: string;
  kebele?: string;
  street?: string;
  gps?: string;
  photo?: string;
}

function validate(f: FormState, photo: string | null, requireGpsPhoto: boolean): FieldError {
  const e: FieldError = {};
  if (!f.ownerName.trim()) e.ownerName = "Owner name is required";
  if (!f.kebeleCode) e.kebele = "Kebele is required";
  if (!f.streetName.trim()) e.street = "Street is required";
  if (requireGpsPhoto) {
    if (!f.latitude || !f.longitude) e.gps = "GPS coordinates are required before submitting";
    if (!photo) e.photo = "A front view photo is required before submitting";
  }
  return e;
}

function MobileField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function MobileInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-base text-slate-800 placeholder-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "shadow-sm",
        className,
      )}
    />
  );
}

function MobileSelect({
  value,
  onChange,
  disabled,
  children,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-12 pl-4 pr-10 rounded-xl border border-slate-200 bg-white text-base text-slate-800",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "shadow-sm appearance-none",
          disabled && "opacity-50 cursor-not-allowed",
          !value && "text-slate-400",
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function FieldCollection() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const draftId = new URLSearchParams(search).get("draft");

  const { token } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { saveDraft, getDraft } = useOfflineDB();
  const { syncOne, isSyncing } = useSync();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldError>({});
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedLocalId, setSavedLocalId] = useState<string | undefined>(draftId ?? undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>("photo.jpg");
  const [photoMime, setPhotoMime] = useState<string>("image/jpeg");
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load draft if editing
  useEffect(() => {
    if (!draftId) return;
    getDraft(draftId).then((d) => {
      if (!d) return;
      setForm({
        ownerName: d.ownerName,
        ownerPhone: d.ownerPhone ?? "",
        propertyType: d.propertyType,
        kebeleId: d.kebeleId ? String(d.kebeleId) : "",
        kebeleCode: d.kebele,
        kebeleName: d.kebeleName ?? "",
        streetId: d.streetId ? String(d.streetId) : "",
        streetName: d.streetName,
        blockCode: d.blockCode ?? "",
        houseNumber: d.houseNumber ?? "",
        buildingName: d.buildingName ?? "",
        remark: d.remark ?? "",
        latitude: d.latitude != null ? String(d.latitude) : "",
        longitude: d.longitude != null ? String(d.longitude) : "",
      });
      if (d.photoDataUrl) {
        setPhoto(d.photoDataUrl);
        setPhotoFileName(d.photoFileName ?? "photo.jpg");
        setPhotoMime(d.photoMime ?? "image/jpeg");
      }
      setSavedLocalId(draftId);
    });
  }, [draftId, getDraft]);

  const set = (key: keyof FormState) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key.startsWith("kebele") ? "kebele" : key.startsWith("street") ? "street" : key]: undefined }));
  };

  // Kebele/Street/Block from API (React Query caches offline)
  const { data: kebeles = [], isLoading: kebelesLoading } = useListKebeles();
  const kebeleIdNum = form.kebeleId ? Number(form.kebeleId) : undefined;
  const streetIdNum = form.streetId ? Number(form.streetId) : undefined;

  const { data: streets = [], isLoading: streetsLoading } = useListStreets(
    { kebele_id: kebeleIdNum },
    { query: { queryKey: getListStreetsQueryKey({ kebele_id: kebeleIdNum }), enabled: !!kebeleIdNum } },
  );

  const { data: blocks = [], isLoading: blocksLoading } = useListBlocks(
    { street_id: streetIdNum },
    { query: { queryKey: getListBlocksQueryKey({ street_id: streetIdNum }), enabled: !!streetIdNum } },
  );

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const captureGps = () => {
    if (!("geolocation" in navigator)) {
      showToast("error", "GPS not supported by this browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        setErrors((e) => ({ ...e, gps: undefined }));
        setGpsLoading(false);
        showToast("success", `GPS captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          showToast("error", "GPS permission denied. Please allow location access in your browser settings.");
        } else {
          showToast("error", `GPS error: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      showToast("error", "Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("error", "Photo must be 8 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhoto(dataUrl);
      setPhotoFileName(file.name);
      setPhotoMime(file.type);
      setErrors((err) => ({ ...err, photo: undefined }));
    };
    reader.readAsDataURL(file);
  };

  const buildDraftInput = (): DraftInput => ({
    localId: savedLocalId,
    ownerName: form.ownerName.trim(),
    ownerPhone: form.ownerPhone.trim() || undefined,
    propertyType: form.propertyType,
    kebele: form.kebeleCode,
    kebeleId: kebeleIdNum,
    kebeleName: form.kebeleName,
    streetName: form.streetName.trim(),
    streetId: streetIdNum,
    blockCode: form.blockCode.trim() || undefined,
    houseNumber: form.houseNumber.trim() || undefined,
    buildingName: form.buildingName.trim() || undefined,
    latitude: form.latitude ? parseFloat(form.latitude) : undefined,
    longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    photoDataUrl: photo ?? undefined,
    photoFileName: photo ? photoFileName : undefined,
    photoMime: photo ? photoMime : undefined,
    remark: form.remark.trim() || undefined,
  });

  const handleSaveOffline = async () => {
    const errs = validate(form, photo, false);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast("error", "Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveDraft(buildDraftInput());
      setSavedLocalId(saved.localId);
      showToast("success", "Draft saved offline. You can sync it when connected.");
    } catch {
      showToast("error", "Could not save draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitOnline = async () => {
    const errs = validate(form, photo, true);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast("error", "Please fix the highlighted fields before submitting.");
      return;
    }
    if (!isOnline) {
      showToast("error", "You are offline. Save as draft first, then sync when connected.");
      return;
    }
    setSubmitting(true);

    // Save/update draft then sync immediately
    let draft: OfflineDraft;
    try {
      draft = await saveDraft(buildDraftInput());
      setSavedLocalId(draft.localId);
    } catch {
      showToast("error", "Failed to prepare data. Please try again.");
      setSubmitting(false);
      return;
    }

    // Sync it — awaiting here so the draft's syncError/serverId are written
    // to IDB before we navigate away.
    await syncOne(draft, token ?? null);

    setSubmitting(false);
    // Show feedback BEFORE navigating so the toast is visible while mounted.
    showToast("success", "Submitted! Check Drafts for the result.");
    // Small delay so the user can read the toast before the page changes.
    await new Promise((r) => setTimeout(r, 1200));
    setLocation("/mobile/offline-drafts");
  };

  const hasGps = !!(form.latitude && form.longitude);
  const hasPhoto = !!photo;
  const isBusy = saving || submitting || isSyncing(savedLocalId ?? "");

  return (
    <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Register Property</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {savedLocalId ? "Editing offline draft" : "Fill in the details below"}
        </p>
      </div>

      {/* Section: Owner */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Owner Info</h2>

        <MobileField label="Owner Name" required error={errors.ownerName}>
          <MobileInput
            value={form.ownerName}
            onChange={set("ownerName")}
            placeholder="e.g. Almaz Bekele"
          />
        </MobileField>

        <MobileField label="Owner Phone">
          <MobileInput
            value={form.ownerPhone}
            onChange={set("ownerPhone")}
            placeholder="e.g. 0911 234567"
            type="tel"
          />
        </MobileField>
      </section>

      {/* Section: Property Type */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Property Type</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROPERTY_TYPES.map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, propertyType: value }))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
                form.propertyType === value
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 active:bg-slate-50",
              )}
            >
              <span className="text-xl">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Section: Location */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Location</h2>

        <MobileField label="Kebele" required error={errors.kebele}>
          {kebeles.length > 0 ? (
            <MobileSelect
              value={form.kebeleId}
              onChange={(val) => {
                const k = kebeles.find((x) => x.id === Number(val));
                if (!k) return;
                setForm((f) => ({
                  ...f,
                  kebeleId: String(k.id),
                  kebeleCode: k.code,
                  kebeleName: k.name,
                  streetId: "",
                  streetName: "",
                  blockCode: "",
                }));
                setErrors((e) => ({ ...e, kebele: undefined }));
              }}
              placeholder={kebelesLoading ? "Loading kebeles…" : "Select kebele"}
              disabled={kebelesLoading}
            >
              {kebeles.map((k) => (
                <option key={k.id} value={String(k.id)}>
                  {k.name} ({k.code})
                </option>
              ))}
            </MobileSelect>
          ) : (
            <MobileInput
              value={form.kebeleCode}
              onChange={(val) => setForm((f) => ({ ...f, kebeleCode: val }))}
              placeholder="Enter kebele code (offline fallback)"
            />
          )}
        </MobileField>

        <MobileField label="Street" required error={errors.street}>
          {streets.length > 0 || form.kebeleId ? (
            <MobileSelect
              value={form.streetId}
              onChange={(val) => {
                const s = streets.find((x) => x.id === Number(val));
                if (!s) return;
                setForm((f) => ({ ...f, streetId: String(s.id), streetName: s.name, blockCode: "" }));
                setErrors((e) => ({ ...e, street: undefined }));
              }}
              placeholder={
                !form.kebeleId
                  ? "Select kebele first"
                  : streetsLoading
                  ? "Loading streets…"
                  : streets.length === 0
                  ? "No streets — type below"
                  : "Select street"
              }
              disabled={!form.kebeleId || streetsLoading}
            >
              {streets.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </MobileSelect>
          ) : null}
          {(!form.kebeleId || streets.length === 0) && (
            <MobileInput
              value={form.streetName}
              onChange={set("streetName")}
              placeholder="Enter street name"
              className="mt-2"
            />
          )}
        </MobileField>

        <div className="grid grid-cols-2 gap-3">
          <MobileField label="Block Code">
            {blocks.length > 0 ? (
              <MobileSelect
                value={form.blockCode}
                onChange={set("blockCode")}
                placeholder="Block"
                disabled={blocksLoading}
              >
                {(blocks as Array<{ id: number; code: string; description: string | null }>).map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code}
                  </option>
                ))}
              </MobileSelect>
            ) : (
              <MobileInput value={form.blockCode} onChange={set("blockCode")} placeholder="e.g. BL01" />
            )}
          </MobileField>

          <MobileField label="House Number">
            <MobileInput
              value={form.houseNumber}
              onChange={set("houseNumber")}
              placeholder="e.g. 101"
            />
          </MobileField>
        </div>

        <MobileField label="Building Name">
          <MobileInput
            value={form.buildingName}
            onChange={set("buildingName")}
            placeholder="Optional"
          />
        </MobileField>
      </section>

      {/* Section: GPS */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">GPS Coordinates</h2>

        <button
          type="button"
          onClick={captureGps}
          disabled={gpsLoading}
          className={cn(
            "w-full h-14 flex items-center justify-center gap-3 rounded-xl text-base font-semibold transition-all",
            hasGps
              ? "bg-green-50 border-2 border-green-400 text-green-700"
              : "bg-blue-600 text-white active:bg-blue-700",
            gpsLoading && "opacity-70",
          )}
        >
          {gpsLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : hasGps ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <MapPin className="w-5 h-5" />
          )}
          {gpsLoading ? "Getting GPS…" : hasGps ? "GPS Captured" : "Capture Current GPS"}
        </button>

        {hasGps && (
          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
            <span className="text-green-700 font-mono">
              {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}
            </span>
            <button
              onClick={() => setForm((f) => ({ ...f, latitude: "", longitude: "" }))}
              className="text-slate-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errors.gps && (
          <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {errors.gps}
          </p>
        )}

        {/* Manual entry */}
        <div className="grid grid-cols-2 gap-2">
          <MobileField label="Latitude (manual)">
            <MobileInput
              value={form.latitude}
              onChange={set("latitude")}
              type="number"
              placeholder="7.676842"
            />
          </MobileField>
          <MobileField label="Longitude (manual)">
            <MobileInput
              value={form.longitude}
              onChange={set("longitude")}
              type="number"
              placeholder="36.834145"
            />
          </MobileField>
        </div>
      </section>

      {/* Section: Photo */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Front View Photo</h2>

        {photo ? (
          <div className="relative">
            <img
              src={photo}
              alt="Property front view"
              className="w-full h-48 object-cover rounded-xl border border-slate-200"
            />
            <button
              onClick={() => setPhoto(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              Front View
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full h-36 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all",
              errors.photo
                ? "border-red-300 bg-red-50"
                : "border-slate-300 bg-slate-50 active:bg-slate-100",
            )}
          >
            <Camera className="w-8 h-8 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">Take / Upload Photo</span>
            <span className="text-xs text-slate-400">Front view required to submit</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPhotoChange}
        />

        {errors.photo && (
          <p className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {errors.photo}
          </p>
        )}
      </section>

      {/* Section: Remark */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Remarks</h2>
        <textarea
          value={form.remark}
          onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
          placeholder="Any additional notes…"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm resize-none"
        />
      </section>

      {/* Status checklist */}
      <div className="bg-slate-100 rounded-xl px-4 py-3 space-y-2 text-sm">
        <p className="font-semibold text-slate-600 text-xs uppercase tracking-wide mb-1">Submission readiness</p>
        {[
          { ok: !!form.ownerName.trim() && !!form.kebeleCode && !!form.streetName.trim(), label: "Required fields filled" },
          { ok: hasGps, label: "GPS coordinates captured" },
          { ok: hasPhoto, label: "Front view photo added" },
          { ok: isOnline, label: isOnline ? "Connected to network" : "No network — save offline draft" },
        ].map(({ ok, label }) => (
          <div key={label} className={cn("flex items-center gap-2", ok ? "text-green-700" : "text-slate-500")}>
            {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
            {label}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="space-y-3 pb-4">
        <button
          type="button"
          onClick={handleSaveOffline}
          disabled={isBusy}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-xl border-2 border-blue-600 text-blue-700 font-bold text-base active:bg-blue-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Saving…" : "Save Offline Draft"}
        </button>

        <button
          type="button"
          onClick={handleSubmitOnline}
          disabled={isBusy || !isOnline}
          className={cn(
            "w-full h-14 flex items-center justify-center gap-2 rounded-xl font-bold text-base text-white transition-all disabled:opacity-50",
            isOnline ? "bg-blue-600 active:bg-blue-700" : "bg-slate-400 cursor-not-allowed",
          )}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isOnline ? (
            <Send className="w-5 h-5" />
          ) : (
            <WifiOff className="w-5 h-5" />
          )}
          {submitting ? "Submitting…" : isOnline ? "Submit Online" : "Offline — Cannot Submit"}
        </button>

        {!isOnline && (
          <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Wifi className="w-3 h-3 inline mr-1" />
            Save as draft now. Go to <strong>Drafts</strong> to sync when back online.
          </p>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 rounded-xl px-4 py-3 text-white text-sm font-medium shadow-xl transition-all",
            toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-blue-700",
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
