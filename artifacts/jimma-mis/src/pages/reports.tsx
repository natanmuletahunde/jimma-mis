import { useState } from "react";
import { useGetPropertyReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";

export default function Reports() {
  const [kebele, setKebele] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [propertyType, setPropertyType] = useState<string>("all");

  const { data: report, isLoading } = useGetPropertyReport({
    kebele: kebele !== "all" ? kebele : undefined,
    status: status !== "all" ? status : undefined,
    property_type: propertyType !== "all" ? propertyType : undefined,
  });

  const handleExportCsv = () => {
    if (!report?.properties.length) return;
    
    const headers = ["ID", "Address Code", "House Number", "Owner", "Property Type", "Status", "Kebele", "Street", "Latitude", "Longitude", "Created At"];
    const rows = report.properties.map(p => [
      p.id,
      p.addressCode || "",
      p.houseNumber || "",
      p.ownerName,
      p.propertyType,
      p.status,
      p.kebele,
      p.streetName,
      p.latitude || "",
      p.longitude || "",
      new Date(p.createdAt).toISOString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `jimma_properties_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Export</h2>
          <p className="text-sm text-muted-foreground">Generate and export property data.</p>
        </div>
        <Button onClick={handleExportCsv} disabled={!report || report.properties.length === 0} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <Select value={kebele} onValueChange={setKebele}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kebele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kebeles</SelectItem>
              <SelectItem value="Awetu Mandera">Awetu Mandera</SelectItem>
              <SelectItem value="Bossa Addis Ketema">Bossa Addis Ketema</SelectItem>
              <SelectItem value="Ginjo">Ginjo</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Property Type" />
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
        </CardContent>
      </Card>

      {report?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="text-3xl font-bold">{report.summary.total}</div>
              <div className="text-sm opacity-90">Total Records</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-green-600">{report.summary.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-amber-500">{report.summary.pending}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-destructive">{report.summary.withoutGps}</div>
              <div className="text-sm text-muted-foreground">Without GPS Data</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Data Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : report?.properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No data matches the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                report?.properties.slice(0, 50).map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">{property.addressCode || property.id}</TableCell>
                    <TableCell>{property.ownerName}</TableCell>
                    <TableCell>{property.kebele}, {property.houseNumber}</TableCell>
                    <TableCell className="capitalize">{property.propertyType}</TableCell>
                    <TableCell className="capitalize">{property.status.replace("_", " ")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {report && report.properties.length > 50 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t">
              Showing first 50 records. Export CSV to see all {report.properties.length} records.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
