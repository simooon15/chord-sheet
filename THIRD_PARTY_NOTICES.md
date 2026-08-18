# Third-party notices

## `@tombatossals/chords-db`

ChordSheet's built-in standard-tuning guitar-voicing catalogue is derived from `@tombatossals/chords-db` v0.6.0. The catalogue is licensed under the MIT License and is available at https://github.com/tombatossals/chords-db.

The application stores a compact transformation of its 828 chord entries and 3,283 positions in `src/data/guitar-voicings.json`. It does not copy the database into user `.chordsheet` packages.

## ChordPro standard guitar common-order index

`src/data/chordpro-common-voicing-order.json` is derived from ChordPro v6.101, tag `R6.101.0`, commit `4b25408d830bd3f4c53fc6fb544b2babe4da09e1`, using `lib/ChordPro/res/config/guitar.json` from https://github.com/ChordPro/chordpro. ChordPro is licensed under the Artistic License 2.0.

The file records only the 240 standard-tuning chord keys whose ChordPro shape exactly matches an existing `@tombatossals/chords-db` position, plus that existing position's index. It contains no ChordPro fret, finger, or barre data and is used only to order the four common candidates shown offline. It does not change the MIT licence or provenance of the main catalogue.
