"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = createCategory;
exports.listCategories = listCategories;
exports.getCategoryById = getCategoryById;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const client_1 = __importDefault(require("../db/client"));
const utilities_1 = require("./utilities");
// Creates a new category with normalized name.
async function createCategory(data) {
    return client_1.default.category.create({
        data: {
            name: (0, utilities_1.normalizeRequiredString)(data.name, "name")
        }
    });
}
// Returns all categories sorted alphabetically.
async function listCategories() {
    return client_1.default.category.findMany({
        orderBy: { name: "asc" }
    });
}
// Reads one category by primary key.
async function getCategoryById(id) {
    return client_1.default.category.findUnique({
        where: { id }
    });
}
// Updates mutable category fields.
async function updateCategory(id, data) {
    const updateData = {
        ...(data.name !== undefined
            ? { name: (0, utilities_1.normalizeRequiredString)(data.name, "name") }
            : {})
    };
    return client_1.default.category.update({
        where: { id },
        data: updateData
    });
}
// Deletes a category by id.
async function deleteCategory(id) {
    return client_1.default.category.delete({
        where: { id }
    });
}
//# sourceMappingURL=categoryRepository.js.map