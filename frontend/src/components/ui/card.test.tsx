import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Card, CardContent, CardHeader } from './card'

describe('Card spacing contract', () => {
  it('gives standalone content full responsive padding', () => {
    const html = renderToStaticMarkup(<Card><CardContent>content</CardContent></Card>)

    expect(html).toContain('data-slot="card-content"')
    expect(html).toContain('class="p-5 md:p-6"')
    expect(html).not.toContain('data-explicit-top-padding')
  })

  it('marks header and content as adjacent composition slots', () => {
    const html = renderToStaticMarkup(<Card><CardHeader>title</CardHeader><CardContent>content</CardContent></Card>)

    expect(html).toContain('data-slot="card-header"')
    expect(html).toMatch(/data-slot="card-header"[\s\S]*data-slot="card-content"/)
  })

  it('preserves an intentional top-padding override', () => {
    const html = renderToStaticMarkup(<CardContent className="p-7 md:pt-8">content</CardContent>)

    expect(html).toContain('data-explicit-top-padding="true"')
    expect(html).toMatch(/class="[^"]*\bp-7\b[^"]*"/)
    expect(html).toMatch(/class="[^"]*\bmd:pt-8\b[^"]*"/)
  })
})
