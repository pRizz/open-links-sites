import { For, Match, Show, Switch, createMemo, createResource, createSignal } from "solid-js";

import { RegistryCard } from "./RegistryCard";
import { fetchLandingRegistry, filterLandingRegistry, formatRegistryCount } from "./registry";
import { applyTheme, readDocumentTheme, saveTheme } from "./theme";

const requestSteps = [
  "Share who the page is for and any existing Linktree-style URL.",
  "The operator can import links, enrich metadata, and publish the page automatically.",
  "If you want to self-host, OpenLinks is open source and version controlled.",
];

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [theme, setTheme] = createSignal(readDocumentTheme());
  const [entries] = createResource(fetchLandingRegistry);
  const filteredEntries = createMemo(() => filterLandingRegistry(entries() ?? [], query()));
  const registryCount = createMemo(() => formatRegistryCount(entries()?.length ?? 0));
  const nextThemeLabel = createMemo(() => (theme() === "dark" ? "Light mode" : "Dark mode"));

  const toggleTheme = () => {
    const nextTheme = theme() === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  };

  return (
    <main class="shell">
      <header class="site-head">
        <p class="eyebrow">Managed OpenLinks Network</p>
        <button
          class="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme() === "dark" ? "light" : "dark"} mode`}
        >
          {nextThemeLabel()}
        </button>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <h1>Simple pages for people who need one clear place to be found.</h1>
          <p class="lede">
            This site hosts individual OpenLinks pages under path-based routes. Each page is built
            from version-controlled data, then deployed automatically.
          </p>
        </div>

        <div class="hero-card">
          <p class="card-kicker">Need a page?</p>
          <p class="card-body">
            Ask the operator who sent you here. A new page can be bootstrapped from an existing
            Linktree-style profile or a plain list of links.
          </p>
        </div>
      </section>

      <section class="grid">
        <article class="panel">
          <p class="panel-title">Request A Managed Page</p>
          <ol class="steps">
            <For each={requestSteps}>{(step) => <li>{step}</li>}</For>
          </ol>
        </article>

        <article class="panel accent">
          <p class="panel-title">Run Your Own</p>
          <p>
            OpenLinks is the renderer behind these pages. If you prefer to operate your own site,
            fork the project, keep your content in git, and publish it wherever static assets are
            supported.
          </p>
          <a class="link" href="https://github.com/pRizz/open-links">
            View the upstream project
          </a>
        </article>
      </section>

      <section class="registry" aria-labelledby="registry-title">
        <div class="registry-header">
          <div class="registry-copy">
            <p class="eyebrow">Browse Pages</p>
            <h2 class="section-title" id="registry-title">
              Discover managed pages and connected OpenLinks sites.
            </h2>
            <p class="registry-lede">
              Search across {registryCount()} and jump into live pages, whether they are hosted in
              this repo or linked in from a connected OpenLinks site.
            </p>
          </div>

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
        </div>

        <Switch>
          <Match when={entries.loading}>
            <div class="registry-empty">
              <p class="panel-title">Loading Directory</p>
              <p>
                Collecting the live managed pages and connected OpenLinks sites for this network.
              </p>
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
                As managed pages and external OpenLinks sites are added to this registry, they will
                appear here.
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
              <For each={filteredEntries()}>{(entry) => <RegistryCard entry={entry} />}</For>
            </div>
          </Match>
        </Switch>
      </section>
    </main>
  );
};
