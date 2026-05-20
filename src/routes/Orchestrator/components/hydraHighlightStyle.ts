import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { MatchDecorator, ViewPlugin, Decoration, EditorView } from '@codemirror/view'

// Extended highlight style using the Orchestrator Solarized token contract.
export const hydraHighlightStyle = HighlightStyle.define([
  { tag: tags.function(tags.variableName), color: 'var(--orch-green)', fontWeight: 'bold' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--orch-violet)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--orch-cyan)' },
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: 'var(--orch-orange)' },
  { tag: tags.comment, color: 'var(--orch-muted)', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation, tags.separator], color: 'var(--orch-text)' },
  { tag: tags.variableName, color: 'var(--orch-text)' },
  { tag: tags.propertyName, color: 'var(--orch-green)' },
  { tag: [tags.bool, tags.null], color: 'var(--orch-blue)' },
])

// Custom decorations for Hydra-specific tokens
const hydraSourceDeco = Decoration.mark({ class: 'cm-hydra-source' })
const hydraOutputDeco = Decoration.mark({ class: 'cm-hydra-output' })
const hydraInputDeco = Decoration.mark({ class: 'cm-hydra-input' })
const hydraAudioDeco = Decoration.mark({ class: 'cm-hydra-audio' })

const hydraSourceMatcher = new MatchDecorator({
  regexp: /\b(osc|noise|shape|voronoi|gradient|solid|src)\b/g,
  decoration: hydraSourceDeco,
})

const hydraOutputMatcher = new MatchDecorator({
  regexp: /\b(o[0-3])\b/g,
  decoration: hydraOutputDeco,
})

const hydraInputMatcher = new MatchDecorator({
  regexp: /\b(s[0-3])\b/g,
  decoration: hydraInputDeco,
})

const hydraAudioMatcher = new MatchDecorator({
  regexp: /\ba\.(fft|setBins|setSmooth|setScale)\b/g,
  decoration: hydraAudioDeco,
})

export const hydraSourcePlugin = ViewPlugin.define(view => ({
  decorations: hydraSourceMatcher.createDeco(view),
  update (u) { this.decorations = hydraSourceMatcher.updateDeco(u, this.decorations) },
}), { decorations: v => v.decorations })

export const hydraOutputPlugin = ViewPlugin.define(view => ({
  decorations: hydraOutputMatcher.createDeco(view),
  update (u) { this.decorations = hydraOutputMatcher.updateDeco(u, this.decorations) },
}), { decorations: v => v.decorations })

export const hydraInputPlugin = ViewPlugin.define(view => ({
  decorations: hydraInputMatcher.createDeco(view),
  update (u) { this.decorations = hydraInputMatcher.updateDeco(u, this.decorations) },
}), { decorations: v => v.decorations })

export const hydraAudioPlugin = ViewPlugin.define(view => ({
  decorations: hydraAudioMatcher.createDeco(view),
  update (u) { this.decorations = hydraAudioMatcher.updateDeco(u, this.decorations) },
}), { decorations: v => v.decorations })

export const hydraExtensions = [
  syntaxHighlighting(hydraHighlightStyle),
  hydraSourcePlugin,
  hydraOutputPlugin,
  hydraInputPlugin,
  hydraAudioPlugin,
  EditorView.theme({
    '.cm-hydra-source': { color: 'var(--orch-orange)', fontWeight: 'bold' },
    '.cm-hydra-output': { color: 'var(--orch-violet)', fontWeight: 'bold' },
    '.cm-hydra-input': { color: 'var(--orch-blue)', fontStyle: 'italic' },
    '.cm-hydra-audio': { color: 'var(--orch-text-strong)', textDecoration: 'underline' },
  }),
]
