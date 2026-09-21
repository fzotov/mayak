export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const resp = await fetch('https://o.mayak-d.ru/export/debts.xml', {
      headers: { 'X-Auth-Token': 'a9e385805eed6e3eab2e74547766c62d696f072dd7baef44cb110fb0a29e9957' }
    })
    if (!resp.ok) return res.status(502).json({ ok: false, error: 'Upstream error ' + resp.status })
    const xml = await resp.text()

    // Parse XML manually (no DOM in edge functions)
    const attr = (str, name) => { const m = str.match(new RegExp(`${name}="([^"]*)"`, 'i')); return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '' }

    const counterparties = []
    const cpBlocks = xml.split('<Counterparty ').slice(1)

    for (const block of cpBlocks) {
      const cpTag = block.split('>')[0]
      const cp = {
        id: attr(cpTag, 'id'),
        name: attr(cpTag, 'name'),
        inn: attr(cpTag, 'inn'),
        kpp: attr(cpTag, 'kpp'),
        debt: parseFloat(attr(cpTag, 'debt') || '0'),
        advance: parseFloat(attr(cpTag, 'advance') || '0'),
        contracts: [],
        operations: [],
      }

      // Parse contracts
      const contractBlocks = block.split('<Contract ').slice(1)
      for (const cb of contractBlocks) {
        const ctTag = cb.split('>')[0]
        const contract = {
          id: attr(ctTag, 'id'),
          name: attr(ctTag, 'name'),
          debt: parseFloat(attr(ctTag, 'debt') || '0'),
          advance: parseFloat(attr(ctTag, 'advance') || '0'),
          docs: [],
        }
        const docBlocks = cb.split('<Doc ').slice(1)
        for (const db of docBlocks) {
          const dtTag = db.split('/>')[0].split('>')[0]
          if (!attr(dtTag, 'id')) continue
          contract.docs.push({
            id: attr(dtTag, 'id'),
            type: attr(dtTag, 'type'),
            number: attr(dtTag, 'number'),
            date: attr(dtTag, 'date'),
            debt: parseFloat(attr(dtTag, 'debt') || '0'),
            advance: parseFloat(attr(dtTag, 'advance') || '0'),
          })
        }
        cp.contracts.push(contract)
      }

      // Parse operations
      const opBlocks = block.split('<Op ').slice(1)
      for (const ob of opBlocks) {
        const opTag = ob.split('/>')[0].split('>')[0]
        if (!attr(opTag, 'id')) continue
        cp.operations.push({
          id: attr(opTag, 'id'),
          kind: attr(opTag, 'kind'), // charge / payment / mixed
          type: attr(opTag, 'type'),
          number: attr(opTag, 'number'),
          date: attr(opTag, 'date'),
          contractId: attr(opTag, 'contractId'),
          charged: parseFloat(attr(opTag, 'charged') || '0'),
          paid: parseFloat(attr(opTag, 'paid') || '0'),
        })
      }

      counterparties.push(cp)
    }

    // Meta from root
    const metaM = xml.match(/<Debts([^>]*)>/)
    const meta = metaM ? {
      generated: attr(metaM[1], 'generated'),
      asOf: attr(metaM[1], 'asOf'),
      org: attr(metaM[1], 'org'),
      orgInn: attr(metaM[1], 'orgInn'),
    } : {}

    res.status(200).json({ ok: true, meta, counterparties })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
