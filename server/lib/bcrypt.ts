import bcrypt from 'bcryptjs'

async function hash (myPlaintextPassword: string, saltRounds: number) {
  return await bcrypt.hash(myPlaintextPassword, saltRounds)
}

async function compare (data: string, hash: string) {
  if (!hash) return false
  return await bcrypt.compare(data, hash)
}

function isLegacy (hashStr: string) {
  return typeof hashStr === 'string' && hashStr.startsWith('$2')
}

export default {
  hash,
  compare,
  isLegacy,
}
