"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { isPageUrl } from "@/lib/gif-utils";

interface GifPreviewCardProps {
  url: string;
  index: number;
}

/** Componente de preview individual de GIF con estados de carga, error y detección de URLs de página */
export default function GifPreviewCard({ url, index }: GifPreviewCardProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const isPage = isPageUrl(url);

  const containerClass =
    status === "loaded" && !isPage
      ? "border-slate-700 hover:border-primary-500/50"
      : "border-slate-700/50";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`group relative overflow-hidden rounded-lg border transition-all duration-200 ${containerClass}`}
      title={isPage ? "Esta URL es una página web, no un GIF directo. Ábrela para encontrar la URL real del GIF." : url}
    >
      {/* Loading spinner */}
      {status === "loading" && !isPage && (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
        </div>
      )}

      {/* Error state */}
      {(status === "error" || isPage) && (
        <div
          className={`flex h-20 flex-col items-center justify-center p-2 text-center ${
            isPage ? "bg-amber-500/10" : "bg-red-500/5"
          }`}
        >
          <span className="text-lg">{isPage ? "🔗" : "⚠️"}</span>
          <span
            className={`mt-1 text-xs leading-tight ${
              isPage ? "text-amber-400" : "text-red-400"
            }`}
          >
            {isPage ? "Página web" : "Error"}
          </span>
        </div>
      )}

      {/* GIF image */}
      {!isPage && (
        <img
          src={url}
          alt={`GIF ${index + 1}`}
          className={`h-20 w-full object-contain transition-opacity duration-300 ${
            status === "loaded" ? "opacity-100" : "absolute opacity-0 pointer-events-none"
          }`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}

      {/* External link indicator on hover */}
      {status === "loaded" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
          <ExternalLink className="h-5 w-5 text-white drop-shadow-lg" />
        </div>
      )}
    </a>
  );
}
