import fs from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(
  fs.readFileSync(
    new URL('../content/curriculum/entry08-provenance.json', import.meta.url),
    'utf8',
  ),
);
for (const file of manifest.files) {
  const bytes = fs.readFileSync(new URL('../' + file.path, import.meta.url));
  if (
    bytes.length !== file.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== file.sha256
  )
    throw Error('ENTRY_SUPPLY_MISMATCH: ' + file.path);
}
console.log('PASS entry08 supplied controller and bank: SHA256/bytes');
