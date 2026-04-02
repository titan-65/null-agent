import { createElement as h, useState } from "react";
import { Box, Text, useInput } from "ink";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export function InputBar({ onSubmit, isDisabled: _isDisabled, placeholder }: InputBarProps) {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);

  useInput(
    (input, key) => {
      if (key.return) {
        if (value.trim()) {
          onSubmit(value);
          setValue("");
          setCursorPos(0);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setValue(value.slice(0, cursorPos - 1) + value.slice(cursorPos));
          setCursorPos((p) => p - 1);
        }
        return;
      }

      if (key.leftArrow) {
        setCursorPos((p) => Math.max(0, p - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorPos((p) => Math.min(value.length, p + 1));
        return;
      }

      if (key.ctrl && input === "a") {
        setCursorPos(0);
        return;
      }

      if (key.ctrl && input === "e") {
        setCursorPos(value.length);
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setValue(value.slice(0, cursorPos) + input + value.slice(cursorPos));
        setCursorPos((p) => p + input.length);
      }
    },
    { isActive: true },
  );

  const showPlaceholder = !value && placeholder;
  const borderColor = placeholder ? "yellow" : "green";

  return h(
    Box,
    {
      borderStyle: "round",
      borderColor,
      paddingX: 1,
    },
    h(Text, { bold: true, color: borderColor }, "> "),
    showPlaceholder ? h(Text, { color: "gray", italic: true }, placeholder) : h(Text, null, value),
    !showPlaceholder ? h(Text, { color: borderColor, inverse: true }, " ") : null,
  );
}
