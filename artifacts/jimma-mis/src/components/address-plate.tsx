import { useRef } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Printer, Download, Copy, Check, QrCode, ShieldCheck, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export type QrFormat = "text" | "code_only" | "json";

export interface AddressPlateProps {
  addressCode: string;
  ownerName: string;
  kebele: string;
  streetName: string;
  houseNumber?: string | null;
  blockCode?: string | null;
  buildingUse?: string | null;
  isProvisional?: boolean;
  qrFormat?: QrFormat;
}

export function buildQrPayload(props: AddressPlateProps, format: QrFormat = "text"): string {
  if (format === "code_only") {
    return props.addressCode;
  }

  if (format === "json") {
    return JSON.stringify({
      code: props.addressCode,
      owner: props.ownerName || "Property Owner",
      kebele: props.kebele || "",
      use: props.buildingUse || "Residential",
      v: 1,
    }, null, 2);
  }

  // Normal human-readable plain text format
  const lines: string[] = [
    "Jimma City Digital Address",
    `Address Code: ${props.addressCode}`,
    `Owner: ${props.ownerName || "N/A"}`,
    `Kebele: ${props.kebele || "N/A"}`,
  ];
  if (props.streetName) {
    lines.push(`Street: ${props.streetName}`);
  }
  if (props.houseNumber) {
    const hn = props.houseNumber.startsWith("HN") ? props.houseNumber : `HN-${props.houseNumber}`;
    lines.push(`House No: ${hn}`);
  }
  if (props.buildingUse) {
    lines.push(`Use: ${props.buildingUse}`);
  }
  return lines.join("\n");
}

/**
 * Visual Municipal Digital Address Plate Component
 * Styled after official municipal cast-metal / enamel house address plates.
 */
export function AddressPlate({
  addressCode,
  ownerName,
  kebele,
  streetName,
  houseNumber,
  blockCode,
  buildingUse,
  isProvisional = false,
  qrFormat = "text",
}: AddressPlateProps) {
  const payload = buildQrPayload(
    {
      addressCode,
      ownerName,
      kebele,
      streetName,
      houseNumber,
      blockCode,
      buildingUse,
    },
    qrFormat
  );

  return (
    <div
      id="printable-address-plate"
      className="relative w-full max-w-[560px] mx-auto rounded-2xl p-5 shadow-xl border-4 border-amber-400/90 text-white select-none overflow-hidden transition-all"
      style={{
        background: "linear-gradient(145deg, #064e3b 0%, #065f46 45%, #047857 100%)",
        boxShadow: "0 10px 25px -5px rgba(6, 78, 59, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -3px 6px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Embossed Corner Rivet Accents (Simulating metal gate mounting holes) */}
      <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 rounded-full bg-slate-300/80 border border-slate-500 shadow-inner flex items-center justify-center">
        <div className="w-1.5 h-0.5 bg-slate-600 rotate-45" />
      </div>
      <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-slate-300/80 border border-slate-500 shadow-inner flex items-center justify-center">
        <div className="w-1.5 h-0.5 bg-slate-600 -rotate-45" />
      </div>
      <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 rounded-full bg-slate-300/80 border border-slate-500 shadow-inner flex items-center justify-center">
        <div className="w-1.5 h-0.5 bg-slate-600 -rotate-45" />
      </div>
      <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-slate-300/80 border border-slate-500 shadow-inner flex items-center justify-center">
        <div className="w-1.5 h-0.5 bg-slate-600 rotate-45" />
      </div>

      {/* Decorative Inner Golden Rim */}
      <div className="rounded-xl border border-amber-300/40 p-4 relative">
        {/* Municipal Header */}
        <div className="text-center pb-3 border-b border-emerald-400/30">
          <div className="flex items-center justify-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-full bg-amber-400 text-emerald-950 font-black text-xs flex items-center justify-center shadow">
              J
            </div>
            <h3 className="font-extrabold tracking-widest text-[13px] uppercase text-amber-300 drop-shadow-sm">
              Jimma City Administration
            </h3>
          </div>
          <p className="text-[10px] tracking-wider uppercase text-emerald-100/90 font-medium">
            Bulchiinsa Magaalaa Jimmaa • Digital Addressing System
          </p>
        </div>

        {/* Main Body: QR Code + Typography */}
        <div className="flex items-center gap-5 my-4">
          {/* QR Code Graphic Tile */}
          <div className="p-2.5 bg-white rounded-xl shadow-lg border border-amber-300/30 shrink-0">
            <QRCodeSVG
              value={payload}
              size={120}
              level="H"
              marginSize={1}
              fgColor="#064e3b"
              bgColor="#ffffff"
            />
            <div className="text-center mt-1">
              <span className="text-[9px] font-mono font-bold tracking-tight text-emerald-900 block leading-none">
                SCAN TO VERIFY
              </span>
            </div>
          </div>

          {/* House Number, Street, and Kebele Information */}
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="leading-none">
              <span className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider block">
                House Number
              </span>
              <div className="text-3xl font-black tracking-tight text-white font-mono drop-shadow">
                {houseNumber ? (houseNumber.startsWith("HN") ? houseNumber : `HN-${houseNumber}`) : "HN-—"}
              </div>
            </div>

            <div className="pt-1 leading-tight">
              <div className="text-sm font-bold text-amber-200 truncate" title={streetName}>
                {streetName || "Main Road"}
              </div>
              <div className="text-xs text-emerald-100 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0 text-amber-300" />
                <span className="truncate">{kebele} Kebele {blockCode ? `• Block ${blockCode}` : ""}</span>
              </div>
            </div>

            {buildingUse && (
              <div className="inline-block mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 border border-emerald-400/30 text-amber-300">
                  {buildingUse}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Official Address Code Footer Ribbon */}
        <div className="pt-2 border-t border-emerald-400/30 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-emerald-200/90 block">
              Official Digital Address Code:
            </span>
            <div className="font-mono font-bold text-xs sm:text-sm tracking-wider text-amber-300 drop-shadow-sm select-all">
              {addressCode}
            </div>
          </div>
          {isProvisional ? (
            <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-200 border-amber-400/40">
              Provisional
            </Badge>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-emerald-200 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" /> Verified
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Modal Dialog for Previewing, Printing, and Exporting the Address Plate
 */
export function AddressPlateModal({
  open,
  onOpenChange,
  props,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  props: AddressPlateProps;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<QrFormat>("text");
  const canvasRef = useRef<HTMLDivElement>(null);

  const payload = buildQrPayload(props, format);

  function handlePrint() {
    window.print();
  }

  function handleCopyPayload() {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    toast({ title: "Copied to Clipboard", description: "QR text copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadQr() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.addressCode}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "QR Code Downloaded", description: `Saved as ${props.addressCode}-qr.png` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto print:p-0 print:border-0 print:shadow-none print:max-w-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Digital Address Plate &amp; QR Code
          </DialogTitle>
        </DialogHeader>

        {/* Printable Address Plate Display */}
        <div className="py-2 flex justify-center">
          <AddressPlate {...props} qrFormat={format} />
        </div>

        {/* Hidden Canvas used for high-res PNG download generation */}
        <div ref={canvasRef} className="hidden" aria-hidden="true">
          <QRCodeCanvas
            value={payload}
            size={1024}
            level="H"
            marginSize={2}
            fgColor="#064e3b"
            bgColor="#ffffff"
          />
        </div>

        {/* Format Selector */}
        <div className="flex items-center justify-between gap-2 print:hidden pt-3 border-t">
          <span className="text-xs font-semibold text-muted-foreground">QR Code Format:</span>
          <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFormat("text")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                format === "text"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Normal Text
            </button>
            <button
              type="button"
              onClick={() => setFormat("code_only")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                format === "code_only"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Code Only
            </button>
            <button
              type="button"
              onClick={() => setFormat("json")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                format === "json"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {/* Specifications & Payload Preview (Hidden during print) */}
        <div className="space-y-2 print:hidden text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              {format === "text"
                ? "Scannable Plain Text (Smartphone Camera Friendly)"
                : format === "code_only"
                ? "Address Code Only"
                : "Structured JSON Payload"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleCopyPayload} className="h-6 text-xs gap-1">
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy Text"}
            </Button>
          </div>
          <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {payload}
          </pre>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {format === "text"
              ? "When scanned by any standard smartphone camera, this QR code immediately displays plain, human-readable address information."
              : format === "code_only"
              ? "Encodes only the official Jimma address code for fast automated dispatch and barcode reader scanning."
              : "Encodes structured JSON data for municipal database integration."}
          </p>
        </div>

        <DialogFooter className="mt-2 print:hidden gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handleDownloadQr} className="gap-1.5">
              <Download className="h-4 w-4" /> Download QR (PNG)
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white">
              <Printer className="h-4 w-4" /> Print Address Plate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
