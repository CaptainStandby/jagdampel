import type { JSX } from "react";
import type { SeasonStatus, StatusKind } from "../lib/status";

/**
 * The traffic-light badge. Colour is never the only signal — every state pairs
 * its colour with a distinct icon and a German label, so it stays legible for
 * colourblind users and in bright sunlight. The `conditional` state is
 * deliberately not green: huntable, but only with strings attached.
 */
interface Visual {
  label: string;
  /** Spoken meaning for screen readers. */
  aria: string;
  className: string;
  icon: JSX.Element;
}

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

const VISUALS: Record<StatusKind, Visual> = {
  open: {
    label: "Jagdzeit",
    aria: "Jagdzeit — jetzt offen",
    className: "bg-jagd-green text-green-950",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6.5 11.2 3.3 8l-1.1 1.1 4.3 4.3 7.3-7.3-1.1-1.1z" />
      </svg>
    ),
  },
  conditional: {
    label: "Mit Auflagen",
    aria: "Offen, aber nur mit Auflagen oder Ausnahmegenehmigung",
    className: "bg-jagd-amber text-white",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1 0 15h16L8 1Zm0 4.8 4.7 8.2H3.3L8 5.8ZM7.2 8h1.6v3H7.2V8Zm0 3.8h1.6v1.4H7.2v-1.4Z" />
      </svg>
    ),
  },
  soon: {
    label: "Bald",
    aria: "Öffnet bald",
    className: "bg-jagd-yellow text-yellow-950",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 12.5A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 0 11ZM7.25 4.5v4l3.4 2 .75-1.23-2.65-1.57V4.5h-1.5Z" />
      </svg>
    ),
  },
  closed: {
    label: "Schonzeit",
    aria: "Schonzeit — geschlossen",
    className: "bg-jagd-red text-white",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M2 7h12v2H2z" />
      </svg>
    ),
  },
};

export function SeasonStatusBadge({
  status,
}: {
  status: SeasonStatus;
}): JSX.Element {
  const visual = VISUALS[status.kind];
  return (
    <span
      role="status"
      aria-label={visual.aria}
      title={visual.aria}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${visual.className}`}
    >
      {visual.icon}
      {visual.label}
    </span>
  );
}
