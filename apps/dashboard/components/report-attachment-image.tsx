"use client";

import Image from "next/image";
import { useState } from "react";

export function ReportAttachmentImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  if (state === "error") {
    return (
      <div role="img" aria-label={alt} className="flex aspect-4/3 items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
        Foto belum dapat dimuat. Coba muat ulang halaman.
      </div>
    );
  }

  return (
    <div className="relative aspect-4/3 bg-slate-100">
      {state === "loading" && (
        <p role="status" className="absolute inset-0 flex items-center justify-center p-4 text-sm text-slate-600">Memuat foto…</p>
      )}
      <Image
        unoptimized
        src={src}
        alt={alt}
        width={960}
        height={720}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={`size-full object-contain ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
