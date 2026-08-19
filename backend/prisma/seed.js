const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 16 questions across 5 sections, 4 points max each (64 total).
// Note: the original brief said "15 questions" but listed section totals
// (12+12+12+12+16=64) that only divide evenly into 16 four-point questions.
// This seed resolves that inconsistency in favor of the section totals.
const QUESTIONS = [
  { section: 'Scratch', questionNumber: '1.1', questionText: 'Walk through how you would teach a student to build a simple "chase" game in Scratch using sprites and motion blocks.' },
  { section: 'Scratch', questionNumber: '1.2', questionText: 'Explain the difference between broadcast/receive events and direct message passing between sprites in Scratch.' },
  { section: 'Scratch', questionNumber: '1.3', questionText: 'A student\'s sprite is not responding to a keypress event. Diagnose likely causes and how you\'d guide the student to debug it.' },
  { section: 'Arduino', questionNumber: '2.1', questionText: 'Explain the difference between digitalWrite() and analogWrite(), and give an example use case for each.' },
  { section: 'Arduino', questionNumber: '2.2', questionText: 'Walk through wiring and code for reading a push button with debounce and lighting an LED.' },
  { section: 'Arduino', questionNumber: '2.3', questionText: 'A student\'s Arduino sketch compiles but the board behaves erratically. What troubleshooting steps do you take?' },
  { section: 'Python', questionNumber: '3.1', questionText: 'Write a Python function that prints numbers 1 through 5, one per line.' },
  { section: 'Python', questionNumber: '3.2', questionText: 'Write a Python function using a for loop and if/else that prints "Fizz", "Buzz", or the number for 1-15 (FizzBuzz).' },
  { section: 'Python', questionNumber: '3.3', questionText: 'Explain how you would teach functions, parameters, and return values to a first-time programmer.' },
  { section: 'WebDev', questionNumber: '4.1', questionText: 'Explain the difference between HTML, CSS, and JavaScript and the role each plays on a web page.' },
  { section: 'WebDev', questionNumber: '4.2', questionText: 'Add a "Click Me" button that changes the page background color when clicked, using HTML/CSS/JS.' },
  { section: 'WebDev', questionNumber: '4.3', questionText: 'A student\'s button click handler isn\'t firing. Walk through how you\'d help them debug it in the browser.' },
  { section: 'Teaching', questionNumber: '5.1', questionText: 'Describe your approach to teaching a concept to a student who is clearly frustrated and ready to give up.' },
  { section: 'Teaching', questionNumber: '5.2', questionText: 'How do you differentiate instruction for a mixed-skill classroom of coding/robotics students?' },
  { section: 'Teaching', questionNumber: '5.3', questionText: 'Describe how you handle a classroom management issue during a hands-on robotics lab.' },
  { section: 'Teaching', questionNumber: '5.4', questionText: 'What does success look like for you after a 6-week coding module, and how would you measure it?' },
];

async function main() {
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    await prisma.question.upsert({
      where: { id: i + 1 },
      update: { ...q, maxPoints: 4, sortOrder: i },
      create: { id: i + 1, ...q, maxPoints: 4, sortOrder: i },
    });
  }
  console.log(`Seeded ${QUESTIONS.length} interview questions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
