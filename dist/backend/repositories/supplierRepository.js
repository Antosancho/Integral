"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupplier = createSupplier;
exports.listSuppliers = listSuppliers;
exports.getSupplierById = getSupplierById;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
const client_1 = __importDefault(require("../db/client"));
const utilities_1 = require("./utilities");
// Creates a supplier and normalizes optional text fields.
async function createSupplier(data) {
    return client_1.default.supplier.create({
        data: {
            name: (0, utilities_1.normalizeRequiredString)(data.name, "name"),
            phone: (0, utilities_1.normalizeOptionalString)(data.phone),
            notes: (0, utilities_1.normalizeOptionalString)(data.notes)
        }
    });
}
// Returns all suppliers sorted by name.
async function listSuppliers() {
    return client_1.default.supplier.findMany({
        orderBy: { name: "asc" }
    });
}
// Reads one supplier by primary key.
async function getSupplierById(id) {
    return client_1.default.supplier.findUnique({
        where: { id }
    });
}
// Updates selected supplier fields.
async function updateSupplier(id, data) {
    const updateData = {
        ...(data.name !== undefined
            ? { name: (0, utilities_1.normalizeRequiredString)(data.name, "name") }
            : {}),
        ...(data.phone !== undefined ? { phone: (0, utilities_1.normalizeOptionalString)(data.phone) } : {}),
        ...(data.notes !== undefined ? { notes: (0, utilities_1.normalizeOptionalString)(data.notes) } : {})
    };
    return client_1.default.supplier.update({
        where: { id },
        data: updateData
    });
}
// Deletes a supplier by id.
async function deleteSupplier(id) {
    return client_1.default.supplier.delete({
        where: { id }
    });
}
//# sourceMappingURL=supplierRepository.js.map