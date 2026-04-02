import { createElement as h } from "react";
import { Box, Text } from "ink";
import type { AwarenessEvent } from "../../awareness/types.ts";
import { formatEvent } from "../../awareness/types.ts";

interface NotificationProps {
  event: AwarenessEvent;
  ageMs: number;
}

const FADE_AFTER_MS = 4000;
const HIDE_AFTER_MS = 6000;

export function Notification({ event, ageMs }: NotificationProps) {
  if (ageMs > HIDE_AFTER_MS) return null;

  const isFading = ageMs > FADE_AFTER_MS;
  const color = getEventColor(event.type);
  const icon = getEventIcon(event.type);

  return h(
    Box,
    {
      paddingX: 1,
    },
    h(Text, { color: isFading ? "gray" : color }, `${icon} ${formatEvent(event)}`),
  );
}

function getEventColor(type: AwarenessEvent["type"]): string {
  switch (type) {
    case "git:change":
      return "yellow";
    case "git:branch":
      return "cyan";
    case "git:conflict":
      return "red";
    case "file:create":
      return "green";
    case "file:modify":
      return "yellow";
    case "file:delete":
      return "red";
    default:
      return "gray";
  }
}

function getEventIcon(type: AwarenessEvent["type"]): string {
  switch (type) {
    case "git:change":
      return "git";
    case "git:branch":
      return "branch";
    case "git:conflict":
      return "!";
    case "file:create":
      return "+";
    case "file:modify":
      return "~";
    case "file:delete":
      return "-";
    default:
      return "•";
  }
}
