export const csdTemplate = `
<CsoundSynthesizer>
<CsOptions>
-odac -m0
</CsOptions>
<CsInstruments>
{{orc-defines}}
{{instruments}}
</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>`;


export const orcDefines = `
sr = 48000
ksmps = 64 // sr/kr
nchnls = 2
0dbfs = 1

gkMouseX init 0
gkMouseY init 0

instr 999
  gkMouseX = p4
  gkMouseY = p5
endin
`;


export const initialUserCode = `gisine ftgen 1, 0, 1024, 10, 1
;giSample ftgen 2, 0, 0, 1, "kick1.aiff", 0, 4, 1

gkTempo init 60

schedule 1, 0, 1
;schedule "clock", 0, -1

instr clock
  kfreq = (gkTempo / 60) * 4
  ktrig metro kfreq
  kcount init 0
  if ktrig == 1 then
    schedulek "onFourth", 0, .1, kcount
    kcount += 1
  endif
endin

instr onFourth
  icount = p4
  if icount % 1 == 0 then
    schedule 1, 0, 0.1
  endif
endin

instr 1
  aSin oscili 0.25, 440, 1
  out aSin
endin
`;

/*

gisine ftgen 1, 0, 4096, 10, 1
gkAmp init 0.15
giCarrierFreqMin = 200
giCarrierFreqMax = 5000
giModFreqMin = 1
giModFreqMax = 2000

schedule 1, 0, 0

// Maps kVal from [0, 1] exponentially to [iMin, iMax]
opcode expmap, k, kii
  kVal, iMin, iMax xin
  kRes = exp(kVal*(log(iMax)-log(iMin))+log(iMin))
  xout kRes
endop

instr 1

  kCarrierFreq init 500
  kModFreq init 400
  kModAmp init 400

  kModFreq = expmap(gkMouseX, giModFreqMin, giModFreqMax)
  kCarrierFreq = expmap(gkMouseY, giCarrierFreqMin, giCarrierFreqMax)

  kTrig metro 8
  if kTrig == 1 then
    kModAmp random 20, 10000
  endif

  printks "CF: %f  MF: %f  MA: %f\n", 0.5, kCarrierFreq, kModFreq, kModAmp

  aMod poscil kModAmp, kModFreq
  aCarr poscil gkAmp, kCarrierFreq + aMod
  aRes = aCarr
  outall aRes
endin

 */