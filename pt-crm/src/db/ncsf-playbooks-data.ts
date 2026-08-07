/**
 * NCSF CPT–grounded coach playbooks (synthesized concepts for coaching support only).
 * Not a substitute for the textbook, certification materials, or medical care.
 *
 * Conventions (keep when editing):
 * - 4–5 follow-ups, 5–6 steps, 3–4 interventions, 3–4 red flags
 * - triggerPhrases include retrieval PHRASE_BOOST strings where relevant
 * - body ends with the shared NCSF disclaimer sentence
 * - safety / special-pop entries include contraindications
 */

const NCSF_DISCLAIMER =
  "Grounded in NCSF CPT concepts (not a substitute for the textbook or medical care).";

export type PlaybookDef = {
  slug: string;
  title: string;
  category: string;
  triggerPhrases: string;
  tags: string;
  summary: string;
  followUpQuestions: string[];
  solutionSteps: string[];
  interventions: string[];
  redFlags: string[];
  contraindications?: string;
  body: string;
};

export const NCSF_PLAYBOOKS: PlaybookDef[] = [
  {
    slug: "ncsf-needs-analysis-priority",
    title: "Needs Analysis: Health & Function Before Goals",
    category: "programming",
    triggerPhrases:
      "needs analysis,FITT contact time,health before aesthetics,prioritize goals,intake priority,MSK CV metabolic screen,what to train first,program priorities",
    tags: "ncsf,needs-analysis,programming,fitt,priority,health",
    summary:
      "Rank musculoskeletal, cardiovascular, and metabolic health/function before pure appearance goals; fit FITT to real PT contact time.",
    followUpQuestions: [
      "What is the client’s top stated goal vs any medical or movement limits?",
      "Any known CV, metabolic, or MSK issues or clearance needs?",
      "How many supervised sessions per week and minutes each?",
      "What can they realistically do unsupervised between sessions?",
      "Which risks (pain, deconditioning, falls, BP) must be managed first?",
    ],
    solutionSteps: [
      "Collect goals, history, and constraints; separate health risks from preferences.",
      "Prioritize MSK function, CV readiness, and metabolic lifestyle basics before hypertrophy or aesthetic detail.",
      "Define FITT (frequency, intensity, time, type) that fits contact minutes plus homework capacity.",
      "Build the first block around competency, tolerance, and adherence—not max novelty.",
      "Revisit priorities when screens improve or medical status changes.",
      "Document what is deferred and why so goals stay transparent.",
    ],
    interventions: [
      "Written priority stack: health/function → skill → capacity → advanced goals",
      "FITT card per session length (e.g. 30 vs 60 min)",
      "Homework movement snacks for low-contact clients",
      "Clear stop rules when symptoms exceed coaching scope",
    ],
    redFlags: [
      "Uncontrolled symptoms or new chest pain/dizziness with activity",
      "Client pushing max loads before basic function is restored",
      "No medical clearance when history warrants it",
    ],
    contraindications:
      "Do not program aggressive aesthetic phases when unresolved red-flag screens or medical clearance is pending.",
    body: `Needs analysis ranks health and function ahead of vanity goals. Address major movement limits, cardiovascular readiness, and metabolic lifestyle factors before body-composition detail or advanced performance. Fit FITT to real contact time: short sessions favor fewer quality patterns, clear intensity targets, and homework the client can own. Fitness goals still matter—they sit behind safety and capacity. Coaching supports decisions; it does not diagnose disease. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-kinetic-chain-local-global",
    title: "Kinetic Chain: Local Stabilizers vs Global Mobilizers",
    category: "corrective",
    triggerPhrases:
      "kinetic chain,local stabilizers,global mobilizers,feed-forward bracing,stability before load,core bracing first,segmental stability,global movers dominate",
    tags: "ncsf,kinetic-chain,stability,core,corrective,bracing",
    summary:
      "Distinguish local stabilizers from global mobilizers; use feed-forward bracing and earn stability before heavy external loads.",
    followUpQuestions: [
      "Does pain or shaking appear under light load or only heavy?",
      "Can they brace and breathe without excessive breath-holding?",
      "Is the issue more segmental control or global strength?",
      "Any history of spine, hip, or shoulder instability?",
      "Current max loads relative to movement quality?",
    ],
    solutionSteps: [
      "Observe control under bodyweight or light load before adding external load.",
      "Cue anticipatory (feed-forward) bracing for lifts and changes of direction.",
      "Train local control in pain-free ranges; integrate into global patterns.",
      "Delay heavy bilateral loading when form collapses or bracing fails.",
      "Progress from stable surfaces and simple patterns toward complex/global work.",
      "Re-test quality at session intensity, not only warm-up sets.",
    ],
    interventions: [
      "Dead-bug / bird-dog quality sets with breathing",
      "Pallof and anti-rotation progressions",
      "Isometric holds before dynamic loaded variations",
      "Tempo compound lifts once bracing is consistent",
    ],
    redFlags: [
      "Neurological symptoms (numbness, true weakness, saddle anesthesia)",
      "Trauma or progressive night pain",
      "Unexplained instability after acute injury",
    ],
    contraindications:
      "Do not chase PR loads when local control or bracing fails under submaximal work.",
    body: `Local stabilizers support segmental control; global mobilizers produce larger joint motion and force. Coaches often see global muscles compensating when local control is late or weak. Teach feed-forward bracing so support arrives before load, then layer global strength. Emphasize clean patterns before heavy external loading. This is a programming frame, not a diagnosis of instability. Refer neuro signs, trauma, or progressive pain. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-form-force-closure",
    title: "Form Closure vs Force Closure (Coach Frame)",
    category: "corrective",
    triggerPhrases:
      "form closure,force closure,joint stability soft tissue,postural distortion programming,passive vs active stability,SI stability coach,structural vs muscular support",
    tags: "ncsf,form-closure,force-closure,posture,stability,corrective",
    summary:
      "Form closure is bony/ligamentous fit; force closure is muscular and fascial support—posture patterns change how you program support vs mobility.",
    followUpQuestions: [
      "Is the limit more structural stiffness or poor active control?",
      "Which posture pattern shows up (upper/lower cross tendencies)?",
      "Does light activation improve tolerance more than aggressive stretching?",
      "Pain with static postures, loaded motion, or both?",
      "Any clinician diagnosis the client already has?",
    ],
    solutionSteps: [
      "Do not treat every restriction as a stretch problem; check active support capacity.",
      "Use force-closure ideas: timed activation around the segment that feels unsupported.",
      "Respect form-closure limits—do not force end-range into painful bony stops.",
      "Link posture observations to exercise selection (support weak lines, open stiff lines carefully).",
      "Progress load only when active control improves symptom tolerance.",
      "Refer when pain suggests joint pathology beyond coaching scope.",
    ],
    interventions: [
      "Low-load activation before global stretch sessions",
      "Closed-chain control drills for hips/shoulders as indicated",
      "Posture-biased pairs (e.g. row + careful pec openers)",
      "Breathing + bracing under mild load",
    ],
    redFlags: [
      "Acute joint trauma or locking/giving way",
      "Inflammatory red flags or systemic symptoms",
      "Pain that worsens with all positions and light activity",
    ],
    contraindications:
      "Do not force painful end-range or treat coach frames as SI/joint diagnoses.",
    body: `Form closure describes how joint shape and passive tissues contribute to stability. Force closure describes how muscles and soft tissues actively support a joint. Use this to decide when to prioritize activation and control versus mobility. Postural patterns often mix stiffness and under-support—program support and careful mobility, not random stretching. Never force painful end-range. Coaching is not diagnosis of SI or joint pathology. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-preparation-phase",
    title: "Preparation Phase Goals & Loading",
    category: "programming",
    triggerPhrases:
      "preparation phase,progressive preparation,prep phase,foundational phase,corrective first block,50-70% loads,activation stability competency,intro mesocycle,base phase training",
    tags: "ncsf,preparation,programming,progression,corrective,base",
    summary:
      "Prep phase builds joint function, activation, stability, and movement competency with moderate loads (~50–70%) and corrective warm-ups first.",
    followUpQuestions: [
      "Training age and recent time off?",
      "Which movement patterns fail screens or look uncoordinated?",
      "Session length and days available for the prep block?",
      "Any pain that must be worked around?",
      "How long until they want a strength or aesthetic peak block?",
    ],
    solutionSteps: [
      "Set prep goals: joint-friendly ROM, activation, stability, and pattern competency.",
      "Start sessions with corrective/activation warm-up before hard sets.",
      "Use light-to-moderate loads (~50–70% of known capacity) while technique is the limiter.",
      "Use circuits or supersets to accumulate volume efficiently when intensity is moderate.",
      "Log quality markers (control, pain policy, form RPE)—not only weight.",
      "Exit prep when patterns are repeatable under mild fatigue; then raise intensity.",
    ],
    interventions: [
      "Pattern A/B days with shared warm-up correctives",
      "Superset push-pull or upper-lower at moderate load",
      "Tempo work (e.g. 3-1-1) for control",
      "Weekly re-check of 1–2 key screens",
    ],
    redFlags: [
      "Pain escalating despite load reduction",
      "Dizziness or unusual CV response to moderate work",
      "Client demanding max testing before competency exists",
    ],
    body: `A preparation phase builds the base: joint function, muscle activation, stability, and movement competency. Favor technique and tissue tolerance over PRs. Moderate loads (often a 50–70% effort band) and efficient formats like circuits or supersets deliver volume without maximal neural stress. Put corrective and activation work in the warm-up so main sets start from a better position. Advance only when quality holds. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-warmup-types",
    title: "Warm-Up Types: General, Specific, Functional",
    category: "programming",
    triggerPhrases:
      "functional warm-up,functional warmup,warm-up types,general warm-up,specific warm-up,progressive warm-up,session warm up efficiency,contact time warm-up",
    tags: "ncsf,warm-up,programming,preparation,session-design",
    summary:
      "Use general, specific, and functional warm-ups with progressive intensity; keep them efficient for limited PT contact time.",
    followUpQuestions: [
      "How many minutes can the warm-up take without crowding the main work?",
      "What is the first main lift or energy-system focus?",
      "Any joints that need extra activation or mobility today?",
      "Client cold start (morning) or already active?",
      "Indoor heat vs cold environment?",
    ],
    solutionSteps: [
      "General: raise temperature and HR with low-skill rhythmic work.",
      "Specific: mobilize and activate tissues used in today’s session.",
      "Functional: rehearse main lifts/patterns at lighter load.",
      "Progress intensity gradually—no cold max efforts.",
      "Trim warm-up to 5–12 minutes in short sessions; keep high-transfer drills only.",
      "If contact time is tight, combine specific + functional into a short circuit.",
    ],
    interventions: [
      "2–5 min easy bike/row/walk (general)",
      "Targeted mobility + activation pair (specific)",
      "2–3 ramp-up sets of first compound (functional)",
      "Session-specific mini-circuit for 30-min slots",
    ],
    redFlags: [
      "Chest pain, unusual SOB, or lightheadedness during warm-up",
      "Sharp joint pain with progressive drills",
      "Dizziness that does not settle with reduced intensity",
    ],
    body: `Warm-ups prepare physiology and skill. General work raises temperature and circulation. Specific work addresses the tissues and ranges the session will use. Functional work rehearses the actual patterns at lower intensity. Progress intensity rather than jumping to top sets. In limited contact time, keep warm-ups short and high-transfer. Stop and refer for cardiac-type symptoms or sharp pain. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-cooldown-basics",
    title: "Cool-Down Basics & Blood Pooling",
    category: "programming",
    triggerPhrases:
      "cool down,cooldown,blood pooling,after cardio stop,gradual down ramp,post session recovery,large muscle rhythmic cool down,post-exercise hypotension",
    tags: "ncsf,cool-down,recovery,programming,safety",
    summary:
      "Use a gradual intensity down-ramp and large-muscle rhythmic work to limit blood pooling and support recovery after hard efforts.",
    followUpQuestions: [
      "Was the session high-intensity cardio or heavy resistance?",
      "Any history of lightheadedness when stopping suddenly?",
      "How much time is left for cool-down?",
      "Client on meds that affect BP or HR (self-reported)?",
      "Standing finish or can they sit for a minute if needed?",
    ],
    solutionSteps: [
      "Avoid abrupt full stops after hard cardio or circuits.",
      "Down-ramp intensity over several minutes with large-muscle rhythmic work.",
      "Add easy mobility or breathing once HR settles.",
      "Watch for dizziness; sit and seek help if severe.",
      "Keep cool-down brief but real in short sessions (even 3–5 minutes).",
    ],
    interventions: [
      "Easy walk or slow cycle 3–8 minutes",
      "Light rowing at conversational pace",
      "Standing-to-seated transition if lightheaded",
      "Optional easy stretch after HR drops",
    ],
    redFlags: [
      "Syncope or near-syncope",
      "Chest pain or severe shortness of breath post-exercise",
      "Persistent irregular heartbeat sensation with distress",
    ],
    contraindications:
      "Do not treat cool-down as medical care; urgent symptoms need emergency or clinical pathways.",
    body: `After hard work, a sudden stop can leave blood pooled in the limbs and contribute to lightheadedness. A cool-down gradually lowers intensity with large-muscle rhythmic activity so circulation and HR can settle. Even a few minutes of easy walking helps when time is short. Cool-down is not medical treatment; urgent symptoms need emergency or clinical care. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-resting-vitals-screen",
    title: "Resting Vitals Screen (RHR & BP Discipline)",
    category: "assessment",
    triggerPhrases:
      "resting heart rate,blood pressure,RHR protocol,BP categories,stage 1 hypertension,stage 2 BP,hypertensive crisis,HR over 100,when to refer BP,trainer measure BP",
    tags: "ncsf,assessment,rhr,blood-pressure,vitals,safety,refer",
    summary:
      "Measure RHR with discipline; consistent RHR >100 bpm warrants stop/refer judgment. Know BP category labels for referral—trainers do not diagnose hypertension.",
    followUpQuestions: [
      "Was the client seated and rested before measurement?",
      "Caffeine, stress, or recent exercise that could elevate readings?",
      "Any known CV diagnosis or meds (self-reported)?",
      "Symptoms: chest pain, severe headache, visual changes, dizziness?",
      "Is this a one-off or repeated high reading?",
    ],
    solutionSteps: [
      "Rest client seated, calm, feet flat; avoid talking during measure.",
      "Record RHR; if consistently above ~100 bpm at true rest, do not train hard—refer/clear.",
      "If measuring BP, use proper cuff size and posture; average repeated measures when possible.",
      "Use category language only for decision support (elevated, stage 1, stage 2, crisis)—do not diagnose.",
      "Crisis-range numbers or severe symptoms → emergency pathway, not a workout.",
      "Document and share with client to take to their clinician.",
    ],
    interventions: [
      "Standard RHR log at intake and periodic rechecks",
      "BP measure only if trained and equipment calibrated",
      "Session cancel/modify policy for out-of-scope vitals",
      "Referral script: bring readings to healthcare provider",
    ],
    redFlags: [
      "Resting HR consistently >100 bpm without clear transient cause",
      "BP in crisis range or with severe symptoms",
      "Chest pain, neuro symptoms, syncope",
    ],
    contraindications:
      "Do not start vigorous exercise when resting vitals or symptoms are outside safe coaching scope; trainers do not diagnose hypertension.",
    body: `Take resting heart rate after quiet rest—not right after walking in. Consistently high resting rates (often discussed around >100 bpm) are a stop-and-refer cue, not a cue to push intervals. Blood pressure categories (elevated, stage 1, stage 2, crisis) help coaches decide when to withhold training and refer—they are not a trainer’s diagnosis. Technique and calm conditions matter. Emergency symptoms need emergency care. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-body-comp-bmi-caveats",
    title: "Body Comp & BMI Caveats for Coaches",
    category: "assessment",
    triggerPhrases:
      "bmi caveat,BMI limitations,waist circumference,muscular BMI high,40 inch waist men,35 inch women,body fat coaching metric,body composition not diagnosis",
    tags: "ncsf,assessment,bmi,body-composition,waist,metrics",
    summary:
      "BMI misclassifies many muscular clients; waist cutpoints (men ~40 in, women ~35 in) add risk context; body fat is a coaching trend metric, not a medical diagnosis.",
    followUpQuestions: [
      "Is the client highly muscular or athletic relative to BMI?",
      "Waist measure available and taken consistently?",
      "What metric will you track for progress (photos, girths, performance)?",
      "Any eating-disorder history or distress about numbers?",
      "Client goal: health risk vs sport weight vs appearance?",
    ],
    solutionSteps: [
      "Explain BMI as a population screen with limits for muscular builds.",
      "When appropriate, use waist circumference as added health-risk context (~40 in men, ~35 in women as common coaching cutpoints).",
      "Prefer trends: girths, photos, strength, energy—not single-day body-fat panic.",
      "Never present coach measurements as medical diagnosis of obesity disease status.",
      "Choose metrics the client tolerates psychologically.",
      "Refer for clinical body-comp or medical weight management when indicated.",
    ],
    interventions: [
      "BMI + waist education card in intake",
      "Monthly girth protocol (same landmarks, tension, time of day)",
      "Performance KPIs alongside scale weight",
      "Opt-out for clients distressed by body metrics",
    ],
    redFlags: [
      "Disordered eating behaviors or rapid unhealthy weight loss",
      "Medical conditions requiring clinical weight supervision",
      "Severe distress or body-image spiral around measurements",
    ],
    contraindications:
      "Do not use coach body metrics as medical diagnoses or force measurements on distressed clients.",
    body: `BMI is a crude height–weight index and can mislabel muscular clients. Waist circumference adds practical risk context; common adult cutpoints discussed in fitness education include about 40 inches for men and 35 inches for women—coaching flags, not diagnoses. Body-fat estimates vary by method and day; treat them as trends, not medical labels. Stay sensitive: numbers can harm. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-upper-cross-corrective",
    title: "Upper Cross Tendencies: Corrective Coaching",
    category: "corrective",
    triggerPhrases:
      "upper cross,upper crossed,forward head,kyphosis desk posture,fails apley,weak mid traps,pec tightness,strengthen rhomboids,Y T reaches,wall angel,postural upper body",
    tags: "ncsf,upper-cross,corrective,posture,shoulder,scapula,wall-angel",
    summary:
      "Forward head/kyphotic tendencies and limited Apley/wall-angel positions: bias mid traps/rhomboids and scapular work; open pecs carefully; use rows and Y/T reaches.",
    followUpQuestions: [
      "Pain or only stiffness/postural fatigue?",
      "Apley or wall-angel: which side and which motion limits?",
      "Desk or phone hours per day?",
      "Pressing volume vs rowing volume?",
      "Any shoulder injury history?",
    ],
    solutionSteps: [
      "Screen red flags; refer night pain, trauma, neuro symptoms.",
      "Note forward-chin / rounded-shoulder tendencies without diagnosing a syndrome.",
      "Strengthen mid traps, rhomboids, and lower trap with rows and Y/T-style reaches.",
      "Add pec and anterior shoulder soft-tissue care / stretching as tolerated.",
      "Balance push:pull; often raise pull volume.",
      "Re-test Apley, wall angel, or comfort in 2–4 weeks.",
    ],
    interventions: [
      "Band or cable rows with scapular retraction quality",
      "Prone or standing Y/T reaches light",
      "Pec doorway or bench openers pain-free",
      "Wall slides or wall-angel practice as warm-up",
    ],
    redFlags: [
      "Night pain, trauma, dislocation apprehension",
      "Numbness, tingling, true weakness",
      "Unexplained weight loss with pain",
    ],
    contraindications:
      "Do not force end-range IR/ER or aggressive pec stretch into sharp pain.",
    body: `Desk-dominant clients often show forward-chin and rounded-shoulder tendencies plus limited Apley or wall-angel reach. Coaching themes include strengthening mid traps and rhomboids, improving scapular control with rows and Y/T reaches, and carefully opening tight pecs/anterior tissues. Pattern-based programming—not a medical diagnosis of upper crossed syndrome. Refer shoulder red flags. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-lower-cross-corrective",
    title: "Lower Cross Tendencies: Corrective Coaching",
    category: "corrective",
    triggerPhrases:
      "lower cross,lower crossed,tight hip flexors,weak glutes,anterior pelvic tilt,Thomas test,single leg hip flexion,glute bridge,glute bridge program,reverse lunge core,plank hold",
    tags: "ncsf,lower-cross,corrective,hips,glutes,core,posture,glute-bridge",
    summary:
      "Tight hip flexors with weak glutes/abs tendencies: use bridges, reverse lunges, core control, and progressive warm-ups—not pathology labels.",
    followUpQuestions: [
      "Low-back pain or only stiffness?",
      "Hip flexor tightness with or without pain?",
      "Can they bridge with glute bias without lumbar takeover?",
      "Sitting hours and current hinge/squat quality?",
      "Any radicular symptoms down the leg?",
    ],
    solutionSteps: [
      "Clear red flags (neuro deficit, trauma, progressive night pain).",
      "Use simple hip-flexor length/control observations without overclaiming diagnosis.",
      "Strengthen glutes and anterior core; reduce pure end-range aggressive stretch if control is poor.",
      "Program bridges, reverse lunges, and hinge patterning with neutral-pelvis cues.",
      "Warm up progressively before loaded squats/hinges.",
      "Reassess tolerance and posture-related fatigue after 2–4 weeks.",
    ],
    interventions: [
      "Glute bridge / hip thrust progressions",
      "Reverse lunge with upright torso",
      "Dead-bug and side-plank variations",
      "Hip-flexor half-kneeling stretch after activation",
    ],
    redFlags: [
      "Leg numbness, saddle anesthesia, bowel/bladder change",
      "Acute trauma or inability to bear weight",
      "Fever with back pain",
    ],
    contraindications:
      "Do not force aggressive stretching into pain or treat posture patterns as clinical diagnoses.",
    body: `Lower-chain postural tendencies often mix tight hip flexors with underactive glutes and abdominal support. Use hip-flexor length/control checks and single-leg bridge quality to guide programming—not to diagnose pathology. Emphasize glute bridges, reverse lunges, and core control; warm up before heavy lower-body work. Refer neurological or traumatic red flags. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-special-populations-caution",
    title: "Special Populations: Scope & Clearance",
    category: "safety",
    triggerPhrases:
      "special populations,medical clearance PT,scope of practice,chronic disease client,refer before program,fiduciary competency,high risk client clearance,clinical protocol invent",
    tags: "ncsf,special-populations,safety,scope,clearance,refer",
    summary:
      "Umbrella caution: train special populations only within scope, require medical clearance when indicated, never invent clinical protocols. Prefer dedicated ncsf-* playbooks for specific groups.",
    followUpQuestions: [
      "Which special population category applies (older adult, youth, pregnancy, disease)?",
      "Is written medical clearance or clinician guidance on file when needed?",
      "What did the clinician explicitly allow or restrict?",
      "Symptoms that change day to day?",
      "Who is the referral contact if status worsens?",
    ],
    solutionSteps: [
      "Confirm you are operating inside personal-training scope laws and policies.",
      "Obtain medical clearance when history, age-related risk, pregnancy, or disease warrants it.",
      "Use conservative FITT; progress slower and monitor response.",
      "Open the dedicated playbook for that population when available (older adult, youth, pregnancy, hypertension, diabetes).",
      "Do not invent rehab or clinical treatment protocols—coordinate with licensed providers.",
      "Stop for new or worsening symptoms, document, and refer.",
    ],
    interventions: [
      "Clearance checklist before first hard session",
      "Conservative template: longer warm-up, lower initial intensity",
      "Communication note template for client’s clinician",
      "Emergency action plan posted and known",
    ],
    redFlags: [
      "No clearance when required by policy/history",
      "Acute medical change mid-program",
      "Pressure to apply clinical rehab without credentials",
    ],
    contraindications:
      "Do not deliver medical treatment plans or ignore clinician restrictions.",
    body: `Special populations—including older adults, youth, pregnancy, and clients with disease—need extra caution. Personal trainers coach exercise within scope; they do not replace medical care. Require medical clearance when indicated, follow clinician limits, and progress conservatively. Prefer the dedicated special-population playbooks for programming detail. Never invent clinical protocols or claim to treat disease. When in doubt, refer and delay aggressive training. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-older-adult-training",
    title: "Older Adults: Function, RT & Fall-Risk Focus",
    category: "programming",
    triggerPhrases:
      "older adult training,older adults,senior training,senior fitness,elderly exercise,fall risk training,aging client program,sarcopenia coach,power training older adults,deconditioned senior",
    tags: "ncsf,older-adults,special-populations,programming,fall-risk,resistance,balance",
    summary:
      "Prioritize resistance training to slow functional decline; combine aerobic, strength, balance, power, flexibility, and daily activity—with clearance when indicated.",
    followUpQuestions: [
      "Medical clearance status and any fall history or assistive devices?",
      "Deconditioned vs relatively active—walking and stairs tolerance?",
      "Pain, dizziness, or ROM limits (trunk extension/rotation, shoulder flexion/ER)?",
      "Can they do supervised RT 2–3×/week and short activity bouts on other days?",
      "Who is the clinician contact if new symptoms appear?",
    ],
    solutionSteps: [
      "Confirm clearance when history, frailty, or multiple conditions warrant it; start conservative.",
      "Build a combo program: aerobic + RT + balance + flexibility; emphasize more daily movement.",
      "Deconditioned: accumulate ~30–40 min in ~10-min bouts at moderate intensity most days; progress duration before intensity.",
      "Healthier older adults: progress aerobic intensity and duration as tolerated; keep RPE honest.",
      "RT 2–3×/wk: 8–10 multi-joint/functional closed-chain exercises, ~10–15 reps; add power when form and joints allow.",
      "Avoid Valsalva/breath-holding and prolonged isometrics in frail clients; reassess fall-risk drills each block.",
    ],
    interventions: [
      "Functional RT circuit (sit-to-stand, step-ups, row, press, hip hinge)",
      "Balance progression: stance → reach → dynamic with support nearby",
      "Pain-free flexibility 2–3×/wk focusing common ROM limits",
      "Activity snacks: short walks between meals",
    ],
    redFlags: [
      "New falls, near-falls, or progressive unsteadiness",
      "Chest pain, undue dyspnea, syncope, or new neuro symptoms with activity",
      "Acute joint trauma or pain that blocks basic ADLs",
      "Uncontrolled BP/vitals or clearance pending when indicated",
    ],
    contraindications:
      "Do not force end-range into painful ROM, chase breath-held maxes in frail clients, or train through unresolved medical red flags without clearance.",
    body: `For older adults, resistance training has high leverage to slow functional decline when paired with aerobic work, balance, power (when appropriate), flexibility, and more daily activity. Deconditioned clients often do best accumulating short moderate bouts most days; healthier clients may progress duration and intensity carefully. RT 2–3×/week with functional closed-chain patterns is a solid coach frame—avoid Valsalva and long isometrics in frail clients. Fall-risk mitigation is a priority. Medical clearance when indicated. Coaching is not geriatrics or diagnosis. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-youth-training",
    title: "Youth Training: Skill, Fun & Safe Loading",
    category: "programming",
    triggerPhrases:
      "youth training,adolescent training,kids resistance training,adolescent exercise,teen strength training,pediatric fitness coach,growth plate pain,age appropriate training,child athlete PT",
    tags: "ncsf,youth,special-populations,programming,supervision,technique",
    summary:
      "Age-appropriate activity with skill and fun before max loading; supervised technique over ego loads; refer growth-plate or pain red flags; align with parents/guardians.",
    followUpQuestions: [
      "Chronological age, training age, and sport/activity context?",
      "Parent/guardian goals and any medical or orthopedic history?",
      "Can technique stay clean under bodyweight or light load?",
      "Any joint pain, limp, or growth-related discomfort?",
      "Supervision ratio and who is present during sessions?",
    ],
    solutionSteps: [
      "Align program intent with parents/guardians; keep sessions age-appropriate and enjoyable.",
      "Prioritize motor skill, movement quality, and fun before maximal external loading or specialization.",
      "Use close supervision; teach technique first—never ego-load or copy adult bodybuilding templates.",
      "For beginners, train major muscle groups ~2×/week at moderate effort with progressive skill focus.",
      "Blend aerobic play/conditioning with resistance patterns appropriate to maturity and interest.",
      "Stop and refer for growth-plate concerns, unexplained pain, or red-flag symptoms.",
    ],
    interventions: [
      "Play-based warm-ups and skill games that teach patterns",
      "Bodyweight → light external load progressions with form checklists",
      "Full-body sessions 2×/wk emphasizing major muscle groups",
      "Parent/guardian brief on load rules, rest, and when to stop",
    ],
    redFlags: [
      "Localized bone/joint pain, limp, or suspected growth-plate issues",
      "Pressure to specialize early or chase adult max lifts",
      "Chest pain, fainting, severe dyspnea, or unexplained systemic symptoms",
      "Unsafe supervision or refusal to follow stop rules",
    ],
    contraindications:
      "Do not apply adult hypertrophy specialization, unsupervised heavy loading, or train through growth-related pain without clinical evaluation.",
    body: `Youth programming should be age-appropriate: skill and enjoyment before maximal loading, with competent supervision and technique over ego loads. Beginners benefit from major-muscle-group work about twice weekly at moderate effort, plus aerobic activity matched to interest—not adult bodybuilding specialization. Align with parents/guardians on goals and stop rules. Growth-plate pain, limp, or unexplained joint pain is a refer-out. Coaches support safe activity habits; they do not diagnose pediatric conditions. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-pregnancy-exercise",
    title: "Pregnancy Exercise: Clearance, Moderate Load & Stop Rules",
    category: "safety",
    triggerPhrases:
      "pregnancy exercise,prenatal exercise,prenatal training,pregnant client workout,exercise while pregnant,supine after mid pregnancy,gestational fitness coach,pregnancy clearance",
    tags: "ncsf,pregnancy,prenatal,special-populations,safety,clearance",
    summary:
      "Moderate exercise when clinician-cleared may support fitness and comfort themes—absolute stop signs require stop/refer; coach does not manage high-risk obstetrics.",
    followUpQuestions: [
      "Written clinician clearance and any activity restrictions on file?",
      "Trimester, prior activity level, and current symptoms day to day?",
      "Any high-risk obstetric designation or multi-gestation factors?",
      "Comfort with non-contact modes and heat/hydration plan?",
      "Who to contact if absolute warning signs appear during/after a session?",
    ],
    solutionSteps: [
      "Require clinician clearance before structured training; follow all written restrictions.",
      "Prefer moderate RPE and non-contact modes; progress conservatively from pre-pregnancy fitness.",
      "Avoid prolonged supine positions after mid-pregnancy if symptomatic; use side-lying, incline, or seated alternatives.",
      "Prevent overheating and dehydration; keep sessions ventilated and fluid-aware.",
      "Stop immediately for absolute warning signs and refer—do not troubleshoot obstetric emergencies as a coach.",
      "Document clearance, session response, and any symptom changes.",
    ],
    interventions: [
      "Moderate aerobic + light-to-moderate RT with posture-friendly options",
      "Incline/side-lying/seated variations instead of prolonged supine work",
      "RPE-guided sessions with cool-down and hydration checks",
      "Written stop-sign card (bleeding, leak, contractions, etc.)",
    ],
    redFlags: [
      "Vaginal bleeding, amniotic fluid leak, or regular contractions",
      "Dizziness, chest pain, calf pain/swelling, severe headache, or decreased fetal movement",
      "High-risk obstetric status without clear clinician exercise guidance",
      "Overheating, dehydration, or pressure to train through warning signs",
    ],
    contraindications:
      "Do not coach high-risk obstetric conditions, ignore clinician restrictions, or continue after absolute stop signs.",
    body: `When a clinician clears moderate exercise in pregnancy, coaching themes may include cardiorespiratory fitness, comfort (including low-back), posture, and sensible activity—without promising medical outcomes. Prefer non-contact work, moderate RPE, and heat/hydration control; avoid prolonged supine positions after mid-pregnancy if symptomatic. Absolute signs—bleeding, fluid leak, contractions, dizziness, chest pain, calf pain/swelling, decreased fetal movement, severe headache—mean stop and refer. The coach never manages high-risk obstetrics. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-hypertension-training",
    title: "Hypertension: Moderate Aerobic Priority & Safe RT",
    category: "safety",
    triggerPhrases:
      "hypertension exercise,high blood pressure training,hypertension training,elevated BP client,post-exercise hypotension,PEH,BP and resistance training,hypertensive aerobic program,blood pressure training",
    tags: "ncsf,hypertension,blood-pressure,special-populations,safety,aerobic,crf",
    summary:
      "Moderate dynamic aerobic preferred; RT careful without heavy Valsalva/isometrics; coach BP for awareness only—not diagnosis; refer uncontrolled BP or symptoms.",
    followUpQuestions: [
      "Known BP history, meds (timing), and any clinician exercise limits?",
      "Resting readings for awareness today—within client’s usual pattern?",
      "Symptoms: headache, chest pain, vision change, undue dyspnea?",
      "Preferred aerobic modes and ability to accumulate 10-min bouts?",
      "Clearance status for higher-risk or previously uncontrolled BP?",
    ],
    solutionSteps: [
      "Treat coach BP checks as awareness only—not diagnosis or med titration; refer clinical decisions.",
      "Prefer moderate dynamic aerobic: RPE ~12–14, 30–60 min, 3–5×/wk or accumulated ~10-min bouts.",
      "Emphasize CRF progression; note post-exercise hypotension (PEH)—cool down and stand carefully.",
      "Include RT carefully: controlled breathing, avoid heavy Valsalva and prolonged hard isometrics.",
      "No hard training with uncontrolled high BP or exertional red-flag symptoms—stop and refer.",
      "Obtain clearance for higher-risk clients before intensity spikes; document responses.",
    ],
    interventions: [
      "Zone-moderate aerobic base (walk/bike/row) with talk-test/RPE anchors",
      "Accumulated 10-min activity snacks on busy days",
      "RT with lighter loads, higher control, no breath-holding max efforts",
      "Extended cool-down and seated rest if lightheaded post-session",
    ],
    redFlags: [
      "Uncontrolled or markedly elevated resting BP per client/clinician thresholds",
      "Chest pain, syncope, severe headache, neuro symptoms, or acute distress",
      "Pressure to max-test or heavy isometric/Valsalva work against advice",
      "Missing clearance when risk history warrants it",
    ],
    contraindications:
      "Do not diagnose hypertension, prescribe or adjust meds, or push vigorous/heavy breath-held training when BP is uncontrolled or symptoms are present.",
    body: `Elevated BP raises long-term risk; coaches may measure BP for awareness only and never diagnose or manage medications. Prefer moderate dynamic aerobic work (RPE about 12–14, 30–60 minutes, 3–5 days/week or shorter accumulated bouts), with CRF as a centerpiece. Post-exercise hypotension can occur—use sensible cool-downs. Resistance training can be included carefully without heavy Valsalva or prolonged hard isometrics. Uncontrolled high BP or red-flag symptoms mean no hard training and prompt referral. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-diabetes-exercise-caution",
    title: "Diabetes Exercise Caution: Type 1 vs Type 2 Themes",
    category: "safety",
    triggerPhrases:
      "diabetes exercise,hypoglycemia,Type 1 diabetes training,Type 2 diabetes workout,glucose monitor workout,insulin and exercise coach,circuit training diabetes,blood sugar workout",
    tags: "ncsf,diabetes,special-populations,safety,glucose,type1,type2",
    summary:
      "Type 1 vs Type 2 coaching themes: glucose awareness, hypoglycemia signs, carbs available; Type 1 insulin timing is clinician-directed; Type 2 multi-risk circuits when cleared—never invent insulin protocols.",
    followUpQuestions: [
      "Type 1, Type 2, or other—and clinician exercise guidance on file?",
      "How does the client monitor glucose and what is their stop rule?",
      "Recent hypo episodes, meds/insulin timing relative to sessions (client-managed)?",
      "Other risks (neuropathy, CV disease, foot issues, clinician-flagged retinopathy)?",
      "Carbs/fuel available on-site and emergency contacts?",
    ],
    solutionSteps: [
      "Require medical clearance when indicated; follow clinician limits—never invent insulin or medication protocols.",
      "Encourage client-led glucose monitoring as their care team advises; keep rapid carbs available.",
      "Type 1 education frame only: clients coordinate insulin timing and sites per their clinician—coach does not order doses.",
      "Stop for hypoglycemia signs (shakiness, confusion, sweating, unusual fatigue); follow client plan and refer emergencies.",
      "Type 2 often multi-risk—progress aerobic + circuit-style RT carefully when cleared.",
      "Document session timing, symptoms, and any hypo events reported; escalate new medical issues.",
    ],
    interventions: [
      "Pre-session readiness check: symptoms, fuel on hand, client glucose plan",
      "Moderate aerobic + circuit RT templates with conservative progression",
      "Hypoglycemia action card (client-provided steps + emergency numbers)",
      "Avoid extreme novelty on poorly controlled or symptomatic days",
    ],
    redFlags: [
      "Hypoglycemia signs or inability to follow their glucose plan",
      "Chest pain, severe dyspnea, confusion, loss of consciousness",
      "Foot wounds, acute infection, or clinician-restricted activity ignored",
      "Requests for coach-designed insulin dosing or medical meal prescriptions",
    ],
    contraindications:
      "Do not prescribe insulin, carbs-as-medicine dosing, or clinical diabetes treatment plans; stop hard training when glucose or symptoms are unsafe per client/clinician rules.",
    body: `Diabetes coaching is safety-first and never a substitute for endocrinology. Type 1 themes: client-managed glucose monitoring, hypoglycemia awareness, rapid carbs on hand, and insulin timing/sites directed by their clinician—not coach orders. Type 2 often includes multi-risk metabolic and CV factors where moderate aerobic work plus careful circuit-style RT can support fitness when cleared. Always prioritize clearance, stop rules, and referral over inventing clinical insulin protocols. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-protein-training-support",
    title: "Protein & Training Support (Coach Nutrition)",
    category: "nutrition",
    triggerPhrases:
      "protein around training,protein distribution,food first supplements second,sport nutrition coach,post workout protein,nutrition for resistance training,protein recovery",
    tags: "ncsf,nutrition,protein,recovery,coaching",
    summary:
      "General sport-nutrition coaching: distribute protein across the day and around training; food first, supplements secondary—not medical meal plans.",
    followUpQuestions: [
      "Rough daily protein pattern (meals vs one large dinner)?",
      "Training time of day and what they eat near sessions?",
      "Food access, budget, and preferences?",
      "Any clinician-prescribed diet or allergy?",
      "Goal: recovery, muscle, fat loss, or general health?",
    ],
    solutionSteps: [
      "Stay in coaching scope: habits and education, not medical nutrition therapy.",
      "Encourage protein distributed across meals rather than one bolus only.",
      "Link a protein-containing meal or snack near training when appetite allows.",
      "Food first; discuss supplements only as optional add-ons if diet gaps remain.",
      "Avoid rigid meal plans or disease-diet prescriptions unless RD/MD directed.",
      "Refer disordered eating or clinical diet needs to qualified professionals.",
    ],
    interventions: [
      "Plate-building prompts: protein at each meal",
      "Simple pre/post training food examples the client chooses",
      "Supplement decision tree: food gap → optional product",
      "Hydration and total energy reminder alongside protein",
    ],
    redFlags: [
      "Disordered eating or purging behaviors",
      "Kidney disease or clinician protein restrictions (self-reported)",
      "Supplements that interact with meds—send to pharmacist/clinician",
    ],
    contraindications:
      "Do not prescribe medical meal plans or disease-specific nutrition therapy.",
    body: `Coaches can support training with general nutrition themes: include protein regularly across the day, place some protein near training when practical, and prefer whole-food patterns before supplements. This is education for performance and recovery—not a prescription meal plan or medical therapy. Clinical conditions and disordered eating require referral. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-weight-management-coaching",
    title: "Weight Management Coaching (Behavior & Energy Balance)",
    category: "nutrition",
    triggerPhrases:
      "weight management,fat loss coaching,energy balance,weight loss coaching,fat loss program,calorie deficit client,moral licensing exercise,yo-yo dieting,weight management PT,sustainable deficit",
    tags: "ncsf,nutrition,weight-management,coaching,energy-balance,behavior",
    summary:
      "Multifactorial behavior coaching plus sustainable energy balance; protect lean mass with resistance and protein education—no medical meal plans or VLCDs.",
    followUpQuestions: [
      "What does success look like beyond the scale (energy, clothes, strength)?",
      "Any history of yo-yo dieting, extreme restriction, or disordered eating?",
      "Social, work, sleep, and stress patterns that shape food choices?",
      "Reward-after-workout habits (moral licensing) vs positive spillover into better food choices?",
      "Consent for food logs/recalls, and any clinician-prescribed diet or VLCD?",
    ],
    solutionSteps: [
      "Frame weight change as multifactorial—not only “eat less.”",
      "Teach energy balance while warning that severe restriction risks lean-mass loss and rebound.",
      "Build sustainable deficit education; never prescribe medical VLCDs.",
      "Pair resistance training and protein-distribution education to help protect lean mass.",
      "Address traps: moral licensing, social events, portions, emotion eating, sleep debt.",
      "Use food logs only with consent; refer disordered eating, extreme restriction, or body-image crises.",
    ],
    interventions: [
      "Written strategy: deficit philosophy, protein/resistance habits, social-event plans",
      "Moral-licensing vs positive-spillover check-in after hard sessions",
      "Sleep and stress prompts linked to hunger patterns",
      "Optional consented food log debrief (habits, not calorie policing)",
    ],
    redFlags: [
      "Disordered eating, purging, or compulsive restriction",
      "Extreme calorie cuts, crash diets, or unsupervised VLCD-style protocols",
      "Body dysmorphia or distress beyond coaching scope",
      "Clinician-directed VLCD or medical nutrition therapy—coordinate/refer",
    ],
    contraindications:
      "Do not create medical meal plans, treat eating disorders, or run very-low-calorie diets outside licensed clinical care.",
    body: `Weight management is multifactorial: social, economic, physiological, psychological, and emotional barriers matter as much as calories. Energy balance still frames fat loss, but severe restriction can cost lean mass and set up rebound—VLCDs are medical-only. Watch for moral licensing after workouts versus positive spillover into better habits. Plan for social events, portions, emotion eating, and sleep debt. Coaches co-create strategies, pair resistance + protein education, and educate on sustainable deficits—not medical meal plans. Refer disordered eating and clinical diet needs. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-resistance-progression",
    title: "Resistance Training Progression Basics",
    category: "programming",
    triggerPhrases:
      "progressive overload,compound lifts first,rest intervals strength,technique before load,anaerobic resistance programming,how to progress weights,resistance progression",
    tags: "ncsf,resistance,programming,progression,overload,strength",
    summary:
      "Anaerobic resistance basics: progressive overload, compounds before isolation, rest matched to goal, technique before load.",
    followUpQuestions: [
      "Primary resistance goal (strength, hypertrophy, endurance, general fitness)?",
      "Which lifts stall—skill issue or true load issue?",
      "Current rest times and set quality on later sets?",
      "Any joints that limit certain compounds?",
      "How many hard sets per pattern per week?",
    ],
    solutionSteps: [
      "Define the goal so intensity, reps, and rest align.",
      "Place multi-joint compounds earlier while fresh.",
      "Progress overload via load, reps, sets, tempo, or density—one main lever at a time.",
      "Hold or reduce load when technique breaks; skill before ego load.",
      "Use longer rest for higher-strength efforts; shorter rest for endurance-style work.",
      "Review logs every 1–2 weeks and adjust volume if recovery fails.",
    ],
    interventions: [
      "Double progression (reps then load) on key lifts",
      "Exercise order template: compound → accessory",
      "Rest timer norms by goal",
      "Technique checklist on film for sticky lifts",
    ],
    redFlags: [
      "Sharp joint pain with progressive loading",
      "Dizziness or chest symptoms under strain",
      "Form collapse ignored to chase load",
    ],
    body: `Resistance training progresses through planned overload while technique stays honest. Do compound patterns first when fresh, then accessories. Match rest to the goal: longer for heavy strength, shorter for muscular endurance styles. Add load or volume only when reps and positions are controlled. Coach by quality and progression rules, not by copying someone else’s maxes. ${NCSF_DISCLAIMER}`,
  },
  {
    slug: "ncsf-cardio-programming-basics",
    title: "Cardio Programming Basics (CRF & Contact Time)",
    category: "programming",
    triggerPhrases:
      "cardio programming,CRF progression,heart rate training zone,HRTZ,combine cardio and weights,limited session time cardio,aerobic base PT,fitt cardio",
    tags: "ncsf,cardio,crf,hrtz,programming,conditioning,fitt",
    summary:
      "Progress cardiorespiratory fitness gradually; use heart-rate zone ideas at a high level; blend conditioning with resistance when contact time is limited.",
    followUpQuestions: [
      "Current aerobic base and any CV history/clearance?",
      "Preferred modes (walk, bike, row, field)?",
      "Session minutes available for conditioning?",
      "Resistance priority this mesocycle vs conditioning priority?",
      "How will you track intensity (RPE, talk test, HR)?",
    ],
    solutionSteps: [
      "Clear red flags and clearance needs before intense intervals.",
      "Build duration and frequency before high-intensity spikes for deconditioned clients.",
      "Use HRTZ or RPE/talk-test bands at a high level—teach zones without overprecision theater.",
      "In short PT sessions, pair condensed resistance with efficient conditioning finishers or alternate focuses by day.",
      "Progress one CRF variable at a time (time, intensity, or density).",
      "Reassess how conditioning affects recovery for lifts.",
    ],
    interventions: [
      "Zone 2-style conversational blocks for base",
      "Short intervals only after base and tolerance",
      "Finisher row/bike 5–10 min in hybrid sessions",
      "Step-count or easy-day homework for low contact time",
    ],
    redFlags: [
      "Chest pain, undue dyspnea, syncope with exertion",
      "Uncontrolled resting vitals",
      "Medical restriction against vigorous exercise",
    ],
    contraindications:
      "Do not prescribe high-intensity intervals when clearance, vitals, or symptoms are unsafe.",
    body: `Cardiorespiratory programming should progress gradually. Heart-rate training zones are a useful high-level intensity map alongside RPE and the talk test—coaches need not overclaim lab precision. When contact time is short, combine resistance skill work with efficient conditioning or split priorities across the week. Advance time or intensity carefully and refer exertional red flags. ${NCSF_DISCLAIMER}`,
  },
];
