/**
 * Core coach playbooks (movement screens, pain frames, programming process).
 * Paired with NCSF_PLAYBOOKS in seed. Coaching support only — not medical diagnosis.
 */

import type { PlaybookDef } from "./ncsf-playbooks-data";

export type { PlaybookDef };

export const CORE_PLAYBOOKS: PlaybookDef[] = [
  // ── Screens & asymmetry ──────────────────────────────────────────
  {
    slug: "back-scratch-asymmetry",
    title: "Back Scratch Test Failure (Unilateral)",
    category: "assessment",
    triggerPhrases:
      "back scratch,apley,fails back scratch,shoulder reach behind back,one side shoulder mobility,unilateral shoulder IR ER,back scratch asymmetry",
    tags: "shoulder,mobility,back-scratch,apley,assessment",
    summary:
      "Unilateral back-scratch / Apley failure: clarify side and pain, rule out red flags, then mobility + scapular control.",
    followUpQuestions: [
      "Which side fails (left, right, or both)?",
      "Pain or only restriction/stiffness?",
      "Shoulder injury, dislocation, or surgery history?",
      "Recent pressing, throwing, or overhead volume?",
      "Primary goal (pain-free training, overhead performance, general mobility)?",
    ],
    solutionSteps: [
      "Confirm laterality and pain vs stiffness only.",
      "Screen red flags; refer if night pain, trauma, neuro signs, or instability.",
      "Brief IR/ER and thoracic extension check.",
      "Dose pain-free mobility + scapular control 3–4×/week.",
      "Bias pull volume; progress overhead carefully.",
      "Re-test in 2–4 weeks on the client record.",
    ],
    interventions: [
      "Thoracic extension over foam roller",
      "Lat / pec openers as indicated",
      "Wall slides / scapular upward rotation",
      "Prone Y/T light volume + rows ≥ push",
    ],
    redFlags: [
      "Night pain or pain at rest",
      "Recent trauma",
      "Numbness, tingling, true weakness",
      "Recurrent dislocation / apprehension",
    ],
    contraindications:
      "Do not force end-range IR/ER under load when painful or unstable.",
    body: `Back scratch / Apley screens shoulder IR/ER and scapular mobility. Unilateral failure is common and is not a diagnosis. Likely contributors include limited IR/ER, lat/posterior stiffness, T-spine extension limits, scapular control gaps, and pressing bias. Treat stiffness with capacity work; treat red flags with referral. Re-test after a focused block, not daily.`,
  },
  {
    slug: "shoulder-pain-red-flags",
    title: "Shoulder Pain Red Flags",
    category: "assessment",
    triggerPhrases:
      "shoulder pain,night pain shoulder,shoulder instability,numb arm,shoulder trauma,can't raise arm,red flag shoulder",
    tags: "shoulder,red-flag,refer,safety",
    summary:
      "When shoulder presentations need medical referral before training progressions.",
    followUpQuestions: [
      "Pain at rest or night pain?",
      "Trauma, dislocation, or neuro symptoms?",
      "True weakness or inability to raise the arm?",
      "Fever, unexplained weight loss, or systemic illness?",
      "Onset sudden vs gradual after volume spike?",
    ],
    solutionSteps: [
      "Stop aggravating loading immediately.",
      "Document symptoms, onset, and what provokes.",
      "If red flags present, refer to a qualified clinician before progressing.",
      "If cleared mechanical irritation, use relative rest + graded return (see return-to-OHP / pain traffic light).",
      "Log on the client record and re-check next session.",
    ],
    interventions: [
      "Relative rest from painful ranges",
      "Referral pathway and urgency language for the client",
      "Pain note on session and client record",
      "Keep non-provoking lower-body or opposite-side work if appropriate",
    ],
    redFlags: [
      "Night pain or constant rest pain",
      "Trauma / dislocation",
      "Neurological deficit",
      "Instability with apprehension",
      "Inability to actively raise the arm",
    ],
    contraindications:
      "Do not push through red-flag shoulder presentations or invent clinical diagnoses.",
    body: `Red-flag shoulder presentations require medical clearance before aggressive training. Night pain, trauma, true weakness, neuro symptoms, and instability apprehension are stop signs for progression. Coaches document and refer; they do not diagnose pathology. Once cleared, return with graded exposure and high pull volume.`,
  },
  {
    slug: "ohs-heels-rise",
    title: "Overhead Squat — Heels Rise",
    category: "assessment",
    triggerPhrases:
      "heels rise,heels rise squat,overhead squat heels,ankle dorsiflexion squat,can't squat deep heels,heel lift squat",
    tags: "squat,ankle,mobility,ohs,heels",
    summary:
      "Heels rising in OHS/squat often points to limited ankle DF or strategy issues; check pain and compensate carefully.",
    followUpQuestions: [
      "Heels rise on both sides or one side more?",
      "Any ankle/foot pain or history of sprain?",
      "Does elevating heels (plates) clean up the squat?",
      "Knee valgus or trunk fall forward also present?",
      "Barefoot vs shoes — any difference?",
    ],
    solutionSteps: [
      "Rule out ankle pain and weight-bearing red flags.",
      "Wall ankle DF test both sides; log cm.",
      "If pain-free, dose DF mobility and temporary heel elevation for quality loading.",
      "Coach mid-foot pressure and knee tracking.",
      "Re-test OHS / ankle DF in 2–3 weeks.",
    ],
    interventions: [
      "Knee-to-wall ankle DF holds",
      "Goblet squat to a box with slight heel elevation (temporary)",
      "Soleus-biased calf work if indicated",
      "Slow tempo goblet squats, knees over mid-foot",
    ],
    redFlags: [
      "Acute ankle trauma",
      "Unable to bear weight",
      "Numbness in foot",
      "Calf swelling / DVT concern",
    ],
    contraindications:
      "Do not force deep squat through acute ankle pain or swelling.",
    body: `Heels rising during squat/OHS is a strategy, not a diagnosis. Common drivers: limited ankle dorsiflexion, fear, motor pattern, footwear. If plates under the heels clean the pattern, DF is a likely limiter. Train DF capacity and still progress squat variations that allow quality loading.`,
  },
  {
    slug: "ohs-knee-valgus",
    title: "Overhead Squat — Knee Valgus",
    category: "assessment",
    triggerPhrases:
      "knee valgus,knees cave in,squat knees collapse,knock knees squat,valgus under load",
    tags: "squat,knee,valgus,glute,control",
    summary:
      "Knee valgus under squat: check pain, then hip/foot control and load management.",
    followUpQuestions: [
      "Pain at the knee or only a visual collapse?",
      "Worse under fatigue or heavy load?",
      "History of ACL, meniscus, or patellofemoral issues?",
      "Foot pronation / shoe collapse also visible?",
      "Single-leg stance or step-down quality?",
    ],
    solutionSteps: [
      "Clear red-flag knee pain (locking, giving way, acute swelling).",
      "Regress load and range until knees track over mid-foot.",
      "Add lateral hip strength and closed-chain control drills.",
      "Cue “spread the floor” / knee over 2nd toe.",
      "Progress load only when control holds under fatigue.",
    ],
    interventions: [
      "Banded side-lying clam / short-lever side plank",
      "Goblet squat with light band above knees (feedback, not forever)",
      "Step-downs and split squats with knee-tracking focus",
      "Single-leg stance control",
    ],
    redFlags: [
      "True locking/catching",
      "Acute swelling after injury",
      "Giving way",
      "Inability to weight bear",
    ],
    body: `Valgus may be mobility, strength, skill, or fatigue-related. Do not treat “stretch the IT band” as the primary fix. Prioritize pain-free control and progressive loading of squat, hinge, and unilateral patterns.`,
  },
  {
    slug: "ohs-arms-fall",
    title: "Overhead Squat — Arms Fall Forward",
    category: "assessment",
    triggerPhrases:
      "arms fall forward,arms fall forward squat,overhead squat arms,can't keep arms up squat,t-spine overhead,wall angel fail",
    tags: "squat,shoulder,tspine,overhead,ohs",
    summary:
      "Arms falling in OHS: T-spine, lats, shoulder flexion, or core strategy — clarify pain first.",
    followUpQuestions: [
      "Shoulder or neck pain when arms go overhead?",
      "Do wall slides or thoracic extension feel limited?",
      "Is back scratch or shoulder IR/ER also limited?",
      "Goal includes overhead pressing?",
      "Press:pull weekly balance?",
    ],
    solutionSteps: [
      "Clear shoulder/neck red flags.",
      "Separate T-spine extension vs shoulder flexion limitations.",
      "Dose thoracic extension + lat openness + scapular upward rotation.",
      "Use landmine / neutral-grip press progressions before aggressive OHP.",
      "Re-test OHS arms position in 2–4 weeks.",
    ],
    interventions: [
      "Foam roller thoracic extension",
      "Open book rotations",
      "Wall slides / wall angels",
      "Lat openers + landmine press",
    ],
    redFlags: [
      "Cervical radicular symptoms",
      "Shoulder night pain",
      "Trauma",
      "Dizziness with arm elevation",
    ],
    body: `Arms falling forward in OHS often coexists with limited T-spine extension and lat stiffness. Train the capacity (mobility + scapular control), raise pull volume, then load overhead patterns progressively. Pair with wall-angel and back-scratch screens when useful.`,
  },
  {
    slug: "retest-screens-cadence",
    title: "When to Re-test Movement Screens",
    category: "assessment",
    triggerPhrases:
      "re-test,retest,reassess,when to retest,baseline screen,progress screen,back scratch again,screen cadence",
    tags: "assessment,retest,progress,baseline",
    summary:
      "Re-test key screens every 2–6 weeks or after a focused block; compare to baseline, not only last week.",
    followUpQuestions: [
      "Which screen is most relevant to the client’s goal?",
      "How long has the corrective block been consistent?",
      "Pain-free on re-test?",
      "Did adherence actually happen between tests?",
      "What will change in the program if the screen improves or stalls?",
    ],
    solutionSteps: [
      "Pick 1–3 priority screens tied to the program.",
      "Run the same protocol as baseline.",
      "Log results on the assessments page.",
      "Use progress trends (improved / mixed / declined).",
      "Adjust program only after clear data or stalled adherence.",
    ],
    interventions: [
      "Back scratch re-test",
      "Ankle DF wall test",
      "OHS snapshot",
      "Plank / single-leg bridge / wall angel as relevant",
    ],
    redFlags: ["New trauma since last screen", "Worsening neuro symptoms"],
    body: `Screens are coaching tools. Re-test when the intervention has had time—not daily. Keep the first clean test as baseline. Link retests to program blocks so progress talks to programming, not vanity measurement.`,
  },

  // ── Posture & patterns ───────────────────────────────────────────
  {
    slug: "anterior-pelvic-tilt-coaching",
    title: "Anterior Pelvic Tilt — Coaching Frame",
    category: "corrective",
    triggerPhrases:
      "anterior pelvic tilt,APT,sway back,butt sticks out,lower cross,lordosis coaching",
    tags: "posture,pelvis,core,hip-flexor,lower-cross",
    summary:
      "APT is common and not automatically pathological. Focus on symptoms, control, and training balance.",
    followUpQuestions: [
      "Any low back pain with standing/extension?",
      "Do they live in high hip-flexor demand (sitting all day)?",
      "Can they find neutral pelvis in dead bug / hinge?",
      "Primary goal aesthetic vs pain vs performance?",
      "Single-leg glute bridge quality side to side?",
    ],
    solutionSteps: [
      "Don’t over-medicalize static posture alone.",
      "If symptomatic, bias posterior chain + deep core control and hip-flexor length if limited.",
      "Teach neutral bracing for lifts.",
      "Balance sitting volume with movement snacks.",
      "Re-check hinge, bridge, and symptom tolerance in 2–4 weeks.",
    ],
    interventions: [
      "Dead bug / heel taps with ribs down",
      "Glute bridge / hip thrust variations",
      "Reverse lunges with upright torso",
      "Hip flexor openers if extension is limited and pain-free",
    ],
    redFlags: [
      "Night pain in spine",
      "Saddle anesthesia",
      "Progressive neurological deficit",
      "Unexplained weight loss",
    ],
    body: `Static APT is highly variable. Coach movement quality and capacity rather than chasing a “perfect” resting posture. Pair with lower-cross NCSF language when useful, but stay symptom- and task-focused.`,
  },
  {
    slug: "forward-head-rounded-shoulders",
    title: "Forward Head / Rounded Shoulders",
    category: "corrective",
    triggerPhrases:
      "forward head,rounded shoulders,tech neck,upper cross,desk posture,chin poke",
    tags: "posture,neck,shoulder,scapula,upper-cross",
    summary:
      "Desk-related upper posture: mobility + scapular endurance + work breaks; rule out neuro neck pain.",
    followUpQuestions: [
      "Neck pain, headaches, or arm symptoms?",
      "Daily sitting / screen hours?",
      "Does pulling volume lag pressing?",
      "Wall angel or back-scratch status?",
      "Worse at end of workday or during lifting?",
    ],
    solutionSteps: [
      "Clear neuro red flags for neck.",
      "Add thoracic extension and gentle chin-nod control.",
      "Raise horizontal/vertical pull frequency (≥1:1 push:pull).",
      "Micro-breaks and workstation cues.",
      "Reassess seated and standing posture after 2–4 weeks of consistency.",
    ],
    interventions: [
      "Chin tucks (gentle)",
      "Band pull-aparts / face pulls",
      "Thoracic extension + rows",
      "Seated posture re-check mid-session",
    ],
    redFlags: [
      "Arm numbness/weakness",
      "Drop attacks",
      "Severe night pain",
      "Trauma",
    ],
    body: `Upper crossed patterns respond better to capacity and habits than endless stretching alone. Raise pull volume, train scapular endurance, and change desk behavior. Refer neuro or trauma presentations.`,
  },
  {
    slug: "ankle-df-limited",
    title: "Limited Ankle Dorsiflexion",
    category: "corrective",
    triggerPhrases:
      "limited ankle dorsiflexion,ankle mobility,wall test ankle,tight calves squat,ankle df,dorsiflexion",
    tags: "ankle,mobility,squat,calf",
    summary:
      "Limited DF impacts squat depth and landing mechanics. Train DF and use temporary regressions.",
    followUpQuestions: [
      "Wall test cm left vs right?",
      "Prior ankle sprains?",
      "Pain or only stiffness?",
      "Heels rise in squat/OHS?",
      "Footwear or orthotics in play?",
    ],
    solutionSteps: [
      "Measure and log wall DF both sides.",
      "If pain-free: daily short DF exposures + squat variations that allow quality.",
      "Temporary heel elevation for loading while DF improves.",
      "Address footwear if relevant.",
      "Re-test weekly for 3–4 weeks.",
    ],
    interventions: [
      "Knee-to-wall DF holds",
      "Elevated-heel goblet squat as bridge",
      "Soleus-biased calf work",
      "Slow eccentric squats",
    ],
    redFlags: [
      "Acute sprain",
      "Unable to hop/walk",
      "Calf swelling/DVT concern",
      "Pinching pain that worsens with every DF attempt",
    ],
    body: `Ankle DF is a trainable capacity for many clients. Pair mobility with loaded patterns that reinforce new range. Log cm so progress is visible; don’t only “feel” looser.`,
  },
  {
    slug: "hip-hinge-poor",
    title: "Poor Hip Hinge Pattern",
    category: "corrective",
    triggerPhrases:
      "can't hinge,poor deadlift form,lumbar flexion deadlift,hinge becomes squat,hip hinge,rdl form",
    tags: "hinge,deadlift,technique,posterior",
    summary: "Teach hinge before loading heavy; regress implement and ROM.",
    followUpQuestions: [
      "Low back pain with hinging?",
      "Is the issue skill, mobility, or fear?",
      "Can they hip-hinge to a high target pain-free?",
      "Hamstring stiffness or simply motor pattern?",
      "Current deadlift or RDL loads?",
    ],
    solutionSteps: [
      "Clear back red flags.",
      "Dowel hinge or wall-tap hinge drills.",
      "Load with KB/DB RDL before barbell if needed.",
      "Progress depth/load only with neutral strategy.",
      "Film a set and coach one cue at a time.",
    ],
    interventions: [
      "Dowel hip hinge",
      "DB RDL / trap-bar DL as friendlier load",
      "Hip thrust for glute capacity",
      "Hip-hinge screen re-test",
    ],
    redFlags: [
      "Saddle anesthesia",
      "Progressive leg weakness",
      "Night spinal pain",
      "Trauma",
    ],
    body: `Hinge quality underpins deadlift and athletic positions. Skill and capacity beat cue spam under heavy load. Regress the implement until the pattern is honest, then build load.`,
  },
  {
    slug: "core-bracing-basics",
    title: "Core Bracing for Lifts",
    category: "corrective",
    triggerPhrases:
      "how to brace core,core brace squat,valsalva,ribs flare lift,weak core lifting,360 brace,form cue brace",
    tags: "core,bracing,technique,strength,form-cue",
    summary:
      "Teach 360° brace for loaded lifts; separate abs aesthetics work from bracing skill.",
    followUpQuestions: [
      "Do they hold breath or leak air at the bottom of lifts?",
      "Low back fatigue or pain on heavy sets?",
      "Experience level with heavy compounds?",
      "Belt use — skill or crutch?",
      "Can they brace on a dead bug before a squat?",
    ],
    solutionSteps: [
      "Teach inhale → expand belt 360° → gentle brace → move.",
      "Practice on goblet squat / RDL light.",
      "Add dedicated anti-extension/rotation capacity.",
      "Escalate Valsalva only with appropriate clients and BP awareness.",
      "Revisit brace when form collapses under fatigue.",
    ],
    interventions: [
      "Dead bug with brace",
      "Front plank short quality sets",
      "Farmer carries",
      "Goblet squat brace practice",
    ],
    redFlags: [
      "Acute disc-like radicular symptoms",
      "Uncontrolled hypertension with hard Valsalva — medical guidance",
      "Dizziness or chest symptoms under strain",
    ],
    contraindications:
      "Do not coach maximal breath-hold straining for clients with uncontrolled BP or clear medical limits.",
    body: `Bracing is a skill. Pair teaching with submaximal compounds and carries. Separate six-pack work from lift-ready 360° pressure. Hard Valsalva is not universal—match intensity to the client and clearance.`,
  },
  {
    slug: "push-pull-imbalance",
    title: "Pressing Bias / Push-Pull Imbalance",
    category: "programming",
    triggerPhrases:
      "too much bench,shoulder rounded from bench,push pull ratio,need more rows,pressing bias,pull volume",
    tags: "programming,shoulder,posture,pull",
    summary:
      "When press volume dominates, restore pull volume and scapular health work.",
    followUpQuestions: [
      "Weekly sets of push vs pull?",
      "Shoulder discomfort on bench or OHP?",
      "Desk job posture demands?",
      "Face-pull / rear-delt volume present?",
      "Failed wall angel or back scratch?",
    ],
    solutionSteps: [
      "Count weekly pressing vs pulling sets.",
      "Target ≥1:1 horizontal pull:push; often 1.5:1 if symptomatic/desk-bound.",
      "Add face pulls / Y-T for scapular endurance.",
      "Trim isolation press volume if irritated.",
      "Reassess comfort and posture after 2–3 weeks.",
    ],
    interventions: [
      "Rows (DB, cable, band)",
      "Face pulls / pull-aparts",
      "Reduce pure isolation press volume temporarily",
      "Wall slides as warm-up",
    ],
    redFlags: [
      "Shoulder night pain, trauma, or neuro symptoms — use red-flag playbook",
    ],
    body: `Structural balance is programming math plus scapular capacity—not only stretching pecs. Raise pull volume deliberately and track weekly set counts so “more rows” is measurable.`,
  },

  // ── Pain / refer ─────────────────────────────────────────────────
  {
    slug: "low-back-pain-red-flags",
    title: "Low Back Pain Red Flags",
    category: "assessment",
    triggerPhrases:
      "low back pain,lumbar pain,sciatica,back pain night,cauda equina,red flag back",
    tags: "back,red-flag,refer,spine,safety",
    summary:
      "Screen serious pathology and neuro deficit before loading the spine hard.",
    followUpQuestions: [
      "Saddle anesthesia, bowel/bladder changes?",
      "Progressive leg weakness or foot drop?",
      "Night pain, fever, unexplained weight loss?",
      "Trauma or history of cancer?",
      "Pain with cough/sneeze or constant rest pain?",
    ],
    solutionSteps: [
      "If red flags: urgent medical referral—do not train through.",
      "If mechanical and cleared: relative rest from aggravators, keep gentle movement, gradual load return.",
      "Document carefully; avoid diagnosing disc herniation as a PT coach.",
      "Use pain traffic-light for graded return once safe.",
      "Reassess weekly until stable.",
    ],
    interventions: [
      "Walk tolerance if tolerated",
      "Dead bug / gentle hinge regressions when appropriate",
      "Referral when indicated",
      "Session note with red-flag checklist result",
    ],
    redFlags: [
      "Cauda equina signs",
      "Progressive neuro deficit",
      "Night pain with systemic signs",
      "Trauma + inability to walk",
      "History of cancer with new back pain",
    ],
    contraindications:
      "Do not load the spine hard or diagnose pathology when red flags are present.",
    body: `Most low-back pain is non-specific, but red flags must be screened every time. Cauda equina signs, progressive neuro deficit, systemic night pain, trauma, and cancer history with new pain need medical pathways. Coaching is not medical diagnosis.`,
  },
  {
    slug: "knee-pain-coaching",
    title: "Anterior Knee Pain — Coaching Approach",
    category: "corrective",
    triggerPhrases:
      "knee pain,knee pain squat,patellofemoral,front of knee hurts,runner knee,anterior knee",
    tags: "knee,pain,squat,patella",
    summary:
      "Load management + capacity (quads/hips) for common anterior knee irritation after red-flag screen.",
    followUpQuestions: [
      "Trauma, locking, giving way, or large swelling?",
      "Pain with stairs, sitting, or deep squat?",
      "Recent spike in running/jumping/squat volume?",
      "Valgus or ankle DF limits present?",
      "What load still feels tolerable?",
    ],
    solutionSteps: [
      "Clear red flags → refer if present.",
      "Reduce aggravating volume 20–50% temporarily.",
      "Keep quads loading in tolerable ranges (leg press, partial ROM, isometrics).",
      "Address valgus control and ankle DF if relevant.",
      "Rebuild deep squat/jump gradually with traffic-light pain rules.",
    ],
    interventions: [
      "Spanish squat / wall sit isometrics if tolerated",
      "Leg press or step-ups in pain-tolerable ROM",
      "Hip abductor strength",
      "Tempo squats above pain depth",
    ],
    redFlags: [
      "Locking",
      "Giving way",
      "Acute trauma swelling",
      "Inability to weight bear",
      "Hot swollen joint",
    ],
    body: `Tendons and the patellofemoral joint often need graded loading, not complete rest. Stay under symptom-flare thresholds, keep some capacity work, and progress weekly. Refer locking, giving way, or hot swollen joints.`,
  },
  {
    slug: "lateral-hip-pain",
    title: "Lateral Hip Pain (GT-type presentation)",
    category: "corrective",
    triggerPhrases:
      "side hip pain,greater trochanter,lateral hip,hip bursitis,gtps,outer hip pain",
    tags: "hip,pain,glute,tendon",
    summary:
      "Lateral hip pain often prefers isometric then heavy-slow loading of abductors; avoid aggressive stretch into pain.",
    followUpQuestions: [
      "Pain lying on that side?",
      "Worse with walking hills or single-leg work?",
      "Any lumbar referral suspicion?",
      "Recent volume spike in running or lateral work?",
      "Single-leg stance quality?",
    ],
    solutionSteps: [
      "Screen lumbar contribution and red flags.",
      "Reduce compressive aggravators (side-lying, crossing legs) short term.",
      "Isometrics → heavy slow abduction/extension loading as tolerated.",
      "Avoid ballistic stretching into pain.",
      "Rebuild single-leg capacity gradually.",
    ],
    interventions: [
      "Side-lying or standing hip abduction isometrics",
      "Side plank regressions",
      "Single-leg bridge progressions",
      "Gait volume management",
    ],
    redFlags: [
      "Night pain with systemic symptoms",
      "Unable to weight bear",
      "Fever",
      "Trauma with deformity",
    ],
    body: `Many lateral hip presentations behave like tendinopathy. Graded loading beats endless foam rolling of the IT band. Rule out lumbar referral and train abductors patiently.`,
  },
  {
    slug: "neck-pain-coaching",
    title: "Neck Discomfort — Coaching Frame",
    category: "corrective",
    triggerPhrases:
      "neck pain,stiff neck,cervical,neck stiff overhead,trap pain neck,tech neck pain",
    tags: "neck,corrective,posture,desk",
    summary:
      "Common training-related neck stiffness: check red flags, reduce shrugging under load, restore thoracic/scapular options.",
    followUpQuestions: [
      "Trauma or radiating arm symptoms?",
      "Worse with desk work or overhead?",
      "Dizziness, drop attacks, or severe headache?",
      "Does cueing a soft neck fix the lift immediately?",
      "Recent upper-trap isolation or heavy shrugs?",
    ],
    solutionSteps: [
      "Red-flag screen; refer if neuro or trauma.",
      "Cue soft neck / pack the neck under load.",
      "Reduce pure shrug-dominant loading temporarily.",
      "Thoracic and scapular control work.",
      "Reassess aggravating lifts in 1–2 weeks.",
    ],
    interventions: [
      "Wall slides with neck relaxed",
      "Serratus / lower trap emphasis",
      "Thoracic openers",
      "Lighter upper-trap isolation only when base is calm",
    ],
    redFlags: [
      "Trauma",
      "Arm numbness / true weakness",
      "Severe headache / neurological signs",
      "Unexplained weight loss with pain",
    ],
    contraindications:
      "Do not force end-range cervical motion or train through neuro red flags.",
    body: `Neck pain with training is often load + posture related but can be serious. Red flags need medical review. Soften the neck under load, fix thoracic/scapular options, and change desk habits. Coaching is not diagnosis.`,
  },
  {
    slug: "elbow-tendon-load",
    title: "Elbow Tendon Irritation (Coaching)",
    category: "corrective",
    triggerPhrases:
      "tennis elbow,golfer elbow,elbow pain pressing,elbow pain curling,lateral epicondyl,medial elbow,elbow tendon",
    tags: "elbow,tendon,corrective,upper-body",
    summary:
      "Load management for elbow irritation: reduce aggravators, keep isometrics and graded exposure, avoid sudden spikes.",
    followUpQuestions: [
      "Medial or lateral elbow?",
      "Worse with gripping, curls, or pressing?",
      "Recent volume spike?",
      "Grip width or elbow path changes on presses?",
      "Night pain or trauma?",
    ],
    solutionSteps: [
      "Reduce painful gripping spikes 20–40%.",
      "Keep pain-free isometrics if tolerated.",
      "Slow tempo for forearm work when ready.",
      "Review grip width and elbow path on presses.",
      "Refer if night pain, trauma, or no progress in several weeks.",
    ],
    interventions: [
      "Isometric wrist holds",
      "Slow eccentric wrist work when appropriate",
      "Neutral-grip pressing variants",
      "Temporary reduction of heavy curls/pull-ups volume",
    ],
    redFlags: ["Trauma", "Numbness/tingling into hand", "Severe swelling"],
    body: `Tendon irritations often need smarter loading, not complete rest forever. Manage spikes, keep tolerable isometrics, and progress slowly. Persistent or severe cases need clinical input.`,
  },
  {
    slug: "pain-traffic-light",
    title: "Pain Traffic-Light for Loading",
    category: "corrective",
    triggerPhrases:
      "pain during exercise,is pain ok,train through pain,soreness vs pain,traffic light pain,how much pain is ok,pain traffic light",
    tags: "pain,loading,coaching,safety,traffic-light",
    summary:
      "Green / amber / red framing for pain during training — coaching heuristic, not diagnosis.",
    followUpQuestions: [
      "Pain during, after, or next day?",
      "Sharp vs dull? Getting worse week to week?",
      "Any red flags (night pain, trauma, neuro)?",
      "Which movements provoke?",
      "Does pain settle within 24 hours after session?",
    ],
    solutionSteps: [
      "Screen red flags first.",
      "Green: mild, settles quickly — continue with form focus.",
      "Amber: modify range, load, or variation; track.",
      "Red: stop, document, refer if needed.",
      "Log pain notes on the session every time.",
    ],
    interventions: [
      "Range or tempo regression",
      "Swap bilateral for unilateral or machine",
      "Isometrics in comfortable range",
      "Session pain note template",
    ],
    redFlags: [
      "Night pain / rest pain",
      "Trauma",
      "Neurological symptoms",
      "Rapidly worsening function",
    ],
    contraindications:
      "Do not use traffic-light framing to justify training through red-flag symptoms.",
    body: `Mild, stable, activity-related discomfort can be coached carefully. Progressive, sharp, or systemic pain needs caution and possible referral. Green / amber / red is a shared language for load decisions—not a medical protocol.`,
  },
  {
    slug: "return-to-overhead-press",
    title: "Return to Overhead Press",
    category: "corrective",
    triggerPhrases:
      "return to overhead press,ohp progression,can't press overhead,shoulder press pain history,overhead return",
    tags: "shoulder,overhead,progression,press",
    summary:
      "Staged return: mobility capacity → landmine/neutral → barbell OHP as tolerated.",
    followUpQuestions: [
      "Current pain-free ROM overhead?",
      "Back scratch / wall slide status?",
      "Recent irritability with incline or OHP?",
      "Clearance after any clinical care?",
      "Pull volume currently high enough?",
    ],
    solutionSteps: [
      "Clear red flags.",
      "Pass basic wall slide + pain-free flex ~160°+ before heavy OHP.",
      "Landmine / DB neutral press → half-kneeling → standing.",
      "Keep high pull volume throughout.",
      "Progress load only with quiet neck and stable trunk.",
    ],
    interventions: [
      "Wall slides",
      "Landmine press",
      "DB seated neutral press",
      "Face pulls + rows",
    ],
    redFlags: [
      "Instability apprehension",
      "Night pain",
      "Neuro symptoms",
    ],
    body: `Overhead is earned with capacity and graded exposure, not forced ROM under load. Landmine and neutral grips are friends. Keep pull volume high while rebuilding press.`,
  },

  // ── Programming process ──────────────────────────────────────────
  {
    slug: "program-design-basics",
    title: "Program Design Intake Questions",
    category: "programming",
    triggerPhrases:
      "design program,write program,training plan,workout split,periodization,build a program,program design,session prep",
    tags: "programming,plan,intake,fitt",
    summary:
      "Minimum questions before drafting a training program: goal, frequency, equipment, limits, progression.",
    followUpQuestions: [
      "Primary goal (fat loss, hypertrophy, strength, sport, health)?",
      "Days per week and session length?",
      "Equipment access?",
      "Injuries or failed screens?",
      "Training age / experience?",
    ],
    solutionSteps: [
      "Lock goal and weekly frequency (FITT).",
      "Choose a split that fits real days—not ideal days.",
      "Cover squat, hinge, push, pull, carry/core each week.",
      "Respect assessment limits and special-pop clearance.",
      "Define progression, review date, and deload trigger.",
    ],
    interventions: [
      "Goal + constraints one-pager",
      "2–4 day split templates",
      "Pattern checklist (squat/hinge/push/pull/core)",
      "4–8 week review calendar invite",
    ],
    redFlags: [
      "Uncontrolled medical issues needing clearance",
      "Acute injury same day — medical first",
    ],
    body: `Collect goal, frequency, equipment, injuries, and experience before writing a program. Use available equipment inventory. Fit FITT to contact time; defer vanity goals behind safety and function when needed. Pair with client-intake checklist for first sessions.`,
  },
  {
    slug: "client-intake-checklist",
    title: "Client Intake Checklist for PTs",
    category: "business",
    triggerPhrases:
      "intake,new client,first session,onboarding client,what to ask new client,consultation,client brief,session prep intake",
    tags: "intake,business,onboarding,crm",
    summary:
      "First-contact checklist: goals, history, screens, baseline measures, and next booking.",
    followUpQuestions: [
      "Goals and timeline?",
      "Injuries / medical flags / clearance?",
      "Schedule and equipment access?",
      "Experience level?",
      "What does success look like in 8–12 weeks?",
    ],
    solutionSteps: [
      "Run guided intake (or quick add + finish later).",
      "Capture goals, injuries, experience, and preferences.",
      "Optional measurements + priority screens.",
      "Design first program from equipment + goals.",
      "Book next session and set a review date.",
    ],
    interventions: [
      "Full intake wizard",
      "Priority screens (OHS, ankle DF, back scratch, posture as relevant)",
      "Baseline body weight / girths if consented",
      "Clear next-session booking",
    ],
    redFlags: [
      "Undiagnosed chest pain",
      "Acute injury same day — medical first",
      "Clearance required but missing",
    ],
    body: `A clean CRM record beats memory. Intake fields power the coach, program builder, and progress views. Capture goals, risks, screens, and the next booking before the session ends.`,
  },
  {
    slug: "beginner-first-month",
    title: "Beginner First Month Priorities",
    category: "programming",
    triggerPhrases:
      "beginner program,new client first month,never trained,newbie,novice training,first month",
    tags: "programming,beginner,onboarding",
    summary:
      "Skill, consistency, and full-body basics before specialization.",
    followUpQuestions: [
      "Any medical clearance needs?",
      "2, 3, or 4 days realistic?",
      "Equipment access?",
      "Prior sports or long layoffs?",
      "Fear of certain movements?",
    ],
    solutionSteps: [
      "Full body 2–3×/week.",
      "1 squat, 1 hinge, 1 push, 1 pull, 1 carry/core each session.",
      "RPE 6–7; leave reps in reserve.",
      "Teach warm-up and logging.",
      "Review form and adherence at week 4 before specialty splits.",
    ],
    interventions: [
      "Goblet squat, DB RDL, push-up/DB press, row, farmer carry, dead bug",
      "Session log habit from day one",
      "Simple 2–3 day repeating template",
    ],
    redFlags: ["Uncontrolled medical conditions needing clearance"],
    body: `Month one is about showing up and learning patterns, not maximizing soreness. Full-body frequency, moderate RPE, and honest logging beat complex splits.`,
  },
  {
    slug: "progressive-overload",
    title: "Progressive Overload Basics",
    category: "programming",
    triggerPhrases:
      "progressive overload,how to progress,add weight,stuck plateau,progression scheme,double progression",
    tags: "programming,progression,strength,hypertrophy",
    summary:
      "Simple progression rules by goal and experience—one lever at a time, logged honestly.",
    followUpQuestions: [
      "Goal strength, hypertrophy, or general fitness?",
      "Are they logging loads every session?",
      "Sleep/stress/protein roughly in place?",
      "Which lift stalled—skill or true capacity?",
      "How many hard weeks since last easier week?",
    ],
    solutionSteps: [
      "Pick one primary progression lever (load, reps, sets, ROM, density).",
      "Double progression: hit top of rep range clean → add load.",
      "Technique beats ego load; hold or reduce when form breaks.",
      "Deload when performance stalls 2+ weeks or life stress is high.",
      "Review logs every 1–2 weeks with the client.",
    ],
    interventions: [
      "Track top sets in session log",
      "Add 1–2 reps before load when intermediate",
      "Scheduled easier week every 4–8 weeks as needed",
      "Film sticky lifts for technique review",
    ],
    redFlags: [
      "Sharp joint pain with progressive loading",
      "Ignoring form collapse to chase load",
    ],
    body: `Overload is systematic, not ego. Log sessions and change one variable at a time. Pair with RPE coaching and honest technique standards. For anaerobic resistance detail, also see NCSF resistance progression.`,
  },
  {
    slug: "rpe-coaching",
    title: "RPE / RIR Coaching",
    category: "programming",
    triggerPhrases:
      "what is RPE,RIR,how hard should sets feel,rate of perceived exertion,reps in reserve,effort scale",
    tags: "programming,rpe,intensity",
    summary:
      "Use RPE/RIR so clients autoregulate effort without missing stimulus.",
    followUpQuestions: [
      "Beginner or intermediate?",
      "Do they sandbag or ego-lift?",
      "Do last-rep speeds match their claimed RPE?",
      "Any pain that confuses effort ratings?",
      "Main lifts vs accessories — same scale?",
    ],
    solutionSteps: [
      "Define RPE 6–8 for most working sets (about 2–4 RIR).",
      "Reserve RPE 9+ for tested top sets sparingly.",
      "Calibrate with last-rep speed and form breakdown.",
      "Start new clients at RPE 6–7 for ~2 weeks.",
      "Revisit calibration after deloads or layoffs.",
    ],
    interventions: [
      "RPE card in session notes",
      "Video a set to discuss true RIR",
      "Top-set + back-off template",
    ],
    redFlags: [],
    body: `RPE is a communication tool. Recalibrate often with beginners. Most hypertrophy and general-fitness work lives around RPE 6–8; max efforts are rare and intentional.`,
  },
  {
    slug: "warmup-design",
    title: "Warm-Up Design for Sessions",
    category: "programming",
    triggerPhrases:
      "warm up,warmup,warmup routine,how to warm up,session start mobility,warm-up design",
    tags: "programming,warmup,mobility,session-design",
    summary:
      "General raise temp → specific mobility → ramp sets for first main lift. Keep it short and session-specific.",
    followUpQuestions: [
      "Session type (lower, upper, full)?",
      "Any screens currently failing?",
      "Time available before working sets?",
      "Client cold (morning) or already active?",
      "Joint that needs extra attention today?",
    ],
    solutionSteps: [
      "3–5 min easy cardio optional (general).",
      "2–4 targeted mobility/activation drills tied to the session (specific).",
      "2–4 ramp-up sets on the main lift (functional).",
      "Trim to 5–10 minutes in short PT slots.",
      "Stop and refer for chest pain, unusual SOB, or sharp joint pain.",
    ],
    interventions: [
      "T-spine + scap for upper; ankle + hip for lower",
      "Empty bar / light KB pattern rehearsal",
      "Failed-screen drills first when relevant",
    ],
    redFlags: [
      "Chest pain or lightheadedness in warm-up",
      "Sharp joint pain with progressive drills",
    ],
    body: `Warm-ups should be short, specific, and progressive into the first work set. General → specific → functional. For type definitions and contact-time trims, pair with the NCSF warm-up types playbook.`,
  },
  {
    slug: "deload-week",
    title: "When and How to Deload",
    category: "programming",
    triggerPhrases:
      "deload,deload week,recovery week,overreaching,feeling beaten up,plateau fatigue",
    tags: "programming,recovery,deload",
    summary:
      "Deload by reducing volume/load while keeping frequency and technique.",
    followUpQuestions: [
      "How many hard weeks in a row?",
      "Sleep and stress status?",
      "Joint aches vs true injury?",
      "Performance dropping across multiple lifts?",
      "Life events that will steal recovery this week?",
    ],
    solutionSteps: [
      "Cut sets ~40–50% or load ~10% for 5–7 days.",
      "Keep movement patterns; drop junk volume.",
      "Protect sleep and easy aerobic work.",
      "Return with prior working weights if quality is back.",
      "If true injury (swelling/instability), medical path—not a deload.",
    ],
    interventions: [
      "Same exercises, fewer sets",
      "Optional extra walk / sleep focus",
      "Technique-only day for sticky lifts",
    ],
    redFlags: [
      "True injury with swelling/instability — don't deload past medical need",
      "Illness with fever",
    ],
    body: `Deloads manage fatigue. They are not punishment weeks of random HIIT. Reduce volume or load, keep skill, and return when quality returns. Injury and illness are different pathways.`,
  },
  {
    slug: "recovery-sleep-stress",
    title: "Recovery: Sleep, Stress & Load",
    category: "programming",
    triggerPhrases:
      "recovery,sleep,stress,overreaching,not recovering,always sore,fatigue,deload or recovery,under recovered",
    tags: "recovery,sleep,stress,load-management",
    summary:
      "Performance plateaus often track sleep and stress as much as programming. Adjust load before blaming the plan.",
    followUpQuestions: [
      "Typical sleep hours and quality?",
      "Work or life stress spike?",
      "Soreness lasting >72h or performance dropping?",
      "Nutrition roughly adequate for goal?",
      "How many hard sessions last 7 days?",
    ],
    solutionSteps: [
      "Screen sleep and stress before adding volume.",
      "Hold or reduce load 1–2 weeks if under-recovered.",
      "Protect 1–2 easier sessions; keep skill practice light.",
      "Revisit deload protocol if needed.",
      "Document notes on the client record.",
    ],
    interventions: [
      "Optional deload week",
      "Swap high-skill heavy day for technique focus",
      "Walks / easy aerobic for recovery",
      "Sleep hygiene prompts (coaching, not therapy)",
    ],
    redFlags: [
      "Illness with fever",
      "Unexplained severe fatigue",
      "Depression / crisis — refer appropriately",
    ],
    body: `Load × recovery = adaptation. When recovery is poor, more sets are rarely the answer. Check sleep, stress, and life load before rewriting the program.`,
  },
  {
    slug: "fat-loss-training-bias",
    title: "Fat Loss — Training Bias for PTs",
    category: "programming",
    triggerPhrases:
      "fat loss program,lose weight training,cutting,recomp training,fat loss training,cut training",
    tags: "programming,fat-loss,conditioning",
    summary:
      "Preserve muscle with strength work; conditioning supports deficit; nutrition owns most of the scale—stay in coach scope.",
    followUpQuestions: [
      "Calorie awareness / protein roughly set?",
      "Steps baseline?",
      "Preference lifting vs cardio?",
      "Any disordered-eating history?",
      "How aggressive is the timeline?",
    ],
    solutionSteps: [
      "Keep 2–4 strength sessions (full body or upper/lower).",
      "Add steps and 1–2 conditioning bouts as recovery allows.",
      "Don’t slash lifting volume to zero.",
      "Sleep and protein reminders (coaching, not medical meal plans).",
      "Refer disordered eating; use weight-management NCSF playbook for behavior depth.",
    ],
    interventions: [
      "Compound lifts at RPE 6–8",
      "Bike/row intervals if equipment available",
      "Daily step target",
      "Protein-at-meals habit prompt",
    ],
    redFlags: [
      "Disordered eating signs — refer appropriately",
      "Extreme restriction or crash dieting",
    ],
    body: `Training protects muscle during fat loss. Deficits are primarily nutritional; stay in scope of practice. Strength stays on the calendar; conditioning and steps support the deficit. For behavior and energy-balance coaching, open the NCSF weight-management playbook.`,
  },
  {
    slug: "unilateral-leg-work",
    title: "When to Emphasize Unilateral Legs",
    category: "programming",
    triggerPhrases:
      "split squat,single leg,lunges vs squat,unilateral leg,imbalance legs,single-leg strength",
    tags: "programming,legs,unilateral,balance",
    summary:
      "Use unilateral work for asymmetry, sport, or when axial loading is limited.",
    followUpQuestions: [
      "Left-right strength or control gap?",
      "Back doesn’t tolerate heavy bilateral well?",
      "Sport needs single-leg strength?",
      "Single-leg stance or bridge quality?",
      "Knee or hip irritability with bilateral deep flexion?",
    ],
    solutionSteps: [
      "Include 1–2 unilateral patterns most weeks.",
      "Match volumes roughly L=R; start weak side first.",
      "Progress split squat / step-up before adding complexity.",
      "Use as primary lower volume when spine load must stay moderate.",
      "Re-check side gap every 3–4 weeks.",
    ],
    interventions: [
      "Rear-foot elevated split squat",
      "Step-ups",
      "Single-leg RDL",
      "Single-leg stance as warm-up control",
    ],
    redFlags: [],
    body: `Unilateral training is a tool for control and volume without always stacking the spine. Match sides, start weak side first, and progress complexity only after balance and tracking are honest.`,
  },
  {
    slug: "set-schemes-overview",
    title: "Set Schemes Overview (Straight → Advanced)",
    category: "programming",
    triggerPhrases:
      "set scheme,pyramid sets,reverse pyramid,drop sets,cluster sets,myo reps,rest pause,tempo sets,wave loading,straight sets",
    tags: "programming,sets,schemes,intensity,volume",
    summary:
      "Choose set schemes that match the goal: straight for skill, pyramids/RPT for strength-hypertrophy, drops/myo for metabolic stress, clusters for heavy quality.",
    followUpQuestions: [
      "Primary goal this block (strength, hypertrophy, fat loss)?",
      "Training age — intermediate or advanced?",
      "Is this a main lift or accessory?",
      "Time available per session?",
      "Joint-friendly needs (tempo over max load)?",
    ],
    solutionSteps: [
      "Main compounds: prefer reverse pyramid, pyramid, or straight heavy sets.",
      "Accessories: straight, tempo, drop, or myo-reps.",
      "Keep 1–2 advanced schemes per session—not everything.",
      "Log set roles (top, back-off, drop) so progress is clear.",
      "Re-test strength or screens every 4–8 weeks.",
    ],
    interventions: [
      "Straight sets for skill learning",
      "Reverse pyramid (heavy first) for intermediates+",
      "Drops / rest-pause on last accessory only",
      "Tempo for control and joint-friendly loading",
    ],
    redFlags: [],
    body: `Set schemes are tools, not decoration. Straight sets teach skill. Pyramid / reverse pyramid change load across sets for strength-hypertrophy. Waves suit advanced strength. Drops, rest-pause, and myo add metabolic stress—use sparingly. Clusters keep heavy quality with short intra-rests. Tempo and negatives emphasize control. In this CRM, schemes can auto-assign by goal and be edited on the program.`,
  },
  {
    slug: "contrast-complex-superset",
    title: "Contrast, Complexes & Supersets",
    category: "programming",
    triggerPhrases:
      "contrast sets,complex sets,superset,super set,giant set,pairing exercises,power after heavy,contrast training,barbell complex",
    tags: "programming,contrast,complex,superset,power,conditioning",
    summary:
      "Multi-exercise groups: contrast (heavy + explosive), complexes (flow), supersets (A/B pairs)—with clear rest rules.",
    followUpQuestions: [
      "Strength-power goal or conditioning density?",
      "Client ready for explosive work (pain-free, decent control)?",
      "Equipment for a continuous complex?",
      "Time-limited session?",
      "Landing or impact tolerance?",
    ],
    solutionSteps: [
      "Contrast: heavy controlled set → rest ~60–90s → explosive set; rest ~2 min after the pair.",
      "Complex: 2–4 movements, little rest between, rest after full round; load by weakest link.",
      "Superset: A then B with short rest; rest after the pair.",
      "Log each exercise separately; track rounds, not a single blended set.",
      "Skip explosive work if pain, instability, or poor landing mechanics.",
    ],
    interventions: [
      "Squat + jump (contrast)",
      "RDL → hang shrug → front squat (complex)",
      "Push / pull superset",
      "Core + carry density pair",
    ],
    redFlags: [
      "Pain with landing or impact",
      "Uncontrolled trunk under load",
      "Acute joint injury",
    ],
    body: `Multi-exercise schemes need clear structure. Contrast pairs heavy strength with a power move—quality over fatigue. Complexes string movements with one implement; rest mainly between rounds. Supersets alternate patterns for density. Log each piece; do not hide bad reps inside a group.`,
  },
  {
    slug: "session-logging-best-practice",
    title: "Session Logging Best Practice",
    category: "programming",
    triggerPhrases:
      "log session,how to log,set log,track weights,session RPE,complete workout,record training,log session floor",
    tags: "sessions,logging,rpe,progress,crm",
    summary:
      "How to log sets on the floor: mark completed sets only, save progress, use copy last weights, note pain and RPE.",
    followUpQuestions: [
      "In-progress session already open for this day?",
      "Client assigned to the program?",
      "Any pain during today’s lifts?",
      "Do last-session weights still make sense today?",
      "Session RPE overall?",
    ],
    solutionSteps: [
      "Start or resume from the program day.",
      "Log weight/reps per set; tick only sets actually performed.",
      "Use Copy last weights when continuity helps.",
      "Save progress mid-session; complete when finished.",
      "Record session RPE and pain notes for coach context.",
    ],
    interventions: [
      "Resume in-progress rather than starting duplicates",
      "Per-set checkmarks (not auto-complete all)",
      "Client notes auto-summary on complete",
      "Pain traffic-light note when needed",
    ],
    redFlags: ["Sharp pain mid-session — stop, document, regress"],
    body: `Accurate logs beat perfect theory. Incomplete sets should stay incomplete. Session notes feed the client record and future coaching. Resume open sessions instead of creating duplicates.`,
  },
  {
    slug: "exercise-selection-equipment",
    title: "Exercise Selection from Available Equipment",
    category: "programming",
    triggerPhrases:
      "no barbell,only dumbbells,cable only,bodyweight only,equipment limited,what exercises can I do,swap exercise,substitute exercise,exercise selection",
    tags: "equipment,exercise-selection,programming,inventory,substitute",
    summary:
      "Build around movement patterns first, then pick from available inventory. Swap within pattern when gear is missing.",
    followUpQuestions: [
      "What equipment is available today?",
      "Which pattern is limited (squat, hinge, push, pull)?",
      "Client preference or skill constraint?",
      "Any joint that forces a substitution?",
      "Is the org inventory up to date?",
    ],
    solutionSteps: [
      "Map session to patterns, not machines.",
      "Use the library filter (available only).",
      "Substitute exercise within pattern keeping sets/reps when possible.",
      "Update org equipment inventory when gear changes.",
      "Prefer form-friendly options over ego implements.",
    ],
    interventions: [
      "Goblet squat instead of back squat",
      "DB RDL instead of barbell hinge",
      "Push-up / landmine instead of bench",
      "Inverted row / cable row instead of barbell row",
    ],
    redFlags: [],
    body: `Pattern coverage beats specific lifts. Substitute exercise within the same pattern when gear or joints limit options. This CRM filters suggestions by equipment marked available in Library—keep inventory honest.`,
  },
  {
    slug: "missed-sessions-adherence",
    title: "Missed Sessions / Adherence",
    category: "business",
    triggerPhrases:
      "client missed sessions,inconsistent training,adherence,motivation,no show,skipped workouts,attendance",
    tags: "coaching,adherence,behavior,business",
    summary:
      "Shrink the plan, remove friction, and renegotiate goals without shame.",
    followUpQuestions: [
      "What blocked them (time, energy, logistics, fear)?",
      "Is the plan too long or too hard?",
      "Minimum effective dose they will accept?",
      "Travel or shift work this month?",
      "Do they know the next two session times?",
    ],
    solutionSteps: [
      "Drop to 2×/week full body if needed.",
      "Shorten sessions to 30–40 min.",
      "Schedule next 2 sessions concretely.",
      "Celebrate process metrics (sessions completed).",
      "Remove optional accessories that create friction.",
    ],
    interventions: [
      "2-day full body template",
      "Home band version if travel",
      "Check-in message template",
      "Calendar holds for next two sessions",
    ],
    redFlags: [
      "Avoidance driven by pain or fear of injury — screen and address",
      "Signs of disordered relationship with training or food — refer",
    ],
    body: `Adherence is a design problem. Smaller plans beat perfect plans that don’t happen. Reduce friction, book the next sessions, and measure showing up before optimizing periodization.`,
  },
];
