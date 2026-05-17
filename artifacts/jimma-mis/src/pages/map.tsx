import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useGetMapProperties,
  useGetMapSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  MapPin,
  Home,
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  ExternalLink,
  Map as MapIcon,
} from "lucide-react";
// @ts-ignore
import L from "leaflet";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Marker colors by property type ──────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  residential: "#3b82f6", // blue
  commercial:  "#22c55e", // green
  mixed:       "#f97316", // orange  (stored as "mixed", not "mixed_use")
  government:  "#a855f7", // purple
  institution: "#0ea5e9", // sky blue
};
function markerColor(type: string): string {
  return TYPE_COLORS[type] ?? "#6b7280"; // gray = other
}

// Build an SVG circle marker icon; highlighted = larger with pulse ring
function svgIcon(color: string, highlighted = false) {
  const size = highlighted ? 28 : 22;
  const r = highlighted ? 11 : 9;
  const ring = highlighted
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="none" stroke="${color}" stroke-width="2" opacity="0.4"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${ring}
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${highlighted ? 3 : 2.5}"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  });
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function statusColor(s: string) {
  if (s === "approved")        return "#22c55e";
  if (s === "rejected")        return "#ef4444";
  if (s === "pending")         return "#f59e0b";
  if (s === "kebele_verified") return "#6366f1";
  return "#9ca3af";
}

// ── Summary card component ───────────────────────────────────────────────────
function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  accent?: string;
}) {
  return (
    <Card className="flex-1 min-w-[130px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: accent ? `${accent}20` : undefined }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">
            {value === undefined ? "—" : value}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Legend pill ──────────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className="w-3 h-3 rounded-full inline-block border border-white shadow-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MapView() {
  const [, navigate] = useLocation();
  const searchString = useSearch();

  // Parse deep-link params: /map?id=5&lat=7.66&lng=36.83
  const searchParams = new URLSearchParams(searchString);
  const targetId  = searchParams.get("id")  ? Number(searchParams.get("id"))  : null;
  const targetLat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const targetLng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;

  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef     = useRef<L.LayerGroup | null>(null);
  // Track every marker by property ID so we can programmatically open one
  const markerMapRef   = useRef<Record<number, L.Marker>>({});
  // Only fly-to once per deep-link visit
  const didFlyRef      = useRef(false);

  const [search, setSearch]               = useState("");
  const [kebele, setKebele]               = useState("all");
  const [status, setStatus]               = useState("all");
  const [propertyType, setPropertyType]   = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = {
    kebele:        kebele        !== "all" ? kebele        : undefined,
    status:        status        !== "all" ? status        : undefined,
    property_type: propertyType  !== "all" ? propertyType  : undefined,
    search:        debouncedSearch || undefined,
  };

  const { data: properties, isLoading } = useGetMapProperties(params);
  const { data: summary }               = useGetMapSummary();

  // Expose navigate for Leaflet popup inline onclick handlers
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__gisNavigate = (path: string) =>
      navigate(path);
    return () => {
      delete (window as unknown as Record<string, unknown>).__gisNavigate;
    };
  }, [navigate]);

  // Initialise map once on mount
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      [7.6667, 36.8333],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Rebuild markers whenever data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !properties) return;
    markersRef.current.clearLayers();
    markerMapRef.current = {};

    properties.forEach((prop) => {
      if (prop.latitude == null || prop.longitude == null) return;

      const isTarget    = prop.id === targetId;
      const color       = markerColor(prop.propertyType);
      const marker      = L.marker([prop.latitude, prop.longitude], {
        icon: svgIcon(color, isTarget),
        // Highlighted marker renders on top
        zIndexOffset: isTarget ? 1000 : 0,
      });

      const photoHtml = prop.propertyPhoto
        ? `<img
            src="${prop.propertyPhoto.startsWith("http") ? prop.propertyPhoto : `${BASE}/api${prop.propertyPhoto}`}"
            alt="Property photo"
            style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;"
            onerror="this.style.display='none'"
          />`
        : "";

      const statusBadge = `<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${statusColor(prop.status)}">${statusLabel(prop.status)}</span>`;

      const detailPath = `/properties/${prop.id}`;

      marker.bindPopup(
        `<div style="min-width:200px;max-width:260px;font-family:system-ui,sans-serif;font-size:13px;">
          ${photoHtml}
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
            ${prop.addressCode ?? "<em style='color:#9ca3af'>Provisional code</em>"}
          </div>
          ${statusBadge}
          <table style="margin-top:8px;border-collapse:collapse;width:100%">
            <tr><td style="color:#6b7280;padding:2px 4px 2px 0;white-space:nowrap">Owner</td><td style="padding:2px 0;font-weight:500">${prop.ownerName}</td></tr>
            ${prop.ownerPhone ? `<tr><td style="color:#6b7280;padding:2px 4px 2px 0">Phone</td><td>${prop.ownerPhone}</td></tr>` : ""}
            <tr><td style="color:#6b7280;padding:2px 4px 2px 0">Type</td><td style="text-transform:capitalize">${prop.propertyType.replace("_", " ")}</td></tr>
            <tr><td style="color:#6b7280;padding:2px 4px 2px 0">Kebele</td><td>${prop.kebele}</td></tr>
            <tr><td style="color:#6b7280;padding:2px 4px 2px 0">Street</td><td>${prop.streetName}</td></tr>
            ${prop.houseNumber ? `<tr><td style="color:#6b7280;padding:2px 4px 2px 0">House No.</td><td>${prop.houseNumber}</td></tr>` : ""}
            ${prop.businessName ? `<tr><td style="color:#6b7280;padding:2px 4px 2px 0">Business</td><td>${prop.businessName}</td></tr>` : ""}
          </table>
          <button
            onclick="window.__gisNavigate('${detailPath}')"
            style="margin-top:10px;width:100%;padding:6px 0;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;"
          >
            ↗ View Full Details
          </button>
        </div>`,
        { maxWidth: 280 },
      );

      markersRef.current?.addLayer(marker);
      markerMapRef.current[prop.id] = marker;
    });

    // Deep-link: fly to targeted property and open its popup (only once)
    if (targetId && targetLat && targetLng && !didFlyRef.current) {
      didFlyRef.current = true;
      // Capture the marker now — don't read markerMapRef inside the timeout
      // (the ref's .current may be replaced by a subsequent render before it fires)
      const targetMarker = markerMapRef.current[targetId] ?? null;
      mapInstanceRef.current.flyTo([targetLat, targetLng], 18, {
        animate: true,
        duration: 1.2,
      });
      // Open popup after the fly animation settles
      setTimeout(() => targetMarker?.openPopup(), 1400);
    }
  }, [properties, targetId, targetLat, targetLng]);

  // Revalidate map size on window resize
  useEffect(() => {
    const handler = () => mapInstanceRef.current?.invalidateSize();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-primary" /> GIS Map Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Geospatial view of all registered properties in Jimma City.
          </p>
        </div>
        {/* Banner shown when arriving from the property list */}
        {targetId && (
          <div className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Showing location of property&nbsp;<strong>#{targetId}</strong></span>
            <button
              onClick={() => navigate("/map")}
              className="ml-1 underline underline-offset-2 hover:text-emerald-900 text-xs"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        <SummaryCard icon={<MapPin className="w-4 h-4" />}    label="Total Mapped" value={summary?.total}       accent="#3b82f6" />
        <SummaryCard icon={<Home className="w-4 h-4" />}      label="Residential"  value={summary?.residential} accent="#3b82f6" />
        <SummaryCard icon={<Building2 className="w-4 h-4" />} label="Commercial"   value={summary?.commercial}  accent="#22c55e" />
        <SummaryCard icon={<CheckCircle className="w-4 h-4" />} label="Approved"   value={summary?.approved}    accent="#22c55e" />
        <SummaryCard icon={<Clock className="w-4 h-4" />}     label="Pending"      value={summary?.pending}     accent="#f59e0b" />
        <SummaryCard icon={<AlertTriangle className="w-4 h-4" />} label="Missing GPS" value={summary?.missingGps} accent="#ef4444" />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search address code, owner, house no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={kebele} onValueChange={setKebele}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Kebeles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Kebeles</SelectItem>
              <SelectItem value="AJR">AJR</SelectItem>
              <SelectItem value="BCH">BCH</SelectItem>
              <SelectItem value="FMG">FMG</SelectItem>
              <SelectItem value="Awetu Mandera">Awetu Mandera</SelectItem>
              <SelectItem value="Bossa Addis Ketema">Bossa Addis Ketema</SelectItem>
              <SelectItem value="Ginjo">Ginjo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="mixed">Mixed Use</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="institution">Institution</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="kebele_verified">Kebele Verified</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && properties && (
            <span className="text-xs text-muted-foreground ml-auto">
              {properties.length} marker{properties.length !== 1 ? "s" : ""} shown
            </span>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        <LegendDot color={TYPE_COLORS.residential} label="Residential" />
        <LegendDot color={TYPE_COLORS.commercial}  label="Commercial" />
        <LegendDot color={TYPE_COLORS.mixed}        label="Mixed Use" />
        <LegendDot color={TYPE_COLORS.government}   label="Government" />
        <LegendDot color={TYPE_COLORS.institution}  label="Institution" />
        <LegendDot color="#6b7280"                  label="Other" />
      </div>

      {/* Map */}
      <Card>
        <div
          ref={mapRef}
          className="w-full rounded-xl"
          style={{ height: "60vh", minHeight: 420 }}
        />
      </Card>

      {/* Missing GPS list */}
      {summary && summary.missingGpsList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Properties Missing GPS Coordinates ({summary.missingGps})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Owner</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Kebele</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Street</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">House No.</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {summary.missingGpsList.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{p.ownerName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.kebele}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.streetName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.houseNumber ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">
                          {statusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/properties/${p.id}`)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
