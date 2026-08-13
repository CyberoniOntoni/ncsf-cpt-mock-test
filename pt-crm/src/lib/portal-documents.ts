export const REQUIRED_PORTAL_DOCUMENTS = [
  {
    type: "waiver",
    title: "Training waiver & liability release",
    version: "1",
    body: `I understand personal training involves physical activity and risk of injury. I participate voluntarily, disclose relevant health limits to my trainer, and release the studio and trainer from claims arising from ordinary negligence. This is a coaching waiver, not medical advice.`,
  },
  {
    type: "par_q",
    title: "PAR-Q readiness screen",
    version: "1",
    body: `I confirm I have discussed chest pain, dizziness, bone/joint problems, prescribed medication for blood pressure or heart, and any reason I should not exercise with my trainer or a clinician if needed. I will stop and tell my trainer if I feel unwell.`,
  },
] as const;
