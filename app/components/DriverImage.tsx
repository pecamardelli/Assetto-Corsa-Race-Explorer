"use client";

interface DriverImageProps {
  driverName: string;
}

export default function DriverImage({ driverName }: DriverImageProps) {
  return (
    <img
      src={`/driver-portraits/${driverName
        .replace(/ /g, "_")
        .toLowerCase()}.png`}
      alt={driverName}
      className="w-48 h-48 rounded-lg border-2 border-zinc-700 object-cover"
      onError={(e) => {
        // Fallback to a placeholder if image doesn't exist
        e.currentTarget.src =
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%2327272a"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="72" fill="%2371717a"%3E' +
          driverName.charAt(0) +
          "%3C/text%3E%3C/svg%3E";
      }}
    />
  );
}
