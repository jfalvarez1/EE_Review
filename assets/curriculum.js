/**
 * Curriculum Data - Analog Design Refresher Course
 * 26 Modules, 359 Lessons, in teaching order.
 * Counts are derived at runtime from this array (CURRICULUM.totalModules /
 * CURRICULUM.totalLessons) - keep one entry here per lessons/module-NN/lesson-NN.html
 * file or the lesson will exist on disk but never appear in the sidebar.
 */

const CURRICULUM = {
    modules: [
        // ========== MODULE 1: Op-Amp Fundamentals ==========
        {
            id: 1,
            title: 'Op-Amp Fundamentals',
            description: 'Golden rules, basic configurations, real-world limitations',
            lessons: [
                {
                    id: 1,
                    title: 'The Ideal Amplifier',
                    description: 'Gain, Zin, Zout, and why there are exactly four kinds of amplifier',
                    topics: ['Four amplifier types', 'Source loading derivation', 'Zin/Rs error rule', 'Real input stages: LM358 to LMP7721']
                },
                {
                    id: 2,
                    title: 'Golden Rules and Basic Configurations',
                    description: 'Inverting, non-inverting, buffer, summing, difference',
                    topics: ['Rule I: Inputs draw no current', 'Rule II: V+ = V- with feedback', 'Gain formulas', 'Input/output impedance']
                },
                {
                    id: 3,
                    title: 'Integrator and Differentiator',
                    description: 'Time-domain processing with op-amps',
                    topics: ['Integrator: Vout = -(1/RC)∫Vin dt', 'DC drift prevention', 'Differentiator stability', 'Practical limits']
                },
                {
                    id: 4,
                    title: 'Bandwidth and Slew Rate',
                    description: 'GBW product, slew rate limiting, Bode plots',
                    topics: ['BW = GBW/Gain', 'Slew-limited response', 'Phase margin', 'Compensation']
                },
                {
                    id: 5,
                    title: 'DC Errors (Vos, Ib, Ios)',
                    description: 'Offset voltage, bias current, temperature effects',
                    topics: ['BJT vs JFET vs CMOS inputs', 'Error budget calculation', 'Bias current compensation', 'Tempco']
                },
                {
                    id: 6,
                    title: 'Power Supply Rejection Ratio (PSRR)',
                    description: 'Immunity to supply noise and ripple',
                    topics: ['PSRR definition', 'Frequency dependence', 'Design implications', 'Bypassing strategies']
                },
                {
                    id: 7,
                    title: 'Reading an Op-Amp Datasheet',
                    description: 'Every error term located on a real datasheet, and assembled into one number',
                    topics: ['Typ is not a specification; a blank max is a refusal to guarantee', 'Test conditions are part of the number', 'Ib doubles every 10 degC on FET inputs', 'CMRR and PSRR fall 20 dB/decade above the first pole', 'The error budget: worst case vs RSS', 'The rail-to-rail input handover step', 'Absolute maximum is survival, not operation']
                },
                {
                    id: 8,
                    title: 'Op-Amp Stability and Compensation',
                    description: 'Phase margin, dominant pole, and compensation',
                    topics: ['Loop gain analysis', 'Phase margin requirements', 'Compensation techniques', 'Capacitive loads']
                },
                {
                    id: 9,
                    title: 'Op-Amp Input Bias Current Compensation',
                    description: 'Matching resistors and compensation techniques',
                    topics: ['Bias current effects', 'Matching technique', 'FET vs BJT inputs', 'Error analysis']
                },
                {
                    id: 10,
                    title: 'Op-Amp Output Stage and Current Drive',
                    description: 'Output current capability and drive limitations',
                    topics: ['Output swing limits', 'Current limiting', 'Short-circuit protection', 'Boosting output current']
                },
                {
                    id: 11,
                    title: 'Fully Differential Amplifiers',
                    description: 'Differential I/O for ADC drivers and noise rejection',
                    topics: ['FDA architecture', 'Common-mode output', 'ADC driver design', 'Noise advantages']
                },
                {
                    id: 12,
                    title: 'Precision Rectifiers',
                    description: 'Ideal diode function with op-amps',
                    topics: ['Half-wave rectifier', 'Full-wave rectifier', 'Absolute value circuit', 'Recovery time']
                },
                {
                    id: 13,
                    title: 'Voltage References with Op-Amps',
                    description: 'Building stable voltage references',
                    topics: ['Reference buffering', 'Precision dividers', 'Temperature compensation', 'Noise filtering']
                },
                {
                    id: 14,
                    title: 'Composite Amplifiers',
                    description: 'Combining op-amps for improved performance',
                    topics: ['Gain × bandwidth extension', 'Precision composites', 'High-speed composites', 'Stability concerns']
                },
                {
                    id: 15,
                    title: 'Current Feedback Amplifiers (CFAs)',
                    description: 'Transimpedance-based amplifiers for high speed',
                    topics: ['CFA architecture', 'Gain-independent bandwidth', 'Feedback resistor selection', 'When to use CFAs']
                },
                {
                    id: 16,
                    title: 'Industry Op-Amp Selection Guide',
                    description: 'Choosing the right op-amp for your application',
                    topics: ['General purpose', 'Precision', 'High-speed', 'Low-power']
                },
                {
                    // Last in the module on purpose: it is a review of everything
                    // above it, in the form the material actually gets asked.
                    id: 17,
                    title: 'Interview Prep — Op-Amps',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['Derive from the golden rules', 'Trace a strange circuit', 'Noise gain', 'The standard traps']
                }
            ]
        },
        // ========== MODULE 2: Advanced Applications ==========
        {
            id: 2,
            title: 'Advanced Applications',
            description: 'Active filters, TIA, instrumentation amplifiers, noise',
            lessons: [
                {
                    id: 1,
                    title: 'Transimpedance Amplifiers (TIA)',
                    description: 'Butterworth, Chebyshev, Bessel responses',
                    topics: ['Filter type selection', 'Component value calculation', 'Cascading sections', 'Sensitivity analysis']
                },
                {
                    id: 2,
                    title: 'Instrumentation Amplifiers',
                    description: 'Photodiode interface design',
                    topics: ['Gain = Rf', 'Stability with Cpd', 'Compensation capacitor sizing', 'Noise gain peaking']
                },
                {
                    id: 3,
                    title: 'Active Filters',
                    description: 'Three op-amp topology, CMRR, bridge sensors',
                    topics: ['G = 1 + 2R/Rgain', 'High input impedance', 'Common-mode rejection', 'Bridge sensor interface']
                },
                {
                    id: 4,
                    title: 'Comparators and Schmitt Triggers',
                    description: 'Noise sources, noise budget, low-noise design',
                    topics: ['Voltage noise (en)', 'Current noise (in)', 'Thermal noise √(4kTR)', 'Total noise (RSS)']
                },
                {
                    id: 5,
                    title: 'Precision Peak Detectors',
                    description: 'Op-amp based peak detection for audio and RF',
                    topics: ['Diode drop elimination', 'Hold capacitor sizing', 'Decay time constant', 'Reset mechanisms']
                },
                {
                    id: 6,
                    title: 'Logarithmic and Exponential Amplifiers',
                    description: 'Log/antilog circuits for compression and computation',
                    topics: ['BJT log conformity', 'Temperature compensation', 'Dynamic range compression', 'Multiplier applications']
                },
                {
                    id: 7,
                    title: 'Gyrator Circuits (Simulated Inductors)',
                    description: 'Op-amp circuits that simulate inductance',
                    topics: ['L = R²C equivalence', 'Active filter applications', 'Audio equalizer use', 'Frequency response']
                },
                {
                    id: 8,
                    title: 'Sample and Hold Circuits',
                    description: 'Track/hold for ADC front-ends',
                    topics: ['Acquisition time', 'Droop rate', 'Aperture jitter', 'Charge injection']
                },
                {
                    id: 9,
                    title: 'Voltage-to-Current Converters',
                    description: 'V-to-I for 4-20mA loops and LED drivers',
                    topics: ['Grounded vs floating load', 'Transconductance', 'Current loop immunity', 'Howland current source']
                },
                {
                    id: 10,
                    title: 'Window Comparators',
                    description: 'Dual-threshold detection circuits',
                    topics: ['In-window/out-of-window logic', 'Hysteresis options', 'Fault monitoring', 'Production testing']
                },
                {
                    id: 11,
                    title: 'Analog Oscillators',
                    description: 'RC and LC oscillator design principles',
                    topics: ['Barkhausen criterion', 'Wien bridge', 'AGC for amplitude', 'Phase noise']
                },
                {
                    id: 12,
                    title: 'Phase-Locked Loops (PLL) Fundamentals',
                    description: 'PLL basics for frequency synthesis',
                    topics: ['Phase detector', 'Loop filter', 'VCO', 'Lock acquisition']
                },
                {
                    id: 13,
                    title: 'Analog Multipliers and Modulators',
                    description: 'Gilbert cell and translinear circuits',
                    topics: ['Four-quadrant multiplication', 'AM modulation', 'Frequency mixing', 'Power measurement']
                },
                {
                    id: 14,
                    title: 'Industry Advanced Applications Selection Guide',
                    description: 'Choosing the right topology for applications',
                    topics: ['Requirements analysis', 'IC selection criteria', 'Trade-off evaluation', 'Design validation']
                },
                {
                    id: 15,
                    title: 'Interview Prep — Filters, TIAs, Instrumentation and Noise',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['4 nV/rtHz per kohm', 'Q as positive feedback', 'Why an INA beats a difference amp', 'kT/C and where R cancels']
                },
                {
                    id: 16,
                    title: 'Noise: the Floor You Cannot Design Below',
                    description: 'Where noise comes from, which term dominates, and what to change',
                    topics: ['4 nV/rtHz per kohm', 'Ropt = en/in', 'Noise gain is not signal gain', 'ENBW = 1.57 x f3dB']
                }
            ]
        },
        // ========== MODULE 3: Feedback Theory & Stability ==========
        {
            id: 3,
            title: 'Feedback Theory & Stability',
            description: 'Rigorous treatment of feedback systems following Razavi and Agarwal methodology',
            lessons: [
                {
                    id: 1,
                    title: 'Feedback Fundamentals',
                    description: 'Open/closed loop gain, desensitization, loop gain',
                    topics: ['A/(1+Aβ) derivation', 'Sensitivity analysis', 'Gain-bandwidth product', 'Four effects of feedback']
                },
                {
                    id: 2,
                    title: 'Feedback Topologies',
                    description: 'Series-shunt, shunt-series, series-series, shunt-shunt',
                    topics: ['Input/output impedance effects', 'Topology identification', 'Loading effects', 'Practical examples']
                },
                {
                    id: 3,
                    title: 'Poles, Zeros and Bode Plots by Hand',
                    description: 'Building the plot stability analysis is read from, in under a minute and without a simulator',
                    topics: ['Time-constant form, and why root form cannot be sketched', 'The three primitives, added in dB and degrees', 'Sketch errors: 3.01 dB, 0.97 dB, 0.04 dB', 'Phase is two decades wide - the pole you cannot see', 'RHP zero: magnitude of a zero, phase of a pole', 'Crossover by counting decades', 'Reading a measured plot back into components']
                },
                {
                    id: 4,
                    title: 'Stability Analysis',
                    description: 'Bode plots, phase margin, gain margin',
                    topics: ['Barkhausen criterion', 'Phase/gain margin', 'Pole/zero effects', 'Capacitive load stability']
                },
                {
                    id: 5,
                    title: 'Compensation Techniques',
                    description: 'Dominant pole, Miller, lead-lag compensation',
                    topics: ['Pole splitting', 'Miller capacitor sizing', 'Lead compensation', 'Nested Miller']
                },
                {
                    id: 6,
                    title: 'Two-Stage Amplifier Compensation',
                    description: 'Miller compensation for multi-stage op-amps',
                    topics: ['741-style analysis', 'GBW vs CC tradeoff', 'Right-half-plane zero', 'Nulling resistor']
                },
                {
                    id: 7,
                    title: 'Stability with Reactive Loads',
                    description: 'Capacitive and inductive load handling',
                    topics: ['Isolation resistor', 'In-loop compensation', 'Snubber networks', 'Cable driving']
                },
                {
                    id: 8,
                    title: 'Power Supply Loop Stability',
                    description: 'Type I, II, III compensators for switching converters',
                    topics: ['Voltage-mode vs current-mode', 'Compensator design procedure', 'Optocoupler phase shift', 'Loop gain measurement']
                },
                {
                    id: 9,
                    title: 'Nyquist Stability Criterion',
                    description: 'Advanced stability analysis using Nyquist plots',
                    topics: ['Encirclement count', 'Conditionally stable systems', 'Right-half-plane poles', 'Gain/phase margin from Nyquist']
                },
                {
                    id: 10,
                    title: 'Root Locus Analysis',
                    description: 'Tracking poles as loop gain varies',
                    topics: ['Root locus rules', 'Breakaway points', 'Dominant pole design', 'Lead-lag placement']
                },
                {
                    id: 11,
                    title: 'Feedback Design Case Studies',
                    description: 'Complete worked examples from Razavi and Art of Electronics',
                    topics: ['Precision amplifier', 'High-speed buffer', 'Transimpedance amplifier', 'Power supply compensator']
                },
                {
                    id: 12,
                    title: 'Interview Prep — Feedback and Stability',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['Bode plot by hand', 'Why unity gain is the worst case', 'RHP zeros', 'Conditional stability']
                }
            ]
        },
        // ========== MODULE 4: Semiconductors and Diodes ==========
        {
            id: 4,
            title: 'Semiconductors and Diodes',
            description: 'Where 0.7 V, 26 mV and the exponential come from - and diodes at the level you actually use them',
            lessons: [
                {
                    id: 1,
                    title: 'The pn Junction and the Exponential',
                    description: 'VT = kT/q, the diode equation, 60 mV/decade, and the -2 mV/degC derived',
                    topics: ['VT = kT/q = 25.85 mV', 'Shockley equation and ideality factor', '60 mV per decade', 'rd = nVT/ID', 'Tempco derived from Eg']
                },
                {
                    id: 2,
                    title: 'Diodes in Practice: an Overview',
                    description: 'Rectification, clamping and protection at the level an engineer uses them',
                    topics: ['Ripple = I/(f·C)', 'Peak-to-average current ratio', 'Choosing a rectifier', 'TVS, Schottky clamps, why zeners faded']
                },
                {
                    id: 3,
                    title: 'Interview Prep — Semiconductors and Diodes',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['60 mV per decade', 'Why -2 mV/degC, and the bandgap', 'Average vs RMS vs peak', 'Schottky reverse runaway']
                }
            ]
        },
        // ========== MODULE 5: Transistor Intuition (BJT) ==========
        {
            id: 5,
            title: 'Transistor Intuition (BJT)',
            description: 'Device-level understanding of bipolar junction transistors',
            lessons: [
                {
                    id: 1,
                    title: 'BJT as Voltage-Controlled Current Source',
                    description: 'Ebers-Moll model, gm, re, temperature effects',
                    topics: ['IC vs VBE exponential curve', 'gm = IC/VT = 40×IC(mA)', 're = 25/IC(mA)', 'VBE drift: -2.1mV/°C']
                },
                {
                    id: 2,
                    title: 'The BJT Small-Signal Model',
                    description: 'gm, r-pi and ro derived from the exponential, and exactly how small a small signal has to be',
                    topics: ['Linearizing the exponential: the Taylor argument', 'gm = IC/VT, with no device parameter in it', 'r-pi = beta/gm and ro = VA/IC', 'Intrinsic gain gm*ro = VA/VT, independent of bias', 'The T-model and re = VT/IE', 'HD2 = Vpeak/4VT: the 1 mV rule, derived']
                },
                {
                    id: 3,
                    title: 'BJT High-Frequency AC Model',
                    description: 'Miller effect, fT, and hybrid-pi capacitances',
                    topics: ['Cπ and Cμ', 'Miller multiplication', 'Gain-bandwidth product', 'fT vs IC curve']
                },
                {
                    id: 4,
                    title: 'The Miller Effect, Derived',
                    description: 'Why four picofarads turns a 300 MHz transistor into a 215 kHz amplifier',
                    topics: ['Zin = Z/(1-Av), in four lines', 'Ceff = C(1+A) at the input, C(1+1/A) at the output', 'Open-circuit time constants as the cross-check', 'Gain-bandwidth = 1/2*pi*Rs*Cmu, independent of gain', 'The right-half-plane zero at gm/Cmu', 'Cascode, common-base, stiffer source, less gain']
                },
                {
                    id: 5,
                    title: 'DC Biasing Techniques',
                    description: 'Fixed, voltage-divider, and emitter bias',
                    topics: ['β-independent design', 'Stiffness rule', 'Thermal stability', 'Q-point calculation']
                },
                {
                    id: 6,
                    title: 'Common-Emitter Amplifier',
                    description: 'Gain, biasing, input/output impedance',
                    topics: ['G = -RC/(RE + re)', 'Voltage divider bias', 'Phase inversion', 'Clipping behavior']
                },
                {
                    id: 7,
                    title: 'Emitter Follower (Common-Collector)',
                    description: 'Unity gain buffer with high input impedance',
                    topics: ['Av ≈ 1', 'Zin = β(RE + re)', 'Zout = RS/β + re', 'Current gain']
                },
                {
                    id: 8,
                    title: 'Common-Base Amplifier',
                    description: 'Low input impedance, high frequency performance',
                    topics: ['Zin ≈ re', 'No Miller effect', 'Current buffer', 'Cascode lower device']
                },
                {
                    id: 9,
                    title: 'BJT as a Switch',
                    description: 'Saturation, cutoff, and switching times',
                    topics: ['Saturation conditions', 'Forced β', 'Storage time', 'Speed-up capacitor']
                },
                {
                    id: 10,
                    title: 'Cascode Amplifier',
                    description: 'CE-CB cascade for high bandwidth and gain',
                    topics: ['Miller elimination', 'Output impedance', 'Voltage gain', 'Folded cascode']
                },
                {
                    id: 11,
                    title: 'Differential Pair',
                    description: 'How the diff pair creates op-amp front-end',
                    topics: ['Transfer characteristic', 'Gdiff = RC/(2(RE + re))', 'CMRR with current source tail', 'Common-mode rejection']
                },
                {
                    id: 12,
                    title: 'Current Mirrors',
                    description: 'Simple, Wilson, and cascode configurations',
                    topics: ['Matched transistor principle', 'Output impedance comparison', 'Compliance range', 'Early effect']
                },
                {
                    id: 13,
                    title: 'BJT Active Loads',
                    description: 'Current source loads for high gain',
                    topics: ['Current source vs resistor', 'Gain = gm × ro', 'Output swing', 'Common-mode range']
                },
                {
                    id: 14,
                    title: 'Darlington and Sziklai Pairs',
                    description: 'Compound transistors for high β',
                    topics: ['β multiplication', 'VBE(sat) = 2VBE', 'Sziklai (complementary)', 'Speed vs gain']
                },
                {
                    id: 15,
                    title: 'BJT Frequency Response',
                    description: 'fT, fβ, and high-frequency limitations',
                    topics: ['Transition frequency', 'Miller effect', 'Hybrid-pi model', 'Bandwidth estimation']
                },
                {
                    id: 16,
                    title: 'BJT Amplifier Distortion',
                    description: 'Nonlinearity, harmonic distortion, and intermodulation',
                    topics: ['Exponential nonlinearity', 'THD analysis', 'Emitter degeneration', 'Feedback linearization']
                },
                {
                    id: 17,
                    title: 'BJT Noise Analysis',
                    description: 'Shot noise, thermal noise, 1/f noise',
                    topics: ['in² = 2qIC', 'Noise figure', 'Optimal collector current', 'Low-noise design']
                },
                {
                    id: 18,
                    title: 'Temperature Compensation Techniques',
                    description: 'Bias stability and drift cancellation',
                    topics: ['Diode compensation', 'PTAT currents', 'Matched pairs', 'Thermal tracking']
                },
                {
                    id: 19,
                    title: 'Multistage Amplifier Design',
                    description: 'Cascading gain stages, coupling, and feedback',
                    topics: ['DC coupling', 'Impedance matching', 'Overall gain', 'Feedback techniques']
                },
                {
                    id: 20,
                    title: 'BJT in Bandgap References',
                    description: 'PTAT + CTAT for stable voltage reference',
                    topics: ['ΔVBE generation', '1.2V reference', 'Temperature coefficient', 'Curvature correction']
                },
                {
                    id: 21,
                    title: 'BJT Current Limiters and Foldback Protection',
                    description: 'Overcurrent protection circuits',
                    topics: ['Simple current limit', 'Foldback characteristic', 'Safe operating area', 'Sense resistor']
                },
                {
                    id: 22,
                    title: 'BJT Oscillators',
                    description: 'Colpitts, Hartley, and crystal oscillators',
                    topics: ['Barkhausen criterion', 'Tank circuit', 'Start-up conditions', 'Amplitude limiting']
                },
                {
                    id: 23,
                    title: 'Emitter Follower Oscillation',
                    description: 'Parasitic oscillation and why output looks inductive',
                    topics: ['Inductive output impedance', 'Capacitive load instability', 'Base stopper resistor', 'Ferrite beads']
                },
                {
                    id: 24,
                    title: 'Wideband BJT Amplifiers',
                    description: 'Design for maximum bandwidth',
                    topics: ['Load capacitance reduction', 'Shunt peaking', 'Distributed amplifiers', 'Cherry-Hooper']
                },
                {
                    id: 25,
                    title: 'Low-Current BJT Operation',
                    description: 'Micropower design and β degradation',
                    topics: ['β vs IC at low currents', 'Leakage currents', 'fT reduction', 'Precision bias']
                },
                {
                    id: 26,
                    title: 'High-Current BJT Effects',
                    description: 'Kirk effect, β droop, and quasi-saturation',
                    topics: ['High-level injection', 'Base widening', 'Current crowding', 'fT degradation']
                },
                {
                    id: 27,
                    title: 'BJT SPICE Modeling',
                    description: 'Gummel-Poon model parameters and simulation',
                    topics: ['IS, BF, BR', 'Early voltage VA', 'Transit time TF', 'Capacitance parameters']
                },
                {
                    id: 28,
                    title: 'Translinear Circuits',
                    description: 'Log-domain signal processing with BJTs',
                    topics: ['Translinear principle', 'Analog multipliers', 'RMS-to-DC converters', 'Log amplifiers']
                },
                {
                    id: 29,
                    title: 'BJT Output Stages',
                    description: 'Class A, B, AB push-pull designs',
                    topics: ['Crossover distortion', 'Vbe multiplier bias', 'Thermal stability', 'Quasi-complementary']
                },
                {
                    id: 30,
                    title: 'BJT vs MOSFET Trade-offs',
                    description: 'When to use BJT over MOSFET and vice versa',
                    topics: ['gm per current', 'Input impedance', 'Noise performance', 'Matching']
                },
                {
                    id: 31,
                    title: 'High-Speed BJT Circuits',
                    description: 'ECL logic and fast switching',
                    topics: ['ECL gates', 'Non-saturating design', 'Current steering', 'Transmission line drivers']
                },
                {
                    id: 32,
                    title: 'BJT Bootstrapping Techniques',
                    description: 'Increasing input impedance and swing',
                    topics: ['Bootstrap capacitor', 'Constant current drive', 'Voltage swing extension', 'Stability considerations']
                },
                {
                    id: 33,
                    title: 'BJT in Feedback Amplifiers',
                    description: 'Series-shunt, shunt-series feedback topologies',
                    topics: ['Four feedback topologies', 'Gain desensitization', 'Bandwidth extension', 'Input/output impedance']
                },
                {
                    id: 34,
                    title: 'Precision BJT Matched Pairs',
                    description: 'Matched transistors for precision analog',
                    topics: ['VBE matching', 'Thermal coupling', 'MAT02/MAT03', 'Differential offset']
                },
                {
                    id: 35,
                    title: 'Power BJTs and Thermal Design',
                    description: 'SOA, thermal resistance, and heatsinking',
                    topics: ['Secondary breakdown', 'RθJC/RθJA', 'Thermal runaway', 'Derating curves']
                },
                {
                    id: 36,
                    title: 'Choosing a Transistor from a Datasheet',
                    description: 'Picking a part rather than recognising one - worked through until the answer is "use a MOSFET"',
                    topics: ['Beta: 3:1 guaranteed, a hump over current, +0.5%/degC', 'Design for beta-min AND for beta = infinity', 'BVCEO binds; BVEBO is the one that gets violated', 'Forced beta, and why datasheets use 10', 'Tj = Ta + Pd*RthJA, and why the front-page PD is a fiction', 'SOA and second breakdown in linear mode']
                },
                {
                    id: 37,
                    title: 'Industry BJT Selection Guide',
                    description: 'Choosing the right BJT for your application',
                    topics: ['2N3904/2N3906', 'BC547/BC557', 'Power transistors', 'RF transistors']
                },
                {
                    id: 38,
                    title: 'BJT Design Case Studies',
                    description: 'Real-world designs analyzed step by step',
                    topics: ['20V 5ns amplifier', 'Audio power amp', 'Precision current source', 'RF LNA design']
                },
                {
                    id: 39,
                    title: 'Design: A Current Mirror from a Datasheet',
                    description: 'An error budget against a real spec, and choosing the part that meets it',
                    topics: ['VBE mismatch = dVBE/VT', 'Matched pairs: 2N3904 vs BC847BS vs MAT12', 'Emitter degeneration: money or headroom', 'Early effect and the cascode fix']
                },
                {
                    id: 40,
                    title: 'Interview Prep — BJTs',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['gm = Ic/VT from the exponential', 'Gain as an impedance ratio', 'Miller and the cascode', 'Ranking current-mirror errors']
                }
            ]
        },
        // ========== MODULE 6: FET/MOSFET Fundamentals ==========
        {
            id: 6,
            title: 'FET/MOSFET Fundamentals',
            description: 'Device intuition, switching, biasing, and CMOS basics',
            lessons: [
                {
                    id: 1,
                    title: 'MOSFET Fundamentals',
                    description: 'Transfer curve, threshold, and gm intuition',
                    topics: ['ID vs VGS', 'Threshold and overdrive', 'gm intuition', 'Square-law vs reality']
                },
                {
                    id: 2,
                    title: 'MOSFET Small-Signal Model and gm',
                    description: 'Where gm comes from, and why it grows only as the square root of current',
                    topics: ['gm = sqrt(2k·ID) = 2ID/Vov', 'Square-root vs linear against the BJT', 'ro and intrinsic gain 2VA/Vov', 'Ciss/Coss/Crss to Cgs/Cgd']
                },
                {
                    id: 3,
                    title: 'The Common-Source Amplifier',
                    description: 'The FET voltage amplifier, and biasing it so the gain equation stays true',
                    topics: ['Av = -gm(RD||ro)', 'Source degeneration and -RD/RS', 'Worked 12 V design', 'Why fixed-VGS biasing fails on Vth spread']
                },
                {
                    id: 4,
                    title: 'The Source Follower (Common-Drain)',
                    description: 'The FET buffer, and the body effect that stops its gain reaching one',
                    topics: ['Av = gm/(gm+gmb+1/RS)', 'The 1/(1+chi) ceiling', 'Zout = 1/(gm+gmb)', 'Asymmetric slew, and why push-pull exists']
                },
                {
                    id: 5,
                    title: 'The Common-Gate Amplifier',
                    description: 'Low Zin by design, non-inverting gain, and no Miller effect at all',
                    topics: ['Zin = 1/(gm+gmb)', 'Current buffer, Ai = 1', 'Why there is no Miller', '50 ohm RF match', 'All three configurations compared']
                },
                {
                    id: 6,
                    title: 'What the Square Law Gets Wrong',
                    description: 'Where the model breaks: subthreshold, velocity saturation, and real Vth spread',
                    topics: ['Subthreshold exponential region', 'Velocity saturation and short channels', 'Channel-length modulation', 'Vth spread, matching and temperature']
                },
                {
                    id: 7,
                    title: 'Body Effect & Back Gate',
                    description: 'Threshold shift with VSB and gmb',
                    topics: ['Vth(VSB)', 'gmb path', 'Source follower headroom', 'Body diode']
                },
                {
                    id: 8,
                    title: 'MOSFET Amplifiers',
                    description: 'Common-source gain and biasing concepts',
                    topics: ['Common-source', 'Source degeneration', 'gm·RD gain', 'Bias networks']
                },
                {
                    id: 9,
                    title: 'MOSFET Current Mirrors',
                    description: 'Bias current generation for analog ICs',
                    topics: ['Diode-connected device', 'Channel-length modulation error', 'Cascode mirror', 'Compliance voltage']
                },
                {
                    id: 10,
                    title: 'CMOS Inverter Fundamentals',
                    description: 'VTC, noise margins, and dynamic power',
                    topics: ['VTC shape', 'Switching point', 'Dynamic energy', 'Short-circuit current']
                },
                {
                    id: 11,
                    title: 'MOSFET as a Switch',
                    description: 'Power switching concepts and losses',
                    topics: ['Conduction vs switching loss', 'SOA intuition', 'Gate charge', 'Layout sensitivity']
                },
                {
                    id: 12,
                    title: 'MOSFET Switching',
                    description: 'Regions of operation and switching behavior',
                    topics: ['Cutoff/Triode/Saturation', 'RDS(on)', 'Miller effect', 'Switching loss intuition']
                },
                {
                    id: 13,
                    title: 'Gate Drive Design',
                    description: 'Qg, Rg, Miller, and driver sizing',
                    topics: ['Qg/Vdrv/fsw power', 'Peak gate current', 'Ring/EMI control', 'Dedicated drivers']
                },
                {
                    id: 14,
                    title: 'MOSFET Gate Drivers',
                    description: 'Driving gate charge fast enough to keep switching loss down',
                    topics: ['Gate charge (Qg) curve', 'Driver topologies', 'Gate resistor selection', 'Ringing and shoot-through']
                },
                {
                    id: 15,
                    title: 'Body Diode and Synchronous Rectification',
                    description: 'Intrinsic diode behavior and replacing diodes with FETs',
                    topics: ['Body diode structure', 'Reverse recovery', 'Sync rect loss savings', 'Dead-time conduction']
                },
                {
                    id: 16,
                    title: 'MOSFET Safe Operating Area',
                    description: 'SOA limits and why linear-mode operation is dangerous',
                    topics: ['SOA diagram regions', 'Thermal vs Rds(on) limits', 'Spirito effect', 'Hot-swap sizing']
                },
                {
                    id: 17,
                    title: 'Power MOSFET Thermal Design',
                    description: 'Loss estimates and junction temperature',
                    topics: ['I^2R loss', 'Switching loss', 'RθJA/JC', 'Thermal margins']
                },
                {
                    id: 18,
                    title: 'Thermal Management for Power MOSFETs',
                    description: 'Thermal resistance networks and PCB heat spreading',
                    topics: ['Rth thermal-electrical analogy', 'Rtheta-JA vs JC', 'Copper pour and vias', 'Heatsink selection']
                },
                {
                    id: 19,
                    title: 'MOSFET Paralleling Techniques',
                    description: 'Sharing current between devices, statically and dynamically',
                    topics: ['Static sharing via Rds(on)', 'Dynamic mismatch', 'Kelvin source connection', 'Per-device gate resistors']
                },
                {
                    id: 20,
                    title: 'Avalanche Energy and MOSFET Ruggedness',
                    description: 'Surviving inductive turn-off without a freewheel path',
                    topics: ['Avalanche breakdown', 'E = 1/2 L I^2', 'EAS vs EAR ratings', 'Unclamped inductive switching']
                },
                {
                    id: 21,
                    title: 'Current Sensing Techniques with MOSFETs',
                    description: 'Sense resistors versus Rds(on) sensing',
                    topics: ['Sense resistor sizing', 'Burden voltage', 'Rds(on) tempco error', 'High-side vs low-side']
                },
                {
                    id: 22,
                    title: 'Wide Bandgap Semiconductors (GaN and SiC)',
                    description: 'What GaN and SiC change versus silicon',
                    topics: ['2DEG / HEMT structure', 'GaN device types', 'Gate voltage limits', 'SiC advantages']
                },
                {
                    id: 23,
                    title: 'MOSFET Applications',
                    description: 'Current sources, analog switches, and blocks',
                    topics: ['Current source/sink', 'Transmission gate intuition', 'Body diode', 'Tradeoffs']
                },
                {
                    id: 24,
                    title: 'MOSFET Selection for Power Applications',
                    description: 'Picking a part from the datasheet numbers that matter',
                    topics: ['Key selection parameters', 'Rds(on) vs Qg trade-off', 'Conduction + switching loss', 'Package choice']
                },
                {
                    id: 25,
                    title: 'Industry MOSFET Selection Guide',
                    description: 'A repeatable process for choosing a switch',
                    topics: ['Figure of merit (Rds(on) x Qg)', 'Current derating', 'Logic level vs standard gate', '48 V system considerations']
                },
                {
                    id: 26,
                    title: 'Interview Prep — MOSFETs',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['gm goes as sqrt(Id)', 'Body effect and the source follower', 'Three loss terms', 'Cdv/dt turn-on']
                }
            ]
        },
        // ========== MODULE 7: Output Stages & Complementary Circuits ==========
        {
            id: 7,
            title: 'Output Stages & Complementary Circuits',
            description: 'Push-pull, CMOS, open-drain, current sources',
            lessons: [
                {
                    id: 1,
                    title: 'Push-Pull Output Stages',
                    description: 'Class B/AB, crossover distortion, biasing',
                    topics: ['NPN/PNP complementary pair', 'Crossover distortion', 'Diode biasing', 'Quiescent current']
                },
                {
                    id: 2,
                    title: 'Class AB Push-Pull Output Stages',
                    description: 'Inverter, shoot-through, dynamic power',
                    topics: ['PMOS pulls HIGH', 'NMOS pulls LOW', 'Transition current', 'Power dissipation']
                },
                {
                    id: 3,
                    title: 'Rail-to-Rail Output Stages',
                    description: 'Pull-up sizing, wired-AND, level shifting',
                    topics: ['When to use', 'Rise time calculation', 'I2C bus', 'Power trade-off']
                },
                {
                    id: 4,
                    title: 'Output Protection Circuits',
                    description: 'Simple mirror, cascode, Wilson',
                    topics: ['Output impedance', 'Compliance range', 'MOSFET current sources', 'Accuracy']
                },
                {
                    id: 5,
                    title: 'Class AB Biasing Techniques',
                    description: 'Eliminating crossover distortion',
                    topics: ['Biasing goals', 'Vbe multiplier', 'Thermal tracking', 'Quiescent current']
                },
                {
                    id: 6,
                    title: 'Totem-Pole and H-Bridge Drivers',
                    description: 'Bidirectional power stage driving',
                    topics: ['Totem-pole features', 'H-bridge topology', 'Dead time', 'Shoot-through prevention']
                },
                {
                    id: 7,
                    title: 'Gate Drivers and Bootstrap Circuits',
                    description: 'Driving high-side MOSFETs',
                    topics: ['Gate driver requirements', 'Bootstrap operation', 'Charge pump', 'Refresh requirements']
                },
                {
                    id: 8,
                    title: 'Level Shifters for Output Stages',
                    description: 'Voltage translation for power stages',
                    topics: ['Level shifting needs', 'MOSFET methods', 'Dedicated ICs', 'Speed considerations']
                },
                {
                    id: 9,
                    title: 'Current Limiting and Protection',
                    description: 'Overcurrent protection circuits',
                    topics: ['Protection types', 'Current sensing', 'Foldback limiting', 'Fast shutdown']
                },
                {
                    id: 10,
                    title: 'Cascode and Darlington Configurations',
                    description: 'Compound transistor configurations',
                    topics: ['Cascode benefits', 'Darlington gain', 'Sziklai pair', 'Speed vs gain']
                },
                {
                    id: 11,
                    title: 'Power MOSFET Selection',
                    description: 'Choosing MOSFETs for power stages',
                    topics: ['Key parameters', 'Rds(on) vs Qg', 'Package selection', 'SOA considerations']
                },
                {
                    id: 12,
                    title: 'IGBT Selection and Drive',
                    description: 'High-power IGBT applications',
                    topics: ['IGBT advantages', 'Gate drive requirements', 'Turn-off control', 'Short-circuit rating']
                },
                {
                    id: 13,
                    title: 'Parallel and Series Connected Devices',
                    description: 'Multi-device power stages',
                    topics: ['Parallel connection', 'Series connection', 'Current sharing', 'Voltage sharing']
                },
                {
                    id: 14,
                    title: 'Thermal Design for Output Stages',
                    description: 'Heatsinking and thermal management',
                    topics: ['Thermal goals', 'Heatsink selection', 'Thermal interface', 'Temperature monitoring']
                },
                {
                    id: 15,
                    title: 'Interview Prep — Output Stages',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['Worst heat is at 63% swing', 'Bolt the bias to the heatsink', 'Foldback and its start-up trap', 'Reactive load lines and SOA']
                }
            ]
        },
        // ========== MODULE 8: Advanced Analog Blocks ==========
        {
            id: 8,
            title: 'Advanced Analog Blocks',
            description: 'PLL, bandgap references, precision techniques',
            lessons: [
                {
                    id: 1,
                    title: 'Phase-Locked Loop (PLL) Basics',
                    description: 'Block diagram, frequency synthesis',
                    topics: ['fout = N × fref', 'Phase detector', 'Loop filter', 'Lock time']
                },
                {
                    id: 2,
                    title: 'Bandgap Voltage References',
                    description: 'PTAT + CTAT combination',
                    topics: ['VBE tempco', 'ΔVBE PTAT', '1.2V reference', 'Curvature compensation']
                },
                {
                    id: 3,
                    title: 'Precision Analog Techniques',
                    description: 'Chopper, auto-zero, correlated double sampling',
                    topics: ['Offset cancellation', 'Chopper ripple', 'Bandwidth limit', 'kT/C noise']
                },
                {
                    id: 4,
                    title: 'Log/Antilog Amplifiers',
                    description: 'Logarithmic compression and expansion circuits',
                    topics: ['BJT log conformity', 'Temperature compensation', 'Dynamic range compression', 'Multiplier/divider applications']
                },
                {
                    id: 5,
                    title: 'Sample and Hold Circuits',
                    description: 'Acquisition time, droop rate, and aperture jitter',
                    topics: ['Track/hold modes', 'Droop rate calculation', 'Aperture jitter', 'Feedthrough rejection']
                },
                {
                    id: 6,
                    title: 'Analog Multiplexers',
                    description: 'Channel selection, on-resistance, charge injection',
                    topics: ['Ron vs signal voltage', 'Break-before-make timing', 'Charge injection', 'Crosstalk']
                },
                {
                    id: 7,
                    title: 'Peak Detectors',
                    description: 'Envelope detection and peak hold circuits',
                    topics: ['Diode peak detector', 'Op-amp precision detector', 'Decay time constant', 'Reset mechanisms']
                },
                {
                    id: 8,
                    title: 'Voltage-Controlled Oscillators and Filters',
                    description: 'Voltage-controlled oscillators and filters',
                    topics: ['VCO gain (Hz/V)', 'Linearity requirements', 'VCF tuning range', 'OTA-based implementations']
                },
                {
                    id: 9,
                    title: 'Charge Pumps',
                    description: 'Voltage multiplication and inversion circuits',
                    topics: ['Dickson charge pump', 'Voltage doubler/inverter', 'Output impedance', 'Ripple reduction']
                },
                {
                    id: 10,
                    title: 'Analog Computation Circuits',
                    description: 'Multipliers, dividers, and RMS-to-DC converters',
                    topics: ['Gilbert cell multiplier', 'Log-antilog divider', 'True RMS detection', 'Thermal RMS converters']
                }
            ]
        },
        // ========== MODULE 9: Oscillators & Timing Circuits ==========
        {
            id: 9,
            title: 'Oscillators & Timing Circuits',
            description: 'LC, RC, crystal oscillators, 555 timer, Schmitt triggers',
            lessons: [
                {
                    id: 1,
                    title: 'LC Oscillators (Colpitts, Hartley)',
                    description: 'Barkhausen criterion, frequency calculation',
                    topics: ['Loop gain ≥ 1', 'Phase shift = 0°', 'Colpitts vs Hartley', 'Tank circuit']
                },
                {
                    id: 2,
                    title: 'RC Oscillators (Wien Bridge)',
                    description: 'Gain requirements, amplitude stabilization',
                    topics: ['fosc = 1/(2πRC)', 'Gain = 3 exactly', 'AGC', 'Lamp stabilization']
                },
                {
                    id: 3,
                    title: 'Crystal Oscillators',
                    description: 'Equivalent circuit, series/parallel resonance',
                    topics: ['Q > 10,000', 'Frequency stability', 'Pierce circuit', 'Load capacitance']
                },
                {
                    id: 4,
                    title: '555 Timer Circuits',
                    description: 'Astable and monostable configurations',
                    topics: ['Frequency formula', 'Duty cycle', 'Pulse width', 'Timing accuracy']
                },
                {
                    id: 5,
                    title: 'Schmitt Triggers & Hysteresis',
                    description: 'Noise immunity, threshold design',
                    topics: ['VUT and VLT', 'Hysteresis calculation', 'Debouncing', 'Square from sine']
                },
                {
                    id: 6,
                    title: 'PLL Fundamentals',
                    description: 'Phase-locked loop architecture',
                    topics: ['PLL components', 'Phase detector', 'Loop filter', 'VCO control']
                },
                {
                    id: 7,
                    title: 'Jitter and Phase Noise',
                    description: 'Timing uncertainty analysis',
                    topics: ['Time domain jitter', 'Frequency domain phase noise', 'Sources', 'Measurement']
                },
                {
                    id: 8,
                    title: 'Clock Distribution Networks',
                    description: 'Clock tree design and skew management',
                    topics: ['Key challenges', 'Buffer selection', 'Topology', 'Skew minimization']
                },
                {
                    id: 9,
                    title: 'Delay Lines and Phase Shifters',
                    description: 'Precision timing adjustment',
                    topics: ['Delay applications', 'Analog delay lines', 'Digital delays', 'Phase interpolation']
                },
                {
                    id: 10,
                    title: 'Clock Domain Crossing',
                    description: 'Safe data transfer between clock domains',
                    topics: ['CDC challenges', 'Synchronizers', 'FIFO crossing', 'Gray coding']
                },
                {
                    id: 11,
                    title: 'Real-Time Clocks and Timekeeping',
                    description: 'RTC design and backup power',
                    topics: ['RTC features', 'Crystal selection', 'Backup power', 'Calendar functions']
                },
                {
                    id: 12,
                    title: 'Watchdog Timers',
                    description: 'System health monitoring',
                    topics: ['Watchdog functions', 'Windowed operation', 'Reset behavior', 'Implementation']
                },
                {
                    id: 13,
                    title: 'PWM Generation and Timing',
                    description: 'Pulse width modulation circuits',
                    topics: ['PWM applications', 'Timer architecture', 'Resolution', 'Deadtime insertion']
                },
                {
                    id: 14,
                    title: 'Input Capture and Frequency Measurement',
                    description: 'External timing measurement',
                    topics: ['Applications', 'Capture modes', 'Accuracy', 'Edge detection']
                },
                {
                    id: 15,
                    title: 'Spread Spectrum Clocking',
                    description: 'EMI reduction through frequency modulation',
                    topics: ['SSC benefits', 'Modulation profiles', 'EMI compliance', 'System impacts']
                }
            ]
        },
        // ========== MODULE 10: Practical Skills ==========
        {
            id: 10,
            title: 'Practical Skills',
            description: 'Oscilloscope, PCB layout, troubleshooting workflow',
            lessons: [
                {
                    id: 1,
                    title: 'Oscilloscope Techniques',
                    description: 'Probing, measurements, common mistakes',
                    topics: ['Probe compensation', 'Bandwidth requirements', 'Ground lead length', 'Common errors']
                },
                {
                    id: 2,
                    title: 'Component Selection',
                    description: 'Ground planes, bypass caps, analog/digital separation',
                    topics: ['Single ground plane', 'Partition (not split)', 'Bypass cap placement', 'Trace routing']
                },
                {
                    id: 3,
                    title: 'PCB Layout for Analog Circuits',
                    description: 'Systematic debugging approach',
                    topics: ['Power → Bias → Signal → Load', 'Common symptoms', 'Quick fix patterns', 'Isolation techniques']
                },
                {
                    id: 4,
                    title: 'Soldering and Rework Techniques',
                    description: 'Hand soldering, SMD rework, IPC standards',
                    topics: ['Good solder joint', 'SMD rework', 'Common defects', 'IPC standards']
                },
                {
                    id: 5,
                    title: 'Test Equipment Essentials',
                    description: 'Multimeters, LCR meters, power supplies',
                    topics: ['Core equipment', 'Measurement accuracy', 'Equipment calibration', 'Safety considerations']
                },
                {
                    id: 6,
                    title: 'Signal Integrity Basics',
                    description: 'Transmission lines, reflections, crosstalk',
                    topics: ['Critical speed', 'Impedance matching', 'Termination', 'Eye diagrams']
                },
                {
                    id: 7,
                    title: 'Thermal Design and Heat Management',
                    description: 'Thermal resistance, derating, cooling',
                    topics: ['Thermal resistance network', 'Junction temperature', 'Heatsink selection', 'Forced air cooling']
                },
                {
                    id: 8,
                    title: 'EMC/EMI Fundamentals',
                    description: 'Emissions, immunity, and compliance',
                    topics: ['EMI sources', 'EMC standards', 'Filtering techniques', 'Shielding']
                },
                {
                    id: 9,
                    title: 'Prototyping Best Practices',
                    description: 'Breadboard to PCB transitions',
                    topics: ['Prototyping stages', 'Component selection', 'Test points', 'Design for debug']
                },
                {
                    id: 10,
                    title: 'Debugging Analog Circuits',
                    description: 'Systematic analog troubleshooting',
                    topics: ['First rule', 'DC operating point', 'Signal tracing', 'Common failures']
                },
                {
                    id: 11,
                    title: 'Documentation and Schematics',
                    description: 'Professional schematic and documentation practices',
                    topics: ['Schematic best practices', 'BOM creation', 'Design notes', 'Revision control']
                },
                {
                    id: 12,
                    title: 'Design for Manufacturing (DFM)',
                    description: 'Manufacturing-ready design practices',
                    topics: ['DFM goal', 'Component placement', 'Panelization', 'Test coverage']
                },
                {
                    id: 13,
                    title: 'Environmental Testing and Reliability',
                    description: 'Temperature, humidity, and vibration testing',
                    topics: ['Environmental stresses', 'HALT/HASS', 'Reliability prediction', 'Failure analysis']
                },
                {
                    id: 14,
                    title: 'Interview Prep — Measurement and Debug',
                    description: '"Here is a board that does not work" — the question the decision turns on',
                    topics: ['Power first, at the pin', 'Bisect, do not sweep', 'Validate the instrument', 'A rare failure is a distribution']
                }
            ]
        },
        // ========== MODULE 11: Design Trade-offs Workshop ==========
        {
            id: 11,
            title: 'Design Trade-offs Workshop',
            description: 'Performance-Power-Cost triangle, component selection',
            lessons: [
                {
                    id: 1,
                    title: 'Speed vs Accuracy Trade-offs',
                    description: 'Fundamental constraints in analog design',
                    topics: ['Performance', 'Power', 'Cost', 'Can optimize any two']
                },
                {
                    id: 2,
                    title: 'Power vs Performance Trade-offs',
                    description: 'Matching op-amp to application requirements',
                    topics: ['Primary constraint', 'Family selection', 'Trade-off awareness', 'Real examples']
                },
                {
                    id: 3,
                    title: 'Cost vs Performance Trade-offs',
                    description: 'Resistor and capacitor tolerances, tempco',
                    topics: ['Tolerance requirements', 'Tempco matching', 'Capacitor types', 'Cost vs precision']
                },
                {
                    id: 4,
                    title: 'System-Level Trade-offs',
                    description: 'Allocating power across subsystems',
                    topics: ['System power budget', 'Sleep current', 'Duty cycle', 'Active vs idle']
                },
                {
                    id: 5,
                    title: 'Noise vs Bandwidth Trade-offs',
                    description: 'Fundamental noise-bandwidth relationship',
                    topics: ['Key relationships', 'Noise integration', 'Filtering trade-offs', 'Optimal bandwidth']
                },
                {
                    id: 6,
                    title: 'Size vs Performance Trade-offs',
                    description: 'Component size impact on performance',
                    topics: ['Size impacts', 'Parasitics', 'Thermal constraints', 'Miniaturization limits']
                },
                {
                    id: 7,
                    title: 'Stability vs Transient Response Trade-offs',
                    description: 'Phase margin and response optimization',
                    topics: ['Stability metrics', 'Transient response', 'Compensation trade-offs', 'Design criteria']
                },
                {
                    id: 8,
                    title: 'Analog vs Digital Implementation Trade-offs',
                    description: 'When to use analog vs digital processing',
                    topics: ['Analog advantages', 'Digital advantages', 'Hybrid systems', 'Cost considerations']
                },
                {
                    id: 9,
                    title: 'Resolution vs Speed Trade-offs',
                    description: 'ADC/DAC resolution and sample rate balance',
                    topics: ['Resolution factors', 'Speed factors', 'ADC architecture selection', 'System optimization']
                },
                {
                    id: 10,
                    title: 'Efficiency vs Linearity Trade-offs',
                    description: 'Amplifier efficiency and distortion balance',
                    topics: ['Efficiency metrics', 'Linearity metrics', 'Class selection', 'Predistortion']
                },
                {
                    id: 11,
                    title: 'EMI vs Performance Trade-offs',
                    description: 'EMI mitigation impact on circuit performance',
                    topics: ['EMI sources', 'Mitigation costs', 'Edge rate control', 'Shielding trade-offs']
                },
                {
                    id: 12,
                    title: 'Reliability vs Cost Trade-offs',
                    description: 'Component derating and reliability investment',
                    topics: ['Reliability factors', 'Derating strategies', 'Warranty costs', 'Design lifetime']
                },
                {
                    id: 13,
                    title: 'Thermal Management Trade-offs',
                    description: 'Cooling solutions and their trade-offs',
                    topics: ['Heat sources', 'Cooling methods', 'Cost vs performance', 'Size constraints']
                },
                {
                    id: 14,
                    title: 'Design Margin and Derating',
                    description: 'Setting appropriate design margins',
                    topics: ['Why derate', 'Derating guidelines', 'Application factors', 'Margin analysis']
                }
            ]
        },
        // ========== MODULE 12: Practice Problems & Exercises ==========
        {
            id: 12,
            title: 'Practice Problems & Exercises',
            description: '10 problem sets with progressive difficulty',
            lessons: [
                {
                    id: 1,
                    title: 'Problem Set 1: BJT Basics',
                    description: 'Simple → Medium → Complex progression',
                    topics: ['Bias point calculation', 'CE amplifier design', 'Temperature effects']
                },
                {
                    id: 2,
                    title: 'Problem Set 2: Op-Amp Applications',
                    description: 'Gain, filters, TIA design',
                    topics: ['Inverting/non-inverting', 'Sallen-Key filter', 'TIA stability']
                },
                {
                    id: 3,
                    title: 'Problem Set 3: MOSFET Circuits',
                    description: 'Switches, current mirrors, power',
                    topics: ['RDS(on) calculation', 'Analog switch', 'Buck converter FET']
                },
                {
                    id: 4,
                    title: 'Problem Set 4: Communication Interfaces',
                    description: 'I2C, SPI, level shifting',
                    topics: ['Pull-up sizing', 'Level shifter design', 'Timing analysis']
                },
                {
                    id: 5,
                    title: 'Problem Set 5: System Design Challenge',
                    description: 'Integration, debugging, optimization',
                    topics: ['Sensor interface', 'Error budget', 'Power optimization']
                },
                {
                    id: 6,
                    title: 'Problem Set 6: Power Electronics',
                    description: 'Buck, boost, and flyback converter calculations',
                    topics: ['Inductor sizing', 'Capacitor selection', 'Efficiency calculation', 'Thermal analysis']
                },
                {
                    id: 7,
                    title: 'Problem Set 7: Oscillator Design',
                    description: 'LC, RC, and crystal oscillator problems',
                    topics: ['Barkhausen criterion', 'Frequency calculation', 'Start-up conditions', 'Phase noise']
                },
                {
                    id: 8,
                    title: 'Problem Set 8: Mixed-Signal Design',
                    description: 'ADC/DAC interface and signal conditioning',
                    topics: ['Anti-aliasing filter', 'Driver design', 'Reference selection', 'Noise budget']
                },
                {
                    id: 9,
                    title: 'Problem Set 9: Thermal Design',
                    description: 'Heat dissipation and thermal management',
                    topics: ['Thermal resistance', 'Junction temperature', 'Heatsink sizing', 'Derating']
                },
                {
                    id: 10,
                    title: 'Problem Set 10: EMC/EMI Design',
                    description: 'Filter design and shielding calculations',
                    topics: ['Common-mode filter', 'Shielding effectiveness', 'Conducted emissions', 'Radiated emissions']
                },
                {
                    id: 11,
                    title: 'BJT Operating Regions & Practical Effects',
                    description: 'BJT and FET bias calculations',
                    topics: ['Level 1: VBE/gm calculation', 'Level 2: CE amplifier design', 'Level 3: Temperature effects', 'Level 4: Matching optimization']
                },
                {
                    id: 12,
                    title: 'MOSFET Parasitics & Gate Drive',
                    description: 'Gain, bandwidth, stability',
                    topics: ['Level 1: Gain calculation', 'Level 2: Filter design', 'Level 3: Stability analysis', 'Level 4: Noise optimization']
                },
                {
                    id: 13,
                    title: 'Op-Amp Stability & Compensation',
                    description: 'Buck, LDO, efficiency',
                    topics: ['Level 1: Dropout calculation', 'Level 2: Inductor sizing', 'Level 3: Transient response', 'Level 4: Thermal design']
                },
                {
                    id: 14,
                    title: 'Power Supply Noise & PSRR',
                    description: 'ADC/DAC interface design',
                    topics: ['Level 1: Resolution/LSB', 'Level 2: Driver design', 'Level 3: Error budget', 'Level 4: Noise analysis']
                },
                {
                    id: 15,
                    title: 'Design Exercise: Precision Sensor Amplifier',
                    description: 'Transmission lines, termination, crosstalk',
                    topics: ['Level 1: Rise time/BW', 'Level 2: Termination', 'Level 3: Crosstalk', 'Level 4: Eye diagram']
                }
            ]
        },
        // ========== MODULE 13: Power Electronics Applications ==========
        {
            id: 13,
            title: 'Power Electronics Applications',
            description: 'MOSFET selection, buck converters, LDO, PMIC',
            lessons: [
                {
                    id: 1,
                    title: 'Linear Regulators',
                    description: 'RDS(on) vs Qg trade-off, loss calculation',
                    topics: ['Conduction loss', 'Switching loss', 'Gate charge', 'SOA']
                },
                {
                    id: 2,
                    title: 'Buck Converter Basics',
                    description: 'Vout = D×Vin, inductor current ripple',
                    topics: ['Duty cycle control', 'CCM vs DCM', 'Output ripple', 'Inductor sizing']
                },
                {
                    id: 3,
                    title: 'Boost (Step-Up) Converter',
                    description: 'Dropout, PSRR, noise, efficiency',
                    topics: ['When to use LDO', 'Dropout voltage', 'PSRR vs frequency', 'Thermal limits']
                },
                {
                    id: 4,
                    title: 'Flyback and Isolated Topologies',
                    description: 'Integrated power management for portable devices',
                    topics: ['Multiple rails', 'Sequencing', 'Battery charging', 'Power path']
                },
                {
                    id: 5,
                    title: 'Buck-Boost and SEPIC Converters',
                    description: 'Converters for overlapping input/output ranges',
                    topics: ['Buck-boost topology', 'SEPIC advantages', 'Battery applications', 'Continuous conduction']
                },
                {
                    id: 6,
                    title: 'Synchronous Rectification',
                    description: 'MOSFET-based rectification for efficiency',
                    topics: ['Diode vs MOSFET', 'Dead time control', 'Body diode conduction', 'Efficiency improvement']
                },
                {
                    id: 7,
                    title: 'Control Loop Fundamentals',
                    description: 'Voltage-mode and current-mode control',
                    topics: ['Control objectives', 'Voltage-mode', 'Current-mode', 'Compensation']
                },
                {
                    id: 8,
                    title: 'Power Factor Correction (PFC)',
                    description: 'AC input current shaping for compliance',
                    topics: ['Power factor definition', 'Harmonic distortion', 'Active PFC', 'Standards compliance']
                },
                {
                    id: 9,
                    title: 'Soft Switching and Resonant Converters',
                    description: 'ZVS and ZCS for high-frequency operation',
                    topics: ['Hard switching losses', 'Zero voltage switching', 'Zero current switching', 'LLC resonant']
                },
                {
                    id: 10,
                    title: 'EMI/EMC in Power Converters',
                    description: 'EMI sources and mitigation in switching supplies',
                    topics: ['EMI emission types', 'Input filtering', 'Spread spectrum', 'Snubbers']
                },
                {
                    id: 11,
                    title: 'Thermal Design for Power Converters',
                    description: 'Heat management in power electronics',
                    topics: ['Heat sources', 'Thermal resistance', 'Heatsink selection', 'Thermal interface']
                },
                {
                    id: 12,
                    title: 'Power Sequencing and Hot-Swap',
                    description: 'Controlled power-up and live insertion',
                    topics: ['Sequence requirements', 'Hot-swap protection', 'Inrush limiting', 'Fault detection']
                },
                {
                    id: 13,
                    title: 'Battery Charging Systems',
                    description: 'Li-Ion/LiPo charging profiles and safety',
                    topics: ['Li-Ion characteristics', 'CC/CV charging', 'Battery protection', 'Charging ICs']
                },
                {
                    id: 14,
                    title: 'Digital Power Control and Multi-Phase VRMs',
                    description: 'Modern power management for processors',
                    topics: ['Multi-phase benefits', 'Digital control', 'Current sharing', 'VRM specifications']
                },
                {
                    id: 15,
                    title: 'Multiphase and Coupled-Inductor Voltage Regulators',
                    description: 'What a processor rail actually uses, and what changed to make the textbook buck obsolete for it',
                    topics: ['K = 0 at D = k/N', 'Ltr = L(1+rho)', 'TLVR and the shared loop', '48 V, vertical delivery, load line']
                }
            ]
        },
        // ========== MODULE 14: Power Supply Design ==========
        {
            id: 14,
            title: 'Power Supply Design',
            description: 'Complete power supply design techniques',
            lessons: [
                {
                    id: 1,
                    title: 'Decoupling & Bypass Strategy',
                    description: 'Multi-capacitor approach, placement, SRF',
                    topics: ['Value selection by frequency', 'Placement rules', 'ESL minimization', 'DC bias derating']
                },
                {
                    id: 2,
                    title: 'Ferrite Beads & EMI Filtering',
                    description: 'Selection criteria, DC bias effect, pi-filter',
                    topics: ['Impedance at frequency', 'DC resistance', 'Rated current', 'Resonance damping']
                },
                {
                    id: 3,
                    title: 'Grounding Strategy for Mixed-Signal',
                    description: 'Single plane, partitioning, star ground',
                    topics: ['One solid ground plane', 'Partition by function', 'No trace over splits', 'ADC placement']
                },
                {
                    id: 4,
                    title: 'Boost Converter Design',
                    description: 'Step-up converter topology and component selection',
                    topics: ['Continuous vs discontinuous mode', 'Inductor sizing', 'Diode selection', 'Input/output capacitors']
                },
                {
                    id: 5,
                    title: 'Buck-Boost Converters',
                    description: 'Inverting and non-inverting topologies',
                    topics: ['SEPIC topology', 'Ćuk converter', 'Four-switch buck-boost', 'Mode transitions']
                },
                {
                    id: 6,
                    title: 'Flyback Converters',
                    description: 'Isolated power supply design',
                    topics: ['Transformer design', 'DCM vs CCM operation', 'Snubber circuits', 'Cross-regulation']
                },
                {
                    id: 7,
                    title: 'Power Supply Filtering',
                    description: 'Input and output filter design',
                    topics: ['LC filter design', 'Common-mode filtering', 'Pi-filter topology', 'Damping networks']
                },
                {
                    id: 8,
                    title: 'Soft Start Circuits',
                    description: 'Controlled power-up sequences',
                    topics: ['RC soft-start', 'Current-limited start', 'UVLO implementation', 'Monotonic startup']
                },
                {
                    id: 9,
                    title: 'Current Limiting',
                    description: 'Overcurrent protection techniques',
                    topics: ['Cycle-by-cycle limiting', 'Hiccup mode', 'Foldback limiting', 'Sense resistor design']
                },
                {
                    id: 10,
                    title: 'Power Sequencing',
                    description: 'Multi-rail sequencing and tracking',
                    topics: ['Sequencer ICs', 'RC delay networks', 'Voltage tracking', 'Power-good signals']
                },
                {
                    id: 11,
                    title: 'Interview Prep — Power Supply Design',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['Find the discontinuous loop', 'Transient sizes the output cap', 'Probe grounds lie', 'Why it fails only in the product']
                },
                {
                    id: 12,
                    title: 'Design: Discharging a Rail to a Deadline',
                    description: 'A spec with a number in it, taken end to end to real parts',
                    topics: ['R = t/(C·ln(V0/Vf))', 'Energy has no R in it', 'Gate drive from a rail that outlives it', 'Cmax and hot is the corner']
                },
                {
                    id: 13,
                    title: 'Design: An Analog Power Sequencer',
                    description: 'Three ways to order the rails, and the tolerance analysis that chooses between them',
                    topics: ['Sequencing prevents latch-up', 'An RC times the wrong event', 'A comparator measures the rail', 'Shutdown is the harder half']
                }
            ]
        },
        // ========== MODULE 15: Battery Management ==========
        {
            id: 15,
            title: 'Battery Management',
            description: 'Battery charging, protection, and monitoring',
            lessons: [
                {
                    id: 1,
                    title: 'Fuel Gauge Algorithms',
                    description: 'Estimating state of charge, and why every method drifts',
                    topics: ['Voltage vs coulomb counting', 'Impedance track', 'Capacity fade', 'Runtime estimation']
                },
                {
                    id: 2,
                    title: 'Cell Balancing Circuits',
                    description: 'Passive and active balancing, and what imbalance costs you',
                    topics: ['Why cells drift apart', 'Bleed resistors', 'Charge shuttling', 'Top vs bottom balancing']
                },
                {
                    id: 3,
                    title: 'Protection Circuits',
                    description: 'Over-voltage, under-voltage, over-current and thermal cut-offs',
                    topics: ['Protection FET pairs', 'Trip thresholds', 'Recovery behaviour', 'Redundancy']
                },
                {
                    id: 4,
                    title: 'Charging Profiles',
                    description: 'CC-CV and what each chemistry demands of a charger',
                    topics: ['Constant current, constant voltage', 'Termination', 'Pre-charge', 'Temperature windows']
                },
                {
                    id: 5,
                    title: 'Battery Chemistry Selection',
                    description: 'Li-ion, LiFePO4, NiMH, lead-acid and what each is for',
                    topics: ['Energy vs power density', 'Cycle life', 'Temperature behaviour', 'Safety by chemistry']
                },
                {
                    id: 6,
                    title: 'BMS Integration',
                    description: 'Putting the gauge, balancer and protection together',
                    topics: ['BMS architecture', 'Host communication', 'Fault handling', 'Qualification']
                },
                {
                    id: 7,
                    title: 'Pack Architecture: Series, Parallel and the C-Rate',
                    description: 'How many cells, in what arrangement, and what that costs you',
                    topics: ['S and P notation', 'C-rate', 'High-discharge vs high-energy cells', 'Cell formats', 'Lead-acid and the LiFePO4 drop-in']
                }
            ]
        },
        // ========== MODULE 16: Audio Applications ==========
        {
            id: 16,
            title: 'Audio Applications',
            description: 'Headphone amp, preamp, equalizer, Class D',
            lessons: [
                {
                    id: 1,
                    title: 'Audio Amplifier Fundamentals',
                    description: 'Output power, impedance matching, distortion',
                    topics: ['Power calculation', 'Op-amp selection', 'Output coupling', 'Volume control']
                },
                {
                    id: 2,
                    title: 'Headphone and Line Drivers',
                    description: 'Gain, input impedance, noise floor',
                    topics: ['Electret bias', 'High-Z guitar input', 'Gain selection', 'RIAA equalization']
                },
                {
                    id: 3,
                    title: 'Microphone Preamps',
                    description: 'Bass/Mid/Treble control, shelving filters',
                    topics: ['Center frequencies', 'Q factor', 'Boost/cut range', 'Topology']
                },
                {
                    id: 4,
                    title: 'Class D Amplifier Concepts',
                    description: 'PWM modulation, efficiency, LC filter',
                    topics: ['PWM generation', '90%+ efficiency', 'Output filter', 'EMI considerations']
                },
                {
                    id: 5,
                    title: 'RIAA Phono Preamplifier',
                    description: 'Equalization for vinyl playback',
                    topics: ['RIAA time constants', 'Cartridge types', 'Gain requirements', 'Noise optimization']
                },
                {
                    id: 6,
                    title: 'Audio Tone Control (Baxandall)',
                    description: 'Classic bass/treble control circuit',
                    topics: ['Baxandall features', 'Symmetrical boost/cut', 'Component selection', 'Active vs passive']
                },
                {
                    id: 7,
                    title: 'Active Crossovers for Speakers',
                    description: 'Multi-way speaker frequency splitting',
                    topics: ['Active vs passive', 'Crossover frequencies', 'Filter slopes', 'Phase alignment']
                },
                {
                    id: 8,
                    title: 'Class AB Power Amplifier Design',
                    description: 'Discrete audio power amplifier design',
                    topics: ['Amplifier classes', 'Bias design', 'Thermal stability', 'Protection circuits']
                },
                {
                    id: 9,
                    title: 'Audio DAC Interface and Filtering',
                    description: 'DAC output stage and I/V conversion',
                    topics: ['DAC specs', 'I/V conversion', 'Reconstruction filtering', 'Digital interface']
                },
                {
                    id: 10,
                    title: 'Volume Control and VCA Circuits',
                    description: 'Analog volume control techniques',
                    topics: ['Human hearing', 'Log potentiometers', 'VCA circuits', 'Remote volume control']
                },
                {
                    id: 11,
                    title: 'Audio Grounding and Shielding',
                    description: 'Eliminating hum and noise in audio systems',
                    topics: ['Noise sources', 'Ground loops', 'Star grounding', 'Cable shielding']
                },
                {
                    id: 12,
                    title: 'Balanced Audio Design',
                    description: 'Differential signaling for noise rejection',
                    topics: ['Balanced advantages', 'XLR interface', 'Instrumentation amplifiers', 'CMRR requirements']
                },
                {
                    id: 13,
                    title: 'Audio Dynamics Processing',
                    description: 'Compressors, limiters, and gates',
                    topics: ['Processor types', 'Attack/release', 'Ratio and threshold', 'Side-chain processing']
                },
                {
                    id: 14,
                    title: 'Audio Measurement and Test',
                    description: 'THD, noise floor, and frequency response',
                    topics: ['Key measurements', 'Test equipment', 'Measurement techniques', 'Standards']
                }
            ]
        },
        // ========== MODULE 17: Data Conversion Applications ==========
        {
            id: 17,
            title: 'Data Conversion Applications',
            description: 'SAR driver, delta-sigma, DAC reconstruction, references',
            lessons: [
                {
                    id: 1,
                    title: 'DAC Fundamentals',
                    description: 'RC filter, settling time, kickback',
                    topics: ['tACQ ≥ k × R × C', 'Op-amp selection', 'Kickback absorption', 'Settling to 0.5 LSB']
                },
                {
                    id: 2,
                    title: 'Delta-Sigma ADC Intuition',
                    description: 'Noise shaping, oversampling, decimation',
                    topics: ['Oversampling ratio', 'Noise spectrum', 'Effective bits', 'Latency']
                },
                {
                    id: 3,
                    title: 'Sample and Hold Circuits',
                    description: 'Sinc rolloff, image rejection',
                    topics: ['Zero-order hold', 'Nyquist images', 'Filter order', 'Oversampling DACs']
                },
                {
                    id: 4,
                    title: 'Delta-Sigma (ΣΔ) Conversion',
                    description: 'Initial accuracy, tempco, noise',
                    topics: ['Error budget', 'Temperature drift', 'Long-term stability', 'PSRR']
                },
                {
                    id: 5,
                    title: 'SAR ADC Architecture',
                    description: 'Binary search conversion algorithm',
                    topics: ['SAR characteristics', 'Binary search', 'Sample capacitor', 'Conversion timing']
                },
                {
                    id: 6,
                    title: 'Pipeline ADC Architecture',
                    description: 'High-speed multi-stage conversion',
                    topics: ['Pipeline characteristics', 'Stage residue', 'Digital error correction', 'Latency']
                },
                {
                    id: 7,
                    title: 'DAC Architectures',
                    description: 'R-2R, current steering, and sigma-delta',
                    topics: ['Common architectures', 'R-2R ladder', 'Current steering', 'Oversampling DACs']
                },
                {
                    id: 8,
                    title: 'Voltage References for Data Converters',
                    description: 'Reference selection for ADC/DAC systems',
                    topics: ['Reference types', 'Noise contribution', 'Temperature stability', 'Buffering']
                },
                {
                    id: 9,
                    title: 'Anti-Aliasing and Reconstruction Filters',
                    description: 'Nyquist filtering for sampled systems',
                    topics: ['Aliasing problem', 'Filter requirements', 'Oversampling benefits', 'Digital filtering']
                },
                {
                    id: 10,
                    title: 'Data Converter Specifications',
                    description: 'Understanding ADC/DAC datasheets',
                    topics: ['Static specifications', 'Dynamic specifications', 'DNL/INL', 'SNR/SFDR/ENOB']
                },
                {
                    id: 11,
                    title: 'ADC Driver Circuits',
                    description: 'Op-amp selection and settling for ADC inputs',
                    topics: ['Driver requirements', 'Settling time', 'Kickback absorption', 'Differential drivers']
                },
                {
                    id: 12,
                    title: 'DAC Output Circuits',
                    description: 'I/V conversion and output filtering',
                    topics: ['Output types', 'Transimpedance', 'Settling time', 'Glitch energy']
                },
                {
                    id: 13,
                    title: 'High-Speed Data Converter Considerations',
                    description: 'Layout and clocking for MSPS converters',
                    topics: ['Speed challenges', 'Clock jitter', 'PCB layout', 'Power supply design']
                },
                {
                    id: 14,
                    title: 'Data Converter Applications',
                    description: 'Real-world ADC/DAC system design',
                    topics: ['Precision applications', 'High-speed applications', 'Audio applications', 'Sensor interfaces']
                },
                {
                    id: 15,
                    title: 'Understanding Monotonicity',
                    description: 'What makes a converter monotonic and why it matters for control loops',
                    topics: ['DNL ≥ -1 LSB requirement', 'Control loop instability', 'Missing codes', 'R-2R mismatch effects']
                },
                {
                    id: 16,
                    title: 'DNL, INL, and Missing Codes',
                    description: 'Deep dive into differential and integral nonlinearity',
                    topics: ['DNL definition and measurement', 'INL as cumulative DNL', 'Histogram testing method', 'MSB sensitivity analysis']
                },
                {
                    id: 17,
                    title: 'Converter Architecture & Monotonicity',
                    description: 'How different converter architectures handle monotonicity',
                    topics: ['Sigma-Delta inherent monotonicity', 'SAR capacitor matching', 'R-2R ladder sensitivity', 'Segmented DAC advantages']
                },
                {
                    id: 18,
                    title: 'Testing and Fixing Monotonicity',
                    description: 'Practical methods to detect and mitigate non-monotonic behavior',
                    topics: ['Histogram test procedure', 'Servo loop testing', 'Signal averaging', 'Component selection guidelines']
                },
                {
                    id: 19,
                    title: 'Interview Prep — Data Conversion',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['Where 6.02N + 1.76 comes from', 'Jitter follows input frequency', 'Why Nyquist is not enough', 'A SAR input is a capacitor']
                }
            ]
        },
        // ========== MODULE 18: Sensor Interface ==========
        {
            id: 18,
            title: 'Sensor Interface',
            description: 'Signal conditioning for various sensor types',
            lessons: [
                {
                    id: 1,
                    title: 'IoT Sensor Node (Battery-Powered)',
                    description: '2+ year coin cell life, wake/sleep optimization',
                    topics: ['Sleep current budget', 'Boost converter selection', 'I2C power gating', 'LoRa transient']
                },
                {
                    id: 2,
                    title: 'Automotive 12V Sensor (EMC Hardened)',
                    description: 'Load dump, cold crank, ISO 7637-2',
                    topics: ['TVS selection', 'Wide-range buck', 'Temperature derating', 'EMC filtering']
                },
                {
                    id: 3,
                    title: 'Precision Temperature Measurement (RTD)',
                    description: 'PT100 interface, 0.1°C accuracy',
                    topics: ['Excitation current', '4-wire sensing', 'INA gain', 'Error budget']
                },
                {
                    id: 4,
                    title: 'Audio DAC Output Stage',
                    description: 'I2S to line-level, >100dB SNR',
                    topics: ['Differential to SE', 'Output coupling', 'Op-amp selection', 'Supply filtering']
                },
                {
                    id: 5,
                    title: 'FPGA Power System',
                    description: 'Multi-rail sequencing, transient response',
                    topics: ['Core → Aux → IO sequence', 'Droop during transient', 'Bulk capacitance', 'Monitoring']
                },
                {
                    id: 6,
                    title: 'RTD/Thermocouple Interfaces',
                    description: 'Temperature sensor signal conditioning',
                    topics: ['RTD excitation', 'Cold junction compensation', 'Linearization', 'Noise filtering']
                },
                {
                    id: 7,
                    title: 'Strain Gauge Bridges',
                    description: 'Load cell and pressure sensor interfaces',
                    topics: ['Wheatstone bridge', 'Bridge excitation', 'INA selection', 'Calibration']
                },
                {
                    id: 8,
                    title: 'Capacitive Sensing',
                    description: 'Touch and proximity sensing circuits',
                    topics: ['Self-capacitance', 'Mutual capacitance', 'CDC integration', 'Noise immunity']
                },
                {
                    id: 9,
                    title: 'Hall Effect Sensors',
                    description: 'Current and position sensing',
                    topics: ['Linear vs switch output', 'Current sensing', 'Position encoding', 'Temperature drift']
                },
                {
                    id: 10,
                    title: 'MEMS Sensor Interfaces',
                    description: 'Accelerometer, gyroscope, and pressure sensors',
                    topics: ['SPI/I2C interfaces', 'Bandwidth vs noise', 'Sensor fusion', 'Power management']
                }
            ]
        },
        // ========== MODULE 19: Digital Interface Electrical Design ==========
        {
            id: 19,
            title: 'Digital Interface Electrical Design',
            description: 'Logic levels, level shifting, pull-ups, ESD',
            lessons: [
                {
                    id: 1,
                    title: 'Logic Level Fundamentals',
                    description: 'HC, HCT, LVC, threshold voltages',
                    topics: ['VIH, VIL, VOH, VOL', 'CMOS vs TTL thresholds', '3.3V/5V compatibility', 'Noise margin']
                },
                {
                    id: 2,
                    title: 'Level Shifter Circuits',
                    description: '3.3V ↔ 5V conversion methods',
                    topics: ['Resistor divider', 'MOSFET bidirectional', 'Dedicated ICs', 'HCT for step-up']
                },
                {
                    id: 3,
                    title: 'Push-Pull vs Open-Drain Outputs',
                    description: 'Rise time, power consumption, I2C example',
                    topics: ['tr ≈ 2.2×R×C', 'Current sink limit', 'Power = V²/R', 'Speed vs power']
                },
                {
                    id: 4,
                    title: 'GPIO Electrical Characteristics',
                    description: 'Internal diodes, series resistors, TVS',
                    topics: ['Clamp current limit', 'Series R sizing', 'ESD rating', 'Layout']
                },
                {
                    id: 5,
                    title: 'Input Protection Circuits',
                    description: 'Clamping overvoltage and transients at a digital input',
                    topics: ['Series R + clamp diodes', 'Bidirectional Zener clamp', 'RC filter + clamp', 'Clamp current budget']
                },
                {
                    id: 6,
                    title: 'Schmitt Trigger Inputs',
                    description: 'Hysteresis for slow and noisy edges',
                    topics: ['VT+ / VT- thresholds', 'Hysteresis transfer curve', 'Cleaning slow signals', 'RC relaxation oscillator']
                },
                {
                    id: 7,
                    title: 'Bus Buffers and Drivers',
                    description: 'Fan-out, direction control, and bus contention',
                    topics: ['When a buffer is needed', 'Common buffer families', '74HC245 transceiver', 'Fan-out calculation']
                },
                {
                    id: 8,
                    title: 'Signal Termination',
                    description: 'When a trace becomes a transmission line',
                    topics: ['tr < 2 x tpd rule', 'Series vs parallel vs AC termination', 'Reflections and ringing', 'Impedance matching']
                },
                {
                    id: 9,
                    title: 'Debouncing Techniques',
                    description: 'Getting one clean edge out of a mechanical switch',
                    topics: ['Bounce duration', 'RC + Schmitt debounce', 'Software sampling', 'SR latch debounce']
                },
                {
                    id: 10,
                    title: 'Optocouplers and Isolation',
                    description: 'Galvanic isolation for digital signals',
                    topics: ['Why isolate', 'LED + phototransistor structure', 'CTR and drive current', 'Speed limits and alternatives']
                },
                {
                    id: 11,
                    title: 'Design: Driving a Higher Voltage from a Lower One',
                    description: 'Six standard answers, the one that fits, and what breaks when the input is wrong',
                    topics: ['Where is the load return', 'VGS is source-referred', 'Voltage problem vs current problem', 'Size the series R for the fault']
                }
            ]
        },
        // ========== MODULE 20: Communication Protocols - Electrical Level ==========
        {
            id: 20,
            title: 'Communication Protocols - Electrical Level',
            description: 'I2C, SPI, UART, USB electrical design',
            lessons: [
                {
                    id: 1,
                    title: 'I2C Physical Layer & Analog Challenges',
                    description: 'Pull-up sizing, rise time, bus capacitance',
                    topics: ['Standard/Fast/Fast+ Mode', 'Rp calculation', 'Multi-master', 'Repeaters']
                },
                {
                    id: 2,
                    title: 'SPI Signal Integrity',
                    description: 'CPOL/CPHA modes, timing, termination',
                    topics: ['Mode 0/1/2/3', 'Setup/hold time', 'Clock frequency limits', 'Series termination']
                },
                {
                    id: 3,
                    title: 'UART / RS-232 Electrical Design',
                    description: 'TTL vs RS-232 levels, MAX232',
                    topics: ['Voltage levels', 'Inversion', 'Baud rate timing', 'Error sources']
                },
                {
                    id: 4,
                    title: 'Analog Signal Conditioning for ADCs',
                    description: 'D+/D- differential, speed detection',
                    topics: ['Pull-up detection', 'Differential signaling', 'Impedance matching', 'ESD protection']
                },
                {
                    id: 5,
                    title: 'RS-485 Differential Signaling',
                    description: 'Half-duplex multi-drop networks, termination, failsafe biasing',
                    topics: ['Differential receivers', 'Termination networks', 'Failsafe biasing', 'Multi-drop topology']
                },
                {
                    id: 6,
                    title: 'CAN Bus Physical Layer',
                    description: 'Dominant/recessive states, transceiver design, fault tolerance',
                    topics: ['CAN_H/CAN_L signals', 'Transceiver selection', 'Split termination', 'Fault protection']
                },
                {
                    id: 7,
                    title: 'I2C Repeaters and Buffers',
                    description: 'Extending bus capacitance limits, level translation, hot-swap',
                    topics: ['Bus capacitance limits', 'Bidirectional buffers', 'Level translation', 'Rise time acceleration']
                },
                {
                    id: 8,
                    title: 'SPI Daisy Chaining',
                    description: 'Multi-device topologies, timing considerations, signal integrity',
                    topics: ['Ring topology', 'Star topology', 'Cascaded vs parallel', 'Signal propagation delay']
                },
                {
                    id: 9,
                    title: 'LVDS High-Speed Signaling',
                    description: 'Low-voltage differential signaling for high-speed data',
                    topics: ['3.5mA current mode', '100Ω termination', 'Common-mode range', 'EMI advantages']
                },
                {
                    id: 10,
                    title: 'Protocol Debug Techniques',
                    description: 'Using oscilloscopes and analyzers for communication debugging',
                    topics: ['I2C/SPI decoding', 'Eye diagram analysis', 'Protocol violations', 'Common failure modes']
                }
            ]
        },
        // ========== MODULE 21: RF Analog ==========
        {
            id: 21,
            title: 'RF Analog',
            description: 'Radio frequency analog circuit design',
            lessons: [
                {
                    id: 1,
                    title: 'Matching Networks',
                    description: 'Impedance matching for RF circuits',
                    topics: ['L-network design', 'Pi and T networks', 'Smith chart', 'Bandwidth considerations']
                },
                {
                    id: 2,
                    title: 'Low Noise Amplifiers',
                    description: 'LNA design for receiver front-ends',
                    topics: ['Noise figure', 'Input matching', 'Gain and linearity', 'Stability circles']
                },
                {
                    id: 3,
                    title: 'Power Amplifiers',
                    description: 'PA design for transmitters',
                    topics: ['Class A/B/C operation', 'Efficiency vs linearity', 'Load pull', 'Thermal management']
                },
                {
                    id: 4,
                    title: 'Mixers and Frequency Conversion',
                    description: 'Up/down conversion circuits',
                    topics: ['Diode mixers', 'Gilbert cell', 'Conversion gain', 'Spurious products']
                },
                {
                    id: 5,
                    title: 'RF Filter Design',
                    description: 'Bandpass and bandstop filters for RF',
                    topics: ['LC tank circuits', 'Crystal filters', 'SAW filters', 'Filter synthesis']
                }
            ]
        },
        // ========== MODULE 22: EMI/EMC Design ==========
        {
            id: 22,
            title: 'EMI/EMC Design',
            description: 'Electromagnetic compatibility and interference control',
            lessons: [
                {
                    id: 1,
                    title: 'Shielding Effectiveness',
                    description: 'Enclosure shielding design and analysis',
                    topics: ['Shielding materials', 'Aperture effects', 'Gaskets and seams', 'Cable penetrations']
                },
                {
                    id: 2,
                    title: 'PCB Layout for EMC',
                    description: 'Board-level EMC design techniques',
                    topics: ['Return current paths', 'Split planes', 'Component placement', 'High-speed routing']
                },
                {
                    id: 3,
                    title: 'Common-Mode Chokes',
                    description: 'CM filter design for power and signal lines',
                    topics: ['Choke impedance', 'Saturation current', 'Differential-mode rejection', 'Material selection']
                },
                {
                    id: 4,
                    title: 'Surge Protection',
                    description: 'Transient voltage suppression design',
                    topics: ['MOV characteristics', 'TVS diodes', 'GDT devices', 'Coordination']
                },
                {
                    id: 5,
                    title: 'Conducted Emissions',
                    description: 'Measuring and reducing conducted EMI',
                    topics: ['LISN measurement', 'CM/DM separation', 'Filter design', 'CISPR limits']
                },
                {
                    id: 6,
                    title: 'Radiated Emissions',
                    description: 'Controlling radiated EMI from circuits',
                    topics: ['Antenna mechanisms', 'Cable radiation', 'Clock harmonics', 'Spread spectrum']
                }
            ]
        },
        // ========== MODULE 23: Real-World Scenarios ==========
        {
            id: 23,
            title: 'Real-World Scenarios',
            description: 'Complete application-focused design scenarios',
            lessons: [
                {
                    id: 1,
                    title: 'Multi-Rail Power Sequencing',
                    description: 'FPGA/SoC requirements, RC delay, sequencer ICs',
                    topics: ['Monotonic rise', 'Ramp rate', 'Tracking', 'Cascade enable']
                },
                {
                    id: 2,
                    title: 'Load Switches & Discharge Control',
                    description: 'Quick output discharge, slew rate, inrush',
                    topics: ['QOD feature', 'CT pin timing', 'Reverse blocking', 'Power state transitions']
                },
                {
                    id: 3,
                    title: 'Supervisory & Reset Circuits',
                    description: 'POR, brownout, watchdog timer',
                    topics: ['Threshold voltage', 'Hysteresis', 'Reset delay', 'Supervisor IC selection']
                },
                {
                    id: 4,
                    title: 'Industrial Sensor Interface',
                    description: 'Robust sensor conditioning for factory environments',
                    topics: ['4-20mA loop', 'Isolation requirements', 'EMC protection', 'Long cable runs']
                },
                {
                    id: 5,
                    title: 'Automotive Power System',
                    description: 'Surviving load dump and cold crank conditions',
                    topics: ['ISO 7637-2', 'Load dump protection', 'Cold crank', 'Wide input range']
                },
                {
                    id: 6,
                    title: 'Medical Instrumentation',
                    description: 'Patient safety and precision measurement',
                    topics: ['IEC 60601', 'Leakage current', 'Isolation barriers', 'Low-noise design']
                },
                {
                    id: 7,
                    title: 'Case Study: Battery-Powered IoT Sensor Node',
                    description: 'Battery-powered wireless sensor node design',
                    topics: ['Power budget', 'Sleep modes', 'Wireless optimization', 'Energy harvesting']
                },
                {
                    id: 8,
                    title: 'Audio Equipment Repair',
                    description: 'Diagnosing and fixing common audio circuit faults',
                    topics: ['Hum and noise', 'Distortion sources', 'DC offset', 'Bias problems']
                },
                {
                    id: 9,
                    title: 'Power Supply Failure Analysis',
                    description: 'Root cause analysis for power supply failures',
                    topics: ['Component stress', 'Thermal failures', 'Capacitor aging', 'MOSFET failures']
                },
                {
                    id: 10,
                    title: 'RF Interference Investigation',
                    description: 'Finding and fixing EMI/RFI problems in the field',
                    topics: ['Spectrum analysis', 'Near-field probing', 'Shield effectiveness', 'Filter retrofit']
                }
            ]
        },
        // ========== MODULE 24: Troubleshooting & Debug ==========
        {
            id: 24,
            title: 'Troubleshooting & Debug',
            description: 'Systematic debugging techniques for analog circuits',
            lessons: [
                {
                    id: 1,
                    title: 'Reverse Polarity Protection',
                    description: 'Diode, P-FET, ideal diode controller',
                    topics: ['Voltage drop comparison', 'P-FET circuit', 'Gate protection', 'Efficiency']
                },
                {
                    id: 2,
                    title: 'Overvoltage & Crowbar Protection',
                    description: 'TVS selection, clamp vs crowbar',
                    topics: ['VRWM, VBR, Vc specs', 'Unidirectional vs bidirectional', 'SCR crowbar', 'Layout']
                },
                {
                    id: 3,
                    title: 'Hot-Swap & Inrush Limiting',
                    description: 'Soft-start, current limit, SOA timer',
                    topics: ['Inrush control', 'Sense resistor', 'Power-good output', 'Backplane design']
                },
                {
                    id: 4,
                    title: 'Power Supply Debugging',
                    description: 'Systematic approach to power supply problems',
                    topics: ['No output diagnosis', 'Regulation problems', 'Ripple analysis', 'Efficiency issues']
                },
                {
                    id: 5,
                    title: 'Oscillation Problems',
                    description: 'Finding and fixing unwanted oscillations',
                    topics: ['Op-amp instability', 'Power supply oscillation', 'Parasitic oscillations', 'Snubber design']
                },
                {
                    id: 6,
                    title: 'Ground Loop Issues',
                    description: 'Identifying and eliminating ground loops',
                    topics: ['Ground loop symptoms', 'Star grounding', 'Isolation techniques', 'Differential signaling']
                },
                {
                    id: 7,
                    title: 'Thermal Problems',
                    description: 'Diagnosing temperature-related failures',
                    topics: ['Thermal runaway', 'Cold start issues', 'Parameter drift', 'Thermal imaging']
                },
                {
                    id: 8,
                    title: 'EMI/RFI Debugging',
                    description: 'Finding sources of electromagnetic interference',
                    topics: ['Near-field probing', 'Spectrum analysis', 'Common-mode currents', 'Shield grounding']
                },
                {
                    id: 9,
                    title: 'Signal Integrity Issues',
                    description: 'High-speed signal quality problems',
                    topics: ['Reflections', 'Crosstalk', 'Ground bounce', 'Rise time degradation']
                },
                {
                    id: 10,
                    title: 'Systematic Debug Methodology',
                    description: 'Structured approach to finding root causes',
                    topics: ['Divide and conquer', 'Substitution method', 'Stress testing', 'Documentation']
                },
                {
                    id: 11,
                    title: 'Oscilloscope Techniques for Analog Debug',
                    description: 'Getting a measurement you can trust before you trust it',
                    topics: ['Probe compensation', 'Ground spring', 'Bandwidth vs rise time', 'What the probe adds']
                },
                {
                    id: 12,
                    title: 'Power Supply Debugging: Measurement and Common Faults',
                    description: 'Measurement setup first, then the faults it reveals',
                    topics: ['Where to probe', 'Ripple vs noise', 'Load-step response', 'Common failure signatures']
                },
                {
                    id: 13,
                    title: 'Signal Integrity Debugging: Measurement and Fixes',
                    description: 'Seeing reflections and crosstalk honestly, then removing them',
                    topics: ['Reflection signatures', 'Crosstalk', 'Return path breaks', 'Termination fixes']
                },
                {
                    id: 14,
                    title: 'Debug Decision Trees and Test-Point Strategy',
                    description: 'A repeatable procedure, and designing the board so it can be debugged',
                    topics: ['Decision trees', 'Test point placement', 'Design for debug', 'Common mistakes']
                },
                
            ]
        },
        // ========== MODULE 25: Real-World System Design ==========
        {
            id: 25,
            title: 'Real-World System Design',
            description: 'Complete practical designs for laptops, phones, and consumer electronics',
            lessons: [
                {
                    id: 1,
                    title: 'Complete Audio Subsystem Design',
                    description: 'Complete audio subsystem: headphone amp, MEMS mic, Class-D speaker driver',
                    topics: ['Capless headphone output', 'PDM microphone interface', 'Class-D EMI filtering', 'Audio codec integration']
                },
                {
                    id: 2,
                    title: 'Battery Management System',
                    description: 'Complete BMS design: CC-CV charging, protection, fuel gauge',
                    topics: ['CC-CV charging profile', 'Cell protection IC', 'Coulomb counting SOC', 'Multi-cell balancing']
                },
                {
                    id: 3,
                    title: 'USB-C Power Delivery',
                    description: 'USB PD sink design: CC detection, negotiation, buck-boost charger',
                    topics: ['CC pull-down resistors', 'PD voltage negotiation', 'Buck-boost topology selection', 'VBUS protection']
                },
                {
                    id: 4,
                    title: 'Current Sensing Applications',
                    description: 'High-side and low-side sensing for motor control and power monitoring',
                    topics: ['Shunt resistor selection', 'Current sense amplifier', 'Bidirectional sensing', 'Power measurement']
                },
                {
                    id: 5,
                    title: 'Laptop Power Architecture',
                    description: 'Multi-rail power system: 19V input, sequencing, efficiency',
                    topics: ['System voltage selection', 'Buck converter cascade', 'Power sequencing', 'Thermal management']
                },
                {
                    id: 6,
                    title: 'BLDC Motor Driver Design',
                    description: 'Three-phase inverter with gate drive and current sensing',
                    topics: ['Three-phase inverter', 'Bootstrap gate drive', 'FOC vs six-step', 'MOSFET loss calculation']
                },
                {
                    id: 7,
                    title: 'LED Driver Design',
                    description: 'Constant current LED drivers for various applications',
                    topics: ['Buck/boost/buck-boost topology', 'Current sensing', 'PWM dimming', 'Automotive LED drivers']
                },
                {
                    id: 8,
                    title: 'Sensor Interface Design',
                    description: 'RTD, thermocouple, strain gauge, and load cell interfaces',
                    topics: ['4-wire RTD measurement', 'Thermocouple CJC', 'Wheatstone bridge', 'Instrumentation amplifier']
                },
                {
                    id: 9,
                    title: 'Power-over-Ethernet Design',
                    description: 'IEEE 802.3af/at/bt powered device design',
                    topics: ['PD detection signature', 'Classification', 'Power budget', 'Isolation requirements']
                },
                {
                    id: 10,
                    title: 'Wireless Charging (Qi) Design',
                    description: 'Inductive power transfer for portable devices',
                    topics: ['Resonant tank design', 'TX/RX coil coupling', 'FOD detection', 'Communication protocol']
                },
                {
                    id: 11,
                    title: 'Solar MPPT Charge Controller',
                    description: 'Maximum power point tracking for solar panels',
                    topics: ['P&O algorithm', 'I-V curves', 'Power stage design', 'Battery charging profiles']
                },
                {
                    id: 12,
                    title: 'Industrial 4-20mA Current Loop',
                    description: 'Robust process control signaling',
                    topics: ['Loop power budget', '2-wire transmitter', 'HART protocol', 'Intrinsic safety']
                },
                {
                    id: 13,
                    title: 'Automotive 48V Mild Hybrid',
                    description: 'Dual-voltage 48V/12V architecture',
                    topics: ['LV 148 standard', 'DC-DC converter', 'BSG inverter', '48V battery pack']
                },
                {
                    id: 14,
                    title: 'Understanding ESD Threats',
                    description: 'System-level electrostatic discharge protection',
                    topics: ['TVS selection', 'Layout guidelines', 'IEC 61000-4-2', 'Protection coordination']
                },
                {
                    id: 15,
                    title: 'Precision Data Acquisition',
                    description: 'High-resolution measurement systems',
                    topics: ['Noise budget', 'ADC selection', 'Voltage reference', 'Anti-aliasing filter']
                },
                {
                    id: 16,
                    title: 'DC-DC Converter Loop Compensation',
                    description: 'Stability analysis and Type II/III compensator design',
                    topics: ['Control loop fundamentals', 'Power stage transfer function', 'Type II vs Type III compensation', 'Phase margin and crossover frequency']
                },
                {
                    id: 17,
                    title: 'Flyback Converter & Transformer Design',
                    description: 'Isolated power supply design with coupled inductor transformers',
                    topics: ['DCM vs CCM operation', 'Transformer sizing', 'Snubber design', 'Leakage inductance management']
                },
                {
                    id: 18,
                    title: 'Hot-Swap & Inrush Current Control',
                    description: 'Safe board insertion in live systems',
                    topics: ['MOSFET SOA analysis', 'Soft-start timing', 'Current limiting', 'Circuit breaker design']
                },
                {
                    id: 19,
                    title: 'EMI/EMC Filter Design',
                    description: 'Conducted and radiated emissions compliance',
                    topics: ['Common-mode vs differential-mode', 'LC filter design', 'Y-cap and X-cap selection', 'Regulatory standards']
                },
                {
                    id: 20,
                    title: 'Thermal Management for Power Electronics',
                    description: 'Heat dissipation and junction temperature control',
                    topics: ['Thermal resistance network', 'Heatsink selection', 'Thermal interface materials', 'PCB thermal vias']
                },
                {
                    id: 21,
                    title: 'RS-485/CAN Bus Physical Layer',
                    description: 'Industrial communication interface design',
                    topics: ['Differential signaling', 'Termination and biasing', 'Transceiver selection', 'Protection circuits']
                },
                {
                    id: 22,
                    title: 'PLL & Clock Generation',
                    description: 'Frequency synthesis and jitter control',
                    topics: ['PLL architecture', 'Loop filter design', 'Phase noise and jitter', 'Clock distribution']
                },
                {
                    id: 23,
                    title: 'Gate Driver Design',
                    description: 'MOSFET and IGBT gate drive circuits',
                    topics: ['Bootstrap drivers', 'Isolated gate drivers', 'Dead-time control', 'dV/dt immunity']
                },
                {
                    id: 24,
                    title: 'Power Factor Correction (PFC)',
                    description: 'Active PFC boost converter design',
                    topics: ['PF fundamentals', 'Boost PFC topology', 'CCM vs CrCM operation', 'IEC 61000-3-2 compliance']
                },
                {
                    id: 25,
                    title: 'Medical Analog Front-End (ECG/PPG)',
                    description: 'Biopotential signal acquisition circuits',
                    topics: ['Instrumentation amplifier design', 'Right leg drive', 'CMRR requirements', 'Patient safety']
                }
            ]
        },
        // ========== MODULE 26: Complex Real-World Projects ==========
        {
            id: 26,
            title: 'Complex Real-World Projects',
            description: 'Complete system-level designs integrating multiple analog subsystems',
            lessons: [
                {
                    id: 1,
                    title: 'BLDC Motor Driver',
                    description: 'Three-phase inverter design with bootstrap gate drivers and current sensing',
                    topics: ['Six-step commutation', 'Bootstrap gate driver design', 'Dead-time control', 'Current sense amplifier']
                },
                {
                    id: 2,
                    title: 'LED Backlight Driver',
                    description: 'High-efficiency boost converter for LCD/OLED backlight with dimming control',
                    topics: ['Boost topology for LED strings', 'Constant current regulation', 'PWM vs analog dimming', 'Multi-string current matching']
                },
                {
                    id: 3,
                    title: 'Capacitive Touch Sensing',
                    description: 'Analog front-end design for reliable touch detection',
                    topics: ['Self vs mutual capacitance', 'Charge transfer measurement', 'AFE design with CDC', 'Noise rejection techniques']
                },
                {
                    id: 4,
                    title: 'Temperature Sensing Interfaces',
                    description: 'RTD, thermistor, and thermocouple signal conditioning',
                    topics: ['RTD 2/3/4-wire configurations', 'NTC thermistor linearization', 'Thermocouple cold junction compensation', 'Sensor IC integration']
                },
                {
                    id: 5,
                    title: 'Industrial 4-20mA Loop Design',
                    description: 'Current loop transmitters and receivers for industrial sensing',
                    topics: ['Loop topology and power budget', '2-wire vs 4-wire transmitters', 'Receiver with sense resistor', 'Loop protection and isolation']
                },
                {
                    id: 6,
                    title: 'High-Precision DAQ System',
                    description: 'Complete data acquisition system with error budget analysis',
                    topics: ['Error budget', 'Noise analysis', 'Grounding strategy', 'Anti-aliasing filter']
                },
                {
                    id: 7,
                    title: 'Battery-Powered IoT Sensor',
                    description: 'Ultra-low power wireless sensor design',
                    topics: ['Power budget', 'Duty cycle optimization', 'Wireless efficiency', 'Energy harvesting']
                },
                {
                    id: 8,
                    title: 'Motor Control System',
                    description: 'Complete FOC motor drive with current sensing',
                    topics: ['3-phase inverter', 'Current sensing', 'FOC implementation', 'PI control tuning']
                },
                {
                    id: 9,
                    title: 'Audio Amplifier Design',
                    description: 'Class AB power amplifier with thermal management',
                    topics: ['THD analysis', 'Bias design', 'Frequency response', 'Thermal design']
                },
                {
                    id: 10,
                    title: 'Power Supply with PFC',
                    description: 'Complete PFC power supply with LLC converter',
                    topics: ['Boost PFC stage', 'LLC resonant converter', 'Control loops', 'Efficiency optimization']
                }
            ]
        },
        // ========== MODULE 27: Power Systems & the Grid (ERCOT / AEP) ==========
        {
            id: 27,
            title: 'Power Systems & the Grid (ERCOT / AEP)',
            description: 'Undergraduate power systems plus the operating reality of the Texas grid and a large US utility',
            lessons: [
                {
                    // Lesson zero, and numbered that way on purpose: it is the
                    // refresher the other eighteen assume you already have.
                    // Everything after this one is quoted in MW, MVAR and MVA
                    // without pausing to say what they are.
                    id: 0,
                    title: 'AC Power: RMS, Phasors and the Power Triangle',
                    description: 'The vocabulary the rest of this module is written in',
                    topics: ['RMS and true RMS', 'Phasors and jwL', 'P, Q, S and power factor', 'Power factor correction', 'Why sqrt(3)']
                },
                {
                    id: 1,
                    title: 'Three-Phase Power and the Per-Unit System',
                    description: 'The language every other power-systems number is quoted in',
                    topics: ['S = sqrt(3) V_LL I_L', 'Zbase = kV^2/MVA', 'Base changing', 'Fault duty in MVA']
                },
                {
                    id: 2,
                    title: 'Transmission Lines, SIL and Loadability',
                    description: 'Short/medium/long models, surge impedance loading, the St. Clair curve',
                    topics: ['ABCD parameters', 'SIL = kV^2/Zc', 'Ferranti effect', 'Thermal vs voltage vs stability limits']
                },
                {
                    id: 3,
                    title: 'Power Transformers, Impedance and Fault Duty',
                    description: 'Why %Z sets the fault current for everything downstream',
                    topics: ['Z_ohm = %Z x kV^2/MVA', 'Vector groups and the 30 degree shift', 'Inrush and 2nd harmonic', 'Loss of life']
                },
                {
                    id: 4,
                    title: 'Symmetrical Components and Fault Analysis',
                    description: 'Decomposing unbalanced faults into three solvable networks',
                    topics: ['Fortescue transform', 'Sequence network connections', 'SLG vs 3-phase magnitude', 'Inverter fault contribution']
                },
                {
                    id: 5,
                    title: 'Power Flow and the Power-Angle Equation',
                    description: 'P by angle, Q by magnitude, and the stability limit at 90 degrees',
                    topics: ['P = (V1 V2/X) sin(delta)', 'Newton-Raphson and bus types', 'Reactive control devices', 'TPL-001 voltage envelopes']
                },
                {
                    id: 6,
                    title: 'Generators, Inertia and the Swing Equation',
                    description: 'Why frequency falls at the rate it does, and what inertia has to do with it',
                    topics: ['H in seconds', 'RoCoF = f0 dP / 2H', 'Equal-area criterion', 'Critical clearing time']
                },
                {
                    id: 7,
                    title: 'Overcurrent Protection and Coordination',
                    description: 'ANSI 50/51, inverse curves, and the coordination time interval',
                    topics: ['IEEE C37.112 curves', 'Pickup and time dial', 'CTI 0.25-0.40 s', 'Cold-load pickup']
                },
                {
                    id: 8,
                    title: 'Distance, Differential and Breaker-Failure Protection',
                    description: 'Transmission protection that does not depend on source strength',
                    topics: ['Zone 1/2/3 reach', 'POTT vs DCB', 'Percentage restraint', '50BF timing']
                },
                {
                    id: 9,
                    title: 'Substation Engineering',
                    description: 'Bus layouts, breakers, instrument transformers, grounding and BIL',
                    topics: ['Ring bus and breaker-and-a-half', 'CT class C800', 'IEEE 80 step and touch', 'Insulation coordination']
                },
                {
                    id: 10,
                    title: 'Distribution Engineering and Reliability',
                    description: 'Feeders, regulation on the 120 V base, and SAIDI/SAIFI',
                    topics: ['Radial vs loop vs network', 'LTC bandwidth and time delay', 'Fuse saving vs blowing', 'IEEE 1366 indices']
                },
                {
                    id: 11,
                    title: 'ERCOT: An Islanded Grid and Its Market',
                    description: 'DC ties, nodal pricing, ORDC and connect-and-manage interconnection',
                    topics: ['Why not FERC-jurisdictional', 'LMP = energy + congestion + loss', 'ELCC vs nameplate', 'Interconnection queue']
                },
                {
                    id: 12,
                    title: 'ERCOT Operations and Winter Storm Uri',
                    description: 'Reserves, EEA escalation, UFLS, and the February 2021 timeline',
                    topics: ['EEA1/2/3 triggers', 'UFLS at 59.3/58.9/58.5 Hz', 'The 4m23s / 9-minute margin', 'Gas-electric feedback loop']
                },
                {
                    id: 13,
                    title: 'AEP: 765 kV and the Texas TDU Model',
                    description: 'A utility across three RTOs, and what a wires-only company is',
                    topics: ['Circuit-miles by voltage class', 'Why 765 kV', 'Seven operating companies', 'TDU / REP / ERCOT split']
                },
                {
                    id: 14,
                    title: 'Field Safety and Practice',
                    description: 'Approach distances, arc flash, clearances and what goes wrong',
                    topics: ['OSHA 1910.269 MAD table', 'NFPA 70E PPE categories', 'Bracket grounding', 'Induced voltage and backfeed']
                },
                {
                    id: 15,
                    title: 'Conductor Selection and Ampacity',
                    description: 'Why ampacity is a temperature you agree to, not a number on the wire',
                    topics: ['ACSR/AAC/ACSS/ACCC families', 'IEEE 738 heat balance', 'Bird-named conductor tables', 'Bundling and corona']
                },
                {
                    id: 16,
                    title: 'Sag, Tension and Clearance',
                    description: 'The catenary that decides structure height, span length and cost',
                    topics: ['S = wL^2/8T', 'NESC tension limits', 'Ruling span', 'Clearance at max operating temperature']
                },
                {
                    id: 17,
                    title: 'Line Impedance, Structures and Insulation',
                    description: 'How tower geometry becomes R, X and B',
                    topics: ['GMD and GMR', 'X = 0.2794 log(GMD/GMR)', 'Phase configurations and transposition', 'Insulator strings, shielding, footing resistance']
                },
                {
                    id: 18,
                    title: 'Specifying a Transmission Line End to End',
                    description: 'One worked project from brief to spec sheet',
                    topics: ['N-1 sizes the conductor', 'Span versus structure-height trade', 'Loss economics', 'The line spec sheet']
                },
                {
                    id: 20,
                    title: 'Interview Prep — Power Systems',
                    description: 'The whole module as it gets asked on a whiteboard',
                    topics: ['%Z is the fault current', 'P with angle, Q with magnitude', 'Why 765 kV, with numbers', 'What limits a line']
                }
            ]
        },
        // ========== MODULE 28: Amplifier Design ==========
        // Every amplifier type, what each is for, and complete audio designs.
        // Separate from the device modules on purpose: knowing how a BJT works
        // does not tell you how to choose between class AB and class D, and
        // that choice is the one a job actually asks for.
        {
            id: 28,
            title: 'Amplifier Design',
            description: 'Every amplifier type, its trade-offs, and complete designs from brief to bench',
            lessons: [
                {
                    id: 1,
                    title: 'The Amplifier Map',
                    description: 'There are only four amplifiers; the source and the load choose for you',
                    topics: ['V/V, V/A, A/V, A/A', 'Impedances are forced, not chosen', 'Gain distribution and Friis', 'Which family to reach for']
                },
                {
                    id: 2,
                    title: 'Amplifier Classes A to H',
                    description: 'Conduction angle decides efficiency, distortion and heatsink size',
                    topics: ['25% and 78.5% derived', 'Worst heat at 64% of swing', 'Why class C needs a tank', 'Class G, H and envelope tracking']
                },
                {
                    id: 3,
                    title: 'The Audio Signal Chain',
                    description: 'Every block, why it is in that order, and where the gain goes',
                    topics: ['dBu vs dBV vs dBFS', 'The first stage sets the noise floor', 'Headroom and dynamic range', 'Where the volume control belongs']
                },
                {
                    id: 4,
                    title: 'Design: A Microphone Preamplifier',
                    description: 'A noise budget in nV/rtHz, taken to a topology and a part',
                    topics: ['-130.8 dBu is the floor at 150 ohm', 'Ropt = en/in', 'Why phantom power is free', 'Gain inside the loop, not at the input']
                },
                {
                    id: 5,
                    title: 'Design: A 50 W Class AB Power Amplifier',
                    description: 'A complete channel from brief to heatsink, with acceptance tests and abuse cases',
                    topics: ['Rails from sqrt(2PRL)', 'Heat at 64% of swing', 'Degenerate to place the crossover', 'What dies, and it is usually not the amplifier']
                },
                {
                    id: 6,
                    title: 'Design: A Class D Amplifier',
                    description: 'The same 50 W the other way: modulator, bridge, filter, and the EMI you buy it with',
                    topics: ['Loss follows frequency not volume', 'The speaker is part of the filter', 'Dead time is crossover distortion', 'No load is now dangerous']
                },
                {
                    id: 7,
                    title: 'Design: A Headphone Amplifier',
                    description: 'One output that has to drive a 37:1 range of loads, and why output impedance is a tone control',
                    topics: ['5 V for high Z, 20 mA for low', 'Zout against a swinging load', 'The op-amp is not the problem', 'Excess gain is a hazard']
                }
            ]
        }
    ],

    // Calculate total lessons and exercises
    get totalLessons() {
        return this.modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
    },

    get totalModules() {
        return this.modules.length;
    },

    // Get module by ID
    getModule(id) {
        return this.modules.find(m => m.id === id);
    },

    // Get lesson by module and lesson ID
    getLesson(moduleId, lessonId) {
        const module = this.getModule(moduleId);
        if (!module) return null;
        return module.lessons.find(l => l.id === lessonId);
    },

    // Get navigation structure for sidebar
    getNavStructure() {
        return this.modules.map(mod => ({
            id: mod.id,
            title: mod.title,
            lessons: mod.lessons.map(les => ({
                id: les.id,
                title: les.title
            }))
        }));
    }
};

// ===== APP STATE =====
const AppState = {
    currentModule: null,
    currentLesson: null,
    progress: null,

    init() {
        this.progress = AD.getProgress();
        const lastVisited = AD.getLastVisited();
        if (lastVisited) {
            const [modStr, lesStr] = lastVisited.split('/');
            const modId = parseInt(modStr.replace('module-', ''));
            const lesId = parseInt(lesStr.replace('lesson-', ''));
            if (modId && lesId) {
                this.currentModule = modId;
                this.currentLesson = lesId;
            }
        }
    },

    setCurrentLocation(moduleId, lessonId) {
        this.currentModule = moduleId;
        this.currentLesson = lessonId;
        AD.setLastVisited(`module-${moduleId}/lesson-${lessonId}`);
    },

    toggleLessonComplete(moduleId, lessonId) {
        const done = AD.toggleLessonDone(moduleId, lessonId);
        this.progress = AD.getProgress();
        return done;
    },

    getModuleProgress(moduleId) {
        const module = CURRICULUM.getModule(moduleId);
        if (!module) return 0;
        const completed = module.lessons.filter(l =>
            AD.isLessonDone(moduleId, l.id)
        ).length;
        return Math.round((completed / module.lessons.length) * 100);
    },

    getOverallProgress() {
        let total = 0;
        let completed = 0;
        CURRICULUM.modules.forEach(mod => {
            mod.lessons.forEach(les => {
                total++;
                if (AD.isLessonDone(mod.id, les.id)) completed++;
            });
        });
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }
};

// ===== NAVIGATION =====
const Navigation = {
    init() {
        this.buildSidebar();
        this.updateProgress();
        this.bindSearch();
    },

    buildSidebar() {
        const container = document.getElementById('module-nav');
        if (!container) return;

        let html = '';
        CURRICULUM.modules.forEach(mod => {
            const modProgress = AppState.getModuleProgress(mod.id);
            const isActive = AppState.currentModule === mod.id;
            html += `
                <div class="module-group ${isActive ? '' : 'collapsed'}" data-module="${mod.id}">
                    <div class="module-header">
                        <span class="module-title">${mod.id}. ${mod.title}</span>
                        <span class="module-progress">${modProgress}%</span>
                    </div>
                    <div class="lesson-list">
            `;
            mod.lessons.forEach(les => {
                const done = AD.isLessonDone(mod.id, les.id);
                const active = AppState.currentModule === mod.id && AppState.currentLesson === les.id;
                html += `
                    <a href="#module-${mod.id}/lesson-${les.id}"
                       class="lesson-link ${done ? 'completed' : ''} ${active ? 'active' : ''}"
                       data-module="${mod.id}" data-lesson="${les.id}">
                        <span class="lesson-indicator">${done ? '✓' : '○'}</span>
                        <span class="lesson-title">${les.id}. ${les.title}</span>
                    </a>
                `;
            });
            html += '</div></div>';
        });

        container.innerHTML = html;

        // Bind module headers for collapse
        container.querySelectorAll('.module-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    },

    updateProgress() {
        const overall = AppState.getOverallProgress();
        const progressFill = document.getElementById('overall-progress');
        const progressText = document.getElementById('progress-text');

        if (progressFill) progressFill.style.width = `${overall}%`;
        if (progressText) progressText.textContent = `${overall}% Complete`;

        // Update module progress indicators
        CURRICULUM.modules.forEach(mod => {
            const modProgress = AppState.getModuleProgress(mod.id);
            const el = document.querySelector(`.module-group[data-module="${mod.id}"] .module-progress`);
            if (el) el.textContent = `${modProgress}%`;
        });

        // Update lesson indicators
        document.querySelectorAll('.lesson-link').forEach(link => {
            const modId = parseInt(link.dataset.module);
            const lesId = parseInt(link.dataset.lesson);
            const done = AD.isLessonDone(modId, lesId);
            link.classList.toggle('completed', done);
            const indicator = link.querySelector('.lesson-indicator');
            if (indicator) indicator.textContent = done ? '✓' : '○';
        });

        // Update mark complete button
        const markBtn = document.getElementById('mark-complete');
        if (markBtn && AppState.currentModule && AppState.currentLesson) {
            const done = AD.isLessonDone(AppState.currentModule, AppState.currentLesson);
            markBtn.textContent = done ? 'Mark Incomplete' : 'Mark Complete';
            markBtn.classList.toggle('done', done);
        }
    },

    bindSearch() {
        const input = document.getElementById('search-input');
        if (!input) return;

        input.addEventListener('input', () => {
            const query = input.value.toLowerCase().trim();
            document.querySelectorAll('.lesson-link').forEach(link => {
                const title = link.querySelector('.lesson-title').textContent.toLowerCase();
                link.style.display = (!query || title.includes(query)) ? '' : 'none';
            });
            document.querySelectorAll('.module-group').forEach(group => {
                const visibleLessons = group.querySelectorAll('.lesson-link:not([style*="display: none"])');
                group.style.display = visibleLessons.length > 0 ? '' : 'none';
            });
        });
    },

    setActiveLesson(moduleId, lessonId) {
        document.querySelectorAll('.lesson-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(
            `.lesson-link[data-module="${moduleId}"][data-lesson="${lessonId}"]`
        );
        if (activeLink) {
            activeLink.classList.add('active');
            // Expand parent module
            activeLink.closest('.module-group').classList.remove('collapsed');
        }
    }
};

// ===== ROUTER =====
const Router = {
    init() {
        this.installTimerScope();
        window.addEventListener('hashchange', () => this.handleRoute());

        // Clicking a link to the lesson you are ALREADY reading changes no
        // hash, so no hashchange fires and nothing above runs - the reader
        // clicks the highlighted sidebar entry and stays stranded wherever
        // they had scrolled to. Catch that one case here. Delegated, because
        // the sidebar, the path thread, the in-lesson nav and the floating
        // next button are all rebuilt at different times.
        document.addEventListener('click', (e) => {
            const a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
            if (!a) return;
            if (a.getAttribute('href') === window.location.hash) this.scrollToTop();
        });

        this.handleRoute();
    },

    /**
     * Lesson scripts start animation loops - setInterval redraws, rAF loops,
     * chained setTimeouts. Nothing in a lesson ever tears them down, because
     * each lesson was written as though it owned the whole page. Once the
     * reader navigates on, those callbacks keep firing against a DOM that no
     * longer contains their canvas or their inputs, producing an endless
     * stream of "Cannot read properties of null" errors and burning CPU for
     * the rest of the session.
     *
     * Tag every timer with the navigation generation that created it, then
     * cancel the stale ones on the next lesson load.
     */
    installTimerScope() {
        if (this._timerScopeInstalled) return;
        this._timerScopeInstalled = true;

        const realSetInterval = window.setInterval;
        const realSetTimeout = window.setTimeout;
        const realRAF = window.requestAnimationFrame;
        const realClearInterval = window.clearInterval;
        const realClearTimeout = window.clearTimeout;
        const realCancelRAF = window.cancelAnimationFrame;

        let tracked = [];

        const track = (kind, id) => {
            tracked.push({ kind: kind, id: id, gen: Router.navGeneration });
            return id;
        };

        window.setInterval = function () {
            return track('interval', realSetInterval.apply(window, arguments));
        };
        window.setTimeout = function () {
            return track('timeout', realSetTimeout.apply(window, arguments));
        };
        window.requestAnimationFrame = function () {
            return track('raf', realRAF.apply(window, arguments));
        };

        this.clearStaleTimers = function () {
            const gen = Router.navGeneration;
            const keep = [];
            for (const t of tracked) {
                if (t.gen === gen) { keep.push(t); continue; }
                try {
                    if (t.kind === 'interval') realClearInterval(t.id);
                    else if (t.kind === 'timeout') realClearTimeout(t.id);
                    else realCancelRAF(t.id);
                } catch (e) { /* already fired or cancelled */ }
            }
            tracked = keep;
        };

        this.trackedTimerCount = function () { return tracked.length; };
    },

    /**
     * Wrap a lesson's inline script so its top-level declarations are local.
     *
     * Every lesson script is injected into the one shared global scope. Many
     * of them open with `const canvas = ...; const ctx = ...; const W = ...`,
     * so navigating from one such lesson to another throws
     *     SyntaxError: Identifier 'canvas' has already been declared
     * at parse time, and the entire second lesson's script never runs. That
     * is why some lessons render only when they are the first one opened.
     *
     * Wrapping in a function expression gives each lesson its own scope. The
     * catch is that markup calls handlers through inline on*= attributes,
     * which resolve against `window` - so any top-level function is
     * re-published there afterwards, preserving that contract.
     */
    scopeLessonScript(code) {
        if (!code || !code.trim()) return code;

        const names = new Set();
        const patterns = [
            /^[ \t]*(?:async[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)/gm,
            /^[ \t]*(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:async[ \t]*)?(?:function\b|\([^)]*\)[ \t]*=>)/gm
        ];
        for (const rx of patterns) {
            let m;
            while ((m = rx.exec(code)) !== null) names.add(m[1]);
        }

        const publish = Array.from(names)
            .map(n => `try { window[${JSON.stringify(n)}] = ${n}; } catch (e) {}`)
            .join('\n');

        return '(function () {\n' + code + '\n' + publish + '\n})();';
    },

    // Reduce a script src to a comparable key: lesson files reference the
    // shared assets as '../../assets/x.js' while index.html uses 'assets/x.js'.
    normalizeScriptSrc(src) {
        if (!src) return '';
        return String(src)
            .split('?')[0]
            .replace(/^(?:\.\.\/)+/, '')
            .replace(/^\.\//, '')
            .replace(/^\//, '');
    },

    /**
     * Put the reader at the top of the new page.
     *
     * This is less obvious than it looks, because the element that scrolls is
     * not the element the content goes into. #lesson-content is an ordinary
     * div with no overflow; the scroller is its parent <main id="content">,
     * which carries height:100vh and overflow-y:auto. renderPath() had been
     * setting scrollTop on #lesson-content for as long as it has existed,
     * which does exactly nothing, and renderLesson() never reset it at all.
     * The symptom: open a lesson from halfway down a long one and you land
     * halfway down the new one, usually mid-sentence.
     *
     * Both the container and the window are reset, because which one scrolls
     * depends on the viewport - the phone layout drops the fixed height so the
     * document itself scrolls - and resetting one that is already at zero is
     * free.
     */
    scrollToTop() {
        const main = document.getElementById('content');
        if (main) main.scrollTop = 0;
        if (window.scrollTo) window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
    },

    handleRoute() {
        const hash = window.location.hash.slice(1);
        if (!hash) {
            this.showWelcome();
            return;
        }

        if (hash === 'path') {
            this.showPath();
            return;
        }

        const match = hash.match(/^module-(\d+)\/lesson-(\d+)$/);
        if (match) {
            const moduleId = parseInt(match[1]);
            const lessonId = parseInt(match[2]);
            this.loadLesson(moduleId, lessonId);
        } else {
            this.showWelcome();
        }
    },

    /**
     * The ordered spine, as opposed to the sidebar's topic catalogue. See
     * assets/learning-path.js for why the two differ and which one is the
     * teaching order.
     */
    showPath() {
        const content = document.getElementById('lesson-content');
        if (!content || !window.LEARNING_PATH) return;

        this.navGeneration++;
        if (this.clearStaleTimers) this.clearStaleTimers();
        WidgetFactory.destroyAll();

        document.getElementById('breadcrumb').innerHTML =
            '<span class="breadcrumb-module">Learning path</span>';

        const done = AD.getProgress().lessons || {};
        const total = LEARNING_PATH.total();
        let complete = 0;
        LEARNING_PATH.steps().forEach(s => {
            if (s.ref && done['m' + s.ref[0] + 'l' + s.ref[1]]) complete++;
        });

        const esc = (s) => String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        let html = `
            <div class="card">
                <h2>The learning path</h2>
                <p>Four semesters. Two of them cover Electronics I and II as those courses are
                actually taught; the other two go past them, into the design judgement, real
                parts and bench work a first pass never has room for.</p>
                <p>The order is deliberately not the traditional one. A standard Electronics I
                opens on semiconductor physics and spends weeks inside the device before you
                build anything. Here the ideal op-amp comes first &mdash; you can use one long
                before you can explain one &mdash; and the transistor arrives as the answer to
                &ldquo;how was that built&rdquo;. The physics is not skipped; it is stage 1.5,
                where it explains something you have already used.</p>
                <p>The sidebar runs in this same order. <strong>${complete} of ${total} steps
                complete${LEARNING_PATH.todo().length
                    ? `, ${LEARNING_PATH.todo().length} still to write`
                    : ''}.</strong></p>
            </div>`;

        // Grouped by semester, because the shape of the thing is four terms and
        // a flat list of fifteen stages hides that.
        LEARNING_PATH.SEMESTERS.forEach(sem => {
            const stages = LEARNING_PATH.stagesFor(sem.id);
            const semSteps = LEARNING_PATH.steps().filter(s => s.semester === sem.id);
            const semDone = semSteps.filter(s => s.ref && done['m' + s.ref[0] + 'l' + s.ref[1]]).length;
            const semTodo = semSteps.filter(s => !s.ref).length;

            html += `<div class="card semester-head">
                <h2>Semester ${sem.id}: ${esc(sem.title)}</h2>
                <p class="lesson-description">${esc(sem.blurb)}</p>
                <p class="path-step-earns">${semSteps.length} steps &middot;
                   ${semDone} complete${semTodo ? ` &middot; ${semTodo} still to write` : ''}</p>
            </div>`;

            stages.forEach((stage, si) => {
                html += `<div class="card">
                    <h3>${sem.id}.${si + 1} &nbsp; ${esc(stage.title)}</h3>
                    <p class="lesson-description">${esc(stage.blurb)}</p>
                    <ol class="path-steps">`;

                stage.steps.forEach(step => {
                    const isDone = step.ref && done['m' + step.ref[0] + 'l' + step.ref[1]];
                    const href = step.ref ? `#module-${step.ref[0]}/lesson-${step.ref[1]}` : null;
                    // A step with no lesson behind it is shown, not hidden: the
                    // syllabus is the plan, and its gaps are part of the plan.
                    const tag = step.ref
                        ? `<span class="topic-tag">M${step.ref[0]}&middot;${step.ref[1]}</span>`
                        : `<span class="topic-tag is-todo">not yet written</span>`;
                    const title = href
                        ? `<a href="${href}">${esc(step.title)}</a>`
                        : `<span class="step-todo">${esc(step.title)}</span>`;

                    html += `<li class="path-step${isDone ? ' is-done' : ''}${step.ref ? '' : ' is-todo'}">
                        <div class="path-step-head">${isDone ? '&#10003; ' : ''}${title} ${tag}</div>
                        <div class="path-step-earns">${esc(step.earns)}</div>
                    </li>`;
                });

                html += `</ol></div>`;
            });
        });

        const welcomeCard = content.querySelector('.welcome-card');
        if (welcomeCard) welcomeCard.style.display = 'none';
        content.innerHTML = html;
        this.scrollToTop();
    },

    showWelcome() {
        // Keep welcome screen visible
        const content = document.getElementById('lesson-content');
        if (content) {
            const welcomeCard = content.querySelector('.welcome-card');
            if (welcomeCard) {
                welcomeCard.style.display = 'block';
            }
        }
        document.getElementById('breadcrumb').innerHTML = '';
        // No lesson open, so there is nothing to go on to.
        this.updateNextFab(null, null);
    },

    // Incremented on every lesson load. Deferred work captures the value and
    // bails out if it no longer matches, so a handler queued for one lesson
    // never runs against the next lesson's DOM.
    navGeneration: 0,

    /**
     * Typeset the TeX in a freshly injected lesson.
     *
     * MathJax may still be downloading when the first lesson lands, so this
     * retries briefly rather than silently doing nothing - the failure mode
     * otherwise is a lesson that shows raw \frac{}{} on a fast navigation and
     * renders correctly on reload, which is maddening to debug.
     */
    typesetMath(root, attempt) {
        attempt = attempt || 0;
        const gen = this.navGeneration;
        if (!window.MathJax || !MathJax.typesetPromise) {
            if (attempt < 40) setTimeout(() => this.typesetMath(root, attempt + 1), 150);
            return;
        }
        if (MathJax.typesetClear) {
            try { MathJax.typesetClear([root]); } catch (e) {}
        }
        MathJax.typesetPromise([root]).catch(err => {
            // A malformed macro in one lesson must not stop the page.
            console.warn('MathJax: ' + (err && err.message ? err.message : err));
        }).then(() => {
            // If the reader navigated away mid-typeset, the work was wasted
            // but harmless; nothing to undo.
            if (gen !== this.navGeneration) return;
        });
    },

    loadLesson(moduleId, lessonId) {
        this.navGeneration++;
        if (this.clearStaleTimers) this.clearStaleTimers();
        const module = CURRICULUM.getModule(moduleId);
        const lesson = CURRICULUM.getLesson(moduleId, lessonId);

        if (!module || !lesson) {
            this.showWelcome();
            return;
        }

        // Update state
        AppState.setCurrentLocation(moduleId, lessonId);
        Navigation.setActiveLesson(moduleId, lessonId);
        Navigation.updateProgress();

        // Update breadcrumb
        document.getElementById('breadcrumb').innerHTML = `
            <span class="breadcrumb-module">Module ${module.id}: ${module.title}</span>
            <span class="breadcrumb-sep">›</span>
            <span class="breadcrumb-lesson">${lesson.title}</span>
        `;

        // Destroy existing widgets
        WidgetFactory.destroyAll();

        // Load lesson content
        this.updateNextFab(module, lesson);
        this.renderLesson(module, lesson);
    },

    renderLesson(module, lesson) {
        const content = document.getElementById('lesson-content');
        const lessonFile = `lessons/module-${String(module.id).padStart(2, '0')}/lesson-${String(lesson.id).padStart(2, '0')}.html`;

        // Try to load lesson content via XMLHttpRequest (works in most browsers with file://)
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                let lessonHtml = '';

                if (xhr.status === 200 || xhr.status === 0) {
                    // Status 0 is common for file:// protocol
                    const responseText = xhr.responseText;
                    if (responseText && responseText.trim().length > 0) {
                        lessonHtml = responseText;
                    }
                }

                // If no content loaded, show instructions
                if (!lessonHtml) {
                    lessonHtml = `
                        <div class="card lesson-header">
                            <h2>${lesson.title}</h2>
                            <p class="lesson-description">${lesson.description}</p>
                            <div class="lesson-topics">
                                ${lesson.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')}
                            </div>
                        </div>
                        <div class="card">
                            <h3>Browser Security Notice</h3>
                            <div class="warn">
                                <strong>Local File Access Blocked:</strong> Your browser's security policy prevents loading local files directly.
                                <br><br>
                                <strong>Solution:</strong> Run a local web server:
                                <ol style="margin-top: 10px;">
                                    <li>Open Command Prompt in this folder</li>
                                    <li>Run: <code>python -m http.server 8000</code></li>
                                    <li>Open: <a href="http://localhost:8000" target="_blank">http://localhost:8000</a></li>
                                </ol>
                            </div>
                        </div>
                    `;
                }

                // Add navigation buttons
                // The path thread goes FIRST: what this rests on, before the
                // reader starts reading what rests on it.
                lessonHtml = this.renderPathThread(module, lesson) + lessonHtml;
                lessonHtml += this.renderLessonNav(module, lesson);

                content.innerHTML = lessonHtml;
                this.scrollToTop();

                // Execute any scripts in the loaded content.
                //
                // Lessons are fragments injected into this page, but several were
                // authored as standalone documents and still carry their own
                // <script src> tags for the shared assets. Re-running those files
                // redeclares their top-level bindings (const AD, class BaseWidget,
                // const SchematicLib), which throws
                //     SyntaxError: Identifier 'AD' has already been declared
                // and aborts the rest of that tag - silently breaking the lesson's
                // widgets. Skip any external script this page has already loaded.
                // Seeded from the page's own scripts, and from every external
                // script any earlier lesson already injected. The second half
                // matters for CDN libraries: nine lessons carry their own
                // MathJax tag, and MathJax v3 throws when a second copy loads
                // over the first. Because it is cross-origin the browser
                // reports only an opaque "Script error.", which is why this
                // was invisible until every lesson was swept.
                Router.injectedScriptSrc = Router.injectedScriptSrc || new Set();
                const loadedSrc = new Set(Router.injectedScriptSrc);
                Array.prototype.forEach.call(
                    document.querySelectorAll('head script[src], body > script[src]'),
                    s => loadedSrc.add(Router.normalizeScriptSrc(s.getAttribute('src')))
                );

                // Lessons authored as standalone pages defer their setup to
                //     document.addEventListener('DOMContentLoaded', ...)
                // or window 'load'. Both events fired long before this fragment
                // was injected, so those handlers would never run and the
                // lesson's canvases would stay blank. While the lesson's scripts
                // execute, redirect such registrations to run on the next tick -
                // by which point the lesson markup is already in the DOM, which
                // is the condition those handlers were actually waiting for.
                const realDocAdd = document.addEventListener;
                const realWinAdd = window.addEventListener;
                const gen = Router.navGeneration;
                const runSoon = fn => setTimeout(() => {
                    // The reader navigated on before this fired; the elements
                    // this handler expects are gone.
                    if (Router.navGeneration !== gen) return;
                    try {
                        fn.call(document, new Event('DOMContentLoaded'));
                    } catch (err) {
                        console.error('Lesson init failed:', err);
                    }
                }, 0);

                document.addEventListener = function (type, fn, opts) {
                    if (type === 'DOMContentLoaded' && typeof fn === 'function') {
                        return runSoon(fn);
                    }
                    return realDocAdd.call(document, type, fn, opts);
                };
                window.addEventListener = function (type, fn, opts) {
                    if ((type === 'load' || type === 'DOMContentLoaded') && typeof fn === 'function') {
                        return runSoon(fn);
                    }
                    return realWinAdd.call(window, type, fn, opts);
                };

                const scripts = content.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const rawSrc = oldScript.getAttribute('src');
                    if (rawSrc) {
                        const key = Router.normalizeScriptSrc(rawSrc);
                        if (loadedSrc.has(key)) {
                            oldScript.parentNode.removeChild(oldScript);
                            return;
                        }
                        loadedSrc.add(key);
                        Router.injectedScriptSrc.add(key);
                    }
                    const newScript = document.createElement('script');
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                    } else {
                        newScript.textContent = Router.scopeLessonScript(oldScript.textContent);
                    }
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });

                setTimeout(() => {
                    document.addEventListener = realDocAdd;
                    window.addEventListener = realWinAdd;
                }, 0);

                // Re-typeset the TeX in the lesson just injected. MathJax is
                // loaded once by index.html and told not to typeset at
                // startup, because at that point the lesson pane is empty -
                // every lesson arrives later, by XHR.
                Router.typesetMath(content);

                // Wire up any inline checkpoints. Markup-driven, so a lesson
                // only writes HTML and never has to construct a widget.
                if (window.Checkpoints) window.Checkpoints.scan(content);

                // Normalize manual SVG schematics (supply rails, etc.)
                if (window.SchematicNormalizer) {
                    window.SchematicNormalizer.run(content);
                    setTimeout(() => window.SchematicNormalizer.run(content), 50);
                    setTimeout(() => window.SchematicNormalizer.run(content), 250);
                }
            }
        };

        try {
            xhr.open('GET', lessonFile, true);
            xhr.send();
        } catch (e) {
            // Fallback for strict CORS - show placeholder
            content.innerHTML = `
                <div class="card lesson-header">
                    <h2>${lesson.title}</h2>
                    <p class="lesson-description">${lesson.description}</p>
                    <div class="lesson-topics">
                        ${lesson.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')}
                    </div>
                </div>
                <div class="card">
                    <div class="warn">
                        <strong>Note:</strong> Your browser blocks local file loading.
                        Try opening with a local server: <code>python -m http.server 8000</code>
                    </div>
                </div>
            ` + this.renderLessonNav(module, lesson);
        }
    },

    /**
     * The incremental thread, made visible.
     *
     * A course is only cumulative if the reader can see what a lesson rests on
     * and what it pays for later. The syllabus already knows both - it is an
     * ordered spine - so this reads them straight out of it rather than asking
     * 368 lessons to declare their own prerequisites, which would rot the first
     * time anything moved.
     *
     * Returns '' for a lesson that is not on the path; those are reference
     * material rather than steps, and inventing a prerequisite for them would
     * be a lie.
     */
    renderPathThread(module, lesson) {
        if (!window.LEARNING_PATH) return '';
        const steps = LEARNING_PATH.steps();
        const i = steps.findIndex(s => s.ref && s.ref[0] === module.id && s.ref[1] === lesson.id);
        if (i === -1) return '';

        const here = steps[i];
        const prev = i > 0 ? steps[i - 1] : null;
        const next = i < steps.length - 1 ? steps[i + 1] : null;
        const link = s => s.ref
            ? `<a href="#module-${s.ref[0]}/lesson-${s.ref[1]}">${s.title}</a>`
            : `<span class="thread-todo">${s.title}</span>`;

        let html = '<div class="path-thread">';
        html += `<div class="thread-where">Step ${here.position} of ${LEARNING_PATH.total()}` +
                ` &middot; <a href="#path">${here.stageTitle}</a></div>`;
        html += '<div class="thread-rows">';
        if (prev) {
            html += `<div class="thread-row"><span class="thread-label">Rests on</span>` +
                    `<span class="thread-body">${link(prev)}</span></div>`;
        }
        if (here.earns) {
            html += `<div class="thread-row is-here"><span class="thread-label">You get</span>` +
                    `<span class="thread-body">${here.earns}</span></div>`;
        }
        if (next) {
            html += `<div class="thread-row"><span class="thread-label">Leads to</span>` +
                    `<span class="thread-body">${link(next)}</span></div>`;
        }
        html += '</div></div>';
        return html;
    },

    /**
     * Where "next" goes from here: the next lesson in this module, or the first
     * lesson of the next module. Returns null at the very end of the course.
     *
     * Factored out because two things need it - the nav strip at the foot of a
     * lesson and the floating arrow - and they must never disagree about what
     * comes next.
     */
    nextFrom(module, lesson) {
        const i = module.lessons.findIndex(l => l.id === lesson.id);
        if (i !== -1 && i < module.lessons.length - 1) {
            const n = module.lessons[i + 1];
            return { href: `#module-${module.id}/lesson-${n.id}`, title: n.title, sameModule: true };
        }
        const mi = CURRICULUM.modules.findIndex(m => m.id === module.id);
        if (mi !== -1 && mi < CURRICULUM.modules.length - 1) {
            const nm = CURRICULUM.modules[mi + 1];
            const first = nm.lessons[0];
            if (first) {
                return { href: `#module-${nm.id}/lesson-${first.id}`,
                         title: first.title, sameModule: false, module: nm.title };
            }
        }
        return null;
    },

    /**
     * The floating next-lesson control.
     *
     * Reading a lesson end to end and then having to go back to the sidebar to
     * continue is the wrong shape for a course that is meant to be read in
     * order. This keeps the next step one thumb away at all times, which
     * matters most on a phone where the sidebar is behind a hamburger.
     */
    updateNextFab(module, lesson) {
        const fab = document.getElementById('next-lesson-fab');
        if (!fab) return;
        const next = module && lesson ? this.nextFrom(module, lesson) : null;
        if (!next) { fab.hidden = true; return; }
        fab.hidden = false;
        fab.href = next.href;
        fab.querySelector('.fab-title').textContent = next.title;
        fab.querySelector('.fab-kicker').textContent =
            next.sameModule ? 'Next lesson' : 'Next: ' + next.module;
        fab.setAttribute('aria-label', 'Next lesson: ' + next.title);
    },

    renderLessonNav(module, lesson) {
        const lessons = module.lessons;
        const currentIndex = lessons.findIndex(l => l.id === lesson.id);
        const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
        const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

        // Check for next module
        const moduleIndex = CURRICULUM.modules.findIndex(m => m.id === module.id);
        const nextModule = moduleIndex < CURRICULUM.modules.length - 1
            ? CURRICULUM.modules[moduleIndex + 1]
            : null;
        const prevModule = moduleIndex > 0
            ? CURRICULUM.modules[moduleIndex - 1]
            : null;

        let html = '<div class="lesson-nav">';

        if (prevLesson) {
            html += `<a href="#module-${module.id}/lesson-${prevLesson.id}" class="nav-btn prev">
                ← ${prevLesson.title}
            </a>`;
        } else if (prevModule) {
            const lastLesson = prevModule.lessons[prevModule.lessons.length - 1];
            html += `<a href="#module-${prevModule.id}/lesson-${lastLesson.id}" class="nav-btn prev">
                ← ${prevModule.title}
            </a>`;
        } else {
            html += '<span class="nav-btn disabled">← Start</span>';
        }

        if (nextLesson) {
            html += `<a href="#module-${module.id}/lesson-${nextLesson.id}" class="nav-btn next">
                ${nextLesson.title} →
            </a>`;
        } else if (nextModule) {
            const firstLesson = nextModule.lessons[0];
            html += `<a href="#module-${nextModule.id}/lesson-${firstLesson.id}" class="nav-btn next">
                ${nextModule.title} →
            </a>`;
        } else {
            html += '<span class="nav-btn disabled">End →</span>';
        }

        html += '</div>';
        return html;
    }
};

// Expose globally
window.CURRICULUM = CURRICULUM;
window.AppState = AppState;
window.Navigation = Navigation;
window.Router = Router;
