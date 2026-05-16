import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateProperty,
  useCheckDuplicate,
  useListKebeles,
  useListStreets,
  getListStreetsQueryKey,
  getCheckDuplicateQueryKey,
} from "@workspace/api-client-react";
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
} from "lucide-react";

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

function AddressPreview({ kebele, streetName, blockCode, houseNumber }: {
  kebele?: string;
  streetName?: string;
  blockCode?: string;
  houseNumber?: string;
}) {
  const parts = [
    "JIM",
    kebele ? `KB${kebele.toUpperCase().replace(/\s/g, "")}` : "KB??",
    streetName ? `ST${streetName.toUpperCase().replace(/\s/g, "").slice(0, 8)}` : "ST??",
    blockCode ? `BL${blockCode.toUpperCase()}` : "BL??",
    houseNumber ? `HN${houseNumber}` : "HN??",
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

export default function NewProperty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProperty = useCreateProperty();
  const [gpsLoading, setGpsLoading] = useState(false);

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

  const onKebeleChange = (kebeleId: string) => {
    const id = parseInt(kebeleId, 10);
    const kebele = kebeles.find((k) => k.id === id);
    if (!kebele) return;
    form.setValue("kebeleId", kebele.id);
    form.setValue("kebele", kebele.code);
    form.setValue("streetName", "");
  };

  const onStreetChange = (streetId: string) => {
    const id = parseInt(streetId, 10);
    const street = streets.find((s) => s.id === id);
    if (!street) return;
    form.setValue("streetName", street.name);
  };

  const onSubmit = (data: PropertyFormValues) => {
    const { kebeleId: _unused, ...payload } = data;
    createProperty.mutate(
      { data: payload },
      {
        onSuccess: (property) => {
          toast({ title: "Property Registered", description: "Record submitted for kebele verification." });
          setLocation(`/properties/${property.id}`);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to register property. Please try again." });
        },
      }
    );
  };

  const selectedKebele = kebeles.find((k) => k.code === watchedKebele);
  const isCommercial = watchedType === "commercial";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Register New Property</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete all required fields and capture GPS coordinates for GIS mapping.
          </p>
        </div>
        {watchedType && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {PROPERTY_TYPE_LABELS[watchedType]}
          </Badge>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
                {/* Kebele dropdown */}
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

                {/* Street dropdown */}
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

                {/* House number */}
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

                {/* Block code */}
                <FormField
                  control={form.control}
                  name="blockCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Block Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. BL01" {...field} value={field.value ?? ""} />
                      </FormControl>
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

                {/* Manual coordinate inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="latitude"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Latitude (manual entry)</FormLabel>
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
                        <FormLabel className="text-xs text-muted-foreground">Longitude (manual entry)</FormLabel>
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
                  kebele={watchedKebele}
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
                          <FormLabel>Business Name</FormLabel>
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

          {/* Info note */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 border rounded-md px-4 py-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              After submission, this record is sent to the Kebele Officer for verification, then to the City Officer for final approval and address code generation.
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/properties")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProperty.isPending}>
              {createProperty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Registration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
