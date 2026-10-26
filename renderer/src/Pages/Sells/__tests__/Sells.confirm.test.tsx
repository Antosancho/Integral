import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Sells from '../Sells'
import { SalesProvider } from '../../../store/SalesContext'
import { ToastProvider } from '../../../ui/Toast'
import { makeProduct } from '../../../test/fixtures'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { CreateSalePayload, ProductFromApi, SaleFromApi } from '../../../electron-api'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CODE = '7790070000005'
const coca = makeProduct({ id: 7, name: 'Coca 2L', barcode: BigInt(CODE), salePrice: '1000', stock: 5 })

const fakeSale: SaleFromApi = { id: 1, date: new Date(), total: '1000', discountPct: '0', items: [], payments: [] }

let createSale: ReturnType<typeof vi.fn>
let getProductByBarcode: ReturnType<typeof vi.fn>

/** Productos por código, para que cada test registre los suyos. */
let catalog: Record<string, ProductFromApi>

beforeEach(() => {
  catalog = { [CODE]: coca }
  createSale = vi.fn().mockResolvedValue(fakeSale)
  getProductByBarcode = vi.fn(async (code: string) => catalog[code] ?? null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as any).api = { createSale, getProductByBarcode, listProducts: vi.fn().mockResolvedValue([]) }
})

afterEach(() => {
  delete (window as any).api
})

const barcodeInput = () => screen.getByLabelText('Código de barras') as HTMLInputElement
const cashInput = () => screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
const approveButton = () => screen.getByRole('button', { name: 'APROBAR VENTA' })

function renderSells() {
  return renderWithProviders(<Sells viewSwitcher={null} />)
}

async function scan(code = CODE) {
  fireEvent.change(barcodeInput(), { target: { value: code } })
  fireEvent.keyDown(barcodeInput(), { key: 'Enter' })
}

/** Escanea el producto y espera a que aparezca su fila. */
async function addCoca() {
  await scan()
  await screen.findByLabelText('Cantidad de Coca 2L')
}

describe('Sells — carrito', () => {
  it('con el carrito vacío muestra "Escaneá un producto para empezar" y no hay panel de pago', () => {
    renderSells()
    expect(screen.getByText('Escaneá un producto para empezar')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pago' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'APROBAR VENTA' })).toBeNull()
  })

  it('escanear agrega la línea, aparece el panel y el input queda vacío y con foco', async () => {
    renderSells()
    await addCoca()
    expect(screen.getByRole('region', { name: 'Pago' })).toBeInTheDocument()
    expect(getProductByBarcode).toHaveBeenCalledWith(CODE)
    await waitFor(() => expect(barcodeInput().value).toBe(''))
    expect(barcodeInput()).toHaveFocus()
  })

  it('escanear el mismo código suma 1: una sola fila con cantidad 2', async () => {
    renderSells()
    await addCoca()
    await scan()
    await waitFor(() => expect((screen.getByLabelText('Cantidad de Coca 2L') as HTMLInputElement).value).toBe('2'))
    expect(screen.getAllByLabelText('Cantidad de Coca 2L')).toHaveLength(1)
  })

  it('código inexistente: toast "Producto no encontrado" con el código y el input conserva el texto', async () => {
    renderSells()
    await scan('999')
    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument()
    expect(screen.getByText('Código 999')).toBeInTheDocument()
    expect(barcodeInput().value).toBe('999')
    expect(screen.queryByRole('region', { name: 'Pago' })).toBeNull()
  })

  it('si la búsqueda por código falla (excepción) también avisa "Producto no encontrado"', async () => {
    getProductByBarcode.mockRejectedValue(new Error('código inválido'))
    renderSells()
    await scan('abc')
    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument()
  })

  it('stock insuficiente: toast "Sin stock suficiente", badge "Sin stock" y la línea SÍ se agrega', async () => {
    catalog[CODE] = makeProduct({ ...coca, stock: 0 })
    renderSells()
    await addCoca()
    expect(await screen.findByText('Sin stock suficiente')).toBeInTheDocument()
    expect(screen.getByText('«Coca 2L» se agregó igual')).toBeInTheDocument()
    expect(screen.getByText('Sin stock')).toBeInTheDocument()
  })

  it('producto sin precio: toast y no se agrega (el texto queda para corregir)', async () => {
    catalog[CODE] = makeProduct({ ...coca, salePrice: '0' })
    renderSells()
    await scan()
    expect(await screen.findByText('El producto no tiene un precio cargado')).toBeInTheDocument()
    expect(screen.getByText('«Coca 2L» — no se agregó')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cantidad de Coca 2L')).toBeNull()
    expect(barcodeInput().value).toBe(CODE)
  })

  it('editar la cantidad de una fila actualiza el total', async () => {
    renderSells()
    await addCoca()
    const qty = screen.getByLabelText('Cantidad de Coca 2L')
    fireEvent.focus(qty)
    fireEvent.change(qty, { target: { value: '3' } })
    fireEvent.keyDown(qty, { key: 'Enter' })
    expect(screen.getByText('$ 3.000,00', { selector: '.ig-pay-total .v' })).toBeInTheDocument()
  })

  it('quitar la última línea vuelve al estado vacío y devuelve el foco al input de código', async () => {
    renderSells()
    await addCoca()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Coca 2L' }))
    expect(await screen.findByText('Escaneá un producto para empezar')).toBeInTheDocument()
    await waitFor(() => expect(barcodeInput()).toHaveFocus())
  })
})

describe('Sells — pagos', () => {
  it('APROBAR está deshabilitado con el motivo; la etiqueta EFECTIVO completa el monto y lo habilita', async () => {
    renderSells()
    await addCoca()
    expect(approveButton()).toBeDisabled()
    expect(screen.getByText('Falta cubrir $ 1.000,00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Autocompletar EFECTIVO' }))
    expect(cashInput().value).toBe('1.000,00')
    expect(screen.queryByText(/^Falta cubrir \$/)).toBeNull()
    expect(document.querySelector('.ig-change')).toHaveClass('is-exact')
    expect(screen.getAllByText('Pago exacto').length).toBeGreaterThan(0)
    expect(approveButton()).toBeEnabled()
  })

  it('pago de 20000 en efectivo: al salir se formatea y muestra "Vuelto $ 19.000,00"', async () => {
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '20000' } })
    fireEvent.blur(cashInput())
    expect(cashInput().value).toBe('20.000,00')
    expect(document.querySelector('.ig-change')).toHaveClass('is-return')
    expect(screen.getByText('Vuelto', { selector: '.ig-change .k' })).toBeInTheDocument()
    expect(screen.getByText('$ 19.000,00')).toBeInTheDocument()
    expect(approveButton()).toBeEnabled()
  })

  it('pago combinado: efectivo parcial y la etiqueta TRANSFERENCIA completa lo que falta', async () => {
    catalog[CODE] = makeProduct({ ...coca, salePrice: '1500' })
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    expect(screen.getByText('Falta cubrir $ 500,00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Autocompletar TRANSFERENCIA' }))
    expect((screen.getByRole('textbox', { name: 'TRANSFERENCIA' }) as HTMLInputElement).value).toBe('500,00')
    expect(document.querySelector('.ig-change')).toHaveClass('is-exact')
  })

  it('un descuento del 10% recalcula el TOTAL', async () => {
    renderSells()
    await addCoca()
    const discount = screen.getByLabelText('Descuento')
    fireEvent.change(discount, { target: { value: '10' } })
    fireEvent.blur(discount)
    expect(screen.getByText('$ 900,00', { selector: '.ig-pay-total .v' })).toBeInTheDocument()
  })

  it('un descuento negativo cambia el rótulo a "Recargo" y suma al total', async () => {
    renderSells()
    await addCoca()
    const discount = screen.getByLabelText('Descuento')
    fireEvent.change(discount, { target: { value: '-10' } })
    fireEvent.blur(discount)
    expect(screen.getByText('Recargo', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('$ 1.100,00', { selector: '.ig-pay-total .v' })).toBeInTheDocument()
  })
})

describe('Sells — aprobar venta', () => {
  it('createSale recibe items, pagos (solo > 0, numéricos), total y discountPct; después todo se limpia', async () => {
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    fireEvent.click(approveButton())

    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    const arg = createSale.mock.calls[0][0] as CreateSalePayload
    expect(arg.items).toEqual([{ productId: 7, quantity: 1, unitPrice: '1000' }])
    expect(arg.payments).toEqual([{ method: 'CASH', amount: 1000 }])
    expect(arg.total).toBe(1000)
    expect(arg.discountPct).toBe(0)

    // Éxito: carrito vacío, sin panel, foco en el input de código y sin ningún toast.
    expect(await screen.findByText('Escaneá un producto para empezar')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cantidad de Coca 2L')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Pago' })).toBeNull()
    await waitFor(() => expect(barcodeInput()).toHaveFocus())
    expect(document.querySelector('.ig-toast')).toBeNull()
  })

  it('con descuento del 10% envía discountPct=10 y el total con descuento', async () => {
    renderSells()
    await addCoca()
    const discount = screen.getByLabelText('Descuento')
    fireEvent.change(discount, { target: { value: '10' } })
    fireEvent.blur(discount)
    fireEvent.change(cashInput(), { target: { value: '900' } })
    fireEvent.click(approveButton())
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    const arg = createSale.mock.calls[0][0] as CreateSalePayload
    expect(arg.discountPct).toBe(10)
    expect(arg.total).toBeCloseTo(900, 2)
  })

  it('pago combinado envía dos pagos en el orden de los medios', async () => {
    renderSells()
    await addCoca()
    fireEvent.change(screen.getByRole('textbox', { name: 'TRANSFERENCIA' }), { target: { value: '400' } })
    fireEvent.change(cashInput(), { target: { value: '600' } })
    fireEvent.click(approveButton())
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    expect((createSale.mock.calls[0][0] as CreateSalePayload).payments).toEqual([
      { method: 'CASH', amount: 600 },
      { method: 'TRANSFER', amount: 400 }
    ])
  })

  it('un pago con montos formateados es-AR ("1.000,00") se envía como número', async () => {
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1.000,00' } })
    fireEvent.click(approveButton())
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    expect((createSale.mock.calls[0][0] as CreateSalePayload).payments).toEqual([{ method: 'CASH', amount: 1000 }])
  })

  it('pagar de más envía lo ingresado (el vuelto se devuelve en mano)', async () => {
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1500' } })
    fireEvent.click(approveButton())
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    expect((createSale.mock.calls[0][0] as CreateSalePayload).payments).toEqual([{ method: 'CASH', amount: 1500 }])
  })

  it('si createSale falla: toast de error y el carrito SIGUE con la línea', async () => {
    createSale.mockRejectedValueOnce(new Error('boom'))
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    fireEvent.click(approveButton())
    expect(await screen.findByText('No se pudo guardar la venta. Probá de nuevo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad de Coca 2L')).toBeInTheDocument()
    expect(cashInput().value).toBe('1000')
  })

  it('mientras guarda, el botón dice "Guardando…" y no se puede aprobar dos veces', async () => {
    createSale.mockReturnValue(new Promise(() => {}))
    renderSells()
    await addCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    fireEvent.click(approveButton())
    const busy = await screen.findByRole('button', { name: 'Guardando…' })
    expect(busy).toBeDisabled()
    fireEvent.keyDown(window, { key: 'F12' })
    expect(createSale).toHaveBeenCalledTimes(1)
  })

  it('una línea General (F10, 850,50) se puede aprobar: viaja sin productId', async () => {
    renderSells()
    fireEvent.keyDown(window, { key: 'F10' })
    const amount = await screen.findByLabelText('Monto')
    fireEvent.change(amount, { target: { value: '850,50' } })
    fireEvent.keyDown(amount, { key: 'Enter' })

    expect(await screen.findByLabelText('Precio unitario de General')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Autocompletar EFECTIVO' }))
    expect(approveButton()).toBeEnabled()
    expect(screen.queryByText(/aún no se pueden guardar/)).toBeNull()

    fireEvent.click(approveButton())
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    expect((createSale.mock.calls[0][0] as CreateSalePayload).items).toEqual([{ quantity: 1, unitPrice: '850.5' }])
  })
})

describe('Sells — persistencia (D6)', () => {
  it('el carrito sobrevive a desmontar y volver a montar la pantalla', async () => {
    function Harness() {
      const [visible, setVisible] = useState(true)
      return (
        <>
          <button onClick={() => setVisible((v) => !v)}>ir y volver</button>
          {visible && <Sells viewSwitcher={null} />}
        </>
      )
    }
    render(
      <ToastProvider>
        <SalesProvider>
          <Harness />
        </SalesProvider>
      </ToastProvider>
    )
    await addCoca()
    fireEvent.click(screen.getByText('ir y volver'))
    expect(screen.queryByLabelText('Cantidad de Coca 2L')).toBeNull()
    fireEvent.click(screen.getByText('ir y volver'))
    expect(screen.getByLabelText('Cantidad de Coca 2L')).toBeInTheDocument()
  })
})
