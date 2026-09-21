/** Word pools and subject templates used to generate varied, realistic-looking
 *  seed data. Kept separate from the seeding logic so the generator stays short. */

export const OFFICES = [
  'Head Office, Dhaka',
  'Mirpur Branch',
  'Chattogram Office',
  'Sylhet Office',
  'Khulna Office',
  'Rajshahi Office',
  'Bogura Field Office',
];

export const ROOMS = [
  'the 3rd floor meeting room',
  'the reception area',
  'the accounts room',
  'the server room',
  'the volunteer lounge',
  'the training hall',
  'the storage room',
];

export const DISTRICTS = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Khulna',
  'Rangpur',
  'Barishal',
  "Cox's Bazar",
  'Mymensingh',
  'Kurigram',
];

export const PROGRAMMES = [
  'Ramadan Food Package',
  'Orphan Sponsorship',
  'Winter Blanket Distribution',
  'Qurbani Programme',
  'Safe Water Well',
  'Emergency Flood Relief',
  'Education Scholarship',
  'Medical Camp',
];

export const TEAMS = [
  'the Accounts team',
  'the Media team',
  'the Field Operations team',
  'the Donor Relations team',
  'the Warehouse team',
  'the Call Centre team',
];

export const SYSTEMS = [
  'the donor management portal',
  'the payroll system',
  'the inventory system',
  'the official email account',
  'the beneficiary database',
  'the accounting software',
];

export const VENDORS = [
  'Rahman Traders',
  'Meghna Printers',
  'Bengal Logistics',
  'Padma Stationery',
  'Titas IT Solutions',
  'Jamuna Furniture',
];

export const ITEMS = [
  '40 office chairs',
  'a replacement generator battery',
  '500 relief packaging bags',
  'three desktop computers',
  'a network switch',
  'branded volunteer vests',
  'a photocopier toner cartridge',
];

export const ROLES = [
  'Field Coordinator',
  'Accounts Officer',
  'Programme Assistant',
  'Warehouse Supervisor',
  'Communications Officer',
  'Data Entry Operator',
];

export const SUBJECT_TEMPLATES: Record<string, string[]> = {
  'IT Support': [
    'Password reset required for {system}',
    'Laptop not booting at {office}',
    'Printer offline in {room}',
    'Email account setup for a new {role}',
    'VPN access request for {system}',
    'Shared drive permission needed for {team}',
    'Frequent disconnection from {system}',
    'Antivirus warning on the desktop in {room}',
  ],
  Facilities: [
    'Air conditioning not cooling in {room}',
    'Water leakage reported in {room}',
    'Generator maintenance due at {office}',
    'Lift out of service at {office}',
    'Additional desks required for {team}',
    'CCTV camera not recording at {office}',
    'Fire extinguisher inspection overdue at {office}',
  ],
  Finance: [
    'Reimbursement claim for {programme} field travel',
    'Vendor payment delayed for {vendor}',
    'Budget revision request for {programme}',
    'Donation receipt correction requested by a donor',
    'Petty cash top-up for {office}',
    'Audit document request for the {programme} account',
  ],
  HR: [
    'Leave approval pending for {team}',
    'Recruitment request for a {role}',
    'Salary certificate request for a bank application',
    'Training nomination for the {programme} team',
    'ID card replacement request',
    'Probation confirmation for a {role}',
  ],
  Procurement: [
    'Quotation approval needed for {item}',
    'Purchase order pending for {item}',
    'Vendor registration request for {vendor}',
    'Delivery delay reported for {item}',
    'Tender document review for {item}',
  ],
  'Programme Operations': [
    'Beneficiary list approval for {district} distribution',
    'Field report submission delayed from {district}',
    'Beneficiary data correction for {programme}',
    'Transport arrangement for the {district} distribution',
    'Warehouse stock discrepancy at {district}',
    'Site visit approval for {programme} in {district}',
  ],
  'Volunteer Coordination': [
    'Volunteer registration approval for {district}',
    'Orientation session scheduling in {district}',
    'Volunteer ID issuance for {programme}',
    'Duty roster conflict for the {district} campaign',
    'Certificate issuance for {programme} volunteers',
  ],
};

export const DESCRIPTION_OPENERS = [
  'Raising this on behalf of {team}.',
  'This was reported during the morning shift at {office}.',
  'Flagged by the coordinator during a routine check.',
  'This has been pending since last week and is now blocking work.',
  'Reporting this after confirming it is not a one-off issue.',
];

export const DESCRIPTION_DETAILS = [
  'The issue has been observed on more than one occasion and is affecting daily work.',
  'A temporary workaround is in place but it is not sustainable for long.',
  'Two staff members are currently unable to complete their assigned tasks because of this.',
  'The supporting documents have been shared with the relevant department over email.',
  'Please advise on the expected timeline so the team can plan accordingly.',
];

export const DESCRIPTION_CLOSERS = [
  'Kindly prioritise this as the distribution schedule depends on it.',
  'Happy to provide any further detail required.',
  'Please let me know if a physical inspection is needed.',
  'Requesting an update by the end of this week.',
  'Approval from the department head has already been obtained.',
];

export const COMMENTS = [
  'Acknowledged. Reviewing this with the department now.',
  'Waiting on a response from the vendor before proceeding.',
  'Site visit completed, parts have been ordered.',
  'Additional documents received from the requester.',
  'Escalated to the department head for approval.',
  'Confirmed with the requester that the issue is resolved.',
];

export const FIRST_NAMES = [
  'Abdullah',
  'Tanvir',
  'Rakib',
  'Nusrat',
  'Farhana',
  'Mizanur',
  'Shakil',
  'Jannatul',
  'Imran',
  'Sadia',
  'Habibur',
  'Mehedi',
  'Ayesha',
  'Rubel',
  'Sumaiya',
  'Arif',
  'Nazmul',
  'Tasnim',
  'Kamrul',
  'Sabrina',
  'Ruhul',
  'Ishrat',
  'Mahmud',
  'Fatema',
  'Zahid',
  'Munira',
  'Saiful',
  'Rumana',
  'Anwar',
  'Shirin',
];

export const LAST_NAMES = [
  'Rahman',
  'Hossain',
  'Islam',
  'Ahmed',
  'Chowdhury',
  'Karim',
  'Siddique',
  'Bhuiyan',
  'Akter',
  'Khatun',
  'Mahmud',
  'Sarker',
  'Talukder',
  'Miah',
  'Uddin',
  'Haque',
];

/** Staff accounts that can sign in and be assigned work. */
export const AGENTS = [
  { name: 'Ahmed Faruk', email: 'ahmed.faruk@assunnah.test' },
  { name: 'Nusrat Jahan', email: 'nusrat.jahan@assunnah.test' },
  { name: 'Mohammad Salim', email: 'mohammad.salim@assunnah.test' },
  { name: 'Rezaul Karim', email: 'rezaul.karim@assunnah.test' },
  { name: 'Tahmina Akter', email: 'tahmina.akter@assunnah.test' },
  { name: 'Shafiqul Islam', email: 'shafiqul.islam@assunnah.test' },
  { name: 'Marium Begum', email: 'marium.begum@assunnah.test' },
  { name: 'Jubayer Alam', email: 'jubayer.alam@assunnah.test' },
];
