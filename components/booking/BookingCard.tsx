import { Booking, BookingState } from "@/lib/types";
import { StateBadge } from "./StateBadge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface BookingCardProps {
  booking: Booking;
  fieldLabelMap?: Record<string, string>;
  onAdvanceState?: (bookingId: string, currentState: BookingState) => void;
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function toReadableKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function BookingCard({ booking, fieldLabelMap = {}, onAdvanceState }: BookingCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const dateStr = booking.appointment_date 
    ? new Date(booking.appointment_date).toLocaleDateString() 
    : 'No Date Set';
  const customEntries = Object.entries(booking.custom_answers ?? {}).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && String(value).trim() !== "";
  });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-5 flex flex-col gap-3 group hover:shadow-sm hover:border-outline-variant/40 transition-all duration-200">
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-sm text-on-surface line-clamp-1">{booking.client_name}</h4>
        <StateBadge state={booking.state} />
      </div>
      
      <p className="text-xs text-on-surface-variant line-clamp-2">
        {booking.description}
      </p>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs font-medium text-primary underline"
          onClick={() => setShowDetails((prev) => !prev)}
        >
          {showDetails ? "Hide details" : "View details"}
        </button>
      </div>

      {showDetails && (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-2 text-xs">
          <p className="text-on-surface"><span className="font-semibold">Email:</span> {booking.client_email}</p>
          {booking.client_phone && (
            <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.phone ?? "Phone Number"}:</span> {booking.client_phone}</p>
          )}
          {booking.size && (
            <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.size ?? "Size"}:</span> {booking.size}</p>
          )}
          {booking.placement && (
            <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.placement ?? "Placement"}:</span> {booking.placement}</p>
          )}
          {typeof booking.budget === "number" && (
            <p className="text-on-surface"><span className="font-semibold">{fieldLabelMap.budget ?? "Budget"}:</span> ${booking.budget}</p>
          )}

          {(booking.reference_urls ?? []).length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-on-surface">{fieldLabelMap.reference_images ?? "Reference Images"}:</p>
              <ul className="space-y-1">
                {(booking.reference_urls ?? []).map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {customEntries.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-on-surface">Custom Fields</p>
              {customEntries.map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="font-medium text-on-surface">{fieldLabelMap[key] ?? toReadableKey(key)}</p>
                  {Array.isArray(value) ? (
                    <ul className="space-y-1">
                      {value.map((item) => (
                        <li key={`${key}-${item}`}>
                          {looksLikeUrl(item) ? (
                            <a href={item} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                              {item}
                            </a>
                          ) : (
                            <span className="text-on-surface-variant">{item}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : typeof value === "boolean" ? (
                    <p className="text-on-surface-variant">{value ? "Yes" : "No"}</p>
                  ) : looksLikeUrl(String(value)) ? (
                    <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                      {String(value)}
                    </a>
                  ) : (
                    <p className="text-on-surface-variant">{String(value)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
        <span>{dateStr}</span>
        
        {booking.state === 'inquiry' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-surface-container-high" onClick={() => onAdvanceState?.(booking.id, booking.state)}>
            Review
          </Button>
        )}
        {booking.state === 'reviewed' && (
          <Button size="sm" className="h-7 text-xs px-2 bg-primary text-on-primary hover:opacity-90" onClick={() => onAdvanceState?.(booking.id, booking.state)}>
            Send Link
          </Button>
        )}
      </div>
    </div>
  );
}
