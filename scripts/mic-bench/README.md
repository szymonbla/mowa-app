# mic-bench

`drive-recorder.cjs` steruje zbudowanym oknem recordera (`out/`) przez te same
kanaly IPC co proces glowny i mierzy, ile mija od `record:start` do `record:live`,
czyli do pierwszej nagranej probki.

```bash
npm run build
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/mic-bench/drive-recorder.cjs
```

Pierwsza runda idzie na zimny mikrofon, kolejne mieszcza sie w `MIC_WARM_MS`,
wiec trafiaja na cieply. Porownanie `liveMs` miedzy runda 1 a 2 jest miara tego,
ile daje trzymanie strumienia otwartego.

Uwaga przy czytaniu wynikow: gdy proces nie ma zgody TCC na mikrofon, macOS
oddaje strumien ciszy, a czasy otwarcia sa wtedy zanizone i jednakowe dla
wszystkich urzadzen. `durationMs` z rundy pokazuje, ile audio naprawde wpadlo.
