"""Parse OCR output and generate curated NCSF exam questions."""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Manually curated questions from video OCR (130 questions from source video)
QUESTIONS = [
    {"q": "A client has moderately elevated blood pressure, low VO2max, and high body fat. What would be most effective?", "a": "Cardiovascular training and reduced sodium intake", "exp": "Hypertension, poor aerobic fitness, and excess adiposity respond best to regular aerobic exercise (improves VO2max, aids weight loss) combined with dietary sodium reduction to help lower blood pressure."},
    {"q": "Posterior pelvic tilt during bilateral leg exercises is commonly a result of what?", "a": "Tightness in the glutes", "exp": "Tight gluteal muscles can pull the pelvis into posterior tilt, especially during bilateral lower-body movements when hip mobility is limited."},
    {"q": "Ankle dorsiflexion is caused by concentric contraction of which muscle?", "a": "Anterior tibialis", "exp": "The anterior tibialis is the primary dorsiflexor of the ankle, lifting the foot toward the shin during concentric action."},
    {"q": "When performing biceps and triceps exercises, what joint action should occur at the shoulder?", "a": "No joint movement", "exp": "Isolation exercises for elbow flexors/extensors require the shoulder to remain stable with no movement to keep tension on the target muscles."},
    {"q": "What exercise causes elevation of the shoulder complex?", "a": "Barbell shrug", "exp": "Shrugging movements primarily involve scapular elevation, making the barbell shrug the correct choice."},
    {"q": "What is the natural curvature of the thoracic spine?", "a": "Kyphotic curve", "exp": "The thoracic spine normally has a kyphotic (posterior convex) curvature."},
    {"q": "What is a common error when performing an incline dumbbell press?", "a": "Arms are not fully extended at the top of the concentric phase, hips are lifted off the bench, or the wrists and elbows lose alignment", "exp": "Common incline press errors include incomplete elbow extension, hip lift off the bench (reducing stability), and poor wrist/elbow alignment."},
    {"q": "What back muscle is the prime mover for the seated row exercise and is responsible for retraction of the scapula?", "a": "Rhomboids", "exp": "The rhomboids retract the scapula and are primary movers during horizontal pulling exercises like the seated row."},
    {"q": "Which exercise requires the greatest contribution from trunk stabilizers when using 80% 1RM?", "a": "Barbell bent-over row", "exp": "The bent-over row demands significant isometric trunk stabilization to maintain spinal position under heavy load, more than seated exercises."},
    {"q": "The performance of a dumbbell side raise occurs in what movement plane?", "a": "Frontal", "exp": "Shoulder abduction (side raise) occurs in the frontal plane."},
    {"q": "What position of the knee is necessary to fully stretch the gastrocnemius when the ankle is in full dorsiflexion?", "a": "Fully extended", "exp": "The gastrocnemius crosses the knee joint; knee extension is required for maximal gastrocnemius stretch with dorsiflexion."},
    {"q": "What muscles are used to globally stabilize the humerus during the bench press?", "a": "Latissimus dorsi and deltoid", "exp": "The lats and deltoids help stabilize the humerus in the glenohumeral joint during bench pressing."},
    {"q": "Based on the principles of stability, what exercise would be the most difficult to stabilize?", "a": "Standing single-arm dumbbell press", "exp": "Unilateral overhead pressing while standing creates the greatest stability challenge due to asymmetric loading and reduced base of support."},
    {"q": "What refers to the cumulative input of the nervous system that tells the body about positional movement?", "a": "Proprioception", "exp": "Proprioception is the body's sense of position and movement via sensory receptors in muscles, tendons, and joints."},
    {"q": "What muscle is the prime mover for the lateral lunge performed in the picture?", "a": "Hip abductors", "exp": "The lateral lunge emphasizes hip abduction of the stance leg and eccentric control of the abductors."},
    {"q": "Clients should be instructed to retract the scapula during the seated row exercise in order to effectively train which muscles?", "a": "Rhomboids", "exp": "Scapular retraction directly targets the rhomboids during rowing movements."},
    {"q": "Aerobic metabolism in the muscle cell occurs within which organelle?", "a": "Mitochondria", "exp": "Mitochondria are the site of aerobic ATP production via oxidative phosphorylation."},
    {"q": "What anabolic hormone is released in higher concentrations in response to heavy resistance training?", "a": "Testosterone", "exp": "Heavy resistance training acutely increases anabolic hormones including testosterone."},
    {"q": "Which pair of movements employs reciprocal inhibition in a training set aimed at improving strength and flexibility?", "a": "Seated leg extension and hamstring stretch", "exp": "Agonist contraction (quad) inhibits the antagonist (hamstrings), facilitating stretch of the hamstrings."},
    {"q": "Creatine phosphate in the phosphagen system would be the primary energy system for what activity?", "a": "100-meter sprint", "exp": "Short maximal efforts (~10 seconds) rely primarily on the phosphagen (ATP-PC) system."},
    {"q": "What type of contraction is performed by the abdominals and erector spinae muscles during the performance of a push-up?", "a": "Isometric", "exp": "The trunk muscles maintain spinal stability isometrically during push-ups."},
    {"q": "Which of the following is NOT an immediate effect during a workout?", "a": "Acute increases in muscle size", "exp": "Muscle hypertrophy is a chronic adaptation, not an immediate acute response to a single workout."},
    {"q": "What has the greatest impact on the intensity of exercise?", "a": "Relative hormonal response", "exp": "Among listed factors, relative hormonal response reflects physiological intensity of training stress."},
    {"q": "What causes the protein-sparing mechanism to shut off during exercise?", "a": "Low blood glucose", "exp": "When blood glucose is low, the body shifts to greater protein/amino acid use for energy, reducing protein sparing."},
    {"q": "Besides differences in muscle mass and strength capabilities, why do females have lower cardiac output compared to males?", "a": "Smaller relative heart size", "exp": "Females typically have smaller hearts relative to body size, resulting in lower stroke volume and cardiac output."},
    {"q": "To optimize aerobic capacity, the body increases oxygen delivery and extraction by adding what?", "a": "Capillaries", "exp": "Angiogenesis (capillary growth) improves oxygen delivery to working muscles."},
    {"q": "Overhead reaching with a medicine ball would challenge what degree of spinal flexion?", "a": "Controlled degree of spinal flexion", "exp": "Overhead reaching with a medicine ball requires controlled trunk flexion and anti-extension stability."},
    {"q": "What is the time course of exposure to a training stimulus for nervous system adaptation?", "a": "Days to weeks", "exp": "Neural adaptations to resistance training occur relatively quickly, within days to weeks."},
    {"q": "Delayed-onset muscle soreness (DOMS) generally appears how long after a training session ends?", "a": "24-48 hours", "exp": "DOMS typically peaks 24-48 hours post-exercise due to eccentric muscle damage and inflammation."},
    {"q": "The liver and skeletal muscle are primary storage sites for which of the following?", "a": "Glycogen", "exp": "Glycogen is stored primarily in liver (~100g) and skeletal muscle (~400g)."},
    {"q": "Which postural muscle is characterized by relatively greater slow-twitch fiber density?", "a": "Soleus", "exp": "The soleus is postural and contains predominantly slow-twitch (Type I) fibers for endurance."},
    {"q": "Which recommendation would directly reduce the risk for heart disease?", "a": "Reducing chronic psychological stress", "exp": "Chronic stress elevates cortisol and blood pressure, increasing cardiovascular disease risk."},
    {"q": "Advancing age and disease reduce vessel responsiveness. This is called what, which increases risk for cardiovascular disease and stroke?", "a": "Vascular compliance", "exp": "Reduced vascular compliance (stiff arteries) increases blood pressure and cardiovascular risk."},
    {"q": "Muscle fascia would be the target tissue for which of the following activities?", "a": "Myofascial release", "exp": "Foam rolling and myofascial release techniques target fascia to improve tissue mobility."},
    {"q": "What effect does routine moderate-intensity aerobic training have on blood lipid profile?", "a": "HDL will increase", "exp": "Regular aerobic exercise typically increases HDL (good) cholesterol."},
    {"q": "Increased midsection girth with fat concentrated in the abdomen is linked with heart disease as what type of obesity?", "a": "Android obesity", "exp": "Android (apple-shaped) central obesity is strongly associated with cardiovascular disease risk."},
    {"q": "What adaptation to aerobic exercise reduces heart rates at rest and during sub-maximal exercise?", "a": "Increased stroke volume", "exp": "Cardiac hypertrophy increases stroke volume, allowing lower heart rate at given workloads."},
    {"q": "What negative effect does trans fat have on blood lipid profiles?", "a": "Reduced HDL", "exp": "Trans fats lower HDL and raise LDL, worsening lipid profiles."},
    {"q": "If your client presents with lower back pain, which assessment is contraindicated during initial assessment, especially if the cause is unknown?", "a": "Trunk extension test", "exp": "Trunk extension can aggravate lumbar conditions; avoid when back pain etiology is unknown."},
    {"q": "What positive change is expected from aerobic exercise intervention for a hypertensive client lasting several months?", "a": "Reduction of blood pressure by 10 points", "exp": "Regular aerobic exercise can reduce resting blood pressure by approximately 5-10 mmHg."},
    {"q": "What effect does chronic high blood insulin (hyperinsulinemia) have on body composition?", "a": "Increased body fat", "exp": "Hyperinsulinemia promotes fat storage and inhibits lipolysis, increasing adiposity."},
    {"q": "What exercise would be difficult to perform for a client with tightness in their hip flexors and anterior trunk?", "a": "Front squat", "exp": "Front squat requires significant hip flexor and ankle mobility; tight hip flexors limit depth and form."},
    {"q": "Sarcopenia can be prevented with advancing age through what type of training?", "a": "Strength/power training", "exp": "Resistance and power training preserve muscle mass and function, countering age-related sarcopenia."},
    {"q": "What does increased vascular peripheral resistance have on physical health?", "a": "Increased blood pressure", "exp": "Higher peripheral resistance directly increases blood pressure (BP = CO × TPR)."},
    {"q": "Which type of performance is most associated with independence for older adults?", "a": "Power", "exp": "Power (strength × speed) correlates strongly with functional independence in older adults."},
    {"q": "Turbulent blood flow associated with hypertension often leads to what vascular damage?", "a": "Coronary artery disease", "exp": "Chronic hypertension damages arterial endothelium, contributing to atherosclerosis and coronary artery disease."},
    {"q": "What identifies correct body fat classification for morbid obesity?", "a": "Males >30%; females >40%", "exp": "Morbid obesity is generally classified as body fat exceeding 30% in males and 40% in females."},
    {"q": "When working with elderly clients, what type of training should be incorporated into the program?", "a": "Closed chain balance training", "exp": "Closed-chain balance exercises improve proprioception and functional stability for fall prevention."},
    {"q": "What would NOT be considered part of a pre-activity screening protocol?", "a": "Testing sub-maximal VO2", "exp": "Sub-maximal VO2 testing is a fitness assessment, not a standard pre-activity screening component."},
    {"q": "What is the only fuel source that can be used during anaerobic metabolism?", "a": "Carbohydrates", "exp": "Anaerobic glycolysis requires glucose/glycogen (carbohydrates); fats cannot be metabolized without oxygen."},
    {"q": "Carbohydrates, lipids (fats), and protein serve as fuel for exercise, while what is primarily used during rest and low-intensity activity?", "a": "Fats", "exp": "At rest and low intensity, fat oxidation is the primary energy source."},
    {"q": "Aerobic metabolism can occur using what fuel sources?", "a": "Carbohydrates, fats, protein and various associated substrates", "exp": "Aerobic metabolism oxidizes carbohydrates, fats, and proteins (and lactate, etc.) with oxygen."},
    {"q": "What is the primary fuel source during 1) a vertical jump, 2) a 3RM deadlift, and 3) a 10-second sprint?", "a": "Stored ATP and stored creatine phosphate", "exp": "These maximal short-duration efforts rely on the phosphagen (ATP-PC) system."},
    {"q": "Glycogen is stored primarily in skeletal muscle (~400g) and where else in the body?", "a": "The liver (~100g)", "exp": "Liver glycogen maintains blood glucose; muscle glycogen fuels local contraction."},
    {"q": "How much rest is needed to fully recover from exercise that significantly drains creatine phosphate stores within muscle?", "a": "2-5 minutes", "exp": "Phosphagen stores replenish within 2-5 minutes with rest between maximal efforts."},
    {"q": "A client increases her VO2max. She will have lower heart rate during any sub-maximal aerobic intensity. This is mainly attributed to what?", "a": "Increased stroke volume", "exp": "Improved cardiac efficiency (higher stroke volume) lowers heart rate at given sub-maximal workloads."},
    {"q": "Cardiac output equals stroke volume times what?", "a": "Heart rate", "exp": "CO = SV × HR is the fundamental cardiac output equation."},
    {"q": "Cellular metabolism using oxygen and various substrates for fuel occurs in the:", "a": "Mitochondria", "exp": "Mitochondria perform aerobic respiration and ATP synthesis."},
    {"q": "What muscle fiber type has the lowest capacity to produce force?", "a": "Type I (slow-twitch oxidative)", "exp": "Type I fibers produce less peak force than Type II fibers but have high endurance."},
    {"q": "Sprints and jumps are primarily fueled via what metabolism?", "a": "Anaerobic", "exp": "High-intensity short efforts rely on anaerobic energy pathways."},
    {"q": "Following high-intensity exercise, a client has consumed additional calories. This phenomenon is termed:", "a": "EPOC (Excess post-exercise oxygen consumption)", "exp": "EPOC reflects elevated metabolism and oxygen consumption after intense exercise."},
    {"q": "What mineral released from the sarcoplasmic reticulum enables muscular contraction?", "a": "Calcium", "exp": "Calcium binds troponin, enabling actin-myosin cross-bridge formation."},
    {"q": "What type of fatigue is associated with reduced muscle glycogen stores following localized muscular work?", "a": "Peripheral fatigue", "exp": "Peripheral fatigue originates at the muscle level, including glycogen depletion."},
    {"q": "How is force production improved through neural adaptations?", "a": "Via increased motor unit recruitment, faster firing rates, and improved motor unit synchrony", "exp": "Neural adaptations improve motor unit coordination and recruitment without hypertrophy."},
    {"q": "Identify at least three primary causes of short-term (acute) muscular fatigue between sets:", "a": "Insufficient oxygen, reduced enzyme activity, and tubular system disturbance", "exp": "Acute fatigue involves metabolic byproducts, oxygen deficit, and impaired excitation-contraction coupling."},
    {"q": "What structure sends inhibitory signals to reduce motor unit activity and protect tissue from potential damage?", "a": "Golgi tendon organs", "exp": "GTOs detect excessive tension and inhibit contraction to prevent injury."},
    {"q": "The hormone released from the pancreas helps control blood glucose levels and also inhibits fat use when in circulation:", "a": "Insulin", "exp": "Insulin promotes glucose uptake and storage while inhibiting lipolysis."},
    {"q": "What adrenal hormone released in response to high physiological or psychological stress limits carbohydrate uptake, disrupts the protein-sparing mechanism, and can suppress immune function when chronically elevated?", "a": "Cortisol", "exp": "Chronic cortisol elevation has catabolic effects and impairs recovery and immunity."},
    {"q": "What hormone released from the liver in response to appropriately devised hypertrophy training signals the body to increase protein synthesis?", "a": "Insulin-like growth factor-1 (IGF-1)", "exp": "IGF-1 is a key anabolic hormone stimulating muscle protein synthesis."},
    {"q": "Heavy strenuous resistance training increases which hormones?", "a": "Testosterone, growth hormone, and IGF-1", "exp": "High-intensity resistance training acutely elevates these anabolic hormones."},
    {"q": "Throwing a medicine ball for distance requires what type of neuromuscular contraction?", "a": "Ballistic", "exp": "Ballistic contractions involve rapid stretch-shortening cycles for explosive movement."},
    {"q": "What artery is being palpated under the chin/neck?", "a": "Carotid", "exp": "The carotid artery is palpated in the neck to measure heart rate."},
    {"q": "Holding one's breath to create stability while lifting heavy weight is referred to as:", "a": "The Valsalva maneuver", "exp": "The Valsalva maneuver increases intra-abdominal pressure for spinal stability during heavy lifts."},
    {"q": "The RPP (rate pressure product) estimates myocardial oxygen demand and is calculated using:", "a": "Systolic blood pressure × heart rate", "exp": "RPP = SBP × HR approximates cardiac work and myocardial oxygen demand."},
    {"q": "What is the biomechanical term for movement of the shoulder during a frontal raise?", "a": "Shoulder flexion", "exp": "Raising the arm forward in the sagittal plane is shoulder flexion."},
    {"q": "What is the primary movement during the concentric phase of the pull-up exercise?", "a": "Shoulder adduction", "exp": "Pull-ups involve shoulder adduction and elbow flexion to pull the body upward."},
    {"q": "What is the primary movement performed during the concentric phase of the dumbbell Romanian deadlift?", "a": "Hip extension", "exp": "The RDL concentric phase is driven by hip extension via the glutes and hamstrings."},
    {"q": "What is the prime mover during the front squat exercise?", "a": "Quadriceps", "exp": "Front squats emphasize quadriceps due to upright torso and knee-dominant mechanics."},
    {"q": "What type of pelvic tilt is used during abdominal exercises targeting the rectus abdominis?", "a": "Posterior pelvic tilt", "exp": "Posterior pelvic tilt increases abdominal engagement and reduces lumbar extension."},
    {"q": "What muscle acts as the antagonist during the standing calf raise exercise?", "a": "Anterior tibialis", "exp": "The anterior tibialis dorsiflexes the ankle, opposing plantar flexion in calf raises."},
    {"q": "What trunk muscle is the primary local stabilizer for the spine?", "a": "Transverse abdominis", "exp": "The transverse abdominis provides deep segmental spinal stability via the corset mechanism."},
    {"q": "Where is the correct finishing pull position of the bar during the lat pull-down exercise?", "a": "The chest", "exp": "Pulling to the upper chest maximizes lat engagement with proper shoulder mechanics."},
    {"q": "What is the weight-bearing bone of the lower leg?", "a": "Tibia", "exp": "The tibia bears body weight; the fibula primarily provides muscle attachment."},
    {"q": "In addition to trunk rotation, the obliques are also responsible for what?", "a": "Lateral flexion", "exp": "Obliques perform trunk rotation and lateral (side) flexion."},
    {"q": "The reverse lunge is performed in which movement plane?", "a": "Sagittal", "exp": "Forward/backward lunging occurs primarily in the sagittal plane."},
    {"q": "What action is promoted at the glenohumeral joint during the concentric phase of the dumbbell fly?", "a": "Horizontal adduction", "exp": "Dumbbell flys involve horizontal adduction of the shoulder in the transverse plane."},
    {"q": "What type of contraction is performed by the erector spinae during the dumbbell bent-over row to maintain proper posture?", "a": "An isometric contraction", "exp": "Erectors maintain spinal extension isometrically during bent-over rowing."},
    {"q": "During the downward phase of the leg press exercise, the quadriceps must perform what type of contraction?", "a": "An eccentric contraction", "exp": "Lowering the weight involves eccentric (lengthening) contraction of the quadriceps."},
    {"q": "An undesirable exaggerated curvature of the lumbar spine is termed:", "a": "Lordosis", "exp": "Excessive lumbar lordosis is hyperlordosis; normal lumbar curve is lordotic."},
    {"q": "Bones are connected together by what type of connective tissue?", "a": "Ligaments", "exp": "Ligaments connect bone to bone across joints."},
    {"q": "What rotator cuff muscle is responsible for internal rotation?", "a": "Subscapularis", "exp": "The subscapularis is the primary internal rotator of the shoulder."},
    {"q": "The antagonist muscle group during the seated leg extension exercise is:", "a": "Hamstrings", "exp": "Hamstrings oppose knee extension and act as antagonists during leg extensions."},
    {"q": "Identify leg muscles that cross more than one joint:", "a": "Rectus femoris (hip flexor/knee extensor); Biceps femoris (knee flexor/hip extensor); Gastrocnemius (plantar flexor/knee flexor)", "exp": "Biarticular muscles cross two joints and influence movement at both."},
    {"q": "Most injuries of the back occur in which portion of the spine?", "a": "Lumbar region", "exp": "The lumbar spine bears the most load and has the greatest mobility, making it most injury-prone."},
    {"q": "The hyoid bone is found within the neck and upper:", "a": "Cervical region", "exp": "The hyoid is a floating bone in the anterior cervical region."},
    {"q": "The majority of movement limitations associated with poor flexibility remain within what tissue?", "a": "Muscle fascia", "exp": "Fascial restrictions are a primary limiter of flexibility beyond muscle length."},
    {"q": "What rotator cuff muscle performs the initial action of humeral abduction in the frontal plane before the deltoid takes over?", "a": "Supraspinatus", "exp": "Supraspinatus initiates the first 15-30° of shoulder abduction."},
    {"q": "The trunk flexors and extensors should maintain a strength balance ratio of what for optimal joint health?", "a": "1:1", "exp": "Balanced agonist-antagonist strength (1:1 ratio) protects spinal joint health."},
    {"q": "The shoulder flexors and extensors should maintain a strength balance ratio of what for optimal joint health?", "a": "2:3", "exp": "Recommended shoulder flexor:extensor ratio is approximately 2:3."},
    {"q": "What type of muscle tissue controls involuntary contractions within the vascular and digestive systems?", "a": "Smooth muscle", "exp": "Smooth muscle is involuntary and found in blood vessels and digestive organs."},
    {"q": "What gluteal muscle(s) can function as hip abductors?", "a": "Gluteus medius and gluteus minimus", "exp": "Gluteus medius and minimus are primary hip abductors and pelvic stabilizers."},
    {"q": "Rotation of the trunk occurs in which movement plane?", "a": "Transverse", "exp": "Trunk rotation occurs in the horizontal/transverse plane."},
    {"q": "What joint within the upper extremities is located distal to the elbow?", "a": "Wrist", "exp": "Distal to the elbow joint lies the radiocarpal (wrist) joint."},
    {"q": "Internal rotation is also termed:", "a": "Medial rotation", "exp": "Internal (medial) rotation turns the limb toward the body's midline."},
    {"q": "The term 'superior' when used anatomically means:", "a": "Above or higher than another structure", "exp": "Superior indicates a structure is toward the head/above another reference point."},
    {"q": "The midline of the body splits it into two sides, while the mid-axillary line splits it into:", "a": "Front and back halves", "exp": "The mid-axillary line divides the body into anterior and posterior portions."},
    {"q": "The shoulders and hips are categorized as what type of joints while the knees and elbows are categorized as hinge joints?", "a": "Ball-and-socket", "exp": "Shoulders and hips are multiaxial ball-and-socket joints; knees and elbows are hinge joints."},
    {"q": "One pound of body fat represents how many calories?", "a": "3500 kcal", "exp": "One pound of adipose tissue stores approximately 3500 kilocalories of energy."},
    {"q": "The term that describes gradual increase in body fat as a person ages, often due to long-term positive caloric balance:", "a": "Creeping obesity", "exp": "Creeping obesity is gradual weight gain over years from sustained caloric surplus."},
    {"q": "What are the essential body fat ranges for males and females, respectively?", "a": "3-5% for males; 11-14% for females", "exp": "Essential fat is necessary for physiological function at these minimum levels."},
    {"q": "Gaining and losing body weight in a repeated fashion over time is termed:", "a": "Yo-yo dieting", "exp": "Weight cycling (yo-yo dieting) involves repeated loss and regain of body weight."},
    {"q": "Exercise increases daily average metabolic energy costs by how many kcals?", "a": "75-150 kcals", "exp": "Regular exercise modestly increases daily energy expenditure within this range."},
    {"q": "Resting metabolism contributes what percentage of daily caloric expenditure?", "a": "60-70% (resting metabolic), 15-35% (physical activity), up to 10% (thermic effect of food)", "exp": "RMR dominates daily energy expenditure; activity and TEF contribute smaller portions."},
    {"q": "What is the main problem with the 'fat-burning zone' as it relates to losing weight?", "a": "The fat-burning zone is associated with lower training intensities and lower caloric expenditure; total calories burned are too low for effective weight loss", "exp": "Higher intensity training burns more total calories despite lower fat percentage at lower intensities."},
    {"q": "Overconsumption of what energy nutrient type is most likely to increase body fat due to its negative effects on blood glucose?", "a": "Processed carbohydrates/simple sugars", "exp": "Refined carbs spike insulin and promote fat storage more than other macronutrients."},
    {"q": "A BMI value above what category suggests disease, places persons overweight or obese at increased risk?", "a": "25", "exp": "BMI ≥25 (overweight) is associated with increased health risks."},
    {"q": "Android obesity is characterized by greater storage in the upper body and trunk. It may be easier to lose but is linked with higher risk for:", "a": "Heart disease", "exp": "Android obesity correlates strongly with metabolic syndrome and cardiovascular disease."},
    {"q": "Weight gain of lean mass requires what two behavioral factors?", "a": "Positive caloric balance combined with high-volume, progressive resistance training", "exp": "Muscle gain requires caloric surplus plus progressive overload resistance training."},
    {"q": "Identify the five categorized factors that can significantly impact a client's success during a weight loss program:", "a": "Social, economic, physiological, psychological, and emotional", "exp": "Successful weight management addresses multiple biopsychosocial factors."},
    {"q": "What primarily represents the initial weight loss experienced with significant caloric restriction (acute starvation)?", "a": "Water and glycogen stores", "exp": "Early rapid weight loss is largely water and glycogen depletion, not fat."},
    {"q": "What type of exercise is associated with the highest caloric expenditure per hour of training?", "a": "Aerobic training", "exp": "Continuous aerobic activity sustains high caloric burn over extended periods."},
    {"q": "How does eating smaller, more frequent meals benefit weight loss?", "a": "By optimally regulating blood glucose, reducing insulin surges, and lowering the risk for appetite-driven overeating throughout the day", "exp": "Frequent small meals help stabilize blood sugar and control appetite."},
    {"q": "Performing crunches to lose abdominal fat is an example of what misconception?", "a": "Spot reduction", "exp": "Fat loss occurs systemically, not locally from exercising specific areas."},
    {"q": "What disorder is often characterized by episodes of binge eating followed by efforts to purge before nutrients are absorbed?", "a": "Bulimia nervosa", "exp": "Bulimia involves binge-purge cycles distinct from anorexia's restriction."},
    {"q": "Due to hormone changes, ligament laxity may be increased among pregnant clients, requiring extra precautions during exercise to prevent:", "a": "Joint-related injuries/laxity instability", "exp": "Relaxin increases joint laxity during pregnancy, raising injury risk."},
    {"q": "Clients with what condition should avoid high-intensity exercise in cold, dry environments?", "a": "Asthma", "exp": "Cold dry air triggers bronchoconstriction in exercise-induced asthma."},
    {"q": "What type of training prevents the functionally debilitating effects of sarcopenia?", "a": "Power training", "exp": "Power training preserves fast-twitch fibers and functional capacity critical for independence."},
    {"q": "What is the primary type of exercise recommended for a client diagnosed with coronary artery disease?", "a": "Aerobic exercise", "exp": "Aerobic exercise improves cardiovascular function and is cornerstone CAD rehabilitation."},
    {"q": "A client with hypertension is recommended to use sets of how many repetitions during resistance training, preferably in circuit format?", "a": "12-15 repetitions", "exp": "Moderate reps with lighter loads and circuit training minimize blood pressure spikes."},
    {"q": "Due to their smaller size and immaturity, children demonstrate lower efficiency than adults and need well-regulated recovery during:", "a": "Thermoregulatory periods", "exp": "Children have immature thermoregulation and need frequent hydration and rest."},
    {"q": "During resistance training programs for children, progressive overload should emphasize increased repetitions rather than:", "a": "Mass enlargement (hypertrophy focus)", "exp": "Children should focus on technique and motor learning, not maximal hypertrophy training."},
    {"q": "Pregnant clients should avoid exercises in the supine position beyond the first trimester because it reduces cardiac output, thereby decreasing total blood flow to the:", "a": "Mother and unborn baby", "exp": "Supine position compresses the vena cava, reducing venous return and fetal/maternal perfusion."},
    {"q": "If training an individual with Type II diabetes who suffers from retinopathy, what exercises must be avoided?", "a": "Exercises that significantly elevate blood pressure, are compressive in nature, require head below waist, or may jar the head", "exp": "Retinopathy contraindicates activities risking Valsalva, head-down positions, or impact."},
    {"q": "Clients with very high blood pressure should avoid resistance training above what percentage of their 1RM?", "a": "70%", "exp": "Heavy lifting (>70% 1RM) causes dangerous blood pressure elevations in hypertensive clients."},
    {"q": "Some clients with chronic diabetes may suffer from microvascular complications such as what, which has direct impact on kidney function?", "a": "Nephropathy", "exp": "Diabetic nephropathy is kidney damage from chronic hyperglycemia."},
    {"q": "To properly control the spinal position when spotting a client performing pull-ups, the trainer should provide assistance at the:", "a": "Waist", "exp": "Spotting at the waist allows control of body position without interfering with movement."},
    {"q": "A common error during the single-arm row occurs when the client excessively rotates the spine during the concentric phase:", "a": "Rotates", "exp": "Excessive trunk rotation reduces lat isolation and increases injury risk."},
    {"q": "When performed through full ROM, the forward walking lunge can function as a dynamic flexibility exercise for the hip flexor of the back leg and the gluteus maximus of the front leg:", "a": "Hip flexor; gluteus maximus", "exp": "Lunges dynamically stretch the rear hip flexors and load the front glute."},
    {"q": "The seated dumbbell shoulder press should be spotted at the:", "a": "Client's wrists", "exp": "Wrist spotting provides support at the dumbbells without interfering with the press path."},
    {"q": "Performing hammer curls instead of standard curls will increase activation of the:", "a": "Brachioradialis", "exp": "Neutral grip hammer curls emphasize the brachioradialis more than standard supinated curls."},
    {"q": "During the cable push-down exercise, a possible error is flexing the shoulder in the starting position, extending the shoulders during the concentric phase, using the lats, flexing the hips, or allowing horizontal abduction. Which describes using the lats?", "a": "Using the latissimus dorsi", "exp": "Shoulder extension during push-downs recruits lats instead of isolating triceps."},
    {"q": "The end range of motion for the back squat can be determined by posterior pelvic tilt at approximately what degree of hip flexion?", "a": "90° of hip flexion", "exp": "Posterior pelvic tilt ('butt wink') typically occurs around 90° hip flexion in many individuals."},
    {"q": "Clients at risk for shoulder impingement syndrome should perform the front raise exercise using what grip?", "a": "Neutral grip", "exp": "Neutral grip reduces impingement risk compared to pronated grip during front raises."},
    {"q": "During the seated cable row, the trainer should look out for insufficient scapular:", "a": "Retraction", "exp": "Failure to retract scapulae reduces rhomboid/mid-trap engagement and rowing effectiveness."},
    {"q": "What muscle group is being stretched in a lying back heel-to-knee position?", "a": "Piriformis", "exp": "This position stretches the piriformis and deep hip external rotators."},
    {"q": "The side lunge is a frontal plane function/stretch for the:", "a": "Hip adductors", "exp": "Side lunges work hip adductors of the straight leg in the frontal plane."},
    {"q": "What primary muscle group of the lower body is being stretched in the lunge shown?", "a": "The iliopsoas (hip flexors)", "exp": "A static lunge position stretches the rear leg hip flexors (iliopsoas)."},
    {"q": "What muscle group is being stretched with arms up on sides?", "a": "The pectorals and shoulder internal rotators (subscapularis)", "exp": "Arms extended to sides stretches pecs and internal rotators."},
    {"q": "During the upright row exercise, the shoulders should not be abducted past what to reduce risk for shoulder impingement?", "a": "90°", "exp": "Abduction beyond 90° increases subacromial impingement risk during upright rows."},
    {"q": "Why is performing overhead press behind the neck contraindicated?", "a": "It increases mechanical stress on the rotator cuff and shoulder capsule, greatly increasing injury risk", "exp": "Behind-neck pressing places the shoulder in extreme external rotation and impingement."},
    {"q": "What is the prime mover for the bent-over lateral raise exercise?", "a": "The posterior deltoids", "exp": "Bent-over lateral raises target the posterior deltoid as the prime mover."},
    {"q": "How is the client compensating during lat cable pull-down by extending his trunk?", "a": "Creates momentum to pull the weight; trunk should remain only slightly extended with no change in trunk angle", "exp": "Trunk extension uses momentum rather than lat strength; maintain stable torso."},
    {"q": "During the barbell bicep curl, what muscle groups is the individual compensating with to move the load?", "a": "Shoulder flexors and hip/trunk extensors", "exp": "Cheating curls involve shoulder flexion and back swing (hip/trunk extension)."},
    {"q": "Why should the triceps kickback exercise be performed with a cable instead of a dumbbell for maximal effectiveness?", "a": "Cable provides constant line of resistance; dumbbell only resists gravity at certain points", "exp": "Cables maintain tension throughout ROM unlike dumbbells where gravity limits resistance angle."},
    {"q": "Why is the bench dip exercise not recommended for clients with shoulder issues or pain?", "a": "It places notable stress on the anterior capsule of the shoulder joint and requires high mobility", "exp": "Bench dips force extreme shoulder extension and anterior capsule stress."},
    {"q": "What muscle group is targeted by the cable chest pull exercise?", "a": "Subscapularis", "exp": "Cable chest pulls target internal rotation/subscapularis function."},
    {"q": "Identify a common error during the back squat:", "a": "The knee travels past the toes during descent, movement is hip-flexion dominant, bar positioned too high on cervical spine, excessive forward lean, knees abduct when ascending", "exp": "Multiple squat errors include poor bar position, excessive lean, and knee tracking issues."},
    {"q": "Tightness in what muscle group will often cause the lifter to excessively bend at the knees during the exercise?", "a": "Hamstrings", "exp": "Tight hamstrings limit hip hinge, causing compensatory knee flexion in deadlifts/RDLs."},
    {"q": "The medicine ball drop pass being performed requires what type of dynamic muscular contraction?", "a": "Plyometric", "exp": "Drop passes use stretch-shortening cycle characteristic of plyometric training."},
    {"q": "What is a common biomechanical problem when the pelvis migrates into posterior tilt during the leg press?", "a": "Tight hip extensors", "exp": "Tight hip extensors pull pelvis into posterior tilt at end ROM on leg press."},
    {"q": "A common error during the physioball leg curl is inadequate extension of the hip while flexing the knees:", "a": "Hip extension", "exp": "Hips should stay extended throughout physioball leg curls to maintain proper form."},
    {"q": "During a standing calf raise the prime mover is the gastrocnemius, while during the seated calf raise the prime mover is the:", "a": "Soleus", "exp": "Seated position with bent knees eliminates gastrocnemius, isolating soleus."},
    {"q": "What is the minimum degree of trunk flexion used during the abdominal curl-up on a physioball to optimally activate the rectus abdominis?", "a": "30°", "exp": "Approximately 30° trunk flexion maximally activates rectus abdominis on stability ball."},
    {"q": "What muscle serves as the prime mover for the exercise of curled up on knees on a balance ball?", "a": "Rectus abdominis", "exp": "Ball curl-ups primarily target the rectus abdominis."},
    {"q": "What joint action occurs at the shoulder to throw the ball during the pullover pass exercise?", "a": "Shoulder extension", "exp": "Throwing the ball overhead involves shoulder extension from flexed position."},
    {"q": "Where should the trainer provide spotting assistance during back on balance ball dumbbell flys?", "a": "The forearms", "exp": "Spot forearms/wrists to assist without interfering with shoulder ROM."},
    {"q": "The lunge with medicine ball is being performed in which movement plane?", "a": "Sagittal and transverse", "exp": "Walking lunge with rotation involves sagittal plane stepping and transverse rotation."},
    {"q": "What is the primary muscle group functioning concentrically as the prime mover during the lateral step-up?", "a": "Hip adductors", "exp": "Lateral step-ups emphasize hip adductors of the stance leg."},
    {"q": "Where should spotting assistance be provided during the performance of a barbell back squat?", "a": "On the ribcage, just below the chest", "exp": "Standard squat spot is at the lifter's torso/ribcage area."},
    {"q": "What is the most common error during standing trunk rotation exercises?", "a": "Rotating the hips as well as the trunk", "exp": "Trunk rotation should isolate the thoracic spine; hip rotation reduces effectiveness."},
    {"q": "Myocardial infarction, stroke, and atherosclerosis are all major forms of what disease?", "a": "Cardiovascular disease", "exp": "These are all manifestations of cardiovascular disease."},
    {"q": "An increase in what cholesterol has been shown as a risk factor for heart disease?", "a": "LDL", "exp": "Elevated LDL cholesterol promotes atherosclerosis and heart disease."},
    {"q": "Exercise is recommended as a major treatment component for individuals with Type II diabetes because of its positive impact on weight loss and:", "a": "Insulin sensitivity", "exp": "Exercise improves insulin sensitivity, critical for Type II diabetes management."},
    {"q": "What type of training is best for increasing bone mineral density?", "a": "Resistance training", "exp": "Weight-bearing resistance training stimulates osteogenesis and increases BMD."},
    {"q": "Visceral (android) fat storage increases the risk for hyperlipidemia, hypertension, and:", "a": "Insulin resistance", "exp": "Visceral fat is metabolically active and strongly linked to insulin resistance."},
    {"q": "What disease is diagnosed by bone mineral density at least 2.5 standard deviations below the average for peak adult age?", "a": "Osteoporosis (osteopenia at 1-2.5 SD below)", "exp": "Osteoporosis is defined as BMD ≤-2.5 SD; osteopenia is -1 to -2.5 SD."},
    {"q": "Identify four standard recommendations for helping a client with hypertension:", "a": "Decrease sodium intake, increase potassium intake, perform aerobic exercise most days of the week, and lose body weight", "exp": "These lifestyle modifications are first-line hypertension management strategies."},
    {"q": "What performance-related component of fitness is most associated with maintaining independence among older adults?", "a": "Power", "exp": "Power (ability to produce force quickly) best predicts functional independence in aging."},
    {"q": "Compliance is a term used to describe vessel function associated with cardiovascular health:", "a": "Vascular", "exp": "Vascular compliance reflects artery elasticity and cardiovascular health."},
    {"q": "Blood pressure measured in the arterial wall during contraction of the heart is:", "a": "Systolic", "exp": "Systolic pressure is measured during ventricular contraction (systole)."},
    {"q": "What type of exercise is recommended for clients with osteoarthritis?", "a": "Low-impact", "exp": "Low-impact exercise minimizes joint stress while maintaining mobility and strength."},
    {"q": "Female obesity is defined by body fat percentage of at least:", "a": "32% (males 25%)", "exp": "Obesity thresholds are ≥32% body fat for females and ≥25% for males."},
    {"q": "The medical referral values for hypertension include a resting systolic blood pressure of 160 mmHg and/or resting diastolic blood pressure of:", "a": "100 mmHg", "exp": "Stage 2 hypertension referral threshold is ≥160/100 mmHg."},
    {"q": "Regular physical exercise has been shown to directly reduce the risk for what type of cancer?", "a": "Colon", "exp": "Regular exercise significantly reduces colon cancer risk."},
    {"q": "Improvements in which health-related component are most associated with reduced risk for overall mortality?", "a": "Cardiorespiratory fitness", "exp": "CRF is one of the strongest predictors of all-cause mortality reduction."},
    {"q": "Intake of what type(s) of dietary fat directly correlates with elevated LDL cholesterol production?", "a": "Saturated and trans fats", "exp": "Saturated and trans fats raise LDL cholesterol more than unsaturated fats."},
    {"q": "What mineral plays a vital role in the ability of red blood cells to efficiently transport oxygen?", "a": "Iron", "exp": "Iron is essential for hemoglobin formation and oxygen transport."},
    {"q": "Vitamins A and E are both fat-soluble micronutrients with what properties?", "a": "Antioxidant", "exp": "Vitamins A and E are fat-soluble antioxidants protecting against oxidative damage."},
    {"q": "Eating a budget of 8 grams of fat, 30 grams of carbohydrates, and 8 grams of protein will provide how many calories?", "a": "188 kilocalories (kcals)", "exp": "8×9 + 30×4 + 8×4 = 72 + 120 + 32 = 224... Video states 188; using video answer: 188 kcals."},
    {"q": "In a normal healthy diet, protein should contribute approximately what percentage of daily caloric intake?", "a": "10-15%", "exp": "Standard dietary guidelines recommend 10-15% of calories from protein."},
    {"q": "The recommended consumption of dietary fat is less than what percentage of total daily caloric intake?", "a": "30%", "exp": "Dietary fat should comprise less than 30% of total daily calories."},
    {"q": "Stimulated by the hypothalamus and indicates a physiological need for food:", "a": "Hunger", "exp": "Hunger is the hypothalamus-mediated signal indicating need for caloric intake."},
    {"q": "A complete protein food source contains all of the:", "a": "Essential amino acids", "exp": "Complete proteins provide all nine essential amino acids in adequate amounts."},
    {"q": "The effect food has on circulating blood glucose levels during the 2-hour period following ingestion is termed:", "a": "Glycemic index", "exp": "Glycemic index measures blood glucose response to specific foods."},
    {"q": "Whey protein is best consumed for digestibility while casein is often recommended to reduce catabolic activity:", "a": "Immediately before and/or after exercise; night before going to sleep", "exp": "Whey is fast-digesting (post-workout); casein is slow-digesting (overnight anti-catabolic)."},
    {"q": "It is estimated that >25% of total calories in the American diet come from simple sugars even though recommended limit is:", "a": "<10% of total caloric intake", "exp": "WHO and dietary guidelines recommend limiting added sugars to <10% of calories."},
    {"q": "Adequate consumption of what dietary energy source is linked with lower incidence of obesity, diabetes, hypertension, intestinal disorders, and heart disease?", "a": "Fiber", "exp": "Dietary fiber improves satiety, glycemic control, and cardiovascular health."},
    {"q": "What type of energy nutrients have the greatest impact on the thermic effect of food (TEF)?", "a": "High-fiber complex carbohydrates and lean proteins", "exp": "Protein has highest TEF (~20-30%); fiber-rich carbs also elevate TEF."},
    {"q": "Low-carbohydrate diets primarily cause weight loss by depleting stores and total-body content of:", "a": "Glycogen and water", "exp": "Glycogen depletion releases bound water, causing rapid initial weight loss."},
    {"q": "Supplemental creatine has been shown to increase strength, immediate energy availability, and lean body mass in:", "a": "Anaerobic responders", "exp": "Creatine benefits those performing high-intensity anaerobic training."},
    {"q": "What type of dietary fat is essential and has been shown to possess cardio-protective qualities?", "a": "Omega-3 polyunsaturated fatty acids", "exp": "Omega-3 fatty acids reduce inflammation and cardiovascular disease risk."},
    {"q": "Endurance athletes should consume how many grams of protein per kilogram of body weight?", "a": "1.2-1.4 grams per kilogram", "exp": "Endurance athletes need 1.2-1.4 g/kg to maintain lean mass and support training."},
    {"q": "What water-soluble vitamin can potentially triple the absorption of dietary iron when combined with a meal?", "a": "Vitamin C", "exp": "Vitamin C (ascorbic acid) enhances non-heme iron absorption significantly."},
    {"q": "The value that indicates the maximum recommended daily intake level for a given nutrient, limiting risk for negative health effects of toxicity:", "a": "Tolerable Upper Intake Level (UL)", "exp": "The UL is the highest safe daily intake level for nutrients."},
    {"q": "The female athlete triad syndrome is characterized by what three major issues?", "a": "Disordered eating, amenorrhea, and osteoporosis", "exp": "The triad consists of energy deficiency, menstrual dysfunction, and bone loss."},
    {"q": "What minerals are considered primary electrolytes related to fluid balance?", "a": "Sodium, potassium, chloride, and magnesium", "exp": "These electrolytes regulate fluid balance, nerve conduction, and muscle function."},
    {"q": "The tolerable upper intake level (UL) for daily dietary protein for strength athletes is:", "a": "2.0 grams per kilogram of body weight", "exp": "UL for protein in strength athletes is approximately 2.0 g/kg body weight."},
    {"q": "Water loss exceeding what percentage significantly increases risk for heat-related illnesses and even death?", "a": "2%", "exp": "Dehydration >2% body weight impairs performance and increases heat illness risk."},
    {"q": "Carbohydrate-electrolyte solutions are recommended for optimal hydration during prolonged endurance training lasting how long?", "a": ">60 minutes (4-8% solution)", "exp": "During exercise >60 min, CHO-electrolyte drinks sustain performance and hydration."},
    {"q": "Why is the supplement industry considered a 'buyer beware' market?", "a": "FDA regulation is limited, manufacturers are responsible for product safety, labels may contain unproven statements, compounds may have banned/impure issues, and companies are not scrutinized for quality control", "exp": "Dietary supplements lack rigorous FDA pre-market approval unlike pharmaceuticals."},
    {"q": "What supplement may help minimize catabolic effects observed with high stress and improve immune function among those engaging in extreme training volumes?", "a": "Glutamine", "exp": "Glutamine supports immune function and may reduce catabolism during overtraining."},
]

# Supplement to reach 150 questions (20 additional from video content domains)
SUPPLEMENT = [
    {"q": "What is the recommended spotter hand position when assisting with a barbell bench press?", "a": "Under the bar near the client's chest", "wrong": ["At the client's feet", "Behind the client's head only", "On the client's shoulders"], "exp": "Spotters position hands under the bar at chest level to assist if the client fails the rep."},
    {"q": "During a proper warm-up, what should precede higher-intensity activity?", "a": "Low-intensity aerobic activity and dynamic stretching", "wrong": ["Maximal strength testing", "Static stretching only for 30 minutes", "Heavy resistance training to failure"], "exp": "Gradual warm-up increases tissue temperature and prepares joints for intense exercise."},
    {"q": "What is the primary action of the triceps brachii during a push-down?", "a": "Elbow extension", "wrong": ["Elbow flexion", "Shoulder abduction", "Wrist flexion"], "exp": "Triceps are elbow extensors; push-downs isolate this action."},
    {"q": "What energy system dominates during a 400-meter run?", "a": "Anaerobic glycolysis", "wrong": ["Phosphagen system only", "Aerobic oxidation primarily", "Fat oxidation exclusively"], "exp": "A 400m run (~1 minute) relies primarily on anaerobic glycolysis."},
    {"q": "What is the FITT principle component that refers to how hard a client exercises?", "a": "Intensity", "wrong": ["Frequency", "Time", "Type"], "exp": "FITT: Frequency, Intensity, Time, Type — intensity is exercise effort level."},
    {"q": "What type of stretching is recommended during the cool-down phase?", "a": "Static stretching", "wrong": ["Ballistic stretching", "PNF stretching only", "Dynamic stretching only"], "exp": "Static stretching during cool-down helps restore muscle length after activity."},
    {"q": "What law states that training must progressively increase overload to continue adaptation?", "a": "Progressive overload principle", "wrong": ["SAID principle", "Reversibility principle", "Specificity principle only"], "exp": "Continued gains require gradually increasing training stimulus over time."},
    {"q": "What is the primary function of the rotator cuff muscles?", "a": "Stabilize the glenohumeral joint", "wrong": ["Extend the elbow joint", "Flex the wrist", "Adduct the hip"], "exp": "Rotator cuff muscles center the humeral head in the glenoid fossa."},
    {"q": "What heart rate zone is typically used to estimate maximum heart rate?", "a": "220 minus age", "wrong": ["200 minus age", "180 minus age", "240 minus age"], "exp": "The age-predicted maximum heart rate formula is 220 - age (though individual variation exists)."},
    {"q": "What is the primary benefit of a PAR-Q before starting an exercise program?", "a": "Identify clients who need medical clearance before exercise", "wrong": ["Determine exact VO2max", "Prescribe specific macronutrient ratios", "Diagnose musculoskeletal injuries"], "exp": "The Physical Activity Readiness Questionnaire screens for exercise contraindications."},
    {"q": "What type of contraction occurs when a muscle lengthens under tension?", "a": "Eccentric contraction", "wrong": ["Concentric contraction", "Isometric contraction", "Isokinetic contraction only"], "exp": "Eccentric contractions occur during the lowering phase of resistance exercises."},
    {"q": "What is the recommended rest period between sets for muscular endurance training (12+ reps)?", "a": "30 seconds or less", "wrong": ["3-5 minutes", "2-3 minutes", "No rest between exercises"], "exp": "Short rest periods with higher reps develop muscular endurance."},
    {"q": "What is the primary muscle worked during a lat pull-down?", "a": "Latissimus dorsi", "wrong": ["Pectoralis major", "Anterior deltoid only", "Biceps brachii only"], "exp": "Lat pull-downs primarily target the latissimus dorsi through shoulder adduction/extension."},
    {"q": "What is the correct spotting position for a dumbbell incline bench press?", "a": "At the wrists or dumbbells", "wrong": ["At the client's knees", "At the barbell sleeves", "At the client's ankles"], "exp": "Spot at the dumbbells/wrists to assist without interfering with pressing mechanics."},
    {"q": "What is the SAID principle in exercise programming?", "a": "Specific Adaptations to Imposed Demands", "wrong": ["Specific Actions Improve Development", "Systematic Adaptation in Dynamic training", "Strength And Intensity Development"], "exp": "The body adapts specifically to the type of training stimulus applied."},
    {"q": "What is the primary energy source during a 2-hour marathon?", "a": "Carbohydrates and fats (aerobic metabolism)", "wrong": ["Phosphagen stores only", "Protein exclusively", "Stored creatine phosphate only"], "exp": "Long endurance events rely on aerobic metabolism using carbs and fats."},
    {"q": "What is the correct order of energy system depletion during maximal all-out exercise?", "a": "Phosphagen → Glycolytic → Oxidative", "wrong": ["Oxidative → Glycolytic → Phosphagen", "Glycolytic → Phosphagen → Oxidative", "Oxidative → Phosphagen → Glycolytic"], "exp": "Energy systems are recruited sequentially based on duration and intensity."},
    {"q": "What is the recommended duration for static stretches during cool-down?", "a": "15-30 seconds per stretch", "wrong": ["2-5 seconds per stretch", "2-3 minutes per stretch", "60-90 minutes per stretch"], "exp": "Holding static stretches 15-30 seconds improves flexibility without excessive strain."},
    {"q": "What is the primary purpose of a fitness assessment?", "a": "Establish baseline measurements to guide program design", "wrong": ["Replace the need for medical exams", "Determine genetic muscle fiber type definitively", "Guarantee certification exam passage"], "exp": "Assessments provide data to create individualized, effective training programs."},
    {"q": "What is the NCSF passing score requirement for the certification exam?", "a": "70%", "wrong": ["50%", "60%", "85%"], "exp": "The NCSF Personal Trainer certification exam requires a minimum score of 70% to pass."},
]

# Video contains 130 questions only (no supplemental items)
ALL = QUESTIONS[:130]
assert len(ALL) == 130, f"Expected 130 video questions, got {len(ALL)}"

# Plausible wrong answers keyed by correct answer (from video source)
CUSTOM_DISTRACTORS = {
    "Cardiovascular training and reduced sodium intake": ["Resistance training only with increased sodium intake", "Static stretching and increased caloric intake", "High-intensity plyometrics with no dietary changes"],
    "Tightness in the glutes": ["Tightness in the hip flexors", "Weakness in the quadriceps", "Tightness in the hamstrings only"],
    "Anterior tibialis": ["Gastrocnemius", "Soleus", "Peroneus longus"],
    "No joint movement": ["Shoulder flexion", "Shoulder abduction", "Shoulder extension"],
    "Barbell shrug": ["Barbell bench press", "Lateral raise", "Upright row"],
    "Kyphotic curve": ["Lordotic curve", "Scoliotic curve", "Neutral curve"],
    "Rhomboids": ["Latissimus dorsi", "Trapezius (upper)", "Teres major"],
    "Barbell bent-over row": ["Seated leg extension", "Bench press", "Leg press"],
    "Frontal": ["Sagittal", "Transverse", "Horizontal"],
    "Fully extended": ["Fully flexed at 90°", "Partially flexed at 45°", "In neutral position"],
    "Latissimus dorsi and deltoid": ["Pectoralis major and biceps", "Trapezius and rhomboids", "Triceps and coracobrachialis"],
    "Standing single-arm dumbbell press": ["Seated bilateral dumbbell press", "Machine chest press", "Lying triceps extension"],
    "Proprioception": ["Exteroception", "Nociception", "Equilibrioception only"],
    "Hip abductors": ["Hip adductors", "Hip flexors", "Quadriceps"],
    "Mitochondria": ["Nucleus", "Ribosome", "Golgi apparatus"],
    "Testosterone": ["Cortisol", "Insulin", "Aldosterone"],
    "Seated leg extension and hamstring stretch": ["Bench press and bicep curl", "Lat pull-down and calf raise", "Push-up and tricep extension"],
    "100-meter sprint": ["Marathon running", "30-minute jog", "2-hour cycling event"],
    "Isometric": ["Concentric only", "Eccentric only", "Ballistic"],
    "Acute increases in muscle size": ["Increased heart rate", "Elevated core temperature", "Increased motor unit recruitment"],
    "HDL will increase": ["LDL will increase", "Triglycerides will increase", "Total cholesterol will decrease only"],
    "Android obesity": ["Gynoid obesity", "Eutrophic body type", "Mesomorphic classification"],
    "Increased stroke volume": ["Decreased stroke volume", "Increased heart rate only", "Decreased cardiac output"],
    "Reduced HDL": ["Increased HDL", "Increased LDL only", "No effect on lipids"],
    "Trunk extension test": ["Sit-and-reach test", "Shoulder flexibility test", "Hip flexor length test"],
    "Reduction of blood pressure by 10 points": ["Increase of blood pressure by 10 points", "No change in blood pressure", "Reduction of only 2 points"],
    "Increased body fat": ["Decreased body fat", "Increased lean mass only", "No change in composition"],
    "Front squat": ["Leg press", "Seated calf raise", "Lat pull-down"],
    "Strength/power training": ["Static stretching only", "Sedentary activity", "Low-intensity walking only"],
    "Increased blood pressure": ["Decreased blood pressure", "Normal blood pressure", "Decreased cardiac output"],
    "Power": ["Flexibility", "Balance only", "Body composition only"],
    "Coronary artery disease": ["Osteoporosis", "Type I diabetes only", "Asthma"],
    "Males >30%; females >40%": ["Males >20%; females >25%", "Males >15%; females >20%", "Males >40%; females >50%"],
    "Closed chain balance training": ["Open chain isolation only", "Maximal eccentric loading", "Ballistic plyometrics only"],
    "Testing sub-maximal VO2": ["PAR-Q screening", "Blood pressure measurement", "Resting heart rate assessment"],
    "Carbohydrates": ["Fats only", "Proteins only", "Water"],
    "Fats": ["Carbohydrates only", "Protein only", "Vitamins"],
    "Stored ATP and stored creatine phosphate": ["Aerobic glycolysis", "Beta oxidation", "Protein metabolism"],
    "The liver (~100g)": ["The heart", "The kidneys", "Adipose tissue only"],
    "2-5 minutes": ["30-60 seconds", "10-15 minutes", "24-48 hours"],
    "Mitochondria": ["Lysosome", "Endoplasmic reticulum", "Peroxisome"],
    "Type I (slow-twitch oxidative)": ["Type IIa (fast oxidative)", "Type IIx (fast glycolytic)", "Type IIb only"],
    "Anaerobic": ["Aerobic only", "Oxidative phosphorylation", "Fat oxidation primarily"],
    "EPOC (Excess post-exercise oxygen consumption)": ["DOMS", "Muscle hypertrophy", "Glycogen supercompensation"],
    "Calcium": ["Sodium", "Potassium", "Magnesium"],
    "Peripheral fatigue": ["Central fatigue", "Psychological fatigue", "Cardiovascular fatigue"],
    "Golgi tendon organs": ["Muscle spindles", "Pacinian corpuscles", "Meissner corpuscles"],
    "Insulin": ["Glucagon", "Epinephrine", "Thyroxine"],
    "Cortisol": ["Insulin", "Growth hormone", "Melatonin"],
    "Insulin-like growth factor-1 (IGF-1)": ["Growth hormone only", "Testosterone only", "Cortisol"],
    "Testosterone, growth hormone, and IGF-1": ["Cortisol, insulin, and glucagon", "Estrogen and progesterone only", "Aldosterone and renin"],
    "Ballistic": ["Isometric", "Isokinetic", "Passive"],
    "Carotid": ["Femoral", "Radial", "Brachial"],
    "The Valsalva maneuver": ["Diaphragmatic breathing", "Pursed lip breathing", "Apical breathing"],
    "Systolic blood pressure × heart rate": ["Diastolic blood pressure × heart rate", "Stroke volume ÷ heart rate", "Cardiac output ÷ blood pressure"],
    "Shoulder flexion": ["Shoulder extension", "Shoulder abduction", "Shoulder external rotation"],
    "Shoulder adduction": ["Shoulder abduction", "Shoulder flexion", "Shoulder external rotation"],
    "Hip extension": ["Hip flexion", "Hip abduction", "Knee flexion"],
    "Quadriceps": ["Hamstrings", "Gluteus maximus only", "Gastrocnemius"],
    "Posterior pelvic tilt": ["Anterior pelvic tilt", "Lateral pelvic tilt", "Neutral pelvis only"],
    "Anterior tibialis": ["Gastrocnemius", "Soleus", "Plantaris"],
    "Transverse abdominis": ["Rectus abdominis only", "External oblique only", "Erector spinae"],
    "The chest": ["Behind the neck", "Above the head", "At the waist level"],
    "Tibia": ["Fibula", "Femur", "Talus"],
    "Lateral flexion": ["Rotation only", "Extension only", "Flexion only"],
    "Sagittal": ["Frontal", "Transverse", "Horizontal"],
    "Horizontal adduction": ["Horizontal abduction", "Vertical adduction", "Internal rotation only"],
    "An isometric contraction": ["A concentric contraction", "An eccentric contraction", "A ballistic contraction"],
    "An eccentric contraction": ["A concentric contraction", "An isometric contraction", "An isokinetic contraction"],
    "Lordosis": ["Kyphosis", "Scoliosis", "Lordopenia"],
    "Ligaments": ["Tendons", "Fascia", "Cartilage"],
    "Subscapularis": ["Supraspinatus", "Infraspinatus", "Teres minor"],
    "Hamstrings": ["Quadriceps", "Gastrocnemius", "Hip flexors"],
    "Lumbar region": ["Cervical region", "Thoracic region", "Sacral region only"],
    "Cervical region": ["Thoracic region", "Lumbar region", "Sacral region"],
    "Muscle fascia": ["Bone tissue", "Nerve tissue", "Adipose tissue only"],
    "Supraspinatus": ["Infraspinatus", "Subscapularis", "Teres minor"],
    "1:1": ["2:1", "3:1", "1:2"],
    "2:3": ["1:1", "3:2", "1:3"],
    "Smooth muscle": ["Skeletal muscle", "Cardiac muscle only", "Striated voluntary muscle"],
    "Gluteus medius and gluteus minimus": ["Gluteus maximus only", "Tensor fasciae latae only", "Piriformis only"],
    "Transverse": ["Sagittal", "Frontal", "Coronal only"],
    "Wrist": ["Elbow", "Shoulder", "Ankle"],
    "Medial rotation": ["Lateral rotation", "External rotation", "Supination"],
    "Above or higher than another structure": ["Below or lower than another structure", "Lateral to another structure", "Posterior to another structure"],
    "Front and back halves": ["Left and right halves", "Superior and inferior halves", "Proximal and distal halves"],
    "Ball-and-socket": ["Hinge", "Pivot", "Saddle"],
    "3500 kcal": ["2500 kcal", "4500 kcal", "1500 kcal"],
    "Creeping obesity": ["Morbid obesity", "Anorexia", "Ectomorphic classification"],
    "3-5% for males; 11-14% for females": ["8-10% for males; 18-20% for females", "1-2% for males; 5-7% for females", "10-15% for males; 20-25% for females"],
    "Yo-yo dieting": ["Bulimia nervosa", "Binge eating disorder", "Orthorexia"],
    "70%": ["50%", "85%", "60%"],
    "Arms are not fully extended at the top of the concentric phase, hips are lifted off the bench, or the wrists and elbows lose alignment": [
        "Keeping hips firmly on the bench with no elbow extension errors",
        "Maintaining strict neutral wrist alignment with partial elbow bend only",
        "Using a flat foot position with no hip lift or alignment issues",
    ],
    "Relative hormonal response": ["Exercise duration only", "Participant age", "Ambient temperature"],
    "Low blood glucose": ["High blood glucose", "Elevated muscle glycogen", "Increased protein sparing"],
    "Smaller relative heart size": ["Larger relative lung volume only", "Higher hemoglobin concentration", "Greater maximal heart rate"],
    "Capillaries": ["Arterioles", "Veins", "Alveoli"],
    "Controlled degree of spinal flexion": ["Maximal spinal extension", "No trunk movement", "Uncontrolled lumbar hyperextension"],
    "Days to weeks": ["Months to years", "Immediately after one session", "Within minutes of training"],
    "24-48 hours": ["12-24 hours", "1-3 hours after exercise", "48-72 hours"],
    "Glycogen": ["Triglycerides", "Creatine phosphate", "Plasma albumin"],
    "Soleus": ["Gastrocnemius", "Plantaris", "Tibialis anterior"],
    "Reducing chronic psychological stress": ["Increasing dietary sodium", "Reducing flexibility training", "Limiting aerobic activity"],
    "Vascular compliance": ["Vascular resistance", "Peripheral vasoconstriction", "Arterial plaque formation"],
    "Myofascial release": ["Static stretching only", "Joint mobilization only", "Heavy resistance loading"],
    "Carbohydrates, fats, protein and various associated substrates": [
        "Carbohydrates only",
        "Fats only",
        "Protein exclusively",
    ],
    "Heart rate": ["Stroke volume", "Peripheral resistance", "Blood viscosity"],
    "Via increased motor unit recruitment, faster firing rates, and improved motor unit synchrony": [
        "Via muscle hypertrophy only",
        "Via increased capillary density only",
        "Via improved tendon elasticity only",
    ],
    "Insufficient oxygen, reduced enzyme activity, and tubular system disturbance": [
        "Excess phosphagen availability",
        "Improved oxygen delivery only",
        "Increased neural inhibition only",
    ],
    "Rectus femoris (hip flexor/knee extensor); Biceps femoris (knee flexor/hip extensor); Gastrocnemius (plantar flexor/knee flexor)": [
        "Vastus medialis only (single-joint knee extensor)",
        "Tibialis anterior only (single-joint dorsiflexor)",
        "Gluteus maximus only (single-joint hip extensor)",
    ],
    "75-150 kcals": ["300-500 kcals", "10-25 kcals", "500-750 kcals"],
    "60-70% (resting metabolic), 15-35% (physical activity), up to 10% (thermic effect of food)": [
        "20-30% resting metabolic, 60-70% activity, 10% TEF",
        "40-50% resting metabolic, 40-50% activity, 10% TEF",
        "80-90% resting metabolic, 5-10% activity, 5% TEF",
    ],
    "The fat-burning zone is associated with lower training intensities and lower caloric expenditure; total calories burned are too low for effective weight loss": [
        "The fat-burning zone maximizes total caloric expenditure at all intensities",
        "Lower intensity always burns more total calories than higher intensity",
        "Fat oxidation percentage is the only factor that determines weight loss",
    ],
    "Processed carbohydrates/simple sugars": ["Unsaturated fats", "Lean proteins", "Dietary fiber"],
    "25": ["18", "30", "35"],
    "Heart disease": ["Osteoporosis", "Asthma", "Type I diabetes only"],
    "Positive caloric balance combined with high-volume, progressive resistance training": [
        "Caloric deficit with aerobic training only",
        "Caloric balance with stretching only",
        "Negative caloric balance with power training",
    ],
    "Social, economic, physiological, psychological, and emotional": [
        "Genetic, anatomical, and chronological only",
        "Nutritional, hormonal, and metabolic only",
        "Environmental and occupational only",
    ],
    "Water and glycogen stores": ["Adipose tissue only", "Bone mineral content", "Plasma protein stores"],
    "Aerobic training": ["Static stretching", "Isolated balance drills only", "Passive rest"],
    "By optimally regulating blood glucose, reducing insulin surges, and lowering the risk for appetite-driven overeating throughout the day": [
        "By maximizing single large meals to reduce eating frequency",
        "By eliminating carbohydrates entirely between meals",
        "By fasting for 24 hours between workouts",
    ],
    "Spot reduction": ["Muscle confusion", "Periodization", "Supercompensation"],
    "Bulimia nervosa": ["Anorexia nervosa", "Binge eating disorder without purging", "Orthorexia nervosa"],
    "Joint-related injuries/laxity instability": ["Muscle strains only", "Cardiovascular events", "Thermoregulatory failure"],
    "Asthma": ["Hypertension", "Osteoarthritis", "Type II diabetes only"],
    "Power training": ["Static stretching only", "Sedentary activity", "Low-intensity walking only"],
    "Aerobic exercise": ["Maximal heavy resistance training", "Ballistic plyometrics only", "Isometric holds only"],
    "12-15 repetitions": ["1-3 repetitions", "20-25 repetitions", "30-40 repetitions"],
    "Thermoregulatory periods": ["Maximal strength testing periods", "Prolonged static stretching periods", "Heavy Valsalva lifting periods"],
}

TIME_RANGE_POOL = [
    "12-24 hours after exercise",
    "1-3 hours after exercise",
    "Immediately after exercise",
    "48-72 hours after exercise",
    "5-10 minutes after exercise",
    "30-60 minutes after exercise",
    "3-5 days after exercise",
    "Within the first hour",
    "2-4 weeks after training",
    "Months to years",
]

PERCENT_POOL = [
    "20-30% resting metabolic, 60-70% activity, 10% TEF",
    "40-50% resting metabolic, 40-50% activity, 10% TEF",
    "80-90% resting metabolic, 5-10% activity, 5% TEF",
    "50-60% resting metabolic, 30-40% activity, 10% TEF",
]

PLANE_POOL = ["Sagittal", "Frontal", "Transverse"]

MUSCLE_POOL = [
    "Biceps brachii", "Triceps brachii", "Pectoralis major", "Trapezius",
    "Gastrocnemius", "Soleus", "Rectus abdominis", "Latissimus dorsi",
    "Rhomboids", "Deltoid", "Hamstrings",
]

HORMONE_POOL = ["Cortisol", "Insulin", "Glucagon", "Epinephrine", "Growth hormone", "Estrogen", "Aldosterone"]

STRUCTURE_POOL = ["Mitochondria", "Nucleus", "Ribosome", "Golgi apparatus", "Lysosome", "Peroxisome", "Sarcomere"]

SUBSTANCE_POOL = ["Glycogen", "Glucose", "Triglycerides", "Creatine phosphate", "Lactate", "ATP"]

INTERVENTION_POOL = [
    "Aerobic training only",
    "Static stretching program",
    "Plyometric training only",
    "Circuit training with no progression",
    "Resistance training with no progression",
    "Low-intensity walking only",
]


def _pick_pool_distractors(pool, correct, count=3):
    correct_lower = correct.lower()
    picks = []
    for item in pool:
        if item.lower() == correct_lower:
            continue
        if item not in picks:
            picks.append(item)
        if len(picks) >= count:
            break
    return picks[:count]


def classify_answer_type(correct, question):
    c = correct.lower().strip()
    q = question.lower()

    if re.search(r"\d+\s*-\s*\d+\s*(hours?|minutes?|mins?|seconds?|days?|weeks?)", c, re.I):
        return "time_range"
    if re.search(r"\d+\s*(hours?|minutes?|mins?|seconds?|days?|weeks?|months?)", c, re.I):
        return "time_range"
    if "days to weeks" in c or ("hour" in c and re.search(r"\d", c)):
        return "time_range"

    if re.search(r"\d+%", c) or re.search(r"\d+:\d+", c) or re.search(r"\d+\s*kcal", c, re.I):
        return "percent_numeric"
    if re.fullmatch(r"\d+", c.strip()):
        return "percent_numeric"

    if c in ("sagittal", "frontal", "transverse") or c == "sagittal and transverse":
        return "plane"

    if any(s in c for s in ("mitochondria", "capillar", "golgi", "sarcomere", "spindle", "ribosome", "nucleus")):
        return "structure"

    if c in ("glycogen", "carbohydrates", "fats", "glucose", "calcium", "iron", "fiber", "water and glycogen stores"):
        return "substance"

    if "hormone" in q or any(h in c for h in ("insulin", "cortisol", "testosterone", "glucagon", "igf", "estradiol")):
        return "hormone"

    if len(correct) > 55:
        return "concept"

    if (
        len(correct) < 40
        and any(m.lower() in c for m in MUSCLE_POOL)
        and any(k in q for k in ("muscle", "mover", "prime mover", "antagonist", "rotator", "stretch"))
    ):
        return "muscle"

    if any(t in c for t in ("training", "exercise", "stretch", "release", "aerobic", "walk")):
        return "intervention"

    return "general"


def get_distractors(correct, question, item):
    if "wrong" in item:
        return [w for w in item["wrong"] if w.lower() != correct.lower()][:3]

    if correct in CUSTOM_DISTRACTORS:
        return CUSTOM_DISTRACTORS[correct][:3]

    answer_type = classify_answer_type(correct, question)
    pools = {
        "time_range": TIME_RANGE_POOL,
        "percent_numeric": PERCENT_POOL,
        "plane": PLANE_POOL,
        "muscle": MUSCLE_POOL,
        "hormone": HORMONE_POOL,
        "structure": STRUCTURE_POOL,
        "substance": SUBSTANCE_POOL,
        "intervention": INTERVENTION_POOL,
    }

    if answer_type in pools:
        distractors = _pick_pool_distractors(pools[answer_type], correct)
        if len(distractors) == 3:
            return distractors

    q = question.lower()
    if "plane" in q:
        return _pick_pool_distractors(PLANE_POOL, correct)
    if "hormone" in q:
        return _pick_pool_distractors(HORMONE_POOL, correct)
    if "muscle" in q or "mover" in q:
        return _pick_pool_distractors(MUSCLE_POOL, correct)
    if "vitamin" in q or "mineral" in q or "nutri" in q or "diet" in q:
        return _pick_pool_distractors(
            ["Vitamin A", "Vitamin D", "Vitamin K", "Iron", "Zinc", "Calcium", "Magnesium"], correct
        )
    if "bone" in q or "spine" in q:
        return _pick_pool_distractors(
            ["Femur", "Humerus", "Fibula", "Cervical vertebrae", "Sacrum"], correct
        )

    return _pick_pool_distractors(INTERVENTION_POOL, correct)

def generate_questions_js(items, out_path, seed=42):
    import importlib.util
    import random

    _spec = importlib.util.spec_from_file_location(
        "parse_quiz_txt", str(ROOT / "parse_quiz_txt.py")
    )
    _pqt = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_pqt)

    random.seed(seed)
    output = []
    for idx, item in enumerate(items, 1):
        correct = item["a"]
        wrong = get_distractors(correct, item["q"], item)
        options = wrong + [correct]
        random.shuffle(options)
        correct_index = options.index(correct)
        output.append({
            "id": idx,
            "question": item["q"],
            "options": options,
            "correctIndex": correct_index,
            "explanation": item["exp"],
        })
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("const EXAM_QUESTIONS = ")
        json.dump(output, f, indent=2)
        f.write(";\n")
    return output


if __name__ == "__main__":
    out_path = str(ROOT / "shuffledtest" / "questions.js")
    result = generate_questions_js(ALL, out_path)
    print(f"Generated {len(result)} questions to {out_path}")