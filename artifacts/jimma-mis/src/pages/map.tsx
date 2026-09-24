import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useGetMapProperties,
  useGetMapSummary,
  useListStreets,
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
  Layers,
  Route,
} from "lucide-react";
// @ts-ignore
import L from "leaflet";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Surface styles & colors for street vector polylines ─────────────────────
export const SURFACE_STYLES: Record<string, { color: string; label: string; dashArray?: string; weight: number }> = {
  asphalt:     { color: "#0f172a", label: "Asphalt", weight: 5 },
  cobblestone: { color: "#b45309", label: "Cobblestone", weight: 4.5 },
  gravel:      { color: "#ca8a04", label: "Gravel", dashArray: "6, 6", weight: 3.5 },
  dirt:        { color: "#78350f", label: "Dirt / Earth", dashArray: "3, 6", weight: 3 },
  earth:       { color: "#78350f", label: "Earth", dashArray: "3, 6", weight: 3 },
};

function getSurfaceStyle(surface?: string | null) {
  const key = (surface || "asphalt").toLowerCase();
  return SURFACE_STYLES[key] ?? { color: "#475569", label: surface || "Other", weight: 4 };
}

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

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="inline-block w-5 h-1 rounded"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          height: dashed ? "0px" : "3px",
        }}
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
  const streetsLayerRef = useRef<L.LayerGroup | null>(null);
  // Track every marker by property ID so we can programmatically open one
  const markerMapRef   = useRef<Record<number, L.Marker>>({});
  // Only fly-to once per deep-link visit
  const didFlyRef      = useRef(false);

  const [search, setSearch]               = useState("");
  const [kebele, setKebele]               = useState("all");
  const [status, setStatus]               = useState("all");
  const [propertyType, setPropertyType]   = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showStreets, setShowStreets]         = useState(true);
  const [showProperties, setShowProperties]   = useState(true);
  const [streetSurfaceFilter, setStreetSurfaceFilter] = useState("all");

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
  const { data: streetsData }           = useListStreets({ limit: 100 });
  const streets = streetsData?.streets ?? [];

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
      [7.8540, 36.6500],
      13,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    streetsLayerRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);
    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
      streetsLayerRef.current = null;
    };
  }, []);

  // Rebuild markers whenever data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !properties) return;
    markersRef.current.clearLayers();
    markerMapRef.current = {};

    if (!showProperties) return;

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
      const targetMarker = markerMapRef.current[targetId] ?? null;
      mapInstanceRef.current.flyTo([targetLat, targetLng], 18, {
        animate: true,
        duration: 1.2,
      });
      setTimeout(() => targetMarker?.openPopup(), 1400);
    }
  }, [properties, targetId, targetLat, targetLng, showProperties]);

  // Render Street Vector Polylines
  useEffect(() => {
    if (!mapInstanceRef.current || !streetsLayerRef.current) return;
    streetsLayerRef.current.clearLayers();

    if (!showStreets || !streets || streets.length === 0) return;

    streets.forEach((street) => {
      if (
        street.startLat == null ||
        street.startLng == null ||
        street.endLat == null ||
        street.endLng == null
      ) {
        return;
      }

      // Check if coordinates are in realistic geographic range (Jimma is ~7.6, 36.8)
      if (Math.abs(street.startLat) > 90 || Math.abs(street.endLat) > 90) return;

      const surfaceKey = (street.roadSurface || "asphalt").toLowerCase();
      if (streetSurfaceFilter !== "all" && surfaceKey !== streetSurfaceFilter.toLowerCase()) {
        return;
      }

      const style = getSurfaceStyle(street.roadSurface);

      const polyline = L.polyline(
        [
          [street.startLat, street.startLng],
          [street.endLat, street.endLng],
        ],
        {
          color: style.color,
          weight: style.weight,
          dashArray: style.dashArray,
          opacity: 0.88,
        }
      );

      // Interactive hover styling
      polyline.on("mouseover", function (this: L.Polyline) {
        this.setStyle({ weight: style.weight + 2.5, opacity: 1 });
      });
      polyline.on("mouseout", function (this: L.Polyline) {
        this.setStyle({ weight: style.weight, opacity: 0.88 });
      });

      const lengthFormatted = street.lengthMeters
        ? street.lengthMeters >= 1000
          ? `${(street.lengthMeters / 1000).toFixed(2)} km`
          : `${Math.round(street.lengthMeters)} m`
        : "—";

      const conditionColor =
        street.condition === "good" ? "#16a34a" : street.condition === "fair" ? "#ca8a04" : "#dc2626";

      polyline.bindPopup(
        `<div style="min-width:230px;max-width:290px;font-family:system-ui,sans-serif;font-size:12px;">
          <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:2px;">
            ${street.name}
          </div>
          <div style="font-family:monospace;font-size:11px;color:#047857;font-weight:700;margin-bottom:6px;">
            Code: ${street.code} • ${street.kebeleName ?? "Jimma"}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="background:${style.color};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:capitalize;">
              ${style.label}
            </span>
            <span style="background:${conditionColor};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;text-transform:capitalize;">
              ${street.condition ?? "Good"}
            </span>
            ${
              street.lastPciScore
                ? `<span style="background:#065f46;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">PCI ${street.lastPciScore}</span>`
                : ""
            }
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <tr><td style="color:#64748b;padding:2px 0;">Length</td><td style="font-weight:600;text-align:right;">${lengthFormatted}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Width / Lanes</td><td style="font-weight:600;text-align:right;">${street.widthMeters ? `${street.widthMeters}m` : "—"} • ${street.lanes ?? 2} lanes</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Corridor Type</td><td style="font-weight:600;text-align:right;text-transform:capitalize;">${street.streetType ?? "Street"}</td></tr>
            <tr>
              <td style="color:#64748b;padding:2px 0;">Features</td>
              <td style="text-align:right;font-size:13px;">
                ${street.hasSidewalk ? "🚶 " : ""}${street.hasStreetLights ? "💡 " : ""}${street.hasDrainage ? "💧" : ""}
                ${!street.hasSidewalk && !street.hasStreetLights && !street.hasDrainage ? "—" : ""}
              </td>
            </tr>
          </table>
          <button
            onclick="window.__gisNavigate('/setup/road-inventory')"
            style="width:100%;padding:6px 0;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;"
          >
            ↗ View Road Inventory & Maintenance
          </button>
        </div>`,
        { maxWidth: 300 }
      );

      streetsLayerRef.current?.addLayer(polyline);
    });
  }, [streets, showStreets, streetSurfaceFilter]);

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
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapIcon className="w-6 h-6 text-primary" /> GIS Map Dashboard
            </h2>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-mono">
              PostGIS 3.6 Spatial
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Geospatial view of all registered properties and street corridors in Agaro City.
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
              <SelectItem value="Kebele 01">Kebele 01</SelectItem>
              <SelectItem value="Kebele 02">Kebele 02</SelectItem>
              <SelectItem value="Kebele 03">Kebele 03</SelectItem>
              <SelectItem value="Kebele 04">Kebele 04</SelectItem>
              <SelectItem value="Kebele 05">Kebele 05</SelectItem>
              <SelectItem value="AJR">AJR</SelectItem>
              <SelectItem value="BCH">BCH</SelectItem>
              <SelectItem value="FMG">FMG</SelectItem>
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

      {/* GIS Map Layer Controls & Legends */}
      <Card className="bg-muted/30">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mr-1">
              <Layers className="w-3.5 h-3.5 text-primary" /> GIS Layers:
            </span>

            {/* Toggle Property Markers */}
            <Button
              type="button"
              variant={showProperties ? "default" : "outline"}
              size="sm"
              onClick={() => setShowProperties(!showProperties)}
              className="h-7 text-xs gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              Properties ({properties?.length ?? 0})
            </Button>

            {/* Toggle Street Corridors */}
            <Button
              type="button"
              variant={showStreets ? "default" : "outline"}
              size="sm"
              onClick={() => setShowStreets(!showStreets)}
              className="h-7 text-xs gap-1.5"
            >
              <Route className="w-3.5 h-3.5" />
              Street Corridors ({streets?.length ?? 0})
            </Button>

            {/* Surface filter when streets enabled */}
            {showStreets && (
              <Select value={streetSurfaceFilter} onValueChange={setStreetSurfaceFilter}>
                <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
                  <SelectValue placeholder="All Surfaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surfaces</SelectItem>
                  <SelectItem value="asphalt">Asphalt</SelectItem>
                  <SelectItem value="cobblestone">Cobblestone</SelectItem>
                  <SelectItem value="gravel">Gravel</SelectItem>
                  <SelectItem value="dirt">Dirt / Earth</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {showProperties && (
              <div className="flex items-center gap-2.5 border-r pr-3 border-border/60">
                <span className="text-[11px] font-medium text-slate-500">Points:</span>
                <LegendDot color={TYPE_COLORS.residential} label="Res" />
                <LegendDot color={TYPE_COLORS.commercial}  label="Com" />
                <LegendDot color={TYPE_COLORS.mixed}        label="Mix" />
                <LegendDot color={TYPE_COLORS.government}   label="Gov" />
                <LegendDot color={TYPE_COLORS.institution}  label="Inst" />
              </div>
            )}
            {showStreets && (
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-medium text-slate-500">Corridors:</span>
                <LegendLine color={SURFACE_STYLES.asphalt.color} label="Asphalt" />
                <LegendLine color={SURFACE_STYLES.cobblestone.color} label="Cobblestone" />
                <LegendLine color={SURFACE_STYLES.gravel.color} label="Gravel" dashed />
                <LegendLine color={SURFACE_STYLES.dirt.color} label="Dirt" dashed />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
