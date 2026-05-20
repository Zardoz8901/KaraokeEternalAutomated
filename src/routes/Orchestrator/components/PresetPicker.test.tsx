// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import PresetPicker from './PresetPicker'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function findButtonByText (container: HTMLElement, text: string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  return buttons.find(button => (button.textContent ?? '').trim() === text) ?? null
}

describe('PresetPicker', () => {
  it('omits gallery Send buttons when raw gallery send is unavailable', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<PresetPicker onLoad={() => {}} />)
    })

    await act(async () => {
      findButtonByText(container, 'Presets')?.click()
    })

    expect(findButtonByText(container, 'Load')).not.toBeNull()
    expect(findButtonByText(container, 'Send')).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('keeps gallery Send buttons available for manager raw-code send', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(<PresetPicker onLoad={() => {}} onSend={onSend} />)
    })

    await act(async () => {
      findButtonByText(container, 'Presets')?.click()
    })

    const sendButton = findButtonByText(container, 'Send')
    expect(sendButton).not.toBeNull()

    await act(async () => {
      sendButton?.click()
    })

    expect(onSend).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
  })
})
