/** Approved visual scenario only. This is not a live service response. */
export const briefingDemo = {
  user: 'Emily',
  timestamp: '10:24 AM · 26 Sep 2026',
  plan: 'PLAN-023',
  activeVehicles: 16,
  totalVehicles: 18,
  totalOrders: 128,
  onTime: 95,
  incident: { id: 'INC-014', vehicle: 'V03', affectedOrders: ['O18', 'O25', 'O31'], routes: 1, since: '10:18 AM', status: 'Awaiting review' },
  risks: [
    { id: 'O18', description: 'Delivery window risk', detail: 'ETA may be delayed by 45 min', level: 'High' },
    { id: 'O25', description: 'Delivery window risk', detail: 'Delivery window requires review', level: 'Medium' },
  ],
  prompts: [
    { label: 'Why is O18 at risk?', answer: 'In this demo, O18 is assigned to V03. The vehicle is unavailable and the estimated delay is 45 minutes, putting its delivery window at risk.' },
    { label: 'What happened to V03?', answer: 'This demo records V03 as unavailable at 10:18 AM. Incident INC-014 affects one route and three orders: O18, O25 and O31.' },
    { label: 'Show recommended actions.', answer: 'Review the unavailable vehicle and its three affected orders, then assess a recovery plan. No plan has been generated or applied in this preview.' },
    { label: 'Summarize current plan.', answer: 'Demo plan PLAN-023 has 128 orders and 16 of 18 vehicles operating. Two delivery windows are at risk; on-time performance is 95%.' },
  ],
};
