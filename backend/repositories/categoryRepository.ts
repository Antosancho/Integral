import prisma from "../db/client"
import { normalizeRequiredString } from "./utilities"

export interface CreateCategoryInput {
  name: string
}

export interface UpdateCategoryInput {
  name?: string
}

// Creates a new category with normalized name.
export async function createCategory(data: CreateCategoryInput) {
  return prisma.category.create({
    data: {
      name: normalizeRequiredString(data.name, "name")
    }
  })
}

// Returns all categories sorted alphabetically.
export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" }
  })
}

// Reads one category by primary key.
export async function getCategoryById(id: number) {
  return prisma.category.findUnique({
    where: { id }
  })
}

// Updates mutable category fields.
export async function updateCategory(id: number, data: UpdateCategoryInput) {
  const updateData = {
    ...(data.name !== undefined
      ? { name: normalizeRequiredString(data.name, "name") }
      : {})
  }

  return prisma.category.update({
    where: { id },
    data: updateData
  })
}

// Deletes a category by id.
export async function deleteCategory(id: number) {
  return prisma.category.delete({
    where: { id }
  })
}
