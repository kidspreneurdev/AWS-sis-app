// Master It — per-student role/question assignments. Each Business English 2.0 case-study
// module has its own fixed bank of ~25 roles (a category + a specific question), transcribed
// from "Master it Questions.pdf". An admin assigns one role per student from a module's bank
// (see AssignRolesModal in LMSPage.tsx); the assignment is stored per (contentId, studentId)
// in the lms_presentation_roles table, not here — this file is just the static question bank.

export interface PresentationRole {
  number: number
  label: string
  text: string
}

export interface PresentationRoleModule {
  key: string
  title: string
  roles: PresentationRole[]
}

export const PRESENTATION_ROLE_MODULES: PresentationRoleModule[] = [
  {
    key: 'brightleaf',
    title: 'BrightLeaf',
    roles: [
      { number: 1, label: 'Marketing', text: 'Should BrightLeaf pursue the Head of Marketing’s “slow productivity” rebrand aimed at younger consumers? Design a plan that grows the under-25 segment without damaging loyalty among customers over 40.' },
      { number: 2, label: 'Finance', text: 'Model the financial tradeoff between the e-commerce partnership’s revenue-share cost and a self-funded internal marketing budget of similar size. Which delivers better return over 12 months?' },
      { number: 3, label: 'Strategy', text: 'Evaluate the three offers (buyout, e-commerce partnership, internal pivot) side by side. Recommend one, and justify why the other two are inferior given BrightLeaf’s 14-month cash runway.' },
      { number: 4, label: 'Product', text: 'The daily planner format has underperformed since its launch. Should BrightLeaf discontinue it, redesign it, or keep it as-is? Propose a specific plan.' },
      { number: 5, label: 'Product', text: 'Pen revenue is the only growing category. Design a plan to expand the refillable pen line further to capture more of the “analog hobby” trend described in Section 4.' },
      { number: 6, label: 'Customer Retention', text: 'Design a specific plan to protect the over-40 customer segment (Section 7) during any rebrand or pivot, given their higher spend and repeat-purchase rate.' },
      { number: 7, label: 'Customer Acquisition', text: 'Design a plan to convert the growing direct-to-consumer website traffic (Section 6) into actual revenue growth, since traffic has grown while overall revenue has fallen.' },
      { number: 8, label: 'Marketing/Communications', text: 'Only 38% of customers know BrightLeaf’s paper is recycled and FSC-certified (Section 7). Design a communications campaign to close this awareness gap.' },
      { number: 9, label: 'Operations', text: 'Should BrightLeaf move to contract manufacturing to increase flexibility, or keep its owned production facility? Weigh the tradeoffs using evidence from Sections 3 and 11.' },
      { number: 10, label: 'Human Resources', text: 'The production workforce skews older with 9-year average tenure. Propose a workforce plan that supports any major pivot without abandoning loyal, long-tenured staff.' },
      { number: 11, label: 'Competitive Strategy', text: 'GreenQuill is growing 18% a year but has inconsistent product quality. Design a plan for BrightLeaf to compete directly against GreenQuill using its quality advantage.' },
      { number: 12, label: 'Pricing', text: 'Customers report confusion about why BrightLeaf costs more than marketplace alternatives (Section 16). Design a pricing and communications strategy that justifies the premium.' },
      { number: 13, label: 'Distribution', text: 'Retail partner count has declined 36% in four years (Section 6). Propose a distribution strategy to offset the loss of independent retail partners.' },
      { number: 14, label: 'Digital Strategy', text: 'Design a specific content and creator-partnership plan for BrightLeaf, learning from the fact that 3 of 5 recent partnerships underperformed (Section 8).' },
      { number: 15, label: 'Risk Management', text: 'Identify the single greatest risk facing BrightLeaf regardless of which offer is chosen, and propose how leadership should prepare for it.' },
      { number: 16, label: 'Mergers & Acquisitions', text: 'If BrightLeaf accepts the conglomerate buyout, what specific contract terms should it negotiate to protect its production facility, staff, and brand identity?' },
      { number: 17, label: 'Partnerships', text: 'If BrightLeaf accepts the e-commerce partnership, what specific terms should it negotiate regarding revenue-share percentage, contract length, and creative control?' },
      { number: 18, label: 'Leadership & Succession', text: 'The founder is 61 and discussing retirement. Propose a leadership succession plan that fits with whichever strategic direction you believe BrightLeaf should take.' },
      // 19. Sustainability — removed from the assignment (per the question bank PDF).
      { number: 20, label: 'Market Expansion', text: 'Should BrightLeaf expand beyond its three-state footprint? Propose a specific geographic or channel expansion plan using evidence from Section 17.' },
      { number: 21, label: 'Customer Segmentation', text: 'Using the data in Section 7, design a plan that treats BrightLeaf’s four age segments as four different marketing strategies rather than one single approach.' },
      { number: 22, label: 'Crisis Communication', text: 'Draft a plan for how BrightLeaf should communicate its decision (whichever it is) to its loyal customer base without causing a loss of trust or a backlash.' },
      { number: 23, label: 'Data & Research', text: 'BrightLeaf’s customer research is two years old (Section 7) and its finance team lacks robust modeling capacity (Section 11). Propose a research and data plan to fill these gaps before the final decision is made.' },
      { number: 24, label: 'Innovation', text: 'Propose one entirely new product or product line for BrightLeaf, using evidence from the case (customer research, industry trends, competitor gaps) to justify it.' },
      { number: 25, label: 'Executive Recommendation', text: 'You are the outside consultant. Write and present the final recommendation memo to the founder, synthesizing financial, marketing, operational, and risk considerations into one clear decision.' },
    ],
  },
  {
    key: 'pulsefit',
    title: 'PulseFit',
    roles: [
      { number: 1, label: 'Crisis Strategy', text: 'Compare all three response options (Section 9). Which should PulseFit choose, and why are the other two weaker?' },
      { number: 2, label: 'Communications', text: 'Draft the specific public statement PulseFit’s CEO should give in the 48-hour morning show interview.' },
      { number: 3, label: 'Legal', text: 'What legal risks does each of the three options carry (Section 16), and how should PulseFit mitigate them?' },
      { number: 4, label: 'Product Safety', text: 'What should PulseFit’s engineering team investigate first to confirm root cause faster (Sections 6–7)?' },
      { number: 5, label: 'Customer Remediation', text: 'Design a compensation and support plan for the 23 already affected customers, independent of the broader recall decision.' },
      { number: 6, label: 'Social Media', text: 'Design a social media response strategy that addresses the sentiment shift described in Section 15.' },
      { number: 7, label: 'Media Relations', text: 'How should PulseFit prepare for and handle the scheduled morning show interview? Build a media strategy.' },
      { number: 8, label: 'Brand Trust', text: 'Using Section 18 data, design a plan to rebuild trust specifically among PulseFit’s long-tenured customers.' },
      { number: 9, label: 'Internal Communications', text: 'Design an internal communication plan for the customer support team and broader workforce (Section 11).' },
      { number: 10, label: 'Regulatory Strategy', text: 'Should PulseFit proactively contact regulators before they open an inquiry (Section 4)? Justify your answer.' },
      { number: 11, label: 'Supply Chain & QA', text: 'Evaluate whether PulseFit’s contract manufacturing and quality control practices (Section 10) need to change, regardless of the crisis outcome.' },
      { number: 12, label: 'Financial Analysis', text: 'Using Section 17’s cost model, evaluate which option is most financially sound — and whether the model’s finding (delay costs more) should be trusted.' },
      { number: 13, label: 'Ethics', text: 'How should PulseFit handle the earlier internal warning memo (Section 21), both publicly and internally?' },
      { number: 14, label: 'Competitive Positioning', text: 'How might competitors react to PulseFit’s crisis, and how should PulseFit position itself against them (Section 5)?' },
      { number: 15, label: 'Industry Precedent', text: 'Using Section 22, evaluate which lessons from prior industry crisis cases most apply to PulseFit’s decision.' },
      { number: 16, label: 'Executive Communication', text: 'Write the CEO’s opening statement for the TV interview, addressing the crisis directly in the first 30 seconds.' },
      { number: 17, label: 'Data Analysis', text: 'Is the complaint clustering data in Section 7 strong enough evidence to justify a targeted recall? Argue your position.' },
      { number: 18, label: 'Decision Timing', text: 'Should PulseFit ask to delay the scheduled interview (Section 19)? Weigh the risks of asking against the risks of not asking.' },
      { number: 19, label: 'Stakeholder Analysis', text: 'Compare the Head of Engineering’s and the crisis consultant’s positions in Section 9. Whose reasoning is stronger, and why?' },
      { number: 20, label: 'Organizational Culture', text: 'Propose changes to PulseFit’s testing and QA culture (Sections 10–11) to prevent a repeat of this situation.' },
      { number: 21, label: 'Investor Relations', text: 'How should PulseFit communicate this crisis to its minority investors (Sections 16–17)?' },
      { number: 22, label: 'Customer Segmentation', text: 'Using Section 18, design different communication approaches for long-tenured versus newer PulseFit customers.' },
      { number: 23, label: 'Risk Prioritization', text: 'Rank the six risk factors in Section 12 from most to least urgent, and justify your ranking with evidence.' },
      { number: 24, label: 'Ethical Argument', text: 'Is it ethical for PulseFit to delay public acknowledgment until the investigation concludes? Argue a clear position.' },
      { number: 25, label: 'Executive Recommendation', text: 'You are the outside consultant. Write the final recommendation memo to the CEO, synthesizing legal, financial, engineering, and communications considerations.' },
    ],
  },
  {
    key: 'byteloop',
    title: 'ByteLoop',
    roles: [
      { number: 1, label: 'Strategy', text: 'Compare all three response options (Section 9). Which should ByteLoop choose, and why are the other two weaker?' },
      { number: 2, label: 'Domestic Legal Strategy', text: 'Evaluate the strength of Loopstream’s “least restrictive means” argument (Section 16). Is Project Lighthouse a strong enough alternative to win in court?' },
      { number: 3, label: 'International Trade Law', text: 'Explain how GATS Article XIV bis (Section 24) could shield Meridian’s law from a WTO challenge, and whether Corvenia should still pursue one.' },
      { number: 4, label: 'Investment Law', text: 'Assess whether a forced sale under Option B could trigger an investor-state arbitration claim under the Meridian-Corvenia bilateral investment treaty (Section 24).' },
      { number: 5, label: 'Human Rights Law', text: 'Explain the difference between Meridian’s domestic “least restrictive means” test and its ICCPR Article 19 treaty obligations (Section 24). Does the law violate one, both, or neither?' },
      { number: 6, label: 'Trade Non-Discrimination', text: 'Compare Meridian’s law to Drassia’s origin-neutral framework (Section 21). Does Meridian’s design create unnecessary legal risk it could have avoided?' },
      { number: 7, label: 'Diplomatic Relations', text: 'Assess the risk that this dispute spills into unrelated Meridian-Corvenia trade negotiations (Section 22), and what ByteLoop can do about a risk it doesn’t control.' },
      { number: 8, label: 'Financial Analysis', text: 'Using Section 17’s cost model, evaluate which option is most financially sound — and whether pursuing multiple options in parallel changes that analysis.' },
      { number: 9, label: 'Creator Economy', text: 'Using Section 7, design a plan to slow the creator-hedging trend (47% and rising) regardless of which final option is chosen.' },
      { number: 10, label: 'Media & PR Strategy', text: 'Design ByteLoop’s public communications strategy for the remainder of the litigation period, using Section 8 and Section 15 evidence.' },
      { number: 11, label: 'Data Architecture', text: 'Evaluate whether Project Lighthouse’s technical design (Section 10) actually addresses Meridian lawmakers’ underlying concern, or only part of it.' },
      { number: 12, label: 'Workforce', text: 'Design a plan to address Meridian employee anxiety and retention risk (Section 11) during the uncertainty period.' },
      { number: 13, label: 'Ethics', text: 'How should Loopstream handle the earlier, unfunded internal restructuring proposal from two and a half years ago (Section 23), publicly and internally?' },
      { number: 14, label: 'Competitive Positioning', text: 'Using Section 5, assess how much of ByteLoop’s Meridian user base is realistically recoverable if the deadline passes without resolution.' },
      { number: 15, label: 'Regulatory Precedent', text: 'Using Section 21, identify which of the five country precedents is most favorable to Loopstream’s legal position, and explain why.' },
      { number: 16, label: 'Advertiser Trust', text: 'Using Section 18, design a plan to retain ByteLoop’s largest Meridian advertisers during the uncertainty period.' },
      { number: 17, label: 'Decision Sequencing', text: 'Evaluate the CEO’s proposal to pursue litigation and Project Lighthouse simultaneously (Section 9). Does this strengthen ByteLoop’s position or undermine its credibility, per General Counsel’s concern?' },
      { number: 18, label: 'Executive Communication', text: 'Draft the key messages Loopstream’s CEO should use when publicly explaining the company’s chosen strategy to Meridian users.' },
      { number: 19, label: 'Stakeholder Analysis', text: 'Compare the Head of Meridian Operations’ and General Counsel’s positions in Section 9. Whose reasoning better serves ByteLoop’s long-term interests, and why?' },
      { number: 20, label: 'International Precedent Deep-Dive', text: 'Compare Solenne’s outright ban to Tarquena’s formal review process (Section 21). Which model would have produced a better outcome for a company in ByteLoop’s position?' },
      { number: 21, label: 'Investor Relations', text: 'How should Loopstream communicate this dispute and its risks to its Corvenian and international investors?' },
      { number: 22, label: 'Risk Prioritization', text: 'Rank the six risk factors in Section 12 from most to least urgent, and justify your ranking with evidence.' },
      { number: 23, label: 'Global Sentiment', text: 'Using Section 15, explain why international reaction to the law has varied so much by region, and what that means for ByteLoop’s global strategy beyond Meridian.' },
      { number: 24, label: 'Historical Precedent (Internal)', text: 'The government-device ban 18 months before the current law (Section 6) drew little controversy. What does that difference tell you about why the current law provoked such a strong reaction?' },
      { number: 25, label: 'Executive Recommendation', text: 'You are the outside consultant. Write the final recommendation memo to the CEO, synthesizing legal, financial, diplomatic, and international-law considerations from across the case.' },
    ],
  },
  {
    key: 'larkspur',
    title: 'Larkspur',
    roles: [
      { number: 1, label: 'Strategy', text: 'Compare all three strategic options (Section 9). Which should Larkspur choose, and why are the other two weaker?' },
      { number: 2, label: 'Storytelling Craft', text: 'Using Section 10’s five techniques, explain which ones can still work today and which ones have been permanently broken by lab-grown diamonds.' },
      { number: 3, label: 'Consumer Research', text: 'Using Section 11, explain what the generational split in messaging effectiveness means for Larkspur’s final decision.' },
      { number: 4, label: 'Financial Analysis', text: 'Using Section 17’s cost model, evaluate which option is most financially sound — and how much you trust Option C’s projections given the company’s lack of licensing experience.' },
      { number: 5, label: 'Workforce & Ethics', text: 'Design a plan to address Larkspur’s obligations to its Kuranda mining workforce (Section 12), regardless of which option is chosen.' },
      { number: 6, label: 'Competitive Positioning', text: 'Using Section 8, assess how Larkspur should respond specifically to ClearForge’s “the story isn’t true anymore” narrative.' },
      { number: 7, label: 'Media & PR Strategy', text: 'Using Section 16, design Larkspur’s public communications strategy for addressing the “outdated story” narrative in the press.' },
      { number: 8, label: 'Global Strategy', text: 'Using Section 19, evaluate whether Larkspur should pursue a different strategic option in different regions, and what risk that creates.' },
      { number: 9, label: 'Ethics', text: 'Using Section 18, take a position: was the original 1949 campaign always somewhat dishonest, or was it a legitimate use of a true fact? Explain how your answer affects your recommendation.' },
      { number: 10, label: 'Precedent Analysis', text: 'Using Section 22, identify which legacy-brand precedent is most relevant to Larkspur’s situation, and explain why.' },
      { number: 11, label: 'Executive Communication', text: 'Draft the key messages Larkspur’s Chairman should use when publicly explaining the company’s chosen strategy to loyal, longtime customers.' },
      { number: 12, label: 'Risk Prioritization', text: 'Rank the six risk factors in Section 13 from most to least urgent, and justify your ranking with evidence.' },
      { number: 13, label: 'Brand Licensing Model', text: 'Evaluate whether Option C’s brand-licensing strategy (Sections 9 and 17) is realistic for a company with no prior licensing experience.' },
      { number: 14, label: 'Product Strategy', text: 'Using Sections 4 and 7, explain why Larkspur’s atelier business has held up better than its mass-market business, and what that means for the company’s next move.' },
      { number: 15, label: 'Storytelling Deep-Dive', text: 'Using Sections 3 and 10, explain specifically how Whitfield & Marsh’s original technique of “narrative embedding” could or couldn’t be recreated today.' },
      { number: 16, label: 'Regulatory Strategy', text: 'Evaluate whether Larkspur should support mandatory lab-grown disclosure labeling laws, as part of Option A, and what risk that political strategy carries.' },
      { number: 17, label: 'Ethics, Revisited', text: 'Using Section 23, explain how the earlier, unfunded internal proposal from eight years ago should affect how much the board trusts its current instincts.' },
      { number: 18, label: 'Board Priorities', text: 'Using Section 20, choose ONE open question the board raised and propose a specific, actionable answer to it.' },
      { number: 19, label: 'Stakeholder Analysis', text: 'Compare the Chairman’s and the Chief Storytelling & Brand Officer’s positions in Section 9. Whose reasoning is stronger, and why?' },
      { number: 20, label: 'Decision Sequencing', text: 'Evaluate whether Larkspur could pursue elements of more than one option at once (e.g., Option A in some markets, Option B in others) without undermining message discipline.' },
      { number: 21, label: 'Data Interpretation', text: 'Using Sections 7 and 11, whose reading of the atelier revenue data is more convincing — the Chairman’s or the Chief Storytelling & Brand Officer’s?' },
      { number: 22, label: 'Creative Storytelling', text: 'Draft an original, one-paragraph “new story” for Larkspur under Option B — one that could realistically replace “A Diamond Is Eternal” — and explain which of Section 10’s five techniques you used.' },
      { number: 23, label: 'Customer Segmentation', text: 'Using Section 11, design a plan that treats Larkspur’s under-35 and over-50 customers as two different audiences requiring two different messages.' },
      { number: 24, label: 'Investor Relations', text: 'How should Larkspur communicate the financial risks of each option (Section 17) to its shareholders?' },
      { number: 25, label: 'Executive Recommendation', text: 'You are the outside consultant. Write the final recommendation memo to the Chairman and Board, synthesizing financial, workforce, ethical, and storytelling considerations from across the case.' },
    ],
  },
  {
    key: 'dwelly',
    title: 'Dwelly',
    roles: [
      { number: 1, label: 'Strategy', text: 'Compare all three strategic options (Section 7). Which should Dwelly choose, and why are the other two weaker?' },
      { number: 2, label: 'Financial Analysis', text: 'Using Section 8, evaluate how reliable Dwelly’s LTV:CAC ratio actually is as evidence for Option A.' },
      { number: 3, label: 'Fundraising Risk', text: 'Using Section 17, assess how realistic Option A’s fundraising assumption is given current market conditions.' },
      { number: 4, label: 'Operations', text: 'Using Section 9, evaluate whether Dwelly’s refurbishment capability can realistically survive a transition to Option B.' },
      { number: 5, label: 'Workforce', text: 'Design a plan to address Dwelly’s operational workforce concerns (Section 10) under Option B or Option C.' },
      { number: 6, label: 'Competitive Positioning', text: 'Using Section 5, assess how Dwelly should respond to competitor Newstorthy’s marketplace expansion strategy.' },
      { number: 7, label: 'Customer Research', text: 'Using Section 14, explain what the flexibility-vs-cost segmentation means for how Dwelly should message itself going forward.' },
      { number: 8, label: 'Marketplace Feasibility', text: 'Using Sections 9 and 20, evaluate whether Option B can realistically maintain Dwelly’s quality standard.' },
      { number: 9, label: 'Acquisition Terms', text: 'Using Section 16, identify the most important unresolved term in the acquisition offer, and explain why the board should not proceed without resolving it.' },
      { number: 10, label: 'Regional Strategy', text: 'Using Section 23, evaluate whether Dwelly should pursue a hybrid strategy that varies by city rather than a single company-wide option.' },
      { number: 11, label: 'Brand & Sustainability', text: 'Using Section 22, design a plan for how Dwelly could use its circular-economy story as part of its strategy, regardless of which option is chosen.' },
      { number: 12, label: 'Risk Prioritization', text: 'Rank the six risk factors in Section 11 from most to least urgent, and justify your ranking with evidence.' },
      { number: 13, label: 'Ethics & Hindsight', text: 'Using Section 21, explain how the shelved marketplace pilot from two years ago should affect how much the board trusts its current instincts.' },
      { number: 14, label: 'Investor Relations', text: 'Using Section 17, design a plan for how Dwelly should communicate the risks of each option to its existing investors.' },
      { number: 15, label: 'Executive Communication', text: 'Draft the key messages Dwelly’s CEO should use when explaining the board’s chosen strategy to the full company.' },
      { number: 16, label: 'Precedent Analysis', text: 'Using Section 20, identify which startup-scaling precedent is most relevant to Dwelly’s situation, and explain why.' },
      { number: 17, label: 'Data Interpretation', text: 'Using Sections 6 and 8, explain why company-wide averages may be misleading the board about Dwelly’s true growth trajectory.' },
      { number: 18, label: 'Workforce Transition', text: 'Design a specific transition plan for Dwelly’s refurbishment technicians (Section 10) under Option B.' },
      { number: 19, label: 'Board Priorities', text: 'Using Section 18, choose ONE open question the board raised and propose a specific, actionable answer to it.' },
      { number: 20, label: 'Stakeholder Analysis', text: 'Compare the CEO’s and the CFO’s positions in Section 7. Whose reasoning is stronger, and why?' },
      { number: 21, label: 'Decision Sequencing', text: 'Evaluate whether Dwelly can safely pursue fundraising (Option A) and acquisition (Option C) conversations simultaneously, per Section 18’s sequencing question.' },
      { number: 22, label: 'Customer Segmentation', text: 'Using Section 14, design a differentiated marketing plan for flexibility-driven versus cost-driven subscribers.' },
      { number: 23, label: 'Timeline Analysis', text: 'Using Section 13, explain how the pace of Dwelly’s city expansion relates to its current runway problem.' },
      { number: 24, label: 'Media & Perception', text: 'Using Section 15, design a public communications plan addressing recent media questions about the furniture rental category’s sustainability.' },
      { number: 25, label: 'Executive Recommendation', text: 'You are the outside consultant. Write the final recommendation memo to the CEO and Board, synthesizing financial, operational, workforce, and market considerations from across the case.' },
      { number: 26, label: 'Investor & Cap Table', text: 'Using Section 17, evaluate how Dwelly’s cap table structure and investor return pressures should factor into the board’s decision, beyond the three stakeholders’ stated positions.' },
    ],
  },
  { key: 'zenith-esports', title: 'Zenith Esports', roles: [] },
  { key: 'solstice-apparel', title: 'Solstice Apparel', roles: [] },
]

/** Best-guess match from a case study's own title (e.g. "PulseFit Wearables", "Dwelly Case
 *  Study Launch") to its role bank, by loose substring match on the module key. Admins can
 *  always override the guess in AssignRolesModal, since titles aren't guaranteed to match. */
export function guessPresentationRoleModule(caseStudyTitle: string): PresentationRoleModule | null {
  const normalized = caseStudyTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
  return PRESENTATION_ROLE_MODULES.find((m) => normalized.includes(m.key.replace(/-/g, ''))) ?? null
}
