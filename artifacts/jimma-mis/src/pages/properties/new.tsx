import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateProperty,
  useSubmitProperty,
  useCheckDuplicate,
  useListKebeles,
  useListStreets,
  useListBlocks,
  getListStreetsQueryKey,
  getListBlocksQueryKey,
  getCheckDuplicateQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Building2,
  User,
  Info,
  Camera,
  X,
  Send,
  Save,
  Plus,
  ImageIcon,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const propertySchema = z.object({
  houseNumber: z.string().optional(),
  buildingName: z.string().optional(),
  propertyType: z.enum(["residential", "commercial", "government", "institution", "mixed"]),
  ownershipType: z.enum(["private", "government", "institutional"]).optional(),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerPhone: z.string().optional(),
  occupantName: z.string().optional(),
  occupantPhone: z.string().optional(),
  businessName: z.string().optional(),
  businessLicenseNumber: z.string().optional(),
  numberOfFloors: z.coerce.number().min(1).optional(),
  buildingUse: z.string().optional(),
  kebele: z.string().min(1, "Kebele is required"),
  kebeleId: z.number().optional(),
  streetName: z.string().min(1, "Street name is required"),
  blockCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  remark: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  government: "Government",
  institution: "Institution",
  mixed: "Mixed Use",
};

function deriveCode(raw: string, len: number) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, len);
}

function AddressPreview({ kebeleCode, streetName, blockCode, houseNumber }: {
  kebeleCode?: string;
  streetName?: string;
  blockCode?: string;
  houseNumber?: string;
}) {
  const parts = [
    "JIM",
    kebeleCode ? `KB${deriveCode(kebeleCode, 6)}` : "KB??",
    streetName ? `ST${deriveCode(streetName, 6)}` : "ST??",
    blockCode ? `BL${blockCode.toUpperCase().replace(/[^A-Z0-9]/g, "")}` : "BL??",
    houseNumber ? `HN${houseNumber.replace(/[^A-Z0-9]/gi, "")}` : "HN??",
  ];
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground mb-1">Provisional address code preview</p>
      <code className="text-sm font-mono font-semibold tracking-wide text-primary">
        {parts.join("-")}
      </code>
      <p className="text-xs text-muted-foreground mt-1">
        Final code is generated upon City Officer approval.
      </p>
    </div>
  );
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

const PHOTO_CATEGORIES = [
  { value: "front_view", label: "Front View" },
  { value: "side_view", label: "Side View" },
  { value: "business_sign", label: "Business Sign" },
  { value: "document", label: "Document / Evidence" },
  { value: "other", label: "Other" },
];

interface PendingPhoto {
  id: string;
  file: File;
  category: string;
  preview: string;
}

async function uploadPhotoWithCategory(
  propertyId: number,
  file: File,
  category: string,
  token: string | null,
): Promise<void> {
  const fd = new FormData();
  fd.append("photo", file);
  fd.append("category", category);
  const resp = await fetch(`${BASE}/api/properties/${propertyId}/photos`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Photo upload failed");
  }
}

export default function NewProperty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { token } = useAuth();
  const createProperty = useCreateProperty();
  const submitProperty = useSubmitProperty();

  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStreetId, setSelectedStreetId] = useState<number | undefined>(undefined);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [addCategory, setAddCategory] = useState("front_view");
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kebeles = [], isLoading: kebelesLoading } = useListKebeles();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      propertyType: "residential",
      ownerName: "",
      kebele: "",
      streetName: "",
    },
  });

  const watchedKebeleId = form.watch("kebeleId");
  const watchedKebele = form.watch("kebele");
  const watchedStreetName = form.watch("streetName");
  const watchedBlockCode = form.watch("blockCode");
  const watchedHouseNumber = form.watch("houseNumber");
  const watchedLat = form.watch("latitude");
  const watchedLng = form.watch("longitude");
  const watchedType = form.watch("propertyType");

  const { data: streets = [], isLoading: streetsLoading } = useListStreets(
    { kebele_id: watchedKebeleId },
    { query: { queryKey: getListStreetsQueryKey({ kebele_id: watchedKebeleId }), enabled: !!watchedKebeleId } }
  );

  const { data: blocks = [], isLoading: blocksLoading } = useListBlocks(
    { street_id: selectedStreetId },
    { query: { queryKey: getListBlocksQueryKey({ street_id: selectedStreetId }), enabled: !!selectedStreetId } }
  );

  const hasGps = !!watchedLat && !!watchedLng;
  const hasDupTrigger = hasGps || !!watchedHouseNumber;
  const dupParams = {
    latitude: watchedLat,
    longitude: watchedLng,
    house_number: watchedHouseNumber,
    street_name: watchedStreetName,
    block_code: watchedBlockCode,
  };
  const { data: duplicateCheck } = useCheckDuplicate(
    dupParams,
    { query: { queryKey: getCheckDuplicateQueryKey(dupParams), enabled: hasDupTrigger } }
  );

  const captureGps = () => {
    setGpsLoading(true);
    if (!("geolocation" in navigator)) {
      setGpsLoading(false);
      toast({ variant: "destructive", title: "GPS Error", description: "Geolocation not supported by this browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("latitude", pos.coords.latitude);
        form.setValue("longitude", pos.coords.longitude);
        setGpsLoading(false);
        toast({ title: "GPS Captured", description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ variant: "destructive", title: "GPS Error", description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Only JPG, PNG, and WEBP images are allowed." });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: `Photos must be ${MAX_SIZE_MB} MB or smaller.` });
      return;
    }
    setPendingPhotos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), file, category: addCategory, preview: URL.createObjectURL(file) },
    ]);
  };

  const removePendingPhoto = (id: string) => {
    setPendingPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onKebeleChange = (kebeleId: string) => {
    const id = parseInt(kebeleId, 10);
    const kebele = kebeles.find((k) => k.id === id);
    if (!kebele) return;
    form.setValue("kebeleId", kebele.id);
    form.setValue("kebele", kebele.code);
    form.setValue("streetName", "");
    form.setValue("blockCode", "");
    setSelectedStreetId(undefined);
  };

  const onStreetChange = (streetId: string) => {
    const id = parseInt(streetId, 10);
    const street = streets.find((s) => s.id === id);
    if (!street) return;
    form.setValue("streetName", street.name);
    form.setValue("blockCode", "");
    setSelectedStreetId(street.id);
  };

  const handleSaveDraft = async (data: PropertyFormValues) => {
    const { kebeleId: _unused, ...payload } = data;
    setSaving(true);
    try {
      const property = await new Promise<{ id: number }>((resolve, reject) => {
        createProperty.mutate(
          { data: payload },
          { onSuccess: resolve, onError: reject }
        );
      });
      if (pendingPhotos.length > 0) {
        setUploadingCount(pendingPhotos.length);
        let failCount = 0;
        for (const p of pendingPhotos) {
          try {
            await uploadPhotoWithCategory(property.id, p.file, p.category, token ?? null);
          } catch {
            failCount++;
          } finally {
            setUploadingCount((c) => c - 1);
          }
        }
        if (failCount > 0) {
          toast({ variant: "destructive", title: "Some Photos Failed", description: `Draft saved but ${failCount} photo(s) could not be uploaded.` });
        }
      }
      toast({ title: "Draft Saved", description: "Property saved as draft. Add GPS and photo before submitting." });
      setLocation(`/properties/${property.id}`);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to save draft. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForVerification = async (data: PropertyFormValues) => {
    if (!hasGps) {
      toast({ variant: "destructive", title: "GPS Required", description: "Capture GPS coordinates before submitting." });
      return;
    }
    const hasFrontView = pendingPhotos.some((p) => p.category === "front_view");
    if (!hasFrontView) {
      toast({ variant: "destructive", title: "Front View Photo Required", description: "Add at least one Front View photo before submitting." });
      return;
    }
    const { kebeleId: _unused, ...payload } = data;
    setSaving(true);
    try {
      const property = await new Promise<{ id: number }>((resolve, reject) => {
        createProperty.mutate(
          { data: payload },
          { onSuccess: resolve, onError: reject }
        );
      });
      // Upload all pending photos
      setUploadingCount(pendingPhotos.length);
      for (const p of pendingPhotos) {
        try {
          await uploadPhotoWithCategory(property.id, p.file, p.category, token ?? null);
        } catch {
          // individual failure — continue uploading others
        } finally {
          setUploadingCount((c) => c - 1);
        }
      }
      await new Promise<void>((resolve, reject) => {
        submitProperty.mutate(
          { id: property.id },
          { onSuccess: () => resolve(), onError: reject }
        );
      });
      toast({ title: "Submitted for Verification", description: "Property has been sent to the Kebele Officer." });
      setLocation(`/properties/${property.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit. Please try again.";
      toast({ variant: "destructive", title: "Submission Error", description: msg });
    } finally {
      setSaving(false);
      setUploadingCount(0);
    }
  };

  const selectedKebele = kebeles.find((k) => k.code === watchedKebele);
  const isCommercial = watchedType === "commercial";
  const isBusy = saving || createProperty.isPending || submitProperty.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Register New Property</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Fill in all required fields. Save as draft or submit directly for verification.
          </p>
        </div>
        {watchedType && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {PROPERTY_TYPE_LABELS[watchedType]}
          </Badge>
        )}
      </div>

      <Form {...form}>
        <form className="space-y-6">

          {/* Section 1: Location */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Location & Address</CardTitle>
              </div>
              <CardDescription>Select kebele, street, and capture GPS coordinates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="kebele"
                  render={() => (
                    <FormItem>
                      <FormLabel>Kebele *</FormLabel>
                      <Select
                        onValueChange={onKebeleChange}
                        disabled={kebelesLoading}
                        value={selectedKebele ? String(selectedKebele.id) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={kebelesLoading ? "Loading…" : "Select kebele"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {kebeles.map((k) => (
                            <SelectItem key={k.id} value={String(k.id)}>
                              {k.name} ({k.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="streetName"
                  render={() => (
                    <FormItem>
                      <FormLabel>Street *</FormLabel>
                      <Select
                        onValueChange={onStreetChange}
                        disabled={!watchedKebeleId || streetsLoading}
                        value={streets.find((s) => s.name === watchedStreetName) ? String(streets.find((s) => s.name === watchedStreetName)!.id) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={!watchedKebeleId ? "Select kebele first" : streetsLoading ? "Loading…" : "Select street"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {streets.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name} ({s.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="houseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>House Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 101" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blockCode"
                  render={() => (
                    <FormItem>
                      <FormLabel>Block</FormLabel>
                      <Select
                        onValueChange={(val) => form.setValue("blockCode", val)}
                        disabled={!selectedStreetId || blocksLoading}
                        value={watchedBlockCode ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedStreetId ? "Select street first" : blocksLoading ? "Loading…" : blocks.length === 0 ? "No blocks available" : "Select block"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(blocks as Array<{ id: number; code: string; description: string | null }>).map((b) => (
                            <SelectItem key={b.id} value={b.code}>
                              {b.code}{b.description ? ` — ${b.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* GPS */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={captureGps} disabled={gpsLoading}>
                    {gpsLoading
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <MapPin className="w-4 h-4 mr-2" />}
                    Capture Current GPS
                  </Button>
                  {hasGps && (
                    <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {watchedLat!.toFixed(6)}, {watchedLng!.toFixed(6)}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Latitude (manual)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            placeholder="7.676842"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Longitude (manual)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            placeholder="36.834145"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Duplicate warnings */}
              {duplicateCheck?.hasDuplicateGps && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>A property is already registered at these GPS coordinates. Please verify the location.</span>
                </div>
              )}
              {duplicateCheck?.hasDuplicateHouseNumber && !duplicateCheck.hasDuplicateGps && (
                <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This house number may already exist on this street. Please double-check before submitting.</span>
                </div>
              )}

              {/* Address preview */}
              {(watchedKebele || watchedStreetName) && (
                <AddressPreview
                  kebeleCode={watchedKebele}
                  streetName={watchedStreetName}
                  blockCode={watchedBlockCode}
                  houseNumber={watchedHouseNumber}
                />
              )}
            </CardContent>
          </Card>

          {/* Section 2: Property Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Property Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="institution">Institution</SelectItem>
                          <SelectItem value="mixed">Mixed Use</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownershipType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select ownership" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="institutional">Institutional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buildingName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jimma Tower" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numberOfFloors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Floors</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="1" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buildingUse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building Use</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Office, Shop, Clinic" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Owner & Occupant */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Owner & Occupant Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ownerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full legal name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+251 9…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="occupantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="If different from owner" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="occupantPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupant Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+251 9…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isCommercial && (
                  <>
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Registered business name" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="businessLicenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business License Number</FormLabel>
                          <FormControl>
                            <Input placeholder="License number" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>

              <FormField
                control={form.control}
                name="remark"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes for the kebele officer…"
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 4: Photo Upload */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Property Photos</CardTitle>
              </div>
              <CardDescription>
                At least one <strong>Front View</strong> photo is required before submitting.
                JPG, PNG, WEBP · max {MAX_SIZE_MB} MB each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPhotoChange}
              />

              {/* Add photo controls */}
              <div className="flex gap-2 flex-wrap">
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PHOTO_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-dashed border-primary/50 text-primary text-sm hover:bg-primary/5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Photo
                </button>
              </div>

              {/* Upload progress indicator */}
              {uploadingCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading {uploadingCount} photo{uploadingCount > 1 ? "s" : ""}…
                </div>
              )}

              {/* Pending photos list */}
              {pendingPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pendingPhotos.map((p) => {
                    const catLabel = PHOTO_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category;
                    return (
                      <div key={p.id} className="relative group rounded-lg border overflow-hidden bg-muted/20">
                        <img
                          src={p.preview}
                          alt={catLabel}
                          className="w-full h-28 object-cover"
                        />
                        <div className="px-2 py-1 text-xs font-medium truncate bg-background/80 backdrop-blur-sm border-t">
                          {catLabel}
                          {p.category === "front_view" && (
                            <span className="ml-1 text-primary">★</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(p.id)}
                          className="absolute top-1.5 right-1.5 bg-destructive/90 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Click to add a Front View photo</span>
                  <span className="text-xs mt-1">JPG, PNG, WEBP · max {MAX_SIZE_MB} MB</span>
                </button>
              )}

              {/* Front view requirement hint */}
              {pendingPhotos.length > 0 && !pendingPhotos.some((p) => p.category === "front_view") && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No Front View photo yet — required before submitting.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Info note */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 border rounded-md px-4 py-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>Save Draft</strong> — saves immediately without GPS or photo requirement. You can finish and submit later.
              <br />
              <strong>Submit for Verification</strong> — requires GPS and photo; sends to Kebele Officer.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/properties")}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={form.handleSubmit(handleSaveDraft)}
            >
              {isBusy && saving && !submitProperty.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Save className="w-4 h-4 mr-2" />}
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={form.handleSubmit(handleSubmitForVerification)}
            >
              {isBusy && submitProperty.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Send className="w-4 h-4 mr-2" />}
              Submit for Verification
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
