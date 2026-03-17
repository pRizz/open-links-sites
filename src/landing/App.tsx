import { For } from "solid-js";

const requestSteps = [
  "Share who the page is for and any existing Linktree-style URL.",
  "The operator can import links, enrich metadata, and publish the page automatically.",
  "If you want to self-host, OpenLinks is open source and version controlled.",
];

export const App = () => (
  <main class="shell">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Managed OpenLinks Network</p>
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
          OpenLinks is the renderer behind these pages. If you prefer to operate your own site, fork
          the project, keep your content in git, and publish it wherever static assets are
          supported.
        </p>
        <a class="link" href="https://github.com/pRizz/open-links">
          View the upstream project
        </a>
      </article>
    </section>
  </main>
);
