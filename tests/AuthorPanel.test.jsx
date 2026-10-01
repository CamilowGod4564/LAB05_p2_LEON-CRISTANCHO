import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AuthorPanel from '../src/components/AuthorPanel.jsx'

const items = [
  { author: 'juan', name: 'plano-1', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
  { author: 'juan', name: 'plano-2', points: [{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }] },
]

describe('AuthorPanel', () => {
  it('renders the blueprint table and the total of points of the author', () => {
    render(<AuthorPanel author="juan" items={items} status="succeeded" />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('plano-1')).toBeInTheDocument()
    expect(screen.getByText('plano-2')).toBeInTheDocument()
    expect(screen.getByTestId('author-total-points')).toHaveTextContent('5')
  })

  it('calls onOpen with the clicked blueprint and highlights the selected row', () => {
    const onOpen = vi.fn()
    render(
      <AuthorPanel author="juan" items={items} selectedName="plano-2" onOpen={onOpen} />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1])

    expect(onOpen).toHaveBeenCalledWith(items[1])
    expect(screen.getByText('plano-2').closest('tr')).toHaveClass('selected-row')
  })

  it('shows an error banner with a retry button when loading fails', () => {
    const onRetry = vi.fn()
    render(<AuthorPanel author="juan" status="failed" error="Network Error" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Network Error')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
    expect(screen.getByTestId('author-total-points')).toHaveTextContent('0')
  })
})
