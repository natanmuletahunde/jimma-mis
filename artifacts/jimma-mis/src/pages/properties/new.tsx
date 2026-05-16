import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProperty, useCheckDuplicate } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";

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
  numberOfFloors: z.coerce.number().optional(),
  buildingUse: z.string().optional(),
  kebele: z.string().min(1, "Kebele is required"),
  streetName: z.string().min(1, "Street name is required"),
  blockCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  remark: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function NewProperty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProperty = useCreateProperty();
  const [gpsLoading, setGpsLoading] = useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      propertyType: "residential",
      ownerName: "",
      kebele: "",
      streetName: "",
    },
  });

  const { latitude, longitude, houseNumber } = form.watch();

  const { data: duplicateCheck } = useCheckDuplicate(
    { 
      latitude, 
      longitude, 
      house_number: houseNumber 
    },
    { 
      query: { 
        enabled: (!!latitude && !!longitude) || !!houseNumber 
      } 
    }
  );

  const onSubmit = (data: PropertyFormValues) => {
    createProperty.mutate(
      { data },
      {
        onSuccess: (property) => {
          toast({ title: "Property Registered", description: "Successfully created new property record." });
          setLocation(`/properties/${property.id}`);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to register property." });
        }
      }
    );
  };

  const captureGps = () => {
    setGpsLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("latitude", position.coords.latitude);
          form.setValue("longitude", position.coords.longitude);
          setGpsLoading(false);
          toast({ title: "GPS Captured", description: "Coordinates successfully recorded." });
        },
        (error) => {
          setGpsLoading(false);
          toast({ variant: "destructive", title: "GPS Error", description: error.message });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsLoading(false);
      toast({ variant: "destructive", title: "GPS Error", description: "Geolocation not supported by this browser." });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Register New Property</h2>
        <p className="text-sm text-muted-foreground">Enter property details and capture GPS location.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Location & GPS</CardTitle>
              <CardDescription>Capture precise coordinates for GIS mapping.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button type="button" variant="secondary" onClick={captureGps} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                  Capture Current Location
                </Button>
                {latitude && longitude && (
                  <div className="text-sm text-muted-foreground">
                    Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
                  </div>
                )}
              </div>

              {duplicateCheck?.hasDuplicateGps && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: A property is already registered at these coordinates.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <FormField control={form.control} name="kebele" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kebele *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="streetName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="houseNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>House Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="blockCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Block Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {duplicateCheck?.hasDuplicateHouseNumber && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-md text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: House number may be duplicated in this area.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="institution">Institution</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="ownershipType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ownership Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select ownership" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="institutional">Institutional</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="buildingName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="numberOfFloors" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Floors</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="buildingUse" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Use</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner & Occupant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="ownerName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="ownerPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="occupantName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupant Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="occupantPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupant Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="businessName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name (If commercial)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="businessLicenseNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business License Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="remark" render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Additional Remarks</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pb-12">
            <Button type="button" variant="outline" onClick={() => setLocation("/properties")}>Cancel</Button>
            <Button type="submit" disabled={createProperty.isPending}>
              {createProperty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Registration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
