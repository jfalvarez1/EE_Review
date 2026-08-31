/**
 * Exercise Definitions - Analog Design Refresher Course
 * ~100 problems across 8 sets with 4 difficulty levels
 * Mix of numeric (tolerance-based) and multiple choice
 */

const EXERCISES = {
    // ========== SET A: Transistor Biasing ==========
    setA: {
        title: 'Transistor Biasing',
        levels: {
            1: [ // Easy
                {
                    id: 'A1-1',
                    type: 'numeric',
                    question: 'A 2N3904 BJT has IC = 1mA. Calculate the transconductance gm.',
                    hint: 'gm = IC / VT, where VT = 26mV at room temperature',
                    expected: 0.0385, // 38.5 mS
                    tolerance: 0.05,
                    unit: 'S',
                    solution: 'gm = IC/VT = 1mA / 26mV = 38.5 mS',
                    explanation: 'At room temperature, VT = kT/q ≈ 26mV. The transconductance relates small changes in VBE to changes in IC.'
                },
                {
                    id: 'A1-2',
                    type: 'numeric',
                    question: 'Calculate the intrinsic emitter resistance re for IC = 2mA.',
                    hint: 're = VT / IC = 26mV / IC(mA), or approximately 25/IC(mA) ohms',
                    expected: 13, // ohms
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 're = 26mV / 2mA = 13Ω (or ~25/2 = 12.5Ω using approximation)',
                    explanation: 're is the small-signal resistance looking into the emitter. It\'s the reciprocal of gm.'
                },
                {
                    id: 'A1-3',
                    type: 'choice',
                    question: 'What is the typical VBE for a silicon BJT in the active region?',
                    choices: [
                        { text: '0.3V', correct: false, explanation: 'This is typical for Schottky diodes' },
                        { text: '0.6-0.7V', correct: true, explanation: 'Silicon BJTs have VBE ≈ 0.6-0.7V in the active region' },
                        { text: '1.2V', correct: false, explanation: 'This would be two diode drops in series' },
                        { text: '2.0V', correct: false, explanation: 'This is too high for a single junction' }
                    ]
                }
            ],
            2: [ // Medium
                {
                    id: 'A2-1',
                    type: 'numeric',
                    question: 'Design a common-emitter amplifier: VCC=12V, IC=2mA, gain=-20. What is RC?',
                    hint: 'For VC = VCC/2, use RC = VCC/(2×IC). Check that this gives adequate gain.',
                    expected: 3000, // 3kΩ
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 'For VC = VCC/2 = 6V: RC = 6V/2mA = 3kΩ',
                    explanation: 'Setting VC at VCC/2 provides maximum output swing before clipping.'
                },
                {
                    id: 'A2-2',
                    type: 'numeric',
                    question: 'For the CE amplifier above (IC=2mA, gain=-20), calculate RE (ignoring re).',
                    hint: 'Gain = -RC/RE when RE >> re',
                    expected: 150, // ohms
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 'RE = RC/|Gain| = 3000/20 = 150Ω',
                    explanation: 'This assumes RE >> re. With re = 13Ω, actual gain will be -RC/(RE+re) = -3000/163 ≈ -18.4'
                },
                {
                    id: 'A2-3',
                    type: 'choice',
                    question: 'Why should you NEVER design circuits that depend on a specific β value?',
                    choices: [
                        { text: 'β varies with temperature, IC, VCE, and unit-to-unit', correct: true, explanation: 'Correct! β can vary from 50 to 500 even for the same part number.' },
                        { text: 'β is always exactly 100', correct: false, explanation: 'β is never a fixed value - it varies significantly.' },
                        { text: 'β only affects pnp transistors', correct: false, explanation: 'β affects both npn and pnp transistors.' },
                        { text: 'β is not listed in datasheets', correct: false, explanation: 'Datasheets do list β (hFE), but as a range, not a single value.' }
                    ]
                }
            ],
            3: [ // Hard
                {
                    id: 'A3-1',
                    type: 'numeric',
                    question: 'A BJT has VBE = 0.65V at 25°C. What is VBE at 85°C? (Use -2.1mV/°C tempco)',
                    hint: 'ΔVBE = tempco × ΔT',
                    expected: 0.524, // volts
                    tolerance: 0.02,
                    unit: 'V',
                    solution: 'ΔVBE = -2.1mV/°C × (85-25)°C = -126mV. VBE(85°C) = 0.65V - 0.126V = 0.524V',
                    explanation: 'The negative tempco means VBE decreases as temperature increases.'
                },
                {
                    id: 'A3-2',
                    type: 'numeric',
                    question: 'If VBE increases by 60mV, by what factor does IC change? (Hint: 60mV = VT×ln(10))',
                    hint: 'IC = IS × exp(VBE/VT), so a change of VT×ln(10) multiplies IC by 10',
                    expected: 10,
                    tolerance: 0.1,
                    unit: '×',
                    solution: 'ΔIC/IC = exp(ΔVBE/VT). For ΔVBE = 60mV = 2.3×26mV: IC multiplies by e^2.3 ≈ 10',
                    explanation: 'This is the "60mV/decade" rule: 60mV change in VBE changes IC by 10×.'
                }
            ],
            4: [ // Expert
                {
                    id: 'A4-1',
                    type: 'numeric',
                    question: 'A differential pair has tail current 2mA. One transistor is 10°C hotter. Calculate the offset voltage.',
                    hint: 'Use VBE tempco of -2.1mV/°C',
                    expected: 21, // mV
                    tolerance: 0.1,
                    unit: 'mV',
                    solution: 'Vos = 10°C × 2.1mV/°C = 21mV',
                    explanation: 'Temperature mismatch between transistors creates an offset that appears as input-referred error.'
                },
                {
                    id: 'A4-2',
                    type: 'numeric',
                    question: 'Early effect: BJT has VA = 100V, operating at VCE = 5V, IC = 1mA. What is the output resistance ro?',
                    hint: 'ro = (VA + VCE) / IC',
                    expected: 105,
                    tolerance: 0.05,
                    unit: 'kΩ',
                    solution: 'ro = (100V + 5V) / 1mA = 105kΩ',
                    explanation: 'The Early effect limits the output impedance of BJT current sources.'
                },
                {
                    id: 'A4-3',
                    type: 'choice',
                    question: 'Which BJT region has the highest fT (transition frequency)?',
                    choices: [
                        { text: 'Cutoff', correct: false, explanation: 'In cutoff, there is no transistor action.' },
                        { text: 'Deep saturation', correct: false, explanation: 'In saturation, stored charge slows transitions.' },
                        { text: 'Active region at moderate IC', correct: true, explanation: 'Correct! fT peaks at moderate IC, dropping at both low IC (low gm) and high IC (base crowding).' },
                        { text: 'Breakdown region', correct: false, explanation: 'Breakdown damages the device.' }
                    ]
                }
            ]
        }
    },

    // ========== SET B: Op-Amp Circuits ==========
    setB: {
        title: 'Op-Amp Circuits',
        levels: {
            1: [
                {
                    id: 'B1-1',
                    type: 'numeric',
                    question: 'Inverting amplifier with Rf=100kΩ, R1=10kΩ. What is the gain?',
                    hint: 'Inverting gain = -Rf/R1',
                    expected: -10,
                    tolerance: 0.01,
                    unit: 'V/V',
                    solution: 'Gain = -Rf/R1 = -100k/10k = -10',
                    explanation: 'The negative sign indicates phase inversion (180°).'
                },
                {
                    id: 'B1-2',
                    type: 'numeric',
                    question: 'Non-inverting amplifier with Rf=47kΩ, R1=10kΩ. What is the gain?',
                    hint: 'Non-inverting gain = 1 + Rf/R1',
                    expected: 5.7,
                    tolerance: 0.05,
                    unit: 'V/V',
                    solution: 'Gain = 1 + Rf/R1 = 1 + 47k/10k = 5.7',
                    explanation: 'Non-inverting gain is always ≥1.'
                },
                {
                    id: 'B1-3',
                    type: 'choice',
                    question: 'What is the input impedance of an inverting amplifier with R1 = 10kΩ?',
                    choices: [
                        { text: 'Very high (MΩ range)', correct: false, explanation: 'That\'s true for non-inverting configuration' },
                        { text: 'Approximately R1 = 10kΩ', correct: true, explanation: 'Correct! The virtual ground makes Zin ≈ R1' },
                        { text: 'Approximately Rf = 100kΩ', correct: false, explanation: 'Rf sets the gain, not the input impedance' },
                        { text: 'Zero ohms', correct: false, explanation: 'The input has finite impedance set by R1' }
                    ]
                }
            ],
            2: [
                {
                    id: 'B2-1',
                    type: 'numeric',
                    question: 'Op-amp has GBW = 10MHz. What is the closed-loop bandwidth at gain = 100?',
                    hint: 'BW = GBW / Gain',
                    expected: 100000, // 100 kHz
                    tolerance: 0.05,
                    unit: 'Hz',
                    solution: 'BW = GBW/Gain = 10MHz/100 = 100kHz',
                    explanation: 'The gain-bandwidth product is constant for a single-pole op-amp.'
                },
                {
                    id: 'B2-2',
                    type: 'numeric',
                    question: 'Calculate the -3dB frequency of an RC integrator: R=10kΩ, C=10nF.',
                    hint: 'fc = 1/(2πRC)',
                    expected: 1592, // Hz
                    tolerance: 0.05,
                    unit: 'Hz',
                    solution: 'fc = 1/(2π×10k×10n) = 1/(2π×100µs) = 1592 Hz',
                    explanation: 'This is where the integrator gain magnitude crosses unity.'
                },
                {
                    id: 'B2-3',
                    type: 'choice',
                    question: 'An op-amp outputs a triangle wave when you apply a square wave input. The circuit is likely a:',
                    choices: [
                        { text: 'Buffer', correct: false, explanation: 'A buffer outputs the same waveshape as input' },
                        { text: 'Integrator', correct: true, explanation: 'Correct! Integration of a square wave produces a triangle wave' },
                        { text: 'Differentiator', correct: false, explanation: 'Differentiation of a square wave produces spikes at transitions' },
                        { text: 'Comparator', correct: false, explanation: 'A comparator outputs a square wave' }
                    ]
                }
            ],
            3: [
                {
                    id: 'B3-1',
                    type: 'numeric',
                    question: 'TIA: Rf=1MΩ, Cpd=10pF, GBW=10MHz. Calculate Cf for 45° phase margin.',
                    hint: 'Cf = sqrt(Cpd/(2π×Rf×GBW))',
                    expected: 1.26e-12, // 1.26 pF
                    tolerance: 0.2,
                    unit: 'F',
                    solution: 'Cf = √(Cpd/(2π×Rf×GBW)) = √(10pF/(2π×1M×10M)) = √(10p/62.8M) ≈ 1.26pF',
                    explanation: 'This ensures the noise gain curve intersects the open-loop gain with adequate phase margin.'
                },
                {
                    id: 'B3-2',
                    type: 'numeric',
                    question: 'Calculate total output noise for: en=10nV/√Hz, Rs=10kΩ, BW=100kHz.',
                    hint: 'Include thermal noise: Vn_total = √(en² + 4kTR) × √BW',
                    expected: 4.2e-6, // ~4.2 µV
                    tolerance: 0.15,
                    unit: 'V',
                    solution: 'Thermal noise density = √(4×1.38e-23×300×10k) = 12.8nV/√Hz. Total = √(10² + 12.8²) × √100k = 16.3nV/√Hz × 316 = 5.15µV',
                    explanation: 'Use RSS (root-sum-square) for uncorrelated noise sources.'
                }
            ],
            4: [
                {
                    id: 'B4-1',
                    type: 'numeric',
                    question: 'Design 2nd-order Butterworth LP at fc=1kHz, unity gain. Given C=10nF, calculate R.',
                    hint: 'For Butterworth: R = 1/(2π×fc×C×√2)',
                    expected: 11254, // 11.254 kΩ
                    tolerance: 0.05,
                    unit: 'Ω',
                    solution: 'R = 1/(2π×1kHz×10nF×1.414) = 1/(88.86µ) = 11.25kΩ',
                    explanation: 'Butterworth Q=0.707, which affects the R calculation for Sallen-Key topology.'
                },
                {
                    id: 'B4-2',
                    type: 'numeric',
                    question: 'Op-amp has GBW=10MHz. At what frequency does closed-loop gain of 100 V/V start to roll off?',
                    hint: 'For non-inverting, f_3dB = GBW / G',
                    expected: 100,
                    tolerance: 0.05,
                    unit: 'kHz',
                    solution: 'f_3dB = 10MHz / 100 = 100kHz',
                    explanation: 'The gain-bandwidth product is constant: higher gain means lower bandwidth.'
                },
                {
                    id: 'B4-3',
                    type: 'choice',
                    question: 'An op-amp oscillates when driving a 100pF capacitive load. Best fix?',
                    choices: [
                        { text: 'Increase feedback resistor', correct: false, explanation: 'This doesnt address the phase margin issue.' },
                        { text: 'Add series resistor between output and load', correct: true, explanation: 'Correct! A series resistor (10-100Ω) isolates the cap and adds a zero to improve phase margin.' },
                        { text: 'Increase power supply voltage', correct: false, explanation: 'Supply voltage doesnt affect stability directly.' },
                        { text: 'Use a slower op-amp', correct: false, explanation: 'While this might help, its not the right engineering approach.' }
                    ]
                }
            ]
        }
    },

    // ========== SET C: Power Supplies ==========
    setC: {
        title: 'Power Supplies',
        levels: {
            1: [
                {
                    id: 'C1-1',
                    type: 'numeric',
                    question: 'LDO: Vin=5V, Vout=3.3V, Iout=100mA. Calculate power dissipation.',
                    hint: 'P = (Vin - Vout) × Iout',
                    expected: 0.17, // 170 mW
                    tolerance: 0.05,
                    unit: 'W',
                    solution: 'P = (5V - 3.3V) × 100mA = 1.7V × 0.1A = 170mW',
                    explanation: 'All the voltage drop across the LDO is dissipated as heat.'
                },
                {
                    id: 'C1-2',
                    type: 'numeric',
                    question: 'What is the efficiency of the LDO above?',
                    hint: 'Efficiency = Pout/Pin = Vout/Vin (for same current)',
                    expected: 66, // 66%
                    tolerance: 0.05,
                    unit: '%',
                    solution: 'η = Vout/Vin = 3.3/5 = 66%',
                    explanation: 'LDO efficiency is limited by the voltage ratio. Use a buck converter for better efficiency when Vin >> Vout.'
                },
                {
                    id: 'C1-3',
                    type: 'choice',
                    question: 'When should you choose an LDO over a buck converter?',
                    choices: [
                        { text: 'When Vin >> Vout and efficiency matters', correct: false, explanation: 'Buck is better for large voltage drops' },
                        { text: 'When Vin ≈ Vout, or low noise is critical', correct: true, explanation: 'Correct! LDO is efficient when dropout is small and offers lower noise' },
                        { text: 'When output current exceeds 10A', correct: false, explanation: 'High current typically favors switching converters' },
                        { text: 'Always - LDOs are superior', correct: false, explanation: 'Each has advantages depending on the application' }
                    ]
                }
            ],
            2: [
                {
                    id: 'C2-1',
                    type: 'numeric',
                    question: 'Buck converter: Vin=12V, Vout=5V, fsw=500kHz, ΔIL=20% of Iout=2A. Calculate inductance.',
                    hint: 'L = Vout × (1-D) / (fsw × ΔIL), where D = Vout/Vin',
                    expected: 11.7e-6, // 11.7 µH
                    tolerance: 0.1,
                    unit: 'H',
                    solution: 'D = 5/12 = 0.417. ΔIL = 0.2×2A = 0.4A. L = 5V × 0.583 / (500k × 0.4A) = 2.92V/200kA/s = 14.6µH',
                    explanation: 'Higher inductance reduces ripple but increases size and may slow transient response.'
                },
                {
                    id: 'C2-2',
                    type: 'numeric',
                    question: 'Calculate the duty cycle for Buck: Vin=24V, Vout=3.3V.',
                    hint: 'D = Vout/Vin (for ideal CCM buck)',
                    expected: 13.75, // 13.75%
                    tolerance: 0.05,
                    unit: '%',
                    solution: 'D = Vout/Vin = 3.3V/24V = 0.1375 = 13.75%',
                    explanation: 'Low duty cycle can be challenging for some controllers. Check minimum on-time spec.'
                }
            ],
            3: [
                {
                    id: 'C3-1',
                    type: 'numeric',
                    question: 'Power MOSFET: RDS(on)=10mΩ, ID=10A, Qg=30nC, VGS=10V, fsw=200kHz. Calculate total loss.',
                    hint: 'Ptotal = Pcond + Pgate = ID²×RDS(on) + Qg×VGS×fsw',
                    expected: 1.06, // 1.06 W
                    tolerance: 0.1,
                    unit: 'W',
                    solution: 'Pcond = 10A² × 10mΩ = 1W. Pgate = 30nC × 10V × 200kHz = 60mW. Total ≈ 1.06W',
                    explanation: 'At higher frequencies, gate drive losses become more significant.'
                },
                {
                    id: 'C3-2',
                    type: 'choice',
                    question: 'You need to switch 20A at 1MHz. Should you optimize for low RDS(on) or low Qg?',
                    choices: [
                        { text: 'Low RDS(on) - conduction loss dominates at high current', correct: false, explanation: 'At 1MHz, switching losses are significant' },
                        { text: 'Low Qg - switching losses dominate at high frequency', correct: true, explanation: 'Correct! High frequency makes Qg more important than RDS(on)' },
                        { text: 'Both equally - they scale the same way', correct: false, explanation: 'They trade off against each other' },
                        { text: 'Neither - thermal resistance is the only concern', correct: false, explanation: 'Losses determine thermal requirements' }
                    ]
                }
            ],
            4: [
                {
                    id: 'C4-1',
                    type: 'numeric',
                    question: 'Calculate output voltage droop when load steps from 0 to 5A in 1µs. Cout=100µF, ESR=10mΩ.',
                    hint: 'Vdroop = I×ESR + I×Δt/C (ESR drop + capacitor discharge)',
                    expected: 0.1, // 100mV
                    tolerance: 0.2,
                    unit: 'V',
                    solution: 'ESR drop = 5A × 10mΩ = 50mV. Cap droop = 5A × 1µs / 100µF = 50mV. Total ≈ 100mV',
                    explanation: 'Both ESR and capacitance contribute to transient droop. Low-ESR caps help with initial spike.'
                }
            ]
        }
    },

    // ========== SET D: Data Converters ==========
    setD: {
        title: 'Data Converters',
        levels: {
            1: [
                {
                    id: 'D1-1',
                    type: 'numeric',
                    question: 'Calculate the LSB voltage for a 12-bit ADC with Vref=4.096V.',
                    hint: 'LSB = Vref / 2^N',
                    expected: 0.001, // 1mV
                    tolerance: 0.01,
                    unit: 'V',
                    solution: 'LSB = 4.096V / 4096 = 1mV',
                    explanation: 'This reference value is chosen specifically to give 1mV/LSB for easy calculation.'
                },
                {
                    id: 'D1-2',
                    type: 'numeric',
                    question: 'What is the theoretical maximum SNR for a 16-bit ADC?',
                    hint: 'SNR = 6.02N + 1.76 dB',
                    expected: 98.1, // dB
                    tolerance: 0.05,
                    unit: 'dB',
                    solution: 'SNR = 6.02 × 16 + 1.76 = 96.32 + 1.76 = 98.08 dB',
                    explanation: 'Real ADCs achieve less due to noise, DNL, and other non-idealities.'
                },
                {
                    id: 'D1-3',
                    type: 'choice',
                    question: 'Which ADC type is best for measuring slowly-changing precision signals (e.g., temperature)?',
                    choices: [
                        { text: 'Flash ADC', correct: false, explanation: 'Flash is fast but limited resolution' },
                        { text: 'SAR ADC', correct: false, explanation: 'SAR is good general-purpose but delta-sigma excels for precision' },
                        { text: 'Delta-Sigma ADC', correct: true, explanation: 'Correct! Delta-sigma offers the highest resolution for slow signals' },
                        { text: 'Pipelined ADC', correct: false, explanation: 'Pipelined is for high-speed, moderate resolution' }
                    ]
                }
            ],
            2: [
                {
                    id: 'D2-1',
                    type: 'numeric',
                    question: 'SAR ADC driver: 14-bit, 1MSPS. Calculate minimum settling time to 0.5 LSB.',
                    hint: 'Time constants needed = ln(2^(N+1)) ≈ N × 0.7',
                    expected: 0.68e-6, // ~680ns
                    tolerance: 0.15,
                    unit: 's',
                    solution: 'Need 11 time constants for 14-bit (k=11). At 1MSPS, acquisition time < 1µs. If tacq = 0.7µs, τ = 64ns.',
                    explanation: 'The acquisition time must allow settling to better than 0.5 LSB accuracy.'
                },
                {
                    id: 'D2-2',
                    type: 'numeric',
                    question: 'Calculate the output voltage ripple for DAC reconstruction with fc=10kHz, fs=1MHz, 40dB attenuation at fs.',
                    hint: 'For 2nd order filter: attenuation at fs = (fs/fc)^2',
                    expected: 1, // 1% ripple (40dB = 100:1)
                    tolerance: 0.2,
                    unit: '%',
                    solution: 'With 40dB (100×) attenuation at fs, if fundamental is 100%, image is 1%',
                    explanation: 'Higher order filters or oversampling can further reduce this ripple.'
                }
            ],
            3: [
                {
                    id: 'D3-1',
                    type: 'numeric',
                    question: 'Voltage reference: 2.5V, 10ppm/°C, 50°C range. What is the total drift error in mV?',
                    hint: 'ΔV = Vref × tempco × ΔT',
                    expected: 1.25, // mV
                    tolerance: 0.1,
                    unit: 'mV',
                    solution: 'ΔV = 2.5V × 10ppm/°C × 50°C = 2.5V × 500ppm = 2.5V × 0.0005 = 1.25mV',
                    explanation: 'This represents 0.05% error - significant for 12+ bit systems.'
                },
                {
                    id: 'D3-2',
                    type: 'choice',
                    question: 'What is the main advantage of delta-sigma ADCs over SAR ADCs?',
                    choices: [
                        { text: 'Faster conversion rate', correct: false, explanation: 'SAR is typically faster for single conversions' },
                        { text: 'Lower power consumption', correct: false, explanation: 'SAR often has lower power' },
                        { text: 'Higher resolution through noise shaping and oversampling', correct: true, explanation: 'Correct! Delta-sigma trades speed for resolution' },
                        { text: 'Simpler anti-aliasing filter requirements', correct: false, explanation: 'Actually true, but not the main advantage' }
                    ]
                }
            ],
            4: [
                {
                    id: 'D4-1',
                    type: 'numeric',
                    question: 'Calculate ENOB for an ADC with measured SINAD = 72dB.',
                    hint: 'ENOB = (SINAD - 1.76) / 6.02',
                    expected: 11.67,
                    tolerance: 0.05,
                    unit: 'bits',
                    solution: 'ENOB = (72 - 1.76) / 6.02 = 70.24 / 6.02 = 11.67 bits',
                    explanation: 'A 12-bit ADC with 11.67 ENOB is performing well, losing only 0.33 bits to noise and distortion.'
                }
            ]
        }
    },

    // ========== SET E: Signal Integrity ==========
    setE: {
        title: 'Signal Integrity',
        levels: {
            1: [
                {
                    id: 'E1-1',
                    type: 'numeric',
                    question: 'Calculate the bandwidth needed to preserve a 10ns rise time signal.',
                    hint: 'BW = 0.35 / tr',
                    expected: 35e6, // 35 MHz
                    tolerance: 0.1,
                    unit: 'Hz',
                    solution: 'BW = 0.35 / 10ns = 35 MHz',
                    explanation: 'This is the minimum system bandwidth. Use ≥5× for accurate measurements.'
                },
                {
                    id: 'E1-2',
                    type: 'numeric',
                    question: 'At what frequency does a 10cm trace become a transmission line? (Assume tr = λ/10)',
                    hint: 'Critical length ≈ λ/10. Speed in FR4 ≈ 15cm/ns',
                    expected: 150e6, // 150 MHz
                    tolerance: 0.2,
                    unit: 'Hz',
                    solution: 'λ/10 = 10cm → λ = 100cm. f = v/λ = 15cm/ns / 100cm = 0.15GHz = 150MHz',
                    explanation: 'Above this frequency, treat the trace as a transmission line requiring termination.'
                }
            ],
            2: [
                {
                    id: 'E2-1',
                    type: 'numeric',
                    question: 'Series termination: Driver has Rout=25Ω, trace Zo=50Ω. What series resistor is needed?',
                    hint: 'Rs + Rout = Zo',
                    expected: 25, // ohms
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 'Rs = Zo - Rout = 50Ω - 25Ω = 25Ω',
                    explanation: 'Series termination works best when only one receiver at the end of the line.'
                },
                {
                    id: 'E2-2',
                    type: 'choice',
                    question: 'I2C uses 4.7kΩ pull-ups and shows slow rise times at 400kHz. What should you do?',
                    choices: [
                        { text: 'Increase pull-up to 10kΩ', correct: false, explanation: 'This would make rise time even slower' },
                        { text: 'Decrease pull-up to 2.2kΩ', correct: true, explanation: 'Correct! Lower resistance charges the bus capacitance faster' },
                        { text: 'Add series capacitors', correct: false, explanation: 'This would make it worse' },
                        { text: 'Use push-pull drivers', correct: false, explanation: 'I2C requires open-drain for multi-master' }
                    ]
                }
            ],
            3: [
                {
                    id: 'E3-1',
                    type: 'numeric',
                    question: 'Calculate crosstalk for parallel traces: 10cm long, 5mm spacing, 50Ω impedance, 1V 1ns edge.',
                    hint: 'Crosstalk ≈ Lm/L × tr × length, simplified: ~10-20% for this geometry',
                    expected: 0.1, // ~10% = 100mV
                    tolerance: 0.3,
                    unit: 'V',
                    solution: 'Crosstalk is highly geometry-dependent. For 5mm spacing on FR4, expect ~10-15% of the aggressor signal.',
                    explanation: 'Increase spacing, use ground traces between signals, or orthogonal routing to reduce crosstalk.'
                }
            ],
            4: [
                {
                    id: 'E4-1',
                    type: 'choice',
                    question: 'An eye diagram shows excessive jitter. What is the most likely cause?',
                    choices: [
                        { text: 'Improper termination causing reflections', correct: false, explanation: 'Reflections cause ISI, not primarily jitter' },
                        { text: 'Power supply noise coupling to the clock', correct: true, explanation: 'Correct! Power supply noise is a major source of clock jitter' },
                        { text: 'Trace too short', correct: false, explanation: 'Short traces don\'t cause jitter issues' },
                        { text: 'Wrong characteristic impedance', correct: false, explanation: 'This causes reflections and overshoot, not jitter' }
                    ]
                }
            ]
        }
    },

    // ========== SET F: Protection & Safety ==========
    setF: {
        title: 'Protection & Safety',
        levels: {
            1: [
                {
                    id: 'F1-1',
                    type: 'choice',
                    question: 'For a 12V rail, what VRWM (standoff voltage) should the TVS have?',
                    choices: [
                        { text: '5V', correct: false, explanation: 'Too low - would conduct during normal operation' },
                        { text: '12V', correct: false, explanation: 'Should be higher to avoid leakage' },
                        { text: '13.3V or higher', correct: true, explanation: 'Correct! VRWM should exceed maximum operating voltage with margin' },
                        { text: '24V', correct: false, explanation: 'This would clamp too late' }
                    ]
                },
                {
                    id: 'F1-2',
                    type: 'numeric',
                    question: 'Series diode protection: Schottky Vf=0.3V, current=500mA. Calculate power loss.',
                    hint: 'P = Vf × I',
                    expected: 0.15, // 150 mW
                    tolerance: 0.05,
                    unit: 'W',
                    solution: 'P = 0.3V × 0.5A = 0.15W = 150mW',
                    explanation: 'This loss is constant regardless of load, reducing efficiency especially at light load.'
                }
            ],
            2: [
                {
                    id: 'F2-1',
                    type: 'numeric',
                    question: 'P-FET reverse protection: VIN=12V, RDS(on)=20mΩ, I=2A. Calculate voltage drop and power loss.',
                    hint: 'Vdrop = I × RDS(on), P = I² × RDS(on)',
                    expected: 0.08, // 80 mW
                    tolerance: 0.1,
                    unit: 'W',
                    solution: 'Vdrop = 2A × 20mΩ = 40mV. P = 2A² × 20mΩ = 80mW',
                    explanation: 'Much lower than a diode! This is why FET protection is preferred for higher currents.'
                },
                {
                    id: 'F2-2',
                    type: 'numeric',
                    question: 'TVS clamping: 15V TVS, 50A surge. If clamping factor is 1.4, what is Vc?',
                    hint: 'Vc = VBR × clamping_factor',
                    expected: 21, // volts
                    tolerance: 0.1,
                    unit: 'V',
                    solution: 'Vc = 15V × 1.4 = 21V',
                    explanation: 'The protected circuit must tolerate 21V during the surge event.'
                }
            ],
            3: [
                {
                    id: 'F3-1',
                    type: 'numeric',
                    question: 'Hot-swap: Limit inrush to 2A into 1000µF load. How long to charge to 12V?',
                    hint: 'I = C × dV/dt → t = C × V / I',
                    expected: 0.006, // 6ms
                    tolerance: 0.1,
                    unit: 's',
                    solution: 't = C × ΔV / I = 1000µF × 12V / 2A = 12mC / 2A = 6ms',
                    explanation: 'The hot-swap controller limits current during this time, protecting connectors and upstream supply.'
                }
            ],
            4: [
                {
                    id: 'F4-1',
                    type: 'numeric',
                    question: 'ESD protection: 2kV HBM into 1.5pF clamp capacitance. Calculate peak voltage without TVS.',
                    hint: 'For HBM: Q = C_body × V_ESD, C_body = 100pF. Final V = Q / (C_body + C_clamp)',
                    expected: 1970, // ~1970V
                    tolerance: 0.1,
                    unit: 'V',
                    solution: 'Q = 100pF × 2000V = 200nC. V = 200nC / (100pF + 1.5pF) = 1970V',
                    explanation: 'This shows why clamp capacitance alone is insufficient - TVS active clamping is essential.'
                }
            ]
        }
    },

    // ========== SET G: Mixed-Signal Layout ==========
    setG: {
        title: 'Mixed-Signal Layout',
        levels: {
            1: [
                {
                    id: 'G1-1',
                    type: 'choice',
                    question: 'Where should bypass capacitors be placed?',
                    choices: [
                        { text: 'Anywhere on the power plane', correct: false, explanation: 'Placement matters for high frequency performance' },
                        { text: 'As close as possible to the IC power pins', correct: true, explanation: 'Correct! Minimizes loop inductance for best decoupling' },
                        { text: 'Near the power supply', correct: false, explanation: 'This is too far from the IC' },
                        { text: 'On the back of the board', correct: false, explanation: 'Via inductance degrades performance' }
                    ]
                },
                {
                    id: 'G1-2',
                    type: 'numeric',
                    question: 'Calculate the self-resonant frequency of a 100nF 0402 capacitor with 0.5nH ESL.',
                    hint: 'f_SRF = 1 / (2π√(LC))',
                    expected: 22.5e6, // 22.5 MHz
                    tolerance: 0.1,
                    unit: 'Hz',
                    solution: 'f = 1/(2π×√(0.5nH × 100nF)) = 1/(2π×√50ps) = 1/(2π × 7.07µs) = 22.5MHz',
                    explanation: 'Above SRF, the capacitor looks inductive. Use multiple values to cover wide frequency range.'
                }
            ],
            2: [
                {
                    id: 'G2-1',
                    type: 'choice',
                    question: 'You see noise spikes on an analog signal at the MCU clock frequency. Most likely cause?',
                    choices: [
                        { text: 'Crosstalk from nearby analog signals', correct: false, explanation: 'The noise is at digital frequency' },
                        { text: 'Digital ground currents coupling to analog ground', correct: true, explanation: 'Correct! Digital switching currents are returning through shared ground' },
                        { text: 'Op-amp oscillation', correct: false, explanation: 'This would not correlate with MCU clock' },
                        { text: 'ADC quantization noise', correct: false, explanation: 'Quantization noise is not periodic' }
                    ]
                },
                {
                    id: 'G2-2',
                    type: 'numeric',
                    question: 'Ferrite bead: 100Ω at 100MHz, DC current 500mA. If DC bias derates by 50%, effective impedance?',
                    hint: 'Ferrites lose impedance under DC bias - multiply by derating factor',
                    expected: 50, // ohms
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 'Effective Z = 100Ω × 0.5 = 50Ω',
                    explanation: 'Always check ferrite DC bias curves! High current can dramatically reduce filtering effectiveness.'
                }
            ],
            3: [
                {
                    id: 'G3-1',
                    type: 'choice',
                    question: 'Should you split the ground plane between analog and digital sections?',
                    choices: [
                        { text: 'Always - analog and digital must be isolated', correct: false, explanation: 'Split planes can create more problems than they solve' },
                        { text: 'Never - always use a solid ground plane', correct: false, explanation: 'There are some cases where splits make sense' },
                        { text: 'Rarely - use solid plane with careful partitioning', correct: true, explanation: 'Correct! Partition the placement, keep the plane solid' },
                        { text: 'Only for RF circuits', correct: false, explanation: 'The principle applies to all mixed-signal designs' }
                    ]
                }
            ],
            4: [
                {
                    id: 'G4-1',
                    type: 'numeric',
                    question: 'Calculate ground inductance for 1cm via: L ≈ 5nH/cm. If 100mA at 100MHz, what is the ground bounce?',
                    hint: 'V = L × dI/dt. For 100MHz sine: dI/dt = 2πf × I_peak',
                    expected: 0.314, // ~314mV
                    tolerance: 0.2,
                    unit: 'V',
                    solution: 'L = 5nH. dI/dt = 2π × 100MHz × 100mA = 62.8 A/µs. V = 5nH × 62.8 A/µs = 314mV',
                    explanation: 'This shows why via inductance is critical for high-frequency designs.'
                }
            ]
        }
    },

    // ========== SET H: System Integration ==========
    setH: {
        title: 'System Integration',
        levels: {
            1: [
                {
                    id: 'H1-1',
                    type: 'choice',
                    question: 'You are designing a 3.3V system powered from 5V USB. Best approach?',
                    choices: [
                        { text: 'Resistor divider', correct: false, explanation: 'Cannot regulate, voltage drops under load' },
                        { text: 'Linear regulator (LDO)', correct: true, explanation: 'Correct! Simple, low noise, adequate efficiency at 66%' },
                        { text: 'Buck converter', correct: false, explanation: 'Overkill for small voltage drop' },
                        { text: 'Zener diode', correct: false, explanation: 'Poor regulation and efficiency' }
                    ]
                },
                {
                    id: 'H1-2',
                    type: 'numeric',
                    question: 'Sensor interface: 5mV full-scale signal, 16-bit ADC with 5V reference. Required gain?',
                    hint: 'Gain = ADC_range / signal_range',
                    expected: 1000,
                    tolerance: 0.1,
                    unit: 'V/V',
                    solution: 'Gain = 5V / 5mV = 1000',
                    explanation: 'This gain allows full use of ADC range. In practice, leave some headroom.'
                }
            ],
            2: [
                {
                    id: 'H2-1',
                    type: 'numeric',
                    question: 'IoT node: 10µA sleep, 50mA active for 100ms every 10 minutes. Calculate average current.',
                    hint: 'Iavg = (Isleep × Tsleep + Iactive × Tactive) / Ttotal',
                    expected: 18.3, // µA
                    tolerance: 0.1,
                    unit: 'µA',
                    solution: 'Tsleep = 599.9s, Tactive = 0.1s. Iavg = (10µA × 599.9 + 50mA × 0.1) / 600 = (5999 + 5000)µA / 600 = 18.3µA',
                    explanation: 'Sleep current dominates! Reducing sleep current has the biggest impact on battery life.'
                },
                {
                    id: 'H2-2',
                    type: 'numeric',
                    question: 'With the average current above, calculate battery life from 225mAh coin cell.',
                    hint: 'Life = Capacity / Iavg',
                    expected: 12300, // hours ≈ 1.4 years
                    tolerance: 0.1,
                    unit: 'hours',
                    solution: 'Life = 225mAh / 18.3µA = 12,300 hours = 512 days ≈ 1.4 years',
                    explanation: 'Real life will be shorter due to self-discharge and temperature effects.'
                }
            ],
            3: [
                {
                    id: 'H3-1',
                    type: 'numeric',
                    question: 'Error budget: 12-bit ADC, need 1 LSB accuracy. Max allowable reference drift over 50°C?',
                    hint: '1 LSB = 1/4096 = 244ppm. Drift = total_ppm / ΔT',
                    expected: 4.88, // ppm/°C
                    tolerance: 0.1,
                    unit: 'ppm/°C',
                    solution: '1 LSB = 244ppm. Tempco = 244ppm / 50°C = 4.88 ppm/°C',
                    explanation: 'This is a demanding spec - need a quality reference like REF5025 (8ppm/°C) or better.'
                }
            ],
            4: [
                {
                    id: 'H4-1',
                    type: 'numeric',
                    question: 'Complete error budget: Gain error 0.1%, offset 1mV in 5V range, noise 100µVrms. Total error in ppm?',
                    hint: 'Convert each to ppm, use RSS for uncorrelated errors',
                    expected: 1020, // ppm RSS
                    tolerance: 0.1,
                    unit: 'ppm',
                    solution: 'Gain: 1000ppm. Offset: 1mV/5V = 200ppm. Noise: 100µV/5V = 20ppm. RSS = √(1000² + 200² + 20²) = 1020ppm',
                    explanation: 'Gain error dominates. Focus improvement efforts on the largest contributor.'
                }
            ]
        }
    },

    // ========== SET I: Data Converters & Monotonicity ==========
    setI: {
        title: 'Data Converters & Monotonicity',
        levels: {
            1: [ // Easy
                {
                    id: 'I1-1',
                    type: 'numeric',
                    question: 'A 12-bit ADC has a 5V reference. What is the LSB size in mV?',
                    hint: 'LSB = Vref / 2^n',
                    expected: 1.22,
                    tolerance: 0.05,
                    unit: 'mV',
                    solution: 'LSB = 5V / 4096 = 1.22mV',
                    explanation: 'The LSB is the smallest voltage change the ADC can resolve.'
                },
                {
                    id: 'I1-2',
                    type: 'choice',
                    question: 'What DNL value guarantees monotonicity in a DAC?',
                    choices: [
                        { text: 'DNL > 0 LSB', correct: false, explanation: 'DNL > 0 means larger steps, not monotonicity guarantee.' },
                        { text: 'DNL ≥ -1 LSB', correct: true, explanation: 'Correct! Monotonicity requires DNL never goes below -1 LSB.' },
                        { text: 'DNL < -1 LSB', correct: false, explanation: 'DNL < -1 LSB means output goes backwards - non-monotonic.' },
                        { text: 'DNL = 0 LSB', correct: false, explanation: 'DNL = 0 is ideal, but not required for monotonicity.' }
                    ]
                },
                {
                    id: 'I1-3',
                    type: 'numeric',
                    question: 'A 16-bit ADC has INL of ±2 LSB. What is the maximum DC error in a 4.096V system?',
                    hint: 'Error = INL × LSB size',
                    expected: 0.125,
                    tolerance: 0.05,
                    unit: 'mV',
                    solution: 'LSB = 4.096V / 65536 = 62.5µV. Max error = 2 × 62.5µV = 125µV = 0.125mV',
                    explanation: 'INL represents the cumulative deviation from an ideal straight-line transfer function.'
                }
            ],
            2: [ // Medium
                {
                    id: 'I2-1',
                    type: 'choice',
                    question: 'Which ADC architecture is inherently monotonic?',
                    choices: [
                        { text: 'SAR ADC', correct: false, explanation: 'SAR ADCs can have non-monotonicity due to capacitor mismatch.' },
                        { text: 'Sigma-Delta ADC', correct: true, explanation: 'Correct! Sigma-delta uses oversampling and 1-bit DAC, guaranteeing monotonicity.' },
                        { text: 'Pipeline ADC', correct: false, explanation: 'Pipeline ADCs can have monotonicity issues at stage boundaries.' },
                        { text: 'Flash ADC', correct: false, explanation: 'Flash ADCs can have missing codes from comparator offset.' }
                    ]
                },
                {
                    id: 'I2-2',
                    type: 'numeric',
                    question: 'A 12-bit R-2R DAC has 0.1% resistor tolerance. Estimate worst-case MSB error in LSBs.',
                    hint: 'MSB contributes half the output range. Error ≈ 0.5 × 4096 × tolerance',
                    expected: 2.05,
                    tolerance: 0.2,
                    unit: 'LSB',
                    solution: 'MSB weight = 2048 LSB. Error = 2048 × 0.001 = 2.05 LSB',
                    explanation: 'The MSB has the most influence on accuracy - a small error there causes large DNL.'
                },
                {
                    id: 'I2-3',
                    type: 'numeric',
                    question: 'For a servo control loop, ADC has DNL = -0.8 LSB. What is the maximum possible dither amplitude to avoid limit cycles?',
                    hint: 'Dither should be larger than the non-monotonic region',
                    expected: 0.8,
                    tolerance: 0.1,
                    unit: 'LSB',
                    solution: 'Dither amplitude ≈ DNL magnitude = 0.8 LSB',
                    explanation: 'Adding dither noise helps average out DNL errors in control loops.'
                }
            ],
            3: [ // Hard
                {
                    id: 'I3-1',
                    type: 'numeric',
                    question: 'For an 8-bit SAR ADC with binary-weighted capacitor array, what matching tolerance (%) is needed for ±0.5 LSB DNL?',
                    hint: 'Worst case DNL at MSB transition. Need MSB cap = sum of all lower caps within tolerance.',
                    expected: 0.39,
                    tolerance: 0.1,
                    unit: '%',
                    solution: 'For 8-bit, need MSB error < 0.5 LSB. 128 × tol < 0.5 → tol < 0.39%',
                    explanation: 'Higher resolution ADCs need exponentially better matching.'
                },
                {
                    id: 'I3-2',
                    type: 'choice',
                    question: 'A control loop oscillates when using a specific DAC. Most likely cause?',
                    choices: [
                        { text: 'INL too high', correct: false, explanation: 'INL causes gain error but not oscillation.' },
                        { text: 'DAC is non-monotonic', correct: true, explanation: 'Correct! Non-monotonicity can turn negative feedback into positive feedback locally.' },
                        { text: 'DAC output impedance too high', correct: false, explanation: 'High impedance causes gain loss, not oscillation.' },
                        { text: 'Reference voltage drift', correct: false, explanation: 'Reference drift causes DC error, not oscillation.' }
                    ]
                }
            ],
            4: [ // Expert
                {
                    id: 'I4-1',
                    type: 'numeric',
                    question: 'An 18-bit DAC needs ±0.5 LSB DNL. Calculate required resistor matching in ppm.',
                    hint: 'For n-bit, MSB = 2^(n-1). Matching = 0.5 LSB / MSB',
                    expected: 3.8,
                    tolerance: 0.2,
                    unit: 'ppm',
                    solution: 'MSB = 131072 LSB. Matching = 0.5/131072 = 3.8 ppm',
                    explanation: 'This is extremely demanding - requires laser-trimmed thin-film resistors or self-calibration.'
                },
                {
                    id: 'I4-2',
                    type: 'numeric',
                    question: 'ADC histogram test: 1M samples, 256 codes. Ideal hits per code? If code 127 has 2800 hits, what is its DNL?',
                    hint: 'Ideal = N/codes. DNL = (actual - ideal) / ideal',
                    expected: -0.28,
                    tolerance: 0.05,
                    unit: 'LSB',
                    solution: 'Ideal = 1M/256 = 3906 hits. DNL = (2800-3906)/3906 = -0.28 LSB',
                    explanation: 'Histogram testing reveals DNL by measuring code occurrence frequency with a ramp input.'
                }
            ]
        }
    },

    // ========== SET J: MOSFET Circuits ==========
    setJ: {
        title: 'MOSFET Circuits',
        levels: {
            1: [
                {
                    id: 'J1-1',
                    type: 'numeric',
                    question: 'N-channel MOSFET: VGS = 5V, Vth = 2V, K = 10mA/V². Calculate ID in saturation.',
                    hint: 'ID = K × (VGS - Vth)²',
                    expected: 90,
                    tolerance: 0.05,
                    unit: 'mA',
                    solution: 'ID = 10mA/V² × (5V - 2V)² = 10 × 9 = 90mA',
                    explanation: 'This assumes saturation region where VDS > VGS - Vth.'
                },
                {
                    id: 'J1-2',
                    type: 'choice',
                    question: 'What happens to a MOSFET when VGS < Vth?',
                    choices: [
                        { text: 'Conducts heavily', correct: false, explanation: 'No - the channel is not formed yet.' },
                        { text: 'Acts as a short circuit', correct: false, explanation: 'No - it\'s off when VGS < Vth.' },
                        { text: 'Cutoff - only subthreshold leakage flows', correct: true, explanation: 'Correct! Below threshold, only exponentially small leakage current flows.' },
                        { text: 'Operates in triode region', correct: false, explanation: 'Triode/linear region requires VGS > Vth.' }
                    ]
                },
                {
                    id: 'J1-3',
                    type: 'numeric',
                    question: 'A logic-level MOSFET has RDS(on) = 10mΩ at VGS = 4.5V. What is the conduction loss at 10A?',
                    hint: 'P = I² × R',
                    expected: 1,
                    tolerance: 0.05,
                    unit: 'W',
                    solution: 'P = 10² × 0.010 = 1W',
                    explanation: 'Conduction losses scale with the square of current. Keep RDS(on) low for efficiency.'
                }
            ],
            2: [
                {
                    id: 'J2-1',
                    type: 'numeric',
                    question: 'Gate driver: Qg = 50nC, switching frequency 100kHz. What is the gate drive current required?',
                    hint: 'I = Qg × f',
                    expected: 5,
                    tolerance: 0.05,
                    unit: 'mA',
                    solution: 'I = 50nC × 100kHz = 5mA average. Peak current is much higher.',
                    explanation: 'This is the average gate current. Peak current = Qg / trise is much higher.'
                },
                {
                    id: 'J2-2',
                    type: 'numeric',
                    question: 'Calculate the gate drive power loss: Qg = 50nC, VGS = 12V, f = 100kHz.',
                    hint: 'P = Qg × VGS × f',
                    expected: 60,
                    tolerance: 0.05,
                    unit: 'mW',
                    solution: 'P = 50nC × 12V × 100kHz = 60mW',
                    explanation: 'Gate drive losses become significant at high frequencies and high Qg MOSFETs.'
                }
            ],
            3: [
                {
                    id: 'J3-1',
                    type: 'numeric',
                    question: 'MOSFET switching: VDS = 48V, ID = 20A, trise = 50ns. Calculate switching loss at 50kHz.',
                    hint: 'Esw ≈ 0.5 × VDS × ID × (trise + tfall). P = Esw × f',
                    expected: 1.2,
                    tolerance: 0.1,
                    unit: 'W',
                    solution: 'Esw = 0.5 × 48 × 20 × (50ns + 50ns) = 48µJ. P = 48µJ × 50kHz/2 = 1.2W',
                    explanation: 'Switching losses add to conduction losses. Total = Pcond + Psw.'
                }
            ],
            4: [
                {
                    id: 'J4-1',
                    type: 'numeric',
                    question: 'Design gate resistor: Cgs + Cgd = 5nF, target trise = 100ns. What Rg value needed?',
                    hint: 'For 10-90% rise, trise ≈ 2.2 × RC',
                    expected: 9.1,
                    tolerance: 0.2,
                    unit: 'Ω',
                    solution: 'RC = trise / 2.2 = 45ns. R = 45ns / 5nF = 9Ω',
                    explanation: 'Gate resistance trades off switching speed vs EMI and dV/dt immunity.'
                }
            ]
        }
    },

    // ========== SET K: Signal Integrity ==========
    setK: {
        title: 'Signal Integrity & PCB',
        levels: {
            1: [
                {
                    id: 'K1-1',
                    type: 'numeric',
                    question: 'A 10cm trace on FR4 (εr = 4.3). Calculate propagation delay.',
                    hint: 'Delay ≈ 3.3ns per 30cm for FR4. Or delay = L × √εr / c',
                    expected: 1.1,
                    tolerance: 0.1,
                    unit: 'ns',
                    solution: 'v = c/√εr = 3×10⁸/√4.3 ≈ 1.45×10⁸ m/s. Delay = 0.1m / 1.45×10⁸ = 0.69ns. With microstrip effects ≈ 1.1ns',
                    explanation: 'Propagation delay limits maximum signaling frequency for unterminated lines.'
                },
                {
                    id: 'K1-2',
                    type: 'choice',
                    question: 'When is transmission line analysis required?',
                    choices: [
                        { text: 'Always for any PCB trace', correct: false, explanation: 'Not necessary for slow signals or short traces.' },
                        { text: 'When trace length > λ/10 (critical length)', correct: true, explanation: 'Correct! When the trace is electrically long compared to rise time.' },
                        { text: 'Only for RF circuits', correct: false, explanation: 'Digital circuits also need TL analysis for fast edges.' },
                        { text: 'Never - lumped analysis is always adequate', correct: false, explanation: 'Fast edges require distributed analysis.' }
                    ]
                },
                {
                    id: 'K1-3',
                    type: 'numeric',
                    question: 'Calculate critical length for 1ns rise time signal on FR4.',
                    hint: 'Critical length = rise_time × v / 6, where v ≈ 15cm/ns for FR4',
                    expected: 2.5,
                    tolerance: 0.2,
                    unit: 'cm',
                    solution: 'Critical length ≈ 1ns × 15cm/ns / 6 = 2.5cm',
                    explanation: 'Traces longer than this need termination or controlled impedance.'
                }
            ],
            2: [
                {
                    id: 'K2-1',
                    type: 'numeric',
                    question: 'Calculate 50Ω microstrip width on FR4 (εr=4.3, H=1.6mm, t=35µm).',
                    hint: 'Use W/H ≈ 1.9 for 50Ω on FR4 1.6mm',
                    expected: 3,
                    tolerance: 0.3,
                    unit: 'mm',
                    solution: 'For 50Ω: W ≈ 1.9 × H = 1.9 × 1.6mm = 3.0mm',
                    explanation: 'Exact value depends on copper thickness and substrate properties. Use a calculator for precision.'
                },
                {
                    id: 'K2-2',
                    type: 'numeric',
                    question: 'Unterminated 50Ω line driven by 25Ω source. Calculate reflection coefficient at load.',
                    hint: 'ρ = (ZL - Z0) / (ZL + Z0). For open: ZL = ∞',
                    expected: 1.0,
                    tolerance: 0.01,
                    unit: '',
                    solution: 'Open circuit: ρ = (∞ - 50)/(∞ + 50) = 1.0 (total reflection)',
                    explanation: 'Full reflection causes signal to double at the open end, creating overshoot.'
                }
            ],
            3: [
                {
                    id: 'K3-1',
                    type: 'numeric',
                    question: 'Via inductance: 1.6mm via, 0.3mm diameter. Estimate inductance.',
                    hint: 'L ≈ 0.5 × h(mm) nH for typical PCB via',
                    expected: 0.8,
                    tolerance: 0.2,
                    unit: 'nH',
                    solution: 'L ≈ 0.5 × 1.6 = 0.8nH',
                    explanation: 'Via inductance creates impedance discontinuity. Use multiple vias for power and ground.'
                }
            ],
            4: [
                {
                    id: 'K4-1',
                    type: 'numeric',
                    question: 'Crosstalk: Two 50Ω traces, spacing 1W, length 10cm. Estimate far-end crosstalk coefficient.',
                    hint: 'FEXT ≈ 0.25 × (L_coupled/Z0²) for 1W spacing',
                    expected: 5,
                    tolerance: 1,
                    unit: '%',
                    solution: 'FEXT ≈ 5% for 10cm parallel run at 1W spacing on FR4',
                    explanation: 'Increase spacing or reduce parallel length to minimize crosstalk.'
                }
            ]
        }
    },

    // ========== SET L: Circuit Analysis with Schematics ==========
    setL: {
        title: 'Circuit Analysis (with Diagrams)',
        levels: {
            1: [ // Easy - Basic circuit recognition
                {
                    id: 'L1-1',
                    type: 'circuit',
                    circuit: 'invertingAmp',  // Reference to AD.Schematic function
                    question: 'For this inverting amplifier with Rf = 10kΩ, what value of R1 gives a gain of -5?',
                    hint: 'Inverting gain = -Rf/R1, solve for R1',
                    expected: 2000,
                    tolerance: 0.05,
                    unit: 'Ω',
                    solution: 'Gain = -Rf/R1 → R1 = Rf/|Gain| = 10kΩ/5 = 2kΩ',
                    explanation: 'For inverting configuration, adjust R1 to set the desired gain magnitude.'
                },
                {
                    id: 'L1-2',
                    type: 'circuit',
                    circuit: 'nonInvertingAmp',
                    question: 'For this non-inverting amplifier with R1 = 1kΩ, what value of Rf gives a gain of +11?',
                    hint: 'Non-inverting gain = 1 + Rf/R1',
                    expected: 10000,
                    tolerance: 0.05,
                    unit: 'Ω',
                    solution: 'Gain = 1 + Rf/R1 → 11 = 1 + Rf/1kΩ → Rf = 10kΩ',
                    explanation: 'Non-inverting gain is always ≥1, set by the feedback network.'
                },
                {
                    id: 'L1-3',
                    type: 'circuit_waveform',
                    circuit: 'voltageFollower',
                    question: 'A 1kHz sine wave (1V peak) is applied to Vin of this voltage follower. What does Vout look like?',
                    inputDescription: 'Vin = 1V peak, 1kHz sine wave',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Same sine wave (1V, 1kHz, in phase)',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 0 },
                            correct: true,
                            explanation: 'Correct! Unity gain buffer passes signal unchanged.'
                        },
                        {
                            id: 'b',
                            label: 'Inverted sine wave (1V, 1kHz, 180° phase)',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 180 },
                            correct: false,
                            explanation: 'No inversion - this is a non-inverting configuration.'
                        },
                        {
                            id: 'c',
                            label: 'Amplified sine (10V, 1kHz)',
                            waveform: { type: 'sine', freq: 1000, amp: 10, phase: 0 },
                            correct: false,
                            explanation: 'Voltage follower has unity gain, not 10×.'
                        },
                        {
                            id: 'd',
                            label: 'Square wave (clipped output)',
                            waveform: { type: 'square', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: '1V is within the linear range, no clipping occurs.'
                        }
                    ]
                }
            ],
            2: [ // Medium - CE amplifier analysis
                {
                    id: 'L2-1',
                    type: 'circuit',
                    circuit: 'ceAmplifier',
                    question: 'For this CE amplifier with RC = 4.7kΩ and IC = 1mA, calculate the voltage gain magnitude |Av|. Assume RE bypass gives gain ≈ -gm×RC.',
                    hint: 'gm = IC/VT = IC/26mV, then Av = -gm × RC',
                    expected: 181,
                    tolerance: 0.1,
                    unit: 'V/V',
                    solution: 'gm = 1mA/26mV = 38.5mS. |Av| = gm × RC = 38.5mS × 4.7kΩ = 181',
                    explanation: 'With RE bypassed, gain is set by gm and RC. Higher IC = higher gm = higher gain.'
                },
                {
                    id: 'L2-2',
                    type: 'circuit_waveform',
                    circuit: 'ceAmplifier',
                    question: 'A 10mV peak, 1kHz sine wave is applied to Vin of this CE amplifier (gain = -100). What does Vout look like?',
                    inputDescription: 'Vin = 10mV peak, 1kHz sine wave',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Inverted sine (1V peak, 1kHz)',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 180 },
                            correct: true,
                            explanation: 'Correct! CE amplifier inverts and amplifies: 10mV × 100 = 1V, 180° phase shift.'
                        },
                        {
                            id: 'b',
                            label: 'Non-inverted sine (1V peak, 1kHz)',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'CE amplifier inverts the signal (180° phase shift).'
                        },
                        {
                            id: 'c',
                            label: 'Inverted sine (10mV peak, 1kHz)',
                            waveform: { type: 'sine', freq: 1000, amp: 0.01, phase: 180 },
                            correct: false,
                            explanation: 'The gain is 100, so output should be 1V, not 10mV.'
                        },
                        {
                            id: 'd',
                            label: 'Clipped/distorted waveform',
                            waveform: { type: 'clipped_sine', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: '1V output is likely within the linear range (depends on supply voltage).'
                        }
                    ]
                },
                {
                    id: 'L2-3',
                    type: 'circuit',
                    circuit: 'emitterFollower',
                    question: 'For this emitter follower with RE = 1kΩ, β = 100, calculate the input impedance at the base.',
                    hint: 'Zin(base) = β × RE (simplified)',
                    expected: 100000,
                    tolerance: 0.1,
                    unit: 'Ω',
                    solution: 'Zin = β × RE = 100 × 1kΩ = 100kΩ',
                    explanation: 'Emitter follower has high input impedance, making it a good buffer stage.'
                }
            ],
            3: [ // Hard - Differential pair and current mirror
                {
                    id: 'L3-1',
                    type: 'circuit',
                    circuit: 'currentMirror',
                    question: 'For this current mirror with Rref = 10kΩ and VCC = 10V, calculate Iref. Assume VBE = 0.7V.',
                    hint: 'Iref = (VCC - VBE) / Rref',
                    expected: 0.93,
                    tolerance: 0.05,
                    unit: 'mA',
                    solution: 'Iref = (10V - 0.7V) / 10kΩ = 9.3V / 10kΩ = 0.93mA',
                    explanation: 'The reference current sets the mirrored output current (assuming matched transistors).'
                },
                {
                    id: 'L3-2',
                    type: 'circuit_waveform',
                    circuit: 'diffPairActiveLoad',
                    question: 'A differential input of ±25mV at 1kHz is applied to this diff pair. With Itail = 1mA, what does the differential output look like?',
                    inputDescription: 'Differential input: ±25mV peak, 1kHz',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Amplified sine (limited by gm × Rload)',
                            waveform: { type: 'sine', freq: 1000, amp: 2, phase: 0 },
                            correct: true,
                            explanation: 'Correct! Diff pair has linear region around ±VT (26mV). 25mV input is in linear range.'
                        },
                        {
                            id: 'b',
                            label: 'Square wave (fully switched)',
                            waveform: { type: 'square', freq: 1000, amp: 3 },
                            correct: false,
                            explanation: '±25mV is within the linear input range (±4VT ≈ ±100mV), not switching hard.'
                        },
                        {
                            id: 'c',
                            label: 'No output (input too small)',
                            waveform: { type: 'dc', amp: 0 },
                            correct: false,
                            explanation: 'Diff pairs have high gain - 25mV is significant input.'
                        },
                        {
                            id: 'd',
                            label: 'Triangle wave',
                            waveform: { type: 'triangle', freq: 1000, amp: 2 },
                            correct: false,
                            explanation: 'No integration occurs - output follows input shape (amplified sine).'
                        }
                    ]
                },
                {
                    id: 'L3-3',
                    type: 'circuit',
                    circuit: 'cascodeAmp',
                    question: 'Why does the cascode configuration have higher output impedance than a simple CE stage?',
                    type: 'choice',
                    choices: [
                        { text: 'The upper transistor shields the lower from voltage variations', correct: true, explanation: 'Correct! Q2 holds Q1\'s collector at a constant voltage, reducing Early effect.' },
                        { text: 'The two transistors multiply the current gain', correct: false, explanation: 'Current gain isn\'t the mechanism - it\'s about output impedance.' },
                        { text: 'The cascode uses larger transistors', correct: false, explanation: 'Size doesn\'t determine the cascode advantage.' },
                        { text: 'Higher power supply voltage', correct: false, explanation: 'The topology, not supply, creates the improvement.' }
                    ]
                }
            ],
            4: [ // Expert - Filter and complex circuits
                {
                    id: 'L4-1',
                    type: 'circuit_waveform',
                    circuit: 'sallenKeyLowpass',
                    question: 'This Sallen-Key lowpass has fc = 1kHz. A 500Hz sine + 5kHz sine (equal amplitudes) is applied. What does Vout look like?',
                    inputDescription: '500Hz + 5kHz sine waves, equal amplitude',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Mostly 500Hz sine (5kHz heavily attenuated)',
                            waveform: { type: 'sine', freq: 500, amp: 1, phase: 0, description: '500Hz dominant' },
                            correct: true,
                            explanation: 'Correct! 500Hz is below fc (passes), 5kHz is above fc (attenuated by 2nd-order rolloff ≈ -40dB/decade).'
                        },
                        {
                            id: 'b',
                            label: 'Both frequencies equal amplitude',
                            waveform: { type: 'composite', description: '500Hz + 5kHz equal' },
                            correct: false,
                            explanation: '5kHz is 5× above fc, so it\'s heavily attenuated (>20dB for 2nd-order).'
                        },
                        {
                            id: 'c',
                            label: 'Mostly 5kHz sine (500Hz attenuated)',
                            waveform: { type: 'sine', freq: 5000, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'This is a lowpass filter - it passes LOW frequencies, attenuates HIGH.'
                        },
                        {
                            id: 'd',
                            label: 'DC output only',
                            waveform: { type: 'dc', amp: 0 },
                            correct: false,
                            explanation: '500Hz is below the cutoff and passes through.'
                        }
                    ]
                },
                {
                    id: 'L4-2',
                    type: 'circuit',
                    circuit: 'pushPullOutput',
                    question: 'For this push-pull output stage with ±15V supplies, calculate the maximum peak-to-peak output swing. Assume VCE(sat) = 1V.',
                    hint: 'Swing = (+Vcc - VCE(sat)) - (-Vcc + VCE(sat))',
                    expected: 28,
                    tolerance: 0.05,
                    unit: 'V',
                    solution: 'Max positive = +15 - 1 = +14V. Max negative = -15 + 1 = -14V. Swing = 28Vpp',
                    explanation: 'VCE(sat) limits how close the output can get to the rails.'
                },
                {
                    id: 'L4-3',
                    type: 'circuit_waveform',
                    circuit: 'pushPullOutput',
                    question: 'A 1kHz, 10V peak sine wave drives this push-pull stage with crossover distortion. What does Vout look like?',
                    inputDescription: '10V peak, 1kHz sine wave',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Sine with flat spots at zero crossings',
                            waveform: { type: 'crossover_distorted', freq: 1000, amp: 10 },
                            correct: true,
                            explanation: 'Correct! Crossover distortion appears as flat regions when neither transistor is conducting.'
                        },
                        {
                            id: 'b',
                            label: 'Perfect sine wave',
                            waveform: { type: 'sine', freq: 1000, amp: 10, phase: 0 },
                            correct: false,
                            explanation: 'Without bias, there\'s a dead zone where neither transistor conducts.'
                        },
                        {
                            id: 'c',
                            label: 'Clipped sine (top and bottom)',
                            waveform: { type: 'clipped_sine', freq: 1000, amp: 10 },
                            correct: false,
                            explanation: 'Clipping occurs at supply rails, not crossover distortion at zero.'
                        },
                        {
                            id: 'd',
                            label: 'Square wave',
                            waveform: { type: 'square', freq: 1000, amp: 10 },
                            correct: false,
                            explanation: 'Output follows input shape (distorted sine), not a square wave.'
                        }
                    ]
                }
            ]
        }
    },

    // ========== SET M: RC Circuit Waveforms ==========
    setM: {
        title: 'RC Circuits & Waveforms',
        levels: {
            1: [
                {
                    id: 'M1-1',
                    type: 'circuit_waveform',
                    circuit: 'rcLowpass',  // Simple RC lowpass
                    question: 'An RC lowpass filter (τ = 1ms) receives a 1kHz square wave input. What does Vout look like?',
                    inputDescription: '1kHz square wave (period = 1ms = τ)',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Triangle-ish wave (exponential charge/discharge)',
                            waveform: { type: 'rc_filtered_square', tau: 1, freq: 1000 },
                            correct: true,
                            explanation: 'Correct! When period ≈ τ, the capacitor partially charges/discharges each half-cycle, creating rounded exponential transitions.'
                        },
                        {
                            id: 'b',
                            label: 'Square wave (same as input)',
                            waveform: { type: 'square', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: 'RC filter smooths the sharp edges - it doesn\'t pass the square wave unchanged.'
                        },
                        {
                            id: 'c',
                            label: 'Nearly flat DC',
                            waveform: { type: 'dc', amp: 0.5 },
                            correct: false,
                            explanation: 'This would happen if τ >> period. Here τ ≈ period, so ripple is significant.'
                        },
                        {
                            id: 'd',
                            label: 'Spikes at transitions only',
                            waveform: { type: 'spikes', freq: 1000 },
                            correct: false,
                            explanation: 'Spikes are from differentiators (highpass), not integrators (lowpass).'
                        }
                    ]
                },
                {
                    id: 'M1-2',
                    type: 'circuit_waveform',
                    circuit: 'rcHighpass',
                    question: 'An RC highpass filter (τ = 0.1ms) receives a 100Hz square wave. What does Vout look like?',
                    inputDescription: '100Hz square wave (period = 10ms >> τ)',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Positive spike, decay, negative spike, decay',
                            waveform: { type: 'differentiated_square', tau: 0.1, freq: 100 },
                            correct: true,
                            explanation: 'Correct! Highpass differentiates - only passes transitions, then decays to zero.'
                        },
                        {
                            id: 'b',
                            label: 'Square wave (same as input)',
                            waveform: { type: 'square', freq: 100, amp: 1 },
                            correct: false,
                            explanation: 'Highpass blocks DC component - output must average to zero.'
                        },
                        {
                            id: 'c',
                            label: 'Sine wave',
                            waveform: { type: 'sine', freq: 100, amp: 1 },
                            correct: false,
                            explanation: 'Square wave input produces spike output, not sine.'
                        },
                        {
                            id: 'd',
                            label: 'Triangle wave',
                            waveform: { type: 'triangle', freq: 100, amp: 1 },
                            correct: false,
                            explanation: 'Triangle comes from integrating a square wave (lowpass), not differentiating.'
                        }
                    ]
                },
                {
                    id: 'M1-3',
                    type: 'numeric',
                    circuit: 'rcLowpass',
                    question: 'For an RC lowpass with R = 10kΩ, calculate C for a -3dB frequency of 1kHz.',
                    hint: 'fc = 1/(2πRC)',
                    expected: 15.9,
                    tolerance: 0.1,
                    unit: 'nF',
                    solution: 'C = 1/(2π × fc × R) = 1/(2π × 1kHz × 10kΩ) = 15.9nF',
                    explanation: 'This is the classic RC filter design equation.'
                }
            ],
            2: [
                {
                    id: 'M2-1',
                    type: 'circuit_waveform',
                    circuit: 'integrator',  // Op-amp integrator
                    question: 'An op-amp integrator receives a 1kHz square wave. What does Vout look like?',
                    inputDescription: '1kHz square wave, ±1V',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Triangle wave',
                            waveform: { type: 'triangle', freq: 1000, amp: 1 },
                            correct: true,
                            explanation: 'Correct! Integration of a constant (square wave level) gives a linear ramp. Alternating positive/negative constants give a triangle wave.'
                        },
                        {
                            id: 'b',
                            label: 'Square wave',
                            waveform: { type: 'square', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: 'Integrator changes the waveform shape - it doesn\'t pass it unchanged.'
                        },
                        {
                            id: 'c',
                            label: 'Sine wave',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'Integration of square gives triangle, not sine. Integration of sine gives cosine.'
                        },
                        {
                            id: 'd',
                            label: 'Spikes',
                            waveform: { type: 'spikes', freq: 1000 },
                            correct: false,
                            explanation: 'Spikes come from differentiation, not integration.'
                        }
                    ]
                },
                {
                    id: 'M2-2',
                    type: 'circuit_waveform',
                    circuit: 'differentiator',  // Op-amp differentiator
                    question: 'An op-amp differentiator receives a 1kHz triangle wave. What does Vout look like?',
                    inputDescription: '1kHz triangle wave',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Square wave',
                            waveform: { type: 'square', freq: 1000, amp: 1 },
                            correct: true,
                            explanation: 'Correct! Derivative of a ramp (constant slope) is a constant. Triangle has two slopes → square wave output.'
                        },
                        {
                            id: 'b',
                            label: 'Triangle wave',
                            waveform: { type: 'triangle', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: 'Differentiator changes the waveform - derivative of ramp is constant.'
                        },
                        {
                            id: 'c',
                            label: 'Sine wave',
                            waveform: { type: 'sine', freq: 1000, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'Differentiation of triangle gives square, not sine.'
                        },
                        {
                            id: 'd',
                            label: 'Spikes at peaks',
                            waveform: { type: 'spikes', freq: 1000 },
                            correct: false,
                            explanation: 'Sharp spikes would come from differentiating a square wave.'
                        }
                    ]
                },
                {
                    id: 'M2-3',
                    type: 'numeric',
                    circuit: 'integrator',
                    question: 'Op-amp integrator with R = 10kΩ, C = 100nF. A +1V DC step is applied. How long until Vout reaches -5V?',
                    hint: 'Vout = -(1/RC) × ∫Vin dt = -(Vin × t) / (RC)',
                    expected: 5,
                    tolerance: 0.1,
                    unit: 'ms',
                    solution: '-5V = -(1V × t) / (10kΩ × 100nF) → t = 5V × 1ms = 5ms',
                    explanation: 'The integrator ramps linearly with DC input at rate = Vin/(RC).'
                }
            ],
            3: [
                {
                    id: 'M3-1',
                    type: 'circuit_waveform',
                    circuit: 'rcLowpass',
                    question: 'An RC lowpass (τ = 0.1ms) receives a 10kHz sine wave. What does Vout look like compared to Vin?',
                    inputDescription: '10kHz sine wave (frequency >> 1/(2πτ))',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Attenuated sine, lagging by ~90°',
                            waveform: { type: 'sine', freq: 10000, amp: 0.15, phase: -84 },
                            correct: true,
                            explanation: 'Correct! At f >> fc, gain ≈ fc/f and phase → -90°. At 10kHz vs 1.6kHz cutoff, attenuation ≈ 0.16, phase ≈ -84°.'
                        },
                        {
                            id: 'b',
                            label: 'Same amplitude, in phase',
                            waveform: { type: 'sine', freq: 10000, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'High frequency is above cutoff - it gets attenuated.'
                        },
                        {
                            id: 'c',
                            label: 'Attenuated but in phase',
                            waveform: { type: 'sine', freq: 10000, amp: 0.15, phase: 0 },
                            correct: false,
                            explanation: 'RC lowpass adds phase lag, especially above cutoff.'
                        },
                        {
                            id: 'd',
                            label: 'DC only (sine completely filtered)',
                            waveform: { type: 'dc', amp: 0 },
                            correct: false,
                            explanation: 'There\'s still some output, just attenuated (~6:1).'
                        }
                    ]
                },
                {
                    id: 'M3-2',
                    type: 'circuit_waveform',
                    circuit: 'rcHighpass',
                    question: 'An RC highpass (fc = 1kHz) receives a 100Hz sine wave. What does Vout look like?',
                    inputDescription: '100Hz sine wave (f < fc)',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Attenuated sine, leading by ~90°',
                            waveform: { type: 'sine', freq: 100, amp: 0.1, phase: 84 },
                            correct: true,
                            explanation: 'Correct! Below cutoff: gain ≈ f/fc = 0.1, phase leads toward +90°.'
                        },
                        {
                            id: 'b',
                            label: 'Same amplitude, in phase',
                            waveform: { type: 'sine', freq: 100, amp: 1, phase: 0 },
                            correct: false,
                            explanation: 'Frequency below cutoff is attenuated by highpass filter.'
                        },
                        {
                            id: 'c',
                            label: 'Attenuated, lagging by 90°',
                            waveform: { type: 'sine', freq: 100, amp: 0.1, phase: -90 },
                            correct: false,
                            explanation: 'Highpass adds phase LEAD, not lag (opposite of lowpass).'
                        },
                        {
                            id: 'd',
                            label: 'No output',
                            waveform: { type: 'dc', amp: 0 },
                            correct: false,
                            explanation: 'There\'s still output, just attenuated by ~10× (20dB).'
                        }
                    ]
                }
            ],
            4: [
                {
                    id: 'M4-1',
                    type: 'circuit_waveform',
                    circuit: 'bandpassFilter',
                    question: 'A bandpass filter (fc = 1kHz, Q = 10) receives white noise. What does the output spectrum look like?',
                    inputDescription: 'White noise (flat spectrum)',
                    waveformChoices: [
                        {
                            id: 'a',
                            label: 'Narrow peak at 1kHz, steep rolloff both sides',
                            waveform: { type: 'bandpass_response', fc: 1000, Q: 10 },
                            correct: true,
                            explanation: 'Correct! Bandpass passes only frequencies near fc. High Q = narrow bandwidth.'
                        },
                        {
                            id: 'b',
                            label: 'Flat spectrum (noise passes through)',
                            waveform: { type: 'flat_spectrum' },
                            correct: false,
                            explanation: 'Bandpass filters, it doesn\'t pass all frequencies equally.'
                        },
                        {
                            id: 'c',
                            label: 'Notch at 1kHz',
                            waveform: { type: 'notch_response', fc: 1000 },
                            correct: false,
                            explanation: 'This describes a notch filter, which rejects a band rather than passing it.'
                        },
                        {
                            id: 'd',
                            label: 'Pure 1kHz sine wave',
                            waveform: { type: 'sine', freq: 1000, amp: 1 },
                            correct: false,
                            explanation: 'Output is still noise, just band-limited around 1kHz.'
                        }
                    ]
                },
                {
                    id: 'M4-2',
                    type: 'numeric',
                    question: 'A 2nd-order lowpass filter has fc = 10kHz and Q = 0.707 (Butterworth). At what frequency is the gain exactly -3dB?',
                    hint: 'For Butterworth, the -3dB point equals fc by definition',
                    expected: 10,
                    tolerance: 0.01,
                    unit: 'kHz',
                    solution: 'For Butterworth (Q = 0.707 = 1/√2), the -3dB frequency equals the cutoff frequency by definition: 10kHz',
                    explanation: 'Butterworth is "maximally flat" - the -3dB point defines the cutoff.'
                }
            ]
        }
    },

    // ===== UTILITY METHODS =====

    getSet(setId) {
        return this[setId];
    },

    getExercise(setId, level, index) {
        const set = this.getSet(setId);
        if (!set || !set.levels[level]) return null;
        return set.levels[level][index];
    },

    getExerciseById(id) {
        for (const setKey of Object.keys(this)) {
            if (setKey.startsWith('set')) {
                const set = this[setKey];
                for (const level of Object.keys(set.levels)) {
                    const ex = set.levels[level].find(e => e.id === id);
                    if (ex) return ex;
                }
            }
        }
        return null;
    },

    getAllSets() {
        return Object.keys(this)
            .filter(k => k.startsWith('set'))
            .map(k => ({ id: k, ...this[k] }));
    },

    getTotalCount() {
        let count = 0;
        for (const setKey of Object.keys(this)) {
            if (setKey.startsWith('set')) {
                const set = this[setKey];
                for (const level of Object.keys(set.levels)) {
                    count += set.levels[level].length;
                }
            }
        }
        return count;
    }
};

// Expose globally
window.EXERCISES = EXERCISES;
