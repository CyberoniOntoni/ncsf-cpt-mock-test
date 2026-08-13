/**
 * Canonical assessment template catalog — polished coach-facing copy.
 * Seeded/upserted by slug so existing DBs pick up wording improvements.
 */

export type TemplateField = {
  key: string;
  label: string;
  type: "pass_fail" | "number" | "text" | "select";
  options?: string[];
  side?: "left" | "right" | "both" | "none";
  /** Short helper under the field */
  help?: string;
};

export type AssessmentTemplateDef = {
  slug: string;
  name: string;
  /** One-line purpose shown in lists */
  description: string;
  /** Step-by-step how to run the screen */
  instructions: string;
  /** What a “good” result roughly means (coaching, not clinical) */
  purpose?: string;
  category: string;
  laterality: boolean;
  scoringType: string;
  fields: TemplateField[];
  playbookTags: string;
  sortOrder: number;
};

export const ASSESSMENT_TEMPLATES: AssessmentTemplateDef[] = [
  {
    slug: "back-scratch",
    name: "Back Scratch Test (Apley)",
    description:
      "Shoulder mobility screen for internal/external rotation and scapular reach — compares left vs right.",
    purpose:
      "Flags side-to-side shoulder mobility limits that may affect overhead pressing, hanging, and reach tasks. Asymmetry is common; pain is a higher-priority signal than stiffness alone.",
    instructions:
      "Client stands tall. One hand reaches over the same shoulder (palm facing spine); the other reaches up the back (palm facing out). Aim for middle fingers to meet or overlap.\n\nMeasure the gap (cm) or overlap (record overlap as a negative number). Repeat with arms reversed so each side is the “top” arm once.\n\nMark pass/fail per side using your standard (e.g. fingers meet = pass). Note any pain.",
    category: "movement",
    laterality: true,
    scoringType: "pass_fail",
    fields: [
      {
        key: "right_over",
        label: "Right arm on top — gap (cm)",
        type: "number",
        side: "right",
        help: "Positive = gap between fingers; negative = overlap",
      },
      {
        key: "left_over",
        label: "Left arm on top — gap (cm)",
        type: "number",
        side: "left",
        help: "Positive = gap; negative = overlap",
      },
      {
        key: "right_pass",
        label: "Right side result",
        type: "pass_fail",
        side: "right",
        help: "Pass if fingers meet/overlap without pain (use your gym standard)",
      },
      {
        key: "left_pass",
        label: "Left side result",
        type: "pass_fail",
        side: "left",
        help: "Pass if fingers meet/overlap without pain (use your gym standard)",
      },
      {
        key: "pain",
        label: "Pain during test?",
        type: "pass_fail",
        help: "Pass = no pain; Fail = pain present. Pain outranks stiffness.",
      },
    ],
    playbookTags: "shoulder,mobility,back-scratch,apley,upper-cross",
    sortOrder: 1,
  },
  {
    slug: "overhead-squat",
    name: "Overhead Squat Screen",
    description:
      "Full-body movement snapshot: ankles, hips, trunk, and shoulders under a bodyweight overhead squat.",
    purpose:
      "Highlights movement strategies (heels rise, knee cave, arms drop) so you can prioritise mobility, control, or load regressions before progressive training.",
    instructions:
      "Barefoot if practical. Feet roughly shoulder-width, toes slightly out. Arms long overhead (biceps by ears if possible).\n\nClient squats as deep as they can while keeping heels down and arms up. Observe from front and side.\n\nScore depth, valgus, heels, arms, lumbar arch, and excessive forward lean as separate items. Fail = fault clearly seen. One extra note beats over-documenting.",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "depth",
        label: "Squat depth quality",
        type: "select",
        options: ["good", "limited", "poor"],
        help: "Good ≈ thighs near parallel+ with control; limited/poor = shallower or unstable",
      },
      {
        key: "valgus",
        label: "Knees cave in (valgus)?",
        type: "pass_fail",
        help: "Fail = fault seen (clear collapse). Pass = knees track over mid-foot",
      },
      {
        key: "heels",
        label: "Heels rise?",
        type: "pass_fail",
        help: "Fail = fault seen (heels leave the floor to hit depth)",
      },
      {
        key: "arms_fall",
        label: "Arms fall forward?",
        type: "pass_fail",
        help: "Fail = fault seen (arms drop well in front of the ears)",
      },
      {
        key: "lumbar_arch",
        label: "Excessive lumbar arch / rib flare?",
        type: "pass_fail",
        help: "Fail = fault seen (hard lumbar extension or ribs flare under the squat)",
      },
      {
        key: "excessive_lean",
        label: "Excessive forward trunk lean?",
        type: "pass_fail",
        help: "Fail = fault seen (chest dumps forward beyond a controlled hinge)",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Asymmetry, cue that fixed it",
      },
    ],
    playbookTags: "squat,mobility,global,ohs,ankle,valgus,heels",
    sortOrder: 2,
  },
  {
    slug: "posture-static",
    name: "Static Posture Snapshot",
    description:
      "Quick standing posture check from front and side — head, shoulders, pelvis only.",
    purpose:
      "Gives a baseline for desk-related patterns (forward head, rounded shoulders, pelvic tilt). Static posture is not a diagnosis; pair with symptoms and movement screens.",
    instructions:
      "Client stands relaxed, feet under hips, looking ahead. View anterior and lateral (and posterior if useful).\n\nRecord major deviations only — skip minor asymmetries that don’t affect training.\n\nUse notes for anything that changes with cueing (“ribs down”, “soft knees”).",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "head",
        label: "Head position",
        type: "select",
        options: ["neutral", "forward", "tilted"],
        help: "Forward head is common with desk work; note if it changes when cued",
      },
      {
        key: "shoulders",
        label: "Shoulders",
        type: "select",
        options: ["level", "elevated_R", "elevated_L", "rounded"],
        help: "Elevated R/L = that side sits higher; rounded = both protract",
      },
      {
        key: "pelvis",
        label: "Pelvis",
        type: "select",
        options: ["neutral", "anterior_tilt", "posterior_tilt"],
        help: "Anterior = arch/lordosis bias; posterior = tucked under",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Cue response, rib flare, weight shift",
      },
    ],
    playbookTags: "posture,upper-cross,lower-cross,forward-head",
    sortOrder: 3,
  },
  {
    slug: "ankle-df-wall",
    name: "Ankle Dorsiflexion (Wall Test)",
    description:
      "Knee-to-wall distance — simple, repeatable ankle dorsiflexion measure for each side.",
    purpose:
      "Limited DF often shows up as heels rising in squats or restricted landing mechanics. Track cm over weeks to show progress.",
    instructions:
      "Client faces a wall, test foot flat, toes pointing at the wall. Keep heel down the whole time.\n\nDrive the knee forward toward the wall (same line as 2nd toe). Find the farthest foot position where the knee still touches the wall without the heel lifting.\n\nRecord distance from big toe to wall in cm for each side. Note if the heel pops early.",
    category: "movement",
    laterality: true,
    scoringType: "multi",
    fields: [
      {
        key: "right_cm",
        label: "Right — toe-to-wall distance (cm)",
        type: "number",
        side: "right",
        help: "Larger number ≈ more DF available",
      },
      {
        key: "left_cm",
        label: "Left — toe-to-wall distance (cm)",
        type: "number",
        side: "left",
        help: "Larger number ≈ more DF available",
      },
      {
        key: "heel_lift",
        label: "Heel lifts before useful depth?",
        type: "pass_fail",
        help: "Fail = fault seen (heel cannot stay down in a usable range)",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Pain location, stiffness vs pinching",
      },
    ],
    playbookTags: "ankle,mobility,squat,heels,dorsiflexion",
    sortOrder: 4,
  },
  {
    slug: "single-leg-stance",
    name: "Single-Leg Stance (eyes open)",
    description:
      "Balance and hip/trunk control on one leg — up to ~30 seconds each side.",
    purpose:
      "Useful before single-leg loading (split squats, lunges, running). Large side-to-side gaps or heavy trunk lean suggest control work first.",
    instructions:
      "Barefoot if practical. Hands on hips or arms free. Lift one foot so the thigh is roughly parallel or foot clears the floor.\n\nHold up to 30 seconds without the standing foot hopping or the hands touching for support.\n\nNote time held and whether the pelvis drops or the trunk leans hard. Compare sides.",
    category: "movement",
    laterality: true,
    scoringType: "multi",
    fields: [
      {
        key: "right_sec",
        label: "Right stance hold (seconds)",
        type: "number",
        side: "right",
        help: "Cap at 30 if rock-solid",
      },
      {
        key: "left_sec",
        label: "Left stance hold (seconds)",
        type: "number",
        side: "left",
        help: "Cap at 30 if rock-solid",
      },
      {
        key: "hip_drop",
        label: "Clear hip drop or trunk lean?",
        type: "pass_fail",
        help: "Fail = fault seen (obvious hip drop or trunk lean)",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
      },
    ],
    playbookTags: "balance,hip,stability,single-leg,unilateral,fall-risk",
    sortOrder: 5,
  },
  {
    slug: "hip-hinge-screen",
    name: "Hip Hinge Pattern Screen",
    description:
      "Checks whether the client can load a hip hinge without early lumbar flexion or turning it into a squat.",
    purpose:
      "Foundation for RDLs, deadlifts, and swings. Poor hinge quality → regress load and drill pattern before heavy pulls.",
    instructions:
      "Optional: light dowel along the back (head, mid-back, sacrum contact). Soft knees, “push hips back,” trunk long.\n\nClient hinges until they feel a hamstring stretch or form breaks — not a full deadlift max.\n\nWatch for early lumbar rounding, knees shooting forward (squat pattern), or loss of brace.",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "quality",
        label: "Overall hinge quality",
        type: "select",
        options: ["good", "limited", "poor"],
        help: "Good = hips back, long spine, control at end range",
      },
      {
        key: "lumbar_flex",
        label: "Early lumbar flexion?",
        type: "pass_fail",
        help: "Fail if low back rounds early under light load",
      },
      {
        key: "knee_dominant",
        label: "Becomes squat / knee-dominant?",
        type: "pass_fail",
        help: "Fail if knees shoot forward and hips barely travel back",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Cue that helped (e.g. soft knees, hips to wall)",
      },
    ],
    playbookTags: "hinge,deadlift,posterior,technique,hip-hinge",
    sortOrder: 6,
  },
  {
    slug: "pushup-screen",
    name: "Push-up / Trunk Control Screen",
    description:
      "Horizontal push pattern plus anterior trunk integrity — floor or elevated hands.",
    purpose:
      "Shows whether the client can organise scapulae and keep a braced trunk under a simple push. Guides push-up regressions and core anti-extension work.",
    instructions:
      "Start from a plank on hands (or hands elevated on a box for beginners). Body long: head–hips–heels roughly aligned.\n\nLower with control and press up. Stop if form collapses.\n\nWatch for scapular winging, lumbar sag, hips piking, or incomplete lockout. Record overall quality and key faults.",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "quality",
        label: "Overall quality",
        type: "select",
        options: ["good", "limited", "poor"],
        help: "Good = full control, long plank line, solid lockout",
      },
      {
        key: "scap_wing",
        label: "Scapular winging?",
        type: "pass_fail",
        help: "Fail if medial border lifts clearly off the ribcage",
      },
      {
        key: "lumbar_sag",
        label: "Lumbar sag / loss of brace?",
        type: "pass_fail",
        help: "Fail if low back collapses or hips pike to compensate",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Elevation used, pain, rep quality",
      },
    ],
    playbookTags: "push,core,scapula,chest,bracing,plank",
    sortOrder: 7,
  },
  {
    slug: "plank-hold-screen",
    name: "Plank Hold Screen",
    description:
      "Trunk stability endurance — timed front plank with form and pain flags.",
    purpose:
      "Quick read on anterior trunk endurance and bracing under static load. Pain or early form collapse matters more than a max hold. Pairs with kinetic-chain / core bracing playbooks.",
    instructions:
      "Setup: front plank on forearms (or hands). Shoulders over elbows/hands, body long (head–hips–heels roughly one line). Soft ribs, neutral neck.\n\nHold with steady breathing. Stop the clock when form clearly breaks (hips sag or pike, hard shoulder shrug, violent shaking with breath-hold) or the client stops.\n\nRecord hold time (seconds), main form fault, and pain. Coaching screen only — not a clinical endurance test.",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "hold_sec",
        label: "Hold time (seconds)",
        type: "number",
        help: "Stop when form breaks or client stops; never chase pain",
      },
      {
        key: "form_notes",
        label: "Form notes",
        type: "text",
        help: "e.g. lumbar sag, hip pike, shoulder shrug, breath hold",
      },
      {
        key: "pain",
        label: "Pain during hold?",
        type: "pass_fail",
        help: "Fail/pain → regress (knees, shorter holds); refer if sharp or radiating",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Cue that helped, hands vs forearms, elevation used",
      },
    ],
    playbookTags:
      "plank,core,stability,endurance,trunk,kinetic-chain,ncsf",
    sortOrder: 8,
  },
  {
    slug: "wall-angel-screen",
    name: "Wall Angel Screen",
    description:
      "Thoracic extension and shoulder mobility against the wall — pass/fail with pain note.",
    purpose:
      "Flags limited thoracic/shoulder mobility that shows up as arms falling in OHS or poor overhead positions. Coaching standard only — not a diagnosis of upper-cross patterns.",
    instructions:
      "Stand with back to wall: light contact at head, upper back, and sacrum if possible. Feet a small step forward. Soft ribs, neutral pelvis.\n\nArms in goal-post (elbows ~90°), backs of hands toward the wall. Slide arms up and down slowly while keeping contact points.\n\nPass = useful range with wall contact and control, no pain. Fail = large gap from wall, hard rib flare, or pain. Note compensations only — one clear note beats over-documenting.",
    category: "movement",
    laterality: false,
    scoringType: "pass_fail",
    fields: [
      {
        key: "result",
        label: "Overall result",
        type: "pass_fail",
        help: "Pass = useful range with wall contact and control; fail = large gap, flare, or stop",
      },
      {
        key: "pain",
        label: "Pain during test?",
        type: "pass_fail",
        help: "Fail/pain → don’t force overhead; screen red flags",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Where contact is lost, rib flare, side bias, cue that helped",
      },
    ],
    playbookTags:
      "wall-angel,thoracic,shoulder,mobility,posture,upper-cross,ncsf",
    sortOrder: 9,
  },
  {
    slug: "single-leg-glute-bridge",
    name: "Single-Leg Glute Bridge Screen",
    description:
      "Glute activation and hip extension control — timed hold at top, left vs right.",
    purpose:
      "Checks whether each side can drive hip extension without low-back takeover or a clear side gap. Useful before heavier hinges/single-leg work or when lower-cross / APT patterns are in the brief.",
    instructions:
      "Supine, knees bent, feet flat. Bridge on two legs first to set height, then lift one foot (keep the other planted). Use the same setup each retest.\n\nHold the top 5–10 seconds per side with level pelvis and steady breathing.\n\nWatch for pelvis drop/rotate, hamstring-only drive, or lumbar extending instead of hips. Score hold time and quality per side; note pain.",
    category: "movement",
    laterality: true,
    scoringType: "multi",
    fields: [
      {
        key: "right_hold_sec",
        label: "Right — hold at top (seconds)",
        type: "number",
        side: "right",
        help: "Target 5–10s with level pelvis; stop if form breaks",
      },
      {
        key: "left_hold_sec",
        label: "Left — hold at top (seconds)",
        type: "number",
        side: "left",
        help: "Match standard used on the right",
      },
      {
        key: "right_quality",
        label: "Right — quality / control",
        type: "select",
        side: "right",
        options: ["good", "limited", "poor"],
        help: "Good = level pelvis, clear glute drive, quiet low back",
      },
      {
        key: "left_quality",
        label: "Left — quality / control",
        type: "select",
        side: "left",
        options: ["good", "limited", "poor"],
      },
      {
        key: "pain",
        label: "Pain during test?",
        type: "pass_fail",
        help: "Fail/pain → regress to double-leg; note location",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Laterality gap, hamstring dominant, cue that helped",
      },
    ],
    playbookTags:
      "glute,hip,bridge,activation,posterior,single-leg,lower-cross,ncsf",
    sortOrder: 10,
  },
  {
    slug: "seated-posture-screen",
    name: "Seated Posture Screen",
    description:
      "Desk-relevant seated snapshot — head, shoulders, and rib–pelvis stack.",
    purpose:
      "Pairs with standing posture for desk-dominant clients. Highlights forward head, rounded shoulders, and collapsed/flared trunk in the position they live in — observation only, not a medical posture diagnosis.",
    instructions:
      "Sit on a firm bench or chair as they normally would. Optionally re-check after one cue (“sit tall” / “ribs down”). View side and front.\n\nNote head vs trunk, shoulder rounding/elevation, and whether the ribcage is stacked over the pelvis (vs collapsed or flared).\n\nRecord major patterns only. Notes: cue response and how long good posture holds.",
    category: "movement",
    laterality: false,
    scoringType: "multi",
    fields: [
      {
        key: "head",
        label: "Head position (seated)",
        type: "select",
        options: ["neutral", "forward", "tilted"],
        help: "Forward head is common at screens; note if cueing changes it",
      },
      {
        key: "shoulders",
        label: "Shoulders (seated)",
        type: "select",
        options: ["level", "elevated_R", "elevated_L", "rounded"],
        help: "Rounded = protraction / upper-trap shrug bias",
      },
      {
        key: "trunk_stack",
        label: "Rib–pelvis stack",
        type: "select",
        options: ["stacked", "collapsed", "rib_flare"],
        help: "Collapsed = slump; rib flare = arch with ribs out",
      },
      {
        key: "notes",
        label: "Coach notes",
        type: "text",
        help: "Cue response, desk setup notes, how long good posture holds",
      },
    ],
    playbookTags:
      "posture,seated,desk,upper-cross,forward-head,ncsf",
    sortOrder: 11,
  },
];
