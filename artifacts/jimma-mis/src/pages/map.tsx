import { useState, useEffect, useRef } from "react";
import { useGetMapProperties } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
// @ts-ignore
import L from "leaflet";

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  
  const [kebele, setKebele] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [propertyType, setPropertyType] = useState<string>("all");

  const { data: properties, isLoading } = useGetMapProperties({
    kebele: kebele !== "all" ? kebele : undefined,
    status: status !== "all" ? status : undefined,
    property_type: propertyType !== "all" ? propertyType : undefined,
  });

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([7.6751, 36.8351], 13); // Jimma approx coordinates
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !properties) return;

    markersRef.current.clearLayers();

    const getColor = (type: string) => {
      switch(type) {
        case 'residential': return '#3b82f6'; // blue
        case 'commercial': return '#f97316'; // orange
        case 'government': return '#22c55e'; // green
        case 'institution': return '#a855f7'; // purple
        default: return '#6b7280'; // gray
      }
    };

    properties.forEach(prop => {
      if (prop.latitude && prop.longitude) {
        const marker = L.circleMarker([prop.latitude, prop.longitude], {
          radius: 8,
          fillColor: getColor(prop.propertyType),
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });

        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-lg mb-1">${prop.addressCode || 'Pending Code'}</h3>
            <p class="text-sm mb-1"><strong>Owner:</strong> ${prop.ownerName}</p>
            <p class="text-sm mb-1"><strong>Type:</strong> <span class="capitalize">${prop.propertyType}</span></p>
            <p class="text-sm mb-1"><strong>Status:</strong> <span class="capitalize">${prop.status.replace('_', ' ')}</span></p>
            <p class="text-sm mb-2"><strong>Location:</strong> ${prop.kebele}, ${prop.streetName} ${prop.houseNumber || ''}</p>
            <a href="/properties/${prop.id}" class="text-primary text-sm font-medium hover:underline">View Details</a>
          </div>
        `);

        markersRef.current?.addLayer(marker);
      }
    });
  }, [properties]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Map View</h2>
          <p className="text-sm text-muted-foreground">Geospatial overview of registered properties.</p>
        </div>
      </div>

      <Card className="flex-none">
        <CardContent className="p-4 flex gap-4">
          <Select value={kebele} onValueChange={setKebele}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kebele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kebeles</SelectItem>
              <SelectItem value="Awetu Mandera">Awetu Mandera</SelectItem>
              <SelectItem value="Bossa Addis Ketema">Bossa Addis Ketema</SelectItem>
              <SelectItem value="Ginjo">Ginjo</SelectItem>
              {/* Add more as needed or fetch dynamically */}
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

          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground self-center ml-auto" />}
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden min-h-[500px]">
        <div ref={mapRef} className="w-full h-full z-0 relative isolate" />
      </Card>
    </div>
  );
}
