export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "open-links-landing-theme";

const isTheme = (value: string | null): value is Theme => value === "dark" || value === "light";

const warnThemeStorageFailure = (action: "read" | "write", error: unknown) => {
  console.warn(`Could not ${action} landing theme preference.`, error);
};

export const readStoredTheme = (): Theme | null => {
  try {
    const maybeTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(maybeTheme) ? maybeTheme : null;
  } catch (error) {
    warnThemeStorageFailure("read", error);
    return null;
  }
};

export const resolveTheme = (): Theme => readStoredTheme() ?? "dark";

export const readDocumentTheme = (): Theme =>
  document.documentElement.dataset.theme === "light"
    ? "light"
    : document.documentElement.dataset.theme === "dark" ||
        document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

export const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export const saveTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    warnThemeStorageFailure("write", error);
  }
};

export const initializeTheme = () => {
  const theme = resolveTheme();
  applyTheme(theme);
  return theme;
};
