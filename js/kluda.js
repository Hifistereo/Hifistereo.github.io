/* Builds a mailto: link from the fields below. There is no backend and the
   CSP's form-action 'none' rules out a real submission target, so "submit"
   just opens the visitor's own email app with the message already written —
   nothing here is stored or sent by the site itself. */

const ADDRESS = 'elmars.builis@gmail.com';
const SUBJECT = 'Kļūdas ziņojums: KidMindPath';

/* Label => field id. The label is what the recipient reads in the email body,
   so it lives next to the id rather than in a parallel list that could drift
   out of step with it. */
const FIELDS = [
  ['Kas notika?', 'kluda-what', 'block'],
  ['Kā to atkārtot?', 'kluda-steps', 'block'],
  ['Spēle vai lapa', 'kluda-where', 'inline'],
  ['Ierīce un pārlūkprogramma', 'kluda-device', 'inline'],
  ['Atbildes e-pasts', 'kluda-email', 'inline'],
];

const submitLink = document.getElementById('kluda-submit');
const fields = FIELDS
  .map(([label, id, shape]) => ({ label, shape, input: document.getElementById(id) }))
  .filter((f) => f.input);

function buildMailto() {
  const lines = [];
  for (const { label, shape, input } of fields) {
    const value = input.value.trim();
    if (!value) continue;
    lines.push(shape === 'block' ? `${label}\n${value}` : `${label}: ${value}`);
  }

  const query = `subject=${encodeURIComponent(SUBJECT)}`
    + (lines.length ? `&body=${encodeURIComponent(lines.join('\n\n'))}` : '');
  submitLink.href = `mailto:${ADDRESS}?${query}`;
}

// A missing element means the markup and this file have drifted apart. The
// page still reads fine and the link still opens an empty email, so say so in
// the console and leave it alone rather than throwing on load.
if (!submitLink || fields.length !== FIELDS.length) {
  console.warn('kluda: report form markup is incomplete; leaving the mailto link as-is');
} else {
  for (const { input } of fields) input.addEventListener('input', buildMailto);
}
