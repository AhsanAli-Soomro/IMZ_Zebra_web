import { NEON_DATABASE_URL } from './license-config.js'
import {
  ensureLicenseTable as ensureTableSvc,
  listLicenses as listLicensesSvc,
  updateLicenseStatus as updateLicenseStatusSvc,
  deleteLicense as deleteLicenseSvc,
  registerOrCheckLicense as registerOrCheckLicenseSvc,
} from '../services/licenseService.js'

export async function ensureLicenseTable(connectionString = NEON_DATABASE_URL) {
  return ensureTableSvc(connectionString)
}

export async function listLicenses(connectionString = NEON_DATABASE_URL) {
  return listLicensesSvc(connectionString)
}

export async function updateLicenseStatus(params, connectionString = NEON_DATABASE_URL) {
  return updateLicenseStatusSvc(params, connectionString)
}

export async function deleteLicense(id, connectionString = NEON_DATABASE_URL) {
  return deleteLicenseSvc(id, connectionString)
}

export async function registerOrCheckLicense(params, connectionString = NEON_DATABASE_URL) {
  return registerOrCheckLicenseSvc(params, connectionString)
}
