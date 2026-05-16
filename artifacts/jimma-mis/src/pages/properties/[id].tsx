import { useState } from "react";
import { useGetProperty, getGetPropertyQueryKey, useApproveProperty, useRejectProperty, useResubmitProperty } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, CheckCircle, XCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function PropertyShow({ params }: { params: { id: string } }) {
  const propertyId = Number(params.id);
  const { data: property, isLoading, error } = useGetProperty(propertyId, {
    query: { enabled: !!propertyId, queryKey: getGetPropertyQueryKey(propertyId) }
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const approveProperty = useApproveProperty();
  const rejectProperty = useRejectProperty();
  const resubmitProperty = useResubmitProperty();
  
  const [remark, setRemark] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error || !property) return <div className="p-8 text-destructive">Failed to load property details.</div>;

  const canApprove = (user?.role === "admin" || user?.role === "city_officer") && property.status !== "approved";
  const canReject = (user?.role === "admin" || user?.role === "city_officer") && property.status !== "rejected";
  const canResubmit = (user?.role === "admin" || user?.role === "enumerator") && property.status === "rejected";

  const handleApprove = () => {
    approveProperty.mutate(
      { id: propertyId, data: { remark: "Approved by " + user?.username } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetPropertyQueryKey(propertyId), data);
          toast({ title: "Property Approved", description: "Address code has been generated." });
        }
      }
    );
  };

  const handleReject = () => {
    rejectProperty.mutate(
      { id: propertyId, data: { remark } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetPropertyQueryKey(propertyId), data);
          toast({ title: "Property Rejected", description: "Property returned for review." });
          setIsRejectOpen(false);
          setRemark("");
        }
      }
    );
  };

  const handleResubmit = () => {
    resubmitProperty.mutate(
      { id: propertyId },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetPropertyQueryKey(propertyId), data);
          toast({ title: "Property Resubmitted", description: "Property sent back for approval." });
        }
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/properties">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Details</h2>
          <p className="text-sm text-muted-foreground">ID: {property.id} • Registered {new Date(property.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {property.status === "approved" && property.addressCode && (
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-mono font-bold text-lg tracking-wider border border-primary/20 shadow-sm">
              {property.addressCode}
            </div>
          )}
          <Badge className="capitalize text-sm px-3 py-1" variant={property.status === "approved" ? "default" : property.status === "rejected" ? "destructive" : "secondary"}>
            {property.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        {canApprove && (
          <Button onClick={handleApprove} disabled={approveProperty.isPending} className="bg-green-600 hover:bg-green-700 text-white">
            {approveProperty.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Approve Property
          </Button>
        )}
        
        {canReject && (
          <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Property</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Reason for rejection *</Label>
                  <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Provide details on what needs to be fixed..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleReject} disabled={!remark || rejectProperty.isPending}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Core Information</CardTitle>
          </CardHeader>
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

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Kebele</div><div className="font-medium">{property.kebele}</div></div>
              <div><div className="text-muted-foreground">Street Name</div><div className="font-medium">{property.streetName}</div></div>
              <div><div className="text-muted-foreground">House Number</div><div className="font-medium">{property.houseNumber || '-'}</div></div>
              <div><div className="text-muted-foreground">Block Code</div><div className="font-medium">{property.blockCode || '-'}</div></div>
              <div className="col-span-2">
                <div className="text-muted-foreground flex items-center gap-1 mb-1"><MapPin className="w-3 h-3"/> GPS Coordinates</div>
                <div className="font-mono text-xs p-2 bg-muted rounded-md inline-block">
                  {property.latitude && property.longitude ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}` : 'Not Captured'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ownership & Occupancy</CardTitle>
          </CardHeader>
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

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-muted-foreground">Registered By</div><div className="font-medium">{property.createdByUser?.fullName || '-'}</div></div>
              <div><div className="text-muted-foreground">Created At</div><div className="font-medium">{new Date(property.createdAt).toLocaleString()}</div></div>
              <div><div className="text-muted-foreground">Updated At</div><div className="font-medium">{property.updatedAt ? new Date(property.updatedAt).toLocaleString() : '-'}</div></div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Remarks / Approval Notes</div>
                <div className="font-medium p-3 bg-muted rounded-md mt-1">{property.remark || 'No remarks.'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
