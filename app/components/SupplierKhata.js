'use client'

import PartyLedger from './PartyLedger'

export default function SupplierKhata({ supplierId }) {
  return <PartyLedger type="supplier" initialPartyId={supplierId} />
}
