gisine ftgen 1, 0, 4096, 10, 1

gkTempo init 60
giAmp init 0.3
giDur init 0.4
gkBaseHz init 110
gkIndex init 2
gkRatio init 4

// Table 10: generate now; 8 items; no norm;
giIndexes ftgen 10, 0, -8, -2,    1, 1, 1, 1, 1, 1, 1, 1
// Table 11: generate now; 8 items; no norm;
giRatios ftgen 11, 0, -8, -2,     1, 1, 1, 1, 1, 1, 1, 1

/*

// dur, ratio, index, amp
schedule "fmstandard", 0, 0.5, gkBaseHz, 2, 7, 0.3

schedule "clock", 0, -1

// noteId, indexValue
schedule "setIndex", 0, 0.1, 0, 2

// noteId, indexValue
schedule "setRatio", 0, 0.1, 0, 6

*/


instr clock
  kfreq = (gkTempo / 60) * 4
  ktrig metro kfreq
  kNoteIx init 0
  if ktrig == 1 then
    schedulek "onNote", 0, .1, kNoteIx
    kNoteIx += 1
    chnset kNoteIx, "noteIx"
  endif
endin

instr onNote
  icount = p4
  inoteid = icount % 8
  if icount % 1 == 0 then
    iIndex table inoteid, 10
    iRatio table inoteid, 11
    schedule "fmstandard", 0, giDur, gkBaseHz, iRatio, iIndex, giAmp
  endif
endin

instr fmstandard
  iCarHz = p4
  iRatio = p5
  iIndex = p6
  iAmp = p7
  iMod = iCarHz / iRatio
  aEnv linseg 0, 0.01, iAmp, p3 - 0.01, 0
  aModulator oscili iIndex * iMod, iMod, 1
  aCarrier oscili aEnv, iCarHz + aModulator, 1
  aRes = aCarrier
  outall aRes
endin

instr setIndex
  iNoteId = p4
  iIndexVal = p5
  tablew iIndexVal, iNoteId, 10
endin

instr setRatio
  iNoteId = p4
  iRatioVal = p5
  tablew iRatioVal, iNoteId, 11
endin


