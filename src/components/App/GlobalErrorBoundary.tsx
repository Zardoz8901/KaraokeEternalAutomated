import React from 'react'

interface State { hasError: boolean }

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError (): State {
    return { hasError: true }
  }

  render () {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-color)', fontFamily: 'var(--font-family)', gap: 'var(--space-m)' }}>
          <h2>Something Went Wrong</h2>
          <p style={{ color: 'var(--color-gray-5)' }}>An unexpected error occurred.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: 'var(--space-s) var(--space-m)', backgroundColor: 'var(--btn-bg-color)', color: 'var(--text-color)', border: 'none', borderRadius: 'var(--border-radius)', cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-m)' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default GlobalErrorBoundary
