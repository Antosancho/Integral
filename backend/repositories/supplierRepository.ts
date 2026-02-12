import prisma from "../db/client"
import { normalizeOptionalString, normalizeRequiredString } from "./utilities"

export interface CreateSupplierInput {
  name: string
  phone?: string | null
  notes?: string | null
}

export interface UpdateSupplierInput {
  name?: string
  phone?: string | null
  notes?: string | null
}

// Creates a supplier and normalizes optional text fields.
export async function createSupplier(data: CreateSupplierInput) {
  return prisma.supplier.create({
    data: {
      name: normalizeRequiredString(data.name, "name"),
      phone: normalizeOptionalString(data.phone),
      notes: normalizeOptionalString(data.notes)
    }
  })
}

// Returns all suppliers sorted by name.
export async function listSuppliers() {
  return prisma.supplier.findMany({
    orderBy: { name: "asc" }
  })
}

// Reads one supplier by primary key.
export async function getSupplierById(id: number) {
  return prisma.supplier.findUnique({
    where: { id }
  })
}

// Updates selected supplier fields.
export async function updateSupplier(id: number, data: UpdateSupplierInput) {
  const updateData = {
    ...(data.name !== undefined
      ? { name: normalizeRequiredString(data.name, "name") }
      : {}),
    ...(data.phone !== undefined ? { phone: normalizeOptionalString(data.phone) } : {}),
    ...(data.notes !== undefined ? { notes: normalizeOptionalString(data.notes) } : {})
  }

  return prisma.supplier.update({
    where: { id },
    data: updateData
  })
}

// Deletes a supplier by id.
export async function deleteSupplier(id: number) {
  return prisma.supplier.delete({
    where: { id }
  })
}
