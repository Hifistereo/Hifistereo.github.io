/* Builds a mailto: link from the fields below. There is no backend and the
   CSP's form-action 'none' rules out a real submission target, so "submit"
   just opens the visitor's own email app with the message already written —
   nothing here is stored or sent by the site itself. */

const fields = {
  what: document.getElementById('kluda-what'),
  steps: document.getElementById('kluda-steps'),
  where: document.getElementById('kluda-where'),
  device: document.getElementById('kluda-device'),
  email: document.getElementById('kluda-email'),
};
const submitLink = document.getElementById('kluda-submit');

function buildMailto() {
  const lines = [];
  if (fields.what.value.trim()) lines.push('Kas notika?\n' + fields.what.value.trim());
  if (fields.steps.value.trim()) lines.push('Kā to atkārtot?\n' + fields.steps.value.trim());
  if (fields.where.value.trim()) lines.push('Spēle vai lapa: ' + fields.where.value.trim());
  if (fields.device.value.trim()) lines.push('Ierīce un pārlūkprogramma: ' + fields.device.value.trim());
  if (fields.email.value.trim()) lines.push('Atbildes e-pasts: ' + fields.email.value.trim());

  const subject = encodeURIComponent('Kļūdas ziņojums: KidMindPath');
  const body = encodeURIComponent(lines.join('\n\n'));
  submitLink.href = `mailto:elmars.builis@gmail.com?subject=${subject}` + (lines.length ? `&body=${body}` : '');
}

for (const field of Object.values(fields)) {
  field.addEventListener('input', buildMailto);
}
