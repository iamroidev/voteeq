const CAMPUS_EVENTS = [
  {
    title: 'SRC Week Finale',
    description: 'Closing night for campus SRC Week — awards, performances, and student recognition.',
    date: '2026-03-28',
    venue: 'Main Auditorium',
    ticket_price: 15.0,
    privacy: 'public',
    access_code: null,
    total_tickets: 500,
  },
  {
    title: 'Hall Week Awards',
    description: 'Inter-hall competitions and hall executive recognition evening.',
    date: '2026-04-12',
    venue: 'Assembly Hall',
    ticket_price: 10.0,
    privacy: 'public',
    access_code: null,
    total_tickets: 300,
  },
  {
    title: 'Executive Dinner',
    description: 'Private dinner for executives, patrons, and invited guests.',
    date: '2026-04-18',
    venue: 'Faculty Club',
    ticket_price: 40.0,
    privacy: 'private',
    access_code: 'EXEC2026',
    total_tickets: 80,
  },
];

const CAMPUS_CATEGORIES = [
  ['SRC President', 'Student leadership election category'],
  ['Best Hall', 'Outstanding hall of the year'],
  ['Campus Talent', 'Best performing student act'],
];

const CAMPUS_NOMINEES = [
  ['101', 'Kwame Asante', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80', 1, 1, '1234', 420],
  ['102', 'Ama Osei', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80', 1, 1, '4321', 385],
  ['103', 'Kofi Mensah', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80', 1, 1, '9999', 310],
  ['201', 'Unity Hall', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=500&q=80', 2, 1, '1111', 540],
  ['202', 'Phoenix Hall', 'https://images.unsplash.com/photo-1562774053-701939374585?w=500&q=80', 2, 1, '2222', 498],
  ['301', 'The Stage Crew', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80', 3, 1, '3333', 275],
];

module.exports = {
  CAMPUS_EVENTS,
  CAMPUS_CATEGORIES,
  CAMPUS_NOMINEES,
};
