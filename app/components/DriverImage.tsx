"use client";

import { useState, useRef } from "react";

interface DriverImageProps {
  driverName: string;
  /**
   * Portrait URL already resolved on the server (see lib/driver-assets).
   * `null` means the driver has no portrait, so go straight to the placeholder.
   * Omit it entirely to fall back to probing extensions from the browser.
   */
  src?: string | null;
}

// Only used by the legacy probing path, for callers that pass no `src`.
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

function placeholder(driverName: string): string {
  return (
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%2327272a"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="72" fill="%2371717a"%3E' +
    driverName.charAt(0) +
    "%3C/text%3E%3C/svg%3E"
  );
}

export default function DriverImage({ driverName, src }: DriverImageProps) {
  const [extensionIndex, setExtensionIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const baseFileName = encodeURIComponent(
    driverName.replace(/ /g, "_").toLowerCase()
  );

  // When the server resolved a path, trust it; a miss is already known to be a miss.
  const resolved = src !== undefined;
  const imagePath = resolved
    ? src ?? placeholder(driverName)
    : `/driver-portraits/${baseFileName}.${IMAGE_EXTENSIONS[extensionIndex]}`;

  const handleImageError = () => {
    if (!resolved && extensionIndex < IMAGE_EXTENSIONS.length - 1) {
      setExtensionIndex(extensionIndex + 1);
    } else if (imgRef.current) {
      imgRef.current.src = placeholder(driverName);
    }
  };

  return (
    <img
      ref={imgRef}
      src={imagePath}
      alt={driverName}
      className="w-48 h-48 rounded-lg border-2 border-zinc-700 object-cover"
      onError={handleImageError}
    />
  );
}
