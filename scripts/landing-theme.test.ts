import { afterEach, describe, expect, test } from "bun:test";

import {
  THEME_STORAGE_KEY,
  applyTheme,
  initializeTheme,
  readDocumentTheme,
  readStoredTheme,
  saveTheme,
} from "../src/landing/theme";

type MockGlobalScope = {
  document?: Document;
  window?: Window;
};

const installThemeGlobals = (storedTheme?: string) => {
  const classes = new Set<string>();
  const storage = new Map<string, string>();

  if (storedTheme) {
    storage.set(THEME_STORAGE_KEY, storedTheme);
  }

  const rootElement = {
    dataset: {} as DOMStringMap,
    style: { colorScheme: "" } as CSSStyleDeclaration,
    classList: {
      contains: (token: string) => classes.has(token),
      toggle: (token: string, force?: boolean) => {
        const nextValue = force ?? !classes.has(token);
        if (nextValue) {
          classes.add(token);
          return true;
        }

        classes.delete(token);
        return false;
      },
    },
  } as unknown as HTMLElement;

  const windowMock = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  } as unknown as Window;

  const documentMock = {
    documentElement: rootElement,
  } as unknown as Document;

  const globalScope = globalThis as unknown as MockGlobalScope;
  const previousWindow = globalScope.window;
  const previousDocument = globalScope.document;

  globalScope.window = windowMock;
  globalScope.document = documentMock;

  return {
    rootElement,
    storage,
    restore: () => {
      if (previousWindow) {
        globalScope.window = previousWindow;
      } else {
        globalScope.window = undefined;
      }

      if (previousDocument) {
        globalScope.document = previousDocument;
      } else {
        globalScope.document = undefined;
      }
    },
  };
};

let restoreGlobals: (() => void) | undefined;

afterEach(() => {
  restoreGlobals?.();
  restoreGlobals = undefined;
});

describe("landing theme", () => {
  test("applyTheme keeps dataset, colorScheme, and dark class in sync", () => {
    // Arrange
    const { rootElement, restore } = installThemeGlobals();
    restoreGlobals = restore;

    // Act
    applyTheme("dark");

    // Assert
    expect(rootElement.dataset.theme).toBe("dark");
    expect(rootElement.style.colorScheme).toBe("dark");
    expect(rootElement.classList.contains("dark")).toBe(true);

    // Act
    applyTheme("light");

    // Assert
    expect(rootElement.dataset.theme).toBe("light");
    expect(rootElement.style.colorScheme).toBe("light");
    expect(rootElement.classList.contains("dark")).toBe(false);
  });

  test("saveTheme and readStoredTheme use the managed landing storage key", () => {
    // Arrange
    const { storage, restore } = installThemeGlobals();
    restoreGlobals = restore;

    // Act
    saveTheme("light");

    // Assert
    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  test("initializeTheme defaults to dark and restores a stored light theme", () => {
    // Arrange
    const darkGlobals = installThemeGlobals();
    restoreGlobals = darkGlobals.restore;

    // Act
    const initialTheme = initializeTheme();

    // Assert
    expect(initialTheme).toBe("dark");
    expect(readDocumentTheme()).toBe("dark");

    restoreGlobals();

    // Arrange
    const lightGlobals = installThemeGlobals("light");
    restoreGlobals = lightGlobals.restore;

    // Act
    const restoredTheme = initializeTheme();

    // Assert
    expect(restoredTheme).toBe("light");
    expect(readDocumentTheme()).toBe("light");
  });
});
