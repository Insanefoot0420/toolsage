const express = require('express')
const crypto = require('crypto')
const router = express.Router({ mergeParams: true })
const { supabaseAdmin } = require('../db')
const db = () => supabaseAdmin

const ALGORITHM = 'aes-256-gcm'
function getEncryptionKey() {
  const key = process.env.VAULT_ENCRYPTION_KEY
  if (key) return Buffer.from(key, 'hex')
  // Fallback: generate from a known string (NOT secure, but works without setup)
  return crypto.createHash('sha256').update('toolsage-vault-key-2026').digest()
}
function encrypt(text) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag })
}
function decrypt(encoded) {
  try {
    const { iv, encrypted, authTag } = JSON.parse(encoded)
    const key = getEncryptionKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch { return null }
}

// GET /tools/:id/secrets - list secret keys (values masked)
router.get('/', async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await db().from('tool_secrets').select('id, key_name, created_at').eq('tool_id', id)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /tools/:id/secrets - store a secret
router.post('/', async (req, res) => {
  try {
    const { id } = req.params
    const { key_name, value } = req.body
    if (!key_name || !value) return res.status(400).json({ error: 'key_name a value jsou povinné' })
    const encrypted = encrypt(value)
    const { data, error } = await db().from('tool_secrets').upsert({
      tool_id: id, key_name, encrypted_value: encrypted
    }).select().single()
    if (error) throw error
    res.status(201).json({ id: data.id, key_name: data.key_name, created_at: data.created_at })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /tools/:id/secrets/:keyName
router.delete('/:keyName', async (req, res) => {
  try {
    const { id, keyName } = req.params
    const { error } = await db().from('tool_secrets').delete().eq('tool_id', id).eq('key_name', keyName)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /tools/:id/secrets/use - AI používá secret (dešifruje, nevrací do chatu)
router.post('/use', async (req, res) => {
  try {
    const tool_id = req.params.id
    const { key_name } = req.body
    if (!tool_id || !key_name) return res.status(400).json({ error: 'tool_id a key_name jsou povinné' })
    const { data, error } = await db().from('tool_secrets').select('key_name, encrypted_value').eq('tool_id', tool_id).eq('key_name', key_name).single()
    if (error || !data) return res.status(404).json({ error: 'Secret nenalezen' })
    const decrypted = decrypt(data.encrypted_value)
    if (!decrypted) return res.status(500).json({ error: 'Nepodařilo se dešifrovat' })
    res.json({ key_name: data.key_name, value: decrypted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router