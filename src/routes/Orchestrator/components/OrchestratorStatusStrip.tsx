import React from 'react'
import type { OrchestratorStatusItem, OrchestratorStatusModel } from './orchestratorStatus'
import styles from './OrchestratorStatusStrip.css'

interface OrchestratorStatusStripProps {
  model: OrchestratorStatusModel
}

const toneClass: Record<OrchestratorStatusItem['tone'], string> = {
  neutral: styles.toneNeutral,
  primary: styles.tonePrimary,
  live: styles.toneLive,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  danger: styles.toneDanger,
}

function getStatusPillAriaLabel (item: OrchestratorStatusItem, labelPrefix: 'Authority' | 'Broadcast' | 'Camera'): string {
  const value = labelPrefix === 'Camera'
    ? item.label.replace(/^Camera\s+/, '').replace(/^\w/, first => first.toUpperCase())
    : item.label
  return `${labelPrefix}: ${value}`
}

function StatusPill ({
  item,
  priority,
  labelPrefix,
}: {
  item: OrchestratorStatusItem
  priority: 'authority' | 'signal'
  labelPrefix: 'Authority' | 'Broadcast' | 'Camera'
}) {
  return (
    <span
      className={`${styles.pill} ${priority === 'authority' ? styles.authorityPill : styles.signalPill} ${toneClass[item.tone]}`}
      aria-label={getStatusPillAriaLabel(item, labelPrefix)}
    >
      {item.label}
    </span>
  )
}

function OrchestratorStatusStrip ({ model }: OrchestratorStatusStripProps) {
  return (
    <div className={styles.strip} aria-label='Orchestrator status' aria-live='polite'>
      <StatusPill item={model.authority} priority='authority' labelPrefix='Authority' />
      <StatusPill item={model.broadcast} priority='signal' labelPrefix='Broadcast' />
      <StatusPill item={model.camera} priority='signal' labelPrefix='Camera' />
    </div>
  )
}

export default OrchestratorStatusStrip
