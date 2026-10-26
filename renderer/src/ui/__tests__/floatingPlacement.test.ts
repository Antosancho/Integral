import { describe, expect, it } from 'vitest'
import { FLOATING_MIN_WIDTH, computeFloatingPlacement } from '../floatingPlacement'

const rect = (top: number, left: number, width: number, height = 40) => ({
  top,
  left,
  width,
  bottom: top + height,
  right: left + width,
})
const V = { width: 1280, height: 690 }

describe('computeFloatingPlacement', () => {
  it('básico: abre abajo con 420 de ancho', () => {
    expect(computeFloatingPlacement(rect(100, 200, 246), V)).toEqual({
      side: 'below', top: 144, bottom: 'auto', left: 200, width: 420, maxHeight: 538,
    })
  })

  it('si no entra a la derecha, alinea al borde derecho', () => {
    expect(computeFloatingPlacement(rect(100, 1000, 246), V)).toEqual({
      side: 'below', top: 144, bottom: 'auto', left: 826, width: 420, maxHeight: 538,
    })
  })

  it('disparador más ancho que 420', () => {
    expect(computeFloatingPlacement(rect(100, 200, 500), V)).toEqual({
      side: 'below', top: 144, bottom: 'auto', left: 200, width: 500, maxHeight: 538,
    })
  })

  it('ventana angosta: ancho y left acotados', () => {
    expect(computeFloatingPlacement(rect(100, 10, 246), { width: 400, height: 690 })).toEqual({
      side: 'below', top: 144, bottom: 'auto', left: 8, width: 384, maxHeight: 538,
    })
  })

  it('sin lugar abajo abre hacia arriba', () => {
    expect(computeFloatingPlacement(rect(560, 200, 246), V)).toEqual({
      side: 'above', top: 'auto', bottom: 134, left: 200, width: 420, maxHeight: 548,
    })
  })

  it('abajo < 360 pero más que arriba: abre abajo', () => {
    expect(computeFloatingPlacement(rect(300, 200, 246), V)).toEqual({
      side: 'below', top: 344, bottom: 'auto', left: 200, width: 420, maxHeight: 338,
    })
  })

  it('abajo exactamente 360: abre abajo', () => {
    expect(computeFloatingPlacement(rect(278, 200, 246), V)).toEqual({
      side: 'below', top: 322, bottom: 'auto', left: 200, width: 420, maxHeight: 360,
    })
  })

  it('sin lugar en ningún lado: maxHeight nunca es negativo', () => {
    expect(computeFloatingPlacement(rect(5, 200, 246, 680), V)).toEqual({
      side: 'below', top: 689, bottom: 'auto', left: 200, width: 420, maxHeight: 0,
    })
  })

  it('los valores con decimales se redondean', () => {
    expect(computeFloatingPlacement({ top: 100.4, bottom: 140.6, left: 200.5, right: 446.5, width: 246 }, V)).toEqual({
      side: 'below', top: 145, bottom: 'auto', left: 201, width: 420, maxHeight: 537,
    })
  })

  it('minWidth propio', () => {
    expect(computeFloatingPlacement(rect(100, 200, 246), V, 0)).toEqual({
      side: 'below', top: 144, bottom: 'auto', left: 200, width: 246, maxHeight: 538,
    })
  })

  it('el ancho mínimo es el del design system', () => {
    expect(FLOATING_MIN_WIDTH).toBe(420)
  })
})
