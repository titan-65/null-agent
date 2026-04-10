import { createElement as h, useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isDisabled: boolean;
  placeholder?: string;
}

const HISTORY_FILE = join(homedir(), ".null-agent", "input-history");

async function loadHistory(): Promise<string[]> {
  try {
    const content = await readFile(HISTORY_FILE, "utf-8");
    return content.split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
}

async function saveHistory(history: string[]): Promise<void> {
  try {
    await writeFile(HISTORY_FILE, history.join("\n"), "utf-8");
  } catch {
    // Ignore errors
  }
}

export function InputBar({ onSubmit, isDisabled: _isDisabled, placeholder }: InputBarProps) {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const handleSubmit = (input: string) => {
    if (input.trim()) {
      const newHistory = [input, ...history.filter((h) => h !== input)].slice(0, 100);
      setHistory(newHistory);
      saveHistory(newHistory);
      onSubmit(input);
    }
    setValue("");
    setCursorPos(0);
    setHistoryIndex(-1);
  };

  useInput(
    (input, key) => {
      if (key.return) {
        if (value.trim()) {
          handleSubmit(value);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          setValue(newValue);
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

      if (key.upArrow && history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        const histItem = history[newIndex] || "";
        setValue(histItem);
        setCursorPos(histItem.length);
        return;
      }

      if (key.downArrow && history.length > 0) {
        const newIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(newIndex);
        if (newIndex === -1) {
          setValue("");
        } else {
          const histItem = history[newIndex] || "";
          setValue(histItem);
          setCursorPos(histItem.length);
        }
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

      if (key.ctrl && input === "k") {
        setValue("");
        setCursorPos(0);
        return;
      }

      if (key.ctrl && input === "c") {
        setValue("");
        setCursorPos(0);
        setHistoryIndex(-1);
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
        setValue(newValue);
        setCursorPos((p) => p + input.length);
      }
    },
    { isActive: true },
  );

  const showPlaceholder = !value && placeholder;
  const borderColor = placeholder ? "yellow" : "green";

  const getHint = (): string => {
    if (history.length > 0) return "[↑ history]";
    return "";
  };

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
    h(Text, { color: "gray", dimColor: true }, getHint()),
  );
}
