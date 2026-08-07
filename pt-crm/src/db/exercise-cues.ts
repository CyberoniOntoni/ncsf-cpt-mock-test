/**
 * Coach-facing cues & secondary muscles keyed by exercise slug.
 * Used by seed upsert so every catalog row has quality coaching text.
 */

export const EXERCISE_CUES: Record<string, string> = {
  // Mobility
  "thoracic-foam-roll":
    "Support head; open chest over roller; breathe into extension.",
  "wall-slides": "Low back and wrists on wall; slide without flaring ribs.",
  "band-pull-aparts":
    "Arms long; pull band to chest height; squeeze mid-back, not traps.",
  "face-pulls":
    "Elbows high; externally rotate at end; think 'face + thumbs back'.",
  "prone-yt": "Thumbs up; lift with lower traps; keep neck long.",
  "doorway-pec-stretch":
    "Elbow at ~90°; gentle lean; breathe — no aggressive force.",
  "open-book": "Knees stacked; follow the top hand with your eyes; exhale open.",
  "sleeper-stretch": "Pain-free only; no aggressive forcing.",
  "cat-cow": "Move segment by segment; match breath to motion.",
  "worlds-greatest-stretch":
    "Long lunge; rotate open; keep back heel intention down.",
  "90-90-hip-switch": "Tall torso; rotate through hips, not lumbar collapse.",
  "ankle-df-wall": "Heel stays down; drive knee toward wall.",
  "hip-flexor-kneeling":
    "Posterior pelvic tilt; glute on back leg; gentle forward shift.",
  "thread-the-needle": "Reach under and rotate; keep hips stacked.",
  "band-dislocates": "Wide grip first; soft elbows; no pinching in shoulders.",
  "pvc-pass-through": "Wide grip; pass overhead without rib flare.",
  "lacrosse-pec": "Find tender spot; small rolls; breathe — avoid numbness.",

  // Squat
  "goblet-squat": "Elbows inside knees; chest tall; heels rooted.",
  "back-squat": "Brace before unrack; sit between hips; drive mid-foot.",
  "front-squat": "Elbows high; upright torso; break at hips and knees together.",
  "box-squat": "Sit back to box with control; pause lightly; stand tall.",
  "split-squat": "Short stride; front heel down; torso tall; knee tracks toes.",
  "walking-lunge": "Long controlled steps; front knee tracks; soft landings.",
  "reverse-lunge": "Step back; front shin vertical; push through front mid-foot.",
  "lateral-lunge": "Sit into hip; trail leg straight; push back to center.",
  "step-up": "Drive through whole foot; lock hip at top; control the down.",
  "leg-press": "Full foot contact; avoid locking knees hard; control depth.",
  "hack-squat": "Back flat on pad; depth you own; no lumbar peel.",
  "leg-extension": "Control both ways; stop short of pain at the knee.",
  "bodyweight-squat": "Sit between hips; knees track toes; stand tall.",
  "jump-squat": "Soft landings; quiet feet; stop if landings get loud.",
  "smith-squat": "Feet slightly forward; brace; own depth on the path.",
  "wall-sit": "Back flat; thighs parallel if possible; breathe steadily.",
  "heel-elevated-squat": "Slight heel lift; upright torso; quads stay loaded.",
  "sumo-goblet-squat": "Wide stance; knees out; sit between hips.",
  "goblet-box-squat": "Touch box softly; keep weight mid-foot; stand without bounce.",

  // Hinge
  "rdl-db": "Soft knees; hips back; DBs close to legs; feel hamstrings.",
  "bb-rdl": "Bar stays on legs; hinge until hamstrings load; tall finish.",
  "trap-bar-deadlift": "Push floor away; neutral spine; lock hips and knees together.",
  "conventional-deadlift":
    "Wedge in; bar over mid-foot; push floor, then hips through.",
  "kb-swing": "Hinge, not squat; snap hips; arms relaxed.",
  "single-leg-rdl": "Hips square; soft knee; reach long; balance before load.",
  "hip-thrust": "Chin tucked; ribs down; full glute squeeze at top.",
  "glute-bridge": "Drive through heels; posterior tilt; pause at top.",
  "leg-curl": "Hips down; control the eccentric; no lumbar lift.",
  "nordic-curl": "Slow lower; catch with hands if needed; quality over depth.",
  "good-morning": "Light load; hinge with soft knees; stop before rounding.",
  "back-extension": "Hinge at hips; neutral neck; squeeze glutes to finish.",
  "sumo-deadlift": "Wide stance; upright torso; push floor apart.",
  "cable-pull-through": "Hips back to cable; snap glutes; arms stay long.",
  "kb-deadlift": "Hinge to KB; pack lats; stand tall without hyperextending.",

  // Horizontal push
  "push-up": "Body line rigid; chest to floor; lockout without shrug.",
  "knee-push-up": "Straight line shoulders to knees; full ROM you control.",
  "db-bench-press": "Scapulae set; DBs over elbows; soft lockout.",
  "bb-bench-press": "Leg drive light; bar path slight arc; control the touch.",
  "incline-db-press": "Slight incline; press up and slightly in; no bounce.",
  "push-up-deficit": "Full stretch with control; same rigid body line.",
  "machine-chest-press":
    "Shoulders down/back; full ROM without pinching; breathe out on press.",
  "cable-fly": "Slight elbow bend; hug a tree; ribs stay down.",
  "pec-deck": "Soft elbows; squeeze chest; avoid shrugging handles.",
  "dips": "Slight forward lean for chest; control depth; no shoulder pain.",
  "assisted-dip": "Same pattern as dips; use assistance you still challenge.",
  "trx-push-up": "Handles stable; body board-stiff; don't sag at hips.",
  "floor-press": "Upper arms touch floor; pause; press without bounce.",
  "incline-bb-press": "Scap set; controlled touch high chest; drive up.",
  "close-grip-push-up": "Elbows closer; triceps emphasis; body line solid.",

  // Vertical push
  "db-ohp": "Glutes on; ribs down; press without excessive lumbar arch.",
  "bb-ohp": "Brace hard; bar path near face; finish over mid-foot.",
  "landmine-press": "Stagger or kneel; press on the arc; finish tall.",
  "half-kneeling-ohp": "Back glute tight; no side lean; press clean.",
  "machine-shoulder-press": "Seat height so path clears face; full lockout soft.",
  "lateral-raise": "Lead with elbows; slight lean; stop at ~shoulder height.",
  "cable-lateral-raise": "Far arm tall; raise in scapular plane; control down.",
  "pike-push-up": "Hips high; head between arms; press floor away.",
  "arnold-press": "Rotate as you press; finish overhead without rib flare.",
  "seated-db-ohp": "Back supported if needed; feet plant; press straight.",

  // Horizontal pull
  "db-row": "Flat back; pull elbow to hip; pause squeeze; no torso twist.",
  "cable-row": "Sit tall; pull to lower ribs; control the return.",
  "machine-row": "Chest on pad if available; squeeze mid-back each rep.",
  "band-row": "Anchor solid; row elbows back; avoid shrugging.",
  "bb-bent-row": "Hinge solid; bar to lower ribs; no bounce off floor.",
  "chest-supported-row": "Let chest support; pure arm/scap pull.",
  "trx-row": "Body board; pull chest to handles; squeeze shoulder blades.",
  "meadows-row": "Staggered stance; pull to hip; control stretch.",
  "rear-delt-fly": "Soft elbows; think pinkies up; squeeze rear delts.",
  "seal-row": "Belly on bench; pure horizontal pull; no momentum.",
  "inverted-row": "Body straight; pull chest to bar; control lower.",

  // Vertical pull
  "pull-up": "Full hang to chin over; control down; no kipping unless programmed.",
  "lat-pulldown": "Lean slight; pull to upper chest; elbows down/back.",
  "assisted-pull-up": "Same as pull-up; use help that still challenges 6–10 reps.",
  "straight-arm-pulldown": "Arms long; push bar to thighs; feel lats, not arms.",
  "band-pulldown": "Kneel or stand tall; pull elbows to ribs; slow return.",
  "chin-up": "Supinated grip; same full ROM standards as pull-up.",
  "neutral-grip-pull-up": "Palms facing; drive elbows down; soft landing at bottom.",
  "single-arm-lat-pulldown": "Square hips; pull elbow to hip; no lean cheat.",

  // Arms
  "db-curl": "Elbows pinned; no swing; squeeze at top.",
  "hammer-curl": "Neutral grip; control both directions.",
  "ez-curl": "Comfortable grip width; elbows still; no lean back.",
  "triceps-pushdown": "Elbows glued to sides; full extension; soft return.",
  "oh-triceps-ext": "Elbows point up; stretch under control; no lumbar arch.",
  "skull-crusher": "Elbows fixed; lower with control; press without flaring wildly.",
  "preacher-curl": "Upper arms on pad; full stretch; no shoulder shrug.",
  "cable-curl": "Step back slightly; constant tension; finish without swing.",

  // Core / carry
  "dead-bug": "Low back flat; opposite arm/leg; exhale as limbs extend.",
  "plank": "Ribs down; glutes light on; long neck; no sag or pike.",
  "side-plank": "Feet stacked or staggered; hips high; breathe.",
  "bird-dog": "Square hips; reach long; no lumbar twist.",
  "farmer-carry": "Tall walk; pack shoulders; even steps; grip hard.",
  "suitcase-carry": "Resist side bend; tall posture; short steps.",
  "overhead-carry": "Lock arm; ribs down; walk smooth.",
  "ab-wheel-rollout": "Posterior tilt; roll only as far as you own the brace.",
  "cable-pallof": "Press out and hold; resist rotation; ribs stacked.",
  "hanging-knee-raise": "Dead hang control; tilt pelvis; no swing.",
  "cable-crunch": "Crunch ribs to pelvis; not yanking with arms.",
  "med-ball-slam": "Full hip extension; slam hard; catch or control rebound safely.",
  "russian-twist": "Chest tall; rotate torso, not just arms; control tempo.",
  "dead-bug-press": "Press while keeping low back glued; exhale on reach.",
  "copenhagen-plank": "Top leg on bench; hips high; short holds quality first.",
  "hollow-hold": "Low back pressed down; arms by ears or at sides; breathe.",
  "cable-woodchop": "Rotate through hips/torso; finish tall; control return.",
  "rack-carry": "Elbows under; torso solid; walk without bouncing the load.",
  "front-rack-carry": "Elbows high; breathe into belly; short proud steps.",

  // Hips / calves
  "hip-abduction-machine": "Smooth tempo; feel outer hip; no momentum.",
  "hip-adduction-machine": "Control both ways; avoid jamming end range.",
  "band-side-walk": "Athletic stance; lead with hip, not ankle collapse.",
  "clamshell": "Hips stacked; open top knee without rolling back.",
  "calf-raise": "Full stretch to full squeeze; pause at top.",
  "seated-calf-raise": "Soleus focus; slow lower; full ROM.",

  // Cardio / conditioning
  "bike-intervals": "Smooth cadence; hard efforts clean; easy spins recover.",
  "rower-intervals": "Legs-then-body-then-arms; reverse on return.",
  "ski-erg-intervals": "Hinge and pull long; reset tall each stroke.",
  "treadmill-incline-walk": "Slight forward lean from ankles; quick light steps.",
  "jump-rope": "Quiet landings; wrists turn the rope; relaxed shoulders.",
  "sled-push": "45° lean; drive through whole foot; short hard steps.",
  "sled-pull": "Long arms or harness; walk tall; steady tension.",
  "battle-ropes": "Athletic stance; whip from shoulders; even waves.",
  "stair-climber": "Upright torso; full foot; light hand assist only.",
  "elliptical": "Quiet feet; upright; use arms without shrugging.",
  "box-step-overs": "Soft landings; alternate lead legs; stay balanced.",
  "assault-bike-intervals": "Seated or standing; push/pull smooth; recover easy.",
  "curved-runner": "Short strides; upright; self-powered — don't overstride.",

  // Plyometric / power
  "box-jump": "Soft quiet landing; stand tall on box; step down.",
  "broad-jump": "Swing arms; stick the landing; reset every rep if needed.",
  "pogo-hops": "Stiff ankles; minimal knee bend; rhythmic and quiet.",
  "med-ball-chest-pass": "Step and pass; finish long; catch safely or use wall.",
  "kb-snatch": "Hinge load; punch through at top; soft catch overhead.",

  // Extra common-pattern cues (programming / special-pop friendly)
  "sandbag-clean": "Hinge to bag; explode to shoulder; catch soft; switch sides.",
  "swiss-bar-bench": "Set scapulae; neutral-ish grip; press smooth; soft lockout.",
  "trx-ytw": "Lean under control; raise Y then T then W; long neck, no shrug.",
  "sit-to-stand": "Feet under knees; lean slightly; stand tall without plopping; soft sit.",
  "box-squat-to-stand": "Touch box lightly; pause; drive mid-foot; exhale on stand.",
  "seated-row": "Tall chest; pull handles to ribs; squeeze mid-back; no torso yank.",
  "t-bar-row": "Hinge solid; pull to lower chest/ribs; control stretch; no bounce.",
  "cable-crossover": "Soft elbows; hug-arc path; ribs down; squeeze without shrugging.",
  "glute-ham-raise": "Hips long; lower with hamstring control; pull heels to finish tall.",
};

export const EXERCISE_SECONDARY: Record<string, string> = {
  "goblet-squat": "core, upper back",
  "back-squat": "core, erectors",
  "front-squat": "upper back, core",
  "split-squat": "core, adductors",
  "walking-lunge": "core, calves",
  "rdl-db": "erectors, grip",
  "bb-rdl": "erectors, grip",
  "conventional-deadlift": "lats, grip, traps",
  "trap-bar-deadlift": "quads, traps, grip",
  "hip-thrust": "hamstrings, core",
  "push-up": "core, serratus",
  "db-bench-press": "anterior delts, core",
  "bb-bench-press": "anterior delts, triceps",
  "dips": "core, anterior delts",
  "db-ohp": "core, upper traps",
  "bb-ohp": "core, triceps",
  "db-row": "biceps, rear delts",
  "cable-row": "biceps, rear delts",
  "pull-up": "core, rear delts",
  "lat-pulldown": "biceps, rear delts",
  "farmer-carry": "core, upper back",
  "suitcase-carry": "QL, grip",
  "plank": "glutes, shoulders",
  "dead-bug": "hip flexors (controlled)",
  "kb-swing": "lats, grip",
  "face-pulls": "mid traps, rhomboids",
  "band-pull-aparts": "mid traps",
};

export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  "goblet-squat":
    "Front-loaded squat that teaches upright posture — great teaching and hypertrophy tool.",
  "back-squat":
    "Barbell compound for lower-body strength; use rack and progressive loading.",
  "rdl-db":
    "Hip hinge emphasizing hamstrings and glutes with dumbbells — scalable and joint-friendly.",
  "conventional-deadlift":
    "Full pull from floor; advanced hinge pattern — prioritize setup and bracing.",
  "push-up":
    "Bodyweight horizontal press; regress with knees/elevated hands, progress with deficit/tempo.",
  "db-bench-press":
    "Unilateral-friendly chest press with natural wrist path vs barbell.",
  "face-pulls":
    "Upper-back and external rotation work — posture and shoulder health staple.",
  "pull-up":
    "Vertical pull strength standard; use assistance or eccentrics as needed.",
  "farmer-carry":
    "Loaded locomotion for grip, posture, and conditioning with low technical cost.",
  "dead-bug":
    "Anti-extension core drill teaching limb motion without lumbar extension.",
  "kb-swing":
    "Ballistic hinge for power and conditioning; Russian style to chest/eye line.",
  "hip-thrust":
    "Horizontal hip extension with high glute bias — load progressively.",
  "cable-pallof":
    "Anti-rotation core; press and hold against cable or band.",
  "box-jump":
    "Low-complexity power drill; emphasize soft landings and step-downs.",
  "lat-pulldown":
    "Machine vertical pull when pull-ups are limited or for volume work.",
};
