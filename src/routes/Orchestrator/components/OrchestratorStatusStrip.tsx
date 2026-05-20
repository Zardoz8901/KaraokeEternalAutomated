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

function StatusPill ({ item, priority }: { item: OrchestratorStatusItem, priority: 'authority' | 'signal' }) {
  return (
    <span className={`${styles.pill} ${priority === 'authority' ? styles.authorityPill : styles.signalPill} ${toneClass[item.tone]}`}>
      {item.label}
    </span>
  )
}

function OrchestratorStatusStrip ({ model }: OrchestratorStatusStripProps) {
  return (
    <div className={styles.strip} aria-label='Orchestrator status'>
      <StatusPill item={model.authority} priority='authority' />
      <StatusPill item={model.broadcast} priority='signal' />
      <StatusPill item={model.camera} priority='signal' />
    </div>
  )
}

export default OrchestratorStatusStrip
