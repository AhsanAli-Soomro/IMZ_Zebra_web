'use client'

import PartyLedger from './PartyLedger'

export default function CustomerKhata({ customerId }) {
  return <PartyLedger type="customer" initialPartyId={customerId} />
}
