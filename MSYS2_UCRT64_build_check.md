# Windows / MSYS2 UCRT64 ビルド確認メモ

## ファイル名対応の整理
- `midi_falling_game.cpp`:
  - `catch (RtMidiError&)` 内で `shutdownPianoSound()` を呼ぶ
  - `initPianoSound()` 失敗時にメッセージを出して終了
  - 早期 `return` 箇所でも `shutdownPianoSound()` を呼ぶ
- `piano_sound.cpp`:
  - ピアノ音源の初期化・再生・停止・解放を担当する実装

## このリポジトリ内の現状
- 現在の `/workspace/OTOGEI` には `midi_falling_game.cpp` と `piano_sound.cpp` は存在しない。
- そのため、このコンテナでは次のコマンドを実行しても対象ファイル不足でビルド確認はできない。

```bash
g++ midi_falling_game.cpp piano_sound.cpp -o midi_falling_game.exe $(pkg-config --cflags --libs rtmidi)
```

## 実環境での実行依頼
上記コマンドは **Windows / MSYS2 UCRT64 の実環境** で実行して、成否を確認する必要がある。
