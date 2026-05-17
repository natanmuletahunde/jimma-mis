import { useState } from "react";
import { useListProperties } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Search, Eye, MapPin } from "lucide-react";

export default function PropertiesList() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [propertyType, setPropertyType] = useState<string>("all");

  const { data, isLoading } = useListProperties(
    {
      page,
      limit: 10,
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      property_type: propertyType !== "all" ? propertyType : undefined,
    },
    { query: { keepPreviousData: true } as any }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":       return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "rejected":       return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending":        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "kebele_verified":return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:               return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Properties</h2>
            <p className="text-sm text-muted-foreground">Manage and review registered properties.</p>
          </div>
          <Link href="/properties/new">
            <Button>Register Property</Button>
          </Link>
        </div>

        <Card>
          <div className="p-4 flex flex-col md:flex-row gap-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, Owner, or House Number..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="kebele_verified">Verified</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={propertyType} onValueChange={(v) => { setPropertyType(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="institution">Institution</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : data?.properties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No properties found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.properties.map((property) => {
                    const hasGps = property.latitude != null && property.longitude != null;
                    return (
                      <TableRow key={property.id}>
                        <TableCell>
                          <div className="font-medium">{property.addressCode || "Pending"}</div>
                          <div className="text-xs text-muted-foreground">ID: {property.id}</div>
                        </TableCell>
                        <TableCell>{property.ownerName}</TableCell>
                        <TableCell>
                          <div>{property.kebele}</div>
                          <div className="text-xs text-muted-foreground">{property.houseNumber || "No HN"}</div>
                        </TableCell>
                        <TableCell className="capitalize">{property.propertyType}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(property.status)}>
                            {property.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View on Map — only shown when GPS coordinates exist */}
                            {hasGps && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() =>
                                      navigate(
                                        `/map?id=${property.id}&lat=${property.latitude}&lng=${property.longitude}`
                                      )
                                    }
                                  >
                                    <MapPin className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p>View on Map</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <Link href={`/properties/${property.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {data && data.total > 0 && (
              <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, data.total)} of {data.total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * 10 >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
