import { useState, useRef } from "react";
import {
  useGetProperty,
  getGetPropertyQueryKey,
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

function statusVariant(status: string) {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function statusLabel(status: string) {
  return status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PropertyShow({ params }: { params: { id: string } }) {
  const propertyId = Number(params.id);
  const { data: property, isLoading, error } = useGetProperty(propertyId, {
    query: { enabled: !!propertyId, queryKey: getGetPropertyQueryKey(propertyId) },
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

  const canApprove =
    (user?.role === "admin" || user?.role === "city_officer" || user?.role === "kebele_officer") &&
    !["approved", "draft"].includes(property.status);
  const canReject =
    (user?.role === "admin" || user?.role === "city_officer" || user?.role === "kebele_officer") &&
    !["rejected", "draft"].includes(property.status);
  const canResubmit =
    (user?.role === "admin" || user?.role === "enumerator") && property.status === "rejected";
  const canSubmit =
    (user?.role === "enumerator" || user?.role === "admin") && property.status === "draft";

  const invalidate = (data: unknown) => {
    queryClient.setQueryData(getGetPropertyQueryKey(propertyId), data);
  };

  const handleApprove = () => {
    approveProperty.mutate(
      { id: propertyId, data: { remark: "Approved by " + user?.username } },
      {
        onSuccess: (data) => {
          invalidate(data);
          toast({ title: "Property Approved", description: "Address code has been generated." });
        },
      }
    );
  };

  const handleReject = () => {
    rejectProperty.mutate(
      { id: propertyId, data: { remark } },
      {
        onSuccess: (data) => {
          invalidate(data);
          toast({ title: "Property Rejected", description: "Property returned for review." });
          setIsRejectOpen(false);
          setRemark("");
        },
      }
    );
  };

  const handleResubmit = () => {
    resubmitProperty.mutate(
      { id: propertyId },
      {
        onSuccess: (data) => {
          invalidate(data);
          toast({ title: "Property Resubmitted", description: "Property sent back for approval." });
        },
      }
    );
  };

  const handleSubmitForVerification = () => {
    if (!property.latitude || !property.longitude) {
      toast({ variant: "destructive", title: "GPS Required", description: "Edit the property to add GPS coordinates first." });
      return;
    }
    if (!property.propertyPhoto && !photoFile) {
      toast({ variant: "destructive", title: "Photo Required", description: "Upload a property photo first." });
      return;
    }
    submitProperty.mutate(
      { id: propertyId },
      {
        onSuccess: (data) => {
          invalidate(data);
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
      toast({ title: "Photo Uploaded", description: "Property photo has been saved." });
      setPhotoFile(null);
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(propertyId) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ variant: "destructive", title: "Upload Error", description: msg });
    } finally {
      setPhotoUploading(false);
    }
  };

  const photoSrc = property.propertyPhoto
    ? property.propertyPhoto.startsWith("http")
      ? property.propertyPhoto
      : `${BASE}/api${property.propertyPhoto}`
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/properties">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Details</h2>
          <p className="text-sm text-muted-foreground">
            ID: {property.id} • Registered {new Date(property.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {property.status === "approved" && property.addressCode && (
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-mono font-bold text-lg tracking-wider border border-primary/20 shadow-sm">
              {property.addressCode}
            </div>
          )}
          {property.addressCode && property.status !== "approved" && (
            <div className="bg-muted text-muted-foreground px-3 py-1.5 rounded-lg font-mono text-sm tracking-wider border">
              {property.addressCode} <span className="text-xs">(provisional)</span>
            </div>
          )}
          <Badge className="capitalize text-sm px-3 py-1" variant={statusVariant(property.status)}>
            {statusLabel(property.status)}
          </Badge>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <Button
            onClick={handleSubmitForVerification}
            disabled={submitProperty.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitProperty.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Send className="w-4 h-4 mr-2" />}
            Submit for Verification
          </Button>
        )}
        {canApprove && (
          <Button onClick={handleApprove} disabled={approveProperty.isPending} className="bg-green-600 hover:bg-green-700 text-white">
            {approveProperty.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <CheckCircle className="w-4 h-4 mr-2" />}
            Approve Property
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
                  <Label>Reason for rejection *</Label>
                  <Textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide details on what needs to be fixed..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!remark || rejectProperty.isPending}
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
            {resubmitProperty.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <RotateCcw className="w-4 h-4 mr-2" />}
            Resubmit for Approval
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Info */}
        <Card>
          <CardHeader><CardTitle>Core Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Type</div><div className="font-medium capitalize">{property.propertyType}</div></div>
              <div><div className="text-muted-foreground">Ownership</div><div className="font-medium capitalize">{property.ownershipType || '-'}</div></div>
              <div><div className="text-muted-foreground">Building Name</div><div className="font-medium">{property.buildingName || '-'}</div></div>
              <div><div className="text-muted-foreground">Use</div><div className="font-medium">{property.buildingUse || '-'}</div></div>
              <div><div className="text-muted-foreground">Floors</div><div className="font-medium">{property.numberOfFloors || '-'}</div></div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Kebele</div><div className="font-medium">{property.kebele}</div></div>
              <div><div className="text-muted-foreground">Street Name</div><div className="font-medium">{property.streetName}</div></div>
              <div><div className="text-muted-foreground">House Number</div><div className="font-medium">{property.houseNumber || '-'}</div></div>
              <div><div className="text-muted-foreground">Block Code</div><div className="font-medium">{property.blockCode || '-'}</div></div>
              <div className="col-span-2">
                <div className="text-muted-foreground flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> GPS Coordinates
                </div>
                <div className="font-mono text-xs p-2 bg-muted rounded-md inline-block">
                  {property.latitude && property.longitude
                    ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`
                    : <span className="text-amber-600">Not Captured</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ownership */}
        <Card>
          <CardHeader><CardTitle>Ownership & Occupancy</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Owner Name</div><div className="font-medium">{property.ownerName}</div></div>
              <div><div className="text-muted-foreground">Owner Phone</div><div className="font-medium">{property.ownerPhone || '-'}</div></div>
              <div><div className="text-muted-foreground">Occupant Name</div><div className="font-medium">{property.occupantName || '-'}</div></div>
              <div><div className="text-muted-foreground">Occupant Phone</div><div className="font-medium">{property.occupantPhone || '-'}</div></div>
              <div><div className="text-muted-foreground">Business Name</div><div className="font-medium">{property.businessName || '-'}</div></div>
              <div><div className="text-muted-foreground">License No.</div><div className="font-medium">{property.businessLicenseNumber || '-'}</div></div>
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
              <div className="flex items-center justify-center h-32 bg-muted rounded-lg border border-dashed text-muted-foreground text-sm">
                <Camera className="w-5 h-5 mr-2" /> No photo uploaded
              </div>
            )}

            {/* Upload controls (visible for draft/rejected by enumerator or admin) */}
            {(property.status === "draft" || property.status === "rejected") &&
              (user?.role === "enumerator" || user?.role === "admin") && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPhotoChange}
                />
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
                    <Button
                      size="sm"
                      onClick={handleUploadPhoto}
                      disabled={photoUploading}
                    >
                      {photoUploading
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                      Save Photo
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    {photoSrc ? "Replace Photo" : "Upload Photo"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>System Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-muted-foreground">Registered By</div><div className="font-medium">{property.createdByUser?.fullName || '-'}</div></div>
              <div><div className="text-muted-foreground">Created At</div><div className="font-medium">{new Date(property.createdAt).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground">Updated At</div><div className="font-medium">{property.updatedAt ? new Date(property.updatedAt).toLocaleString() : '-'}</div></div>
              <div className="col-span-2 md:col-span-1">
                <div className="text-muted-foreground">Remarks / Notes</div>
                <div className="font-medium p-2 bg-muted rounded-md mt-1 text-xs">{property.remark || 'No remarks.'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
