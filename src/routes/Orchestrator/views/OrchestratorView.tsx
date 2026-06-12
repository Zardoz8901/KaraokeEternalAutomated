import React from 'react'
import { Link } from 'react-router'
import Icon from 'components/Icon/Icon'
import ApiReference from '../components/ApiReference'
import PresetBrowser from '../components/PresetBrowser'
import CodeEditor from '../components/CodeEditor'
import StagePanel from '../components/StagePanel'
import OrchestratorStatusStrip from '../components/OrchestratorStatusStrip'
import { REMOTE_UPDATE_BANNER_LABEL } from '../components/orchestratorPresentationModel'
import {
  getCodeDockMaxHeight,
  ORCHESTRATOR_CODE_DOCK_DEFAULT_VIEWPORT_FRACTION,
  ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT,
  ORCHESTRATOR_REF_PANEL_MAX_WIDTH,
  ORCHESTRATOR_REF_PANEL_MIN_WIDTH,
} from './orchestratorWorkspaceResize'
import { useOrchestratorWorkspace } from './useOrchestratorWorkspace'
import styles from './OrchestratorView.css'

function OrchestratorView () {
  const {
    containerRef,
    containerStyle,
    workspaceModel,
    orchestratorStatusModel,
    presetBrowserProps,
    apiReferenceProps,
    stagePanelProps,
    codeEditorProps,
    activeDesktopPanel,
    activeMobilePanel,
    setActiveDesktopPanel,
    setActiveMobilePanel,
    isKeyboardOpen,
    isMobile,
    isRefOpen,
    isResizingPanel,
    startRefPanelResize,
    refPanelWidth,
    handleRefPanelResizeKeyDown,
    codeDockHeight,
    isResizingCodeDock,
    startCodeDockResize,
    handleCodeDockResizeKeyDown,
    pendingRemoteCode,
    pendingRemoteCount,
    handleApplyRemote,
    handleDismissRemote,
    showUnsentMobileDot,
    showPresetSendMobileDot,
    presetSendStatus,
  } = useOrchestratorWorkspace()
  const { shellModel } = workspaceModel
  const refPanelClass = isRefOpen
    ? `${styles.refPanel} ${styles.refPanelOpen}`
    : styles.refPanel
  const containerClass = [
    styles.container,
    shellModel.desktopLayout === 'operatorStageExpanded' ? styles.containerOperatorStageExpanded : '',
    isResizingPanel ? styles.containerResizing : '',
    isResizingCodeDock ? styles.containerResizingRow : '',
    pendingRemoteCode ? styles.containerWithBanner : '',
    isKeyboardOpen ? styles.containerKeyboardOpen : '',
  ].filter(Boolean).join(' ')

  const codeDockMaxHeight = typeof window !== 'undefined'
    ? getCodeDockMaxHeight(window.innerHeight)
    : ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT
  const codeDockValueNow = codeDockHeight
    ?? (typeof window !== 'undefined'
      ? Math.round(window.innerHeight * ORCHESTRATOR_CODE_DOCK_DEFAULT_VIEWPORT_FRACTION)
      : ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)

  const tabContent = activeDesktopPanel === 'presets'
    ? <PresetBrowser {...presetBrowserProps} />
    : <ApiReference {...apiReferenceProps} />

  return (
    <div
      className={containerClass}
      ref={containerRef}
      style={containerStyle}
    >
      <div className={refPanelClass}>
        <div className={styles.tabBar}>
          <Link to='/library' className={styles.libraryExit} aria-label='Library' title='Library'>
            <Icon icon='CHEVRON_LEFT' size={18} />
            <span>Library</span>
          </Link>
          <div className={styles.panelTabs} role='tablist' aria-label='Orchestrator panels'>
            <button
              type='button'
              role='tab'
              aria-selected={activeDesktopPanel === 'presets'}
              className={`${styles.tab} ${activeDesktopPanel === 'presets' ? styles.tabActive : ''}`}
              onClick={() => setActiveDesktopPanel('presets')}
            >
              Presets
            </button>
            {workspaceModel.canShowApiPanel && (
              <button
                type='button'
                role='tab'
                aria-selected={activeDesktopPanel === 'api'}
                className={`${styles.tab} ${activeDesktopPanel === 'api' ? styles.tabActive : ''}`}
                onClick={() => setActiveDesktopPanel('api')}
              >
                API
              </button>
            )}
          </div>
        </div>
        <div className={styles.tabContent}>
          {tabContent}
        </div>
        {!isMobile && (
          <div
            className={styles.refPanelResize}
            onPointerDown={startRefPanelResize}
            onKeyDown={handleRefPanelResizeKeyDown}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize presets panel'
            aria-valuemin={ORCHESTRATOR_REF_PANEL_MIN_WIDTH}
            aria-valuemax={ORCHESTRATOR_REF_PANEL_MAX_WIDTH}
            aria-valuenow={refPanelWidth}
            tabIndex={0}
          />
        )}
      </div>
      {isMobile && activeMobilePanel === 'ref' && (
        <div
          className={styles.refPanelOverlay}
          onClick={() => setActiveMobilePanel('stage')}
          role='presentation'
        />
      )}
      {pendingRemoteCode && (
        <div className={styles.remoteBanner} role='status' aria-live='polite'>
          <span className={styles.remoteBannerText}>
            {`${REMOTE_UPDATE_BANNER_LABEL}${pendingRemoteCount > 1 ? ` (\u00d7${pendingRemoteCount})` : ''}`}
          </span>
          <button type='button' className={styles.remoteBannerApply} onClick={handleApplyRemote}>
            Apply
          </button>
          <button type='button' className={styles.remoteBannerDismiss} onClick={handleDismissRemote}>
            Dismiss
          </button>
        </div>
      )}
      {(!isMobile || activeMobilePanel === 'stage') && (
        <div className={styles.stageDock}>
          <StagePanel
            {...stagePanelProps}
            statusStrip={<OrchestratorStatusStrip model={orchestratorStatusModel} />}
          />
        </div>
      )}
      {workspaceModel.canShowCodePanel && (!isMobile || activeMobilePanel === 'code') && (
        <div className={styles.codeDock}>
          {!isMobile && (
            <div
              className={styles.codeDockResize}
              onPointerDown={startCodeDockResize}
              onKeyDown={handleCodeDockResizeKeyDown}
              role='separator'
              aria-orientation='horizontal'
              aria-label='Resize code editor'
              aria-valuemin={ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT}
              aria-valuemax={codeDockMaxHeight}
              aria-valuenow={codeDockValueNow}
              tabIndex={0}
            />
          )}
          <CodeEditor {...codeEditorProps} />
        </div>
      )}

      {isMobile && !isKeyboardOpen && (
        <div className={styles.mobileToolbar}>
          <Link to='/library' className={styles.mobileLibraryLink} aria-label='Library' title='Library'>
            <Icon icon='CHEVRON_LEFT' size={18} />
            <span>Library</span>
          </Link>
          <div className={styles.mobileTabList} role='tablist' aria-label='Orchestrator panels'>
            <button
              type='button'
              role='tab'
              aria-selected={activeMobilePanel === 'stage'}
              aria-label='Stage'
              className={`${styles.mobileTab} ${activeMobilePanel === 'stage' ? styles.mobileTabActive : ''}`}
              onClick={() => setActiveMobilePanel('stage')}
            >
              <span className={styles.mobileTabIcon}>{'\u25b6'}</span>
              <span>Stage</span>
            </button>
            {workspaceModel.canShowCodePanel && (
              <button
                type='button'
                role='tab'
                aria-selected={activeMobilePanel === 'code'}
                aria-label='Code'
                className={`${styles.mobileTab} ${activeMobilePanel === 'code' ? styles.mobileTabActive : ''}`}
                onClick={() => setActiveMobilePanel('code')}
              >
                <span className={styles.mobileTabIcon}>{'\u003c\u002f\u003e'}</span>
                <span>Code</span>
                {showUnsentMobileDot && (
                  <span className={`${styles.mobileTabDot} ${codeEditorProps.sendStatus === 'error' ? styles.mobileTabDotError : ''}`} />
                )}
              </button>
            )}
            <button
              type='button'
              role='tab'
              aria-selected={activeMobilePanel === 'ref'}
              aria-label='Presets'
              className={`${styles.mobileTab} ${activeMobilePanel === 'ref' ? styles.mobileTabActive : ''}`}
              onClick={() => setActiveMobilePanel('ref')}
            >
              <span className={styles.mobileTabIcon}>{'\u2630'}</span>
              <span>Presets</span>
              {showPresetSendMobileDot && (
                <span className={`${styles.mobileTabDot} ${presetSendStatus === 'error' ? styles.mobileTabDotError : ''}`} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrchestratorView
