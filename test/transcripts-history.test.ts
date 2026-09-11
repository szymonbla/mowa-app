import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { deleteEntry, parseEntries, readEntries, withoutEntry } from '../src/main/transcripts.js'

/** Odczyt logu do panelu historii. Format pliku jest ten sam, co przy zapisie. */

const OPEN_1 =
  '{"id":"a","t":"2026-08-07T12:00:00.000Z","lang":"pl","words":2,"speechMs":1000,"raw":"dzien dobry"}'
const CLOSE_1 = '{"id":"a","clean":"Dzień dobry.","outcome":"corrected","cleanupMs":300}'
const OPEN_2 =
  '{"id":"b","t":"2026-08-07T12:01:00.000Z","lang":"pl","words":1,"speechMs":500,"raw":"czesc"}'
const CLOSE_2 = '{"id":"b","clean":"","outcome":"skip:nothing","cleanupMs":0}'

suite('parseEntries — laczenie linii w wpisy', () => {
  it('laczy linie otwarcia i domkniecia po id, w kolejnosci pliku', () => {
    const entries = parseEntries(`${OPEN_1}\n${CLOSE_1}\n${OPEN_2}\n${CLOSE_2}\n`)
    expect(entries.map((e) => e.open.id)).toEqual(['a', 'b'])
    expect(entries[0].open.raw).toBe('dzien dobry')
    expect(entries[0].close?.clean).toBe('Dzień dobry.')
    expect(entries[1].close?.outcome).toBe('skip:nothing')
  })

  it('zostawia wpis bez domkniecia, gdy korekta jeszcze trwa albo proces padl', () => {
    const entries = parseEntries(`${OPEN_1}\n${CLOSE_1}\n${OPEN_2}\n`)
    expect(entries).toHaveLength(2)
    expect(entries[1].open.id).toBe('b')
    expect(entries[1].close).toBeNull()
  })

  it('pomija zepsuta linie w srodku, nie gubiac reszty', () => {
    // Urwany zapis (np. brak miejsca na dysku) nie moze zaslonic calej historii.
    const entries = parseEntries(`${OPEN_1}\n{"id":"x","t":"2026\n${CLOSE_1}\n${OPEN_2}\n`)
    expect(entries.map((e) => e.open.id)).toEqual(['a', 'b'])
    expect(entries[0].close?.clean).toBe('Dzień dobry.')
  })

  it('ignoruje domkniecie bez otwarcia i puste linie', () => {
    const entries = parseEntries(`\n${CLOSE_2}\n\n${OPEN_1}\n`)
    expect(entries.map((e) => e.open.id)).toEqual(['a'])
  })
})

suite('withoutEntry — usuniecie jednego wpisu z tekstu logu', () => {
  it('wycina obie linie wpisu i zostawia reszte bajt w bajt', () => {
    const text = `${OPEN_1}\n${CLOSE_1}\n${OPEN_2}\n${CLOSE_2}\n`
    expect(withoutEntry(text, 'a')).toBe(`${OPEN_2}\n${CLOSE_2}\n`)
  })

  it('nie rusza linii, ktorych nie umie sparsowac', () => {
    const text = `${OPEN_1}\nzepsute\n${CLOSE_1}\n`
    expect(withoutEntry(text, 'a')).toBe('zepsute\n')
  })

  it('zwraca tekst bez zmian, gdy id nie ma', () => {
    const text = `${OPEN_1}\n${CLOSE_1}\n`
    expect(withoutEntry(text, 'zzz')).toBe(text)
  })
})

suite('readEntries / deleteEntry — na prawdziwym pliku', () => {
  async function tempLog(text: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'mowa-log-'))
    const path = join(dir, 'transkrypty.jsonl')
    await writeFile(path, text, { mode: 0o600 })
    return path
  }

  it('readEntries zwraca najnowsze najpierw i tnie do limitu', async () => {
    const path = await tempLog(`${OPEN_1}\n${CLOSE_1}\n${OPEN_2}\n${CLOSE_2}\n`)
    const all = await readEntries(200, path)
    expect(all.map((e) => e.open.id)).toEqual(['b', 'a'])
    const one = await readEntries(1, path)
    expect(one.map((e) => e.open.id)).toEqual(['b'])
  })

  it('readEntries zwraca pusta liste, gdy pliku nie ma', async () => {
    const entries = await readEntries(200, join(tmpdir(), 'mowa-nie-ma', 'x.jsonl'))
    expect(entries).toEqual([])
  })

  it('deleteEntry przepisuje plik bez wpisu i zostawia tryb 0600', async () => {
    const path = await tempLog(`${OPEN_1}\n${CLOSE_1}\n${OPEN_2}\n${CLOSE_2}\n`)
    await deleteEntry('a', path)
    expect(await readFile(path, 'utf8')).toBe(`${OPEN_2}\n${CLOSE_2}\n`)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await readEntries(200, path)).map((e) => e.open.id)).toEqual(['b'])
  })

  it('deleteEntry nie tworzy pliku, gdy go nie ma', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'mowa-log-')), 'brak.jsonl')
    await deleteEntry('a', path)
    await expect(stat(path)).rejects.toThrow()
  })
})
