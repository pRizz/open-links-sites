import { BlurFade, DotPattern, ShinyButton, Spotlight, WordRotate } from "mystic-ui";
import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { RegistryCard } from "./RegistryCard";
import { fetchLandingRegistry, filterLandingRegistry, formatRegistryCount } from "./registry";
import { type Theme, applyTheme, readDocumentTheme, saveTheme } from "./theme";

const requestSteps = [
  "Share who the page is for and any existing Linktree-style URL.",
  "The operator can import links, enrich metadata, and publish the page automatically.",
  "If you want to self-host, OpenLinks is open source and version controlled.",
];

const rotatingWords = ["builders", "educators", "podcasts", "communities"];
const openLinksIdentityUrl = "https://openlinks.us/";
const openLinksRepositoryUrl = "https://github.com/pRizz/open-links";
const prefersReducedMotionQuery = "(prefers-reduced-motion: reduce)";

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
  };
};

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [theme, setTheme] = createSignal(readDocumentTheme());
  const [prefersReducedMotion, setPrefersReducedMotion] = createSignal(false);
  const [entries] = createResource(fetchLandingRegistry);

  let registrySectionRef: HTMLElement | undefined;
  let themeToggleRef: HTMLButtonElement | undefined;

  const filteredEntries = createMemo(() => filterLandingRegistry(entries() ?? [], query()));
  const registryCount = createMemo(() => formatRegistryCount(entries()?.length ?? 0));
  const featuredEntryId = createMemo(
    () => entries()?.find((entry) => entry.kind === "external")?.id ?? null,
  );
  const nextThemeLabel = createMemo(() => (theme() === "dark" ? "Light mode" : "Dark mode"));

  onMount(() => {
    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    const syncReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches);

    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);
    onCleanup(() => mediaQuery.removeEventListener("change", syncReducedMotion));
  });

  const commitTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme() === "dark" ? "light" : "dark";
    const viewTransitionDocument = document as ViewTransitionCapableDocument;

    if (
      !themeToggleRef ||
      prefersReducedMotion() ||
      typeof viewTransitionDocument.startViewTransition !== "function"
    ) {
      commitTheme(nextTheme);
      return;
    }

    const { top, left, width, height } = themeToggleRef.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxRadius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));

    const transition = viewTransitionDocument.startViewTransition(() => {
      commitTheme(nextTheme);
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
          },
          {
            duration: 420,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);
  };

  const scrollToRegistry = () => {
    registrySectionRef?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main class="page">
      <section class="hero-shell">
        <div class="hero-visuals" aria-hidden="true">
          <DotPattern class="hero-dot-pattern" width={24} height={24} cr={1.2} />
          <Spotlight class="hero-spotlight" fill="rgba(205, 225, 215, 0.22)" />
          <div class="hero-glow hero-glow-primary" />
          <div class="hero-glow hero-glow-secondary" />
        </div>

        <div class="hero-shell-inner">
          <header class="site-head">
            <p class="site-brand">
              <span>OpenLinks</span> Sites
            </p>
            <button
              ref={(element) => {
                themeToggleRef = element;
              }}
              class="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme() === "dark" ? "light" : "dark"} mode`}
            >
              {nextThemeLabel()}
            </button>
          </header>

          <div class="hero-layout">
            <BlurFade class="hero-copy" duration={0.55}>
              <p class="eyebrow">Managed OpenLinks Network</p>
              <h1>
                <span>OpenLinks Sites</span>
                <span>for people who need one</span>
                <span>clearer place to be found.</span>
              </h1>
              <div class="hero-rotating-line">
                Built for
                <div class="hero-rotate-frame">
                  <Show
                    when={!prefersReducedMotion()}
                    fallback={<div class="hero-rotate-word">{rotatingWords[0]}</div>}
                  >
                    <WordRotate words={rotatingWords} duration={2600} class="hero-rotate-word" />
                  </Show>
                </div>
              </div>
              <p class="lede">
                Version-controlled data in, stable path-based routes out. Import from existing link
                profiles, publish once, and keep every page easy to refresh and search.
              </p>
              <div class="hero-actions">
                <ShinyButton class="hero-primary-button" type="button" onClick={scrollToRegistry}>
                  Browse directory
                </ShinyButton>
                <a
                  class="hero-secondary-link"
                  href={openLinksIdentityUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit OpenLinks
                </a>
              </div>
            </BlurFade>

            <BlurFade class="hero-detail" delay={0.12} duration={0.55}>
              <p class="hero-detail-title">Need a page?</p>
              <p class="hero-detail-copy">
                Start with a Linktree-style URL or a plain list of links. The operator can import,
                enrich, and publish it automatically.
              </p>
              <p class="hero-detail-meta">
                One control repo. One stable route per person. One calm directory to browse.
              </p>
            </BlurFade>
          </div>
        </div>
      </section>

      <div class="shell">
        <section class="support-section" aria-labelledby="support-title">
          <BlurFade class="support-column" inView duration={0.45}>
            <p class="eyebrow" id="support-title">
              Request a managed page
            </p>
            <ol class="steps">
              <For each={requestSteps}>{(step) => <li>{step}</li>}</For>
            </ol>
          </BlurFade>

          <BlurFade
            class="support-column support-column-accent"
            delay={0.08}
            inView
            duration={0.45}
          >
            <p class="eyebrow">Run your own</p>
            <p class="support-copy">
              OpenLinks is the renderer behind these pages. If you prefer to self-host, keep your
              content in git and publish it anywhere static assets are supported.
            </p>
            <div class="support-links">
              <a class="support-link" href={openLinksIdentityUrl} target="_blank" rel="noreferrer">
                OpenLinks identity
              </a>
              <a
                class="support-link"
                href={openLinksRepositoryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Upstream renderer
              </a>
            </div>
          </BlurFade>
        </section>

        <section
          class="registry"
          aria-labelledby="registry-title"
          ref={(element) => {
            registrySectionRef = element;
          }}
        >
          <div class="registry-header">
            <BlurFade class="registry-copy" inView duration={0.45}>
              <p class="eyebrow">Browse Pages</p>
              <h2 class="section-title" id="registry-title">
                Search the managed directory and connected OpenLinks sites.
              </h2>
              <p class="registry-lede">
                Search across {registryCount()} and jump into live pages, whether they are hosted in
                this repo or linked in from a connected OpenLinks site.
              </p>
              <p class="registry-meta">
                Search by name, route, domain, or summary and go straight to the page you need.
              </p>
            </BlurFade>

            <BlurFade class="registry-search-wrap" delay={0.08} inView duration={0.45}>
              <label class="search-field">
                <span class="search-label">Search pages</span>
                <input
                  class="search-input"
                  type="search"
                  value={query()}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search by name, route, domain, or summary"
                />
              </label>
            </BlurFade>
          </div>

          <Switch>
            <Match when={entries.loading}>
              <div class="registry-empty">
                <p class="panel-title">Loading Directory</p>
                <p>Collecting live managed pages and connected OpenLinks sites for this network.</p>
              </div>
            </Match>

            <Match when={entries.error}>
              <div class="registry-empty">
                <p class="panel-title">Directory Unavailable</p>
                <p>The page index could not be loaded right now. Try refreshing in a moment.</p>
              </div>
            </Match>

            <Match when={(entries()?.length ?? 0) === 0}>
              <div class="registry-empty">
                <p class="panel-title">No Listings Yet</p>
                <p>
                  As managed pages and external OpenLinks sites are added to this registry, they
                  will appear here.
                </p>
              </div>
            </Match>

            <Match when={filteredEntries().length === 0}>
              <div class="registry-empty">
                <p class="panel-title">No Matches</p>
                <p>Try a different name, route, domain, or keyword from someone&apos;s summary.</p>
              </div>
            </Match>

            <Match when={filteredEntries().length > 0}>
              <div class="registry-grid">
                <For each={filteredEntries()}>
                  {(entry) => (
                    <RegistryCard entry={entry} featured={entry.id === featuredEntryId()} />
                  )}
                </For>
              </div>
            </Match>
          </Switch>
        </section>

        <footer class="site-foot">
          <p>Built on OpenLinks and published from version-controlled data.</p>
          <div class="site-foot-links">
            <a href={openLinksIdentityUrl} target="_blank" rel="noreferrer">
              OpenLinks identity
            </a>
            <a href={openLinksRepositoryUrl} target="_blank" rel="noreferrer">
              View the renderer
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
};
