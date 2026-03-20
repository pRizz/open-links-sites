/** @jsxImportSource solid-js */
import { Show } from "solid-js";

import {
  initialsForRegistryEntry,
  landingRegistryLinkLabel,
  landingRegistryLinkRel,
  landingRegistryLinkTarget,
} from "./registry";
import type { LandingRegistryEntry } from "./registry-contract";

export interface RegistryCardProps {
  entry: LandingRegistryEntry;
}

export const RegistryCard = (props: RegistryCardProps) => (
  <article class="registry-card">
    <Show when={props.entry.previewImageUrl}>
      <img
        class="registry-preview"
        src={props.entry.previewImageUrl}
        alt={`${props.entry.displayName} preview`}
        loading="lazy"
      />
    </Show>

    <div class="registry-card-head">
      <Show
        when={props.entry.avatarUrl}
        fallback={
          <div class="registry-avatar registry-avatar-fallback">
            {initialsForRegistryEntry(props.entry)}
          </div>
        }
      >
        <img
          class="registry-avatar"
          src={props.entry.avatarUrl}
          alt={`${props.entry.displayName} avatar`}
          loading="lazy"
        />
      </Show>

      <div class="registry-card-copy">
        <div class="registry-name-row">
          <p class="registry-name">{props.entry.displayName}</p>
          <Show when={props.entry.badgeLabel}>
            <span class="registry-badge">{props.entry.badgeLabel}</span>
          </Show>
        </div>
        <p class="registry-subtitle">{props.entry.subtitle}</p>
      </div>
    </div>

    <Show when={props.entry.headline}>
      <p class="registry-headline">{props.entry.headline}</p>
    </Show>

    <Show when={props.entry.summary}>
      <p class="registry-summary">{props.entry.summary}</p>
    </Show>

    <a
      class="registry-link"
      href={props.entry.href}
      target={landingRegistryLinkTarget(props.entry)}
      rel={landingRegistryLinkRel(props.entry)}
    >
      {landingRegistryLinkLabel(props.entry)}
    </a>
  </article>
);
