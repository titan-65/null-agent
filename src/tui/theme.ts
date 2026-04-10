export interface Theme {
  name: "dark" | "light";
  background: string;
  foreground: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  border: string;
}

export const darkTheme: Theme = {
  name: "dark",
  background: "#1a1a2e",
  foreground: "#eaeaea",
  accent: "#6c5ce7",
  success: "#00b894",
  warning: "#fdcb6e",
  error: "#ff7675",
  info: "#74b9ff",
  muted: "#636e72",
  border: "#2d2d44",
};

export const lightTheme: Theme = {
  name: "light",
  background: "#ffffff",
  foreground: "#2d3436",
  accent: "#6c5ce7",
  success: "#00b894",
  warning: "#e17055",
  error: "#d63031",
  info: "#0984e3",
  muted: "#b2bec3",
  border: "#dfe6e9",
};

export type ThemeName = "dark" | "light";

export function getTheme(name: ThemeName): Theme {
  return name === "dark" ? darkTheme : lightTheme;
}

export const themes: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
