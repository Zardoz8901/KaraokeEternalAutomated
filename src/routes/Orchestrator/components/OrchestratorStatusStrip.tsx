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

function StatusPill ({ item }: { item: OrchestratorStatusItem }) {
  return (
    <span className={`${styles.pill} ${toneClass[item.tone]}`}>
      {item.label}
    </span>
  )
}

function OrchestratorStatusStrip ({ model }: OrchestratorStatusStripProps) {
  return (
    <div className={styles.strip} aria-label='Orchestrator status'>
      <StatusPill item={model.authority} />
      <StatusPill item={model.broadcast} />
      <StatusPill item={model.camera} />
    </div>
  )
}

export default OrchestratorStatusStrip
