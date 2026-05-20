// @vitest-environment jsdom
import React, { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

const mocks = vi.hoisted(() => ({
  state: {
    user: {
      userId: 11,
      isAdmin: false,
      roomId: 2,
      ownRoomId: 1,
    },
    rooms: {
      entities: {
        2: {
          prefs: {
            allowGuestOrchestrator: true,
          },
        },
      } as Record<number, { prefs: { allowGuestOrchestrator: boolean } }>,
    },
  },
}))

vi.mock('store/hooks', () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}))

import Navigation from './Navigation'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Navigation', () => {
  beforeEach(() => {
    mocks.state.user = {
      userId: 11,
      isAdmin: false,
      roomId: 2,
      ownRoomId: 1,
    }
    mocks.state.rooms.entities = {
      2: {
        prefs: {
          allowGuestOrchestrator: true,
        },
      },
    }
  })

  async function renderNavigation () {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/library']}>
          <Navigation />
        </MemoryRouter>,
      )
    })

    return { container, root }
  }

  it('renders visible app-area labels with accessible names on the links', async () => {
    const { container, root } = await renderNavigation()

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
    expect(links.map(link => link.textContent?.trim())).toEqual([
      'Library',
      'Queue',
      'Visuals',
      'Account',
    ])
    expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
      'Library',
      'Queue',
      'Visuals',
      'Account',
    ])
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/library',
      '/queue',
      '/orchestrator',
      '/account',
    ])

    await act(async () => {
      root.unmount()
    })
  })

  it('hides Visuals when the shared route access helper would block the current room', async () => {
    mocks.state.rooms.entities[2].prefs.allowGuestOrchestrator = false

    const { container, root } = await renderNavigation()

    const labels = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
      .map(link => link.textContent?.trim())

    expect(labels).toEqual(['Library', 'Queue', 'Account'])

    await act(async () => {
      root.unmount()
    })
  })

  it('shows Visuals for the room owner even when collaborator orchestrator access is disabled', async () => {
    mocks.state.user.roomId = 1
    mocks.state.user.ownRoomId = 1
    mocks.state.rooms.entities = {
      1: {
        prefs: {
          allowGuestOrchestrator: false,
        },
      },
    }

    const { container, root } = await renderNavigation()

    const labels = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
      .map(link => link.textContent?.trim())

    expect(labels).toContain('Visuals')

    await act(async () => {
      root.unmount()
    })
  })
})
