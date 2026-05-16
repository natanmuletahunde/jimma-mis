import { useState, useRef } from "react";
import {
  useGetProperty,
  useGetPropertyApprovals,
  getGetPropertyQueryKey,
  getGetPropertyApprovalsQueryKey,
  useApproveProperty,
  useRejectProperty,
  useResubmitProperty,
  useSubmitProperty,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MapPin,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RotateCcw,
  Camera,
  Send,
  X,
  Clock,
  History,
} from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function uploadPhoto(propertyId: number, file: File, token: string | null): Promise<void> {
  const fd = new FormData();
  fd.append("photo", file);
  const resp = await fetch(`${BASE}/api/properties/${propertyId}/photo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Photo upload failed");
  }
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: "Registered", color: "text-gray-600" },
  submitted: { label: "Submitted for Verification", color: "text-blue-600" },
  kebele_verified: { label: "Kebele Verified", color: "text-indigo-600" },
  approved: { label: "Approved", color: "text-green-600" },
  rejected: { label: "Rejected", color: "text-red-600" },
  resubmitted: { label: "Resubmitted", color: "text-amber-600" },
};

export default function PropertyShow({ params }: { params: { id: string } }) {
  const propertyId = Number(params.id);
  const { data: property, isLoading, error } = useGetProperty(propertyId, {
    query: { enabled: !!propertyId, queryKey: getGetPropertyQueryKey(propertyId) },
  });
  const { data: approvalHistory = [], isLoading: historyLoading } = useGetPropertyApprovals(propertyId, {
    query: { enabled: !!propertyId, queryKey: getGetPropertyApprovalsQueryKey(propertyId) },
  });

  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approveProperty = useApproveProperty();
  const rejectProperty = useRejectProperty();
  const resubmitProperty = useResubmitProperty();
  const submitProperty = useSubmitProperty();

  const [remark, setRemark] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !property) return <div className="p-8 text-destructive">Failed to load property details.</div>;

  const status = property.status;
  const role = user?.role;

  // Invalidate both detail and list so both pages show fresh data
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(propertyId) });
    queryClient.invalidateQueries({ queryKey: getGetPropertyApprovalsQueryKey(propertyId) });
    queryClient.invalidateQueries({ queryKey: ["listProperties"] });
  };

  // ── Role-aware button visibility ──────────────────────────────────────────
  // Enumerator/admin: submit a draft
  const canSubmit = (role === "enumerator" || role === "admin") && status === "draft";

  // Kebele officer: approve pending only
  const canKebeleApprove = role === "kebele_officer" && status === "pending";
  // City officer / admin: approve pending or kebele_verified
  const canCityApprove = (role === "city_officer" || role === "admin") && (status === "pending" || status === "kebele_verified");
  const canApprove = canKebeleApprove || canCityApprove;

  // Kebele officer: reject pending only; city officer/admin: reject pending or kebele_verified
  const canKebeleReject = role === "kebele_officer" && status === "pending";
  const canCityReject = (role === "city_officer" || role === "admin") && (status === "pending" || status === "kebele_verified");
  const canReject = canKebeleReject || canCityReject;

  // Enumerator/admin: resubmit a rejected property
  const canResubmit = (role === "enumerator" || role === "admin") && status === "rejected";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleApprove = () => {
    const remarkText = role === "kebele_officer" ? "Verified by Kebele Officer" : `Approved by ${user?.username ?? "officer"}`;
    approveProperty.mutate(
      { id: propertyId, data: { remark: remarkText } },
      {
        onSuccess: () => {
          invalidateAll();
          const isKebele = role === "kebele_officer";
          toast({
            title: isKebele ? "Kebele Verified" : "Property Approved",
            description: isKebele ? "Sent for City Officer approval." : "Official address code has been generated.",
          });
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Action Failed", description: err instanceof Error ? err.message : "Could not approve property." });
        },
      }
    );
  };

  const handleReject = () => {
    if (!remark.trim()) {
      toast({ variant: "destructive", title: "Remark Required", description: "Please provide a reason for rejection." });
      return;
    }
    rejectProperty.mutate(
      { id: propertyId, data: { remark } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Property Rejected", description: "Property returned to enumerator for corrections." });
          setIsRejectOpen(false);
          setRemark("");
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Action Failed", description: err instanceof Error ? err.message : "Could not reject property." });
        },
      }
    );
  };

  const handleResubmit = () => {
    resubmitProperty.mutate(
      { id: propertyId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Resubmitted", description: "Property sent back for approval." });
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Action Failed", description: err instanceof Error ? err.message : "Could not resubmit." });
        },
      }
    );
  };

  const handleSubmit = () => {
    if (!property.latitude || !property.longitude) {
      toast({ variant: "destructive", title: "GPS Required", description: "Edit the property to add GPS coordinates first." });
      return;
    }
    if (!property.propertyPhoto && !photoFile) {
      toast({ variant: "destructive", title: "Photo Required", description: "Upload a property photo before submitting." });
      return;
    }
    submitProperty.mutate(
      { id: propertyId },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Submitted for Verification", description: "Sent to Kebele Officer." });
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Submission failed";
          toast({ variant: "destructive", title: "Submit Error", description: msg });
        },
      }
    );
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      await uploadPhoto(propertyId, photoFile, token ?? null);
      toast({ title: "Photo Uploaded", description: "Property photo saved." });
      setPhotoFile(null);
      setPhotoPreview(null);
      invalidateAll();
    } catch (err) {
      toast({ variant: "destructive", title: "Upload Error", description: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const photoSrc = property.propertyPhoto
    ? property.propertyPhoto.startsWith("http")
      ? property.propertyPhoto
      : `${BASE}/api${property.propertyPhoto}`
    : null;

  const canUploadPhoto = (status === "draft" || status === "rejected") && (role === "enumerator" || role === "admin");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/properties">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Details</h2>
          <p className="text-sm text-muted-foreground">
            ID: {property.id} • Registered {new Date(property.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {property.status === "approved" && property.addressCode ? (
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-mono font-bold text-lg tracking-wider border border-primary/20 shadow-sm">
              {property.addressCode}
            </div>
          ) : property.addressCode ? (
            <div className="bg-muted text-muted-foreground px-3 py-1.5 rounded-lg font-mono text-sm tracking-wider border" title="Provisional — changes to official code upon City Officer approval">
              {property.addressCode} <span className="text-xs">(provisional)</span>
            </div>
          ) : null}
          <Badge className="capitalize text-sm px-3 py-1" variant={statusVariant(status)}>
            {statusLabel(status)}
          </Badge>
        </div>
      </div>

      {/* Action buttons */}
      {(canSubmit || canApprove || canReject || canResubmit) && (
        <div className="flex flex-wrap gap-3 p-4 bg-muted/40 rounded-lg border">
          <p className="w-full text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Available Actions</p>

          {canSubmit && (
            <Button
              onClick={handleSubmit}
              disabled={submitProperty.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitProperty.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit for Verification
            </Button>
          )}

          {canApprove && (
            <Button onClick={handleApprove} disabled={approveProperty.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {approveProperty.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {role === "kebele_officer" ? "Verify (Kebele)" : "Approve & Generate Address"}
            </Button>
          )}

          {canReject && (
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <XCircle className="w-4 h-4 mr-2" />Reject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Reject Property</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Reason for rejection <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Describe what needs to be corrected…"
                      rows={4}
                    />
                    {remark.trim() === "" && (
                      <p className="text-xs text-destructive">Rejection reason is required.</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsRejectOpen(false); setRemark(""); }}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!remark.trim() || rejectProperty.isPending}
                  >
                    {rejectProperty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirm Rejection
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canResubmit && (
            <Button onClick={handleResubmit} disabled={resubmitProperty.isPending} variant="secondary">
              {resubmitProperty.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Resubmit for Approval
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Info */}
        <Card>
          <CardHeader><CardTitle>Core Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Type</div><div className="font-medium capitalize">{property.propertyType}</div></div>
              <div><div className="text-muted-foreground">Ownership</div><div className="font-medium capitalize">{property.ownershipType || '—'}</div></div>
              <div><div className="text-muted-foreground">Building Name</div><div className="font-medium">{property.buildingName || '—'}</div></div>
              <div><div className="text-muted-foreground">Use</div><div className="font-medium">{property.buildingUse || '—'}</div></div>
              <div><div className="text-muted-foreground">Floors</div><div className="font-medium">{property.numberOfFloors ?? '—'}</div></div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Kebele</div><div className="font-medium">{property.kebele}</div></div>
              <div><div className="text-muted-foreground">Street Name</div><div className="font-medium">{property.streetName}</div></div>
              <div><div className="text-muted-foreground">House Number</div><div className="font-medium">{property.houseNumber || '—'}</div></div>
              <div><div className="text-muted-foreground">Block Code</div><div className="font-medium">{property.blockCode || '—'}</div></div>
              <div className="col-span-2">
                <div className="text-muted-foreground flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> GPS Coordinates
                </div>
                <div className={`font-mono text-xs p-2 rounded-md inline-block ${property.latitude && property.longitude ? "bg-muted" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {property.latitude && property.longitude
                    ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`
                    : "⚠ Not captured"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ownership */}
        <Card>
          <CardHeader><CardTitle>Ownership & Occupancy</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Owner Name</div><div className="font-medium">{property.ownerName}</div></div>
              <div><div className="text-muted-foreground">Owner Phone</div><div className="font-medium">{property.ownerPhone || '—'}</div></div>
              <div><div className="text-muted-foreground">Occupant Name</div><div className="font-medium">{property.occupantName || '—'}</div></div>
              <div><div className="text-muted-foreground">Occupant Phone</div><div className="font-medium">{property.occupantPhone || '—'}</div></div>
              <div><div className="text-muted-foreground">Business Name</div><div className="font-medium">{property.businessName || '—'}</div></div>
              <div><div className="text-muted-foreground">License No.</div><div className="font-medium">{property.businessLicenseNumber || '—'}</div></div>
            </div>
          </CardContent>
        </Card>

        {/* Photo */}
        <Card>
          <CardHeader><CardTitle>Property Photo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt="Property"
                className="rounded-lg border object-cover w-full max-h-56"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex items-center justify-center h-32 bg-muted rounded-lg border border-dashed text-muted-foreground text-sm gap-2">
                <Camera className="w-5 h-5" /> No photo uploaded
              </div>
            )}

            {canUploadPhoto && (
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                {photoPreview ? (
                  <div className="space-y-2">
                    <div className="relative inline-block">
                      <img src={photoPreview} alt="Preview" className="rounded-lg border max-h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <Button size="sm" onClick={handleUploadPhoto} disabled={photoUploading}>
                      {photoUploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                      Save Photo
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    {photoSrc ? "Replace Photo" : "Upload Photo"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader><CardTitle>System Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Registered By</div><div className="font-medium">{property.createdByUser?.fullName || '—'}</div></div>
              <div><div className="text-muted-foreground">Created At</div><div className="font-medium">{new Date(property.createdAt).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground">Updated At</div><div className="font-medium">{property.updatedAt ? new Date(property.updatedAt).toLocaleString() : '—'}</div></div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Remarks / Notes</div>
                <div className="font-medium p-2 bg-muted rounded-md mt-1 text-xs whitespace-pre-wrap">{property.remark || 'No remarks.'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <CardTitle>Approval History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : approvalHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
            ) : (
              <ol className="relative border-l border-muted-foreground/20 space-y-4 ml-3">
                {approvalHistory.map((entry) => {
                  const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "text-gray-600" };
                  return (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-background border-2 border-muted-foreground/30 flex items-center justify-center">
                        <Clock className="w-2 h-2 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.actor?.fullName ?? "System"} • {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        {entry.remark && (
                          <span className="text-xs bg-muted px-2 py-1 rounded mt-0.5 italic">{entry.remark}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
