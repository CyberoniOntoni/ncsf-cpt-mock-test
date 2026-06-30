"""Parse quiz.txt into web questions.js"""
import json
import os
import re
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = str(ROOT / "quiz.txt")
OUTPUT = str(ROOT / "web" / "questions.js")
MANUAL_REFS = str(ROOT / "manual_references.json")

# Detailed explanations keyed by correct answer text (from quiz.txt)
EXPLANATIONS = {
    "vascular compliance": "Vascular compliance is the ability of blood vessels to expand and contract, accommodating pressure fluctuations and maintaining cardiovascular health.",
    "quitting smoking": "Smoking cessation has the greatest impact on overall health, reducing cardiovascular disease, cancer, and respiratory risk more than modest weight or BP changes alone.",
    "atherosclerosis": "Hypertension damages arterial endothelium, promoting plaque buildup (atherosclerosis) that narrows and blocks arteries.",
    "130/84 mmHg": "Regular aerobic exercise typically lowers BP by ~10 mmHg; from 141/92, a realistic reduction to ~130/84 is evidence-based.",
    "visceral": "Visceral (android) fat around organs is strongly linked to cardiovascular disease and metabolic syndrome.",
    "cardiovascular training": "VO2max correlates with disease risk and lifespan; aerobic/cardiovascular training most directly improves it.",
    "sugar increases insulin which inhibits lipolysis": "High sugar spikes insulin, promoting fat storage and inhibiting lipolysis (fat breakdown), increasing obesity risk.",
    "twice": "NCSF guidelines recommend minimum twice-weekly total-body resistance training for general populations.",
    "2,000": "Fitness-level protection requires ~2,000 kcal/week of physical activity vs ~1,000 for basic health maintenance.",
    "muscular power": "Power (strength × speed) is key for active aging and functional independence.",
    "HDL will increase": "Moderate aerobic exercise typically raises HDL (good) cholesterol.",
    "adding daily physical activity": "For overweight inactive individuals, increasing daily activity has the greatest health impact.",
    "no joint movement": "Tricep pushdowns isolate elbow extension; the shoulder should remain stable with no movement.",
    "rectus femoris": "Rectus femoris crosses hip and knee, acting on both joints (dual-action quadriceps muscle).",
    "lordotic": "Cervical and lumbar spines have lordotic (anterior convex) curvatures.",
    "levator scapulae": "Levator scapulae is not a rotator cuff muscle; the cuff is supraspinatus, infraspinatus, teres minor, subscapularis.",
    "rectus abdominis": "Rectus abdominis initiates the first ~30° of trunk flexion during crunches.",
    "gluteus maximus": "In deep single-leg squat positions, gluteus maximus is the primary hip extensor.",
    "hamstrings": "Romanian deadlift emphasizes hip hinge with hamstrings as prime movers.",
    "eccentrically": "During descent of a curl, biceps lengthen under tension (eccentric contraction).",
    "deltoid": "Dumbbell side raises primarily target the deltoid (middle fibers) for shoulder abduction.",
    "concentric contraction of the rhomboids": "Seated row retraction is driven by concentric rhomboid contraction.",
    "lumbar and sacrum": "Most lifting injuries occur at the lumbosacral junction (L4-S1 region).",
    "Proprioception": "Proprioception is spatial/body position awareness improved through neural adaptations.",
    "30°": "Supraspinatus initiates abduction; deltoid becomes primary abductor after ~30°.",
    "sagittal": "Forward lunge with press occurs primarily in the sagittal plane.",
    "All of the above": "Tensor fascia latae, quadratus lumborum, and supraspinatus all produce frontal plane movements.",
    "take a broader step and push the back leg downward": "Wider step prevents excessive knee travel past toes during forward lunge.",
    "moving backward instead of forward": "Reverse lunges increase balance and proprioception demands vs forward lunges.",
    "quadriceps": "Front squat is knee-dominant with quadriceps as primary movers.",
    "alternating jump lunges": "Plyometric jump lunges develop hip power through explosive stretch-shortening.",
    "Hands at the waist": "Chin-up spotting is performed at the waist to assist without interfering with movement.",
    "All the above": "Deadlift back rounding can result from excessive weight, poor hip-knee sequencing, or bar position.",
    "Functional training": "Functional training uses integrated movement patterns for real-world performance.",
    "Supine leg press using a Smith machine": "Smith machine leg press in supine position is an inappropriate/unstable use of equipment per NCSF exam key.",
    "All the above": "Osteoarthritis clients should avoid high-impact activities: box jumps, plyometrics, and running.",
    "fluid loss increases": "Heat/humidity increases sweat and fluid loss, impairing thermoregulation and performance.",
    "the back should be flat and knees slightly flexed": "Proper RDL uses slight knee bend and neutral spine vs stiff-legged excessive hip flexion.",
    "increase pulling movements such as back flies and rows": "Kyphosis is addressed by strengthening scapular retractors and upper back with pulling movements, not overhead pressing.",
    "Latissimus dorsi": "Latissimus dorsi performs shoulder adduction in the frontal plane.",
    "Spot at the bar": "Lat pulldown spotting is at the bar to assist if needed.",
    "lordotic curve": "Proper bent-over row maintains natural lumbar lordosis (neutral spine).",
    "standing calf raise": "Standing calf raises with straight knees target gastrocnemius.",
    "All the above": "Free weights, machines, and power training all support bone density when appropriately loaded.",
    "reduce the step height so his knee angle is lower": "Lowering step height reduces forward lean and allows full leg extension.",
    "Lateral lunge": "Lateral lunge stretches hip adductors in the frontal plane.",
    "Push-up": "Push-ups cause horizontal adduction of the shoulder (transverse plane pressing).",
    "the lateral aspects of their rib cage": "Squat spotting is at the lifter's rib cage/lateral torso.",
    "chest dips to push-ups": "Regression moves from harder (dips) to easier (push-ups) exercise.",
    "Alternate": "Heavy bench press spotting uses alternate (mixed) grip on the bar.",
    "Spot the forearms": "Dumbbell fly spotting is at the forearms near the dumbbells.",
    "biceps brachii": "Triceps pushdown uses reciprocal inhibition—the agonist triceps inhibits antagonist biceps.",
    "walking lunge": "Walking lunges dynamically stretch hip flexors of the rear leg.",
    "to increase muscle fiber recruitment": "Drop sets extend sets past failure to recruit additional motor units.",
    "within 48 hours following exercise": "DOMS typically peaks 24-48 hours post-exercise.",
    "low rate of caloric expenditure": "Low-intensity cardio burns fewer total calories, limiting fat loss for already-active clients.",
    "improved balance using unilateral training": "Unilateral training challenges balance and proprioception effectively.",
    "90 seconds": "Phosphagen (ATP-PC) stores need ~2-3 minutes; 90 seconds is minimum for broad jump retesting.",
    "heart rate and peripheral resistance": "Blood pressure = cardiac output × peripheral resistance; also expressed as HR × resistance factors.",
    "improvements in the nervous system": "Early strength gains are primarily neural (motor unit recruitment, coordination).",
    "glucose": "Anaerobic glycolysis breaks down glucose/glycogen, producing lactate.",
    "lactic acid": "Rising blood lactate stimulates increased ventilation (respiratory rate).",
    "glycogen": "Glycogen (carbohydrate) fuels both aerobic and anaerobic ATP production.",
    "static stretching": "Pre-exercise static stretching can acutely reduce power output.",
    "isometric contractions": "Isometric contractions stabilize segments against oncoming forces.",
    "increased stroke volume": "Training increases stroke volume, lowering resting heart rate at same cardiac output.",
    "properly screen him for exercise": "Screening (PAR-Q/HSQ) must precede movement assessments.",
    "select low-impact activities during aerobic exercise to minimize the risk of injury": "Obese clients need low-impact aerobic exercise to reduce joint stress.",
    "placing your index and middle finger along the thumb side of the wrist": "Radial pulse is palpated with index/middle fingers on thumb side of wrist.",
    "leg press with heavy resistance": "Heavy resistance and Valsalva risk dangerous BP spikes in hypertensive clients on medication.",
    "agree to the assumed risks of their exercise participation": "Informed consent documents acknowledgment of exercise risks.",
    "obtain additional information about the injury to guide your decision": "Shoulder surgery history requires gathering details before programming—not automatic medical clearance unless indicated.",
    "his heart rate and cardiac output will be decreased during exercise": "Beta blockers blunt heart rate and cardiac output responses during exercise.",
    "Ischemia": "Ischemia is insufficient oxygen supply to tissues.",
    "anaerobic endurance": "High-rep (>15) tests assess local muscular endurance (anaerobic endurance capacity).",
    "stop performing the exercise, document the issue, and closely monitor the joint rest of the session": "Pain during exercise warrants stopping that exercise, documenting, and monitoring—not continuing.",
    "nutritional intake": "HSQ covers medications, injuries, and lifestyle—not detailed nutritional intake.",
    "diagnosing an injury and writing a rehab program targeting specific improvements": "Trainers cannot diagnose injuries or prescribe rehabilitation—that violates scope of practice.",
    "RPE scale": "Rating of Perceived Exertion (RPE/Borg) assesses exercise intensity perception.",
    "One mile run test": "For youth, submaximal/endurance tests like mile run are appropriate vs max strength testing.",
    "Recommend he should have a medical professional analyze the injury and document the incident": "Shoulder pain during pressing requires medical evaluation and incident documentation.",
    "refer him to his physician for a medical review": "Rising BP despite training warrants physician referral.",
    "periodic renewal of a certification through continued education": "Legitimate credentials require continuing education and periodic renewal.",
    "resting heart rate of 110 bpm": "Resting HR >100 bpm (tachycardia) warrants medical referral before exercise.",
    "Practicing the test beforehand": "Familiarization improves test validity (not learning effect confounding results).",
    "6-8 weeks": "Strength re-evaluations typically occur every 6-8 weeks for meaningful adaptations.",
    "The statutes of liability limitations can carry out that long": "Client records kept 3+ years align with liability statute of limitations.",
    "weight loss of 5 lbs.": "5 lb weight loss is a realistic short-term goal; 25% bench increase or 5% BF drop are less realistic short-term.",
    "Potassium": "Potassium counterbalances sodium and helps manage blood pressure in hypertensive individuals.",
    "Protein": "Protein provides least energy during exercise (~4 kcal/g, sparingly used for fuel).",
    "20-35 grams": "Dietary fiber recommendation is 20-35 g/day for adults.",
    "10%": "Saturated fat should be limited to ~10% of total calories.",
    "63 calories": "Fat provides 9 kcal/g: 7g × 9 = 63 calories.",
    "Vitamin E is a fat-soluble vitamin and excess supplemental consumption beyond what is attained in a healthy diet could increase health risks": "Vitamin E is fat-soluble; excess supplementation can cause toxicity unlike water-soluble vitamins.",
    "1.6-2.0 g/kg of body weight": "Hypertrophy programs recommend ~1.6-2.0 g/kg protein.",
    "Vitamin E": "Vitamin E is a fat-soluble antioxidant.",
    "Vitamin C": "Vitamin C is water-soluble; A, D, K are fat-soluble.",
    "carbohydrates": "Carbohydrates are the primary fuel for most exercise intensities.",
    "trans fatty acids": "Trans fats raise LDL and lower HDL.",
    "all claims made by a supplement company must be backed by clinical research": "FALSE statement—supplement claims are NOT required to be clinically proven; FDA doesn't pre-approve.",
    "Males - 30%; Females - 40%": "Morbid obesity thresholds: >30% BF males, >40% females require medical referral.",
    "girth measurements": "Muscular individuals may have large circumferences unrelated to fat—girth less accurate for them.",
    "Light weight (30-50% 1RM) total-body movements performed in circuits": "Light circuit training produces least hypertrophy vs heavy compound lifting.",
    "bioelectrical impedance": "BIA depends on hydration; dehydration significantly skews results.",
    "amenorrhea": "Excessive leanness in females can cause amenorrhea (menstrual dysfunction).",
    "½ pound": "With 2 sessions/week at 250-300 kcal, ~0.5 lb/week loss is realistic.",
    "All the above are indications": "Male obesity: BMI ≥30, BF >25%, or waist >40 inches.",
    "Resting Metabolic Rate": "Daily caloric needs start with RMR plus activity factor.",
    "120-200": "Lean mass gain requires modest surplus of ~120-200 kcal/day above maintenance.",
    "they have limited accuracy for individuals with large amounts of muscle mass": "Girth measurements don't distinguish muscle from fat in very muscular individuals.",
    "High-volume resistance training": "Resistance training builds muscle, increasing metabolic rate and improving body composition.",
    "One-arm row": "Rows strengthen scapular retractors, correcting forward shoulder posture.",
    "subscapularis": "Doorway/subscapularis stretch targets internal rotators and anterior shoulder.",
    "excess post-exercise oxygen consumption (EPOC)": "EPOC elevates metabolism after intense anaerobic training.",
    "75% 1RM": "~75% 1RM typically allows ~10 reps to volitional fatigue for bench press.",
    "bench press": "Large compound lifts (bench press) performed first when intensity is equal across exercises.",
    "bench press and high-speed medicine ball chest passes": "Contrast sets pair heavy strength with explosive plyometric movement.",
    "50-60% heart rate reserve": "Deconditioned older clients start at low intensity: 50-60% HRR.",
    "training intensity": "When frequency decreases, increase intensity to maintain strength/power.",
    "153 beats/min": "Karvonen: THR = ((220-38)-85) × 0.70 + 85 = 153 bpm.",
    "multiple exercises completed sequentially with transitional rest periods": "Circuit training = sequential exercises with brief transitions.",
    "is a potential negative result of high-volume aerobic training": "Excessive endurance training can reduce fast-twitch fiber size.",
    "significant increase in diastolic blood pressure": "Rising diastolic BP during aerobic exercise is concerning; requires monitoring.",
    "5": "Approximately 5 kcal per liter of O2 consumed (metabolic equivalent basis).",
    "machines are effective because they isolate the target muscle to maximize time-under-tension and motor unit recruitment": "Machine hypertrophy rationale: isolation and time-under-tension (NCSF exam perspective).",
    "a trained individual looking to maximize strength gains in a compound lift": "Pyramid loading suits trained lifters pursuing maximal strength in compounds.",
    "(a-v)O2 difference": "Arteriovenous O2 difference measures oxygen extraction from blood.",
    "increased heart rate responses": "At altitude, reduced O2 saturation triggers compensatory increased heart rate.",
    "5-7": "Visible hypertrophy typically requires 5-7+ weeks of consistent training.",
    "2 minutes": "Heavy strength (5RM) requires ~2-5 min rest for phosphagen recovery.",
    "2-5%": "Progressive overload increases of 2-5% are standard to avoid overtraining.",
    "Sit-and-reach box": "Sit-and-reach is the standard field flexibility test (goniometer measures joint angles).",
    "Side loaded with dumbbells": "Beginners start Bulgarian split squat with dumbbells at sides before bar loading.",
    "Open kinetic chain exercise": "Bench-supported exercises (bench press) are open chain—the body is stabilized externally.",
    "Romanian deadlift": "RDL emphasizes eccentric hamstring lengthening, improving hamstring ROM.",
    "cool down": "Cool-down returns body toward homeostasis after exercise.",
    "Overload": "Overload principle requires stress above current adaptation level.",
    "Quadriceps": "Leg press primarily targets quadriceps knee extension.",
    "latissimus dorsi": "Failed shoulder flexion assessment indicates tight lats restricting overhead mobility.",
    "70-85% 1RM": "Hypertrophy training typically uses 70-85% 1RM.",
    "steady-state training": "Maintaining stable HR for duration = steady-state aerobic training.",
    "it reduces force and power in skeletal muscle": "Sarcopenia is age-related loss of muscle mass, force, and power.",
    "12-14": "Borg RPE 12-14 corresponds to moderate intensity (~60-80% HRR).",
    "resistance": "Type II diabetes benefits significantly from resistance training improving insulin sensitivity.",
    "Select another assessment of strength they can complete safely": "If push-up/pull-up fails, substitute an appropriate alternative strength test.",
    "Body fat tests": "Body composition/body fat assessment is common risk stratification tool.",
    "reduced ability to regulate body temperature": "Children have immature thermoregulation requiring more rest and hydration.",
    "focus on full range movement and motor learning": "Children should emphasize movement quality and motor learning over max strength.",
    "spinal extension": "Older adults commonly lose spinal extension mobility.",
    "muscular fitness": "After 65, maintaining muscular fitness is critical for independence vs peak VO2max.",
}

# Question-specific explanations where the same answer text appears in different contexts
QUESTION_EXPLANATIONS = {
    "which of the following exercises represents an inappropriate use of training equipment": (
        "Supine leg press on a Smith machine is considered inappropriate because the fixed bar path "
        "combined with supine leg pressing creates unsafe biomechanics. Jump squats on a Smith machine "
        "are also inappropriate, but per this exam key the supine leg press is the designated answer."
    ),
    "which of the following muscles cause movement in the frontal plane": (
        "All listed muscles produce frontal plane actions: the tensor fascia latae abducts the hip, "
        "quadratus lumborum laterally flexes the trunk, and supraspinatus initiates shoulder abduction "
        "in the frontal plane."
    ),
    "what is the most common error in the deadlift exercise that causes the back to round": (
        "All factors contribute to deadlift rounding: excessive load, extending knees before hips "
        "(poor sequencing), and starting too far from the bar all disrupt proper hip-hinge mechanics."
    ),
    "what should be avoided for a 47 year-old client that has osteoarthritis in their knee": (
        "Clients with knee osteoarthritis should avoid all high-impact activities listed: box jumps, "
        "plyometrics, and running all increase joint stress and pain risk."
    ),
    "what type of training reduces the risk of osteoporosis": (
        "All listed modalities can improve bone density when appropriately loaded: machine resistance, "
        "free-weight compounds, and power training all provide osteogenic stimulus."
    ),
    "when is a male considered obese": (
        "Male obesity can be identified by any of these criteria: BMI ≥30, body fat >25%, or waist "
        "circumference >40 inches (102 cm)—all are valid clinical indicators."
    ),
}

MIN_EXPLANATION_LEN = 160

# Concise definitions for common distractors (especially video-bank pool options)
TERM_DEFINITIONS = {
    "angiogenesis": "formation of new blood vessels",
    "atherosclerosis": "arterial plaque buildup and narrowing",
    "hyperlipidemia": "elevated blood lipids — a risk factor, not the name for arterial plaque blockage",
    "hyperglycemia": "elevated blood glucose — unrelated to arterial plaque formation from hypertension",
    "dyslipidemia": "abnormal blood lipid profile — describes lipid levels, not plaque buildup inside artery walls",
    "hemoglobin stability": "not a recognized cardiovascular physiology term",
    "cardiovascular sequencing": "not the term for vessel elasticity",
    "subcutaneous": "fat stored under the skin (not visceral/organ fat)",
    "retro-peritoneal": "behind the abdominal cavity — not a fat distribution type tested here",
    "intramuscular": "within muscle tissue — not a body fat classification",
    "vldl will increase": "VLDL carries triglycerides; aerobic training typically raises HDL, not VLDL",
    "ldl will increase": "aerobic exercise generally improves lipids; LDL typically decreases, not increases",
    "aerobic exercise does not affect circulating cholesterol": "false — regular aerobic training improves blood lipid profiles",
    "biceps brachii": "elbow flexor — not the prime mover for this movement",
    "triceps brachii": "elbow extensor — not the primary muscle tested here",
    "pectoralis major": "horizontal adduction/flexion muscle — not correct for this action",
    "gastrocnemius": "plantar flexor at the ankle — not the muscle asked about",
    "soleus": "deep calf plantar flexor — not the answer for this question",
    "hamstrings": "posterior thigh knee flexors/hip extensors — not the prime mover here",
    "rectus abdominis": "trunk flexor — not the stabilizer or mover required",
    "trapezius": "scapular elevation/retraction — not the target muscle here",
    "infraspinatus": "rotator cuff external rotator — not the muscle for this action",
    "supraspinatus": "initiates shoulder abduction — not the primary mover here",
    "subscapularis": "rotator cuff internal rotator — not correct for this question",
    "teres minor": "rotator cuff external rotator — not the answer here",
    "latissimus dorsi": "shoulder adductor/extensor — not the prime mover for this exercise",
    "iliopsoas": "hip flexor — not the muscle responsible for this movement",
    "quadriceps": "knee extensors — not the primary muscle for this specific action",
    "hip flexors": "anterior hip muscles — not the answer for this movement",
    "gluteus maximus only": "hip extensor only — the question requires a different muscle group",
    "peroxisome": "organelle for fatty acid oxidation/detox — not the site of aerobic ATP production",
    "endoplasmic reticulum": "protein/lipid synthesis organelle — not where aerobic metabolism occurs",
    "lysosome": "digestive enzyme organelle — not involved in aerobic energy production",
    "mitochondria": "aerobic ATP production site — but not the answer to this specific question",
    "sagittal": "forward/backward movement plane",
    "frontal": "side-to-side movement plane",
    "transverse": "rotational movement plane",
    "shoulder flexion": "raising the arm forward — not the primary movement here",
    "shoulder extension": "moving the arm backward — not the movement tested",
    "shoulder abduction": "raising the arm to the side — not the primary action here",
    "shoulder external rotation": "outward rotation of the humerus — not the movement asked about",
    "a concentric contraction": "muscle shortening — not the contraction type required here",
    "static stretching program": "flexibility-only training — not the answer for this question",
    "aerobic training only": "cardio-only approach — insufficient or incorrect for this scenario",
    "plyometric training only": "explosive training only — not appropriate as the sole answer here",
    "circuit training with no progression": "lack of progression undermines results — not the correct principle",
    "increased training volume without proper progression": "excess volume without progression is poor programming — unrelated to this question",
    "reduced exercise frequency with caloric surplus": "reducing activity while eating more promotes weight gain — not relevant here",
    "static stretching as the sole training method": "stretching alone does not build strength, power, or cardiovascular fitness",
    "high-intensity training without medical clearance": "unsafe for unscreened clients — not the concept being tested",
    "alternative approach involving reduced intensity and increased rest": "generic recovery strategy — not the specific answer required",
    "decreased cardiac output": "lower blood pumped per minute — opposite of typical training adaptations",
    "decreased stroke volume": "less blood per beat — training increases, not decreases, stroke volume",
    "increased heart rate only": "HR alone does not explain the adaptation — stroke volume is the key factor",
    "cardiac output": "blood volume pumped per minute (HR × SV) — not the specific term asked for",
    "cortisol": "stress hormone — not the anabolic hormone released during heavy lifting",
    "insulin": "glucose-storage hormone — not the answer for this hormonal response",
    "glucagon": "raises blood glucose — not the hormone described in this question",
    "epinephrine": "fight-or-flight catecholamine — not the primary anabolic hormone here",
    "growth hormone": "anabolic hormone — but not the specific one asked about in this question",
    "estrogen": "sex hormone — not the hormone primarily elevated by heavy resistance training",
    "vitamin a": "fat-soluble vision vitamin — not the vitamin tested here",
    "vitamin d": "bone health vitamin — not the correct answer for this question",
    "vitamin k": "clotting vitamin — not the water/fat-soluble classification asked about",
    "iron": "mineral for oxygen transport — not the nutrient tested here",
    "calcium": "bone/mineral electrolyte — not the answer for this question",
    "magnesium": "mineral for muscle/nerve function — not the nutrient asked about",
    "zinc": "trace mineral — not the answer tested here",
    "flexibility": "joint ROM capacity — not the performance quality asked about",
    "muscular strength": "max force production — not the specific adaptation tested",
    "muscular endurance": "sustained submaximal contractions — not the answer here",
    "muscular hypertrophy": "muscle size increase — a chronic adaptation, not an acute workout effect",
    "resistance training": "strength training — not the specific intervention required here",
    "flexibility training": "stretching-focused work — not the most effective intervention for this client",
    "functional training": "movement-based training — not the answer for this specific question",
    "kyphotic": "thoracic spine curves posteriorly — lumbar/cervical use lordosis, not kyphosis",
    "lordotic": "inward/anterior convex curve — thoracic spine is kyphotic, not lordotic",
    "femur": "thigh bone — not the weight-bearing lower-leg bone (tibia)",
    "humerus": "upper arm bone — not the bone asked about",
    "fibula": "non-weight-bearing lower-leg bone — the tibia bears body weight",
    "cervical vertebrae": "neck vertebrae — not the spinal region with most lifting injuries",
    "sacrum": "fused pelvic vertebrae — lumbar (L4-S1) is the most injury-prone lifting region",
    "thoracic region": "mid-back — not where the hyoid bone is located (anterior neck)",
    "plantaris": "small calf muscle — not a biarticular leg muscle crossing hip and knee",
    "amino acids": "protein building blocks — not the sole anaerobic fuel source (glucose/glycogen)",
    "all of the above": "not all listed options are correct — only the keyed answer applies",
    "all the above": "not every option listed is correct for this question",
    "lordotic curve": "inward/anterior convex curve of cervical or lumbar spine — not thoracic",
    "kyphotic curve": "outward curve — thoracic spine is kyphotic; lumbar is lordotic",
    "scoliotic curve": "lateral spinal deviation — not a normal sagittal-plane curvature",
    "lateral curve": "not a standard term for normal thoracic spine curvature",
    "neutral curve": "the spine has specific regional curves — thoracic is kyphotic",
    "medial curve": "not a recognized spinal curvature term",
    "quadriceps": "anterior thigh knee extensors — tightness here does not cause posterior pelvic tilt",
    "quadratus lumborum": "lateral trunk flexor — not the tight muscle causing posterior pelvic tilt",
    "hip flexors": "anterior hip muscles — tight hip flexors cause anterior, not posterior, pelvic tilt",
    "pull-up": "vertical pulling exercise — does not primarily elevate the scapula",
    "military press": "overhead pressing — not the exercise for scapular elevation (shrug)",
    "seated row": "horizontal pulling — retracts scapula rather than elevating it",
    "golgi tendon organs": "proprioceptors detecting tendon tension — not where aerobic metabolism occurs",
    "sarcomeres": "contractile units within muscle fibers — not organelles for aerobic metabolism",
    "muscle spindles": "stretch receptors — not the site of aerobic ATP production",
    "aldosterone": "adrenal mineralocorticoid regulating sodium — not elevated by heavy resistance training",
    "estradiol": "estrogen hormone — not the primary anabolic hormone from heavy lifting",
    "insulin": "glucose-regulating hormone — not released in higher concentrations from heavy resistance training",
    "glucagon": "raises blood glucose — opposes insulin, not an anabolic response to lifting",
    "partially flexed": "gastrocnemius stretch requires a fully extended knee, not partial flexion",
    "fully flexed": "knee flexion slackens the gastrocnemius — full extension is needed for calf stretch",
    "anterior tibialis": "dorsiflexor — not the muscle stretched in a gastrocnemius stretch",
    "rectus femoris": "biarticular quad — not the primary muscle stretched in this calf position",
    "adductor magnus": "hip adductor — not stretched in a gastrocnemius/calf stretch position",
    "thomas test": "hip flexor flexibility test — not contraindicated for unknown lower back pain",
    "apley back scratch test": "shoulder mobility test — not contraindicated when back pain cause is unknown",
    "single straight-leg hip flexion test": "hamstring/hip flexibility test — not the contraindicated assessment here",
    "android obesity": "central/abdominal fat distribution linked to cardiovascular disease",
    "gynoid obesity": "hip/thigh fat distribution — less strongly linked to CVD than android obesity",
    "proprioception": "body position sense via proprioceptors — the correct answer for this question",
    "ballistic movements": "explosive movements — not the same as proprioceptive input",
    "kinetic chain": "linked segment movement concept — not neural positional awareness",
    "motor axis": "not the term for cumulative nervous-system positional input",
    "superset training and elevated protein intake": "targets hypertrophy/nutrition — does not comprehensively address hypertension, low VO2max, and high body fat",
    "a very-low calorie diet": "extreme dieting — less effective than aerobic training plus sodium reduction for this client profile",
    "flexibility and balance training": "does not directly improve VO2max, blood pressure, or body fat like cardiovascular training",
    "leg press": "machine knee-extension exercise — not the exercise or technique asked about here",
    "smith machine leg press": "fixed-path leg press — not the inappropriate equipment use or exercise in question",
    "jump squat": "plyometric squat — not the contraindicated or inappropriate exercise here",
    "barbell box squat": "squat variation — not the highest-risk exercise on a stability ball",
    "stability ball squat": "unstable surface squat — risky but not the most dangerous ball exercise listed",
    "pull-up": "vertical pulling — not the scapular elevation or spotting method required",
    "shrug": "scapular elevation exercise — not the muscle or movement tested in this question",
    "bench press": "horizontal pressing — not the exercise, order, or spotting method asked about",
    "lat pulldown": "vertical pulling — not the spotting position or primary muscle for this scenario",
    "walking lunge": "dynamic lunge — not the stretch, regression, or error correction described",
    "forward lunge": "sagittal lunge — not the balance/proprioception or spotting answer here",
    "reverse lunge": "backward lunge — not the modification or exercise tested in this question",
    "romanian deadlift": "hip-hinge hamstring exercise — not the stretch, error, or contraindication here",
    "deadlift": "hip-hinge lift — not the error, spotting, or muscle action tested",
    "calf raise": "ankle plantarflexion — not the stretch position or muscle asked about",
    "standing calf raise": "gastrocnemius-focused calf raise — not the answer for this specific question",
    "push-up": "horizontal pressing — not the plane, regression, or assessment substitute here",
    "chin-up": "supinated pull-up — not the spotting hand position or exercise tested",
    "dumbbell fly": "horizontal shoulder adduction — not the spotting method asked about",
    "military press": "overhead press — not the exercise for scapular elevation or kyphosis correction",
    "back fly": "rear-delt/scapular retraction — not the wrong choice unless the question targets something else",
    "glycogen": "stored muscle carbohydrate — not the fuel source or timeline answer here",
    "glucose": "blood/muscle sugar — not the primary fuel or metabolic product for this activity",
    "lactic acid": "anaerobic glycolysis byproduct — not what drives ventilation or fatigue here",
    "within 48 hours following exercise": "DOMS peak window — the keyed timing may differ for this stem",
    "immediately after exercise ends": "acute post-exercise — eccentric soreness peaks 24–48 hours later, not instantly",
    "within 12-24 hours following exercise": "early DOMS window — peak delayed-onset soreness is typically later",
    "within 48-72 hours following exercise": "late DOMS window — soreness usually peaks before this range",
    "12-24 hours": "early soreness onset — DOMS typically peaks around 24–48 hours post-exercise",
    "48-72 hours": "late soreness window — peak DOMS occurs earlier than this for most people",
    "1-3 hours after exercise": "too soon for DOMS peak — eccentric soreness develops over 24–48 hours",
    "no trunk movement": "overhead reaching requires trunk flexion and rotation — a rigid trunk is incorrect",
    "maximal spinal extension": "overhead reaching challenges flexion/rotation, not spinal extension",
    "uncontrolled lumbar hyperextension": "loss of neutral spine control — not the primary movement challenge described",
    "in neutral position": "gastrocnemius stretch requires full knee extension, not a flexed/neutral knee",
    "months to years": "neural adaptations to training occur within days to weeks, not this long",
    "increasing dietary sodium": "raises blood pressure — does not reduce chronic stress-related cardiovascular risk",
    "limiting aerobic activity": "reduces cardiovascular fitness — not a heart-disease prevention strategy",
    "decreased body fat": "hyperinsulinemia promotes fat storage — body fat typically increases, not decreases",
    "ligament": "connects bone to bone — not the structure asked about in this anatomy question",
    "tendon": "connects muscle to bone — not the connective tissue type tested here",
    "cartilage": "cushions joints — not the bone-to-bone connection type asked about",
    "fibrous joint": "immovable joint — not the freely movable synovial joint described",
    "synovial fluid": "lubricates joints — not the connective structure joining bones",
    "static stretching only": "stretching alone does not build strength, power, or cardiovascular fitness",
    "sedentary activity": "insufficient stimulus — does not produce the training adaptation tested",
    "low-intensity walking only": "inadequate overload for the strength or power outcome described",
    "adipose tissue only": "fat is one storage site — sugar is also stored as glycogen in muscle and liver",
    "muscular endurance": "sustained submaximal work — not the performance quality or adaptation tested",
    "increased bone density": "resistance training benefit — not the negative outcome of excessive aerobic volume",
    "increased type i fiber production": "endurance adaptation — not the fast-twitch fiber reduction from high-volume cardio",
    "increased capillary density": "aerobic adaptation — not the negative consequence of excessive endurance training",
    "sugar is stored in fat cells": "glycogen is the primary storage form — obesity risk is driven by insulin inhibiting lipolysis",
    "sugar is not easily digested": "simple sugars digest rapidly — the obesity link is insulin-driven fat storage",
    "sugar causes the pancreas to produce fat": "the pancreas secretes insulin, not fat — high insulin promotes fat accumulation",
    "once": "below the NCSF minimum of twice-weekly total-body resistance training",
    "four times": "exceeds the minimum twice-per-week frequency guideline asked for",
    "most days": "daily training exceeds the minimum twice-per-week guideline",
    "1,250": "below the ~2,000 kcal/week needed for fitness-level protection",
    "1,500": "below the ~2,000 kcal/week needed for fitness-level protection",
    "1,750": "below the ~2,000 kcal/week needed for fitness-level protection",
    "lateral rotation": "outward rotation away from the midline — not internal (medial) rotation",
    "external rotation": "rotation away from the body's midline — internal rotation is medial rotation",
    "supination": "forearm palm-up rotation — not the term for humeral internal rotation",
    "below or lower than another structure": "inferior (caudad) position — superior means above or higher",
    "lateral to another structure": "side-to-side position — superior describes vertical (cephalad) location",
    "posterior to another structure": "front-back (dorsal) position — not the superior/inferior vertical axis",
    "skeletal muscle": "voluntary striated muscle for movement — not involuntary visceral smooth muscle",
    "striated voluntary muscle": "consciously controlled skeletal muscle — differs from involuntary smooth muscle",
    "cardiac muscle only": "striated heart muscle only — blood vessels and digestive organs use smooth muscle",
    "using a standing desk at work": "minor NEAT increase — lacks structured cardiorespiratory stimulus of daily exercise",
    "taking antioxidants": "supplement antioxidants lack the broad proven benefit of regular physical activity",
    "increasing protein intake": "supports lean tissue but cannot replace exercise for inactive, overweight clients",
    "lowering systolic blood pressure by five point (5) mmhg": "modest BP improvement — cannot match eliminating tobacco-related cancer and CVD risk",
    "loss of five (5) pounds": "weight loss helps but does not remove ongoing carcinogen exposure from smoking",
    "increasing vo2max by 3.5 ml/kg/min": "aerobic gain is valuable but smoking cessation delivers broader mortality risk reduction",
    "hinge": "uniaxial hinge joint (knee/elbow) — shoulders and hips are multiaxial ball-and-socket joints",
    "pivot": "single-axis rotational joint — not the multiaxial shoulder/hip classification",
    "saddle": "saddle joint (e.g., thumb CMC) — not the ball-and-socket hip and shoulder type",
    "coronal only": "coronal (frontal) plane — trunk rotation occurs in the transverse plane",
}

GENERIC_DISTRACTOR_MARKERS = (
    "increased training volume",
    "reduced exercise frequency",
    "static stretching as the sole",
    "high-intensity training without",
    "alternative approach involving",
    "circuit training with no progression",
)


def normalize_question(text):
    text = text.lower().strip()
    text = re.sub(r"[_\s]+", " ", text)
    text = re.sub(r"[^\w\s%./-]", "", text)
    return text


def infer_topic(question):
    q = question.lower()
    topics = [
        (("muscle", "agonist", "antagonist", "rotator", "deltoid", "squat", "lunge", "curl"), "muscular anatomy and exercise technique"),
        (("nutrition", "vitamin", "protein", "fat", "calor", "fiber", "supplement", "diet"), "nutrition and dietary science"),
        (("blood pressure", "hypertension", "cardiovascular", "heart rate", "vo2", "aerobic", "hdl", "ldl"), "cardiovascular physiology and health"),
        (("screen", "assessment", "referral", "hsq", "par-q", "informed consent", "ethics"), "client screening and professional practice"),
        (("child", "elderly", "older", "pregnant", "diabetes", "obese", "arthritis"), "special populations programming"),
        (("periodization", "circuit", "intensity", "overload", "fitt", "pyramid", "superset"), "exercise programming principles"),
    ]
    for keys, topic in topics:
        if any(k in q for k in keys):
            return topic
    return "NCSF personal training competency"


def lookup_base_explanation(question, correct):
    nq = normalize_question(question)
    for key, exp in QUESTION_EXPLANATIONS.items():
        if key in nq:
            return exp
    return lookup_term_explanation(correct)


def lookup_term_explanation(term):
    if not term:
        return None
    term = term.strip()
    exp = EXPLANATIONS.get(term)
    if exp:
        return exp
    lower = term.lower()
    for k, v in EXPLANATIONS.items():
        if k.lower() == lower:
            return v
    return TERM_DEFINITIONS.get(lower)


def _question_focus(question, correct, base_exp=None):
    if base_exp:
        return _truncate(base_exp.split(".")[0], 90)
    correct_def = lookup_term_explanation(correct)
    if correct_def and correct_def != correct:
        return correct_def
    return correct


def _is_generic_distractor(text):
    lower = text.lower()
    return any(marker in lower for marker in GENERIC_DISTRACTOR_MARKERS)


def _option_tokens(text):
    return set(re.findall(r"[a-z]{3,}", text.lower()))


def _is_definition_question(question, wrong_option):
    q = question.lower()
    w = wrong_option.lower()
    if not re.search(r"(known as|termed|called|is known|refers to|________)", q):
        return False
    if re.search(
        r"(hour|minute|second|week|day|month|year|immediately|following exercise|after exercise|before exercise)",
        w,
    ):
        return False
    if re.search(r"(\d+\s*%)|(\d+/\d+)|(\d+\s*(bpm|rm|kcal|g/kg|lbs|pounds|beats))", w):
        return False
    return True


def _classify_option(text):
    t = text.lower()
    if re.search(
        r"(hour|minute|second|week|day|immediately|following exercise|after exercise|before exercise)",
        t,
    ):
        return "time"
    if re.search(r"\d+%|\d+/\d+|\d+\s*(bpm|rm|kcal|g/kg|lbs|pounds|beats)", t):
        return "numeric"
    if any(p in t for p in ("sagittal", "frontal", "transverse")):
        return "plane"
    if re.search(r"(ldl|hdl|vldl|cholesterol|triglyceride|lipid)", t):
        return "lipid"
    if re.search(
        r"(press|squat|lunge|curl|row|deadlift|raise|fly|dip|pull-up|chin-up|stretch)",
        t,
    ):
        return "exercise"
    if re.search(
        r"(biceps|triceps|deltoid|gastrocnemius|soleus|hamstring|glute|latissimus|trapezius|infraspinatus|supraspinatus|subscapularis|rectus|quadriceps|pectoralis)",
        t,
    ):
        return "muscle"
    return "general"


def _build_specific_reason(question, correct, wrong_option, base_exp=None):
    w = wrong_option.strip()
    wl = w.lower()
    q = question.lower()
    focus = _question_focus(question, correct, base_exp)
    term_def = lookup_term_explanation(w)
    correct_def = lookup_term_explanation(correct)
    opt_type = _classify_option(w)

    if opt_type == "time" or re.search(r"(when|timing|how long|duration|peak|onset)", q):
        if re.search(r"(soreness|doms|delayed)", q) or ("muscle" in q and "exercise" in q):
            if "immediately" in wl:
                return (
                    f"{w} — eccentric muscle soreness develops over hours; "
                    f"it does not peak the moment exercise ends."
                )
            if "12-24" in wl:
                return f"{w} — soreness may begin here, but peak DOMS is typically closer to {correct}."
            if "48-72" in wl:
                return f"{w} — DOMS usually peaks earlier; soreness often diminishes by this later window."
            if "within 48" in wl and "within 48" in correct.lower():
                return f"{w} — a plausible DOMS window, but the exam key specifies {correct}."
        if opt_type == "time":
            return f"{w} — this time frame does not match the evidence-based answer ({correct})."

    if opt_type == "lipid" or re.search(r"(cholesterol|hdl|ldl|lipid|triglyceride)", q):
        if "ldl" in wl and "increase" in wl:
            return f"{w} — aerobic training generally lowers LDL; it does not increase it."
        if "vldl" in wl and "increase" in wl:
            return f"{w} — moderate aerobic exercise favors HDL improvement, not VLDL elevation."
        if "does not affect" in wl:
            return f"{w} — regular aerobic training does improve circulating cholesterol profiles."
        if term_def:
            return f"{w} — {_truncate(term_def, 95)}."
        return f"{w} — does not reflect how aerobic exercise changes blood lipids ({correct})."

    if opt_type == "plane" or "plane" in q:
        if term_def:
            return f"{w} — {_truncate(term_def, 85)} This movement occurs in a different plane."
        return f"{w} — involves a different anatomical plane than {correct}."

    if re.search(r"(muscle|mover|agonist|antagonist|rotator|prime mover|stabiliz)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — acts on a different joint or movement than {correct}."

    if re.search(r"(exercise|performing|technique|spot|regression|progression|error|equipment)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — not the exercise, technique, or equipment use described by {correct}."

    if _is_definition_question(question, w):
        if term_def:
            return f"{w} — {_truncate(term_def, 90)}. The blank refers to {_truncate(focus, 65)}."
        return f"{w} — a different concept than {_truncate(focus, 70)}."

    if re.search(r"\b(vitamin|protein|fat|calor|fiber|supplement|diet|nutrition|kcal|grams?|mineral)\b", q):
        if re.search(r"\d+%", wl):
            if "saturated" in q:
                return f"{w} — dietary guidelines limit saturated fat to about 10% of total calories."
            if "trans" in q:
                return f"{w} — trans fat intake should be minimized, not this percentage."
        if re.search(r"\d+\s*calorie", wl) and re.search(r"\b(fat|grams?)\b", q):
            return f"{w} — fat provides 9 kcal/g; multiply grams of fat by 9, not this value."
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — does not match the nutritional guideline tested ({correct})."

    if re.search(r"(screen|referral|trainer|scope|consent|clearance|protocol|liability|ethics)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — not the required professional action; {correct} is the appropriate step."

    if re.search(r"(energy|metabolism|atp|glycolysis|phosphagen|aerobic|anaerobic|fuel|glycogen)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — not the primary fuel source or energy pathway for this activity."

    if re.search(r"(heart rate|vo2|cardiac|stroke volume|hypertension|atherosclerosis|blood pressure)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — does not match the cardiovascular adaptation or risk factor tested."

    if opt_type == "numeric" or re.search(r"(how much|how many|calculate|equals|realistic|percent)", q):
        if term_def:
            return f"{w} — {_truncate(term_def, 100)}."
        return f"{w} — not the evidence-based value; {correct} is supported here."

    if term_def:
        return f"{w} — {_truncate(term_def, 110)}."

    if correct_def and correct_def.lower() != correct.lower():
        return f"{w} — does not describe {_truncate(correct_def, 80)}."

    if "medicine ball" in q and re.search(r"(trunk|reach|overhead)", q):
        if "no trunk" in wl:
            return f"{w} — overhead medicine-ball reaching requires controlled trunk flexion and rotation."
        if "hyperextension" in wl or "spinal extension" in wl:
            return f"{w} — the movement challenges controlled flexion/rotation, not extension or hyperextension."

    if re.search(r"(neural adaptation|nervous system|motor unit)", q):
        if re.search(r"(month|year)", wl):
            return f"{w} — early strength gains from neural adaptations occur within days to weeks, not this long."

    if re.search(r"(bone|joint|ligament|tendon|cartilage|anatom)", q) and term_def:
        return f"{w} — {_truncate(term_def, 100)}."

    return f"{w} — not supported here ({_truncate(focus, 90)})."


def _try_contextual_explanation(question, correct, wrong_option, base_exp):
    q = question.lower()
    w = wrong_option.strip()
    wl = w.lower()
    cl = correct.lower()
    exp = (base_exp or "").strip()

    if "all of the above" in cl or "all the above" in cl:
        return (
            "Lists a valid point, but every listed item applies — "
            f"select the complete \"{correct}\" answer."
        )

    if "curvature" in q or ("curve" in q and "spine" in q):
        if "thoracic" in q and "kyphotic" in cl:
            if "lordotic" in wl:
                return f"{w} — lordosis is the normal lumbar/cervical curve; the thoracic spine is kyphotic."
            if "scoliotic" in wl:
                return f"{w} — scoliosis is abnormal lateral deviation, not normal thoracic curvature."
            if "lateral" in wl or "medial" in wl or "neutral" in wl:
                return f"{w} — not the recognized normal curvature of the thoracic spine (kyphotic)."

    if "dorsi flexion" in q or "dorsiflexion" in q:
        if "gastrocnemius" in wl or "plantar" in wl:
            return f"{w} — gastrocnemius plantarflexes the ankle; dorsiflexion is caused by the anterior tibialis."
        if "soleus" in wl and "isometric" in wl:
            return f"{w} — soleus plantarflexes; dorsiflexion requires concentric anterior tibialis action."
        if "biceps femoris" in wl or "hamstring" in wl:
            return f"{w} — hamstrings flex the knee; they do not dorsiflex the ankle."

    if "gastrocnemius" in q and ("stretch" in q or "knee" in q):
        if "flexed" in wl and "partially" in wl:
            return f"{w} — knee must be fully extended to maximally stretch the gastrocnemius."
        if "fully flexed" in wl:
            return f"{w} — knee flexion reduces gastrocnemius tension; extension is required."
        if "not affected" in wl:
            return f"{w} — the gastrocnemius crosses the knee; knee position directly affects the stretch."

    if "reciprocal inhibition" in q:
        return (
            f"{w} — reciprocal inhibition pairs an agonist contraction with antagonist stretch; "
            f"leg extension + hamstring stretch is the matched pair."
        )

    if "organelle" in q or "aerobic metabolism" in q:
        if any(t in wl for t in ("golgi", "sarcomere", "spindle")):
            return f"{w} — a neuromuscular/proprioceptive structure, not the organelle for aerobic metabolism (mitochondria)."

    if "anabolic hormone" in q or ("hormone" in q and "resistance training" in q):
        if "insulin" in wl:
            return f"{w} — regulates blood glucose; testosterone rises more specifically with heavy resistance training."
        if "glucagon" in wl:
            return f"{w} — raises blood glucose; not the primary anabolic hormone from heavy lifting."
        if "aldosterone" in wl or "estradiol" in wl:
            return f"{w} — not the hormone released in higher concentrations during heavy resistance training."

    if "contraindicated" in q or "back pain" in q:
        if "trunk extension" in cl or "extension test" in cl:
            return f"{w} — a flexibility assessment, not the contraindicated trunk extension test for unknown back pain."

    if "obesity" in q and ("android" in cl or "heart disease" in q):
        if "gynoid" in wl:
            return f"{w} — gynoid (hip/thigh) fat is less strongly linked to heart disease than android (abdominal) obesity."
        if "gene" in wl or "metabolism" in wl:
            return f"{w} — not the obesity type associated with cardiovascular disease risk."

    if "no joint movement" in cl and ("biceps" in q or "triceps" in q):
        if any(m in wl for m in ("flexion", "extension", "abduction")):
            return f"{w} — shoulder movement during arm curls/extensions is a common cheat; the shoulder should stay stable."

    if "proprioception" in cl:
        if "kinetic chain" in wl:
            return f"{w} — describes linked body segments in movement, not sensory positional awareness."
        if "ballistic" in wl:
            return f"{w} — explosive movement type, not the neural input for body position sense."
        if "motor axis" in wl:
            return f"{w} — not the term for cumulative proprioceptive positional input."

    if "tight" in q and "posterior pelvic tilt" in q:
        if "hip flexor" in wl:
            return f"{w} — tight hip flexors pull the pelvis anteriorly, not into posterior tilt."
        if "quadriceps" in wl or "quadratus" in wl:
            return f"{w} — not the muscle group causing posterior pelvic tilt during bilateral leg exercises."

    if "heart disease" in q or "reduce the risk for heart" in q:
        if "stress" in cl or "psychological" in cl:
            if "water" in wl:
                return f"{w} — hydration is important but does not directly lower chronic stress-related CVD risk."
            if "flexibility" in wl:
                return f"{w} — flexibility training alone does not directly reduce cardiovascular disease risk."
            if "carbohydrate" in wl or "carb" in wl:
                return f"{w} — carb restriction is not the primary evidence-based recommendation for heart disease prevention here."

    if "hyperinsulinemia" in q or ("insulin" in q and "body composition" in q):
        if "muscle" in wl and "increased" in wl:
            return f"{w} — hyperinsulinemia promotes fat storage, not muscle gain."
        if "lowered" in wl and ("fat" in wl or "mass" in wl):
            return f"{w} — high insulin inhibits lipolysis and favors fat accumulation."

    if "blood pressure" in q and ("reduction" in wl or "reduce" in q or "points" in wl):
        if re.search(r"\d+", wl):
            return f"{w} — aerobic training typically lowers BP by ~5–10 mmHg, not this exaggerated reduction."

    if "should not be performed" in q or "serious injury" in q:
        if "stability ball" in wl or "physioball" in wl:
            return (
                f"{w} — risky on a stability ball, but barbell box squats on a ball "
                f"(replacing a fixed box) carry the greatest injury risk."
            )

    if "aed" in q or "defibrillat" in q:
        if "blood sugar" in wl:
            return f"{w} — AEDs treat cardiac arrhythmia/asystole, not blood glucose."
        if "heat stroke" in wl:
            return f"{w} — AEDs are for cardiac emergencies, not heat illness management."
        if "ligament" in wl:
            return f"{w} — AEDs defibrillate the heart; they do not stabilize joints."

    if "heat" in q and ("humid" in q or "evaporation" in cl):
        if "conduction" in wl or "radiation" in wl or "convection" in wl:
            return f"{w} — heat can be lost this way, but sweat evaporation is most limited in humid environments."

    if "gastrocnemius" in cl and "stretch" in q:
        if "anterior tibialis" in wl:
            return f"{w} — the anterior tibialis is the dorsiflexor being stretched in other tests, not the gastrocnemius here."

    if exp and len(exp) >= 60:
        exp_bits = [s.strip() for s in re.split(r"[.;]", exp) if len(s.strip()) > 20]
        for bit in exp_bits:
            bit_low = bit.lower()
            if w.lower() in bit_low and w.lower() not in cl:
                if any(
                    k in bit_low
                    for k in ("not", "incorrect", "contraindicated", "opposite", "rather than", "instead", "false")
                ):
                    return f"{w} — {_truncate(bit, 110)}"
            overlap = _option_tokens(w) & _option_tokens(bit)
            if overlap and w.lower() not in cl:
                if any(
                    k in bit_low
                    for k in ("not", "incorrect", "contraindicated", "opposite", "rather than", "instead")
                ):
                    return f"{w} — {_truncate(bit, 110)}"

    return None


def _truncate(text, max_len=120):
    text = (text or "").strip().rstrip(".")
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut.rstrip(".,;")


def _clean_explanation_body(base_exp):
    if not base_exp:
        return ""
    body = base_exp.strip()
    marker = "NCSF Manual reference:"
    if marker in body:
        body = body[: body.index(marker)].strip()
    return re.sub(r"\s+", " ", body).rstrip(".")


def _is_sentence_option(text):
    t = (text or "").strip()
    if len(t) > 75:
        return True
    if t and t[0].islower():
        return True
    return t.count(" ") >= 10


def format_wrong_reason(wrong_option, reason):
    reason = (reason or "").strip()
    w = wrong_option.strip()
    for prefix in (f"{w} —", f"{w} -", f"{w}:", f"{w}."):
        if reason.lower().startswith(prefix.lower()):
            reason = reason[len(prefix) :].lstrip(" —-.:")
            break
    return reason.strip()


def _is_primarily_numeric_option(w):
    t = w.strip()
    if _is_sentence_option(t):
        return False
    if re.match(r"^\d+°$", t) or re.search(r"^\d+/\d+", t):
        return True
    if re.match(r"^[\d.,]+\s*(mmhg|kcal|beats/min|bpm|g/kg|lbs)?$", t, re.I):
        return True
    return len(t) < 30 and bool(re.search(r"\d", t))


def _try_sentence_refutation(question, correct, w, body):
    wl = w.lower()
    patterns = [
        (r"does not occur", "This can occur — excessive endurance training may reduce fast-twitch fiber size."),
        (
            r"positive adaptation.*speed",
            "Fiber shrinkage is a negative effect of high-volume aerobic work, not a speed-training benefit.",
        ),
        (
            r"strength training.*less than 4",
            "Atrophy is tied to endurance overload, not simply lifting fewer than four days per week.",
        ),
        (r"heart rate exceeding 14", "Elevated heart rate is a normal aerobic response — not the concerning sign here."),
        (r"systolic.*160", "Systolic rise during exercise is expected; rising diastolic pressure is the red flag."),
        (
            r"none of the above.*normal",
            "Rising diastolic BP during steady-state aerobic exercise is not a normal, safe response.",
        ),
        (
            r"free weights are best",
            "Free weights add stability demand, but the keyed answer emphasizes machine isolation for hypertrophy.",
        ),
        (
            r"rest intervals.*two minutes.*atp",
            "ATP timing is not the accurate hypertrophy-training principle tested in this stem.",
        ),
        (
            r"older clients.*12-15",
            "Rep prescription for older clients is not the accurate hypertrophy statement here.",
        ),
        (
            r"resistance-based exercises using machines",
            "Machine use is common but not the defining trait — sequential stations with transitions define circuits.",
        ),
        (
            r"body weight movements.*high speed",
            "Circuits need not be fast bodyweight work; sequential exercise with brief transitions is the constant.",
        ),
        (
            r"alternating upper and lower",
            "Alternation is optional programming, not the universal defining feature of circuit training.",
        ),
        (
            r"beginner looking to lose weight",
            "Pyramid loading targets maximal strength progressions, not beginner fat-loss programming.",
        ),
        (
            r"power gains through plyometric",
            "Plyometric power work uses different loading schemes than pyramid strength progression.",
        ),
        (
            r"sport-specific movement",
            "Sport-skill refinement is not the primary use case for pyramid strength loading.",
        ),
        (
            r"will not affect his training",
            "Medication and BP response still matter for exercise safety and session planning.",
        ),
        (
            r"blood pressure will rise above average.*supine",
            "Supine positioning is not the standard mitigation for exercise BP concerns in this context.",
        ),
        (
            r"increase the duration of the warm-up",
            "Extending warm-up alone does not address the clinical concern described in the stem.",
        ),
    ]
    for pat, reason in patterns:
        if re.search(pat, wl):
            return reason
    return None


def _try_numeric_reason(question, correct, w, body):
    wl = w.lower()
    q = question.lower()

    if "pound" in q and "fat" in q and "kcal" in wl:
        if "3500" in correct:
            if "1500" in w or "2500" in w:
                return "Underestimates stored energy — adipose tissue holds roughly 3500 kcal per pound."
            if "4500" in w:
                return "Overestimates typical fat energy density (~3500 kcal/lb is standard)."

    if "liter of oxygen" in q or "litre of oxygen" in q:
        if w.strip() in ("7", "9", "10"):
            return "Metabolic estimate is ~5 kcal per liter of O₂ consumed during exercise."

    if "beats" in wl and ("karvonen" in q or "heart rate reserve" in q or "karvonen" in body.lower()):
        return "Does not match the Karvonen formula: ((220 − age) − RHR) × intensity + RHR."

    if re.search(r"\d+/\d+", w) and ("blood pressure" in q or "mmhg" in wl):
        return "Implies a larger drop than ~10 mmHg typically seen after 3 months of aerobic training."

    if "°" in w or re.search(r"^\d+\s*degrees?$", wl):
        if "deltoid" in q and "30" in correct:
            deg = re.search(r"(\d+)", w)
            if deg:
                n = int(deg.group(1))
                if n < 30:
                    return "Supraspinatus still leads abduction before the deltoid becomes the primary mover (~30°)."
                if n > 30:
                    return "Past the transition where the deltoid supersedes rotator-cuff initiation."

    if _is_primarily_numeric_option(w) and body:
        return f"Not the value supported here — {_truncate(body, 95)}."
    return None


def _try_impact_reason(question, correct, w, body):
    q = question.lower()
    if not re.search(
        r"(greatest|most effective|most important|primary|main impact|best choice|greatest positive)",
        q,
    ):
        return None
    if re.search(r"°|\d+/\d+", w.strip()):
        return None

    wl, cl = w.lower(), correct.lower()
    pairs = [
        (
            ("quitting smoking",),
            ("blood pressure",),
            "A modest BP reduction helps, but ending tobacco use eliminates ongoing carcinogen-driven cancer and CVD risk.",
        ),
        (
            ("quitting smoking",),
            ("pounds", "weight"),
            "Weight loss helps, but smoking cessation removes sustained tobacco-related disease burden.",
        ),
        (
            ("quitting smoking",),
            ("vo2",),
            "Improving aerobic capacity matters, but quitting smoking yields broader mortality and disease-risk reduction.",
        ),
        (
            ("adding daily physical activity",),
            ("standing desk",),
            "Adds minor NEAT only — lacks structured cardiorespiratory and metabolic stimulus of daily exercise.",
        ),
        (
            ("adding daily physical activity",),
            ("antioxidant",),
            "Supplement antioxidants lack the proven population-level benefit of regular activity for inactive clients.",
        ),
        (
            ("adding daily physical activity",),
            ("protein",),
            "Protein supports lean tissue but cannot replace exercise for reversing inactivity-related health risks.",
        ),
    ]
    for c_keys, w_keys, reason in pairs:
        if any(k in cl for k in c_keys) and any(k in wl for k in w_keys):
            return reason

    term_def = lookup_term_explanation(w)
    if term_def:
        return f"{_truncate(term_def, 90)} Less impact than {_truncate(correct, 55)} here."
    if body:
        return f"Offers some benefit, but {_truncate(body.split('.')[0], 85)}."
    return None


def _try_plane_reason(question, correct, w, body):
    q = question.lower()
    wl = w.lower()
    if "plane" not in q and not any(p in wl for p in ("sagittal", "frontal", "transverse", "coronal")):
        return None

    if "rotation" in q and "transverse" in correct.lower():
        plane_reasons = {
            "sagittal": "Sagittal plane is forward/backward flexion-extension — trunk rotation is transverse-plane movement.",
            "frontal": "Frontal (coronal) plane is side-to-side motion — rotation occurs in the transverse plane.",
            "coronal only": "Coronal plane describes lateral movement, not horizontal rotation of the trunk.",
        }
        for key, reason in plane_reasons.items():
            if key in wl:
                return reason

    term_def = lookup_term_explanation(w)
    if term_def:
        return f"{_truncate(term_def, 80)} — this movement occurs in a different plane."
    if body:
        return f"Different movement plane than described ({_truncate(body, 80)})."
    return "Involves a different anatomical movement plane."


def _try_anatomy_term_reason(question, correct, w, body):
    wl = w.lower()
    q = question.lower()
    cl = correct.lower()
    opposites = [
        (("superior",), ("below", "lower", "inferior"), "Superior means toward the head — the opposite of below/lower."),
        (("superior",), ("lateral",), "Superior is a vertical (cephalad) term, not a side-to-side (lateral) relationship."),
        (("superior",), ("posterior",), "Superior describes above/below position, not front vs back (posterior)."),
        (("medial rotation",), ("external", "lateral"), "Internal rotation is medial rotation — external/lateral is the opposite."),
        (("medial rotation",), ("supination",), "Supination is forearm terminology, not humeral internal rotation."),
        (("wrist",), ("elbow",), "The elbow is proximal to the wrist, not distal to it."),
        (("wrist",), ("shoulder",), "The shoulder is proximal to the wrist in the upper extremity."),
        (("wrist",), ("ankle",), "The ankle is a lower-extremity joint, not distal to the elbow."),
        (("ball-and-socket",), ("hinge",), "Hinge joints are uniaxial — shoulders and hips are multiaxial ball-and-socket."),
        (("ball-and-socket",), ("pivot",), "Pivot joints rotate on one axis — not the multiaxial shoulder/hip type."),
        (("ball-and-socket",), ("saddle",), "Saddle joints differ from the ball-and-socket classification of hips and shoulders."),
        (("smooth muscle",), ("skeletal", "striated voluntary"), "Skeletal muscle is voluntary striated tissue — visceral walls use smooth muscle."),
        (("smooth muscle",), ("cardiac",), "Cardiac muscle powers the heart — digestive and vascular walls use smooth muscle."),
    ]
    for c_keys, w_keys, reason in opposites:
        if any(k in cl for k in c_keys) and any(k in wl for k in w_keys):
            return reason

    if "mid-axillary" in q:
        if "left and right" in wl:
            return "Left/right division is along the midsagittal line, not the mid-axillary (front/back) line."
        if "superior and inferior" in wl:
            return "Superior/inferior splits are transverse — mid-axillary divides anterior from posterior."
        if "proximal and distal" in wl:
            return "Proximal/distal describes limb segment position, not coronal front/back division."
    return None


def _try_definition_reason(question, correct, w, body):
    is_blank = _is_definition_question(question, w) or "________" in question
    term_def = lookup_term_explanation(w)

    if is_blank:
        if term_def:
            focus = _truncate(body or correct, 70)
            return f"{_truncate(term_def, 90)}. The blank refers to {focus}."
        if body:
            return f"Not the term filling the blank — {_truncate(body.split('.')[0], 85)}."
        return None

    if term_def and len(w) < 60 and not _is_sentence_option(w):
        if body:
            return f"{_truncate(term_def, 90)} Not the concept tested ({_truncate(body.split('.')[0], 65)})."
        return _truncate(term_def, 110)
    return None


def _try_exception_question(question, correct, w, body):
    q = question.lower()
    if not re.search(
        r"(which of the following is not|what would not|not be considered|not part of|not an|inappropriate|contraindicated|exception)",
        q,
    ):
        return None
    term_def = lookup_term_explanation(w)
    if term_def:
        return f"{_truncate(term_def, 80)} — appropriate here; the question asks for the exception."
    return f"Applies in this context — the question seeks what does NOT belong ({_truncate(correct, 60)})."


def _try_topic_reason(question, correct, w, body):
    q = question.lower()
    wl = w.lower()
    term_def = lookup_term_explanation(w)

    if re.search(r"(muscle|mover|agonist|antagonist|rotator cuff|prime mover)", q):
        if not _is_sentence_option(w):
            if term_def:
                return _truncate(term_def, 110)
            if body:
                return f"Different muscle or action than required — {_truncate(body.split('.')[0], 80)}."

    if re.search(r"(screen|referral|trainer|scope|consent|clearance|protocol|liability|ethics|concern during)", q):
        if _is_sentence_option(w) and body:
            if "diastolic" in body.lower() and "diastolic" not in wl and "systolic" in wl:
                return "Systolic rise during aerobic exercise is common — rising diastolic pressure is the concerning response."
            if "diastolic" in body.lower() and "heart rate" in wl:
                return "Elevated exercise heart rate is expected — diastolic BP rise is the abnormal finding."
            return f"Not the professional concern described — {_truncate(body, 95)}."
        if term_def:
            return _truncate(term_def, 100)

    if re.search(r"\b(vitamin|protein|fat|calor|fiber|supplement|diet|nutrition|kcal|grams?|mineral|obesity|sugar)\b", q):
        if "sugar" in q and "obesity" in q:
            if "stored in fat" in wl:
                return "Sugar is stored as glycogen first; obesity risk is driven by insulin inhibiting fat breakdown."
            if "not easily digested" in wl:
                return "Sugar digests rapidly; insulin spikes from high sugar intake promote fat storage."
            if "pancreas" in wl and "produce fat" in wl:
                return "The pancreas secretes insulin, not fat; elevated insulin promotes fat accumulation."
        if term_def:
            return _truncate(term_def, 100)
        if body and re.search(r"\d", w):
            return f"Incorrect amount or guideline — {_truncate(body, 90)}."

    if re.search(r"(frequency|times per week|times a week|per week)", q) and "kcal" not in q:
        if re.search(r"\bonce\b", wl):
            return "Below the NCSF minimum of twice-weekly total-body resistance training."
        if "four" in wl:
            return "Four sessions exceed the minimum twice-per-week guideline asked for."
        if "most days" in wl or "daily" in wl:
            return "Daily training exceeds the minimum twice-per-week frequency in the guideline."

    if re.search(r"(energy|metabolism|atp|glycolysis|phosphagen|fuel|glycogen)", q) and not re.search(
        r"(concern|monitor|session)", q
    ):
        if term_def:
            return _truncate(term_def, 100)
        if body:
            return f"Not the primary fuel or pathway here — {_truncate(body.split('.')[0], 85)}."

    if re.search(r"(heart rate|vo2|cardiac|stroke volume|hdl|ldl|cholesterol|hypertension|atherosclerosis|blood pressure)", q):
        if term_def:
            return _truncate(term_def, 100)
        if _is_sentence_option(w) and body:
            return f"Does not reflect the cardiovascular principle tested — {_truncate(body, 90)}."

    if _is_generic_distractor(w):
        return f"Unrelated training approach for this stem ({_truncate(correct, 55)})."

    return None


def _try_body_contrast(question, correct, w, body):
    if not body:
        return None
    if _is_sentence_option(w):
        return f"Inaccurate — {_truncate(body, 110)}."
    term_def = lookup_term_explanation(w)
    if term_def:
        return _truncate(term_def, 110)
    return f"Not supported — {_truncate(body, 100)}."


def explain_wrong_option(question, correct, wrong_option, base_exp=None):
    w = wrong_option.strip()
    body = _clean_explanation_body(base_exp)

    reason = (
        _try_sentence_refutation(question, correct, w, body)
        or _try_contextual_explanation(question, correct, w, base_exp)
        or _try_impact_reason(question, correct, w, body)
        or _try_numeric_reason(question, correct, w, body)
        or _try_plane_reason(question, correct, w, body)
        or _try_anatomy_term_reason(question, correct, w, body)
        or _try_definition_reason(question, correct, w, body)
        or _try_exception_question(question, correct, w, body)
        or _try_topic_reason(question, correct, w, body)
        or _try_body_contrast(question, correct, w, body)
    )
    return format_wrong_reason(
        w,
        reason or _truncate(body or f"Correct answer: {correct}", 110),
    )


def _format_option_list(options):
    opts = [o.strip() for o in options if o and o.strip()]
    if len(opts) == 1:
        return opts[0]
    if len(opts) == 2:
        return f"{opts[0]} and {opts[1]}"
    return ", ".join(opts[:-1]) + f", and {opts[-1]}"


def _classify_wrong_group(question, wrong_list):
    q = question.lower()
    if all(_is_primarily_numeric_option(w) or "°" in w for w in wrong_list):
        return "numeric"
    if "________" in question or any(_is_definition_question(question, w) for w in wrong_list):
        return "definition"
    if any(_is_sentence_option(w) for w in wrong_list):
        return "statements"
    if any(p in q for p in ("plane", "sagittal", "frontal", "transverse", "rotation")):
        return "plane"
    if re.search(r"(muscle|tissue|bone|joint|ligament|anatom)", q):
        return "anatomy"
    return "terms"


def build_distractors_explanation(question, correct, wrong_list, base_exp=None):
    """One combined explanation for why all non-correct options fail."""
    wrong_list = [w.strip() for w in wrong_list if w.strip() != correct.strip()]
    if not wrong_list:
        return ""

    body = _clean_explanation_body(base_exp)
    labels = _format_option_list(wrong_list)
    q = question.lower()
    cl = correct.lower()
    reasons = [explain_wrong_option(question, correct, w, base_exp) for w in wrong_list]

    if "all of the above" in cl or "all the above" in cl:
        return (
            f"Each listed choice ({labels}) is valid on its own, but every option applies — "
            f"the complete answer is \"{correct}\"."
        )

    group = _classify_wrong_group(question, wrong_list)

    if group == "definition":
        bits = []
        for w, r in zip(wrong_list, reasons):
            term = lookup_term_explanation(w)
            bits.append(f"{w} ({_truncate(term or r, 55)})")
        focus = _truncate(body.split(".")[0] if body else correct, 90)
        return (
            f"The other choices — {labels} — are different concepts ({'; '.join(bits)}). "
            f"The blank refers to {focus}."
        )

    if group == "numeric":
        if body:
            return f"The other values ({labels}) are not correct. {_truncate(body, 155)}"
        if len(set(reasons)) == 1:
            return f"The other values ({labels}) are incorrect because {reasons[0]}"
        return (
            f"The other values ({labels}) do not fit this stem: "
            f"{' '.join(f'{w} — {r}' for w, r in zip(wrong_list, reasons))}"
        )

    if group == "plane":
        return (
            f"The other planes ({labels}) describe different axes of movement than this action. "
            f"{_truncate(body or reasons[0], 125)}"
        )

    if re.search(
        r"(greatest|most effective|most important|primary|main impact|best choice|greatest positive)",
        q,
    ):
        detail = " ".join(
            f"{_truncate(w, 42)}: {_truncate(r, 75)}" for w, r in zip(wrong_list, reasons)
        )
        return (
            f"The other choices ({labels}) are less impactful than \"{correct}\". {detail}"
        )

    if group == "statements":
        if body:
            return (
                f"The other statements ({labels}) do not describe what this question tests. "
                f"{_truncate(body, 155)}"
            )
        return (
            "The other options do not apply: "
            + " ".join(
                f"{_truncate(w, 55)} is incorrect because {r}"
                for w, r in zip(wrong_list, reasons)
            )
        )

    if group == "anatomy" and body:
        return (
            f"The other choices ({labels}) describe different structures or actions than required. "
            f"{_truncate(body, 145)}"
        )

    if body:
        unique = list(dict.fromkeys(reasons))
        if len(unique) == 1:
            return (
                f"The other options ({labels}) are incorrect because {unique[0]} "
                f"{_truncate(body, 110)}"
            ).strip()
        return (
            f"The other options ({labels}) do not apply here. {_truncate(body, 150)}"
        )

    if all(len(r) < 100 for r in reasons):
        return (
            "The remaining choices are incorrect: "
            + " ".join(f"{w} — {r}" for w, r in zip(wrong_list, reasons))
        )

    return f"The other options ({labels}) are incorrect. {_truncate(reasons[0], 140)}"


def build_wrong_explanations(question, correct, wrong_list, base_exp=None):
    return build_distractors_explanation(question, correct, wrong_list, base_exp)


def load_manual_references():
    if not os.path.exists(MANUAL_REFS):
        return {}
    with open(MANUAL_REFS, encoding="utf-8") as f:
        data = json.load(f)
    return {normalize_question(item["question"]): item for item in data}


def append_manual_reference(explanation, reference_text):
    if not reference_text or reference_text in explanation:
        return explanation
    marker = "NCSF Manual reference:"
    if marker in explanation:
        return explanation
    return f"{explanation.rstrip()} {reference_text}"


def enrich_explanation(question, correct, wrong, base, manual_ref=None):
    base = (base or f"{correct} is the correct answer.").strip()
    base = re.sub(
        r" This question tests.*?NCSF Certified Personal Trainer exam\.",
        "",
        base,
    )
    base = re.sub(
        r' The distractors \(.*?\) are incorrect because each option fails to apply.*?exam\.',
        "",
        base,
    )
    ref_text = (manual_ref or {}).get("reference_text", "")
    return append_manual_reference(base, ref_text)


def parse_quiz(path):
    with open(path, encoding="utf-8") as f:
        lines = [ln.rstrip() for ln in f.readlines()]

    blocks = []
    current_q = []
    for line in lines:
        if line.strip() == "":
            if current_q:
                blocks.append(current_q)
                current_q = []
        else:
            current_q.append(line.strip())
    if current_q:
        blocks.append(current_q)

    questions = []
    seen_questions = set()
    duplicates = []

    for block in blocks:
        if len(block) < 6:
            continue
        answer_letter = block[-1].lower()
        opts = {}
        q_lines = []
        for line in block[:-1]:
            m = re.match(r"^([a-d])\.\s*(.+)$", line, re.I)
            if m:
                opts[m.group(1).lower()] = m.group(2).strip()
            else:
                q_lines.append(line)
        if not q_lines or len(opts) != 4 or answer_letter not in opts:
            continue
        question = " ".join(q_lines)
        nq = normalize_question(question)
        if nq in seen_questions:
            duplicates.append(question)
            continue
        seen_questions.add(nq)

        correct = opts[answer_letter]
        wrong = [opts[k] for k in "abcd" if k != answer_letter]
        base_exp = lookup_base_explanation(question, correct)
        questions.append({
            "q": question,
            "a": correct,
            "wrong": wrong,
            "base_exp": base_exp,
        })

    if duplicates:
        print(f"WARNING: Skipped {len(duplicates)} duplicate question(s):")
        for d in duplicates:
            print(f"  - {d[:90]}...")
    return questions


def main():
    quiz_items = parse_quiz(INPUT)
    print(f"Parsed {len(quiz_items)} unique questions from quiz.txt")

    manual_by_question = load_manual_references()
    items = []
    verified = 0
    for item in quiz_items:
        nq = normalize_question(item["q"])
        manual_ref = manual_by_question.get(nq)
        if manual_ref and manual_ref.get("verified"):
            verified += 1
        exp = enrich_explanation(
            item["q"], item["a"], item["wrong"], item["base_exp"], manual_ref
        )
        items.append({**item, "exp": exp, "manualRef": manual_ref})

    print(f"Manual references attached: {len(manual_by_question)}")
    print(f"Verified against NCSF manuals: {verified}/{len(items)}")

    random.seed(42)
    output = []
    for idx, item in enumerate(items, 1):
        options = item["wrong"] + [item["a"]]
        random.shuffle(options)
        entry = {
            "id": idx,
            "question": item["q"],
            "options": options,
            "correctIndex": options.index(item["a"]),
            "explanation": item["exp"],
            "source": "quiz.txt",
        }
        if item.get("manualRef"):
            entry["manualReference"] = item["manualRef"].get("reference_text", "")
            entry["manualVerified"] = item["manualRef"].get("verified", False)
        output.append(entry)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("const EXAM_QUESTIONS = ")
        json.dump(output, f, indent=2)
        f.write(";\n")
    print(f"Wrote {len(output)} questions to {OUTPUT}")


if __name__ == "__main__":
    # Use build_master_database.py for the full merged bank (quiz.txt + video).
    import subprocess
    import sys
    script = os.path.join(os.path.dirname(__file__), "build_master_database.py")
    subprocess.run([sys.executable, script], check=True)